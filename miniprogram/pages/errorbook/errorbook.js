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

  onShow() {
    // TabBar 页面不能通过 URL 参数传递数据
    // 所以从全局数据中读取选中的学科
    const app = getApp()
    if (app.globalData && app.globalData.selectedSubject) {
      console.log('从全局数据读取选中的学科', app.globalData.selectedSubject)
      this.setData({
        currentSubject: app.globalData.selectedSubject.id
      })
      this.loadKnowledgeList()
      // 读取后清除，避免下次进入时还是这个学科
      app.globalData.selectedSubject = null
    }
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
    // 所有学科的模拟数据
    const allMockData = [
      // 数学
      { id: '1', name: '函数与方程', errorCount: 15, masteredRate: 60, subject: 'math' },
      { id: '2', name: '三角函数', errorCount: 8, masteredRate: 75, subject: 'math' },
      { id: '3', name: '立体几何', errorCount: 12, masteredRate: 40, subject: 'math' },
      { id: '4', name: '概率统计', errorCount: 6, masteredRate: 85, subject: 'math' },
      // 文学
      { id: '5', name: '古诗词鉴赏', errorCount: 10, masteredRate: 70, subject: 'literature' },
      { id: '6', name: '文言文阅读', errorCount: 12, masteredRate: 55, subject: 'literature' },
      { id: '7', name: '现代文阅读', errorCount: 8, masteredRate: 80, subject: 'literature' },
      { id: '8', name: '作文写作', errorCount: 5, masteredRate: 65, subject: 'literature' },
      // 英语
      { id: '9', name: '语法结构', errorCount: 18, masteredRate: 50, subject: 'english' },
      { id: '10', name: '词汇运用', errorCount: 14, masteredRate: 60, subject: 'english' },
      { id: '11', name: '阅读理解', errorCount: 9, masteredRate: 75, subject: 'english' },
      { id: '12', name: '写作表达', errorCount: 7, masteredRate: 70, subject: 'english' },
      // 物理
      { id: '13', name: '力学', errorCount: 16, masteredRate: 45, subject: 'physics' },
      { id: '14', name: '电学', errorCount: 13, masteredRate: 55, subject: 'physics' },
      { id: '15', name: '光学', errorCount: 8, masteredRate: 70, subject: 'physics' },
      { id: '16', name: '热学', errorCount: 6, masteredRate: 80, subject: 'physics' },
      // 化学
      { id: '17', name: '化学反应', errorCount: 11, masteredRate: 65, subject: 'chemistry' },
      { id: '18', name: '元素周期表', errorCount: 9, masteredRate: 75, subject: 'chemistry' },
      { id: '19', name: '有机化学', errorCount: 14, masteredRate: 50, subject: 'chemistry' },
      { id: '20', name: '化学实验', errorCount: 7, masteredRate: 80, subject: 'chemistry' },
      // 生物
      { id: '21', name: '细胞结构', errorCount: 10, masteredRate: 70, subject: 'biology' },
      { id: '22', name: '遗传与进化', errorCount: 12, masteredRate: 60, subject: 'biology' },
      { id: '23', name: '生态系统', errorCount: 8, masteredRate: 75, subject: 'biology' },
      { id: '24', name: '生物实验', errorCount: 6, masteredRate: 85, subject: 'biology' }
    ]

    // 根据当前选中的学科筛选数据
    const filteredData = allMockData.filter(item => item.subject === this.data.currentSubject)

    this.setData({
      knowledgeList: filteredData,
      allKnowledgeList: allMockData
    })
  },

  goToDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/error-detail/error-detail?knowledgeId=${id}`
    })
  }
})
