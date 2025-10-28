// 管理员邮箱+密码登录云函数
const cloud = require('wx-server-sdk');
const crypto = require('crypto');

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
});

const db = cloud.database();

// 密码哈希函数
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex');
}

// 生成简单的 JWT token（实际生产环境建议使用专业库）
function generateToken(userId, email) {
  const payload = {
    userId: userId,
    email: email,
    timestamp: Date.now()
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

exports.main = async (event, context) => {
  const { email, password, action = 'login' } = event;

  try {
    // 注册管理员账号（仅首次使用）
    if (action === 'register') {
      // 检查邮箱是否已存在
      const existUser = await db.collection('users').where({
        email: email
      }).get();

      if (existUser.data.length > 0) {
        return {
          success: false,
          error: '该邮箱已被注册'
        };
      }

      // 创建管理员账号
      const hashedPassword = hashPassword(password);
      const createTime = new Date().toISOString();

      const result = await db.collection('users').add({
        data: {
          email: email,
          password: hashedPassword,
          role: 'admin',
          createTime: createTime,
          updateTime: createTime,
          nickName: email.split('@')[0]
        }
      });

      console.log('管理员注册成功:', result._id);

      return {
        success: true,
        message: '管理员账号创建成功',
        data: {
          userId: result._id
        }
      };
    }

    // 登录验证
    if (action === 'login') {
      const hashedPassword = hashPassword(password);

      // 查询用户
      const userQuery = await db.collection('users').where({
        email: email,
        password: hashedPassword
      }).get();

      if (userQuery.data.length === 0) {
        return {
          success: false,
          error: '邮箱或密码错误'
        };
      }

      const user = userQuery.data[0];

      // 检查是否是管理员
      if (user.role !== 'admin') {
        return {
          success: false,
          error: '无管理员权限'
        };
      }

      // 更新最后登录时间
      await db.collection('users').doc(user._id).update({
        data: {
          updateTime: new Date().toISOString()
        }
      });

      // 生成 token
      const token = generateToken(user._id, user.email);

      console.log('管理员登录成功:', user._id);

      return {
        success: true,
        data: {
          userId: user._id,
          email: user.email,
          role: user.role,
          nickName: user.nickName,
          token: token
        }
      };
    }

    return {
      success: false,
      error: '无效的操作类型'
    };

  } catch (error) {
    console.error('管理员登录失败:', error);
    return {
      success: false,
      error: error.message
    };
  }
};
