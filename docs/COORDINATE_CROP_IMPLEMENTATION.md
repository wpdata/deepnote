# 基于坐标的智能题目识别方案 - 实现文档

## 🎯 完整流程

```
步骤1: 拍照上传
  ↓
步骤2: 获取题目坐标 [调用云函数 action=getCoordinates]
  ↓
步骤3: 前端Canvas裁剪,显示题目预览
  ↓ 用户可以删除不需要的题目
步骤4: 提交选中的题目 [调用云函数 action=recognizeQuestion]
  ↓ 云函数识别并格式化(去除答案)
步骤5: 显示格式化后的题目供用户确认
  ↓
步骤6: 最终提交保存到错题本
```

## 📡 云函数接口说明

### 接口1: 获取题目坐标

```javascript
// 调用方式
wx.cloud.callFunction({
  name: 'ocrRecognize',
  data: {
    action: 'getCoordinates',
    fileID: 'cloud://xxx.jpg'  // 上传后的云存储ID
  }
})

// 返回数据
{
  success: true,
  imageUrl: 'https://...',     // 原图临时URL
  coordinates: [               // 题目坐标数组
    {
      layout_type: "text",
      pos: [
        {x: 337, y: 119},      // 左上
        {x: 337, y: 228},      // 左下
        {x: 1122, y: 228},     // 右下
        {x: 1122, y: 119}      // 右上
      ]
    },
    // ... 更多题目坐标
  ],
  imageWidth: 1920,
  imageHeight: 1080
}
```

### 接口2: 识别并格式化单个题目

```javascript
// 调用方式
wx.cloud.callFunction({
  name: 'ocrRecognize',
  data: {
    action: 'recognizeQuestion',
    imageData: base64String  // Canvas裁剪后的base64图片
  }
})

// 返回数据
{
  success: true,
  rawText: "原始OCR文本...",          // 包含答案的原始文本
  formattedText: "格式化后的题目...",  // 已去除答案
  aiAnalysis: {
    subject: "英语",
    knowledgePoint: "语法",
    difficulty: "中等",
    questionType: "选择题"
  }
}
```

## 🎨 前端实现步骤

### 步骤1: 修改scan.js - 添加坐标裁剪模式

```javascript
Page({
  data: {
    // 添加新的状态
    mode: 'normal',  // 'normal' | 'crop_preview' | 'formatted_preview'
    croppedQuestions: [],  // 裁剪后的题目预览
    selectedQuestions: [], // 用户选中的题目
    formattedQuestions: [] // 格式化后的题目
  },

  async startRecognition() {
    // ... 上传图片代码 ...

    try {
      // 调用云函数获取坐标
      const coordRes = await wx.cloud.callFunction({
        name: 'ocrRecognize',
        data: {
          action: 'getCoordinates',
          fileID: uploadRes.fileID
        }
      })

      if (coordRes.result.success && coordRes.result.coordinates.length > 0) {
        // 有坐标数据,进入裁剪预览模式
        this.showCropPreview(coordRes.result)
      } else {
        // 没有坐标,降级到整页识别
        this.fallbackToFullPage(uploadRes.fileID)
      }
    } catch (error) {
      console.error('获取坐标失败', error)
      this.fallbackToFullPage(uploadRes.fileID)
    }
  },

  // 显示裁剪预览
  async showCropPreview(coordData) {
    const { imageUrl, coordinates } = coordData

    // 下载原图
    wx.showLoading({ title: '处理中...' })

    const croppedQuestions = []

    // 使用Canvas裁剪每个题目
    for (let i = 0; i < coordinates.length; i++) {
      const coord = coordinates[i]
      const croppedImage = await this.cropImage(imageUrl, coord.pos)

      croppedQuestions.push({
        id: `q${i + 1}`,
        index: i,
        croppedImage: croppedImage,  // base64或临时路径
        selected: true,  // 默认选中
        coordinates: coord.pos
      })
    }

    wx.hideLoading()

    this.setData({
      mode: 'crop_preview',
      croppedQuestions: croppedQuestions,
      originalImageUrl: imageUrl
    })
  },

  // Canvas裁剪图片
  cropImage(imageUrl, coordinates) {
    return new Promise((resolve, reject) => {
      // 计算裁剪区域
      const xs = coordinates.map(p => p.x)
      const ys = coordinates.map(p => p.y)
      const left = Math.min(...xs)
      const top = Math.min(...ys)
      const width = Math.max(...xs) - left
      const height = Math.max(...ys) - top

      // 创建Canvas
      const ctx = wx.createCanvasContext('cropCanvas')

      // 下载图片
      wx.getImageInfo({
        src: imageUrl,
        success: (info) => {
          // 绘制裁剪区域
          ctx.drawImage(info.path,
            left, top, width, height,  // 源图裁剪区域
            0, 0, width, height         // 目标canvas区域
          )

          ctx.draw(false, () => {
            // 导出为临时文件或base64
            wx.canvasToTempFilePath({
              canvasId: 'cropCanvas',
              success: (res) => {
                resolve(res.tempFilePath)
              },
              fail: reject
            })
          })
        },
        fail: reject
      })
    })
  },

  // 用户切换题目选中状态
  toggleQuestionSelection(e) {
    const index = e.currentTarget.dataset.index
    const questions = this.data.croppedQuestions
    questions[index].selected = !questions[index].selected

    this.setData({
      croppedQuestions: questions
    })
  },

  // 确认选中的题目,提交识别
  async confirmSelectedQuestions() {
    const selected = this.data.croppedQuestions.filter(q => q.selected)

    if (selected.length === 0) {
      wx.showToast({ title: '请至少选择一个题目', icon: 'none' })
      return
    }

    wx.showLoading({ title: `识别中 0/${selected.length}` })

    const formatted = []

    for (let i = 0; i < selected.length; i++) {
      const question = selected[i]

      wx.showLoading({ title: `识别中 ${i + 1}/${selected.length}` })

      try {
        // 读取图片为base64
        const fs = wx.getFileSystemManager()
        const imageData = fs.readFileSync(question.croppedImage, 'base64')

        // 调用云函数识别
        const recognizeRes = await wx.cloud.callFunction({
          name: 'ocrRecognize',
          data: {
            action: 'recognizeQuestion',
            imageData: imageData
          }
        })

        if (recognizeRes.result.success) {
          formatted.push({
            ...question,
            ...recognizeRes.result
          })
        }
      } catch (error) {
        console.error(`识别题目${i + 1}失败`, error)
      }
    }

    wx.hideLoading()

    // 显示格式化后的题目
    this.setData({
      mode: 'formatted_preview',
      formattedQuestions: formatted
    })
  }
})
```

### 步骤2: 修改scan.wxml - 添加UI

```xml
<view class="container">
  <!-- 模式1: 正常拍照 -->
  <view wx:if="{{mode === 'normal'}}">
    <!-- 原有的上传界面 -->
  </view>

  <!-- 模式2: 裁剪预览 -->
  <view wx:if="{{mode === 'crop_preview'}}" class="crop-preview-mode">
    <view class="header">
      <text class="title">检测到 {{croppedQuestions.length}} 个题目</text>
      <text class="subtitle">点击题目可取消选择</text>
    </view>

    <scroll-view scroll-y class="question-grid">
      <view
        wx:for="{{croppedQuestions}}"
        wx:key="id"
        class="question-item {{item.selected ? 'selected' : ''}}"
        bindtap="toggleQuestionSelection"
        data-index="{{index}}"
      >
        <image class="question-preview" src="{{item.croppedImage}}" mode="aspectFit" />
        <view class="question-number">题目 {{index + 1}}</view>
        <view wx:if="{{item.selected}}" class="selected-badge">✓</view>
      </view>
    </scroll-view>

    <view class="action-bar">
      <button class="action-btn secondary" bindtap="reRecognize">重新拍照</button>
      <button class="action-btn primary" bindtap="confirmSelectedQuestions">
        确认识别 ({{croppedQuestions.filter(q => q.selected).length}}题)
      </button>
    </view>
  </view>

  <!-- 模式3: 格式化预览 -->
  <view wx:if="{{mode === 'formatted_preview'}}" class="formatted-preview-mode">
    <view class="header">
      <text class="title">识别结果</text>
      <text class="subtitle">可以编辑题目内容</text>
    </view>

    <scroll-view scroll-y class="formatted-list">
      <view wx:for="{{formattedQuestions}}" wx:key="id" class="formatted-item">
        <view class="item-header">
          <text class="item-title">题目 {{index + 1}}</text>
          <view class="ai-tags">
            <text class="tag">{{item.aiAnalysis.subject}}</text>
            <text class="tag">{{item.aiAnalysis.difficulty}}</text>
          </view>
        </view>

        <textarea
          class="question-text"
          value="{{item.formattedText}}"
          bindinput="onQuestionTextInput"
          data-index="{{index}}"
          auto-height
        />

        <view class="info-row">
          <text class="label">知识点:</text>
          <input
            class="input"
            value="{{item.aiAnalysis.knowledgePoint}}"
            bindinput="onKnowledgeInput"
            data-index="{{index}}"
          />
        </view>
      </view>
    </scroll-view>

    <view class="action-bar">
      <button class="action-btn secondary" bindtap="backToCropPreview">返回</button>
      <button class="action-btn primary" bindtap="batchSaveQuestions">
        保存全部到错题本
      </button>
    </view>
  </view>

  <!-- 隐藏的Canvas用于裁剪 -->
  <canvas canvas-id="cropCanvas" style="position: fixed; left: -9999px;" />
</view>
```

### 步骤3: 添加样式 scan.wxss

```css
/* 裁剪预览模式 */
.crop-preview-mode {
  padding: 20rpx;
}

.question-grid {
  height: 70vh;
  margin: 20rpx 0;
}

.question-item {
  display: inline-block;
  width: 48%;
  margin: 1%;
  border: 2rpx solid #ddd;
  border-radius: 12rpx;
  overflow: hidden;
  position: relative;
  opacity: 0.5;
}

.question-item.selected {
  border-color: #1677FF;
  opacity: 1;
}

.question-preview {
  width: 100%;
  height: 300rpx;
}

.question-number {
  padding: 10rpx;
  text-align: center;
  font-size: 24rpx;
  color: #666;
}

.selected-badge {
  position: absolute;
  top: 10rpx;
  right: 10rpx;
  width: 40rpx;
  height: 40rpx;
  background: #1677FF;
  color: white;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
}

/* 格式化预览模式 */
.formatted-preview-mode {
  padding: 20rpx;
}

.formatted-list {
  height: 70vh;
  margin: 20rpx 0;
}

.formatted-item {
  background: white;
  border-radius: 12rpx;
  padding: 20rpx;
  margin-bottom: 20rpx;
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16rpx;
}

.item-title {
  font-size: 32rpx;
  font-weight: bold;
}

.ai-tags {
  display: flex;
  gap: 8rpx;
}

.tag {
  padding: 4rpx 12rpx;
  background: #E6F4FF;
  color: #1677FF;
  font-size: 22rpx;
  border-radius: 12rpx;
}

.question-text {
  width: 100%;
  min-height: 200rpx;
  padding: 16rpx;
  background: #F5F5F5;
  border-radius: 8rpx;
  font-size: 28rpx;
  line-height: 1.6;
}

.info-row {
  display: flex;
  align-items: center;
  margin-top: 16rpx;
}

.label {
  width: 120rpx;
  font-size: 26rpx;
  color: #666;
}

.input {
  flex: 1;
  padding: 8rpx;
  border-bottom: 1rpx solid #ddd;
}

/* 操作按钮栏 */
.action-bar {
  display: flex;
  gap: 20rpx;
  padding: 20rpx 0;
}

.action-btn {
  flex: 1;
  height: 88rpx;
  border-radius: 44rpx;
  font-size: 30rpx;
}

.action-btn.primary {
  background: #1677FF;
  color: white;
}

.action-btn.secondary {
  background: white;
  color: #333;
  border: 2rpx solid #ddd;
}
```

## 🧪 测试流程

1. **拍照** → 检查是否返回坐标数据
2. **查看裁剪预览** → 检查每个题目是否正确裁剪
3. **选择/删除题目** → 测试UI交互
4. **提交识别** → 检查格式化效果(答案是否去除)
5. **最终保存** → 验证数据保存到错题本

## 📝 注意事项

1. **Canvas限制**: 小程序Canvas有尺寸限制,过大的图片需要缩放
2. **性能优化**: 题目很多时分批处理,避免卡顿
3. **错误处理**: 某个题目识别失败不影响其他题目
4. **用户体验**:
   - 显示进度(识别中 X/Y)
   - 提供返回和重新拍照选项
   - 允许手动编辑格式化后的文本

## 🚀 优化方向

1. **缓存机制**: 裁剪后的图片缓存到本地,避免重复裁剪
2. **并行识别**: 使用Promise.all并行识别多个题目
3. **预加载**: 在裁剪预览时就开始识别第一个题目
4. **智能合并**: 相邻的小文本块可能是同一题目的不同部分
