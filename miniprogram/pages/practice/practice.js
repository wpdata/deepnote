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
    if (options.knowledgePoint) {
      this.setData({
        knowledgePoint: options.knowledgePoint
      })
    }
    this.loadQuestions()
  },

  loadQuestions() {
    // 模拟生成练习题
    const mockQuestions = [
      {
        content: '下列函数中，在定义域内单调递增的是？',
        options: [
          'f(x) = -x² + 1',
          'f(x) = x³',
          'f(x) = -x',
          'f(x) = 1/x'
        ],
        correctAnswer: 1,
        explanation: 'f(x) = x³ 是奇函数，在整个定义域 R 上单调递增。其他选项都不满足在定义域内单调递增的条件。'
      },
      {
        content: '函数 f(x) = 2x - 1 的零点是？',
        options: [
          'x = 0',
          'x = 1/2',
          'x = -1/2',
          'x = 1'
        ],
        correctAnswer: 1,
        explanation: '令 f(x) = 0，即 2x - 1 = 0，解得 x = 1/2。'
      },
      {
        content: '若函数 f(x) 在区间 [a, b] 上连续，且 f(a)·f(b) < 0，则函数在区间 (a, b) 内？',
        options: [
          '一定有零点',
          '可能有零点',
          '一定没有零点',
          '有且仅有一个零点'
        ],
        correctAnswer: 0,
        explanation: '根据零点存在定理，如果函数在区间上连续，且区间端点函数值异号，则函数在该区间内一定有零点，但不一定只有一个。'
      }
    ]

    this.setData({
      questions: mockQuestions,
      currentQuestion: mockQuestions[0],
      answers: new Array(mockQuestions.length).fill(null)
    })
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
