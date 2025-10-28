# OCR识别问题修复报告

## 问题概述

测试图片 `demo/test-2.png` 包含4道数学题，但OCR只识别出3道题目。

## 根本原因分析

### 1. 学科配置错误 ⚠️
- **问题**: 默认配置使用 `PrimarySchool_English`（小学英语）
- **影响**: test-2.png 是数学概率题，使用英语配置导致识别不准确
- **原因**: 阿里云OCR的学科参数会影响题目边界识别算法

### 2. 配置面板学科选择失效 🐛
- **问题**: WXML中 picker 绑定了错误的事件处理方法
- **现象**:
  - scan.wxml:31 使用 `bindchange="onSubjectChange"`
  - 但 scan.js:837 中有专门的 `onSubjectSelectChange` 方法
  - `onSubjectChange` 是题目编辑用的，不是配置面板用的
- **影响**: 用户在配置面板选择学科后，实际的 `ocrConfig.subject` 没有更新

### 3. Picker data属性传递问题 🐛
- **问题**: data属性设置在外层view上，picker无法访问
- **现象**: `currentTarget.dataset` 为空对象
- **影响**: 识别结果页面中的学科/难度/题型选择器无法工作

## 修复方案

### ✅ 修复1: 调整默认学科配置
**文件**: `miniprogram/pages/scan/scan.js`

```javascript
// 修改前
ocrConfig: {
  subject: 'PrimarySchool_English'  // ❌ 默认英语
}
subjectOptions: ['小学英语', '初中英语', ...] // ❌ 英语在前
subjectSelectIndex: 0  // ❌ 默认选第一个（小学英语）

// 修改后
ocrConfig: {
  subject: 'JuniorMiddleSchool_Math'  // ✅ 默认初中数学
}
subjectOptions: ['小学数学', '初中数学', '高中数学', '小学英语', ...] // ✅ 数学在前
subjectSelectIndex: 1  // ✅ 默认选初中数学
```

**原因**:
- 大部分错题本使用场景是数学题
- 初中数学覆盖范围广（概率、函数、几何等）
- test-2.png是概率题，适合初中数学配置

### ✅ 修复2: 修复配置面板学科选择
**文件**: `miniprogram/pages/scan/scan.wxml`

```xml
<!-- 修改前 -->
<picker bindchange="onSubjectChange">  <!-- ❌ 错误的方法 -->

<!-- 修改后 -->
<picker bindchange="onSubjectSelectChange">  <!-- ✅ 正确的方法 -->
```

**文件**: `miniprogram/pages/scan/scan.js`

```javascript
// onSubjectSelectChange 方法已存在，功能正确
onSubjectSelectChange(e) {
  const index = e.detail.value
  this.setData({
    subjectSelectIndex: index,
    'ocrConfig.subject': this.data.subjectValues[index]  // ✅ 正确更新配置
  })
}
```

### ✅ 修复3: 修复识别结果页面的picker
**文件**: `miniprogram/pages/scan/scan.wxml`

```xml
<!-- 修改前 -->
<view class="edit-section" data-id="{{item.id}}" data-itemindex="{{item.index}}">
  <picker bindchange="onSubjectChange">  <!-- ❌ data属性在外层 -->

<!-- 修改后 -->
<view class="edit-section">
  <picker
    bindchange="onSubjectChange"
    data-id="{{item.id}}"           <!-- ✅ data属性移到picker -->
    data-itemindex="{{index}}"       <!-- ✅ 使用正确的index -->
  >
```

同样修复了：
- 难度选择器 (scan.wxml:191-198)
- 题型选择器 (scan.wxml:209-216)

## 测试建议

### 测试用例1: 配置面板学科选择
1. 打开扫描页面
2. 点击"识别设置"展开配置面板
3. 修改"学科类型"为"高中数学"
4. 拍照识别
5. **期望**: 使用 `HighSchool_Math` 配置调用OCR

### 测试用例2: 识别结果编辑
1. 识别题目后进入编辑页面
2. 修改任意题目的"学科"、"难度"、"题型"
3. **期望**: 选择器正常工作，不再报错

### 测试用例3: test-2.png 识别
1. 使用默认配置（初中数学）
2. 上传 `demo/test-2.png`
3. **期望**: 识别出4道题目（如果还是3道，尝试切换为"按段落切割"）

## 进一步优化建议

### 1. 添加智能重试机制
```javascript
// 如果识别题目过少，自动尝试更细粒度的切割
if (coordinates.length < 2) {
  console.log('题目数量过少，尝试按段落切割')
  retryWithCutType('para')
}
```

### 2. 提供更多学科选项
目前只支持数学和英语，可以添加：
- 小学/初中/高中 语文
- 物理、化学、生物等

### 3. 图片预处理
对于手写标记较多的图片，可以考虑：
- 使用阿里云图像预处理API去除标记
- 或者在前端提示用户避免过多标记

## 修改文件清单

- ✅ `miniprogram/pages/scan/scan.js` (3处修改)
  - 默认学科配置改为初中数学
  - 学科选项顺序调整（数学在前）
  - 简化 onSubjectChange 方法逻辑

- ✅ `miniprogram/pages/scan/scan.wxml` (4处修改)
  - 配置面板学科选择器事件修复
  - 识别结果页面学科选择器data属性
  - 难度选择器data属性
  - 题型选择器data属性

## 预期效果

1. ✅ 配置面板学科选择正常工作
2. ✅ 识别结果编辑器选择器全部正常
3. ✅ 默认使用更合适的数学配置
4. ⏳ test-2.png 识别效果提升（需实际测试验证）

## 注意事项

⚠️ 如果 test-2.png 仍然只识别3道题，可能需要：
1. 在配置面板将"切割方式"改为"按段落切割"
2. 或者尝试"按块切割"
3. 检查题目之间是否有明显的空白分隔

这是阿里云OCR算法本身的特性，不同的排版需要不同的切割策略。
