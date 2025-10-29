// 更新用户信息云函数
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openId = wxContext.OPENID;

  try {
    // 查询用户记录
    const userQuery = await db.collection('users').where({
      openId: openId
    }).get();

    if (userQuery.data.length === 0) {
      return {
        success: false,
        error: '用户不存在'
      };
    }

    const userId = userQuery.data[0]._id;

    // 准备更新数据
    const updateData = {
      updateTime: new Date().toISOString()
    };

    // 只更新提供的字段
    if (event.nickName !== undefined) {
      updateData.nickName = event.nickName;
    }

    if (event.avatarUrl !== undefined) {
      updateData.avatarUrl = event.avatarUrl;
    }

    if (event.grade !== undefined) {
      updateData.grade = event.grade;
    }

    // 更新用户信息
    await db.collection('users').doc(userId).update({
      data: updateData
    });

    console.log('用户信息更新成功:', userId, updateData);

    return {
      success: true,
      data: {
        userId: userId,
        ...updateData
      }
    };

  } catch (error) {
    console.error('更新用户信息失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
};
