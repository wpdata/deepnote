// 错题列表页面 - 显示同一知识点下的所有错题
Page({
  data: {
    knowledgePoint: '',
    subject: '',
    errorList: []
  },

  onLoad(options) {
    console.log('错题列表页面加载，参数:', options)
    const { knowledgePoint, subject } = options
    if (knowledgePoint && subject) {
      const decodedKP = decodeURIComponent(knowledgePoint)
      const decodedSubject = decodeURIComponent(subject)
      console.log('解码后的参数:', { knowledgePoint: decodedKP, subject: decodedSubject })

      this.setData({
        knowledgePoint: decodedKP,
        subject: decodedSubject
      })
      this.loadErrorList()
    } else {
      console.error('缺少必要参数', options)
      wx.showToast({
        title: '参数错误',
        icon: 'none'
      })
    }
  },

  async loadErrorList() {
    try {
      wx.showLoading({ title: '加载中...' })

      console.log('开始查询错题，学科:', this.data.subject)

      // 调用云函数查询该学科的错题
      const res = await wx.cloud.callFunction({
        name: 'getErrorsBySubject',
        data: {
          subject: this.data.subject
        }
      })

      console.log('云函数返回结果:', res.result)

      if (res.result.success) {
        // 筛选出当前知识点的错题
        const errorList = res.result.data.filter(
          error => error.knowledgePoint === this.data.knowledgePoint
        )

        console.log('筛选后的错题列表:', errorList)
        console.log('当前知识点:', this.data.knowledgePoint)

        this.setData({ errorList })

        if (errorList.length === 0) {
          wx.showToast({
            title: '该知识点暂无错题',
            icon: 'none'
          })
        }
      } else {
        throw new Error(res.result.error || '查询失败')
      }

      wx.hideLoading()
    } catch (error) {
      console.error('加载错题列表失败', error)
      wx.hideLoading()
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    }
  },

  goToDetail(e) {
    const { id } = e.currentTarget.dataset
    wx.navigateTo({
      url: `/pages/error-detail/error-detail?errorId=${id}`
    })
  }
})
