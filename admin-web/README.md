# 智能错题本 - Web管理后台

基于 React + Vite + Ant Design + CloudBase 的题库管理系统

## ✨ 功能特性

- 📊 数据概览：题库统计、学科分类、使用情况分析
- 📝 题库管理：题目CRUD、多条件筛选、批量操作
- ☁️  批量上传：支持图片/PDF/Word，OCR识别，自动入库
- 📈 统计分析：使用趋势、正确率分析（开发中）
- 🔐 登录认证：匿名登录（开发）、微信登录（生产）

## 🛠 技术栈

- React 19 + Vite 7
- Ant Design 5
- React Router v6
- CloudBase JS SDK

## 📦 快速开始

### 安装依赖

```bash
npm install
```

### 启动开发

```bash
npm run dev
```

访问: http://localhost:5173

### 构建生产

```bash
npm run build
```

## 🔧 配置说明

编辑 `cloudbase.config.js` 配置云开发环境ID:

```javascript
export const cloudbaseConfig = {
  env: 'deepnote-3g0lr0fb3ce6ea1c' // 你的环境ID
}
```

## 📁 项目结构

```
src/
├── layouts/        # 布局组件
├── pages/          # 页面组件
├── utils/          # 工具函数
└── App.jsx         # 根组件
```

## 🚀 部署

部署到云开发静态托管:

```bash
npm run build
tcb hosting deploy dist -e deepnote-3g0lr0fb3ce6ea1c
```

## 📄 相关文档

- [CloudBase文档](https://docs.cloudbase.net/)
- [Ant Design](https://ant.design/)
- [React Router](https://reactrouter.com/)

## 版本

v0.1 - 2025-10-27
