// 用户操作日志查询云函数（基于 errors 集合）
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

    // 分页参数
    const { page = 1, pageSize = 20, filters = {} } = event;
    const skip = (page - 1) * pageSize;

    // 构建查询条件
    const where = {};

    // 学科筛选
    if (filters.subject) {
      where.subject = filters.subject;
    }

    // 掌握状态筛选
    if (filters.mastered !== undefined) {
      where.mastered = filters.mastered;
    }

    // 时间范围筛选
    if (filters.startDate || filters.endDate) {
      where.createTime = {};
      if (filters.startDate) {
        where.createTime[_.gte] = filters.startDate;
      }
      if (filters.endDate) {
        where.createTime[_.lte] = filters.endDate;
      }
    }

    // 获取总数
    const countResult = await db.collection('errors')
      .where(where)
      .count();

    // 获取错题列表（包含用户 openId）
    const errorsResult = await db.collection('errors')
      .where(where)
      .orderBy('createTime', 'desc')
      .skip(skip)
      .limit(pageSize)
      .get();

    // 获取用户信息（通过 _openid）
    const openIds = [...new Set(errorsResult.data.map(error => error._openid).filter(Boolean))];
    const usersMap = {};

    if (openIds.length > 0) {
      const usersResult = await db.collection('users')
        .where({
          _openid: _.in(openIds)
        })
        .field({
          _openid: true,
          openId: true,
          nickName: true
        })
        .get();

      usersResult.data.forEach(user => {
        const userId = user.openId || user._openid;
        usersMap[userId] = user;
      });
    }

    // 组装日志数据
    const logs = errorsResult.data.map(error => {
      const user = usersMap[error._openid] || {};

      return {
        id: error._id,
        userId: error._openid,
        userName: user.nickName || error._openid?.substring(0, 8) + '...' || '未知用户',
        userOpenId: error._openid || '',
        actionType: '错题录入',
        subject: error.subject || '未分类',
        knowledgePoint: error.knowledgePoint || '-',
        isCorrect: error.isCorrect,
        mastered: error.mastered,
        practiceCount: error.practiceCount || 0,
        createTime: error.createTime,
        updateTime: error.updateTime,
        details: {
          content: error.content,
          userAnswer: error.userAnswer,
          correctAnswer: error.correctAnswer,
          difficulty: error.difficulty
        }
      };
    });

    return {
      success: true,
      data: {
        logs,
        pagination: {
          page,
          pageSize,
          total: countResult.total,
          totalPages: Math.ceil(countResult.total / pageSize)
        }
      }
    };

  } catch (error) {
    console.error('获取用户日志失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
};
