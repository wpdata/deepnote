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

    // 验证权限（只能查看自己的错题）
    if (error._openid !== openid) {
      return {
        success: false,
        error: '无权访问此错题'
      }
    }

    // 如果没有AI分析，生成模拟分析（后续替换为真实AI分析）
    if (!error.aiAnalysis) {
      error.aiAnalysis = generateMockAnalysis(error)
    }

    // 如果没有相关知识点，生成推荐
    if (!error.relatedKnowledge || error.relatedKnowledge.length === 0) {
      error.relatedKnowledge = generateRelatedKnowledge(error.knowledgePoint)
    }

    return {
      success: true,
      error
    }

  } catch (error) {
    console.error('获取错题详情失败:', error)
    return {
      success: false,
      error: error.message || '获取错题详情失败'
    }
  }
}

/**
 * 生成模拟的AI分析
 * TODO: 后续替换为真实的AI分析
 */
function generateMockAnalysis(error) {
  const analyses = {
    '函数与方程': {
      errorReason: '对函数零点的定义理解不够深入，没有掌握零点的求解方法。函数零点是指函数值为0时对应的自变量的值，即方程 f(x) = 0 的解。',
      explanation: '函数零点的求法：\n1. 代数法：令 f(x) = 0，解方程得到零点\n2. 图象法：观察函数图象与 x 轴的交点坐标\n3. 零点存在定理：如果函数 y = f(x) 在区间 [a, b] 上的图象是连续不断的，且 f(a)·f(b) < 0，那么函数在区间 (a, b) 内有零点',
      solution: '解题步骤：\n1. 令函数 f(x) = 0\n2. 将函数表达式改写为方程形式\n3. 对方程进行因式分解或使用求根公式\n4. 解出方程的根，即为函数的零点\n5. 验证结果是否正确',
      warningTip: '注意区分"零点"和"零点坐标"：\n• 零点是一个实数（横坐标）\n• 零点坐标是一个点 (x, 0)\n求函数零点时只需写出 x 的值，不需要写成坐标形式。'
    },
    '三角函数': {
      errorReason: '对三角函数的基本性质掌握不够牢固，特别是特殊角的三角函数值和诱导公式的应用。',
      explanation: '三角函数的基础知识：\n1. 特殊角：30°, 45°, 60°, 90° 的三角函数值要熟记\n2. 诱导公式：sin(90°-α) = cos α, cos(90°-α) = sin α\n3. 同角关系：sin²α + cos²α = 1\n4. 和差公式的应用',
      solution: '解题步骤：\n1. 识别题目中的特殊角\n2. 回忆特殊角的三角函数值\n3. 应用诱导公式简化\n4. 进行计算\n5. 检查结果是否合理',
      warningTip: '容易混淆的点：\n• sin 30° = 1/2, sin 60° = √3/2\n• cos 30° = √3/2, cos 60° = 1/2\n• 不要记反了！建议画单位圆辅助记忆'
    }
  }

  // 根据知识点返回对应分析，如果没有则返回通用分析
  return analyses[error.knowledgePoint] || {
    errorReason: `在${error.knowledgePoint}这个知识点上存在理解偏差，需要进一步巩固基础概念。`,
    explanation: `${error.subject}的${error.knowledgePoint}是重要知识点，建议：\n1. 回顾教材相关章节\n2. 理解核心概念和公式\n3. 多做相关练习题\n4. 总结解题规律`,
    solution: '解题思路：\n1. 仔细审题，理解题意\n2. 回忆相关知识点\n3. 制定解题步骤\n4. 规范书写过程\n5. 检验答案合理性',
    warningTip: '学习建议：\n• 建立错题本，定期复习\n• 总结题型和解题方法\n• 寻找相似题目进行练习\n• 不懂及时向老师或同学请教'
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
