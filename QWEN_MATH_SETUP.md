# 通义千问-Math-Turbo 集成配置

## 🎯 切换原因

用户建议：
> "如果是数学解题的话可以试试让通义千问-Math-Turbo来解答试试，然后其他的学科还保持原来的模型。"

**优势：**
- ✅ 阿里专门优化的数学模型
- ✅ 支持中文数学题（DeepSeek-R1偏向英文）
- ✅ TIR（Tool Integrated Reasoning）能力
- ✅ 在Qwen2.5-Math-72B基础上优化的轻量版本

## 📋 配置步骤

### 1. 获取通义千问 API Key

#### 方法1: 阿里云官网
1. 登录 [阿里云控制台](https://dashscope.console.aliyun.com/)
2. 进入"模型服务灵积（DashScope）"
3. 点击"API-KEY管理"
4. 创建新的API Key
5. 复制API Key（格式：sk-xxxxx）

#### 方法2: 百炼平台
1. 登录 [百炼平台](https://bailian.console.aliyun.com/)
2. 进入"API Key管理"
3. 创建并复制API Key

### 2. 配置云函数环境变量

#### 通过腾讯云控制台配置

1. 登录腾讯云控制台
2. 进入"云开发" → "云函数"
3. 选择 `ocrRecognize` 函数
4. 点击"函数配置" → "编辑"
5. 找到"环境变量"部分
6. 添加新的环境变量：
   ```
   键: DASHSCOPE_API_KEY
   值: sk-xxxxxxxxxxxxxxxxx  (你的通义千问API Key)
   ```
7. 点击"保存"

#### 验证配置

在云函数日志中应该看到：
```
✅ 通义千问客户端初始化成功
```

如果API Key未配置，会看到错误：
```
❌ 通义千问-Math-Turbo计算失败: API Key未配置
```

## 🔧 代码修改

### 1. 初始化客户端 (index.js:17-21)

```javascript
// 初始化通义千问客户端（用于数学题）
const qwen = new OpenAI({
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  apiKey: process.env.DASHSCOPE_API_KEY
})
```

### 2. 数学答案计算 (index.js:972-1016)

```javascript
async function calculateMathAnswer(formattedText) {
  console.log('===== 使用通义千问-Math-Turbo计算数学答案 =====')

  const completion = await qwen.chat.completions.create({
    model: 'qwen-math-turbo',  // 关键：使用数学专用模型
    messages: [
      {
        role: 'system',
        content: 'Please reason step by step, and put your final answer within \\boxed{}.'
      },
      {
        role: 'user',
        content: `请计算这道数学题的正确答案:\n\n${formattedText}\n\n请将最终答案放在 \\boxed{} 中。`
      }
    ],
    temperature: 0.1
  })

  // 提取 \boxed{} 中的答案
  const boxedMatch = answer.match(/\\boxed\{([^}]+)\}/)
  if (boxedMatch) {
    cleanAnswer = boxedMatch[1].trim()
  }

  return cleanAnswer
}
```

### 3. 模型分工策略

```
学科类型             使用模型
─────────────────────────────────────
数学题              → qwen-math-turbo
物理/化学/英语等     → deepseek-chat
题目分析/格式化      → deepseek-chat
```

## 📊 通义千问-Math-Turbo 特点

### 1. 答案格式

通义千问使用 LaTeX 的 `\boxed{}` 格式标记最终答案：

```
输入: "计算 2+3×4"
输出: "根据运算顺序，先算乘法...因此答案是 \boxed{14}"
       ^^^^^^^^
       从这里提取答案
```

### 2. System Prompt

官方推荐的system prompt：
```
"Please reason step by step, and put your final answer within \\boxed{}."
```

这会让模型：
- 逐步推理（提高准确性）
- 将最终答案放在 `\boxed{}` 中（方便提取）

### 3. 适用题型

| 题型 | 适用性 | 说明 |
|------|--------|------|
| 算术计算 | ⭐⭐⭐⭐⭐ | 非常准确 |
| 代数方程 | ⭐⭐⭐⭐⭐ | 擅长符号运算 |
| 几何问题 | ⭐⭐⭐⭐ | 支持几何推理 |
| 概率统计 | ⭐⭐⭐⭐⭐ | 计算精确 |
| 微积分 | ⭐⭐⭐⭐ | 支持基础微积分 |
| 应用题 | ⭐⭐⭐⭐ | 理解中文题意 |

### 4. 中文支持

通义千问对**中文数学题**支持更好：
- ✅ 理解中文数学术语
- ✅ 识别中文单位（厘米、千克等）
- ✅ 处理中文表述的应用题

## 🆚 模型对比

### DeepSeek-R1 vs Qwen-Math-Turbo

| 维度 | DeepSeek-R1 | Qwen-Math-Turbo |
|------|-------------|-----------------|
| 参数规模 | 671B (MoE) | 基于72B优化 |
| 中文支持 | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| 英文支持 | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ |
| 数学准确率 | 很高 | 很高 |
| 响应速度 | 较慢 (2-5秒) | 快 (1-3秒) |
| API成本 | 中 | 中 |
| 推理过程 | CoT详细 | Step-by-step |
| 答案格式 | 自由文本 | \boxed{} |

**选择Qwen-Math-Turbo的原因：**
1. 🇨🇳 中文数学题支持更好（错题本主要是中文）
2. ⚡ 响应速度更快
3. 📦 答案格式更规范（\boxed{}）
4. 🎯 专门为数学优化

## 🧪 测试用例

### 测试1: 简单算术（中文）
```
输入: "小明有15个苹果，吃了3个，又买了8个，现在有多少个？"
期望: "20" 或 "20个"
```

### 测试2: 分数运算
```
输入: "计算：(2/3 + 1/4) × 12"
期望: "11"
```

### 测试3: 方程求解
```
输入: "解方程：3x + 7 = 22"
期望: "5" 或 "x=5"
```

### 测试4: 几何问题
```
输入: "一个长方形的长是8cm，宽是5cm，求面积"
期望: "40" 或 "40cm²"
```

### 测试5: 概率题
```
输入: "从1到10的数字中随机选一个，选到偶数的概率是多少？"
期望: "1/2" 或 "0.5" 或 "50%"
```

## 🔍 日志监控

### 成功日志

```
===== 使用通义千问-Math-Turbo计算数学答案 =====
通义千问原始返回: 先计算括号内...因此答案是 \boxed{11}
从\boxed{}提取答案: 11
通义千问-Math-Turbo返回答案: 11
```

### 错误日志

```
❌ 通义千问-Math-Turbo计算失败: Error: Invalid API key
→ 检查 DASHSCOPE_API_KEY 是否配置
```

```
❌ 通义千问-Math-Turbo计算失败: Error: Rate limit exceeded
→ API调用超过限额，等待或升级套餐
```

## 💰 成本对比

### API定价

| 服务 | 输入价格 | 输出价格 | 每题成本估算 |
|------|---------|---------|-------------|
| DeepSeek-chat | $0.27/M | $1.10/M | $0.0005 |
| DeepSeek-R1 | $0.55/M | $2.19/M | $0.002 |
| Qwen-Math-Turbo | 约$0.50/M | 约$2.00/M | $0.0015 |

**说明：**
- Qwen-Math-Turbo 成本居中
- 仅在数学题需要时调用（其他题型仍用DeepSeek-chat）
- 预计额外成本增加 < 15%

## ⚠️ 注意事项

### 1. API Key 管理
- 不要将API Key硬编码在代码中
- 使用环境变量存储
- 定期轮换API Key

### 2. 错误处理
```javascript
try {
  const answer = await calculateMathAnswer(text)
  if (answer) {
    return answer
  }
} catch (error) {
  console.error('通义千问计算失败，使用默认逻辑')
  // 降级到 deepseek-chat 或返回空
}
```

### 3. 限流处理
- 通义千问有API调用频率限制
- 需要合理控制调用频率
- 可以添加重试逻辑

### 4. 答案验证
```javascript
// 可选：验证答案合理性
if (isNaN(answer) && !isValidMathExpression(answer)) {
  console.warn('答案格式异常:', answer)
}
```

## 🚀 部署步骤

1. ✅ 代码已修改（使用qwen-math-turbo）
2. ⏳ 配置 DASHSCOPE_API_KEY 环境变量
3. ⏳ 部署云函数
4. ⏳ 测试数学题识别

## 📚 相关资源

- [通义千问数学模型文档](https://help.aliyun.com/zh/model-studio/math-language-model)
- [DashScope API文档](https://help.aliyun.com/zh/dashscope/)
- [OpenAI兼容接口说明](https://help.aliyun.com/zh/model-studio/compatibility-of-openai-with-dashscope)

## 📝 下一步

1. 获取通义千问 API Key
2. 在云函数配置环境变量 `DASHSCOPE_API_KEY`
3. 部署更新后的云函数
4. 测试数学题计算效果
