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
    } catch (error) {
      console.error('云开发初始化失败:', error);
      this.globalData.cloudReady = false;
    }

    // 获取用户信息
    wx.getSetting({
      success: res => {
        if (res.authSetting['scope.userInfo']) {
          // 已经授权，可以直接调用 getUserInfo 获取头像昵称
          wx.getUserInfo({
            success: res => {
              this.globalData.userInfo = res.userInfo;
              // 由于 getUserInfo 是网络请求，可能会在 Page.onLoad 之后才返回
              // 所以此处加入 callback 以防止这种情况
              if (this.userInfoReadyCallback) {
                this.userInfoReadyCallback(res);
              }
            }
          });
        }
      }
    });
  },
  
  globalData: {
    cloudReady: false
  }
}); 