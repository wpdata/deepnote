Page({
  data: {},

  onLoad() {
    wx.setNavigationBarTitle({
      title: '帮助中心'
    })
  },

  // 跳转到反馈页面
  goToFeedback() {
    wx.navigateTo({
      url: '/pages/feedback/feedback'
    })
  }
})
