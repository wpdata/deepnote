# Canvas 图片裁剪功能实现说明

## 📋 功能概述

实现了基于OCR识别的题目坐标自动裁剪功能,用户拍照后可以:
1. 自动识别试卷中的所有题目位置
2. 根据坐标裁剪出每个题目的图片
3. 在前端预览并选择需要识别的题目
4. 对选中的题目进行OCR识别

## 🔧 技术实现

### 1. Canvas API 版本

**使用微信小程序 Canvas 2D API (最新版本)**

- ✅ 不再使用已停止维护的 `wx.createCanvasContext()`
- ✅ 采用 Canvas 2D 标准 API
- ✅ 支持高清图片裁剪 (考虑设备像素比)

### 2. 关键代码变更

#### WXML 配置
```xml
<!-- 使用 type="2d" 启用 Canvas 2D API -->
<canvas
  type="2d"
  id="cropCanvas"
  style="position: fixed; left: -9999px; top: -9999px; width: 1000px; height: 1000px;"
/>
```

#### JavaScript 裁剪逻辑
```javascript
// 1. 通过 SelectorQuery 获取 Canvas 节点
const query = wx.createSelectorQuery().in(this)
query.select('#cropCanvas')
  .fields({ node: true, size: true })
  .exec((res) => {
    const canvas = res[0].node
    const ctx = canvas.getContext('2d')

    // 2. 设置Canvas尺寸 (考虑设备像素比)
    const dpr = wx.getSystemInfoSync().pixelRatio || 1
    canvas.width = cropWidth * dpr
    canvas.height = cropHeight * dpr
    ctx.scale(dpr, dpr)

    // 3. 使用 canvas.createImage() 创建图片对象
    const img = canvas.createImage()
    img.onload = () => {
      // 4. 绘制裁剪区域
      ctx.drawImage(img, left, top, cropWidth, cropHeight, 0, 0, cropWidth, cropHeight)

      // 5. 导出为临时文件 (传入 canvas 对象而非 canvasId)
      wx.canvasToTempFilePath({
        canvas: canvas,  // 关键:传入canvas对象
        x: 0,
        y: 0,
        width: cropWidth,
        height: cropHeight,
        fileType: 'png',
        success: (res) => {
          resolve(res.tempFilePath)
        }
      }, this)
    }
    img.src = imagePath
  })
```

## 📊 工作流程

```
用户拍照
  ↓
上传到云存储
  ↓
调用 ocrRecognize (action=getCoordinates)
  ↓
获取题目坐标数组
  ↓
下载原图到本地
  ↓
逐个裁剪题目 (cropSingleQuestion)
  ├─ 计算裁剪区域 (left, top, width, height)
  ├─ 获取 Canvas 2D 节点
  ├─ 设置Canvas尺寸 (考虑DPR)
  ├─ 加载原图到Canvas Image对象
  ├─ 绘制裁剪区域
  └─ 导出为临时图片
  ↓
显示裁剪预览 (用户可选择题目)
  ↓
识别选中的题目 (ocrRecognize action=recognizeQuestion)
  ↓
显示识别结果 (可编辑)
  ↓
批量保存到错题本
```

## 🎯 关键特性

### 1. 设备像素比适配
```javascript
const dpr = wx.getSystemInfoSync().pixelRatio || 1
canvas.width = cropWidth * dpr
canvas.height = cropHeight * dpr
ctx.scale(dpr, dpr)
```
确保在高清屏幕上也能生成清晰的裁剪图片。

### 2. 错误处理
- 裁剪失败时使用原图作为fallback
- 完善的错误日志记录
- 用户友好的错误提示

### 3. 性能优化
- 逐个裁剪,避免并发导致的卡顿
- 异步处理,不阻塞UI
- 实时更新进度反馈

## 📝 API 对比

| 特性 | 旧版 API | Canvas 2D API (当前使用) |
|------|---------|-------------------------|
| 获取上下文 | `wx.createCanvasContext('id')` | `canvas.getContext('2d')` |
| 传参方式 | `canvasId: 'string'` | `canvas: canvasNode` |
| 绘制方式 | 异步 (需要调用 draw()) | 同步 (立即生效) |
| 维护状态 | ⚠️ 停止维护 | ✅ 持续维护 |
| 性能 | 较低 | 更高 |
| DPI支持 | 有限 | 完善 |

## 🔍 调试建议

### 查看裁剪日志
在微信开发者工具控制台中搜索以下关键词:
- `裁剪区域:` - 查看坐标计算
- `Canvas设置:` - 查看Canvas配置
- `图片加载成功` - 确认图片加载
- `裁剪导出成功:` - 确认导出成功

### 常见问题

**Q: Canvas节点获取失败?**
- 确保WXML中有 `type="2d"` 和正确的 `id`
- 确保在页面加载完成后再调用

**Q: 导出图片模糊?**
- 检查DPR设置是否正确
- 确认Canvas尺寸设置

**Q: 裁剪坐标不准确?**
- 检查OCR返回的坐标格式
- 验证原图尺寸与坐标的对应关系

## 📚 参考文档

- [微信小程序 Canvas 画布](https://developers.weixin.qq.com/miniprogram/dev/framework/ability/canvas.html)
- [wx.canvasToTempFilePath API](https://developers.weixin.qq.com/miniprogram/dev/api/canvas/wx.canvasToTempFilePath.html)
- [Canvas 2D 最佳实践](https://developers.weixin.qq.com/community/develop/article/doc/00008694b34770b1931ccec1951413)

## ✅ 已完成

- [x] 使用最新的Canvas 2D API
- [x] 支持高清图片裁剪 (DPR适配)
- [x] 完善错误处理和fallback机制
- [x] 实时更新裁剪进度
- [x] 前端预览裁剪结果

## 🚀 下一步

- [ ] 添加裁剪进度条
- [ ] 支持批量裁剪并发优化
- [ ] 添加裁剪质量配置选项
- [ ] 支持裁剪区域微调
