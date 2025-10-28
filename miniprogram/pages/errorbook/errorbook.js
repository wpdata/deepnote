Page({
  data: {
    totalErrors: 0,
    masteredErrors: 0,
    unsolvedErrors: 0,
    currentTab: 'subject', // 'subject' 或 'knowledge'
    currentSubject: 'math',
    subjects: [
      { id: 'math', name: '数学' },
      { id: 'arithmetic', name: '算数' },
      { id: 'chinese', name: '语文' },
      { id: 'english', name: '英语' }
    ],
    knowledgeList: [],
    allKnowledgeList: [],
    refreshing: false  // 下拉刷新状态
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
    let needReload = false

    if (app.globalData && app.globalData.selectedSubject) {
      console.log('从全局数据读取选中的学科', app.globalData.selectedSubject)
      this.setData({
        currentSubject: app.globalData.selectedSubject.id
      })
      needReload = true
      // 读取后清除，避免下次进入时还是这个学科
      app.globalData.selectedSubject = null
    }

    // 每次显示页面时都刷新数据，以显示最新保存的错题
    console.log('onShow: 刷新错题本数据，当前学科:', this.data.currentSubject)

    // 先清空旧数据，避免显示过期内容
    this.setData({
      knowledgeList: [],
      totalErrors: 0,
      masteredErrors: 0,
      unsolvedErrors: 0
    })

    // 然后加载最新数据
    this.loadKnowledgeList()
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    this.setData({
      currentTab: tab
    })

    // 切换到知识点视图时，加载所有学科的知识点
    if (tab === 'knowledge' && this.data.allKnowledgeList.length === 0) {
      this.loadAllKnowledgeList()
    }
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

      // 将前端的学科ID转换为中文学科名
      const subjectMap = {
        'math': '数学',
        'arithmetic': '算数',
        'chinese': '语文',
        'english': '英语'
      }
      const subjectName = subjectMap[this.data.currentSubject]

      // 通过云函数查询该学科下的所有错题
      const res = await wx.cloud.callFunction({
        name: 'getErrorsBySubject',
        data: {
          subject: subjectName
        }
      })

      console.log('查询错题成功', res.result)

      if (!res.result.success) {
        throw new Error(res.result.error || '查询失败')
      }

      const errorsData = res.result.data

      // 计算总体统计数据
      const totalErrors = errorsData.length
      const masteredErrors = errorsData.filter(e => e.mastered).length
      const unsolvedErrors = totalErrors - masteredErrors

      // 按知识点汇总统计
      const knowledgeMap = {}
      errorsData.forEach(error => {
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
      console.log('总体统计', { totalErrors, masteredErrors, unsolvedErrors })

      this.setData({
        totalErrors,
        masteredErrors,
        unsolvedErrors,
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
    console.log('点击知识点，dataset:', e.currentTarget.dataset)
    console.log('当前视图:', this.data.currentTab)

    // 根据当前视图选择数据源
    let knowledge
    if (this.data.currentTab === 'knowledge') {
      // 在"知识点"视图中，从 allKnowledgeList 查找
      knowledge = this.data.allKnowledgeList.find(item => item.id === id)
      console.log('从 allKnowledgeList 查找')
    } else {
      // 在"学科"视图中，从 knowledgeList 查找
      knowledge = this.data.knowledgeList.find(item => item.id === id)
      console.log('从 knowledgeList 查找')
    }

    console.log('找到的知识点数据:', knowledge)

    if (knowledge && knowledge.errors && knowledge.errors.length > 0) {
      console.log('错题数量:', knowledge.errors.length)

      // 如果只有一个错题，直接跳转到错题详情
      if (knowledge.errors.length === 1) {
        console.log('只有1个错题，直接跳转到详情页')
        wx.navigateTo({
          url: `/pages/error-detail/error-detail?errorId=${knowledge.errors[0]._id}`
        })
      } else {
        // 如果有多个错题，跳转到错题列表页面
        // 确定学科名称
        let subjectName
        if (this.data.currentTab === 'knowledge') {
          // 在"知识点"视图中，学科名称在 knowledge.subject
          subjectName = knowledge.subject
        } else {
          // 在"学科"视图中，需要从 currentSubject 映射
          const subjectMap = {
            'math': '数学',
            'arithmetic': '算数',
            'chinese': '语文',
            'english': '英语'
          }
          subjectName = subjectMap[this.data.currentSubject]
        }

        const url = `/pages/error-list/error-list?knowledgePoint=${encodeURIComponent(knowledge.name)}&subject=${encodeURIComponent(subjectName)}`
        console.log('有多个错题，跳转到列表页:', url)

        wx.navigateTo({
          url: url
        })
      }
    } else {
      console.error('知识点数据异常:', knowledge)
      wx.showToast({
        title: '该知识点暂无错题',
        icon: 'none'
      })
    }
  },

  // 加载所有学科的知识点汇总
  async loadAllKnowledgeList() {
    try {
      wx.showLoading({ title: '加载中...' })

      // 获取所有学科的错题
      const allSubjects = ['数学', '算数', '语文', '英语']
      const allKnowledgeMap = {}

      // 并行查询所有学科
      const promises = allSubjects.map(subject =>
        wx.cloud.callFunction({
          name: 'getErrorsBySubject',
          data: { subject }
        })
      )

      const results = await Promise.all(promises)

      // 汇总所有学科的知识点
      results.forEach((res, index) => {
        if (res.result.success) {
          const subject = allSubjects[index]
          res.result.data.forEach(error => {
            const key = `${subject}-${error.knowledgePoint}`
            if (!allKnowledgeMap[key]) {
              allKnowledgeMap[key] = {
                id: key,
                name: error.knowledgePoint,
                subject: subject,
                errorCount: 0,
                masteredCount: 0,
                errors: []
              }
            }
            allKnowledgeMap[key].errorCount++
            if (error.mastered) {
              allKnowledgeMap[key].masteredCount++
            }
            allKnowledgeMap[key].errors.push(error)
          })
        }
      })

      // 计算掌握率
      const allKnowledgeList = Object.values(allKnowledgeMap).map(item => ({
        ...item,
        masteredRate: item.errorCount > 0
          ? Math.round((item.masteredCount / item.errorCount) * 100)
          : 0
      }))

      console.log('所有知识点汇总:', allKnowledgeList)

      this.setData({
        allKnowledgeList
      })

      wx.hideLoading()
    } catch (error) {
      console.error('加载所有知识点失败', error)
      wx.hideLoading()
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    }
  },

  // 下拉刷新
  async onPullDownRefresh() {
    console.log('用户下拉刷新')
    this.setData({
      refreshing: true
    })

    try {
      // 根据当前视图刷新对应的数据
      if (this.data.currentTab === 'knowledge') {
        await this.loadAllKnowledgeList()
      } else {
        await this.loadKnowledgeList()
      }

      wx.showToast({
        title: '刷新成功',
        icon: 'success',
        duration: 1000
      })
    } catch (error) {
      console.error('刷新失败', error)
      wx.showToast({
        title: '刷新失败',
        icon: 'none'
      })
    } finally {
      // 结束刷新状态
      this.setData({
        refreshing: false
      })
    }
  }
})
