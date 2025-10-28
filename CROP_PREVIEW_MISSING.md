# 图片切分功能失效问题诊断

## 🐛 问题现象

用户反馈：识别 test-2.png 时，**没有出现裁剪预览界面**，直接跳到了识别结果页面。

## 🔍 问题原因

### 代码流程分析

**正常流程（期望）：**
```
上传图片
  → 调用 getCoordinates (获取题目坐标)
  → 进入 crop_preview 模式 (用户选择题目)
  → 确认后识别选中的题目
  → 进入 formatted_preview 模式 (显示识别结果)
```

**当前实际流程（问题）：**
```
上传图片
  → 调用 getCoordinates
  → 坐标数量 = 0 ❌
  → 触发降级逻辑 fallbackToFullPage
  → 直接跳到 formatted_preview 模式
```

### 关键代码位置

**scan.js:130-138** - 判断逻辑
```javascript
if (coordRes.result.success &&
    coordRes.result.coordinates &&
    coordRes.result.coordinates.length > 0) {
  // 有坐标 → 裁剪预览
  await this.showCropPreview(coordRes.result)
} else {
  // 没有坐标 → 降级到整页识别（跳过裁剪）
  await this.fallbackToFullPage(uploadRes.fileID)
}
```

### 坐标获取失败的可能原因

1. **阿里云OCR API调用失败**
   - AccessKey配置错误
   - API额度用尽
   - 网络超时

2. **学科配置导致识别失败**
   - 之前使用 `PrimarySchool_English` 识别数学题
   - 可能导致API返回空结果

3. **API返回格式不匹配**
   - 云函数期望 `page_list` 或 `doc_layout` 格式
   - 但API返回了其他格式或空数据

4. **图片质量问题**
   - 图片模糊、倾斜
   - 题目间距太小，无法识别边界

## ✅ 已添加的诊断功能

### 云函数日志增强 (ocrRecognize/index.js)

```javascript
console.log('====== OCR坐标识别原始数据 ======')
console.log('数据结构:', {
  hasPageList: !!ocrData.page_list,
  pageCount: ocrData.page_list ? ocrData.page_list.length : 0,
  hasDocLayout: !!ocrData.doc_layout,
  docLayoutCount: ocrData.doc_layout ? ocrData.doc_layout.length : 0,
  allKeys: Object.keys(ocrData)
})

// 打印前2000字符
console.log('OCR数据前2000字符:', JSON.stringify(ocrData).substring(0, 2000))

// 检查错误信息
if (ocrData.error || ocrData.errorCode || ocrData.message) {
  console.error('OCR API返回错误:', {
    error: ocrData.error,
    errorCode: ocrData.errorCode,
    message: ocrData.message
  })
}
```

### 小程序端日志 (scan.js:121-128)

```javascript
console.log('====== 云函数返回结果 ======')
console.log('完整结果:', JSON.stringify(coordRes.result, null, 2))
console.log('success:', coordRes.result.success)
console.log('error:', coordRes.result.error)
console.log('coordinates数量:', coordRes.result.coordinates ? coordRes.result.coordinates.length : 0)
```

## 🧪 测试步骤

### 1. 重新测试识别
1. 打开小程序扫描页面
2. 确保学科设置为"初中数学"（已修复）
3. 上传 test-2.png
4. 观察是否进入裁剪预览

### 2. 查看云函数日志

**控制台路径：**
```
腾讯云控制台
→ 云开发
→ 云函数
→ ocrRecognize
→ 日志查询
→ 选择最近的调用记录
```

**关键日志点：**

#### A. API调用日志
```
OCR请求参数: {...}
RecognizeEduPaperCut API响应状态: 200
```
✅ 如果状态是200 → API调用成功
❌ 如果不是200 → API调用失败，查看错误信息

#### B. 数据结构日志
```
====== OCR坐标识别原始数据 ======
数据结构: {
  hasPageList: false,
  hasDocLayout: true,  ← 重点关注
  docLayoutCount: 3,   ← 期望 > 0
  allKeys: [...]
}
```

#### C. 坐标解析日志
```
开始解析OCR数据...
检测到 doc_layout 格式  ← 确认格式
doc_layout 数量: 3     ← 题目数量
布局1坐标提取成功
布局2坐标提取成功
布局3坐标提取成功
解析后坐标数据: {
  coordinatesCount: 3  ← 最终提取的坐标数
}
```

### 3. 查看小程序控制台日志

**微信开发者工具控制台：**
```
====== 云函数返回结果 ======
success: true
coordinates数量: 3  ← 关键：应该 > 0
>>> 进入裁剪预览模式  ← 应该看到这行
```

## 📊 诊断结果判断

### 情况1: coordinatesCount = 0

**症状：**
```
docLayoutCount: 0
coordinatesCount: 0
>>> 降级到整页识别模式
```

**原因：**
- 学科配置错误（已修复）
- 图片切割失败
- API限制

**解决方案：**
1. ✅ 确认学科配置已改为"初中数学"
2. 尝试其他切割方式：
   - 在配置面板改为"按段落切割"
   - 或"按块切割"
3. 检查阿里云OCR额度

### 情况2: API调用失败

**症状：**
```
OCR API返回错误: {
  errorCode: "xxx",
  message: "xxx"
}
```

**解决方案：**
- 检查阿里云AccessKey配置
- 确认API额度
- 查看错误码文档

### 情况3: 数据格式不匹配

**症状：**
```
未识别的数据格式,无page_list也无doc_layout
allKeys: ["xxx", "yyy"]
```

**解决方案：**
- 查看 `allKeys` 中的实际字段
- 可能需要适配新的API响应格式

## 🔧 临时解决方案

如果坐标获取持续失败，可以考虑：

### 方案1: 调整OCR参数
```javascript
// scan.js - 尝试不同的切割方式
ocrConfig: {
  cutType: 'para',  // 改为按段落
  imageType: 'photo',
  subject: 'JuniorMiddleSchool_Math'
}
```

### 方案2: 降低门槛
```javascript
// scan.js:130 - 允许0个坐标也进入预览
if (coordRes.result.success) {
  if (coordRes.result.coordinates && coordRes.result.coordinates.length > 0) {
    await this.showCropPreview(coordRes.result)
  } else {
    // 生成默认的单题目坐标
    await this.showCropPreview({
      imageUrl: coordRes.result.imageUrl,
      coordinates: [{
        pos: [0, 0, 100, 100]  // 全图作为一个题目
      }]
    })
  }
}
```

### 方案3: 用户手动切割
添加一个"手动切割"模式，让用户自己框选题目区域。

## 📝 下一步行动

1. ✅ 更新云函数（已完成）
2. ⏳ 测试 test-2.png
3. ⏳ 查看云函数和小程序日志
4. ⏳ 根据日志结果进一步调整

---

## 🔗 相关文件

- `cloudfunctions/ocrRecognize/index.js` - 云函数代码
- `miniprogram/pages/scan/scan.js` - 扫描页面逻辑
- `FIX_OCR_ISSUES.md` - OCR配置修复文档
- `HANDWRITING_RECOGNITION_ANALYSIS.md` - 手写识别分析

## 📅 更新记录

- 2025-01-28: 添加详细的坐标获取日志
- 2025-01-28: 修复学科配置默认值
- 2025-01-28: 部署云函数更新
