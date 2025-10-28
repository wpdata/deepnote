Page({
  data: {
    userStats: null,
    loading: true
  },

  onLoad() {
    this.loadUserStats();
  },

  async loadUserStats() {
    try {
      wx.showLoading({ title: '加载中...' });

      const res = await wx.cloud.callFunction({
        name: 'getUserStats'
      });

      console.log('用户统计数据加载成功', res.result);

      this.setData({
        userStats: res.result.data,
        loading: false
      });

      wx.hideLoading();
    } catch (err) {
      console.error('加载首页数据失败', err);
      wx.hideLoading();
      wx.showToast({
        title: '加载失败',
        icon: 'error'
      });
      this.setData({
        loading: false
      });
    }
  },

  // 跳转到拍照识别页面
  onTakePhoto() {
    wx.navigateTo({
      url: '/pages/camera/camera'
    });
  },

  // 跳转到错题本页面
  onViewErrors() {
    wx.navigateTo({
      url: '/pages/errors/list'
    });
  },

  // 跳转到练习页面
  onStartPractice() {
    wx.navigateTo({
      url: '/pages/practice/practice'
    });
  }
})