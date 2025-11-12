Page({
  data: {
    imageUrl: '',
    recognizing: false,
    progress: 0,
    subjects: ['数学', '文学', '英语', '物理', '化学', '生物'],
    subjectIndex: 0,
    knowledgePoint: '',
    // 三种模式
    mode: 'upload',  // 'upload' | 'crop_preview' | 'formatted_preview'
    croppedQuestions: [],
    formattedQuestions: [],
    uploadedFileID: '',
    originalImageUrl: '',
    selectedCount: 0,

    // OCR配置选项
    ocrConfig: {
      cutType: 'question',  // 切割类型
      imageType: 'photo',   // 图片类型
      subject: '',  // 学科类型（空值表示使用阿里云默认，用户可选择具体学科）
      outputOricoord: true  // 输出原图坐标
    },

    // 配置选项映射(中文显示)
    cutTypeOptions: ['按题目切割', '按行切割', '按段落切割', '按块切割'],
    cutTypeValues: ['question', 'line', 'para', 'block'],
    cutTypeIndex: 0,

    imageTypeOptions: ['拍照图片', '扫描图片', '电子文档'],
    imageTypeValues: ['photo', 'scan', 'digital'],
    imageTypeIndex: 0,

    // 根据阿里云官方文档更新学科选项
    subjectOptions: ['默认（自动识别）', '小学数学', '初中数学', '高中数学', '小学语文', '初中语文',
                     '小学英语', '初中英语', '初中物理', '初中化学', '初中生物'],
    subjectValues: ['', 'PrimarySchool_Math', 'JHighSchool_Math', 'Math',  // Math=高中数学
                    'PrimarySchool_Chinese', 'JHighSchool_Chinese',
                    'PrimarySchool_English', 'JHighSchool_English',
                    'JHighSchool_Physics', 'JHighSchool_Chemistry', 'JHighSchool_Biology'],
    subjectSelectIndex: 0,  // 默认选择"默认（自动识别）"

    showConfig: false,  // 是否显示配置面板

    // 题目编辑相关选项
    subjectList: ['数学', '语文', '英语', '物理', '化学', '生物', '历史', '地理', '政治'],
    difficultyList: ['简单', '中等', '困难'],
    questionTypeList: ['选择题', '填空题', '判断题', '计算题', '应用题', '阅读理解', '完形填空', '作文']
  },

  // 打开相机 - 使用 wx.chooseMedia
  openCamera() {
    wx.chooseMedia({
      count: 1,
      mediaType: ['image'],
      sourceType: ['album', 'camera'],  // 支持相册和相机
      camera: 'back',  // 使用后置摄像头
      success: (res) => {
        console.log('选择图片成功:', res.tempFiles[0].tempFilePath)
        this.setData({
          imageUrl: res.tempFiles[0].tempFilePath
        })
        this.startRecognition()
      },
      fail: (err) => {
        console.error('选择图片失败:', err)
        wx.showToast({
          title: '选择图片失败',
          icon: 'none'
        })
      }
    })
  },

  // 原有的takePhoto方法（兼容旧代码）
  takePhoto() {
    this.openCamera()
  },

  // 从相册选择
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

  // 开始识别
  async startRecognition() {
    this.setData({
      recognizing: true,
      progress: 0,
      mode: 'upload'
    })

    const timer = setInterval(() => {
      if (this.data.progress < 90) {
        this.setData({
          progress: this.data.progress + 10
        })
      }
    }, 200)

    try {
      // 1. 上传图片
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath: `ocr/${Date.now()}-${Math.random().toString(36).substr(2)}.jpg`,
        filePath: this.data.imageUrl
      })

      console.log('上传成功:', uploadRes.fileID)

      this.setData({
        uploadedFileID: uploadRes.fileID
      })

      // 2. 获取坐标 (传递OCR配置)
      console.log('准备调用云函数获取坐标...')
      console.log('传递的配置:', this.data.ocrConfig)

      const coordRes = await wx.cloud.callFunction({
        name: 'ocrRecognize',
        data: {
          action: 'getCoordinates',
          fileID: uploadRes.fileID,
          ocrOptions: this.data.ocrConfig
        }
      })

      clearInterval(timer)

      console.log('====== 云函数返回结果 ======')
      console.log('完整结果:', JSON.stringify(coordRes.result, null, 2))
      console.log('====== 坐标识别结果 ======')
      console.log('success:', coordRes.result.success)
      console.log('error:', coordRes.result.error)
      console.log('coordinates数量:', coordRes.result.coordinates ? coordRes.result.coordinates.length : 0)
      console.log('imageUrl:', coordRes.result.imageUrl ? '存在' : '不存在')
      console.log('=========================')

      if (coordRes.result.success && coordRes.result.coordinates && coordRes.result.coordinates.length > 0) {
        // 有坐标,进行裁剪预览
        console.log('>>> 进入裁剪预览模式,题目数量:', coordRes.result.coordinates.length)
        await this.showCropPreview(coordRes.result)
      } else {
        // 没有坐标,降级到整页识别
        console.log('>>> 降级到整页识别模式')
        await this.fallbackToFullPage(uploadRes.fileID, coordRes.result.imageUrl)
      }

    } catch (error) {
      clearInterval(timer)
      console.error('识别失败:', error)
      this.setData({
        recognizing: false
      })
      wx.showToast({
        title: '识别失败,请重试',
        icon: 'none'
      })
    }
  },

  // 显示裁剪预览
  async showCropPreview(coordData) {
    const { imageUrl, coordinates } = coordData

    console.log('showCropPreview 接收到的数据:', {
      hasImageUrl: !!imageUrl,
      imageUrl: imageUrl,
      coordinatesCount: coordinates ? coordinates.length : 0
    })

    if (!imageUrl) {
      console.error('imageUrl 为空,无法裁剪')
      wx.showToast({
        title: '图片地址获取失败',
        icon: 'none'
      })
      return
    }

    wx.showLoading({ title: '处理图片中...' })

    // 初始化题目列表
    const questions = coordinates.map((coord, index) => ({
      id: `q${index + 1}`,
      index: index,
      selected: true,
      coordinates: coord.pos,
      croppedImage: null  // 稍后裁剪
    }))

    this.setData({
      recognizing: false,
      mode: 'crop_preview',
      originalImageUrl: imageUrl,
      croppedQuestions: questions,
      selectedCount: questions.length
    })

    // 异步裁剪每个题目
    this.cropAllQuestions(imageUrl, questions)

    wx.hideLoading()

    wx.showToast({
      title: `检测到${coordinates.length}个题目`,
      icon: 'success',
      duration: 2000
    })
  },

  // 裁剪所有题目
  async cropAllQuestions(imageUrl, questions) {
    console.log('cropAllQuestions 开始,imageUrl:', imageUrl)

    if (!imageUrl) {
      console.error('imageUrl 为空,无法裁剪')
      wx.showToast({
        title: '图片地址为空',
        icon: 'none'
      })
      return
    }

    try {
      // 下载原图到本地 - 需要使用Promise包装
      console.log('开始下载原图:', imageUrl)

      const downloadRes = await new Promise((resolve, reject) => {
        wx.downloadFile({
          url: imageUrl,
          success: resolve,
          fail: reject
        })
      })

      console.log('下载完成,downloadRes:', downloadRes)
      console.log('downloadRes.statusCode:', downloadRes.statusCode)
      console.log('downloadRes.tempFilePath:', downloadRes.tempFilePath)

      const localImagePath = downloadRes.tempFilePath

      if (!localImagePath || downloadRes.statusCode !== 200) {
        throw new Error(`下载图片失败: statusCode=${downloadRes.statusCode}`)
      }

      console.log('准备获取图片信息,路径:', localImagePath)

      // 获取图片信息 - 需要使用Promise包装
      const imageInfo = await new Promise((resolve, reject) => {
        wx.getImageInfo({
          src: localImagePath,
          success: resolve,
          fail: reject
        })
      })

      console.log('原图尺寸:', imageInfo.width, 'x', imageInfo.height)

      // 逐个裁剪(避免同时裁剪太多导致卡顿)
      for (let i = 0; i < questions.length; i++) {
        try {
          const croppedImage = await this.cropSingleQuestion(
            localImagePath,
            questions[i].coordinates,
            imageInfo.width,
            imageInfo.height
          )

          // 更新这个题目的裁剪图片
          const updatedQuestions = this.data.croppedQuestions
          updatedQuestions[i].croppedImage = croppedImage

          this.setData({
            croppedQuestions: updatedQuestions
          })

          console.log(`题目${i + 1}裁剪完成`)

        } catch (error) {
          console.error(`题目${i + 1}裁剪失败:`, error)
          // 裁剪失败时使用原图作为fallback
          const updatedQuestions = this.data.croppedQuestions
          updatedQuestions[i].croppedImage = localImagePath
          this.setData({
            croppedQuestions: updatedQuestions
          })
        }
      }

      console.log('所有题目裁剪完成')
    } catch (error) {
      console.error('裁剪所有题目失败:', error)
      wx.showToast({
        title: '图片处理失败',
        icon: 'none'
      })
    }
  },

  // 裁剪单个题目 - 使用Canvas 2D API (最新方法)
  cropSingleQuestion(imagePath, coordinates, imageWidth, imageHeight) {
    return new Promise((resolve, reject) => {
      // 计算裁剪区域
      const xs = coordinates.map(p => p.x)
      const ys = coordinates.map(p => p.y)

      const originalWidth = Math.max(...xs) - Math.min(...xs)
      const originalHeight = Math.max(...ys) - Math.min(...ys)

      console.log('原始坐标点:', {
        minX: Math.min(...xs),
        maxX: Math.max(...xs),
        minY: Math.min(...ys),
        maxY: Math.max(...ys),
        width: originalWidth,
        height: originalHeight
      })

      // 动态计算边距 - 根据题目宽度自适应
      // 题目越宽,右侧padding越大(因为选项可能在右边)
      const paddingLeft = 20
      const paddingTop = 15
      const paddingBottom = 25

      // 右侧padding动态计算:
      // - 窄题目(宽度<700): padding 50
      // - 中等题目(700-1000): padding 70
      // - 宽题目(>1000): padding 100
      let paddingRight
      if (originalWidth < 700) {
        paddingRight = 50
      } else if (originalWidth < 1000) {
        paddingRight = 70
      } else {
        paddingRight = 100
      }

      console.log('动态padding:', {
        originalWidth,
        paddingRight,
        reason: originalWidth < 700 ? '窄题目' : originalWidth < 1000 ? '中等题目' : '宽题目'
      })

      const left = Math.max(0, Math.min(...xs) - paddingLeft)
      const top = Math.max(0, Math.min(...ys) - paddingTop)
      const right = Math.min(imageWidth, Math.max(...xs) + paddingRight)
      const bottom = Math.min(imageHeight, Math.max(...ys) + paddingBottom)

      const cropWidth = right - left
      const cropHeight = bottom - top

      console.log('裁剪区域(含边距):', {
        left, top, right, bottom,
        cropWidth, cropHeight,
        paddingLeft, paddingRight, paddingTop, paddingBottom
      })

      if (cropWidth <= 0 || cropHeight <= 0) {
        console.error('无效的裁剪区域')
        return reject(new Error('无效的裁剪区域'))
      }

      // 获取Canvas节点 - 使用Canvas 2D API
      const query = wx.createSelectorQuery().in(this)
      query.select('#cropCanvas')
        .fields({ node: true, size: true })
        .exec((res) => {
          if (!res || !res[0] || !res[0].node) {
            console.error('无法获取Canvas节点')
            return reject(new Error('无法获取Canvas节点'))
          }

          const canvas = res[0].node
          const ctx = canvas.getContext('2d')

          // 设置Canvas尺寸 - 考虑设备像素比
          const dpr = wx.getSystemInfoSync().pixelRatio || 1
          canvas.width = cropWidth * dpr
          canvas.height = cropHeight * dpr
          ctx.scale(dpr, dpr)

          console.log('Canvas设置:', {
            width: canvas.width,
            height: canvas.height,
            dpr: dpr
          })

          // 创建图片对象
          const img = canvas.createImage()

          img.onload = () => {
            try {
              console.log('图片加载成功,开始绘制')

              // 绘制裁剪区域到Canvas
              ctx.drawImage(img, left, top, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight)

              // Canvas 2D是同步绘制,但添加延迟确保绘制完成
              setTimeout(() => {
                wx.canvasToTempFilePath({
                  canvas: canvas,  // Canvas 2D需要传入canvas对象
                  x: 0,
                  y: 0,
                  width: cropWidth,
                  height: cropHeight,
                  destWidth: cropWidth,
                  destHeight: cropHeight,
                  fileType: 'png',
                  success: (res) => {
                    console.log('裁剪导出成功:', res.tempFilePath)
                    resolve(res.tempFilePath)
                  },
                  fail: (err) => {
                    console.error('导出Canvas失败:', err)
                    reject(err)
                  }
                }, this)
              }, 100)

            } catch (error) {
              console.error('绘制失败:', error)
              reject(error)
            }
          }

          img.onerror = (err) => {
            console.error('图片加载失败:', err)
            reject(new Error('图片加载失败'))
          }

          // 加载图片
          img.src = imagePath
        })
    })
  },

  // 切换题目选中状态
  toggleQuestion(e) {
    const index = e.currentTarget.dataset.index
    const questions = this.data.croppedQuestions
    questions[index].selected = !questions[index].selected

    const selectedCount = questions.filter(q => q.selected).length

    this.setData({
      croppedQuestions: questions,
      selectedCount: selectedCount
    })
  },

  // 确认识别选中的题目
  async confirmRecognize() {
    const selected = this.data.croppedQuestions.filter(q => q.selected)

    if (selected.length === 0) {
      wx.showToast({
        title: '请至少选择一个题目',
        icon: 'none'
      })
      return
    }

    wx.showLoading({ title: `识别中 0/${selected.length}` })

    const formatted = []

    // 逐个识别选中的题目
    for (let i = 0; i < selected.length; i++) {
      const question = selected[i]

      wx.showLoading({ title: `识别中 ${i + 1}/${selected.length}` })

      try {
        // 先上传裁剪后的图片到云存储
        console.log(`题目${i + 1} - 开始上传裁剪图片...`)
        const uploadRes = await wx.cloud.uploadFile({
          cloudPath: `ocr-temp/cropped_${Date.now()}_${i}.jpg`,
          filePath: question.croppedImage
        })
        console.log(`题目${i + 1} - 图片上传成功:`, uploadRes.fileID)

        // 调用云函数识别（传递fileID而不是base64）
        const recognizeRes = await wx.cloud.callFunction({
          name: 'ocrRecognize',
          data: {
            action: 'recognizeQuestion',
            fileID: uploadRes.fileID
          }
        })

        console.log(`====== 题目${i + 1}识别结果 ======`)
        console.log('完整返回:', JSON.stringify(recognizeRes.result, null, 2))
        console.log('==============================')

        if (recognizeRes.result.success) {
          const aiAnalysis = recognizeRes.result.aiAnalysis || {}
          const userAnswer = recognizeRes.result.userAnswer || ''
          const correctAnswer = recognizeRes.result.correctAnswer || ''

          console.log(`题目${i + 1} - 提取的字段:`)
          console.log('  userAnswer:', userAnswer)
          console.log('  correctAnswer:', correctAnswer)
          console.log('  aiAnalysis:', JSON.stringify(aiAnalysis))
          console.log('  aiAnalysis.subject:', aiAnalysis.subject)
          console.log('  aiAnalysis.knowledgePoint:', aiAnalysis.knowledgePoint)
          console.log('  aiAnalysis.analysis:', aiAnalysis.analysis)

          // 自动判断答案是否正确
          let isCorrect = null
          if (userAnswer && correctAnswer) {
            // 简单的字符串匹配判断
            isCorrect = userAnswer.trim().toLowerCase() === correctAnswer.trim().toLowerCase()
          }

          // 安全地获取索引，确保不会因为undefined而报错
          let subjectIndex = 0
          let difficultyIndex = 1
          let questionTypeIndex = 0

          try {
            subjectIndex = this.getSubjectIndex(aiAnalysis.subject || '未分类')
            difficultyIndex = this.getDifficultyIndex(aiAnalysis.difficulty || '中等')
            questionTypeIndex = this.getQuestionTypeIndex(aiAnalysis.questionType || '未知')
          } catch (indexError) {
            console.error(`题目${i + 1} - 获取索引失败:`, indexError)
          }

          const questionData = {
            id: question.id,
            index: i,
            croppedImage: uploadRes.fileID,  // 使用上传后的fileID而不是本地临时路径
            formattedText: recognizeRes.result.formattedText || '',
            rawText: recognizeRes.result.rawText || '',
            aiAnalysis: {
              subject: aiAnalysis.subject || '未分类',
              knowledgePoint: aiAnalysis.knowledgePoint || '待标注',
              difficulty: aiAnalysis.difficulty || '中等',
              questionType: aiAnalysis.questionType || '未知',
              analysis: aiAnalysis.analysis || ''
            },
            aiModel: recognizeRes.result.aiModel || 'unknown',  // 记录使用的AI模型
            // 添加选择器索引
            subjectIndex: subjectIndex,
            difficultyIndex: difficultyIndex,
            questionTypeIndex: questionTypeIndex,
            showPreview: false,  // 默认折叠原图预览
            // 答案相关字段
            userAnswer: userAnswer,
            correctAnswer: correctAnswer,
            isCorrect: isCorrect
          }

          console.log(`题目${i + 1} - 最终questionData:`, JSON.stringify(questionData, null, 2))
          formatted.push(questionData)
        } else {
          // 识别失败,使用空文本
          formatted.push({
            id: question.id,
            index: i,
            croppedImage: question.croppedImage,
            formattedText: '',
            rawText: '',
            aiAnalysis: {
              subject: '未分类',
              knowledgePoint: '待标注',
              difficulty: '中等',
              questionType: '未知'
            },
            subjectIndex: 0,
            difficultyIndex: 1,  // 中等
            questionTypeIndex: 0,
            showPreview: false,
            userAnswer: '',
            correctAnswer: '',
            isCorrect: null
          })
        }

      } catch (error) {
        console.error(`❌ 识别题目${i + 1}失败:`, error)
        console.error('错误详情:', {
          message: error.message,
          stack: error.stack,
          name: error.name
        })

        // 识别失败也添加占位
        formatted.push({
          id: question.id,
          index: i,
          croppedImage: question.croppedImage,
          formattedText: '识别失败,请手动输入',
          rawText: '',
          aiAnalysis: {
            subject: '未分类',
            knowledgePoint: '待标注',
            difficulty: '中等',
            questionType: '未知'
          },
          subjectIndex: 0,
          difficultyIndex: 1,  // 中等
          questionTypeIndex: 0,
          showPreview: false,
          userAnswer: '',
          correctAnswer: '',
          isCorrect: null
        })
      }
    }

    wx.hideLoading()

    this.setData({
      mode: 'formatted_preview',
      formattedQuestions: formatted
    })

    console.log('====== setData 后检查 formattedQuestions ======')
    console.log('formatted数组:', formatted)
    console.log('第一个题目:', formatted[0])
    console.log('第一个题目的id:', formatted[0]?.id)
    console.log('第一个题目的index:', formatted[0]?.index)
    console.log('============================================')

    wx.showToast({
      title: `成功识别${formatted.length}题`,
      icon: 'success'
    })
  },

  // 降级到整页识别（使用智能路由）
  async fallbackToFullPage(fileID, imageUrl) {
    wx.showLoading({ title: '智能识别中...' })

    try {
      console.log('====== 降级模式：调用智能识别 ======')
      console.log('fileID:', fileID)
      console.log('imageUrl:', imageUrl)

      // 使用 recognizeQuestion 模式进行智能识别
      const recognizeRes = await wx.cloud.callFunction({
        name: 'ocrRecognize',
        data: {
          action: 'recognizeQuestion',
          fileID: fileID
        }
      })

      console.log('====== 智能识别结果 ======')
      console.log('完整返回:', JSON.stringify(recognizeRes.result, null, 2))
      console.log('aiModel:', recognizeRes.result.aiModel)
      console.log('ocrQuality:', recognizeRes.result.ocrQuality)
      console.log('===========================')

      wx.hideLoading()

      if (recognizeRes.result.success) {
        const aiAnalysis = recognizeRes.result.aiAnalysis || {}

        // 直接使用 fileID,小程序会自动处理 cloud:// 格式
        const displayImageUrl = fileID

        this.setData({
          mode: 'formatted_preview',
          recognizing: false,
          formattedQuestions: [{
            id: 'q1',
            index: 0,
            croppedImage: displayImageUrl,  // 使用fileID
            formattedText: recognizeRes.result.formattedText,
            rawText: recognizeRes.result.rawText,
            userAnswer: recognizeRes.result.userAnswer || '',
            correctAnswer: recognizeRes.result.correctAnswer || '',
            aiModel: recognizeRes.result.aiModel || 'unknown',  // 显示使用的模型
            ocrQuality: recognizeRes.result.ocrQuality,
            aiAnalysis: aiAnalysis
          }]
        })

        wx.showToast({
          title: '识别完成',
          icon: 'success'
        })
      } else {
        throw new Error(recognizeRes.result.error || '识别失败')
      }

    } catch (error) {
      wx.hideLoading()
      console.error('智能识别失败:', error)
      this.setData({
        recognizing: false
      })
      wx.showToast({
        title: '识别失败',
        icon: 'none'
      })
    }
  },

  // 编辑题目文本
  onQuestionTextInput(e) {
    const index = e.currentTarget.dataset.index
    const questions = this.data.formattedQuestions
    questions[index].formattedText = e.detail.value

    this.setData({
      formattedQuestions: questions
    })
  },

  // 编辑知识点
  onKnowledgeInput(e) {
    const index = e.currentTarget.dataset.index
    const questions = this.data.formattedQuestions
    questions[index].aiAnalysis.knowledgePoint = e.detail.value

    this.setData({
      formattedQuestions: questions
    })
  },

  // 返回裁剪预览
  backToCropPreview() {
    this.setData({
      mode: 'crop_preview'
    })
  },

  // 重新拍照
  reRecognize() {
    this.setData({
      mode: 'upload',
      imageUrl: '',
      recognizing: false,
      croppedQuestions: [],
      formattedQuestions: [],
      uploadedFileID: '',
      originalImageUrl: '',
      selectedCount: 0
    })
  },

  // 删除题目
  deleteQuestion(e) {
    const index = e.currentTarget.dataset.index
    const questions = this.data.formattedQuestions

    wx.showModal({
      title: '确认删除',
      content: `确定要删除题目 ${index + 1} 吗？`,
      success: (res) => {
        if (res.confirm) {
          // 从数组中移除该题目
          questions.splice(index, 1)

          // 重新设置索引
          questions.forEach((q, i) => {
            q.index = i
          })

          this.setData({
            formattedQuestions: questions
          })

          wx.showToast({
            title: '已删除',
            icon: 'success',
            duration: 1000
          })

          // 如果删除后没有题目了，返回选择模式
          if (questions.length === 0) {
            wx.showModal({
              title: '提示',
              content: '已删除所有题目，是否重新识别？',
              success: (modalRes) => {
                if (modalRes.confirm) {
                  this.reRecognize()
                }
              }
            })
          }
        }
      }
    })
  },

  // 批量保存
  async batchSaveQuestions() {
    const questions = this.data.formattedQuestions

    if (questions.length === 0) {
      return
    }

    wx.showLoading({ title: `检测重复 0/${questions.length}` })

    let successCount = 0
    const duplicateQuestions = []  // 记录重复的题目

    // 第一步: 检测所有题目是否重复
    for (let i = 0; i < questions.length; i++) {
      const question = questions[i]

      wx.showLoading({ title: `检测重复 ${i + 1}/${questions.length}` })

      try {
        const checkRes = await wx.cloud.callFunction({
          name: 'checkDuplicateError',
          data: {
            content: question.formattedText,
            subject: question.aiAnalysis.subject
          }
        })

        if (checkRes.result.success && checkRes.result.isDuplicate) {
          // 发现重复题目
          duplicateQuestions.push({
            index: i,
            question: question,
            duplicates: checkRes.result.duplicates
          })
        }
      } catch (error) {
        console.error(`检测题目${i + 1}重复失败:`, error)
      }
    }

    wx.hideLoading()

    // 第二步: 如果有重复题目,询问用户
    if (duplicateQuestions.length > 0) {
      const result = await this.handleDuplicateQuestions(duplicateQuestions, questions)
      if (!result) {
        return  // 用户取消
      }
    }

    // 第三步: 保存所有题目
    wx.showLoading({ title: `保存中 0/${questions.length}` })

    for (let i = 0; i < questions.length; i++) {
      const question = questions[i]

      wx.showLoading({ title: `保存中 ${i + 1}/${questions.length}` })

      // 检查是否需要更新而不是新增
      const duplicateInfo = duplicateQuestions.find(d => d.index === i)
      const mode = duplicateInfo && question._updateMode === 'update' ? 'update' : 'add'
      const errorId = duplicateInfo && question._updateMode === 'update' ? question._updateErrorId : null

      try {
        console.log(`====== 保存题目${i + 1} ======`)
        console.log('question对象:', question)
        console.log('准备保存的数据:')
        console.log('  content:', question.formattedText?.substring(0, 50))
        console.log('  subject:', question.aiAnalysis.subject)
        console.log('  knowledgePoint:', question.aiAnalysis.knowledgePoint)
        console.log('  userAnswer:', question.userAnswer)
        console.log('  correctAnswer:', question.correctAnswer)
        console.log('  isCorrect:', question.isCorrect)
        console.log('  aiAnalysisText:', question.aiAnalysis.analysis?.substring(0, 50))
        console.log('========================')

        const saveResult = await wx.cloud.callFunction({
          name: 'saveError',
          data: {
            mode: mode,
            errorId: errorId,
            content: question.formattedText,
            subject: question.aiAnalysis.subject || '未分类',
            knowledgePoint: question.aiAnalysis.knowledgePoint || '待标注',
            imageUrl: question.croppedImage || this.data.uploadedFileID,
            difficulty: question.aiAnalysis.difficulty || 'medium',
            questionType: question.aiAnalysis.questionType || '未知',
            userAnswer: question.userAnswer || '',
            correctAnswer: question.correctAnswer || '',
            isCorrect: question.isCorrect,
            aiAnalysisText: question.aiAnalysis.analysis || ''  // AI分析文本
          }
        })

        console.log(`题目${i + 1}保存结果:`, saveResult.result)

        successCount++

      } catch (error) {
        console.error(`保存题目${i + 1}失败:`, error)
      }
    }

    wx.hideLoading()

    if (successCount > 0) {
      wx.showToast({
        title: `成功保存${successCount}题`,
        icon: 'success'
      })

      setTimeout(() => {
        // 设置全局数据，让错题本页面自动切换到对应学科
        const app = getApp()
        const questions = this.data.formattedQuestions || []
        console.log('保存成功，准备跳转，题目数量:', questions.length)
        const firstQuestion = questions.length > 0 ? questions[0] : null

        if (firstQuestion && firstQuestion.aiAnalysis && firstQuestion.aiAnalysis.subject) {
          const subjectName = firstQuestion.aiAnalysis.subject
          console.log('第一道题学科:', subjectName)
          // 学科名称到ID的映射
          const subjectMap = {
            '数学': 'math',
            '算术': 'arithmetic',
            '语文': 'chinese',
            '英语': 'english'
          }
          const subjectId = subjectMap[subjectName] || 'math'
          console.log('映射后的学科ID:', subjectId)

          app.globalData = app.globalData || {}
          app.globalData.selectedSubject = {
            id: subjectId,
            name: subjectName
          }
          console.log('✅ 已设置全局学科数据:', JSON.stringify(app.globalData.selectedSubject))
        } else {
          console.warn('⚠️ 无法获取学科信息:', {
            hasFirstQuestion: !!firstQuestion,
            hasAiAnalysis: firstQuestion?.aiAnalysis,
            subject: firstQuestion?.aiAnalysis?.subject
          })
        }

        console.log('准备跳转到错题本页面')
        wx.switchTab({
          url: '/pages/errorbook/errorbook',
          success: () => {
            // 跳转成功后再清空数据
            setTimeout(() => {
              this.reRecognize()
            }, 300)
          }
        })
      }, 1500)
    } else {
      wx.showToast({
        title: '保存失败',
        icon: 'none'
      })
    }
  },

  // 切换配置面板显示
  toggleConfig() {
    this.setData({
      showConfig: !this.data.showConfig
    })
  },

  // 阻止事件冒泡
  stopPropagation() {
    // 空函数，用于阻止点击面板内容时关闭面板
  },

  // 切割类型选择
  onCutTypeChange(e) {
    const index = e.detail.value
    this.setData({
      cutTypeIndex: index,
      'ocrConfig.cutType': this.data.cutTypeValues[index]
    })
  },

  // 图片类型选择
  onImageTypeChange(e) {
    const index = e.detail.value
    this.setData({
      imageTypeIndex: index,
      'ocrConfig.imageType': this.data.imageTypeValues[index]
    })
  },

  // OCR学科选择 (配置面板)
  onSubjectSelectChange(e) {
    const index = e.detail.value
    this.setData({
      subjectSelectIndex: index,
      'ocrConfig.subject': this.data.subjectValues[index]
    })
  },

  // ============ 题目编辑相关方法 ============

  // 题目文本输入
  onQuestionTextInput(e) {
    const index = e.currentTarget.dataset.index
    this.setData({
      [`formattedQuestions[${index}].formattedText`]: e.detail.value
    })
  },

  // 学科选择 (题目编辑)
  onSubjectChange(e) {
    // 从事件链中查找 data 属性
    let id = e.currentTarget.dataset.id
    let itemindex = e.currentTarget.dataset.itemindex

    console.log('====== onSubjectChange (题目编辑) ======')
    console.log('id:', id, 'itemindex:', itemindex)

    const subjectIndex = e.detail.value
    const subject = this.data.subjectList[subjectIndex]

    // 优先使用 itemindex（来自 item.index）
    let index = itemindex

    // 如果 itemindex 不存在，尝试通过 id 查找
    if (index === undefined || index === null) {
      if (id) {
        const questions = this.data.formattedQuestions
        index = questions.findIndex(q => q.id === id)
        console.log('通过id查找，找到index:', index)
      }
    }

    if (index === undefined || index === null || index === -1) {
      console.error('无法找到题目, id:', id, 'itemindex:', itemindex)
      wx.showToast({
        title: '无法定位题目',
        icon: 'none'
      })
      return
    }

    console.log('最终使用index:', index, '更新学科为:', subject)

    this.setData({
      [`formattedQuestions[${index}].subjectIndex`]: subjectIndex,
      [`formattedQuestions[${index}].aiAnalysis.subject`]: subject
    })
  },

  // 知识点输入
  onKnowledgeInput(e) {
    const index = e.currentTarget.dataset.index
    this.setData({
      [`formattedQuestions[${index}].aiAnalysis.knowledgePoint`]: e.detail.value
    })
  },

  // 难度选择
  onDifficultyChange(e) {
    let index = e.currentTarget.dataset.itemindex
    const difficultyIndex = e.detail.value
    const difficulty = this.data.difficultyList[difficultyIndex]

    if (index === undefined) {
      const id = e.currentTarget.dataset.id
      if (id) {
        const questions = this.data.formattedQuestions
        index = questions.findIndex(q => q.id === id)
      }
    }

    if (index === undefined || index === -1) {
      console.error('无法找到题目')
      return
    }

    this.setData({
      [`formattedQuestions[${index}].difficultyIndex`]: difficultyIndex,
      [`formattedQuestions[${index}].aiAnalysis.difficulty`]: difficulty
    })
  },

  // 题型选择
  onQuestionTypeChange(e) {
    let index = e.currentTarget.dataset.itemindex
    const questionTypeIndex = e.detail.value
    const questionType = this.data.questionTypeList[questionTypeIndex]

    if (index === undefined) {
      const id = e.currentTarget.dataset.id
      if (id) {
        const questions = this.data.formattedQuestions
        index = questions.findIndex(q => q.id === id)
      }
    }

    if (index === undefined || index === -1) {
      console.error('无法找到题目')
      return
    }

    this.setData({
      [`formattedQuestions[${index}].questionTypeIndex`]: questionTypeIndex,
      [`formattedQuestions[${index}].aiAnalysis.questionType`]: questionType
    })
  },

  // 切换原图预览
  togglePreview(e) {
    const index = e.currentTarget.dataset.index
    const showPreview = this.data.formattedQuestions[index].showPreview
    this.setData({
      [`formattedQuestions[${index}].showPreview`]: !showPreview
    })
  },

  // ============ 答案相关方法 ============

  // 用户答案输入
  onUserAnswerInput(e) {
    const index = e.currentTarget.dataset.index
    this.setData({
      [`formattedQuestions[${index}].userAnswer`]: e.detail.value
    })
  },

  // 正确答案输入
  onCorrectAnswerInput(e) {
    const index = e.currentTarget.dataset.index
    this.setData({
      [`formattedQuestions[${index}].correctAnswer`]: e.detail.value
    })
  },

  // 标记为正确
  markAsCorrect(e) {
    const index = e.currentTarget.dataset.index
    this.setData({
      [`formattedQuestions[${index}].isCorrect`]: true
    })
  },

  // 标记为错误
  markAsWrong(e) {
    const index = e.currentTarget.dataset.index
    this.setData({
      [`formattedQuestions[${index}].isCorrect`]: false
    })
  },

  // 标记为未判
  markAsUnknown(e) {
    const index = e.currentTarget.dataset.index
    this.setData({
      [`formattedQuestions[${index}].isCorrect`]: null
    })
  },

  // ============ 辅助方法 ============

  // 根据学科名称获取索引
  getSubjectIndex(subject) {
    const index = this.data.subjectList.indexOf(subject)
    return index >= 0 ? index : 0
  },

  // 根据难度获取索引
  getDifficultyIndex(difficulty) {
    const index = this.data.difficultyList.indexOf(difficulty)
    return index >= 0 ? index : 1  // 默认中等
  },

  // 根据题型获取索引
  getQuestionTypeIndex(questionType) {
    const index = this.data.questionTypeList.indexOf(questionType)
    return index >= 0 ? index : 0
  },

  // ============ 重复题目处理 ============

  // 处理重复题目
  async handleDuplicateQuestions(duplicateQuestions, allQuestions) {
    return new Promise((resolve) => {
      const count = duplicateQuestions.length
      const firstDuplicate = duplicateQuestions[0]
      const dupInfo = firstDuplicate.duplicates[0]

      const content = count === 1
        ? `发现1道题目与已有题目相似度${dupInfo.similarity}%\n\n已有题目:\n${dupInfo.content.substring(0, 50)}...\n\n如何处理?`
        : `发现${count}道题目重复\n\n如何处理这些重复题目?`

      wx.showModal({
        title: '⚠️ 发现重复题目',
        content: content,
        confirmText: '更新',
        cancelText: '都保留',
        success: (res) => {
          if (res.confirm) {
            // 用户选择更新
            duplicateQuestions.forEach(item => {
              const question = allQuestions[item.index]
              question._updateMode = 'update'
              question._updateErrorId = item.duplicates[0]._id
            })
            resolve(true)
          } else if (res.cancel) {
            // 用户选择都保留(不设置更新模式)
            resolve(true)
          }
        },
        fail: () => {
          resolve(false)
        }
      })
    })
  }
})
