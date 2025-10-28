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
    // 直接从 errors 集合获取所有错题数据进行实时统计
    const errorsResult = await db.collection('errors').limit(100).get()
    const allErrors = errorsResult.data

    console.log('查询到错题数量:', allErrors.length)

    // 1. 计算总体统计
    const totalErrors = allErrors.length
    const masteredErrors = allErrors.filter(e => e.mastered).length
    const needImprove = totalErrors - masteredErrors
    const masteredRate = totalErrors > 0
      ? Math.round((masteredErrors / totalErrors) * 100)
      : 0

    // 2. 按学科统计
    const subjectSummary = {}
    allErrors.forEach(error => {
      const subject = error.subject
      if (!subjectSummary[subject]) {
        subjectSummary[subject] = {
          subject: subject,
          totalErrors: 0,
          masteredErrors: 0,
          masteredRate: 0
        }
      }
      subjectSummary[subject].totalErrors++
      if (error.mastered) {
        subjectSummary[subject].masteredErrors++
      }
    })

    // 计算各学科掌握率
    Object.values(subjectSummary).forEach(summary => {
      summary.masteredRate = summary.totalErrors > 0
        ? Math.round((summary.masteredErrors / summary.totalErrors) * 100)
        : 0
    })

    // 3. 获取最近的练习记录
    const recentPractices = await db.collection('practices')
      .orderBy('createTime', 'desc')
      .limit(10)
      .get()

    // 4. 获取学习天数（从 users 表）
    let studyDays = 0
    let practiceCount = 0
    const userResult = await db.collection('users')
      .where({ _openid: openid })
      .get()

    if (userResult.data.length > 0) {
      studyDays = userResult.data[0].studyDays || 0
      practiceCount = userResult.data[0].practiceCount || 0
    }

    return {
      success: true,
      stats: {
        // 基本统计
        studyDays,
        totalErrors,
        masteredErrors,
        needImprove,
        practiceCount,
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
