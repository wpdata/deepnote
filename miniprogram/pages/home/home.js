Page({
  data: {
    stats: {
      totalErrors: 0,
      masteredCount: 0,
      needImprove: 0
    },
    subjects: [
      {
        id: 'math',
        name: '数学',
        bgColor: '#E3F2FD',
        icon: '🔢',
        iconUrl: '/images/subjects/math.png',
        progress: 0
      },
      {
        id: 'chinese',
        name: '语文',
        bgColor: '#FCE4EC',
        icon: '📚',
        iconUrl: '/images/subjects/literature.png',
        progress: 0
      },
      {
        id: 'english',
        name: '英语',
        bgColor: '#F3E5F5',
        icon: '🔤',
        iconUrl: '/images/subjects/english.png',
        progress: 0
      },
      {
        id: 'physics',
        name: '物理',
        bgColor: '#E8F5E9',
        icon: '⚡',
        iconUrl: '/images/subjects/physics.png',
        progress: 0
      },
      {
        id: 'chemistry',
        name: '化学',
        bgColor: '#FFF3E0',
        icon: '⚗️',
        iconUrl: '/images/subjects/chemistry.png',
        progress: 0
      },
      {
        id: 'biology',
        name: '生物',
        bgColor: '#E0F2F1',
        icon: '🧬',
        iconUrl: '/images/subjects/biology.png',
        progress: 0
      }
    ],
    refreshing: false  // 下拉刷新状态
  },

  onLoad() {
    // 加载数据
    this.loadData()
  },

  async loadData() {
    try {
      wx.showLoading({
        title: '加载中...',
        mask: true
      })

      // 调用云函数获取用户统计数据
      const res = await wx.cloud.callFunction({
        name: 'getUserStats'
      })

      console.log('获取用户统计成功', res.result)

      if (res.result.success) {
        const stats = res.result.stats

        // 更新顶部统计数据
        this.setData({
          stats: {
            totalErrors: stats.totalErrors,
            masteredCount: stats.masteredErrors,
            needImprove: stats.needImprove
          }
        })

        // 更新学科进度数据
        if (stats.subjects && stats.subjects.length > 0) {
          const subjectsData = this.data.subjects.map(subject => {
            // 查找对应学科的统计数据
            const subjectStat = stats.subjects.find(s => s.subject === subject.name)
            if (subjectStat) {
              return {
                ...subject,
                progress: subjectStat.masteredRate
              }
            }
            return subject
          })

          this.setData({
            subjects: subjectsData
          })
        }
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

  // 跳转到口算检查页面
  goToMathCheck() {
    wx.navigateTo({
      url: '/pages/math-check/math-check'
    })
  },

  // 下拉刷新
  async onPullDownRefresh() {
    console.log('用户下拉刷新首页')
    this.setData({
      refreshing: true
    })

    try {
      await this.loadData()

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
