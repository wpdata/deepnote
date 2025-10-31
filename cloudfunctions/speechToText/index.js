// 云函数：语音转文字 (ASR)
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

/**
 * 语音识别云函数
 * 使用腾讯云语音识别服务
 *
 * @param {Object} event
 * @param {string} event.fileID - 录音文件的云存储ID
 * @param {string} event.format - 音频格式 (mp3/wav/pcm/aac)
 * @returns {Object} 识别结果
 */
exports.main = async (event, context) => {
  const { fileID, format = 'mp3' } = event

  if (!fileID) {
    return {
      success: false,
      error: '缺少必要参数: fileID'
    }
  }

  try {
    console.log('开始语音识别, fileID:', fileID)

    // 1. 下载音频文件
    const res = await cloud.downloadFile({
      fileID: fileID
    })

    const audioBuffer = res.fileContent

    // 2. 调用腾讯云语音识别
    const result = await cloud.openapi.asr.sentenceRecognition({
      engine_model_type: '16k_zh',  // 中文通用模型
      voice_format: format === 'mp3' ? 'mp3' : 'wav',
      data: audioBuffer.toString('base64'),
      data_len: audioBuffer.length
    })

    console.log('识别结果:', result)

    if (result.result) {
      return {
        success: true,
        text: result.result,
        confidence: result.confidence || 0
      }
    } else {
      throw new Error('识别失败，未返回结果')
    }

  } catch (error) {
    console.error('语音识别失败:', error)
    return {
      success: false,
      error: error.message || '语音识别失败',
      details: error
    }
  }
}
