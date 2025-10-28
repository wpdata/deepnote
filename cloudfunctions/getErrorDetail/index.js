// 云函数：获取错题详情
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

/**
 * 获取错题详情云函数
 * 功能：查询错题的完整信息
 *
 * @param {Object} event
 * @param {string} event.errorId - 错题ID
 * @returns {Object} 错题详情
 */
exports.main = async (event, context) => {
  const { errorId } = event
  // 获取openid，测试环境使用固定值
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID || 'test_user_openid'

  if (!errorId) {
    return {
      success: false,
      error: '缺少错题ID参数'
    }
  }

  try {
    // 查询错题详情
    const errorResult = await db.collection('errors')
      .doc(errorId)
      .get()

    if (!errorResult.data) {
      return {
        success: false,
        error: '错题不存在'
      }
    }

    const error = errorResult.data

    console.log('====== getErrorDetail 原始数据 ======')
    console.log('_id:', error._id)
    console.log('subject:', error.subject)
    console.log('knowledgePoint:', error.knowledgePoint)
    console.log('userAnswer:', error.userAnswer)
    console.log('correctAnswer:', error.correctAnswer)
    console.log('isCorrect:', error.isCorrect)
    console.log('aiAnalysis类型:', typeof error.aiAnalysis)
    console.log('aiAnalysis值:', error.aiAnalysis)
    console.log('====================================')

    // 验证权限（只能查看自己的错题）
    // 注意：如果错题没有 _openid 字段，说明是测试数据，允许访问
    if (error._openid && error._openid !== openid) {
      return {
        success: false,
        error: '无权访问此错题'
      }
    }

    // 统一AI分析字段格式
    // 新数据：aiAnalysis 是 DeepSeek 生成的字符串文本 (50-80字专业分析)
    // 旧数据：aiAnalysis 是对象 (包含 errorReason, explanation, solution, warningTip)
    let aiAnalysisText = ''
    let aiAnalysisObj = null

    if (error.aiAnalysis) {
      if (typeof error.aiAnalysis === 'string') {
        // 新格式：直接使用 DeepSeek 生成的分析文本
        aiAnalysisText = error.aiAnalysis
      } else if (typeof error.aiAnalysis === 'object') {
        // 旧格式：保留完整的对象结构，供前端展示详细内容
        aiAnalysisObj = error.aiAnalysis

        // 同时生成简化的文本版本（用于不支持结构化显示的地方）
        const parts = []
        if (error.aiAnalysis.errorReason) parts.push(`错误原因：${error.aiAnalysis.errorReason}`)
        if (error.aiAnalysis.explanation) parts.push(`知识点讲解：${error.aiAnalysis.explanation}`)
        if (error.aiAnalysis.solution) parts.push(`解题思路：${error.aiAnalysis.solution}`)
        if (error.aiAnalysis.warningTip) parts.push(`易错提示：${error.aiAnalysis.warningTip}`)
        aiAnalysisText = parts.join('\n\n')
      }
    }

    // 如果没有AI分析文本，生成一个简单的提示
    if (!aiAnalysisText && !aiAnalysisObj) {
      aiAnalysisText = `这道${error.subject}题考查${error.knowledgePoint}知识点。建议重点复习相关概念和解题方法，多做类似练习加强理解。`
    }

    // 返回结构化数据
    const result = {
      success: true,
      error: {
        ...error,
        // 兼容两种格式：
        // 1. aiAnalysis: 原始数据（可能是对象或字符串）
        // 2. aiAnalysisText: 文本版本（用于简单显示）
        aiAnalysis: aiAnalysisObj || error.aiAnalysis,
        aiAnalysisText: aiAnalysisText,
        // 确保返回所有关键字段
        difficulty: error.difficulty || 'medium',
        questionType: error.questionType || '',
        practiceCount: error.practiceCount || 0,
        correctCount: error.correctCount || 0,
        wrongCount: error.wrongCount || 0,
        // 如果没有相关知识点，生成推荐
        relatedKnowledge: error.relatedKnowledge || generateRelatedKnowledge(error.knowledgePoint)
      }
    }

    console.log('====== getErrorDetail 返回数据 ======')
    console.log('difficulty:', result.error.difficulty)
    console.log('questionType:', result.error.questionType)
    console.log('practiceCount:', result.error.practiceCount)
    console.log('aiAnalysis类型:', typeof result.error.aiAnalysis)
    console.log('aiAnalysisText:', result.error.aiAnalysisText)
    console.log('userAnswer:', result.error.userAnswer)
    console.log('correctAnswer:', result.error.correctAnswer)
    console.log('isCorrect:', result.error.isCorrect)
    console.log('imageUrl:', result.error.imageUrl)
    console.log('relatedKnowledge:', result.error.relatedKnowledge)
    console.log('====================================')

    return result

  } catch (error) {
    console.error('获取错题详情失败:', error)
    return {
      success: false,
      error: error.message || '获取错题详情失败'
    }
  }
}

/**
 * 生成相关知识点
 */
function generateRelatedKnowledge(knowledgePoint) {
  const relatedMap = {
    '函数与方程': ['二次函数', '因式分解', '求根公式', '函数图象', '零点存在定理'],
    '三角函数': ['特殊角', '诱导公式', '同角关系', '和差公式', '单位圆'],
    '立体几何': ['空间向量', '三视图', '体积计算', '平面几何', '空间角'],
    '概率统计': ['排列组合', '概率计算', '统计图表', '方差标准差', '正态分布']
  }

  return relatedMap[knowledgePoint] || ['基础概念', '公式定理', '解题方法', '易错点']
}
