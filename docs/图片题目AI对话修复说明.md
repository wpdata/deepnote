# 图片题目AI对话修复说明

## 问题描述
- DeepSeek 模型不支持图片输入
- 用户尝试与包含图片的题目进行 AI 对话时报错：
  ```
  Failed to load local image resource
  渲染层网络层错误
  ```

## 解决方案

### 智能模型选择逻辑
系统现在会根据题目特征自动选择最合适的 AI 模型：

1. **有图片的题目** → 使用 `qwen-vl-max` 视觉模型（支持图文理解）
2. **数学题（无图片）** → 使用 `qwen-math-turbo` 数学模型（专业数学能力）
3. **其他学科** → 使用 `deepseek-chat` 通用模型

### 修改的文件

#### 1. `cloudfunctions/callQwenVL/index.js`
增强了视觉模型云函数，支持两种调用模式：
- **简单模式**：传入 `imageUrl` + `prompt`（向后兼容）
- **高级模式**：传入完整的 `messages` 数组（支持多轮对话）

关键改进：
```javascript
// 新增参数支持
const {
  imageUrl,
  prompt,
  messages,  // 支持完整消息历史
  model = 'qwen-vl-max',
  maxTokens = 800,
  temperature = 0.7
} = event
```

#### 2. `cloudfunctions/chatWithAI/index.js`
增加了智能模型选择和图片处理逻辑：

**关键改进：**

a) **图片链接获取**
```javascript
// 检查是否有图片
const hasImage = !!error.imageUrl

// 获取图片临时访问链接
let imagePublicUrl = null
if (hasImage) {
  const tempFileResult = await cloud.getTempFileURL({
    fileList: [error.imageUrl]
  })
  imagePublicUrl = tempFileResult.fileList[0].tempFileURL
}
```

b) **智能模型选择**
```javascript
if (hasImage && imagePublicUrl) {
  // 有图片：使用视觉模型
  useQwenVL = true
  modelName = 'qwen-vl-max'
} else if (error.subject === '数学') {
  // 数学题（无图片）：使用数学模型
  useQwenMath = true
  modelName = 'qwen-math-turbo'
} else {
  // 其他学科：使用通用模型
  modelName = 'deepseek-chat'
}
```

c) **多模态消息构建**
```javascript
if (useQwenVL && imagePublicUrl) {
  // 视觉模型：包含图片的消息格式
  messages = [
    { role: 'system', content: systemPrompt },
    ...chatHistory,
    {
      role: 'user',
      content: [
        { type: 'image', image: imagePublicUrl },
        { type: 'text', text: userMessage }
      ]
    }
  ]
}
```

## 部署步骤

### 方法一：使用微信开发者工具（推荐）

1. 打开微信开发者工具
2. 开启服务端口：
   - 打开 **设置** → **安全设置**
   - 勾选 **服务端口**
3. 右键点击以下云函数文件夹，选择 **上传并部署：云端安装依赖**：
   - `cloudfunctions/callQwenVL/`
   - `cloudfunctions/chatWithAI/`

### 方法二：使用命令行（需要先开启服务端口）

```bash
/Applications/wechatwebdevtools.app/Contents/MacOS/cli cloud functions deploy \
  --env deepnote-3g0lr0fb3ce6ea1c \
  --names callQwenVL chatWithAI \
  --project /Users/pw/ai/DeepNote/deepnote
```

## 测试验证

1. **测试有图片的题目**
   - 进入一个包含图片的错题
   - 点击 AI 对话按钮
   - 发送消息："请帮我分析这道题"
   - ✅ 应该使用 `qwen-vl-max` 模型，能够理解图片内容

2. **测试数学题（无图片）**
   - 进入一个数学题（无图片）
   - 发送消息："这道题怎么做？"
   - ✅ 应该使用 `qwen-math-turbo` 模型

3. **测试其他学科**
   - 进入语文、英语等学科的题目
   - 发送消息
   - ✅ 应该使用 `deepseek-chat` 模型

## 日志验证

在云函数日志中可以看到：
- 有图片：`✓ 检测到图片，使用 qwen-vl-max 视觉模型`
- 数学题：`✓ 检测到数学题（无图片），使用 qwen-math-turbo 模型`
- 其他：`✓ 使用 deepseek-chat 通用模型`

## 技术细节

### Qwen-VL 模型特点
- **模型名称**：qwen-vl-max
- **能力**：图文理解、OCR、视觉问答
- **API 端点**：`/api/v1/services/aigc/multimodal-generation/generation`
- **消息格式**：
  ```json
  {
    "role": "user",
    "content": [
      { "image": "https://..." },
      { "text": "问题描述" }
    ]
  }
  ```

### 图片访问处理
- 云存储的图片需要转换为临时访问链接
- 使用 `cloud.getTempFileURL()` 获取可访问的 URL
- 临时链接有效期：2小时

### 成本优化
- 只在有图片时才使用视觉模型（成本较高）
- 数学题优先使用专业模型（准确度高）
- 其他场景使用通用模型（成本低）

## 预期效果

✅ **问题解决**：
- 有图片的题目可以正常进行 AI 对话
- 系统自动选择最合适的模型
- 用户无需关心模型选择

✅ **用户体验提升**：
- 视觉模型能理解图片中的题目内容
- 数学题获得更专业的解答
- 对话流畅，无报错

✅ **成本优化**：
- 按需使用高级模型
- 避免不必要的视觉模型调用

## 后续优化建议

1. **缓存优化**：缓存图片临时链接，避免重复获取
2. **错误重试**：视觉模型调用失败时，可以降级到文本模型
3. **模型池扩展**：支持更多专业模型（物理、化学等）
4. **流式输出**：支持 AI 回复的流式传输，提升体验
