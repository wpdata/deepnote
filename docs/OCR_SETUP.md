# OCR识别功能配置说明

## 功能概述

本项目的OCR识别功能使用**腾讯云通用印刷体识别API**,用于识别拍照上传的错题图片中的文字内容。

## 配置步骤

### 1. 获取腾讯云API密钥

1. 登录 [腾讯云控制台](https://console.cloud.tencent.com/)
2. 进入 [访问管理 > API密钥管理](https://console.cloud.tencent.com/cam/capi)
3. 创建密钥,获取 `SecretId` 和 `SecretKey`

### 2. 开通OCR服务

1. 进入 [文字识别OCR控制台](https://console.cloud.tencent.com/ocr)
2. 开通 **通用印刷体识别** 服务
3. 免费额度: 每月1000次免费调用

### 3. 配置云函数环境变量

在云开发控制台配置 `ocrRecognize` 云函数的环境变量:

```bash
TENCENT_SECRET_ID=你的SecretId
TENCENT_SECRET_KEY=你的SecretKey
```

**配置路径**:
- 云开发控制台 > 云函数 > ocrRecognize > 函数配置 > 环境变量

### 4. 降级策略

**如果未配置密钥**,云函数会自动使用模拟OCR数据,用于开发测试阶段。

- ✅ 优点: 无需配置即可开发测试
- ⚠️ 注意: 生产环境必须配置真实密钥

## API说明

### 调用方式

```javascript
// 小程序端调用
wx.cloud.callFunction({
  name: 'ocrRecognize',
  data: {
    fileID: 'cloud://xxx'  // 图片的云存储ID
  }
}).then(res => {
  console.log('识别结果:', res.result)
  // {
  //   success: true,
  //   text: '识别的文字内容',
  //   confidence: 0.98,  // 置信度
  //   wordCount: 120,    // 字数
  //   service: 'tencent-ocr'  // 使用的服务
  // }
})
```

### 返回结果

| 字段 | 类型 | 说明 |
|------|------|------|
| success | Boolean | 是否成功 |
| text | String | 识别的文字内容 |
| confidence | Number | 识别置信度(0-1) |
| wordCount | Number | 字数统计 |
| service | String | OCR服务标识 (`tencent-ocr` 或 `mock`) |
| error | String | 错误信息(仅失败时) |

## 费用说明

### 免费额度
- 每月 **1000次** 免费调用
- 适合小规模个人应用

### 付费价格
- 0-1万次: 0.15元/次
- 1万-10万次: 0.10元/次
- 10万次以上: 0.06元/次

详见: [OCR产品定价](https://cloud.tencent.com/document/product/866/17619)

## 技术细节

### OCR识别流程

```
1. 上传图片到云存储 → 获取fileID
2. 调用ocrRecognize云函数 → 传入fileID
3. 云函数获取图片临时URL
4. 调用腾讯云OCR API识别
5. 清洗和格式化文本
6. 保存识别记录到ocr_records集合
7. 返回识别结果
```

### 文本清洗规则

- 去除多余空格
- 去除特殊字符(保留数学符号)
- 标准化换行符

### 识别记录

所有OCR识别都会记录到 `ocr_records` 集合,包含:
- 用户openid
- 图片URL
- 识别文本
- 置信度
- OCR服务类型
- 创建时间
- 是否被采纳

## 故障排查

### 问题1: OCR识别失败
**原因**:
- 密钥配置错误
- OCR服务未开通
- 图片格式不支持

**解决**:
1. 检查环境变量配置
2. 确认OCR服务已开通
3. 查看云函数日志

### 问题2: 识别结果不准确
**原因**:
- 图片模糊
- 光线不足
- 手写字体

**建议**:
- 确保图片清晰
- 光线充足
- 使用印刷体题目

### 问题3: 超出免费额度
**解决**:
- 升级为付费版本
- 或使用其他OCR服务

## 后续优化

- [ ] 支持多种OCR服务切换
- [ ] 增加图片预处理(去噪、增强)
- [ ] 优化识别准确率
- [ ] 支持公式识别(LaTeX)
- [ ] 支持表格识别

## 参考文档

- [腾讯云OCR API文档](https://cloud.tencent.com/document/product/866/33526)
- [云开发环境变量配置](https://developers.weixin.qq.com/miniprogram/dev/wxcloud/guide/functions/config.html)
