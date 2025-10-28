# 快速部署：通义千问-Math-Turbo

## ✅ 已完成

1. ✅ 代码已修改完成
2. ✅ 使用 OpenAI SDK 兼容接口
3. ✅ 答案提取逻辑（支持 \boxed{} 格式）

## 📋 待完成步骤

### 步骤1: 获取通义千问 API Key（5分钟）

**方式A: 阿里云控制台**
1. 访问：https://dashscope.console.aliyun.com/
2. 登录阿里云账号
3. 点击"API-KEY管理"
4. 创建新API Key
5. 复制保存（格式：sk-xxxxx）

**方式B: 百炼平台**
1. 访问：https://bailian.console.aliyun.com/
2. 登录后进入API Key管理
3. 创建并复制

### 步骤2: 配置云函数环境变量（3分钟）

1. 登录腾讯云控制台：https://console.cloud.tencent.com/
2. 进入"云开发"
3. 选择你的环境（deepnote-3g0lr0fb3ce6ea1c）
4. 点击"云函数" → `ocrRecognize`
5. 点击"函数配置" → "编辑"
6. 在"环境变量"部分添加：
   ```
   键: DASHSCOPE_API_KEY
   值: sk-你的API密钥
   ```
7. 点击"保存"

### 步骤3: 部署云函数（1分钟）

**选项A: 使用Claude Code**
```bash
# 确保已认证
mcp__cloudbase__login

# 部署
mcp__cloudbase__updateFunctionCode ocrRecognize
```

**选项B: 手动部署**
1. 在云函数控制台点击"部署"
2. 等待部署完成

### 步骤4: 测试验证（5分钟）

1. 打开小程序扫描页面
2. 上传一道数学题图片
3. 查看识别结果中的 `correctAnswer`
4. 查看云函数日志，确认看到：
   ```
   ===== 使用通义千问-Math-Turbo计算数学答案 =====
   通义千问-Math-Turbo返回答案: XXX
   ```

## 🔍 验证清单

- [ ] DASHSCOPE_API_KEY 已配置
- [ ] 云函数已重新部署
- [ ] 数学题能正确识别（subject = "数学"）
- [ ] correctAnswer 有值且正确
- [ ] 云函数日志显示"通义千问-Math-Turbo"

## 🆘 常见问题

### Q1: API Key配置后仍然报错
**A**:
1. 检查API Key格式是否正确（以sk-开头）
2. 确认云函数已重新部署
3. 检查阿里云账户是否有余额

### Q2: 数学题没有调用通义千问
**A**:
1. 检查题目是否被识别为数学（查看日志中的 subject）
2. 确认题目没有已标注的答案
3. 查看 detectSubject() 的判断结果

### Q3: 答案格式异常
**A**:
- 通义千问可能返回带解释的答案
- 代码会尝试提取 \boxed{} 中的内容
- 如果提取失败，会使用清理后的完整文本

### Q4: 成本问题
**A**:
- 通义千问仅在**数学题且无答案**时调用
- 其他学科仍使用 deepseek-chat
- 预计额外成本 < 15%

## 📊 预期效果

| 场景 | 使用模型 | 预期结果 |
|------|---------|---------|
| 数学题无答案 | Qwen-Math-Turbo | ✅ 准确计算 |
| 数学题有答案 | 无需计算 | ✅ 使用标注 |
| 英语题 | DeepSeek-chat | ✅ 正常分析 |
| 物理/化学题 | DeepSeek-chat | ✅ 正常分析 |

## 🚀 一键部署脚本

如果你想快速部署，可以使用以下命令：

```bash
# 1. 设置环境变量（替换成你的API Key）
export DASHSCOPE_API_KEY="sk-your-api-key-here"

# 2. 登录云开发
echo "正在登录云开发..."

# 3. 部署云函数
echo "正在部署云函数..."

# 4. 验证部署
echo "✅ 部署完成！请在小程序中测试数学题识别"
```

## 📝 测试用例

测试这些题目，验证通义千问是否正常工作：

1. **简单计算**: "25 × 4 + 18 = ?"
2. **分数运算**: "(1/2 + 1/3) × 6 = ?"
3. **方程求解**: "2x + 5 = 13，求x"
4. **应用题**: "小明有10个苹果，吃了3个，还剩几个？"

期望在日志中看到：
```
检测到数学题且无答案，调用通义千问-Math-Turbo计算...
通义千问-Math-Turbo返回答案: [正确答案]
```

---

**需要帮助？**
如果遇到问题，请查看：
- [QWEN_MATH_SETUP.md](./QWEN_MATH_SETUP.md) - 详细配置文档
- [MATH_MODEL_INTEGRATION.md](./MATH_MODEL_INTEGRATION.md) - 数学模型集成文档
- 云函数日志 - 查看详细错误信息
