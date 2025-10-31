const app = getApp()
const db = wx.cloud.database()

Page({
  data: {
    feedbackTypes: ['功能建议', '问题反馈', '使用咨询', '其他'],
    typeIndex: 0,
    content: '',
    contact: '',
    submitting: false,
    historyList: []
  },

  onLoad() {
    wx.setNavigationBarTitle({
      title: '帮助与反馈'
    })
    this.loadHistory()
  },

  onShow() {
    // 每次显示页面时刷新历史记录
    this.loadHistory()
  },

  // 加载历史反馈
  async loadHistory() {
    try {
      // 数据库权限规则已设置 doc._openid == auth.openid，无需在查询中指定
      const res = await db.collection('feedbacks')
        .orderBy('createTime', 'desc')
        .limit(20)
        .get()

      this.setData({
        historyList: res.data.map(item => ({
          ...item,
          createTime: this.formatTime(item.createTime)
        }))
      })
    } catch (err) {
      console.error('加载反馈历史失败:', err)
    }
  },

  // 反馈类型变化
  onTypeChange(e) {
    this.setData({
      typeIndex: e.detail.value
    })
  },

  // 反馈内容输入
  onContentInput(e) {
    this.setData({
      content: e.detail.value
    })
  },

  // 联系方式输入
  onContactInput(e) {
    this.setData({
      contact: e.detail.value
    })
  },

  // 提交反馈
  async onSubmit() {
    const { typeIndex, feedbackTypes, content, contact } = this.data

    // 验证
    if (!content.trim()) {
      wx.showToast({
        title: '请输入反馈内容',
        icon: 'none'
      })
      return
    }

    if (content.length < 10) {
      wx.showToast({
        title: '反馈内容至少10个字',
        icon: 'none'
      })
      return
    }

    this.setData({ submitting: true })

    try {
      // 保存到数据库
      await db.collection('feedbacks').add({
        data: {
          type: feedbackTypes[typeIndex],
          content: content.trim(),
          contact: contact.trim(),
          createTime: db.serverDate(),
          status: 'pending', // pending/replied
          reply: '' // 官方回复
        }
      })

      wx.showToast({
        title: '提交成功',
        icon: 'success'
      })

      // 清空表单
      this.setData({
        content: '',
        contact: '',
        typeIndex: 0
      })

      // 刷新历史记录
      setTimeout(() => {
        this.loadHistory()
      }, 500)

    } catch (err) {
      console.error('提交反馈失败:', err)
      wx.showToast({
        title: '提交失败，请重试',
        icon: 'none'
      })
    } finally {
      this.setData({ submitting: false })
    }
  },

  // 格式化时间
  formatTime(date) {
    if (!date) return ''
    const d = new Date(date)
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    const hour = String(d.getHours()).padStart(2, '0')
    const minute = String(d.getMinutes()).padStart(2, '0')
    return `${year}-${month}-${day} ${hour}:${minute}`
  }
})
