Page({
  data: {
    imageUrl: '',
    recognizing: false,
    recognized: false,
    editing: false,
    progress: 0,
    recognizedText: '',
    subjects: ['数学', '文学', '英语', '物理', '化学', '生物'],
    subjectIndex: 0,
    knowledgePoint: ''
  },

  chooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        this.setData({
          imageUrl: res.tempFiles[0].tempFilePath
        })
        this.startRecognition()
      }
    })
  },

  takePhoto() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['camera'],
      success: (res) => {
        this.setData({
          imageUrl: res.tempFiles[0].tempFilePath
        })
        this.startRecognition()
      }
    })
  },

  chooseFromAlbum() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album'],
      success: (res) => {
        this.setData({
          imageUrl: res.tempFiles[0].tempFilePath
        })
        this.startRecognition()
      }
    })
  },

  startRecognition() {
    this.setData({
      recognizing: true,
      progress: 0
    })

    // 模拟识别进度
    const timer = setInterval(() => {
      if (this.data.progress >= 100) {
        clearInterval(timer)
        this.setData({
          recognizing: false,
          recognized: true,
          recognizedText: '题目：已知函数 f(x) = x² + 2x - 3，求函数的零点。\n\n解析：\n令 f(x) = 0\nx² + 2x - 3 = 0\n(x + 3)(x - 1) = 0\n所以 x = -3 或 x = 1'
        })
      } else {
        this.setData({
          progress: this.data.progress + 10
        })
      }
    }, 200)

    // TODO: 调用云函数进行真实的OCR识别
    // this.callOCRFunction()
  },

  callOCRFunction() {
    // 上传图片到云存储
    const cloudPath = `ocr/${Date.now()}-${Math.random()}.jpg`

    wx.cloud.uploadFile({
      cloudPath,
      filePath: this.data.imageUrl,
      success: (uploadRes) => {
        // 调用云函数进行OCR识别
        wx.cloud.callFunction({
          name: 'ocrRecognize',
          data: {
            fileID: uploadRes.fileID
          },
          success: (res) => {
            this.setData({
              recognizing: false,
              recognized: true,
              recognizedText: res.result.text
            })
          },
          fail: (err) => {
            console.error('OCR识别失败', err)
            wx.showToast({
              title: '识别失败，请重试',
              icon: 'none'
            })
            this.reRecognize()
          }
        })
      }
    })
  },

  editResult() {
    this.setData({
      editing: !this.data.editing
    })
  },

  onTextInput(e) {
    this.setData({
      recognizedText: e.detail.value
    })
  },

  onSubjectChange(e) {
    this.setData({
      subjectIndex: e.detail.value
    })
  },

  onKnowledgeInput(e) {
    this.setData({
      knowledgePoint: e.detail.value
    })
  },

  reRecognize() {
    this.setData({
      imageUrl: '',
      recognizing: false,
      recognized: false,
      editing: false,
      recognizedText: '',
      knowledgePoint: ''
    })
  },

  confirmAdd() {
    if (!this.data.knowledgePoint) {
      wx.showToast({
        title: '请输入知识点',
        icon: 'none'
      })
      return
    }

    wx.showLoading({
      title: '添加中...'
    })

    // TODO: 调用云函数保存到数据库
    const db = wx.cloud.database()
    db.collection('errors').add({
      data: {
        content: this.data.recognizedText,
        subject: this.data.subjects[this.data.subjectIndex],
        knowledgePoint: this.data.knowledgePoint,
        imageUrl: this.data.imageUrl,
        mastered: false,
        createTime: new Date()
      },
      success: () => {
        wx.hideLoading()
        wx.showToast({
          title: '添加成功',
          icon: 'success'
        })

        setTimeout(() => {
          wx.switchTab({
            url: '/pages/errorbook/errorbook'
          })
        }, 1500)
      },
      fail: (err) => {
        wx.hideLoading()
        console.error('添加失败', err)
        wx.showToast({
          title: '添加失败，请重试',
          icon: 'none'
        })
      }
    })
  }
})
