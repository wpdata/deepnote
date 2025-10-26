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

  onShow() {
    // 每次显示页面时刷新统计数据
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

  async loadStats() {
    try {
      // 调用 getUserStats 云函数获取统计数据
      const res = await wx.cloud.callFunction({
        name: 'getUserStats'
      })

      console.log('获取用户统计成功', res.result)

      if (res.result.success) {
        this.setData({
          stats: {
            totalErrors: res.result.stats.totalErrors,
            masteredErrors: res.result.stats.masteredErrors,
            practiceCount: res.result.stats.practiceCount,
            masteredRate: res.result.stats.masteredRate
          },
          userInfo: {
            ...this.data.userInfo,
            studyDays: res.result.stats.studyDays
          }
        })
      }
    } catch (error) {
      console.error('加载统计数据失败', error)
    }
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
