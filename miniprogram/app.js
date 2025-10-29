// app.js
App({
  onLaunch: function() {
    console.log('App Launch - 初始化云开发')

    // 初始化云开发
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力');
      return;
    }

    try {
      wx.cloud.init({
        env: 'deepnote-3g0lr0fb3ce6ea1c', // 云开发环境 ID
        traceUser: true,
      });
      console.log('云开发初始化成功');
      this.globalData.cloudReady = true;

      // 自动微信登录
      this.wxLogin().then(() => {
        // 登录成功后检查年级设置
        this.checkGradeSetup();
      }).catch(err => {
        console.error('登录失败,跳过年级检查', err);
      });
    } catch (error) {
      console.error('云开发初始化失败:', error);
      this.globalData.cloudReady = false;
    }
  },

  // 微信登录
  wxLogin: function() {
    const userId = wx.getStorageSync('userId');

    // 如果已有 userId，直接使用
    if (userId) {
      console.log('使用缓存的 userId:', userId);
      this.globalData.userId = userId;
      return Promise.resolve(userId);
    }

    // 静默登录
    return new Promise((resolve, reject) => {
      wx.showLoading({
        title: '登录中...',
      });

      wx.cloud.callFunction({
        name: 'wxLogin',
        data: {},
        success: res => {
          wx.hideLoading();
          console.log('微信登录成功:', res);

          if (res.result.success) {
            const { userId, isNewUser } = res.result.data;

            // 保存 userId 到本地
            wx.setStorageSync('userId', userId);
            this.globalData.userId = userId;

            if (isNewUser) {
              wx.showToast({
                title: '欢迎使用！',
                icon: 'success'
              });
            }

            resolve(userId);
          } else {
            wx.showToast({
              title: '登录失败',
              icon: 'none'
            });
            reject(res.result.error);
          }
        },
        fail: err => {
          wx.hideLoading();
          console.error('微信登录失败:', err);
          wx.showToast({
            title: '登录失败',
            icon: 'none'
          });
          reject(err);
        }
      });
    });
  },

  // 获取 userId
  getUserId: function() {
    return this.globalData.userId || wx.getStorageSync('userId');
  },

  // 检查年级设置
  checkGradeSetup: async function() {
    try {
      // 检查本地缓存
      const cachedGrade = wx.getStorageSync('userGrade');
      if (cachedGrade) {
        console.log('已有年级设置:', cachedGrade);
        return;
      }

      // 从云端获取用户信息检查年级
      const res = await wx.cloud.callFunction({
        name: 'getUserInfo'
      });

      if (res.result.success && res.result.data.grade) {
        // 用户已设置年级,保存到本地
        wx.setStorageSync('userGrade', res.result.data.grade);
        console.log('从云端获取年级:', res.result.data.grade);
      } else {
        // 首次使用,未设置年级,跳转到年级选择页
        console.log('首次使用,引导设置年级');
        setTimeout(() => {
          wx.reLaunch({
            url: '/pages/grade-select/grade-select?firstTime=true'
          });
        }, 1000);
      }
    } catch (error) {
      console.error('检查年级设置失败:', error);
    }
  },

  // 退出登录
  logout: function() {
    wx.removeStorageSync('userId');
    wx.removeStorageSync('userGrade');
    this.globalData.userId = null;
    wx.showToast({
      title: '已退出登录',
      icon: 'success'
    });
  },

  globalData: {
    cloudReady: false,
    userId: null
  }
}); 