# 智能错题整理小程序 - 数据库设计

## 数据库概述

**环境ID**: deepnote-3g0lr0fb3ce6ea1c
**数据库类型**: 云开发数据库（文档型数据库）
**地域**: 华东-上海 (ap-shanghai)

## 📊 数据集合设计

### 1. users - 用户信息集合

存储用户基本信息和学习统计数据。

```javascript
{
  _id: "auto_generated_id",           // 自动生成的文档ID
  _openid: "user_openid",             // 微信用户OpenID（自动获取）
  nickName: "学生姓名",                // 用户昵称
  avatarUrl: "https://...",           // 用户头像URL
  studyDays: 15,                      // 学习天数
  totalErrors: 120,                   // 错题总数
  masteredErrors: 85,                 // 已掌握错题数
  practiceCount: 45,                  // 练习次数
  createTime: Date,                   // 创建时间
  updateTime: Date                    // 更新时间
}
```

**索引**:
- `_openid` (唯一索引)

---

### 2. errors - 错题集合

存储用户的所有错题信息。

```javascript
{
  _id: "auto_generated_id",           // 自动生成的文档ID
  _openid: "user_openid",             // 用户OpenID

  // 题目基本信息
  subject: "数学",                     // 学科
  knowledgePoint: "函数与方程",        // 知识点
  difficulty: "medium",                // 难度：easy/medium/hard

  // 题目内容
  content: "题目内容...",              // 题目文字内容
  imageUrl: "cloud://...",            // 题目图片（云存储路径）
  answer: "正确答案",                  // 正确答案

  // 状态信息
  mastered: false,                    // 是否已掌握
  masteredTime: Date,                 // 掌握时间
  practiceCount: 3,                   // 练习次数
  correctCount: 2,                    // 答对次数
  wrongCount: 1,                      // 答错次数
  lastPracticeTime: Date,             // 最后练习时间

  // AI分析结果
  aiAnalysis: {
    errorReason: "错误原因分析",
    explanation: "知识点讲解",
    solution: "解题思路",
    warningTip: "易错提示"
  },

  // 相关知识点
  relatedKnowledge: ["二次函数", "因式分解"],

  // 时间戳
  createTime: Date,                   // 创建时间
  updateTime: Date                    // 更新时间
}
```

**索引**:
- `_openid` + `subject` (复合索引)
- `_openid` + `knowledgePoint` (复合索引)
- `_openid` + `mastered` (复合索引)
- `createTime` (降序索引)

---

### 3. subjects - 学科信息集合

存储学科基本信息和配置。

```javascript
{
  _id: "auto_generated_id",           // 自动生成的文档ID
  subjectId: "math",                  // 学科唯一标识
  name: "数学",                        // 学科名称
  icon: "cloud://...",                // 学科图标
  bgColor: "#FFFFFF",                 // 背景颜色
  order: 1,                           // 排序顺序
  isActive: true,                     // 是否启用

  // 知识点列表
  knowledgePoints: [
    {
      id: "func_equation",
      name: "函数与方程",
      description: "函数零点、方程求解等"
    },
    {
      id: "trigonometric",
      name: "三角函数",
      description: "三角函数的性质和应用"
    }
  ],

  createTime: Date,
  updateTime: Date
}
```

**索引**:
- `subjectId` (唯一索引)
- `order` (升序索引)

---

### 4. practices - 练习记录集合

存储用户的练习历史记录。

```javascript
{
  _id: "auto_generated_id",           // 自动生成的文档ID
  _openid: "user_openid",             // 用户OpenID

  // 练习信息
  type: "knowledge",                  // 练习类型：knowledge/random
  subject: "数学",                     // 学科
  knowledgePoint: "函数与方程",        // 知识点（type=knowledge时必填）

  // 练习题目
  questions: [
    {
      questionId: "error_id_1",       // 关联的错题ID
      userAnswer: 1,                  // 用户答案索引
      correctAnswer: 1,               // 正确答案索引
      isCorrect: true,                // 是否正确
      timeSpent: 45                   // 答题耗时（秒）
    }
  ],

  // 统计数据
  totalQuestions: 3,                  // 总题数
  correctCount: 2,                    // 答对数
  wrongCount: 1,                      // 答错数
  correctRate: 67,                    // 正确率（%）
  totalTime: 180,                     // 总耗时（秒）

  // 时间戳
  startTime: Date,                    // 开始时间
  endTime: Date,                      // 结束时间
  createTime: Date                    // 创建时间
}
```

**索引**:
- `_openid` + `type` (复合索引)
- `_openid` + `subject` (复合索引)
- `createTime` (降序索引)

---

### 5. knowledge_stats - 知识点统计集合

存储每个用户在各知识点的掌握情况统计。

```javascript
{
  _id: "auto_generated_id",           // 自动生成的文档ID
  _openid: "user_openid",             // 用户OpenID

  subject: "数学",                     // 学科
  knowledgePoint: "函数与方程",        // 知识点

  // 统计数据
  totalErrors: 15,                    // 该知识点错题总数
  masteredErrors: 9,                  // 已掌握错题数
  masteredRate: 60,                   // 掌握率（%）

  practiceCount: 12,                  // 练习次数
  correctCount: 8,                    // 答对次数
  wrongCount: 4,                      // 答错次数

  lastPracticeTime: Date,             // 最后练习时间

  createTime: Date,
  updateTime: Date
}
```

**索引**:
- `_openid` + `subject` + `knowledgePoint` (复合唯一索引)
- `_openid` + `masteredRate` (复合索引)

---

### 6. ocr_records - OCR识别记录集合

存储OCR识别的历史记录（用于优化和统计）。

```javascript
{
  _id: "auto_generated_id",           // 自动生成的文档ID
  _openid: "user_openid",             // 用户OpenID

  // 图片信息
  imageUrl: "cloud://...",            // 原始图片URL
  imageSize: 1024000,                 // 图片大小（字节）

  // 识别结果
  recognizedText: "识别的文字...",     // 识别结果
  confidence: 0.95,                   // 置信度

  // 是否采纳
  isAdopted: true,                    // 是否被用户采纳添加到错题本
  errorId: "error_id",                // 关联的错题ID（如果被采纳）

  // OCR服务信息
  ocrService: "tencent_cloud",        // OCR服务提供商
  costTime: 1500,                     // 识别耗时（毫秒）

  createTime: Date
}
```

**索引**:
- `_openid` (索引)
- `createTime` (降序索引)

---

## 🔐 数据库权限规则

### 权限策略

1. **users 集合** - 仅创建者可读写
   - 用户只能读写自己的数据
   - 规则：`doc._openid == auth.openid`

2. **errors 集合** - 仅创建者可读写
   - 用户只能管理自己的错题
   - 规则：`doc._openid == auth.openid`

3. **subjects 集合** - 所有人可读，仅管理员可写
   - 学科信息对所有用户可见
   - 规则：读权限为 `true`，写权限为 `false`

4. **practices 集合** - 仅创建者可读写
   - 用户只能查看自己的练习记录
   - 规则：`doc._openid == auth.openid`

5. **knowledge_stats 集合** - 仅创建者可读写
   - 用户只能查看自己的统计数据
   - 规则：`doc._openid == auth.openid`

6. **ocr_records 集合** - 仅创建者可读写
   - 用户只能查看自己的识别记录
   - 规则：`doc._openid == auth.openid`

---

## 📈 数据查询优化

### 常用查询

1. **首页数据查询**
```javascript
// 获取用户统计
db.collection('users').where({
  _openid: '{openid}'
}).get()

// 获取各学科错题统计
db.collection('knowledge_stats').where({
  _openid: '{openid}'
}).get()
```

2. **错题本查询**
```javascript
// 按学科查询错题
db.collection('errors').where({
  _openid: '{openid}',
  subject: '数学'
}).orderBy('createTime', 'desc').get()

// 按知识点查询
db.collection('errors').where({
  _openid: '{openid}',
  knowledgePoint: '函数与方程'
}).get()
```

3. **练习题目生成**
```javascript
// 获取未掌握的错题
db.collection('errors').where({
  _openid: '{openid}',
  knowledgePoint: '函数与方程',
  mastered: false
}).limit(5).get()
```

---

## 🚀 实施计划

1. ✅ 设计数据库结构
2. ⏳ 创建数据集合
3. ⏳ 配置权限规则
4. ⏳ 初始化学科数据
5. ⏳ 测试数据CRUD操作

---

**设计版本**: v1.0
**设计日期**: 2025-10-25
