# 📊 阿里云OCR API数据格式说明

## 🔍 发现的问题

之前代码使用了错误的数据结构 `doc_layout`,而阿里云OCR API实际返回的是 `page_list` → `subject_list` 结构。

## 📝 正确的数据结构

### API返回格式

```json
{
  "algo_version": "...",
  "page_list": [
    {
      "angle": 1,
      "doc_index": 1,
      "height": 2271,        // 图片高度
      "orgHeight": 1880,     // 原始高度
      "orgWidth": 1484,      // 原始宽度
      "width": 1570,         // 图片宽度
      "page_id": 0,
      "subject_list": [      // ⭐ 题目列表
        {
          "content_list_info": [
            {
              "doc_index": 1,
              "pos": [          // ⭐ 题目坐标 (四个角的坐标)
                {"x": 280, "y": 39},
                {"x": 1303, "y": 11},
                {"x": 1356, "y": 899},
                {"x": 303, "y": 892}
              ]
            }
          ],
          "text": "1 Look and complete. hospital theatre...",  // ⭐ 题目文本
          "prism_wordsInfo": [...]  // 详细的文字识别信息
        }
      ]
    }
  ]
}
```

### 关键字段说明

| 字段路径 | 说明 | 用途 |
|---------|------|------|
| `page_list` | 页面列表 | 支持多页文档 |
| `page_list[0].width` / `height` | 图片尺寸 | 用于计算裁剪区域 |
| `page_list[0].subject_list` | **题目列表** | 每个元素代表一个题目 |
| `subject.content_list_info[0].pos` | **题目坐标** | 四个角的坐标点 |
| `subject.text` | **题目文本** | OCR识别的完整文本 |
| `subject.prism_wordsInfo` | 详细文字信息 | 每个词的坐标和内容 |

## 🔧 代码修复

### 修复前 (错误)

```javascript
const ocrData = JSON.parse(response.body.data)

// ❌ 错误: doc_layout 字段不存在
return {
  success: true,
  imageUrl: imageUrl,
  coordinates: ocrData.doc_layout || [],  // undefined!
  imageWidth: ocrData.width,
  imageHeight: ocrData.height
}
```

### 修复后 (正确)

```javascript
const ocrData = JSON.parse(response.body.data)

// ✅ 正确: 从 page_list → subject_list 中提取
let coordinates = []
let imageWidth = 0
let imageHeight = 0

if (ocrData.page_list && ocrData.page_list.length > 0) {
  const firstPage = ocrData.page_list[0]
  imageWidth = firstPage.width || firstPage.orgWidth || 0
  imageHeight = firstPage.height || firstPage.orgHeight || 0

  // 从 subject_list 中提取每个题目的坐标
  if (firstPage.subject_list && Array.isArray(firstPage.subject_list)) {
    coordinates = firstPage.subject_list.map(subject => {
      if (subject.content_list_info && subject.content_list_info.length > 0) {
        return {
          pos: subject.content_list_info[0].pos,  // 题目坐标
          text: subject.text || ''                // 题目文本
        }
      }
      return null
    }).filter(item => item !== null)
  }
}

return {
  success: true,
  imageUrl: imageUrl,
  coordinates: coordinates,      // ✅ 正确提取
  imageWidth: imageWidth,
  imageHeight: imageHeight
}
```

## 📊 数据示例

根据你提供的API测试结果,一个包含4个题目的试卷会返回:

```javascript
coordinates = [
  {
    pos: [
      {x: 280, y: 39},
      {x: 1303, y: 11},
      {x: 1356, y: 899},
      {x: 303, y: 892}
    ],
    text: "1 Look and complete. hospital theatre plane studio office..."
  },
  {
    pos: [
      {x: 288, y: 1041},
      {x: 1104, y: 1057},
      {x: 1110, y: 1249},
      {x: 280, y: 1228}
    ],
    text: "( B ) 1. Mary， do you want to be?..."
  },
  {
    pos: [
      {x: 272, y: 1244},
      {x: 1153, y: 1264},
      {x: 1157, y: 1528},
      {x: 260, y: 1505}
    ],
    text: "D ) 2.Do you want to a nurse?..."
  },
  {
    pos: [
      {x: 231, y: 1534},
      {x: 1458, y: 1555},
      {x: 1473, y: 1827},
      {x: 222, y: 1808}
    ],
    text: "(P ) 3.does your uncle want to work?..."
  }
]

imageWidth = 1570
imageHeight = 2271
```

## 🎯 优化建议

### 1. 利用已识别的文本

现在我们不仅获得了坐标,还获得了每个题目的识别文本。可以在预览时显示:

```javascript
// 在 showCropPreview 中
const questions = coordinates.map((coord, index) => ({
  id: `q${index + 1}`,
  index: index,
  selected: true,
  coordinates: coord.pos,
  text: coord.text,           // ⭐ 新增: 识别的文本
  croppedImage: null
}))
```

### 2. 跳过已识别的题目

如果某个题目的文本已经很准确,可以直接使用,不需要再次识别:

```javascript
// 在确认识别时
for (let i = 0; i < selected.length; i++) {
  const question = selected[i]

  if (question.text && question.text.length > 10) {
    // 文本已经识别出来,直接使用
    formatted.push({
      formattedText: question.text,
      rawText: question.text
    })
  } else {
    // 文本不完整,重新识别
    const recognizeRes = await wx.cloud.callFunction({...})
  }
}
```

## 🐛 常见问题

### Q: 为什么之前没发现这个问题?

**A**: 因为代码中使用了 `|| []` 作为默认值:
```javascript
coordinates: ocrData.doc_layout || []
```
这导致当 `doc_layout` 不存在时返回空数组,没有报错,但也没有题目。

### Q: `width` 和 `orgWidth` 有什么区别?

**A**:
- `orgWidth` / `orgHeight`: 原始图片尺寸
- `width` / `height`: 可能经过旋转或调整后的尺寸
- 建议优先使用 `width` / `height`,如果不存在再用 `orgWidth` / `orgHeight`

### Q: 为什么有时候识别不出题目?

**A**: 可能的原因:
1. ❌ 配置参数不正确 (现在已修复为推荐配置)
2. ❌ 图片质量太差 (模糊、光照不足)
3. ❌ 试卷布局复杂 (尝试调整 `cutType` 参数)

## ✅ 验证方法

查看云函数日志,应该能看到:

```
OCR原始数据结构: {
  hasPageList: true,
  pageCount: 1
}

解析后坐标数据: {
  coordinatesCount: 4,
  imageWidth: 1570,
  imageHeight: 2271
}
```

如果 `coordinatesCount > 0`,说明解析成功!

---

**更新时间**: 2025-10-27
**修复版本**: v1.1
**相关文件**: `cloudfunctions/ocrRecognize/index.js`
