Page({
  data: {
    totalErrors: 120,
    masteredErrors: 85,
    unsolvedErrors: 35,
    currentTab: 'subject', // 'subject' 或 'knowledge'
    currentSubject: 'math',
    subjects: [
      { id: 'math', name: '数学' },
      { id: 'literature', name: '文学' },
      { id: 'english', name: '英语' },
      { id: 'physics', name: '物理' },
      { id: 'chemistry', name: '化学' },
      { id: 'biology', name: '生物' }
    ],
    knowledgeList: [],
    allKnowledgeList: []
  },

  onLoad(options) {
    if (options.subject) {
      this.setData({
        currentSubject: options.subject
      })
    }
    this.loadKnowledgeList()
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({
      currentTab: tab
    })
  },

  selectSubject(e) {
    const id = e.currentTarget.dataset.id
    this.setData({
      currentSubject: id
    })
    this.loadKnowledgeList()
  },

  loadKnowledgeList() {
    // 模拟数据
    const mockData = [
      { id: '1', name: '函数与方程', errorCount: 15, masteredRate: 60, subject: '数学' },
      { id: '2', name: '三角函数', errorCount: 8, masteredRate: 75, subject: '数学' },
      { id: '3', name: '立体几何', errorCount: 12, masteredRate: 40, subject: '数学' },
      { id: '4', name: '概率统计', errorCount: 6, masteredRate: 85, subject: '数学' }
    ]

    this.setData({
      knowledgeList: mockData,
      allKnowledgeList: mockData
    })
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/error-detail/error-detail?knowledgeId=${id}`
    })
  }
})
