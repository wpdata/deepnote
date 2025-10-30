Page({
  data: {
    imageUrl: '',
    uploadedFileID: '',
    checking: false,
    checkResult: null
  },

  // 选择图片
  chooseImage() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],
      success: (res) => {
        this.setData({
          imageUrl: res.tempFiles[0].tempFilePath
        })
      }
    })
  },

  // 重新选择图片
  reChooseImage() {
    this.setData({
      imageUrl: '',
      uploadedFileID: '',
      checkResult: null
    })
    this.chooseImage()
  },

  // 开始检查
  async startCheck() {
    if (!this.data.imageUrl) {
      wx.showToast({
        title: '请先选择图片',
        icon: 'none'
      })
      return
    }

    this.setData({
      checking: true
    })

    wx.showLoading({
      title: '检查中...',
      mask: true
    })

    try {
      // 1. 上传图片到云存储
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath: `math-check/${Date.now()}-${Math.random().toString(36).substr(2)}.jpg`,
        filePath: this.data.imageUrl
      })

      console.log('图片上传成功:', uploadRes.fileID)

      this.setData({
        uploadedFileID: uploadRes.fileID
      })

      // 2. 调用算术检查云函数
      const checkRes = await wx.cloud.callFunction({
        name: 'ocrRecognize',
        data: {
          action: 'checkMath',
          fileID: uploadRes.fileID
        }
      })

      console.log('====== 算术检查结果 ======')
      console.log(JSON.stringify(checkRes.result, null, 2))
      console.log('========================')

      if (checkRes.result.success) {
        this.setData({
          checkResult: checkRes.result.result
        })

        wx.hideLoading()

        // 显示结果提示
        if (checkRes.result.result.wrongCount === 0) {
          wx.showToast({
            title: '全部正确！',
            icon: 'success'
          })
        } else {
          wx.showToast({
            title: `发现${checkRes.result.result.wrongCount}道错题`,
            icon: 'none'
          })
        }
      } else {
        throw new Error(checkRes.result.error || '检查失败')
      }

    } catch (error) {
      console.error('算术检查失败:', error)
      wx.hideLoading()
      wx.showToast({
        title: error.message || '检查失败',
        icon: 'none'
      })
    } finally {
      this.setData({
        checking: false
      })
    }
  },

  // 重新检查
  reCheck() {
    this.setData({
      imageUrl: '',
      uploadedFileID: '',
      checkResult: null
    })
  },

  // 保存到错题本
  async saveToErrorBook() {
    if (!this.data.checkResult || this.data.checkResult.wrongCount === 0) {
      return
    }

    wx.showLoading({
      title: '保存中...',
      mask: true
    })

    try {
      const wrongItems = this.data.checkResult.wrongItems
      let successCount = 0

      // 逐个保存错题
      for (let i = 0; i < wrongItems.length; i++) {
        const item = wrongItems[i]

        const saveRes = await wx.cloud.callFunction({
          name: 'saveError',
          data: {
            mode: 'add',
            content: item.expression,
            subject: '算术',
            knowledgePoint: this.getKnowledgePoint(item.expression),
            imageUrl: this.data.uploadedFileID,
            difficulty: '简单',
            questionType: '算术题',
            userAnswer: item.userAnswer,
            correctAnswer: item.correctAnswer,
            isCorrect: false,
            aiAnalysisText: `这道${this.getOperationType(item.expression)}算术题答案错误。正确答案是${item.correctAnswer}，你的答案是${item.userAnswer}。建议加强${this.getKnowledgePoint(item.expression)}的练习。`
          }
        })

        if (saveRes.result.success) {
          successCount++
        }
      }

      wx.hideLoading()

      if (successCount === wrongItems.length) {
        wx.showToast({
          title: '保存成功',
          icon: 'success'
        })

        // 1秒后返回首页
        setTimeout(() => {
          wx.switchTab({
            url: '/pages/errorbook/errorbook'
          })
        }, 1000)
      } else {
        wx.showToast({
          title: `保存了${successCount}/${wrongItems.length}题`,
          icon: 'none'
        })
      }

    } catch (error) {
      console.error('保存错题失败:', error)
      wx.hideLoading()
      wx.showToast({
        title: '保存失败',
        icon: 'none'
      })
    }
  },

  // 获取知识点
  getKnowledgePoint(expression) {
    if (expression.includes('+')) return '加法运算'
    if (expression.includes('-')) return '减法运算'
    if (expression.includes('×') || expression.includes('*')) return '乘法运算'
    if (expression.includes('÷') || expression.includes('/')) return '除法运算'
    return '四则运算'
  },

  // 获取运算类型
  getOperationType(expression) {
    if (expression.includes('+')) return '加法'
    if (expression.includes('-')) return '减法'
    if (expression.includes('×') || expression.includes('*')) return '乘法'
    if (expression.includes('÷') || expression.includes('/')) return '除法'
    return '算术'
  }
})
