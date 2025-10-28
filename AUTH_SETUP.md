# 🔐 DeepNote 认证系统设置指南

## 📋 概述

DeepNote 使用双认证系统：
- **小程序端**：微信自动登录（静默获取 openId）
- **后台管理**：邮箱+密码登录

## 🚀 快速开始

### 1. 注册首个管理员账号

首次部署后，需要创建管理员账号才能登录后台。

#### 方法一：使用注册脚本（推荐）

```bash
# 安装依赖
npm install

# 运行注册脚本（交互式）
npm run register-admin

# 或直接传参
node scripts/register-admin.js admin@example.com your_password
```

#### 方法二：使用云开发控制台

1. 打开云开发控制台
2. 进入云函数管理
3. 找到 `adminLogin` 函数
4. 点击"测试"，输入以下参数：

```json
{
  "email": "admin@example.com",
  "password": "your_password",
  "action": "register"
}
```

5. 点击执行，注册成功

### 2. 登录后台管理

1. 访问后台管理地址
2. 输入注册的邮箱和密码
3. 点击登录

## 🏗️ 认证架构

### 小程序端认证流程

```
用户打开小程序
    ↓
自动调用 wx.cloud.callFunction('wxLogin')
    ↓
云函数获取 openId
    ↓
查询/创建 users 表记录
    ↓
返回 userId 存储到本地
    ↓
后续请求自动带上 userId
```

**代码示例：**
```javascript
// miniprogram/app.js
const app = getApp()
const userId = app.getUserId() // 获取当前用户ID
```

### 后台管理认证流程

```
输入邮箱+密码
    ↓
调用云函数 adminLogin
    ↓
验证邮箱密码（SHA256加密）
    ↓
检查 role === 'admin'
    ↓
返回 token 存储到 localStorage
    ↓
后续请求带上 token
```

**代码示例：**
```javascript
// admin-web/src/utils/cloudbase.js
import { adminLogin, getCurrentAdmin } from './cloudbase'

// 登录
const result = await adminLogin('admin@example.com', 'password')

// 获取当前管理员信息
const admin = getCurrentAdmin()
```

## 🗄️ 数据库权限规则

| 集合名 | 读权限 | 写权限 | 说明 |
|--------|--------|--------|------|
| errors | `doc.userId == auth.openid` | `doc.userId == auth.openid` | 用户只能操作自己的错题 |
| practices | `doc.userId == auth.openid` | `doc.userId == auth.openid` | 用户只能操作自己的练习记录 |
| knowledge_stats | `doc.userId == auth.openid` | `doc.userId == auth.openid` | 用户只能查看自己的统计 |
| ocr_records | `doc.userId == auth.openid` | `doc.userId == auth.openid` | 用户只能查看自己的OCR记录 |
| subjects | 所有人可读 | 管理员可写 | 学科信息全局共享 |
| users | 仅自己可读写 | 仅自己可读写 | 用户信息隔离 |

## 🔧 云函数说明

### wxLogin - 微信登录
- **作用**：处理小程序微信登录
- **输入**：无（自动获取 openId）
- **输出**：userId, isNewUser

### adminLogin - 管理员登录/注册
- **作用**：管理员邮箱登录或注册
- **输入**：
  - `email`: 邮箱
  - `password`: 密码
  - `action`: 'login' | 'register'
- **输出**：token, userId, email, role

### checkAdmin - 验证管理员权限
- **作用**：验证 token 是否有效，是否为管理员
- **输入**：`token`
- **输出**：isAdmin, userId, role

## 🔒 安全机制

### 密码加密
- 使用 SHA256 单向哈希
- 密码不以明文存储
- 最小长度6位字符

### Token 机制
- Base64 编码的 JSON
- 包含 userId, email, timestamp
- 存储在 localStorage
- 每次请求验证

### 数据隔离
- 小程序：通过 openId 自动隔离
- 后台管理：通过 token 验证身份
- 数据库规则强制权限控制

## 🎯 使用场景

### 场景1：新用户首次打开小程序
1. 自动调用 `wxLogin` 云函数
2. 创建 users 表记录（role='user'）
3. 返回 userId 并缓存
4. 用户可以开始添加错题

### 场景2：管理员登录后台
1. 访问后台登录页面
2. 输入邮箱+密码
3. 调用 `adminLogin` 验证
4. 获取 token 并存储
5. 跳转到管理后台首页

### 场景3：用户查看错题列表
1. 小程序调用云函数
2. 云函数自动获取 openId
3. 查询 `errors` 表，筛选 `userId == openId`
4. 只返回当前用户的错题

## 📝 注意事项

1. **首次部署必须创建管理员账号**，否则无法登录后台
2. **小程序端无需手动登录**，打开即自动登录
3. **数据物理共享，逻辑隔离**：所有错题在同一集合，通过 userId 区分
4. **管理员 role='admin'**，普通用户 role='user'
5. **生产环境建议**：
   - 修改密码哈希算法（使用 bcrypt）
   - 使用专业 JWT 库生成 token
   - 添加 token 过期时间
   - 实施 HTTPS 强制访问

## 🆘 常见问题

**Q: 忘记管理员密码怎么办？**
A: 使用云开发控制台直接修改 users 表中的密码字段（需要 SHA256 哈希）

**Q: 如何添加新管理员？**
A: 再次运行 `npm run register-admin` 注册新账号

**Q: 小程序登录失败怎么办？**
A: 检查云函数 `wxLogin` 是否部署成功，查看云函数日志

**Q: 后台登录显示"无管理员权限"？**
A: 检查数据库 users 表中该账号的 role 字段是否为 'admin'

## 🔗 相关资源

- [云开发控制台](https://console.cloud.tencent.com/tcb)
- [小程序开发文档](https://developers.weixin.qq.com/miniprogram/dev/framework/)
- [CloudBase 文档](https://docs.cloudbase.net/)
