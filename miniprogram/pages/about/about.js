Page({
  data: {},

  onLoad() {
    wx.setNavigationBarTitle({
      title: '关于我们'
    })
  },

  onShareAppMessage() {
    return {
      title: 'DeepNote 智能错题本 - 让学习更高效',
      path: '/pages/home/home'
    }
  }
})
