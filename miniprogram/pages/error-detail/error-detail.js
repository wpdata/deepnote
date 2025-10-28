Page({
  data: {
    questionId: '',
    question: {
      subject: '数学',
      knowledgePoint: '函数与方程',
      difficulty: 'medium',
      questionType: '解答题',
      content: '题目：已知函数 f(x) = x² + 2x - 3，求函数的零点。\n\n解析：\n令 f(x) = 0\nx² + 2x - 3 = 0\n(x + 3)(x - 1) = 0\n所以 x = -3 或 x = 1',
      imageUrl: '',
      mastered: false,
      userAnswer: '',
      correctAnswer: '',
      isCorrect: null,
      practiceCount: 0,
      correctCount: 0,
      wrongCount: 0
    },
    // 支持两种格式：
    // 1. aiAnalysis: 结构化对象（旧格式，包含 solution, errorReason, explanation, warningTip）
    // 2. aiAnalysisText: 简单文本（新格式）
    aiAnalysis: null,
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
        console.log('difficulty:', error.difficulty)
        console.log('questionType:', error.questionType)
        console.log('practiceCount:', error.practiceCount)
        console.log('correctCount:', error.correctCount)
        console.log('wrongCount:', error.wrongCount)
        console.log('content长度:', error.content?.length)
        console.log('imageUrl:', error.imageUrl)
        console.log('userAnswer:', error.userAnswer)
        console.log('correctAnswer:', error.correctAnswer)
        console.log('isCorrect:', error.isCorrect)
        console.log('aiAnalysis类型:', typeof error.aiAnalysis)
        console.log('aiAnalysis值:', error.aiAnalysis)
        console.log('aiAnalysisText:', error.aiAnalysisText)
        console.log('relatedKnowledge:', error.relatedKnowledge)
        console.log('========================')

        // 判断 aiAnalysis 是对象还是字符串
        let aiAnalysisObj = null
        let aiAnalysisTextStr = ''

        if (error.aiAnalysis) {
          if (typeof error.aiAnalysis === 'object') {
            // 旧格式：结构化对象
            aiAnalysisObj = error.aiAnalysis
          } else if (typeof error.aiAnalysis === 'string') {
            // 新格式：简单文本（DeepSeek生成的真实AI分析）
            aiAnalysisTextStr = error.aiAnalysis
          }
        }

        // 如果云函数返回了 aiAnalysisText，优先使用
        if (error.aiAnalysisText) {
          aiAnalysisTextStr = error.aiAnalysisText
        }

        // 标准化难易程度字段（支持中英文）
        let normalizedDifficulty = 'medium'
        if (error.difficulty) {
          const difficultyMap = {
            '简单': 'easy',
            '中等': 'medium',
            '困难': 'hard',
            'easy': 'easy',
            'medium': 'medium',
            'hard': 'hard'
          }
          normalizedDifficulty = difficultyMap[error.difficulty] || 'medium'
        }

        this.setData({
          question: {
            subject: error.subject,
            knowledgePoint: error.knowledgePoint,
            difficulty: normalizedDifficulty,
            difficultyText: error.difficulty || '中等', // 保留原始文本用于显示
            questionType: error.questionType || '',
            content: error.content,
            imageUrl: error.imageUrl || '',
            mastered: error.mastered,
            userAnswer: error.userAnswer || '',
            correctAnswer: error.correctAnswer || '',
            isCorrect: error.isCorrect,
            practiceCount: error.practiceCount || 0,
            correctCount: error.correctCount || 0,
            wrongCount: error.wrongCount || 0
          },
          // 支持两种AI分析格式
          aiAnalysis: aiAnalysisObj,
          aiAnalysisText: aiAnalysisTextStr || '暂无AI分析',
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
