// 云函数：根据学科查询错题列表
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

/**
 * 根据学科查询错题列表
 * @param {string} subject - 学科名称（中文）
 * @returns {Object} 错题列表
 */
exports.main = async (event, context) => {
  const { subject } = event

  if (!subject) {
    return {
      success: false,
      error: '缺少学科参数'
    }
  }

  try {
    // 查询该学科下的所有错题
    const result = await db.collection('errors')
      .where({
        subject: subject
      })
      .get()

    console.log(`查询 ${subject} 学科错题成功，共 ${result.data.length} 条`)

    return {
      success: true,
      data: result.data,
      count: result.data.length
    }

  } catch (error) {
    console.error('查询错题失败:', error)
    return {
      success: false,
      error: error.message || '查询错题失败'
    }
  }
}
