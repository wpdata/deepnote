# 🎨 裁剪功能优化说明

## ✅ 已完成的优化

### 1. 增加裁剪边距 (避免题目被截断)

**问题**: 题目边缘被裁剪掉,内容不完整

**解决方案**: 在裁剪时增加 20 像素的边距

```javascript
// 增加边距,避免题目被截断
const padding = 20 // 像素
const left = Math.max(0, Math.min(...xs) - padding)
const top = Math.max(0, Math.min(...ys) - padding)
const right = Math.min(imageWidth, Math.max(...xs) + padding)
const bottom = Math.min(imageHeight, Math.max(...ys) + padding)
```

**效果**:
- ✅ 题目完整显示
- ✅ 包含题目周边的上下文
- ✅ 视觉效果更好

---

### 2. 优化题目预览卡片布局

**问题**: 题目编号和图片距离太远,不知道哪个图片对应哪个题目

**解决方案**: 重新设计卡片布局

#### 新的卡片结构:

```
┌─────────────────────────────┐
│ 题目 1              ✓      │  ← 顶部标题栏
├─────────────────────────────┤
│                             │
│    [题目裁剪图片]          │  ← 图片区域
│                             │
└─────────────────────────────┘
```

#### 样式优化:

1. **清晰的视觉层次**
   - 题目编号在顶部,与图片紧密相连
   - 使用分隔线区分标题和内容
   - 选中状态有明显的蓝色边框和阴影

2. **卡片式布局**
   ```css
   .question-item {
     background: #fff;
     border-radius: 16rpx;
     padding: 20rpx;
     box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.08);
     border: 3rpx solid transparent;
   }

   .question-item.selected {
     border-color: #1677FF;
     box-shadow: 0 4rpx 20rpx rgba(22, 119, 255, 0.2);
   }
   ```

3. **标题栏设计**
   ```css
   .question-header {
     display: flex;
     justify-content: space-between;
     align-items: center;
     margin-bottom: 12rpx;
     padding-bottom: 12rpx;
     border-bottom: 1rpx solid #f0f0f0;
   }
   ```

4. **图片容器**
   ```css
   .question-image-wrapper {
     width: 100%;
     background: #f8f8f8;
     border-radius: 12rpx;
     overflow: hidden;
   }
   ```

---

## 📊 优化前后对比

### 优化前
❌ 问题:
- 题目边缘被裁掉
- 题目编号和图片分离
- 不清楚哪个编号对应哪张图
- 布局松散,不紧凑

### 优化后
✅ 改进:
- ✅ 题目完整,有边距保护
- ✅ 题目编号在图片上方,紧密相连
- ✅ 卡片式布局,一目了然
- ✅ 选中状态清晰(蓝色边框+阴影)
- ✅ 布局紧凑,美观大方

---

## 🎯 用户体验提升

1. **更直观的题目识别**
   - 每个卡片=一个题目
   - 编号在顶部,立即知道是第几题

2. **更清晰的选择状态**
   - 未选中:灰色边框
   - 选中:蓝色边框+蓝色勾选标记
   - 视觉反馈明显

3. **更完整的题目内容**
   - 20像素边距保证题目不被截断
   - 包含题目周边的上下文信息

---

## 🔧 技术细节

### 裁剪边距计算

```javascript
// 原始坐标
const left_original = Math.min(...xs)
const top_original = Math.min(...ys)

// 增加边距 (确保不超出图片边界)
const padding = 20
const left = Math.max(0, left_original - padding)
const top = Math.max(0, top_original - padding)
const right = Math.min(imageWidth, right_original + padding)
const bottom = Math.min(imageHeight, bottom_original + padding)
```

### 响应式布局

- 使用 `flex` 布局确保在不同屏幕上都能正常显示
- `widthFix` 图片模式保持图片比例
- `scroll-view` 支持上下滚动查看所有题目

---

## 📝 使用说明

### 查看裁剪效果
1. 拍照或选择包含多题目的图片
2. 等待自动裁剪完成
3. 查看每个题目的预览卡片
4. 点击卡片可选择/取消选择

### 调整边距 (可选)
如果需要调整边距大小,修改 `scan.js` 中的 `padding` 值:

```javascript
// 在 cropSingleQuestion 函数中
const padding = 20  // 调整这个值 (单位:像素)
```

**建议值**:
- 15-20: 标准边距 (推荐)
- 30-40: 较大边距 (题目间距较大时)
- 10: 最小边距 (紧凑裁剪)

---

## 🚀 未来优化方向

- [ ] 支持用户手动调整裁剪区域
- [ ] 添加题目预览放大功能
- [ ] 支持批量调整所有题目的边距
- [ ] 添加裁剪质量选择 (快速/标准/高清)
- [ ] 支持题目重新排序

---

**更新时间**: 2025-10-27
**相关文件**:
- `miniprogram/pages/scan/scan.js` - 裁剪逻辑
- `miniprogram/pages/scan/scan.wxml` - 页面结构
- `miniprogram/pages/scan/scan.wxss` - 样式定义
