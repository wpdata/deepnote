# 视觉模型智能解题功能配置指南

## 功能简介

本功能通过智能路由,根据题目类型和OCR质量自动选择最佳AI模型:
- **Qwen3-VL**: 处理几何题、图形题、英语连线题等需要视觉理解的复杂题目
- **Qwen-Math-Turbo**: 处理标准文字数学题(已在 ocrRecognize 中使用)
- **DeepSeek**: 处理其他学科的标准印刷题目(成本更低)

**智能复用**: 已配置的 `DASHSCOPE_API_KEY` 可同时用于 Qwen-Math 和 Qwen3-VL!

## 配置步骤

### 1. 获取 API Key

#### 阿里云 Qwen3-VL API Key
1. 访问: https://dashscope.aliyun.com/
2. 注册/登录阿里云账号
3. 开通 DashScope 服务
4. 在控制台创建 API Key
5. 记录 API Key (格式: `sk-xxx`)

#### DeepSeek API Key
1. 访问: https://platform.deepseek.com/
2. 注册/登录账号
3. 在 API Keys 页面创建新的 Key
4. 记录 API Key (格式: `sk-xxx`)

### 2. 配置云函数环境变量

**好消息**: `DASHSCOPE_API_KEY` 已经配置好了! ✅

只需要配置 DeepSeek API Key:

#### 方式一: 通过微信开发者工具
1. 打开微信开发者工具
2. 进入云开发控制台
3. 选择 "云函数"
4. 找到 `callDeepSeek` 函数
   - 点击 "配置"
   - 添加环境变量: `DEEPSEEK_API_KEY` = `你的API Key`

**注意**: `callQwenVL` 会自动使用已配置的 `DASHSCOPE_API_KEY`,无需额外配置!

#### 方式二: 通过腾讯云控制台
1. 登录腾讯云控制台
2. 进入 云开发 > 云函数
3. 选择对应的云函数
4. 在 "函数配置" > "环境变量" 中添加

### 3. 验证配置

部署完成后,可以通过以下方式测试:

```javascript
// 在云开发控制台测试 callQwenVL
{
  "imageUrl": "https://example.com/test-image.jpg",
  "prompt": "分析这道数学题"
}

// 测试 callDeepSeek
{
  "prompt": "这是一道语文题目"
}
```

## 工作原理

### 智能路由策略

```
扫描题目
  ↓
OCR识别 (如果是数学题,已用 qwen-math-turbo 分析)
  ↓
评估OCR质量
  ↓
┌─────────────────┐
│ OCR差? Yes      │ → Qwen3-VL (看图)
│ 或几何/连线题?  │
└─────────────────┘
         │ No
         ↓
┌─────────────────┐
│ 数学题 +        │ → qwen-math (已处理)
│ OCR好? Yes      │    + 生成摘要标签
└─────────────────┘
         │ No
         ↓
    其他学科 → DeepSeek (生成摘要标签)
```

**三种处理模式**:
1. **vision**: 需要看图 → Qwen3-VL (几何题/连线题/OCR差)
2. **math**: 数学文字题 → qwen-math-turbo (已在OCR阶段处理)
3. **fast**: 其他学科 → DeepSeek (快速便宜)

### OCR质量评估标准

- **high**: 文字完整,无乱码,长度>30,有效字符>70%
- **medium**: 文字基本完整,有效字符>50%
- **low**: 文字不完整,长度<15,或有乱码
- **none**: 无文字内容

## 成本优化

| 模型 | 单次调用成本 | 适用场景 |
|------|-------------|---------|
| **Qwen3-VL** | ~¥0.012 | 几何题、图形题、连线题 (约10%题目) |
| **qwen-math-turbo** | ~¥0.001 | 标准文字数学题 (已在OCR阶段处理) |
| **DeepSeek** | ~¥0.002 | 语文、英语等文字题 (约40%题目) |

**示例**: 假设 300 道题
- 30 道几何/连线题 → Qwen3-VL: ¥0.36
- 120 道标准数学题 → qwen-math (已处理): ¥0.12
- 150 道语文/英语题 → DeepSeek: ¥0.30
- **总计: ¥0.78/月** 💰 (比之前设计再省 ¥1.32!)

## 数据库新增字段

### errors 集合

```javascript
{
  // ... 原有字段

  // 新增字段
  questionSummary: string,     // 题目摘要(50字以内)
  questionTags: string[],      // 关键词标签(3-8个)
  ocrQuality: string,          // OCR质量: high/medium/low/none
  contentSource: string,       // 内容来源: vision/ocr/original
  isImageBased: boolean,       // 是否图片优先展示
  solvingSteps: string[],      // 解题步骤数组
  processingMode: string       // 实际处理模式: vision/fast/original
}
```

## 故障排查

### 1. Qwen3-VL 调用失败
- 检查 API Key 是否正确配置
- 检查阿里云账户余额是否充足
- 查看云函数日志

### 2. DeepSeek 调用失败
- 检查 API Key 是否正确配置
- 检查 DeepSeek 账户余额
- 查看云函数日志

### 3. 降级处理
当视觉模型调用失败时,系统会自动降级:
- 记录 `processingMode = 'fast-fallback'`
- 返回基础的题目摘要和标签
- 不影响错题保存功能

## 后续优化方向

1. **智能组卷**: 基于 `questionTags` 实现相似题目去重
2. **题目推荐**: 基于标签推荐相关错题
3. **知识图谱**: 构建知识点关联网络
4. **学习路径**: 个性化学习建议

## API 文档参考

- [阿里云 Qwen-VL 文档](https://help.aliyun.com/zh/dashscope/developer-reference/tongyi-qianwen-vl-api)
- [DeepSeek API 文档](https://api-docs.deepseek.com/)
