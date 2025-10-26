// 云函数：获取用户统计数据
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

/**
 * 获取用户统计数据云函数
 * 功能：查询用户的学习统计信息
 *
 * @returns {Object} 用户统计数据
 */
exports.main = async (event, context) => {
  // 获取openid，测试环境使用固定值
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID || 'test_user_openid'

  try {
    // 1. 获取用户基本统计
    let userStats = null
    const userResult = await db.collection('users')
      .where({ _openid: openid })
      .get()

    if (userResult.data.length > 0) {
      userStats = userResult.data[0]
    } else {
      // 如果用户不存在，创建默认数据
      userStats = {
        studyDays: 0,
        totalErrors: 0,
        masteredErrors: 0,
        practiceCount: 0
      }
    }

    // 2. 获取各学科的错题统计
    const subjectStats = await db.collection('knowledge_stats')
      .where({ _openid: openid })
      .get()

    // 按学科汇总
    const subjectSummary = {}
    subjectStats.data.forEach(stat => {
      if (!subjectSummary[stat.subject]) {
        subjectSummary[stat.subject] = {
          subject: stat.subject,
          totalErrors: 0,
          masteredErrors: 0,
          masteredRate: 0
        }
      }
      subjectSummary[stat.subject].totalErrors += stat.totalErrors
      subjectSummary[stat.subject].masteredErrors += stat.masteredErrors
    })

    // 计算各学科掌握率
    Object.values(subjectSummary).forEach(summary => {
      summary.masteredRate = summary.totalErrors > 0
        ? Math.round((summary.masteredErrors / summary.totalErrors) * 100)
        : 0
    })

    // 3. 获取最近的练习记录
    const recentPractices = await db.collection('practices')
      .where({ _openid: openid })
      .orderBy('createTime', 'desc')
      .limit(10)
      .get()

    // 4. 计算总体掌握率
    const masteredRate = userStats.totalErrors > 0
      ? Math.round((userStats.masteredErrors / userStats.totalErrors) * 100)
      : 0

    return {
      success: true,
      stats: {
        // 基本统计
        studyDays: userStats.studyDays,
        totalErrors: userStats.totalErrors,
        masteredErrors: userStats.masteredErrors,
        needImprove: userStats.totalErrors - userStats.masteredErrors,
        practiceCount: userStats.practiceCount,
        masteredRate,

        // 学科统计
        subjects: Object.values(subjectSummary),

        // 最近练习
        recentPractices: recentPractices.data
      }
    }

  } catch (error) {
    console.error('获取用户统计失败:', error)
    return {
      success: false,
      error: error.message || '获取用户统计失败'
    }
  }
}
