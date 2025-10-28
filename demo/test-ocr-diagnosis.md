# OCR识别问题诊断

## 问题现象
test-2.png 图片有4道题目，但OCR只识别出3道

## 图片分析
从图片观察到：
1. **题目类型**: 数学题（概率统计相关）
2. **排版特征**:
   - 题目1: 顶部，有红色圈选标记
   - 题目2: 中间，有手写答案和标记
   - 题目3: 中间偏下，有手写答案
   - 题目4: 底部，有手写答案
3. **干扰因素**:
   - 红色圈选标记
   - 手写答案
   - 题目间距不均匀

## 可能原因

### 1. 学科类型配置错误
**当前配置**: `subject: 'PrimarySchool_English'`
**实际学科**: 数学（概率统计）

阿里云OCR的学科参数会影响识别算法，使用错误的学科类型可能导致：
- 题目边界识别不准确
- 相邻题目被合并

### 2. 切割类型问题
**当前配置**: `cutType: 'question'`

对于手写标记较多的试卷，可能需要调整切割策略：
- `question` - 按题目切（默认）
- `para` - 按段落切（可能更适合复杂排版）
- `block` - 按块切（最细粒度）

### 3. 图片类型问题
**当前配置**: `imageType: 'photo'`

这张图片是试卷照片，配置正确。但如果是扫描件，应该改为 `scan`。

## 解决方案

### 方案1: 优化OCR配置（推荐）

修改 scan.js 中的默认配置：

```javascript
ocrConfig: {
  cutType: 'para',  // 改用段落切割，更适合复杂排版
  imageType: 'photo',
  subject: 'JuniorMath',  // 改为初中数学（根据题目难度判断）
  outputOricoord: true
}
```

### 方案2: 提供多种切割模式供用户选择

在配置面板增加更多选项：
```javascript
cutTypeOptions: ['按题切割', '按段落切割', '按块切割'],
subjectOptions: [
  '小学数学', '初中数学', '高中数学',
  '小学英语', '初中英语', '高中英语',
  // 更多学科...
]
```

### 方案3: 智能重试机制

如果识别出的题目数量明显偏少（如<2题），自动尝试不同的切割模式：

```javascript
// 伪代码
if (coordinates.length < 2) {
  console.log('题目数量过少，尝试使用更细粒度的切割')
  retry with cutType: 'para' or 'block'
}
```

## 建议的配置映射

| 学科类型 | 阿里云subject参数 |
|---------|------------------|
| 小学英语 | PrimarySchool_English |
| 初中英语 | JuniorMiddleSchool_English |
| 高中英语 | HighSchool_English |
| 小学数学 | PrimarySchool_Math |
| 初中数学 | JuniorMiddleSchool_Math |
| 高中数学 | HighSchool_Math |

## 下一步行动

1. ✅ 在OCR配置面板中将学科类型细化（区分年级和学科）
2. ✅ 添加更多切割类型选项
3. ✅ 测试不同配置组合的识别效果
4. ⏳ 如果问题依然存在，考虑使用阿里云的图像预处理API
