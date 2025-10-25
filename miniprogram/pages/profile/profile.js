Page({
  data: {
    userInfo: {
      avatarUrl: '',
      nickName: '智能错题本用户',
      studyDays: 15
    },
    stats: {
      totalErrors: 120,
      masteredErrors: 85,
      practiceCount: 45,
      masteredRate: 71
    }
  },

  onLoad() {
    this.loadUserInfo()
    this.loadStats()
  },

  loadUserInfo() {
    // 从本地存储或云端获取用户信息
    const userInfo = wx.getStorageSync('userInfo')
    if (userInfo) {
      this.setData({
        userInfo
      })
    }
  },

  loadStats() {
    // TODO: 从云数据库加载统计数据
    const db = wx.cloud.database()
    // 查询用户的错题统计
  },

  onBackupData() {
    wx.showLoading({
      title: '同步中...'
    })

    // TODO: 调用云函数进行数据备份
    wx.cloud.callFunction({
      name: 'backupData',
      success: (res) => {
        wx.hideLoading()
        wx.showToast({
          title: '同步成功',
          icon: 'success'
        })
      },
      fail: (err) => {
        wx.hideLoading()
        wx.showToast({
          title: '同步失败',
          icon: 'none'
        })
      }
    })
  },

  onSubjectManage() {
    wx.showToast({
      title: '学科管理功能开发中',
      icon: 'none'
    })
  },

  onNotificationSettings() {
    wx.showToast({
      title: '通知设置功能开发中',
      icon: 'none'
    })
  },

  onFeedback() {
    wx.showModal({
      title: '帮助与反馈',
      content: '如有问题或建议，请通过小程序内的反馈功能联系我们',
      showCancel: false
    })
  },

  onAbout() {
    wx.showModal({
      title: '关于我们',
      content: '智能错题整理小程序\n版本：1.0.0\n\n一个帮助学生高效整理和复习错题的智能学习工具',
      showCancel: false
    })
  },

  onShareAppMessage() {
    return {
      title: '智能错题本 - 高效学习好帮手',
      path: '/pages/home/home'
    }
  }
})
