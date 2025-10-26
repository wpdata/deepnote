# 云函数说明文档

## 📋 已实现的云函数

### 核心功能云函数（已完成）

#### 1. ocrRecognize - OCR识别
**状态**: ⚠️ 使用模拟数据

**功能**: 识别图片中的文字内容

**输入参数**:
```javascript
{
  fileID: string  // 图片云存储ID
}
```

**返回结果**:
```javascript
{
  success: boolean,
  text: string,        // 识别的文本
  confidence: number,  // 置信度 0-1
  wordCount: number    // 字数
}
```

**TODO**:
- [ ] 集成腾讯云OCR API
- [ ] 添加图片格式验证
- [ ] 支持手写文字识别
- [ ] 支持公式识别

**集成腾讯云OCR步骤**:
1. 开通腾讯云OCR服务
2. 获取 SecretId 和 SecretKey
3. 安装 SDK: `npm install tencentcloud-sdk-nodejs`
4. 替换 `performOCR()` 函数中的模拟代码

---

#### 2. saveError - 保存错题
**状态**: ✅ 已完成

**功能**: 将错题保存到数据库，并更新统计信息

**输入参数**:
```javascript
{
  content: string,         // 题目内容（必填）
  subject: string,         // 学科（必填）
  knowledgePoint: string,  // 知识点（必填）
  imageUrl: string,        // 题目图片URL（可选）
  difficulty: string       // 难度：easy/medium/hard（可选）
}
```

**返回结果**:
```javascript
{
  success: boolean,
  errorId: string,  // 错题ID
  message: string
}
```

**功能说明**:
- 自动创建用户记录（如果不存在）
- 自动创建知识点统计（如果不存在）
- 自动更新用户统计和知识点统计
- 关联OCR识别记录

---

#### 3. getErrorDetail - 获取错题详情
**状态**: ⚠️ AI分析使用模拟数据

**功能**: 查询错题的完整信息

**输入参数**:
```javascript
{
  errorId: string  // 错题ID
}
```

**返回结果**:
```javascript
{
  success: boolean,
  error: {
    _id: string,
    content: string,
    subject: string,
    knowledgePoint: string,
    mastered: boolean,
    aiAnalysis: {
      errorReason: string,
      explanation: string,
      solution: string,
      warningTip: string
    },
    relatedKnowledge: string[],
    ...
  }
}
```

**TODO**:
- [ ] 集成AI大模型进行真实分析
- [ ] 支持批量查询

---

#### 4. updateErrorStatus - 更新掌握状态
**状态**: ✅ 已完成

**功能**: 标记错题为已掌握/未掌握

**输入参数**:
```javascript
{
  errorId: string,   // 错题ID
  mastered: boolean  // 是否已掌握
}
```

**返回结果**:
```javascript
{
  success: boolean,
  message: string
}
```

**功能说明**:
- 自动更新用户统计
- 自动更新知识点统计
- 自动计算掌握率

---

#### 5. generatePractice - 生成练习题
**状态**: ⚠️ 使用模拟题库

**功能**: 根据知识点生成练习题

**输入参数**:
```javascript
{
  knowledgePoint: string,  // 知识点
  subject: string,         // 学科
  count: number            // 题目数量（默认5）
}
```

**返回结果**:
```javascript
{
  success: boolean,
  questions: [
    {
      questionId: string,
      source: string,  // 'my_error' | 'mock'
      content: string,
      options: [
        { label: 'A', text: '...' },
        { label: 'B', text: '...' },
        ...
      ],
      correctAnswer: number,
      explanation: string,
      difficulty: string
    }
  ],
  count: number
}
```

**生成策略**:
1. 优先从用户自己的未掌握错题中选择
2. 不够时使用模拟题目
3. TODO: 从题库匹配相似题目
4. TODO: AI生成新题目

---

#### 6. getUserStats - 获取用户统计
**状态**: ✅ 已完成

**功能**: 查询用户的学习统计信息

**输入参数**: 无（自动从上下文获取openid）

**返回结果**:
```javascript
{
  success: boolean,
  stats: {
    studyDays: number,
    totalErrors: number,
    masteredErrors: number,
    needImprove: number,
    practiceCount: number,
    masteredRate: number,
    subjects: [
      {
        subject: string,
        totalErrors: number,
        masteredErrors: number,
        masteredRate: number
      }
    ],
    recentPractices: [...]
  }
}
```

---

## ⚠️ 模拟数据说明

### 当前使用模拟数据的部分

#### 1. OCR识别（ocrRecognize）
**现状**:
- 返回3个预设的模拟题目文本
- 随机返回置信度 0.95-0.99

**真实OCR需要**:
```javascript
// 需要集成腾讯云OCR API
const OcrClient = require('tencentcloud-sdk-nodejs').ocr.v20181119.Client

// 配置密钥
const client = new OcrClient({
  credential: {
    secretId: process.env.SECRET_ID,
    secretKey: process.env.SECRET_KEY
  },
  region: 'ap-shanghai'
})

// 调用通用文字识别
const response = await client.GeneralBasicOCR({
  ImageUrl: imageUrl
})
```

**所需成本**:
- 前1000次/月免费
- 超出后 0.15元/次

---

#### 2. AI错题分析（getErrorDetail）
**现状**:
- 使用预设的分析模板
- 根据知识点返回固定的分析内容

**真实AI分析需要**:
```javascript
// 需要集成腾讯混元大模型
// 构建Prompt并调用API
const prompt = `
你是一位专业的${subject}老师。请分析以下错题：
题目：${content}
学科：${subject}
知识点：${knowledgePoint}

请提供：
1. 错误原因分析
2. 知识点详细讲解
3. 解题思路和步骤
4. 易错提示
`
```

**所需成本**:
- 混元lite: 0.002元/千tokens
- 每次分析约500 tokens
- 约 0.001元/次

---

#### 3. 练习题生成（generatePractice）
**现状**:
- 优先使用用户自己的错题
- 不够时使用预设的3道模拟题

**完整方案需要**:
1. Web管理后台上传题库
2. 从题库中智能匹配
3. AI生成新题（可选）

---

## 🚀 部署说明

### 1. 安装依赖
```bash
cd cloudfunctions/ocrRecognize && npm install
cd ../saveError && npm install
cd ../getErrorDetail && npm install
cd ../updateErrorStatus && npm install
cd ../generatePractice && npm install
cd ../getUserStats && npm install
```

### 2. 部署云函数
```bash
# 使用微信开发者工具上传云函数
# 或使用命令行工具
```

### 3. 配置环境变量
后续集成真实服务时需要配置：
- OCR_SECRET_ID
- OCR_SECRET_KEY
- AI_API_KEY

---

## 📝 后续集成计划

### Phase 1: 集成真实OCR（优先级：高）
- [ ] 开通腾讯云OCR服务
- [ ] 配置密钥
- [ ] 修改 ocrRecognize 云函数
- [ ] 测试识别效果

### Phase 2: 开发题库系统（优先级：高）
- [ ] 创建 question_bank 集合
- [ ] 开发Web管理后台
- [ ] 实现题目上传和管理
- [ ] 修改 generatePractice 从题库匹配

### Phase 3: 集成AI分析（优先级：中）
- [ ] 开通混元大模型服务
- [ ] 设计Prompt模板
- [ ] 修改 getErrorDetail 调用AI
- [ ] 优化分析效果

### Phase 4: 优化和增强（优先级：低）
- [ ] 增加缓存机制
- [ ] 优化查询性能
- [ ] 添加错误重试
- [ ] 完善日志记录

---

## 🔗 相关文档

- [数据库设计](../DATABASE_DESIGN.md)
- [开发路线图](../ROADMAP.md)
- [项目总结](../PROJECT_SUMMARY.md)

---

**版本**: v0.2
**更新时间**: 2025-10-25
**状态**: 基础功能已完成，待集成真实服务
