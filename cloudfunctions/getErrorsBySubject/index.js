// 云函数：根据学科查询错题列表
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

/**
 * 根据学科查询错题列表(支持筛选和分页)
 * @param {string} subject - 学科名称（中文）
 * @param {string} filter - 筛选条件: '' | 'favorited' | 'mastered' | 'unmastered' | 'wrong'
 * @param {number} page - 页码(从1开始)
 * @param {number} pageSize - 每页数量
 * @returns {Object} 错题列表
 */
exports.main = async (event, context) => {
  const { subject, filter = '', page = 1, pageSize = 20 } = event
  const wxContext = cloud.getWXContext()
  const _ = db.command

  if (!subject) {
    return {
      success: false,
      error: '缺少学科参数'
    }
  }

  try {
    // 构建查询条件（必须包含用户过滤）
    const where = {
      _openid: wxContext.OPENID,
      subject: subject
    }

    // 添加筛选条件
    if (filter === 'favorited') {
      where.favorited = true
    } else if (filter === 'mastered') {
      where.mastered = true
    } else if (filter === 'unmastered') {
      where.mastered = false
    } else if (filter === 'wrong') {
      where.isCorrect = false
    }

    // 查询总数
    const countRes = await db.collection('errors')
      .where(where)
      .count()

    const total = countRes.total

    // 分页查询
    const skip = (page - 1) * pageSize
    const result = await db.collection('errors')
      .where(where)
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get()

    // 统计已掌握数量（仅当前用户）
    const masteredRes = await db.collection('errors')
      .where({
        _openid: wxContext.OPENID,
        subject: subject,
        mastered: true
      })
      .count()

    console.log(`查询 ${subject} 学科错题成功，共 ${total} 条，当前页 ${result.data.length} 条`)

    return {
      success: true,
      data: result.data,
      total: total,
      masteredCount: masteredRes.total,
      page: page,
      pageSize: pageSize
    }

  } catch (error) {
    console.error('查询错题失败:', error)
    return {
      success: false,
      error: error.message || '查询错题失败'
    }
  }
}
