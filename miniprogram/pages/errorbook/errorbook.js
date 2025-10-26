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

  async loadKnowledgeList() {
    try {
      wx.showLoading({
        title: '加载中...',
        mask: true
      })

      // 从云数据库查询当前学科的错题
      const db = wx.cloud.database()
      const _ = db.command

      // 将前端的学科ID转换为中文学科名
      const subjectMap = {
        'math': '数学',
        'literature': '文学',
        'english': '英语',
        'physics': '物理',
        'chemistry': '化学',
        'biology': '生物'
      }
      const subjectName = subjectMap[this.data.currentSubject]

      // 查询该学科下的所有错题
      const errorsRes = await db.collection('errors')
        .where({
          subject: subjectName
        })
        .get()

      console.log('查询错题成功', errorsRes.data)

      // 按知识点汇总统计
      const knowledgeMap = {}
      errorsRes.data.forEach(error => {
        const kp = error.knowledgePoint
        if (!knowledgeMap[kp]) {
          knowledgeMap[kp] = {
            name: kp,
            subject: this.data.currentSubject,
            errorCount: 0,
            masteredCount: 0,
            errors: []
          }
        }
        knowledgeMap[kp].errorCount++
        if (error.mastered) {
          knowledgeMap[kp].masteredCount++
        }
        knowledgeMap[kp].errors.push(error)
      })

      // 计算掌握率
      const knowledgeList = Object.values(knowledgeMap).map(item => ({
        id: item.name,
        name: item.name,
        errorCount: item.errorCount,
        masteredRate: item.errorCount > 0
          ? Math.round((item.masteredCount / item.errorCount) * 100)
          : 0,
        subject: item.subject,
        errors: item.errors
      }))

      console.log('知识点统计', knowledgeList)

      this.setData({
        knowledgeList: knowledgeList
      })

      wx.hideLoading()
    } catch (error) {
      console.error('加载知识点列表失败', error)
      wx.hideLoading()
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    }
  },

  goToDetail(e) {
    const { id, name } = e.currentTarget.dataset
    // 找到对应的知识点数据
    const knowledge = this.data.knowledgeList.find(item => item.id === id)

    if (knowledge && knowledge.errors && knowledge.errors.length > 0) {
      // 如果只有一个错题，直接跳转到错题详情
      if (knowledge.errors.length === 1) {
        wx.navigateTo({
          url: `/pages/error-detail/error-detail?errorId=${knowledge.errors[0]._id}`
        })
      } else {
        // 如果有多个错题，跳转到错题列表（暂时跳转到第一个）
        // TODO: 创建错题列表页面
        wx.navigateTo({
          url: `/pages/error-detail/error-detail?errorId=${knowledge.errors[0]._id}`
        })
      }
    } else {
      wx.showToast({
        title: '该知识点暂无错题',
        icon: 'none'
      })
    }
  }
})
