// 年级配置常量
const GRADES = [
  // 小学 1-6年级
  { level: 1, category: 'primary', display: '小学一年级' },
  { level: 2, category: 'primary', display: '小学二年级' },
  { level: 3, category: 'primary', display: '小学三年级' },
  { level: 4, category: 'primary', display: '小学四年级' },
  { level: 5, category: 'primary', display: '小学五年级' },
  { level: 6, category: 'primary', display: '小学六年级' },
  // 初中 7-9年级
  { level: 7, category: 'middle', display: '初中一年级(初一)' },
  { level: 8, category: 'middle', display: '初中二年级(初二)' },
  { level: 9, category: 'middle', display: '初中三年级(初三)' },
  // 高中 10-12年级
  { level: 10, category: 'high', display: '高中一年级(高一)' },
  { level: 11, category: 'high', display: '高中二年级(高二)' },
  { level: 12, category: 'high', display: '高中三年级(高三)' }
]

Page({
  data: {
    primaryGrades: [],
    middleGrades: [],
    highGrades: [],
    selectedGrade: null,
    isFirstTime: true, // 是否首次选择
    nickName: '' // 用户昵称
  },

  onLoad(options) {
    // 检查是否是首次进入还是修改年级
    this.setData({
      isFirstTime: options.firstTime !== 'false'
    })

    // 按类别分组年级
    this.setData({
      primaryGrades: GRADES.filter(g => g.category === 'primary'),
      middleGrades: GRADES.filter(g => g.category === 'middle'),
      highGrades: GRADES.filter(g => g.category === 'high')
    })
  },

  // 昵称输入
  onNicknameInput(e) {
    this.setData({
      nickName: e.detail.value
    })
  },

  // 选择年级
  onSelectGrade(e) {
    const { level, category, display } = e.currentTarget.dataset

    this.setData({
      selectedGrade: { level, category, displayName: display }
    })
  },

  // 确认选择
  async onConfirm() {
    // 验证输入
    if (this.data.isFirstTime && !this.data.nickName.trim()) {
      wx.showToast({
        title: '请输入昵称',
        icon: 'none'
      })
      return
    }

    if (!this.data.selectedGrade) {
      wx.showToast({
        title: '请选择年级',
        icon: 'none'
      })
      return
    }

    try {
      wx.showLoading({ title: '保存中...' })

      // 准备提交数据
      const submitData = {
        grade: this.data.selectedGrade
      }

      // 首次使用时，同时提交昵称
      if (this.data.isFirstTime) {
        submitData.nickName = this.data.nickName.trim()
      }

      // 调用云函数保存信息
      const res = await wx.cloud.callFunction({
        name: 'updateUserInfo',
        data: submitData
      })

      wx.hideLoading()

      if (res.result.success) {
        wx.showToast({
          title: '设置成功',
          icon: 'success'
        })

        // 保存到本地缓存
        wx.setStorageSync('userGrade', this.data.selectedGrade)

        setTimeout(() => {
          if (this.data.isFirstTime) {
            // 首次设置,跳转到首页
            wx.reLaunch({
              url: '/pages/home/home'
            })
          } else {
            // 修改年级,返回上一页
            wx.navigateBack()
          }
        }, 1500)
      } else {
        throw new Error(res.result.error || '保存失败')
      }
    } catch (error) {
      wx.hideLoading()
      console.error('保存年级失败:', error)
      wx.showToast({
        title: '保存失败,请重试',
        icon: 'none'
      })
    }
  },

  // 跳过选择(仅首次可用)
  onSkip() {
    if (!this.data.isFirstTime) {
      return
    }

    wx.showModal({
      title: '提示',
      content: '建议设置年级以获得更好的学习体验,确定跳过吗?',
      success: (res) => {
        if (res.confirm) {
          wx.reLaunch({
            url: '/pages/home/home'
          })
        }
      }
    })
  }
})
