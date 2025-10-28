// 管理后台统计数据云函数
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();

  try {
    // 验证管理员权限
    const adminCheck = await db.collection('users')
      .where({
        openId: wxContext.OPENID,
        role: 'admin'
      })
      .count();

    if (adminCheck.total === 0) {
      return {
        success: false,
        error: '无管理员权限'
      };
    }

    // 获取统计时间范围
    const { startDate, endDate, type = 'overview' } = event;

    // 1. 用户统计（排除管理员）
    const totalUsers = await db.collection('users')
      .where({
        role: _.neq('admin')
      })
      .count();

    // 新增用户（最近7天，排除管理员）
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const newUsers = await db.collection('users')
      .where({
        role: _.neq('admin'),
        createTime: _.gte(sevenDaysAgo)
      })
      .count();

    // 活跃用户（最近7天有更新，排除管理员）
    const activeUsers = await db.collection('users')
      .where({
        role: _.neq('admin'),
        updateTime: _.gte(sevenDaysAgo)
      })
      .count();

    // 2. 错题统计
    const totalErrors = await db.collection('errors').count();

    // 已掌握错题
    const masteredErrors = await db.collection('errors')
      .where({
        mastered: true
      })
      .count();

    // 未掌握错题
    const unsolvedErrors = await db.collection('errors')
      .where({
        mastered: _.neq(true)
      })
      .count();

    // 3. 练习统计（基于错题的 practiceCount）
    const errorsWithPractice = await db.collection('errors')
      .field({ practiceCount: true })
      .get();

    const totalPractices = errorsWithPractice.data.reduce((sum, error) => {
      return sum + (error.practiceCount || 0);
    }, 0);

    // 最近7天练习次数（基于错题的 lastPracticeTime）
    const recentErrors = await db.collection('errors')
      .where({
        lastPracticeTime: _.gte(sevenDaysAgo)
      })
      .field({ practiceCount: true })
      .get();

    const recentPractices = recentErrors.data.reduce((sum, error) => {
      return sum + (error.practiceCount || 0);
    }, 0);

    // 4. 学科统计（基于错题的 subject 字段）
    const allErrors = await db.collection('errors')
      .field({ subject: true })
      .get();

    // 按学科分组统计
    const subjectMap = {};
    allErrors.data.forEach(error => {
      const subject = error.subject || '未分类';
      subjectMap[subject] = (subjectMap[subject] || 0) + 1;
    });

    const subjectStats = Object.entries(subjectMap).map(([subjectName, errorCount]) => ({
      subjectName,
      errorCount
    }));

    // 5. OCR 统计
    const totalOCR = await db.collection('ocr_records').count();

    const successOCR = await db.collection('ocr_records')
      .where({
        status: 'success'
      })
      .count();

    // 6. 趋势数据（最近30天）
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    // 每日新增用户（排除管理员）
    const dailyUsers = await getDailyStats(db, 'users', 'createTime', thirtyDaysAgo, { role: _.neq('admin') });

    // 每日新增错题
    const dailyErrors = await getDailyStats(db, 'errors', 'createTime', thirtyDaysAgo);

    // 每日练习次数（基于 lastPracticeTime）
    const dailyPractices = await getDailyStats(db, 'errors', 'lastPracticeTime', thirtyDaysAgo);

    // 7. 知识点统计（Top 10，基于 errors 集合）
    const errorsWithKnowledge = await db.collection('errors')
      .field({ knowledgePoint: true, mastered: true })
      .get();

    // 按知识点分组统计
    const knowledgeMap = {};
    errorsWithKnowledge.data.forEach(error => {
      const kp = error.knowledgePoint || '未分类';
      if (!knowledgeMap[kp]) {
        knowledgeMap[kp] = { errorCount: 0, masteredCount: 0 };
      }
      knowledgeMap[kp].errorCount++;
      if (error.mastered) {
        knowledgeMap[kp].masteredCount++;
      }
    });

    // 转换为数组并排序
    const knowledgeStats = Object.entries(knowledgeMap)
      .map(([knowledgePoint, stats]) => ({
        knowledgePoint,
        errorCount: stats.errorCount,
        masteredCount: stats.masteredCount
      }))
      .sort((a, b) => b.errorCount - a.errorCount)
      .slice(0, 10);

    return {
      success: true,
      data: {
        overview: {
          users: {
            total: totalUsers.total,
            new: newUsers.total,
            active: activeUsers.total
          },
          errors: {
            total: totalErrors.total,
            mastered: masteredErrors.total,
            unsolved: unsolvedErrors.total,
            masteredRate: totalErrors.total > 0 ?
              ((masteredErrors.total / totalErrors.total) * 100).toFixed(1) : 0
          },
          practices: {
            total: totalPractices.total,
            recent: recentPractices.total
          },
          ocr: {
            total: totalOCR.total,
            success: successOCR.total,
            successRate: totalOCR.total > 0 ?
              ((successOCR.total / totalOCR.total) * 100).toFixed(1) : 0
          }
        },
        subjects: subjectStats,
        trends: {
          dailyUsers,
          dailyErrors,
          dailyPractices
        },
        knowledgePoints: knowledgeStats
      }
    };

  } catch (error) {
    console.error('获取统计数据失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
};

// 获取每日统计数据
async function getDailyStats(db, collection, dateField, startDate, extraConditions = {}) {
  const where = {
    [dateField]: db.command.gte(startDate.toISOString()),
    ...extraConditions
  };

  const stats = await db.collection(collection)
    .where(where)
    .get();

  // 按日期分组
  const dailyMap = {};
  stats.data.forEach(item => {
    const date = new Date(item[dateField]).toISOString().split('T')[0];
    dailyMap[date] = (dailyMap[date] || 0) + 1;
  });

  // 填充空白日期
  const result = [];
  for (let i = 29; i >= 0; i--) {
    const date = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
    const dateStr = date.toISOString().split('T')[0];
    result.push({
      date: dateStr,
      count: dailyMap[dateStr] || 0
    });
  }

  return result;
}
