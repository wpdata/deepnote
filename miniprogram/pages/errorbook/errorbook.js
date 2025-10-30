Page({
  data: {
    totalErrors: 0,
    masteredErrors: 0,
    unsolvedErrors: 0,
    currentSubject: 'math',
    currentFilter: '', // 当前筛选条件: '' | 'favorited' | 'mastered' | 'unmastered' | 'wrong'
    subjects: [
      { id: 'math', name: '数学' },
      { id: 'arithmetic', name: '算术' },
      { id: 'chinese', name: '语文' },
      { id: 'english', name: '英语' }
    ],
    errorList: [],
    refreshing: false,
    // 分页相关
    pageSize: 20,
    currentPage: 1,
    hasMore: true,
    loadingMore: false
  },

  onLoad(options) {
    if (options.subject) {
      this.setData({
        currentSubject: options.subject
      })
    }
    this.loadErrorList(true)
  },

  onShow() {
    // 从全局数据读取选中的学科
    const app = getApp()
    if (app.globalData && app.globalData.selectedSubject) {
      console.log('从全局数据读取选中的学科', app.globalData.selectedSubject)
      this.setData({
        currentSubject: app.globalData.selectedSubject.id
      })
      app.globalData.selectedSubject = null
    }

    // 刷新数据
    this.setData({
      errorList: [],
      totalErrors: 0,
      masteredErrors: 0,
      unsolvedErrors: 0,
      currentPage: 1,
      hasMore: true
    })
    this.loadErrorList(true)
  },

  // 选择学科
  selectSubject(e) {
    const id = e.currentTarget.dataset.id
    this.setData({
      currentSubject: id,
      currentPage: 1,
      hasMore: true,
      errorList: []
    })
    this.loadErrorList(true)
  },

  // 选择筛选条件
  selectFilter(e) {
    const filter = e.currentTarget.dataset.filter
    this.setData({
      currentFilter: filter,
      currentPage: 1,
      hasMore: true,
      errorList: []
    })
    this.loadErrorList(true)
  },

  // 加载错题列表
  async loadErrorList(isRefresh = false) {
    if (this.data.loadingMore && !isRefresh) return
    if (!this.data.hasMore && !isRefresh) return

    try {
      if (isRefresh) {
        wx.showLoading({
          title: '加载中...',
          mask: true
        })
      } else {
        this.setData({ loadingMore: true })
      }

      // 学科映射
      const subjectMap = {
        'math': '数学',
        'arithmetic': '算术',
        'chinese': '语文',
        'english': '英语'
      }
      const subjectName = subjectMap[this.data.currentSubject]

      // 查询该学科下的所有错题
      const res = await wx.cloud.callFunction({
        name: 'getErrorsBySubject',
        data: {
          subject: subjectName,
          filter: this.data.currentFilter,
          page: this.data.currentPage,
          pageSize: this.data.pageSize
        }
      })

      console.log('查询错题成功', res.result)

      if (!res.result.success) {
        throw new Error(res.result.error || '查询失败')
      }

      let errorsData = res.result.data || []

      // 按上传时间倒序排列
      errorsData.sort((a, b) => {
        const timeA = new Date(a.createTime || a._id).getTime()
        const timeB = new Date(b.createTime || b._id).getTime()
        return timeB - timeA
      })

      // 格式化时间
      errorsData = errorsData.map(error => ({
        ...error,
        createTime: this.formatTime(error.createTime),
        favorited: error.favorited || false
      }))

      // 计算统计数据
      const totalErrors = res.result.total || errorsData.length
      const masteredErrors = res.result.masteredCount || errorsData.filter(e => e.mastered).length
      const unsolvedErrors = totalErrors - masteredErrors

      // 判断是否还有更多数据
      const hasMore = errorsData.length >= this.data.pageSize

      // 合并数据
      const errorList = isRefresh ? errorsData : [...this.data.errorList, ...errorsData]

      this.setData({
        totalErrors,
        masteredErrors,
        unsolvedErrors,
        errorList,
        hasMore,
        loadingMore: false,
        currentPage: this.data.currentPage + (isRefresh ? 0 : 1)
      })

      if (isRefresh) {
        wx.hideLoading()
      }
    } catch (error) {
      console.error('加载错题列表失败', error)
      if (isRefresh) {
        wx.hideLoading()
      }
      this.setData({ loadingMore: false })
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    }
  },

  // 加载更多
  loadMore() {
    if (!this.data.hasMore || this.data.loadingMore) return
    this.loadErrorList(false)
  },

  // 格式化时间
  formatTime(timestamp) {
    if (!timestamp) return ''

    const date = new Date(timestamp)
    const now = new Date()
    const diff = now - date

    // 小于1分钟
    if (diff < 60000) {
      return '刚刚'
    }

    // 小于1小时
    if (diff < 3600000) {
      return Math.floor(diff / 60000) + '分钟前'
    }

    // 小于24小时
    if (diff < 86400000) {
      return Math.floor(diff / 3600000) + '小时前'
    }

    // 小于7天
    if (diff < 604800000) {
      return Math.floor(diff / 86400000) + '天前'
    }

    // 格式化为 MM-DD
    const month = date.getMonth() + 1
    const day = date.getDate()
    return `${month}-${day}`
  },

  // 跳转到错题详情
  goToErrorDetail(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/error-detail/error-detail?errorId=${id}`
    })
  },

  // 切换收藏状态
  async toggleFavorite(e) {
    const { id, favorited } = e.currentTarget.dataset

    try {
      // 调用云函数更新收藏状态
      const res = await wx.cloud.callFunction({
        name: 'toggleFavorite',
        data: {
          errorId: id,
          favorited: !favorited
        }
      })

      if (res.result.success) {
        // 更新本地数据
        const errorList = this.data.errorList.map(error => {
          if (error._id === id) {
            return {
              ...error,
              favorited: !favorited
            }
          }
          return error
        })

        this.setData({
          errorList
        })

        wx.showToast({
          title: favorited ? '已取消收藏' : '已收藏',
          icon: 'success',
          duration: 1000
        })
      }
    } catch (error) {
      console.error('切换收藏状态失败', error)
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      })
    }
  },

  // 下拉刷新
  async onPullDownRefresh() {
    console.log('用户下拉刷新')
    this.setData({
      refreshing: true,
      currentPage: 1,
      hasMore: true
    })

    try {
      await this.loadErrorList(true)
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
      this.setData({
        refreshing: false
      })
    }
  }
})
