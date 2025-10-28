# Web管理后台开发指南

## 📋 项目概述

智能错题本Web管理后台是基于React+Vite+Ant Design开发的题库管理系统,主要用于管理员批量上传和管理题目。

### 技术选型

- **前端框架**: React 19 + Vite 7
- **UI库**: Ant Design 5
- **路由**: React Router v6
- **状态管理**: React Hooks
- **云服务**: CloudBase JS SDK
- **开发语言**: JavaScript/JSX

## 🎯 核心功能

### 1. 登录认证

**开发环境**:
- 使用匿名登录
- 无需额外配置
- 适合开发测试

**生产环境**:
- 微信扫码登录
- 需要配置微信公众平台
- 管理员权限控制

**实现代码**:
```javascript
// src/utils/cloudbase.js
export const anonymousLogin = async () => {
  await auth.anonymousAuthProvider().signIn()
}
```

### 2. 数据概览

**显示内容**:
- 题库总数
- 学科数量
- 累计使用次数
- 平均正确率

**数据来源**:
- question_bank 集合
- subjects 集合
- 实时计算统计

**关键代码**:
```javascript
// 获取题库总数
const questionsResult = await db.collection('question_bank').count()

// 获取学科数量
const subjectsResult = await db.collection('subjects').count()
```

### 3. 题库管理

**功能列表**:
- ✅ 题目列表展示
- ✅ 多条件筛选
- ✅ 题目详情编辑
- ✅ 题目删除
- ✅ 分页查询
- 🔄 批量操作（待开发）

**筛选条件**:
- 学科筛选
- 难度筛选
- 关键词搜索

**编辑字段**:
- 学科
- 知识点
- 难度
- 题目内容
- 题目解析

**关键代码**:
```javascript
// 分页查询
const res = await db.collection('question_bank')
  .skip((page - 1) * pageSize)
  .limit(pageSize)
  .orderBy('createTime', 'desc')
  .get()

// 更新题目
await db.collection('question_bank')
  .doc(id)
  .update(updateData)

// 删除题目
await db.collection('question_bank')
  .doc(id)
  .remove()
```

### 4. 批量上传

**支持格式**:
- 图片: PNG, JPG（最推荐）
- 文档: PDF, Word（部分支持）

**上传限制**:
- 单文件最大 10MB
- 支持批量上传
- 支持拖拽上传

**处理流程**:
1. 文件上传到云存储
2. 调用OCR云函数识别
3. 解析题目信息
4. 保存到question_bank
5. 显示处理结果

**关键代码**:
```javascript
// 上传文件
const uploadResult = await storage({
  cloudPath: fileName,
  filePath: file
})

// OCR识别
const ocrResult = await callFunction({
  name: 'ocrRecognize',
  data: { fileID: uploadResult.fileID }
})

// 保存题目
await db.collection('question_bank').add({
  data: questionData
})
```

## 🏗️ 项目结构

```
admin-web/
├── public/                    # 静态资源
├── src/
│   ├── layouts/              # 布局组件
│   │   └── MainLayout.jsx    # 主布局（侧边栏+头部）
│   ├── pages/                # 页面组件
│   │   ├── Login.jsx         # 登录页
│   │   ├── Dashboard.jsx     # 概览页
│   │   ├── Questions.jsx     # 题库管理页
│   │   └── Upload.jsx        # 批量上传页
│   ├── utils/                # 工具函数
│   │   └── cloudbase.js      # 云开发初始化
│   ├── App.jsx               # 根组件（路由配置）
│   ├── main.jsx              # 入口文件
│   └── index.css             # 全局样式
├── cloudbase.config.js       # 云开发配置
├── package.json              # 依赖配置
├── vite.config.js            # Vite配置
└── README.md                 # 项目说明
```

## 🔧 开发指南

### 本地开发

1. **安装依赖**:
```bash
cd admin-web
npm install
```

2. **配置环境**:
编辑 `cloudbase.config.js`:
```javascript
export const cloudbaseConfig = {
  env: 'deepnote-3g0lr0fb3ce6ea1c'
}
```

3. **启动开发服务器**:
```bash
npm run dev
```

4. **访问应用**:
```
http://localhost:5173
```

### 构建部署

1. **构建生产版本**:
```bash
npm run build
```

2. **部署到静态托管**:
```bash
# 方式1: 使用MCP工具
使用 uploadFiles 工具上传 dist 目录

# 方式2: 使用命令行
tcb hosting deploy dist -e deepnote-3g0lr0fb3ce6ea1c
```

3. **访问地址**:
```
https://deepnote-3g0lr0fb3ce6ea1c-1365273503.tcloudbaseapp.com
```

## 📊 数据库设计

### question_bank 集合

```javascript
{
  subject: "数学",              // 学科
  knowledgePoint: "二次函数",   // 知识点
  difficulty: "中等",           // 难度
  content: "题目内容...",       // 题目
  options: [                    // 选项
    { label: "A", text: "..." },
    { label: "B", text: "..." }
  ],
  correctAnswer: 1,             // 正确答案索引
  explanation: "解析...",       // 解析
  tags: ["函数", "图像"],       // 标签
  usedCount: 0,                 // 使用次数
  correctRate: 0,               // 正确率(%)
  sourceFile: "fileID",         // 来源文件
  sourceType: "upload",         // 来源类型
  createTime: Date,             // 创建时间
  updateTime: Date              // 更新时间
}
```

### 权限配置

```javascript
// question_bank: 所有人可读
{
  "read": true,
  "write": "auth.uid != null"
}
```

## 🔌 云开发集成

### 初始化配置

```javascript
// src/utils/cloudbase.js
import cloudbase from '@cloudbase/js-sdk'

const app = cloudbase.init({
  env: 'deepnote-3g0lr0fb3ce6ea1c'
})

export const auth = app.auth({ persistence: 'local' })
export const db = app.database()
export const storage = app.uploadFile.bind(app)
export const callFunction = app.callFunction.bind(app)
```

### 常用操作

**查询数据**:
```javascript
const res = await db.collection('question_bank')
  .where({ subject: '数学' })
  .limit(10)
  .get()
```

**添加数据**:
```javascript
await db.collection('question_bank').add({
  data: questionData
})
```

**更新数据**:
```javascript
await db.collection('question_bank')
  .doc(id)
  .update({ difficulty: '困难' })
```

**删除数据**:
```javascript
await db.collection('question_bank')
  .doc(id)
  .remove()
```

**上传文件**:
```javascript
const result = await storage({
  cloudPath: 'questions/image.jpg',
  filePath: file
})
```

**调用云函数**:
```javascript
const result = await callFunction({
  name: 'ocrRecognize',
  data: { fileID: 'xxx' }
})
```

## 🎨 UI组件

### 布局组件

**MainLayout.jsx**:
- 侧边栏导航
- 顶部Header
- 内容区域
- 响应式收缩

**特点**:
- 固定侧边栏
- 粘性Header
- 折叠菜单
- 用户菜单

### 页面组件

**Login.jsx** - 登录页:
- 卡片布局
- 渐变背景
- 匿名登录按钮

**Dashboard.jsx** - 概览页:
- 统计卡片
- 数据加载
- 快速操作

**Questions.jsx** - 题库管理:
- 筛选器
- 表格列表
- 编辑弹窗
- 删除确认

**Upload.jsx** - 批量上传:
- 拖拽上传
- 进度显示
- 结果反馈
- 说明文档

## 📝 开发规范

### 代码风格

- 使用ES6+语法
- 函数式组件 + Hooks
- JSX组件命名大驼峰
- 文件名与组件名一致

### 组件规范

```javascript
// 推荐写法
import { useState, useEffect } from 'react'

const MyComponent = () => {
  const [data, setData] = useState([])

  useEffect(() => {
    loadData()
  }, [])

  const loadData = async () => {
    // 加载数据
  }

  return (
    <div>
      {/* JSX */}
    </div>
  )
}

export default MyComponent
```

### 错误处理

```javascript
try {
  const result = await someAsyncOperation()
  message.success('操作成功')
} catch (error) {
  console.error('操作失败:', error)
  message.error('操作失败: ' + error.message)
}
```

## 🐛 常见问题

### 1. 无法连接云开发

**原因**: 环境ID配置错误

**解决**: 检查 `cloudbase.config.js` 中的 env 配置

### 2. 登录失败

**原因**: 未开启匿名登录

**解决**:
- 云开发控制台 > 登录授权
- 开启匿名登录功能

### 3. 上传失败

**原因**:
- 云存储权限问题
- OCR云函数未部署
- 文件格式不支持

**解决**:
- 检查存储权限配置
- 确认OCR云函数正常
- 使用支持的文件格式

### 4. 题目列表为空

**原因**: question_bank 集合无数据

**解决**: 使用初始化脚本插入测试数据

### 5. CDN缓存问题

**原因**: 静态托管CDN有缓存

**解决**:
- 等待几分钟
- 或清除浏览器缓存
- 或使用带时间戳的URL

## 🚀 后续优化

### 功能优化
- [ ] 题目标签管理
- [ ] 题目导入/导出
- [ ] 题目版本历史
- [ ] AI自动分类
- [ ] 题目批量编辑
- [ ] 权限管理系统

### 性能优化
- [ ] 虚拟滚动
- [ ] 图片懒加载
- [ ] 请求防抖
- [ ] 数据缓存

### 体验优化
- [ ] 加载骨架屏
- [ ] 错误边界
- [ ] 离线提示
- [ ] 快捷键支持

## 📚 参考资料

- [CloudBase Web SDK](https://docs.cloudbase.net/api-reference/web/initialization)
- [Ant Design 组件](https://ant.design/components/overview-cn)
- [React Router v6](https://reactrouter.com/docs/en/v6)
- [Vite 配置](https://vitejs.dev/config/)

## 版本历史

### v0.1 (2025-10-27)
- ✅ 项目初始化
- ✅ 登录认证
- ✅ 数据概览
- ✅ 题库管理
- ✅ 批量上传

## 贡献指南

欢迎提交Issue和Pull Request!

## 许可证

MIT License
