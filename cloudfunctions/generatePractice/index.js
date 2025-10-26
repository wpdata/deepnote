// 云函数：生成练习题
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

/**
 * 生成练习题云函数
 * 功能：根据知识点生成练习题
 *
 * @param {Object} event
 * @param {string} event.knowledgePoint - 知识点
 * @param {string} event.subject - 学科
 * @param {number} event.count - 题目数量（默认5）
 * @returns {Object} 练习题列表
 */
exports.main = async (event, context) => {
  const {
    knowledgePoint,
    subject,
    count = 5
  } = event

  // 获取openid，测试环境使用固定值
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID || 'test_user_openid'

  if (!knowledgePoint || !subject) {
    return {
      success: false,
      error: '缺少必要参数'
    }
  }

  try {
    const questions = []

    // 策略1: 从自己的错题中选择未掌握的
    const myErrors = await db.collection('errors')
      .where({
        _openid: openid,
        subject,
        knowledgePoint,
        mastered: false
      })
      .limit(count)
      .get()

    questions.push(...myErrors.data.map(error => ({
      questionId: error._id,
      source: 'my_error',
      content: error.content,
      options: generateOptions(error.content),
      correctAnswer: 0,
      explanation: error.aiAnalysis?.explanation || '暂无解析',
      difficulty: error.difficulty
    })))

    // 策略2: 如果题目不够，生成模拟题目（后续可从题库或AI生成）
    if (questions.length < count) {
      const mockQuestions = generateMockQuestions(
        subject,
        knowledgePoint,
        count - questions.length
      )
      questions.push(...mockQuestions)
    }

    return {
      success: true,
      questions,
      count: questions.length
    }

  } catch (error) {
    console.error('生成练习题失败:', error)
    return {
      success: false,
      error: error.message || '生成练习题失败'
    }
  }
}

/**
 * 生成选项（从题目内容中提取或生成）
 */
function generateOptions(content) {
  // 尝试从内容中提取选项
  const optionPattern = /[A-D][\.、\s]*([^\n]+)/g
  const matches = [...content.matchAll(optionPattern)]

  if (matches.length >= 4) {
    return matches.slice(0, 4).map((match, index) => ({
      label: String.fromCharCode(65 + index),
      text: match[1].trim()
    }))
  }

  // 如果无法提取，返回模拟选项
  return [
    { label: 'A', text: '选项A' },
    { label: 'B', text: '选项B' },
    { label: 'C', text: '选项C' },
    { label: 'D', text: '选项D' }
  ]
}

/**
 * 生成模拟练习题
 * TODO: 后续从题库或AI生成
 */
function generateMockQuestions(subject, knowledgePoint, count) {
  const mockQuestions = {
    '数学-函数与方程': [
      {
        content: '下列函数中，在定义域内单调递增的是？',
        options: [
          { label: 'A', text: 'f(x) = -x² + 1' },
          { label: 'B', text: 'f(x) = x³' },
          { label: 'C', text: 'f(x) = -x' },
          { label: 'D', text: 'f(x) = 1/x' }
        ],
        correctAnswer: 1,
        explanation: 'f(x) = x³ 是奇函数，在整个定义域 R 上单调递增。',
        difficulty: 'medium'
      },
      {
        content: '函数 f(x) = 2x - 1 的零点是？',
        options: [
          { label: 'A', text: 'x = 0' },
          { label: 'B', text: 'x = 1/2' },
          { label: 'C', text: 'x = -1/2' },
          { label: 'D', text: 'x = 1' }
        ],
        correctAnswer: 1,
        explanation: '令 f(x) = 0，即 2x - 1 = 0，解得 x = 1/2。',
        difficulty: 'easy'
      },
      {
        content: '若函数 f(x) 在区间 [a, b] 上连续，且 f(a)·f(b) < 0，则函数在区间 (a, b) 内？',
        options: [
          { label: 'A', text: '一定有零点' },
          { label: 'B', text: '可能有零点' },
          { label: 'C', text: '一定没有零点' },
          { label: 'D', text: '有且仅有一个零点' }
        ],
        correctAnswer: 0,
        explanation: '根据零点存在定理，函数在该区间内一定有零点。',
        difficulty: 'medium'
      }
    ],
    '数学-三角函数': [
      {
        content: 'sin 30° + cos 60° = ?',
        options: [
          { label: 'A', text: '0' },
          { label: 'B', text: '1' },
          { label: 'C', text: '√2' },
          { label: 'D', text: '√3' }
        ],
        correctAnswer: 1,
        explanation: 'sin 30° = 1/2, cos 60° = 1/2, 相加得 1。',
        difficulty: 'easy'
      }
    ]
  }

  const key = `${subject}-${knowledgePoint}`
  const questions = mockQuestions[key] || mockQuestions['数学-函数与方程']

  return questions.slice(0, count).map((q, index) => ({
    questionId: `mock_${Date.now()}_${index}`,
    source: 'mock',
    ...q
  }))
}
