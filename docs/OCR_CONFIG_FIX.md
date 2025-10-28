# OCR 密钥配置问题排查指南

## 🐛 问题现象

控制台显示：
```javascript
service: "mock"  // ❌ 使用模拟数据
```

说明密钥未生效，云函数使用了降级的模拟数据。

## ✅ 正确的配置方法

### 步骤1: 登录云开发控制台

访问: https://console.cloud.tencent.com/tcb

### 步骤2: 选择环境

选择您的环境：`deepnote-3g0lr0fb3ce6ea1c`

### 步骤3: 进入云函数配置

```
左侧菜单 → 云函数 → 找到 ocrRecognize 函数 → 点击函数名进入详情
```

### 步骤4: 配置环境变量

点击 **"函数配置"** 标签页，找到 **"环境变量"** 部分

**重要：配置格式**

环境变量是一个**表单**，有两列：

| 键（Key） | 值（Value） |
|-----------|------------|
| TENCENT_SECRET_ID | AKIDxxxxxxxxxxxxxxxxxxxxx |
| TENCENT_SECRET_KEY | xxxxxxxxxxxxxxxxxxxxxxxx |

**正确示例：**
```
键: TENCENT_SECRET_ID
值: AKID1234567890abcdefghijklmnopqrstuvwxyz

键: TENCENT_SECRET_KEY
值: abcdefghijklmnopqrstuvwxyz1234567890
```

**❌ 错误示例：**
```
❌ TENCENT_SECRET_ID=AKID...
❌ TENCENT_SECRET_ID:AKID...
❌ TENCENT_SECRET_ID = AKID...
```

### 步骤5: 保存配置

点击 **"保存"** 按钮

### 步骤6: 重新部署云函数

**方式一：通过控制台**
```
云函数详情页 → 函数代码 → 点击"保存并安装依赖"
```

**方式二：通过开发者工具**
```
1. 打开微信开发者工具
2. 右键 cloudfunctions/ocrRecognize
3. 选择"上传并部署：云端安装依赖"
```

**重要**：配置环境变量后，**必须重新部署**云函数才能生效！

### 步骤7: 等待部署完成

等待 1-2 分钟，确保：
- 代码上传完成
- 依赖安装完成
- 环境变量加载完成

## 🔍 验证配置

### 方法1: 查看云函数日志

1. 云开发控制台 → 云函数 → ocrRecognize → 日志
2. 查看最新的日志
3. 如果看到 "未配置腾讯云密钥，使用模拟OCR数据" → 说明密钥未生效
4. 如果看到正常的OCR调用 → 说明密钥已生效

### 方法2: 测试识别

在小程序中重新测试识别，查看控制台：

```javascript
// ✅ 密钥生效
{
  success: true,
  text: "实际识别出的内容...",
  service: "tencent-ocr"  // ← 这里很重要
}

// ❌ 密钥未生效
{
  success: true,
  text: "题目下列函数中...",  // 固定的模拟数据
  service: "mock"  // ← 说明还在用模拟数据
}
```

### 方法3: 添加调试日志

临时修改云函数代码，添加调试信息：

```javascript
// cloudfunctions/ocrRecognize/index.js
async function performOCR(imageUrl) {
  try {
    const secretId = process.env.TENCENT_SECRET_ID
    const secretKey = process.env.TENCENT_SECRET_KEY

    // 添加调试日志
    console.log('===== OCR调试信息 =====')
    console.log('secretId存在:', !!secretId)
    console.log('secretKey存在:', !!secretKey)
    console.log('secretId前4位:', secretId ? secretId.substring(0, 4) : 'null')
    console.log('=====================')

    if (!secretId || !secretKey) {
      console.warn('未配置腾讯云密钥，使用模拟OCR数据')
      return getMockOCRResult()
    }

    // ... 其他代码
  }
}
```

然后重新部署，查看云函数日志。

## 🎯 常见问题

### 问题1: 配置了但还是 mock

**可能原因：**
- 环境变量格式错误（加了 = 或 :）
- 配置后没有重新部署
- 密钥复制错误（多了空格或换行）
- 配置在错误的云函数上

**解决方法：**
1. 检查环境变量格式（不要有 = 或 :）
2. 确认在 ocrRecognize 函数上配置
3. 重新部署云函数
4. 等待 1-2 分钟后测试

### 问题2: 密钥从哪里复制

**正确复制方法：**
1. 访问: https://console.cloud.tencent.com/cam/capi
2. 找到您的密钥
3. 点击 "显示" 查看 SecretKey
4. **完整复制**，不要多复制空格

**密钥格式：**
```
SecretId:  AKID + 32位字符
SecretKey: 32位字符
```

### 问题3: 环境变量表单在哪里

**查找路径：**
```
云开发控制台
  → 选择环境: deepnote-3g0lr0fb3ce6ea1c
  → 云函数
  → 点击 ocrRecognize 函数名（不是右键菜单）
  → 进入函数详情页
  → 点击 "函数配置" 标签页（不是"函数代码"）
  → 向下滚动找到 "环境变量"
  → 点击 "编辑" 或 "新增"
```

### 问题4: 配置示例截图说明

**环境变量配置界面示例：**

```
┌─────────────────────────────────────────────┐
│ 环境变量                          [编辑]    │
├──────────────────┬──────────────────────────┤
│ 键（Key）         │ 值（Value）              │
├──────────────────┼──────────────────────────┤
│ TENCENT_SECRET_ID│ AKID1234567890...       │
├──────────────────┼──────────────────────────┤
│TENCENT_SECRET_KEY│ abcdefgh12345678...     │
└──────────────────┴──────────────────────────┘
                            [保存] [取消]
```

**注意：**
- 键和值是**分开的两个输入框**
- 键只需要输入：`TENCENT_SECRET_ID`
- 值只需要输入：`AKID...` （你的实际密钥值）
- **不要在键或值中加 = 或 :**

## 📋 配置检查清单

在配置完成后，请检查：

- [ ] 环境变量配置在 ocrRecognize 函数上
- [ ] 键名完全正确：TENCENT_SECRET_ID（区分大小写）
- [ ] 键名完全正确：TENCENT_SECRET_KEY（区分大小写）
- [ ] 值中没有多余的空格或换行
- [ ] 没有使用 = 或 : 符号
- [ ] 点击了"保存"按钮
- [ ] 重新部署了云函数
- [ ] 等待了 1-2 分钟让配置生效

## 🔄 配置后的测试流程

```
1. 保存环境变量配置
   ↓
2. 重新部署云函数
   ↓
3. 等待 1-2 分钟
   ↓
4. 在小程序中重新测试
   ↓
5. 查看控制台 service 字段
   ↓
6. 如果还是 "mock"，查看云函数日志
   ↓
7. 根据日志信息调整配置
```

## 💡 快速验证

在微信开发者工具的控制台中执行：

```javascript
wx.cloud.callFunction({
  name: 'ocrRecognize',
  data: {
    fileID: 'cloud://已上传的图片fileID'
  }
}).then(res => {
  console.log('OCR服务类型:', res.result.service)
  if (res.result.service === 'tencent-ocr') {
    console.log('✅ 密钥配置成功！')
  } else {
    console.log('❌ 密钥未生效，请检查配置')
  }
})
```

## 🆘 如果还是不行

如果按照以上步骤配置后还是显示 `service: "mock"`，请：

1. **截图您的环境变量配置界面**（遮挡密钥值）
2. **查看云函数日志**，复制最新的日志
3. **提供这些信息**，我来帮您分析具体原因

---

**提示**: 密钥配置是生产环境必须的，但开发测试阶段使用模拟数据也完全可以正常开发！
