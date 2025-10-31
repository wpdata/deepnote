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
      _openid: openId
    }).get();

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

    let userId;

    if (userQuery.data.length === 0) {
      // 新用户：创建用户记录
      const createData = {
        _openid: openId,
        nickName: event.nickName || '新用户',
        avatarUrl: event.avatarUrl || '',
        grade: event.grade || null,
        studyDays: 0,
        practiceCount: 0,
        createTime: db.serverDate(),
        updateTime: db.serverDate()
      };

      const createRes = await db.collection('users').add({
        data: createData
      });

      userId = createRes._id;
      console.log('新用户创建成功:', userId, createData);
    } else {
      // 已有用户：更新用户信息
      userId = userQuery.data[0]._id;

      await db.collection('users').doc(userId).update({
        data: updateData
      });

      console.log('用户信息更新成功:', userId, updateData);
    }

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
