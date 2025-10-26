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

  async startRecognition() {
    this.setData({
      recognizing: true,
      progress: 0
    })

    // 模拟识别进度动画
    const timer = setInterval(() => {
      if (this.data.progress < 90) {
        this.setData({
          progress: this.data.progress + 10
        })
      }
    }, 200)

    try {
      // 1. 先上传图片到云存储
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath: `ocr/${Date.now()}-${Math.random().toString(36).substr(2)}.jpg`,
        filePath: this.data.imageUrl
      })

      console.log('图片上传成功', uploadRes.fileID)

      // 2. 调用 OCR 云函数识别
      const ocrRes = await wx.cloud.callFunction({
        name: 'ocrRecognize',
        data: {
          fileID: uploadRes.fileID
        }
      })

      clearInterval(timer)

      console.log('OCR识别成功', ocrRes.result)

      if (ocrRes.result.success) {
        this.setData({
          recognizing: false,
          recognized: true,
          progress: 100,
          recognizedText: ocrRes.result.text,
          uploadedFileID: uploadRes.fileID // 保存云存储ID，后续保存错题时使用
        })
      } else {
        throw new Error(ocrRes.result.error || 'OCR识别失败')
      }
    } catch (error) {
      clearInterval(timer)
      console.error('OCR识别失败', error)

      this.setData({
        recognizing: false,
        recognized: false
      })

      wx.showToast({
        title: '识别失败，请重试',
        icon: 'none'
      })
    }
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

  async confirmAdd() {
    if (!this.data.knowledgePoint) {
      wx.showToast({
        title: '请输入知识点',
        icon: 'none'
      })
      return
    }

    wx.showLoading({
      title: '添加中...',
      mask: true
    })

    try {
      // 调用 saveError 云函数保存错题
      const res = await wx.cloud.callFunction({
        name: 'saveError',
        data: {
          content: this.data.recognizedText,
          subject: this.data.subjects[this.data.subjectIndex],
          knowledgePoint: this.data.knowledgePoint,
          imageUrl: this.data.uploadedFileID || '', // 使用云存储ID
          difficulty: 'medium'
        }
      })

      console.log('保存错题成功', res.result)

      wx.hideLoading()

      if (res.result.success) {
        wx.showToast({
          title: '添加成功',
          icon: 'success'
        })

        // 1.5秒后跳转到错题本
        setTimeout(() => {
          this.reRecognize() // 重置状态
          wx.switchTab({
            url: '/pages/errorbook/errorbook'
          })
        }, 1500)
      } else {
        throw new Error(res.result.message || '添加失败')
      }
    } catch (error) {
      wx.hideLoading()
      console.error('添加错题失败', error)
      wx.showToast({
        title: error.message || '添加失败，请重试',
        icon: 'none'
      })
    }
  }
})
