// 验证管理员权限云函数
const cloud = require('wx-server-sdk');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 解析 token
function parseToken(token) {
  try {
    const payload = JSON.parse(Buffer.from(token, 'base64').toString('utf8'));
    return payload;
  } catch (error) {
    return null;
  }
}

exports.main = async (event, context) => {
  const { token, openId: providedOpenId } = event;
  const wxContext = cloud.getWXContext();

  console.log('checkAdmin 调用参数:', event);
  console.log('wxContext:', { OPENID: wxContext.OPENID, APPID: wxContext.APPID });

  try {
    let targetOpenId = null;

    // 1. 优先使用小程序的 openId
    if (wxContext.OPENID && wxContext.OPENID !== 'anonymous') {
      targetOpenId = wxContext.OPENID;
      console.log('使用小程序 openId:', targetOpenId);
    }
    // 2. 如果有传入 openId，使用传入的
    else if (providedOpenId) {
      targetOpenId = providedOpenId;
      console.log('使用传入的 openId:', targetOpenId);
    }
    // 3. 如果有 token，解析 token
    else if (token) {
      const payload = parseToken(token);
      if (payload && payload.userId) {
        // 直接通过 userId 查询
        const userQuery = await db.collection('users').doc(payload.userId).get();

        if (!userQuery.data) {
          return {
            success: false,
            isAdmin: false,
            error: '用户不存在'
          };
        }

        const user = userQuery.data;
        return {
          success: true,
          isAdmin: user.role === 'admin',
          data: {
            userId: user._id,
            role: user.role,
            email: user.email,
            nickName: user.nickName
          }
        };
      }
    }

    // 4. 如果有 openId，查询用户
    if (targetOpenId) {
      const userQuery = await db.collection('users').where({
        openId: targetOpenId
      }).get();

      if (userQuery.data.length === 0) {
        console.log('未找到用户:', targetOpenId);
        return {
          success: false,
          isAdmin: false,
          error: '用户不存在'
        };
      }

      const user = userQuery.data[0];
      console.log('找到用户:', user);

      return {
        success: true,
        isAdmin: user.role === 'admin',
        data: {
          userId: user._id,
          role: user.role,
          nickName: user.nickName,
          openId: user.openId
        }
      };
    }

    return {
      success: false,
      isAdmin: false,
      error: '缺少认证信息'
    };

  } catch (error) {
    console.error('验证管理员权限失败:', error);
    return {
      success: false,
      isAdmin: false,
      error: error.message
    };
  }
};
