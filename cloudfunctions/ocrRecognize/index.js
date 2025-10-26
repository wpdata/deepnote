// 云函数：OCR识别
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

/**
 * OCR识别云函数
 * 功能：识别图片中的文字内容
 *
 * @param {Object} event
 * @param {string} event.fileID - 图片云存储ID
 * @returns {Object} 识别结果
 */
exports.main = async (event, context) => {
  const { fileID } = event

  if (!fileID) {
    return {
      success: false,
      error: '缺少图片fileID参数'
    }
  }

  try {
    // 1. 获取图片临时URL
    const fileResult = await cloud.getTempFileURL({
      fileList: [fileID]
    })

    if (!fileResult.fileList || fileResult.fileList.length === 0) {
      return {
        success: false,
        error: '无法获取图片URL'
      }
    }

    const imageUrl = fileResult.fileList[0].tempFileURL

    // 2. 调用OCR识别（暂时使用模拟数据，后续集成腾讯云OCR）
    const ocrResult = await performOCR(imageUrl)

    // 3. 文本清洗和格式化
    const cleanedText = cleanOCRText(ocrResult.text)

    // 4. 记录OCR识别历史
    const openid = cloud.getWXContext().OPENID
    await saveOCRRecord(openid, fileID, cleanedText, ocrResult.confidence)

    return {
      success: true,
      text: cleanedText,
      confidence: ocrResult.confidence,
      wordCount: cleanedText.length
    }

  } catch (error) {
    console.error('OCR识别失败:', error)
    return {
      success: false,
      error: error.message || 'OCR识别失败'
    }
  }
}

/**
 * 执行OCR识别
 * TODO: 集成腾讯云OCR API
 */
async function performOCR(imageUrl) {
  // 暂时返回模拟数据
  // 后续集成腾讯云OCR: https://cloud.tencent.com/document/product/866/33526

  console.log('OCR识别图片:', imageUrl)

  // 模拟识别结果
  const mockTexts = [
    '题目：已知函数 f(x) = x² + 2x - 3，求函数的零点。\n\n解：令 f(x) = 0\nx² + 2x - 3 = 0\n(x + 3)(x - 1) = 0\n所以 x = -3 或 x = 1',
    '题目：下列函数中，在定义域内单调递增的是？\nA. f(x) = -x² + 1\nB. f(x) = x³\nC. f(x) = -x\nD. f(x) = 1/x\n\n答案：B',
    '题目：计算：sin 30° + cos 60° = ?\nA. 0\nB. 1\nC. √2\nD. √3\n\n答案：B'
  ]

  // 随机返回一个模拟文本
  const randomText = mockTexts[Math.floor(Math.random() * mockTexts.length)]

  return {
    text: randomText,
    confidence: 0.95 + Math.random() * 0.04  // 模拟置信度 0.95-0.99
  }
}

/**
 * 清洗OCR识别的文本
 */
function cleanOCRText(text) {
  if (!text) return ''

  return text
    .trim()
    // 去除多余空格
    .replace(/\s+/g, ' ')
    // 去除特殊字符
    .replace(/[^\u4e00-\u9fa5a-zA-Z0-9\s\+\-\*\/\=\(\)\[\]\{\}\.\,\?\!\:\;\'\"\n]/g, '')
    // 标准化换行
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
}

/**
 * 保存OCR识别记录
 */
async function saveOCRRecord(openid, imageUrl, recognizedText, confidence) {
  const db = cloud.database()

  try {
    await db.collection('ocr_records').add({
      data: {
        _openid: openid,
        imageUrl,
        recognizedText,
        confidence,
        isAdopted: false,  // 默认未被采纳
        ocrService: 'mock',  // 暂时使用模拟服务
        createTime: new Date()
      }
    })
  } catch (error) {
    console.error('保存OCR记录失败:', error)
    // 不影响主流程，仅记录错误
  }
}
