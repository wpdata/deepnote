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
        bgColor: '#FFFFFF',
        image: '/images/capybara.png',
        progress: 75
      },
      {
        id: 'literature',
        name: '文学',
        bgColor: '#F5E6D3',
        image: '/images/capybara.png',
        progress: 60
      },
      {
        id: 'english',
        name: '英语',
        bgColor: '#F5E6D3',
        image: '/images/capybara.png',
        progress: 85
      },
      {
        id: 'physics',
        name: '物理',
        bgColor: '#4A5F5A',
        image: '/images/capybara.png',
        progress: 70
      },
      {
        id: 'chemistry',
        name: '化学',
        bgColor: '#4A5F5A',
        image: '/images/capybara.png',
        progress: 45
      },
      {
        id: 'biology',
        name: '生物',
        bgColor: '#6B7280',
        image: '/images/capybara.png',
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

  loadData() {
    // 从云数据库加载统计数据
    const db = wx.cloud.database()

    // 这里暂时使用模拟数据，后续会连接真实数据库
    console.log('加载首页数据')
  },

  onSubjectTap(e) {
    const { id, name } = e.currentTarget.dataset
    wx.navigateTo({
      url: `/pages/errorbook/errorbook?subject=${id}&name=${name}`
    })
  },

  onSettings() {
    wx.showToast({
      title: '设置功能开发中',
      icon: 'none'
    })
  }
})
