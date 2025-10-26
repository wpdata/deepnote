Page({
  data: {
    questionId: '',
    question: {
      subject: '数学',
      knowledgePoint: '函数与方程',
      content: '题目：已知函数 f(x) = x² + 2x - 3，求函数的零点。\n\n解析：\n令 f(x) = 0\nx² + 2x - 3 = 0\n(x + 3)(x - 1) = 0\n所以 x = -3 或 x = 1',
      imageUrl: '',
      mastered: false
    },
    analysis: {
      errorReason: '对函数零点的定义理解不够深入，没有掌握零点的求解方法。函数零点是指函数值为0时对应的自变量的值，即方程 f(x) = 0 的解。',
      explanation: '函数零点的求法：\n1. 代数法：令 f(x) = 0，解方程得到零点\n2. 图象法：观察函数图象与 x 轴的交点坐标\n3. 零点存在定理：如果函数 y = f(x) 在区间 [a, b] 上的图象是连续不断的，且 f(a)·f(b) < 0，那么函数在区间 (a, b) 内有零点',
      solution: '解题步骤：\n1. 令函数 f(x) = 0\n2. 将函数表达式改写为方程形式\n3. 对方程进行因式分解或使用求根公式\n4. 解出方程的根，即为函数的零点\n5. 验证结果是否正确',
      warningTip: '注意区分"零点"和"零点坐标"：\n• 零点是一个实数（横坐标）\n• 零点坐标是一个点 (x, 0)\n求函数零点时只需写出 x 的值，不需要写成坐标形式。'
    },
    relatedKnowledge: [
      '二次函数',
      '因式分解',
      '求根公式',
      '函数图象',
      '零点存在定理'
    ]
  },

  onLoad(options) {
    if (options.errorId) {
      this.setData({
        questionId: options.errorId
      })
      this.loadQuestionDetail()
    }
  },

  async loadQuestionDetail() {
    try {
      wx.showLoading({
        title: '加载中...',
        mask: true
      })

      // 调用 getErrorDetail 云函数获取错题详情
      const res = await wx.cloud.callFunction({
        name: 'getErrorDetail',
        data: {
          errorId: this.data.questionId
        }
      })

      console.log('获取错题详情成功', res.result)

      if (res.result.success) {
        const error = res.result.error

        this.setData({
          question: {
            subject: error.subject,
            knowledgePoint: error.knowledgePoint,
            content: error.content,
            imageUrl: error.imageUrl || '',
            mastered: error.mastered
          },
          analysis: error.aiAnalysis || this.data.analysis,
          relatedKnowledge: error.relatedKnowledge || this.data.relatedKnowledge
        })
      } else {
        throw new Error(res.result.error || '获取错题详情失败')
      }

      wx.hideLoading()
    } catch (error) {
      console.error('加载错题详情失败', error)
      wx.hideLoading()
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      })
    }
  },

  startPractice() {
    wx.navigateTo({
      url: `/pages/practice/practice?subject=${this.data.question.subject}&knowledgePoint=${this.data.question.knowledgePoint}`
    })
  },

  async toggleMastered() {
    const newStatus = !this.data.question.mastered

    try {
      wx.showLoading({
        title: newStatus ? '标记中...' : '取消中...',
        mask: true
      })

      // 调用 updateErrorStatus 云函数更新掌握状态
      const res = await wx.cloud.callFunction({
        name: 'updateErrorStatus',
        data: {
          errorId: this.data.questionId,
          mastered: newStatus
        }
      })

      console.log('更新掌握状态成功', res.result)

      if (res.result.success) {
        this.setData({
          'question.mastered': newStatus
        })

        wx.hideLoading()
        wx.showToast({
          title: newStatus ? '已标记为掌握' : '已取消掌握',
          icon: 'success'
        })
      } else {
        throw new Error(res.result.error || '更新失败')
      }
    } catch (error) {
      console.error('更新掌握状态失败', error)
      wx.hideLoading()
      wx.showToast({
        title: '操作失败',
        icon: 'none'
      })
    }
  },

  onShareAppMessage() {
    return {
      title: `${this.data.question.subject} - ${this.data.question.knowledgePoint}`,
      path: `/pages/error-detail/error-detail?knowledgeId=${this.data.questionId}`
    }
  }
})
