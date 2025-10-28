# 🔍 Canvas裁剪功能调试指南

## ❌ 当前错误

```
scan.js:196 裁剪所有题目失败:
{errno: 1001, errMsg: "getImageInfo:fail parameter error: parameter.src should be String instead of Undefined"}
```

**错误原因**: `imageUrl` 为 `undefined`,导致下载图片失败。

## 🛠️ 已添加的调试日志

### 1. 云函数 ocrRecognize (getCoordinates模式)

```javascript
// 输出位置: cloudfunctions/ocrRecognize/index.js

console.log('开始获取临时URL, fileID:', fileID)
console.log('getTempFileURL 结果:', { ... })
console.log('获取到的临时URL:', imageUrl)
```

### 2. 小程序端 scan.js

```javascript
// showCropPreview 函数
console.log('showCropPreview 接收到的数据:', {
  hasImageUrl: !!imageUrl,
  imageUrl: imageUrl,
  coordinatesCount: coordinates ? coordinates.length : 0
})

// cropAllQuestions 函数
console.log('cropAllQuestions 开始,imageUrl:', imageUrl)
console.log('开始下载原图:', imageUrl)
console.log('下载完成:', downloadRes.tempFilePath)
```

## 📋 调试步骤

### Step 1: 查看云函数日志

在微信开发者工具中:

1. 打开 **云开发控制台**
2. 进入 **云函数** → **ocrRecognize**
3. 点击 **日志**
4. 查找以下关键信息:

```
✅ 预期正常输出:
- "开始获取临时URL, fileID: cloud://xxx"
- "getTempFileURL 结果: { hasFileList: true, fileListLength: 1, ... }"
- "获取到的临时URL: https://xxx.tcb.qcloud.la/xxx"

❌ 如果看到:
- "临时URL为空" → fileResult.fileList[0].tempFileURL 是 undefined
- "无法获取图片URL" → fileResult.fileList 是空数组
```

### Step 2: 检查小程序控制台

在微信开发者工具控制台中查看:

```
搜索关键词: "showCropPreview 接收到的数据"

✅ 预期输出:
{
  hasImageUrl: true,
  imageUrl: "https://xxx.tcb.qcloud.la/xxx",
  coordinatesCount: 3
}

❌ 如果 hasImageUrl: false,说明云函数返回的数据中没有imageUrl
```

### Step 3: 验证coordRes.result结构

在 `scan.js:88` 添加完整的日志:

```javascript
console.log('坐标结果:', coordRes.result)
console.log('coordRes.result详细:', JSON.stringify(coordRes.result))
```

预期结构:
```json
{
  "success": true,
  "imageUrl": "https://xxx.tcb.qcloud.la/xxx",
  "coordinates": [...],
  "imageWidth": 1920,
  "imageHeight": 1080
}
```

## 🐛 可能的问题和解决方案

### 问题1: cloud.getTempFileURL 返回空

**原因**: fileID 格式错误或文件不存在

**解决方案**:
```javascript
// 检查 fileID 格式
console.log('上传的fileID:', uploadRes.fileID)
// 应该类似: cloud://env-xxx.xxx/ocr/xxx.jpg
```

### 问题2: tempFileURL 为 undefined

**原因**: 云存储权限问题或文件已过期

**解决方案**:
1. 检查云存储权限设置
2. 确保文件刚刚上传,未过期
3. 查看 `fileResult.fileList[0]` 的完整内容:

```javascript
console.log('fileList[0]完整内容:', JSON.stringify(fileResult.fileList[0]))
```

### 问题3: 云函数返回但小程序端收不到

**原因**: 云函数返回格式错误或网络问题

**解决方案**:
```javascript
// 在云函数返回前打印
console.log('即将返回的数据:', {
  success: true,
  imageUrl: imageUrl,
  coordinates: ocrData.doc_layout || []
})

// 在小程序端完整接收
const coordRes = await wx.cloud.callFunction({
  name: 'ocrRecognize',
  data: { action: 'getCoordinates', fileID: uploadRes.fileID }
})
console.log('云函数完整响应:', JSON.stringify(coordRes))
```

## 🔧 临时修复方案

如果问题持续,可以使用已上传的 fileID 作为备用:

```javascript
// 在 showCropPreview 中
async showCropPreview(coordData) {
  let { imageUrl, coordinates } = coordData

  // 如果imageUrl为空,尝试使用uploadedFileID
  if (!imageUrl && this.data.uploadedFileID) {
    console.log('imageUrl为空,尝试重新获取临时URL')
    try {
      const fileResult = await wx.cloud.getTempFileURL({
        fileList: [this.data.uploadedFileID]
      })
      imageUrl = fileResult.fileList[0].tempFileURL
      console.log('重新获取的临时URL:', imageUrl)
    } catch (error) {
      console.error('重新获取临时URL失败:', error)
    }
  }

  // ... 继续原逻辑
}
```

## ✅ 验证步骤

1. **重新部署云函数** ✅ (已完成)
   ```bash
   # 云函数已自动部署
   ```

2. **清除缓存并重启**
   - 关闭微信开发者工具
   - 重新打开项目
   - 清除编译缓存

3. **重新测试**
   - 拍照或选择图片
   - 查看控制台日志
   - 查看云函数日志

4. **确认数据流**
   ```
   上传图片 → 得到 fileID
      ↓
   调用云函数 getCoordinates(fileID)
      ↓
   云函数调用 getTempFileURL
      ↓
   返回 { success, imageUrl, coordinates }
      ↓
   小程序调用 showCropPreview(coordData)
      ↓
   cropAllQuestions(imageUrl, questions)
   ```

## 📞 如果问题依然存在

请提供以下信息:

1. 云函数完整日志截图
2. 小程序控制台完整日志
3. `coordRes.result` 的完整输出
4. 使用的测试图片类型和大小

---

**最后更新**: 2025-10-27
**相关文件**:
- `cloudfunctions/ocrRecognize/index.js`
- `miniprogram/pages/scan/scan.js`
