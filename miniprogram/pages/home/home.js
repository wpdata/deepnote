Page({
  data: {
    stats: {
      totalErrors: 120,
      masteredCount: 85,
      needImprove: 35
    },
    subjects: [
      {
        id: 'math',
        name: '数学',
        bgColor: '#E3F2FD',
        icon: '🔢',
        progress: 75
      },
      {
        id: 'literature',
        name: '文学',
        bgColor: '#FCE4EC',
        icon: '📚',
        progress: 60
      },
      {
        id: 'english',
        name: '英语',
        bgColor: '#F3E5F5',
        icon: '🔤',
        progress: 85
      },
      {
        id: 'physics',
        name: '物理',
        bgColor: '#E8F5E9',
        icon: '⚛️',
        progress: 70
      },
      {
        id: 'chemistry',
        name: '化学',
        bgColor: '#FFF3E0',
        icon: '🧪',
        progress: 45
      },
      {
        id: 'biology',
        name: '生物',
        bgColor: '#E0F2F1',
        icon: '🧬',
        progress: 90
      }
    ]
  },

  onLoad() {
    // 初始化云开发
    if (!wx.cloud) {
      console.error('请使用 2.2.3 或以上的基础库以使用云能力')
    } else {
      wx.cloud.init({
        env: 'deepnote-3g0lr0fb3ce6ea1c',
        traceUser: true
      })
    }

    // 加载数据
    this.loadData()
  },

  async loadData() {
    try {
      // 调用云函数获取用户统计数据
      wx.showLoading({
        title: '加载中...',
        mask: true
      })

      const res = await wx.cloud.callFunction({
        name: 'getUserStats'
      })

      console.log('获取用户统计成功', res.result)

      if (res.result.success) {
        this.setData({
          stats: {
            totalErrors: res.result.stats.totalErrors,
            masteredCount: res.result.stats.masteredErrors,
            needImprove: res.result.stats.needImprove
          }
        })
      } else {
        throw new Error(res.result.error || '获取统计数据失败')
      }

      wx.hideLoading()
    } catch (error) {
      console.error('加载首页数据失败', error)
      wx.hideLoading()
      wx.showToast({
        title: '加载数据失败',
        icon: 'none'
      })
    }
  },

  onSubjectTap(e) {
    console.log('学科卡片被点击了', e.currentTarget.dataset)
    const { id, name } = e.currentTarget.dataset

    if (!id || !name) {
      console.error('缺少学科信息', e.currentTarget.dataset)
      wx.showToast({
        title: '学科信息错误',
        icon: 'none'
      })
      return
    }

    console.log('准备跳转到错题本页面', id, name)

    // 先存储选中的学科信息到全局数据
    const app = getApp()
    app.globalData = app.globalData || {}
    app.globalData.selectedSubject = {
      id: id,
      name: name
    }

    // 使用 switchTab 跳转到 TabBar 页面
    wx.switchTab({
      url: '/pages/errorbook/errorbook',
      success: () => {
        console.log('跳转成功')
      },
      fail: (err) => {
        console.error('跳转失败', err)
        wx.showToast({
          title: '页面跳转失败',
          icon: 'none'
        })
      }
    })
  },

  onSettings() {
    wx.showToast({
      title: '设置功能开发中',
      icon: 'none'
    })
  }
})
