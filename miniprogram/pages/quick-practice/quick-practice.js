Page({
  data: {
    knowledgePoint: '函数与方程',
    difficulty: 'medium',
    difficultyText: '中等',
    currentIndex: 0,
    selectedOption: null,
    submitted: false,
    isCorrect: false,
    optionLabels: ['A', 'B', 'C', 'D'],
    questions: [],
    currentQuestion: {},
    correctCount: 0,
    wrongCount: 0,
    correctRate: 0,
    showFinishModal: false,
    answers: []
  },

  onLoad(options) {
    // 随机练习可以指定学科，但不指定知识点
    if (options.subject) {
      this.setData({
        subject: options.subject,
        knowledgePoint: '随机练习' // 显示用
      })
    }
    this.loadQuestions()
  },

  async loadQuestions() {
    try {
      wx.showLoading({
        title: '生成练习题...',
        mask: true
      })

      // 随机从用户的未掌握错题中选择
      const db = wx.cloud.database()
      const _ = db.command
      const errorsRes = await db.collection('errors')
        .where(_.and([
          { mastered: false },
          ...(this.data.subject ? [{ subject: this.data.subject }] : [])
        ]))
        .limit(10)
        .get()

      console.log('查询未掌握错题', errorsRes.data)

      if (errorsRes.data.length > 0) {
        // 随机打乱并取前5个
        const shuffled = errorsRes.data.sort(() => 0.5 - Math.random()).slice(0, 5)

        // 调用 generatePractice 生成练习题（使用第一个错题的知识点）
        const res = await wx.cloud.callFunction({
          name: 'generatePractice',
          data: {
            subject: shuffled[0].subject,
            knowledgePoint: shuffled[0].knowledgePoint,
            count: 5
          }
        })

        if (res.result.success && res.result.questions.length > 0) {
          const questions = res.result.questions.map(q => ({
            content: q.content,
            options: q.options.map(opt => opt.text),
            correctAnswer: q.correctAnswer,
            explanation: q.explanation
          }))

          this.setData({
            questions: questions,
            currentQuestion: questions[0],
            answers: new Array(questions.length).fill(null)
          })
        }
      } else {
        // 如果没有未掌握的错题，使用默认题目
        throw new Error('暂无未掌握的错题')
      }

      wx.hideLoading()
    } catch (error) {
      console.error('加载练习题失败', error)
      wx.hideLoading()
      wx.showToast({
        title: error.message || '加载失败',
        icon: 'none'
      })
    }
  },

  selectOption(e) {
    if (this.data.submitted) return

    const index = e.currentTarget.dataset.index
    this.setData({
      selectedOption: index
    })
  },

  submitAnswer() {
    if (this.data.selectedOption === null) return

    const isCorrect = this.data.selectedOption === this.data.currentQuestion.correctAnswer
    const answers = this.data.answers
    answers[this.data.currentIndex] = {
      selected: this.data.selectedOption,
      isCorrect
    }

    // 为选项添加结果标记
    const optionsWithResult = this.data.currentQuestion.options.map((text, index) => {
      return {
        text,
        isCorrect: index === this.data.currentQuestion.correctAnswer,
        isWrong: index === this.data.selectedOption && !isCorrect
      }
    })

    this.setData({
      submitted: true,
      isCorrect,
      answers,
      'currentQuestion.optionsWithResult': optionsWithResult,
      correctCount: isCorrect ? this.data.correctCount + 1 : this.data.correctCount,
      wrongCount: isCorrect ? this.data.wrongCount : this.data.wrongCount + 1
    })
  },

  nextQuestion() {
    const nextIndex = this.data.currentIndex + 1
    if (nextIndex >= this.data.questions.length) return

    this.setData({
      currentIndex: nextIndex,
      currentQuestion: this.data.questions[nextIndex],
      selectedOption: this.data.answers[nextIndex]?.selected ?? null,
      submitted: this.data.answers[nextIndex] !== null,
      isCorrect: this.data.answers[nextIndex]?.isCorrect ?? false
    })

    if (this.data.submitted) {
      const optionsWithResult = this.data.currentQuestion.options.map((text, index) => {
        return {
          text,
          isCorrect: index === this.data.currentQuestion.correctAnswer,
          isWrong: index === this.data.selectedOption && !this.data.isCorrect
        }
      })
      this.setData({
        'currentQuestion.optionsWithResult': optionsWithResult
      })
    }
  },

  prevQuestion() {
    const prevIndex = this.data.currentIndex - 1
    if (prevIndex < 0) return

    this.setData({
      currentIndex: prevIndex,
      currentQuestion: this.data.questions[prevIndex],
      selectedOption: this.data.answers[prevIndex].selected,
      submitted: true,
      isCorrect: this.data.answers[prevIndex].isCorrect
    })

    const optionsWithResult = this.data.currentQuestion.options.map((text, index) => {
      return {
        text,
        isCorrect: index === this.data.currentQuestion.correctAnswer,
        isWrong: index === this.data.selectedOption && !this.data.isCorrect
      }
    })
    this.setData({
      'currentQuestion.optionsWithResult': optionsWithResult
    })
  },

  finishPractice() {
    const correctRate = Math.round((this.data.correctCount / this.data.questions.length) * 100)

    this.setData({
      correctRate,
      showFinishModal: true
    })

    // 如果全部正确，自动更新错题为已掌握
    if (correctRate === 100) {
      // TODO: 调用云函数更新错题掌握状态
      console.log('全部答对，更新掌握状态')
    }
  },

  closeModal() {
    this.setData({
      showFinishModal: false
    })
  },

  retryPractice() {
    this.setData({
      currentIndex: 0,
      selectedOption: null,
      submitted: false,
      isCorrect: false,
      correctCount: 0,
      wrongCount: 0,
      correctRate: 0,
      showFinishModal: false,
      answers: new Array(this.data.questions.length).fill(null),
      currentQuestion: this.data.questions[0]
    })
  },

  backToDetail() {
    wx.navigateBack()
  }
})
