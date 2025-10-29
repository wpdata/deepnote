// 获取用户信息云函数
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openId = wxContext.OPENID;

  try {
    // 查询用户信息
    const userQuery = await db.collection('users').where({
      openId: openId
    }).get();

    if (userQuery.data.length === 0) {
      return {
        success: false,
        error: '用户不存在'
      };
    }

    const user = userQuery.data[0];

    return {
      success: true,
      data: {
        userId: user._id,
        openId: user.openId,
        nickName: user.nickName || '智能错题本用户',
        avatarUrl: user.avatarUrl || '',
        role: user.role || 'user',
        grade: user.grade || null,
        createTime: user.createTime,
        updateTime: user.updateTime
      }
    };

  } catch (error) {
    console.error('获取用户信息失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
};
