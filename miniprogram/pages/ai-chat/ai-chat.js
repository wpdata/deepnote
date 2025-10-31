// 页面：AI互动讲解（支持文字+语音）
Page({
  data: {
    errorId: '',
    question: {},
    messages: [],
    inputValue: '',
    inputMode: 'text',  // 'text' 或 'voice'
    isRecording: false,
    isPlaying: false,
    currentPlayingId: null,
    voiceOutputEnabled: true  // 是否开启语音回复
  },

  // 录音管理器
  recorderManager: null,
  // 音频播放器
  innerAudioContext: null,

  onLoad(options) {
    if (options.errorId) {
      this.setData({
        errorId: options.errorId
      })
      this.loadQuestionAndHistory()
    }

    // 初始化录音管理器
    this.recorderManager = wx.getRecorderManager()
    this.setupRecorderEvents()

    // 初始化音频播放器
    this.innerAudioContext = wx.createInnerAudioContext()
    this.setupAudioEvents()
  },

  /**
   * 加载题目（不加载历史对话）
   */
  async loadQuestionAndHistory() {
    try {
      wx.showLoading({ title: '加载中...' })

      const res = await wx.cloud.callFunction({
        name: 'getErrorDetail',
        data: { errorId: this.data.errorId }
      })

      if (res.result.success) {
        const error = res.result.error
        this.setData({
          question: {
            subject: error.subject,
            knowledgePoint: error.knowledgePoint,
            content: error.content,
            imageUrl: error.imageUrl
          },
          messages: []  // 不加载历史对话，每次都是新对话
        })
      }

      wx.hideLoading()
    } catch (error) {
      console.error('加载失败', error)
      wx.hideLoading()
      wx.showToast({ title: '加载失败', icon: 'none' })
    }
  },

  /**
   * 切换输入模式
   */
  toggleInputMode() {
    const newMode = this.data.inputMode === 'text' ? 'voice' : 'text'
    this.setData({ inputMode: newMode })

    if (newMode === 'voice') {
      // 请求录音权限
      wx.authorize({
        scope: 'scope.record',
        success: () => {
          console.log('录音权限已授权')
        },
        fail: () => {
          wx.showModal({
            title: '需要录音权限',
            content: '请在设置中开启录音权限',
            confirmText: '去设置',
            success: (res) => {
              if (res.confirm) {
                wx.openSetting()
              }
            }
          })
          this.setData({ inputMode: 'text' })
        }
      })
    }
  },

  /**
   * 切换语音输出
   */
  toggleVoiceOutput() {
    this.setData({
      voiceOutputEnabled: !this.data.voiceOutputEnabled
    })
  },

  /**
   * 输入框变化
   */
  onInputChange(e) {
    this.setData({
      inputValue: e.detail.value
    })
  },

  /**
   * 发送文字消息
   */
  async sendTextMessage() {
    const message = this.data.inputValue.trim()

    if (!message) {
      wx.showToast({ title: '请输入内容', icon: 'none' })
      return
    }

    await this.sendMessage(message)
  },

  /**
   * 设置录音事件
   */
  setupRecorderEvents() {
    // 录音开始
    this.recorderManager.onStart(() => {
      console.log('录音开始')
      this.setData({ isRecording: true })
    })

    // 录音结束
    this.recorderManager.onStop(async (res) => {
      console.log('录音结束', res)
      this.setData({ isRecording: false })

      if (res.duration < 500) {
        wx.showToast({ title: '录音时间太短', icon: 'none' })
        return
      }

      // 上传录音文件
      await this.handleVoiceMessage(res.tempFilePath)
    })

    // 录音错误
    this.recorderManager.onError((error) => {
      console.error('录音错误', error)
      this.setData({ isRecording: false })
      wx.showToast({ title: '录音失败', icon: 'none' })
    })
  },

  /**
   * 开始录音（长按）
   */
  startRecording() {
    console.log('开始录音')
    this.recorderManager.start({
      duration: 60000,  // 最长60秒
      sampleRate: 16000,
      numberOfChannels: 1,
      encodeBitRate: 48000,
      format: 'mp3'
    })
  },

  /**
   * 停止录音（松开）
   */
  stopRecording() {
    console.log('停止录音')
    this.recorderManager.stop()
  },

  /**
   * 处理语音消息
   */
  async handleVoiceMessage(tempFilePath) {
    try {
      wx.showLoading({ title: '识别中...' })

      // 1. 上传到云存储
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath: `voice/${Date.now()}_${Math.random().toString(36).slice(2)}.mp3`,
        filePath: tempFilePath
      })

      // 2. 调用语音识别
      const asrRes = await wx.cloud.callFunction({
        name: 'speechToText',
        data: {
          fileID: uploadRes.fileID,
          format: 'mp3'
        }
      })

      wx.hideLoading()

      if (asrRes.result.success) {
        const text = asrRes.result.text
        console.log('识别结果:', text)

        // 发送识别后的文字
        await this.sendMessage(text)
      } else {
        throw new Error(asrRes.result.error || '识别失败')
      }

    } catch (error) {
      console.error('语音识别失败', error)
      wx.hideLoading()
      wx.showToast({ title: '识别失败，请重试', icon: 'none' })
    }
  },

  /**
   * 发送消息（通用方法）
   */
  async sendMessage(text) {
    // 1. 显示用户消息
    const userMsg = {
      role: 'user',
      content: text,
      timestamp: new Date()
    }
    this.data.messages.push(userMsg)
    this.setData({
      messages: this.data.messages,
      inputValue: ''
    })
    this.scrollToBottom()

    // 2. 显示AI思考中
    const thinkingMsg = {
      role: 'assistant',
      content: '思考中...',
      isThinking: true
    }
    this.data.messages.push(thinkingMsg)
    this.setData({ messages: this.data.messages })
    this.scrollToBottom()

    try {
      // 3. 调用AI对话
      const res = await wx.cloud.callFunction({
        name: 'chatWithAI',
        data: {
          errorId: this.data.errorId,
          userMessage: text,
          needVoice: this.data.voiceOutputEnabled  // 根据设置决定是否需要语音
        }
      })

      // 4. 移除"思考中"
      this.data.messages.pop()

      if (res.result.success) {
        // 5. 显示AI回复
        const aiMsg = {
          role: 'assistant',
          content: res.result.reply,
          voiceFileID: res.result.voiceFileID,
          hasVoice: res.result.hasVoice,
          timestamp: new Date()
        }
        this.data.messages.push(aiMsg)
        this.setData({ messages: this.data.messages })
        this.scrollToBottom()

        // 6. 如果有语音且开启了语音输出，自动播放
        if (res.result.hasVoice && this.data.voiceOutputEnabled) {
          setTimeout(() => {
            this.playVoice(res.result.voiceFileID, this.data.messages.length - 1)
          }, 500)
        }
      } else {
        throw new Error(res.result.error || 'AI回复失败')
      }

    } catch (error) {
      console.error('发送消息失败', error)
      this.data.messages.pop()  // 移除"思考中"
      this.setData({ messages: this.data.messages })
      wx.showToast({ title: '发送失败，请重试', icon: 'none' })
    }
  },

  /**
   * 设置音频播放事件
   */
  setupAudioEvents() {
    this.innerAudioContext.onPlay(() => {
      console.log('开始播放')
      this.setData({ isPlaying: true })
    })

    this.innerAudioContext.onEnded(() => {
      console.log('播放结束')
      this.setData({
        isPlaying: false,
        currentPlayingId: null
      })
    })

    this.innerAudioContext.onError((error) => {
      console.error('播放错误', error)
      this.setData({
        isPlaying: false,
        currentPlayingId: null
      })
      wx.showToast({ title: '播放失败', icon: 'none' })
    })
  },

  /**
   * 播放语音
   */
  async playVoice(fileID, messageIndex) {
    if (this.data.isPlaying && this.data.currentPlayingId === messageIndex) {
      // 正在播放，则暂停
      this.innerAudioContext.pause()
      this.setData({
        isPlaying: false,
        currentPlayingId: null
      })
      return
    }

    try {
      // 获取临时链接
      const res = await wx.cloud.getTempFileURL({
        fileList: [fileID]
      })

      if (res.fileList && res.fileList.length > 0) {
        const tempURL = res.fileList[0].tempFileURL

        this.innerAudioContext.src = tempURL
        this.innerAudioContext.play()

        this.setData({
          currentPlayingId: messageIndex
        })
      }
    } catch (error) {
      console.error('播放语音失败', error)
      wx.showToast({ title: '播放失败', icon: 'none' })
    }
  },

  /**
   * 滚动到底部
   */
  scrollToBottom() {
    this.setData({
      scrollIntoView: `msg-${this.data.messages.length - 1}`
    })
  },

  onUnload() {
    // 清理资源
    if (this.innerAudioContext) {
      this.innerAudioContext.stop()
      this.innerAudioContext.destroy()
    }
    if (this.recorderManager) {
      this.recorderManager.stop()
    }
  }
})
