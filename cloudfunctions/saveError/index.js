// 云函数：保存错题(增强版:支持视觉模型智能处理)
const cloud = require('wx-server-sdk')
const crypto = require('crypto')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 阿里云 DashScope API 配置 (Qwen Math & Qwen-VL 共用)
const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY || 'your-dashscope-api-key'

// DeepSeek API 配置
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || 'your-deepseek-api-key'
const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions'

/**
 * 保存错题云函数
 * 功能：将错题保存到数据库，并更新统计信息
 *
 * @param {Object} event
 * @param {string} event.content - 题目内容
 * @param {string} event.subject - 学科
 * @param {string} event.knowledgePoint - 知识点
 * @param {string} event.imageUrl - 题目图片URL（可选）
 * @param {string} event.difficulty - 难度（可选）
 * @returns {Object} 保存结果
 */
exports.main = async (event, context) => {
  const {
    content,
    subject,
    knowledgePoint,
    imageUrl = '',
    difficulty = 'medium',
    questionType = '未知',
    userAnswer = '',
    correctAnswer = '',
    isCorrect = null,
    aiAnalysisText = '',    // AI分析文本
    mode = 'add',           // 新增模式参数: 'add'=新增, 'update'=更新
    errorId = null,         // 更新时需要提供errorId
    processingMode = 'auto' // 新增: 'auto'=自动判断, 'fast'=快速(DeepSeek), 'vision'=视觉(Qwen3-VL)
  } = event

  // 获取用户身份信息
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID || 'test_user_openid'

  // 获取 userId 和年级信息（从数据库查询）
  let userId = null
  let userGrade = null
  try {
    const userQuery = await db.collection('users').where({
      openId: openid
    }).get()

    if (userQuery.data.length > 0) {
      userId = userQuery.data[0]._id
      userGrade = userQuery.data[0].grade || null
    }
  } catch (error) {
    console.error('获取userId失败:', error)
  }

  // === 生成题目摘要和标签（用于搜索） ===
  let enhancedData = {}
  let actualProcessingMode = 'skip' // 记录实际使用的模式

  // 注意：AI分析已在 ocrRecognize 阶段完成（前端识别时）
  // 这里只需要生成简单的摘要和标签用于搜索功能
  console.log('题目识别已在前端完成，跳过重复分析')

  console.log('实际处理模式:', actualProcessingMode)

  // 参数验证(兼容原有逻辑)
  if (!content || !subject || !knowledgePoint) {
    return {
      success: false,
      error: '缺少必要参数：content, subject, knowledgePoint'
    }
  }

  try {
    // 更新模式
    if (mode === 'update' && errorId) {
      const updateData = {
        subject,
        knowledgePoint,
        difficulty,
        questionType,
        content,
        imageUrl,
        userAnswer,
        correctAnswer,
        isCorrect,
        answer: correctAnswer || '',
        aiAnalysis: aiAnalysisText,  // 更新AI分析
        updateTime: new Date()
      }

      // 如果有年级信息,也更新年级
      if (userGrade) {
        updateData.gradeInfo = userGrade
      }

      const updateResult = await db.collection('errors')
        .doc(errorId)
        .update({
          data: updateData
        })

      return {
        success: true,
        errorId,
        mode: 'update',
        message: '错题更新成功'
      }
    }

    // 新增模式
    const errorData = {
      _openid: openid,
      userId: userId,    // 新增 userId 字段
      subject,
      knowledgePoint,
      difficulty,
      questionType,
      content,
      imageUrl,
      // 答案相关字段
      userAnswer,        // 学生填写的答案
      correctAnswer: enhancedData.correctAnswer || correctAnswer,  // 优先使用AI分析的答案
      isCorrect,         // 是否正确 (true/false/null)
      answer: enhancedData.correctAnswer || correctAnswer || '',  // 兼容旧字段
      // AI分析
      aiAnalysis: enhancedData.aiAnalysis || aiAnalysisText,  // 优先使用增强分析
      // 年级信息 - 记录添加错题时的年级
      gradeInfo: userGrade,
      // === 新增智能处理字段 ===
      questionSummary: enhancedData.questionSummary || '',     // 题目摘要
      questionTags: enhancedData.questionTags || [],           // 关键词标签
      ocrQuality: enhancedData.ocrQuality || 'unknown',        // OCR质量
      contentSource: enhancedData.contentSource || 'original', // 内容来源
      isImageBased: enhancedData.isImageBased || false,        // 是否图片优先
      solvingSteps: enhancedData.solvingSteps || [],           // 解题步骤
      processingMode: actualProcessingMode,                     // 实际处理模式
      // 练习统计
      mastered: false,
      masteredTime: null,
      practiceCount: 0,
      correctCount: 0,
      wrongCount: 0,
      lastPracticeTime: null,
      relatedKnowledge: [],
      createTime: new Date(),
      updateTime: new Date()
    }

    const errorResult = await db.collection('errors').add({
      data: errorData
    })

    const newErrorId = errorResult._id

    // 2. 更新用户统计
    await updateUserStats(openid, 'addError')

    // 3. 更新知识点统计
    await updateKnowledgeStats(openid, subject, knowledgePoint, 'addError')

    // 4. 如果有OCR记录，标记为已采纳
    if (imageUrl) {
      await markOCRAsAdopted(openid, imageUrl, newErrorId)
    }

    return {
      success: true,
      errorId: newErrorId,
      message: '错题保存成功'
    }

  } catch (error) {
    console.error('保存错题失败:', error)
    return {
      success: false,
      error: error.message || '保存错题失败'
    }
  }
}

/**
 * 更新用户统计数据
 */
async function updateUserStats(openid, action) {
  const _ = db.command

  try {
    // 查询用户是否存在
    const userResult = await db.collection('users')
      .where({ _openid: openid })
      .get()

    if (userResult.data.length === 0) {
      // 创建新用户
      await db.collection('users').add({
        data: {
          _openid: openid,
          studyDays: 1,
          totalErrors: action === 'addError' ? 1 : 0,
          masteredErrors: 0,
          practiceCount: 0,
          createTime: new Date(),
          updateTime: new Date()
        }
      })
    } else {
      // 更新现有用户
      const updates = {
        updateTime: new Date()
      }

      if (action === 'addError') {
        updates.totalErrors = _.inc(1)
      } else if (action === 'markMastered') {
        updates.masteredErrors = _.inc(1)
      } else if (action === 'practice') {
        updates.practiceCount = _.inc(1)
      }

      await db.collection('users')
        .where({ _openid: openid })
        .update({
          data: updates
        })
    }
  } catch (error) {
    console.error('更新用户统计失败:', error)
  }
}

/**
 * 更新知识点统计
 */
async function updateKnowledgeStats(openid, subject, knowledgePoint, action) {
  const _ = db.command

  try {
    // 查询知识点统计是否存在
    const statsResult = await db.collection('knowledge_stats')
      .where({
        _openid: openid,
        subject,
        knowledgePoint
      })
      .get()

    if (statsResult.data.length === 0) {
      // 创建新的知识点统计
      await db.collection('knowledge_stats').add({
        data: {
          _openid: openid,
          subject,
          knowledgePoint,
          totalErrors: action === 'addError' ? 1 : 0,
          masteredErrors: 0,
          masteredRate: 0,
          practiceCount: 0,
          correctCount: 0,
          wrongCount: 0,
          lastPracticeTime: null,
          createTime: new Date(),
          updateTime: new Date()
        }
      })
    } else {
      // 更新现有统计
      const updates = {
        updateTime: new Date()
      }

      if (action === 'addError') {
        updates.totalErrors = _.inc(1)
      } else if (action === 'markMastered') {
        updates.masteredErrors = _.inc(1)
      }

      // 重新计算掌握率
      const stats = statsResult.data[0]
      const newMasteredErrors = action === 'markMastered'
        ? stats.masteredErrors + 1
        : stats.masteredErrors
      const newTotalErrors = action === 'addError'
        ? stats.totalErrors + 1
        : stats.totalErrors

      updates.masteredRate = newTotalErrors > 0
        ? Math.round((newMasteredErrors / newTotalErrors) * 100)
        : 0

      await db.collection('knowledge_stats')
        .where({
          _openid: openid,
          subject,
          knowledgePoint
        })
        .update({
          data: updates
        })
    }
  } catch (error) {
    console.error('更新知识点统计失败:', error)
  }
}

/**
 * 标记OCR记录为已采纳
 */
async function markOCRAsAdopted(openid, imageUrl, errorId) {
  try {
    await db.collection('ocr_records')
      .where({
        _openid: openid,
        imageUrl
      })
      .update({
        data: {
          isAdopted: true,
          errorId
        }
      })
  } catch (error) {
    console.error('标记OCR记录失败:', error)
  }
}

/**
 * 评估OCR识别质量
 */
function evaluateOCRQuality(text) {
  if (!text || text.trim().length === 0) {
    return 'none'
  }

  const length = text.length

  // 检查是否有乱码或特殊字符
  const hasGarbage = /[���?]{3,}/.test(text)
  const hasIncompleteChars = /\?{2,}/.test(text)

  // 检查是否有明显的OCR错误（如 "了个气"、断句、多余空格等）
  const hasOCRErrors = /[了个气]{3}|[\u4e00-\u9fa5]\s[\u4e00-\u9fa5]/.test(text)

  // 检查是否有不完整的词（如 "大小相 大小相同"）
  const hasIncompleteWords = /(\S+)\s\1/.test(text)

  // 检查是否有意义的词汇
  const meaningfulWords = text.match(/[\u4e00-\u9fa5a-zA-Z]{2,}/g) || []
  const meaningfulRatio = meaningfulWords.join('').length / length

  // 更严格的判断条件
  if (hasGarbage || hasIncompleteChars || hasOCRErrors || hasIncompleteWords) {
    console.log('OCR质量低: 检测到乱码或错误')
    return 'low'
  }

  if (length < 15) {
    console.log('OCR质量低: 文本过短')
    return 'low'
  }

  if (meaningfulRatio > 0.7 && length > 30) {
    console.log('OCR质量高: 文本清晰完整')
    return 'high'
  }

  if (meaningfulRatio > 0.5) {
    console.log('OCR质量中等: 文本基本可读')
    return 'medium'
  }

  console.log('OCR质量低: 有效字符比例不足')
  return 'low'
}

/**
 * 使用 Qwen3-VL 进行图片解题
 */
async function solveWithQwen3VL(imageUrl, ocrText, subject, userGrade) {
  const gradeInfo = userGrade ? `用户当前${userGrade.displayName}` : ''

  const prompt = `你是一位专业的${subject}老师。${gradeInfo}

请分析这道题目:
${ocrText ? '题目文字(可能不完整): ' + ocrText : ''}
图片: 请仔细查看题目图片

请提供以下内容(以JSON格式返回):
{
  "summary": "题目摘要(50字以内,概括题目核心内容)",
  "tags": ["关键词1", "关键词2", "关键词3", ...] (3-8个标签),
  "knowledgePoint": "主要知识点",
  "difficulty": "简单|中等|困难",
  "questionType": "题型(如:选择题/填空题/应用题/几何题/连线题)",
  "answer": "正确答案",
  "steps": ["解题步骤1", "解题步骤2", ...] (每个步骤一行),
  "analysis": "详细的解题思路分析(200字左右)"
}

注意:
1. 如果是几何题,请仔细分析图形
2. 如果是连线题/匹配题,请说明匹配关系
3. 标签应包含:学科、题型、知识点、难度等关键词
`

  try {
    // 调用阿里云 Qwen3-VL API
    const response = await cloud.callFunction({
      name: 'callQwenVL',
      data: {
        imageUrl: imageUrl,
        prompt: prompt
      }
    })

    if (response.result && response.result.success) {
      const result = JSON.parse(response.result.content)
      return result
    } else {
      throw new Error('Qwen3-VL API调用失败')
    }
  } catch (error) {
    console.error('Qwen3-VL调用错误:', error)
    throw error
  }
}

/**
 * 使用 DeepSeek 进行文字分析
 */
async function analyzeWithDeepSeek(text, subject) {
  const prompt = `你是一位专业的${subject}老师。

请分析这道题目:
${text}

请提供以下内容(以JSON格式返回):
{
  "summary": "题目摘要(50字以内)",
  "tags": ["关键词1", "关键词2", ...] (3-8个标签,包含学科、题型、知识点等)
}

只需要返回摘要和标签,其他分析已经完成。
`

  try {
    // 调用 DeepSeek API(通过云函数)
    const response = await cloud.callFunction({
      name: 'callDeepSeek',
      data: {
        prompt: prompt,
        maxTokens: 300
      }
    })

    if (response.result && response.result.success) {
      const result = JSON.parse(response.result.content)
      return result
    } else {
      throw new Error('DeepSeek API调用失败')
    }
  } catch (error) {
    console.error('DeepSeek调用错误:', error)
    // 降级处理:返回基础数据
    return {
      summary: text.substring(0, 50) + '...',
      tags: [subject, '待分类']
    }
  }
}
