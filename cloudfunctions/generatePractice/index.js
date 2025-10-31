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

    // 使用 Promise.all 处理异步生成选项
    const myQuestions = await Promise.all(myErrors.data.map(async (error) => {
      const options = await generateOptions(error.content, subject, knowledgePoint)

      // 打乱选项顺序，让正确答案不总是A
      const shuffledData = shuffleOptions(options, 0)

      return {
        questionId: error._id,
        source: 'my_error',
        content: error.content,
        options: shuffledData.options,
        correctAnswer: shuffledData.correctAnswer,
        explanation: error.aiAnalysis?.explanation || '暂无解析',
        difficulty: error.difficulty
      }
    }))

    questions.push(...myQuestions)

    // 仅使用错题本，不补充模拟题
    // 如果错题不足，就返回实际数量
    if (questions.length === 0) {
      return {
        success: false,
        error: '暂无未掌握的错题，请先录入错题后再进行练习'
      }
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
 * 生成选项（从题目内容中提取或通过AI生成）
 */
async function generateOptions(content, subject, knowledgePoint) {
  // 尝试从内容中提取选项
  const optionPattern = /[A-D][\.、\s]*([^\n]+)/g
  const matches = [...content.matchAll(optionPattern)]

  if (matches.length >= 4) {
    return matches.slice(0, 4).map((match, index) => ({
      label: String.fromCharCode(65 + index),
      text: match[1].trim()
    }))
  }

  // 如果无法提取选项，调用AI生成
  try {
    console.log('题目没有选项，调用AI生成选项:', content)

    const result = await cloud.callFunction({
      name: 'callDeepSeek',
      data: {
        messages: [{
          role: 'user',
          content: `这是一道${subject}的${knowledgePoint}相关题目，请为它生成4个选项（包括1个正确答案和3个干扰项）。

题目：${content}

要求：
1. 选项要符合学科特点和知识点要求
2. 干扰项要有迷惑性，但不能完全错误
3. 直接返回JSON格式，不要任何其他说明文字
4. 第一个选项必须是正确答案

返回格式示例：
{
  "options": [
    {"label": "A", "text": "正确答案"},
    {"label": "B", "text": "干扰项1"},
    {"label": "C", "text": "干扰项2"},
    {"label": "D", "text": "干扰项3"}
  ]
}`
        }]
      }
    })

    console.log('callDeepSeek 返回结果:', JSON.stringify(result))

    if (result.result && result.result.content) {
      // 尝试解析AI返回的JSON
      const aiReply = result.result.content.trim()
      console.log('AI返回的原始内容:', aiReply)

      // 提取JSON部分（处理可能的markdown代码块）
      const jsonMatch = aiReply.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        console.log('提取的JSON:', jsonMatch[0])
        const parsed = JSON.parse(jsonMatch[0])
        if (parsed.options && parsed.options.length >= 4) {
          console.log('AI成功生成选项:', parsed.options)
          return parsed.options
        } else {
          console.warn('解析的JSON不包含有效的options数组')
        }
      } else {
        console.warn('无法从AI返回中提取JSON')
      }
    } else {
      console.warn('callDeepSeek返回结果无效:', result)
    }
  } catch (error) {
    console.error('AI生成选项失败:', error)
    console.error('错误详情:', error.message, error.stack)
  }

  // 如果AI生成失败，返回通用占位选项
  console.warn('使用默认占位选项')
  return [
    { label: 'A', text: '选项A（请查看题目内容）' },
    { label: 'B', text: '选项B（请查看题目内容）' },
    { label: 'C', text: '选项C（请查看题目内容）' },
    { label: 'D', text: '选项D（请查看题目内容）' }
  ]
}

/**
 * 打乱选项顺序
 * @param {Array} options - 选项数组
 * @param {number} correctAnswer - 原始正确答案索引
 * @returns {Object} { options: 打乱后的选项, correctAnswer: 新的正确答案索引 }
 */
function shuffleOptions(options, correctAnswer) {
  // 创建索引映射数组
  const indices = options.map((_, index) => index)

  // Fisher-Yates 洗牌算法
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]]
  }

  // 根据打乱的索引重新排列选项
  const shuffledOptions = indices.map(i => options[i])

  // 找到正确答案的新位置
  const newCorrectAnswer = indices.indexOf(correctAnswer)

  return {
    options: shuffledOptions,
    correctAnswer: newCorrectAnswer
  }
}

