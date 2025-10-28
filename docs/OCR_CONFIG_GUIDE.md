# 📐 OCR识别配置说明

## 🎯 功能概述

为了提高题目识别的准确率,现在支持自定义OCR识别参数。用户可以根据实际情况选择:
- **切割方式**: 按题目/按行/按段/按块
- **图片类型**: 拍照/扫描/电子文档
- **学科类型**: 小学/初中/高中 + 英语/数学

## 🔧 配置项说明

### 1. 切割方式 (CutType)

| 中文显示 | API参数 | 适用场景 | 说明 |
|---------|---------|----------|------|
| 按题目切割 | `question` | ✅ **推荐** | 自动识别每个完整题目,适合标准试卷 |
| 按行切割 | `line` | 密集排版 | 按文本行切割,适合行间距小的材料 |
| 按段落切割 | `para` | 阅读理解 | 按段落切割,适合长文本材料 |
| 按块切割 | `block` | 复杂布局 | 按内容块切割,适合版面复杂的试卷 |

**推荐**: `question` - 大部分情况下效果最好

---

### 2. 图片类型 (ImageType)

| 中文显示 | API参数 | 适用场景 | 说明 |
|---------|---------|----------|------|
| 拍照图片 | `photo` | ✅ **推荐** | 手机拍照的试卷,可能有光照/角度问题 |
| 扫描图片 | `scan` | 扫描仪 | 使用扫描仪扫描的高清图片 |
| 电子文档 | `digital` | PDF/Word | 从电子文档导出的图片,清晰度高 |

**推荐**: `photo` - 大部分用户使用手机拍照

---

### 3. 学科类型 (Subject)

| 中文显示 | API参数 | 说明 |
|---------|---------|------|
| 小学英语 | `PrimarySchool_English` | ✅ **默认推荐** |
| 初中英语 | `JuniorMiddleSchool_English` | |
| 高中英语 | `HighSchool_English` | |
| 小学数学 | `PrimarySchool_Math` | |
| 初中数学 | `JuniorMiddleSchool_Math` | |
| 高中数学 | `HighSchool_Math` | |

**说明**: 选择正确的学科类型可以提高识别准确率,特别是对于学科专用符号和术语

---

### 4. 输出原图坐标 (OutputOricoord)

- **值**: `true` (固定)
- **说明**: 返回题目在原图中的坐标位置,用于后续裁剪

---

## 🎨 界面使用

### 打开配置面板

1. 在扫描页面点击 **"⚙️ 识别设置"** 按钮
2. 配置面板展开,显示三个配置项
3. 点击每个配置项可以选择不同的选项

### 配置面板截图示例

```
┌─────────────────────────────┐
│ 识别设置                    │
├─────────────────────────────┤
│ 切割方式      按题目切割 ▼  │
│ 图片类型      拍照图片 ▼    │
│ 学科类型      小学英语 ▼    │
│                             │
│ 💡 提示: 准确的设置可以提高 │
│         识别准确率          │
└─────────────────────────────┘
```

### 推荐配置

#### 场景1: 手机拍照试卷 (最常见)
```
切割方式: 按题目切割
图片类型: 拍照图片
学科类型: 根据实际学科选择
```

#### 场景2: 扫描件
```
切割方式: 按题目切割
图片类型: 扫描图片
学科类型: 根据实际学科选择
```

#### 场景3: 密集排版的练习题
```
切割方式: 按行切割
图片类型: 拍照图片
学科类型: 根据实际学科选择
```

---

## 💻 技术实现

### 前端配置存储

```javascript
ocrConfig: {
  cutType: 'question',              // 切割类型
  imageType: 'photo',               // 图片类型
  subject: 'PrimarySchool_English', // 学科
  outputOricoord: true              // 输出原图坐标
}
```

### 中英文映射

为了更好的用户体验,界面显示中文,但实际传递给API的是英文参数:

```javascript
// 切割方式映射
cutTypeOptions: ['按题目切割', '按行切割', '按段落切割', '按块切割']
cutTypeValues: ['question', 'line', 'para', 'block']

// 图片类型映射
imageTypeOptions: ['拍照图片', '扫描图片', '电子文档']
imageTypeValues: ['photo', 'scan', 'digital']

// 学科映射
subjectOptions: ['小学英语', '初中英语', '高中英语', ...]
subjectValues: ['PrimarySchool_English', 'JuniorMiddleSchool_English', ...]
```

### 云函数调用

```javascript
wx.cloud.callFunction({
  name: 'ocrRecognize',
  data: {
    action: 'getCoordinates',
    fileID: uploadRes.fileID,
    ocrOptions: {
      cutType: 'question',
      imageType: 'photo',
      subject: 'PrimarySchool_English',
      outputOricoord: true
    }
  }
})
```

### 云函数处理

```javascript
async function getQuestionCoordinates(fileID, ocrOptions = {}) {
  // 构建OCR请求参数 (使用用户配置或默认值)
  const requestParams = {
    url: imageUrl,
    needRotate: true,
    cutType: ocrOptions.cutType || 'question',
    imageType: ocrOptions.imageType || 'photo',
    subject: ocrOptions.subject || 'PrimarySchool_English',
    outputOricoord: ocrOptions.outputOricoord !== false
  }

  const request = new AlibabaCloudOcr.RecognizeEduPaperStructedRequest(requestParams)
  // ...
}
```

---

## 📊 效果对比

### 使用默认配置 vs 优化配置

| 场景 | 默认配置 | 优化配置 | 改进 |
|------|---------|---------|------|
| 手机拍照小学英语试卷 | subject: 'English' | subject: 'PrimarySchool_English'<br>imageType: 'photo'<br>cutType: 'question' | ✅ 识别准确率提升 |
| 扫描件数学试卷 | 同上 | subject: 'HighSchool_Math'<br>imageType: 'scan' | ✅ 数学符号识别更准 |
| 密集排版练习题 | cutType: 未指定 | cutType: 'line' | ✅ 题目分割更准确 |

---

## 🔍 调试信息

云函数会打印OCR请求参数,方便调试:

```
OCR请求参数: {
  url: "https://...",
  needRotate: true,
  cutType: "question",
  imageType: "photo",
  subject: "PrimarySchool_English",
  outputOricoord: true
}
```

可以在云函数日志中查看这些参数,确认是否正确传递。

---

## ❓ 常见问题

### Q: 为什么要设置学科类型?
**A**: 不同学科有不同的专业术语和符号(如数学公式),正确的学科设置可以提高识别准确率。

### Q: "按题目切割"和"按行切割"有什么区别?
**A**:
- **按题目切割**: 识别完整的题目块,包括题干、选项等
- **按行切割**: 按文本行分割,适合行间距很小的材料

### Q: 配置会保存吗?
**A**: 当前配置在页面刷新后会重置为默认值。未来版本会支持配置保存。

### Q: 如果不知道该选什么配置?
**A**: 使用默认配置即可:
- 切割方式: 按题目切割
- 图片类型: 拍照图片
- 学科类型: 小学英语

---

## 🚀 未来优化方向

- [ ] 保存用户的常用配置
- [ ] 智能识别图片类型和学科
- [ ] 支持更多学科(物理、化学、生物等)
- [ ] 提供配置推荐系统

---

**更新时间**: 2025-10-27
**相关文件**:
- `cloudfunctions/ocrRecognize/index.js` - 云函数
- `miniprogram/pages/scan/scan.js` - 前端逻辑
- `miniprogram/pages/scan/scan.wxml` - 界面
- `miniprogram/pages/scan/scan.wxss` - 样式
