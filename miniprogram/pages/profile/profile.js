Page({
  data: {
    userInfo: {
      avatarUrl: '',
      nickName: '智能错题本用户',
      studyDays: 15,
      grade: null // 年级信息
    },
    stats: {
      totalErrors: 120,
      masteredErrors: 85,
      practiceCount: 45,
      masteredRate: 71
    },
    isEditingNickname: false,
    tempNickname: ''
  },

  onLoad() {
    this.loadUserInfo()
    this.loadStats()
  },

  onShow() {
    // 每次显示页面时刷新统计数据
    this.loadStats()
    this.loadUserInfo()
  },

  async loadUserInfo() {
    try {
      // 调用云函数获取用户信息
      const res = await wx.cloud.callFunction({
        name: 'getUserInfo'
      });

      console.log('获取用户信息成功', res);

      if (res.result.success) {
        const userInfo = {
          avatarUrl: res.result.data.avatarUrl || '',
          nickName: res.result.data.nickName || '智能错题本用户',
          studyDays: this.data.userInfo.studyDays,
          grade: res.result.data.grade || null
        };

        this.setData({ userInfo });

        // 同时保存到本地缓存
        wx.setStorageSync('userInfo', userInfo);
      } else {
        console.error('获取用户信息失败:', res.result.error);
      }
    } catch (error) {
      console.error('加载用户信息失败', error);

      // 降级处理：从本地缓存读取
      const cachedUserInfo = wx.getStorageSync('userInfo');
      if (cachedUserInfo) {
        this.setData({
          userInfo: {
            ...this.data.userInfo,
            ...cachedUserInfo
          }
        });
      }
    }
  },

  // 选择头像
  async onChooseAvatar(e) {
    const { avatarUrl } = e.detail
    console.log('选择头像:', avatarUrl)

    try {
      wx.showLoading({ title: '上传中...' })

      // 上传头像到云存储
      const cloudPath = `avatars/${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`
      const uploadRes = await wx.cloud.uploadFile({
        cloudPath,
        filePath: avatarUrl
      })

      console.log('头像上传成功:', uploadRes.fileID)

      // 更新用户信息
      await this.updateUserInfo({
        avatarUrl: uploadRes.fileID
      })

      wx.hideLoading()
      wx.showToast({
        title: '头像更新成功',
        icon: 'success'
      })
    } catch (error) {
      wx.hideLoading()
      console.error('头像上传失败:', error)
      wx.showToast({
        title: '头像上传失败',
        icon: 'none'
      })
    }
  },

  // 编辑昵称
  onEditNickname() {
    this.setData({
      isEditingNickname: true,
      tempNickname: this.data.userInfo.nickName
    })
  },

  // 昵称输入
  onNicknameInput(e) {
    this.setData({
      tempNickname: e.detail.value
    })
  },

  // 昵称失焦（完成编辑）
  async onNicknameBlur() {
    const nickname = this.data.tempNickname.trim()

    this.setData({
      isEditingNickname: false
    })

    if (!nickname || nickname === this.data.userInfo.nickName) {
      return
    }

    try {
      wx.showLoading({ title: '保存中...' })

      await this.updateUserInfo({
        nickName: nickname
      })

      wx.hideLoading()
      wx.showToast({
        title: '昵称更新成功',
        icon: 'success'
      })
    } catch (error) {
      wx.hideLoading()
      console.error('昵称更新失败:', error)
      wx.showToast({
        title: '昵称更新失败',
        icon: 'none'
      })
    }
  },

  // 更新用户信息到数据库
  async updateUserInfo(updates) {
    try {
      // 调用云函数更新用户信息
      const res = await wx.cloud.callFunction({
        name: 'updateUserInfo',
        data: updates
      });

      console.log('更新用户信息成功', res);

      if (!res.result.success) {
        throw new Error(res.result.error);
      }

      // 更新本地状态
      this.setData({
        userInfo: {
          ...this.data.userInfo,
          ...updates
        }
      });

      // 更新本地缓存
      const userInfo = { ...this.data.userInfo, ...updates };
      wx.setStorageSync('userInfo', userInfo);
    } catch (error) {
      console.error('更新用户信息失败:', error);
      throw error;
    }
  },

  async loadStats() {
    try {
      // 调用 getUserStats 云函数获取统计数据
      const res = await wx.cloud.callFunction({
        name: 'getUserStats'
      })

      console.log('获取用户统计成功', res.result)

      if (res.result.success) {
        this.setData({
          stats: {
            totalErrors: res.result.stats.totalErrors,
            masteredErrors: res.result.stats.masteredErrors,
            practiceCount: res.result.stats.practiceCount,
            masteredRate: res.result.stats.masteredRate
          },
          userInfo: {
            ...this.data.userInfo,
            studyDays: res.result.stats.studyDays
          }
        })
      }
    } catch (error) {
      console.error('加载统计数据失败', error)
    }
  },

  onBackupData() {
    wx.showLoading({
      title: '同步中...'
    })

    // TODO: 调用云函数进行数据备份
    wx.cloud.callFunction({
      name: 'backupData',
      success: (res) => {
        wx.hideLoading()
        wx.showToast({
          title: '同步成功',
          icon: 'success'
        })
      },
      fail: (err) => {
        wx.hideLoading()
        wx.showToast({
          title: '同步失败',
          icon: 'none'
        })
      }
    })
  },

  // 修改年级
  onChangeGrade() {
    wx.navigateTo({
      url: '/pages/grade-select/grade-select?firstTime=false'
    })
  },

  onSubjectManage() {
    wx.showToast({
      title: '学科管理功能开发中',
      icon: 'none'
    })
  },

  onNotificationSettings() {
    wx.showToast({
      title: '通知设置功能开发中',
      icon: 'none'
    })
  },

  onFeedback() {
    wx.showModal({
      title: '帮助与反馈',
      content: '如有问题或建议，请通过小程序内的反馈功能联系我们',
      showCancel: false
    })
  },

  onAbout() {
    wx.showModal({
      title: '关于我们',
      content: '智能错题整理小程序\n版本：1.0.0\n\n一个帮助学生高效整理和复习错题的智能学习工具',
      showCancel: false
    })
  },

  onShareAppMessage() {
    return {
      title: '智能错题本 - 高效学习好帮手',
      path: '/pages/home/home'
    }
  }
})
