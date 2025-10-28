Page({
  data: {
    questionId: '',
    question: {
      subject: '数学',
      knowledgePoint: '函数与方程',
      content: '题目：已知函数 f(x) = x² + 2x - 3，求函数的零点。\n\n解析：\n令 f(x) = 0\nx² + 2x - 3 = 0\n(x + 3)(x - 1) = 0\n所以 x = -3 或 x = 1',
      imageUrl: '',
      mastered: false,
      userAnswer: '',
      correctAnswer: '',
      isCorrect: null
    },
    // 新格式：使用 DeepSeek 生成的单段分析文本
    aiAnalysisText: '',
    relatedKnowledge: []
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

      console.log('====== 错题详情返回 ======')
      console.log('完整返回:', JSON.stringify(res.result, null, 2))
      console.log('========================')

      if (res.result.success) {
        const error = res.result.error

        console.log('====== 错题数据字段 ======')
        console.log('subject:', error.subject)
        console.log('knowledgePoint:', error.knowledgePoint)
        console.log('content长度:', error.content?.length)
        console.log('imageUrl:', error.imageUrl)
        console.log('userAnswer:', error.userAnswer)
        console.log('correctAnswer:', error.correctAnswer)
        console.log('isCorrect:', error.isCorrect)
        console.log('aiAnalysisText:', error.aiAnalysisText)
        console.log('relatedKnowledge:', error.relatedKnowledge)
        console.log('========================')

        this.setData({
          question: {
            subject: error.subject,
            knowledgePoint: error.knowledgePoint,
            content: error.content,
            imageUrl: error.imageUrl || '',
            mastered: error.mastered,
            userAnswer: error.userAnswer || '',
            correctAnswer: error.correctAnswer || '',
            isCorrect: error.isCorrect
          },
          // 使用云函数返回的 aiAnalysisText
          aiAnalysisText: error.aiAnalysisText || '暂无AI分析',
          relatedKnowledge: error.relatedKnowledge || []
        })

        console.log('====== 页面数据设置完成 ======')
        console.log('question:', this.data.question)
        console.log('aiAnalysisText:', this.data.aiAnalysisText)
        console.log('============================')
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
