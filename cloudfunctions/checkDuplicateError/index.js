// 云函数：检测重复题目
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

/**
 * 检测重复题目
 * 使用文本相似度算法检测是否已存在相似题目
 *
 * @param {Object} event
 * @param {string} event.content - 题目内容
 * @param {string} event.subject - 学科
 * @returns {Object} 检测结果
 */
exports.main = async (event, context) => {
  const { content, subject } = event

  if (!content) {
    return {
      success: false,
      error: '缺少题目内容'
    }
  }

  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID || 'test_user_openid'

  try {
    // 1. 查询同学科的所有题目
    const result = await db.collection('errors')
      .where({
        _openid: openid,
        subject: subject || db.command.exists(true)
      })
      .field({
        _id: true,
        content: true,
        subject: true,
        knowledgePoint: true,
        difficulty: true,
        mastered: true,
        createTime: true
      })
      .get()

    if (result.data.length === 0) {
      return {
        success: true,
        isDuplicate: false,
        duplicates: []
      }
    }

    // 2. 计算相似度
    const duplicates = []
    const inputText = normalizeText(content)

    for (const error of result.data) {
      const existingText = normalizeText(error.content)
      const similarity = calculateSimilarity(inputText, existingText)

      // 相似度超过85%认为是重复题目
      if (similarity > 0.85) {
        duplicates.push({
          _id: error._id,
          content: error.content,
          subject: error.subject,
          knowledgePoint: error.knowledgePoint,
          difficulty: error.difficulty,
          mastered: error.mastered,
          createTime: error.createTime,
          similarity: Math.round(similarity * 100)
        })
      }
    }

    // 3. 按相似度排序
    duplicates.sort((a, b) => b.similarity - a.similarity)

    return {
      success: true,
      isDuplicate: duplicates.length > 0,
      duplicates: duplicates.slice(0, 3),  // 最多返回3个最相似的
      count: duplicates.length
    }

  } catch (error) {
    console.error('检测重复题目失败:', error)
    return {
      success: false,
      error: error.message || '检测失败'
    }
  }
}

/**
 * 文本标准化：去除空白、标点、统一大小写
 */
function normalizeText(text) {
  if (!text) return ''

  return text
    .toLowerCase()
    .replace(/\s+/g, '')  // 去除所有空白
    .replace(/[,。，、:：;；！!？?'"'""]/g, '')  // 去除标点
    .replace(/[_\(\)（）\[\]【】]/g, '')  // 去除括号和横线
    .trim()
}

/**
 * 计算两个字符串的相似度（Jaccard相似度）
 * 返回值范围: 0-1，1表示完全相同
 */
function calculateSimilarity(str1, str2) {
  if (!str1 || !str2) return 0
  if (str1 === str2) return 1

  // 转换为字符集合
  const set1 = new Set(str1.split(''))
  const set2 = new Set(str2.split(''))

  // 计算交集
  const intersection = new Set([...set1].filter(x => set2.has(x)))

  // 计算并集
  const union = new Set([...set1, ...set2])

  // Jaccard相似度 = 交集大小 / 并集大小
  return intersection.size / union.size
}
