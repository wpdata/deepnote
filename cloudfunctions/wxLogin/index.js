// 微信小程序登录云函数
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();
const _ = db.command;

exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext();
  const openId = wxContext.OPENID;

  try {
    // 查询用户是否已存在
    const userQuery = await db.collection('users').where({
      openId: openId
    }).get();

    let userId;
    let isNewUser = false;

    if (userQuery.data.length === 0) {
      // 新用户，创建用户记录
      const createTime = new Date().toISOString();
      const userResult = await db.collection('users').add({
        data: {
          openId: openId,
          role: 'user', // 默认普通用户
          createTime: createTime,
          updateTime: createTime,
          nickName: event.userInfo?.nickName || '微信用户',
          avatarUrl: event.userInfo?.avatarUrl || ''
        }
      });

      userId = userResult._id;
      isNewUser = true;

      console.log('新用户注册成功:', userId);
    } else {
      // 老用户，更新最后登录时间
      const user = userQuery.data[0];
      userId = user._id;

      await db.collection('users').doc(userId).update({
        data: {
          updateTime: new Date().toISOString(),
          // 更新用户信息（如果提供）
          ...(event.userInfo?.nickName && { nickName: event.userInfo.nickName }),
          ...(event.userInfo?.avatarUrl && { avatarUrl: event.userInfo.avatarUrl })
        }
      });

      console.log('老用户登录:', userId);
    }

    // 返回用户信息
    return {
      success: true,
      data: {
        userId: userId,
        openId: openId,
        isNewUser: isNewUser
      }
    };

  } catch (error) {
    console.error('微信登录失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
};
