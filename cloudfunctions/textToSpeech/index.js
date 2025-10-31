// 云函数：文字转语音 (TTS)
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

/**
 * 文字转语音云函数
 * 使用腾讯云语音合成服务
 *
 * @param {Object} event
 * @param {string} event.text - 要转换的文字内容
 * @param {string} event.voiceType - 音色类型 (可选)
 * @returns {Object} 语音文件信息
 */
exports.main = async (event, context) => {
  const {
    text,
    voiceType = '101001',  // 默认使用智瑜（温柔女声）
    speed = 0,             // 语速 -2~2
    volume = 0             // 音量 -10~10
  } = event

  if (!text) {
    return {
      success: false,
      error: '缺少必要参数: text'
    }
  }

  // 文字长度限制
  if (text.length > 500) {
    return {
      success: false,
      error: '文字内容过长，最多500字符'
    }
  }

  try {
    console.log('开始文字转语音, 文字长度:', text.length)

    // 调用腾讯云语音合成
    const result = await cloud.openapi.tts.textToVoice({
      text: text,
      model_type: 1,        // 1-通用场景
      voice_type: parseInt(voiceType),
      speed: speed,
      volume: volume,
      codec: 'mp3',
      sample_rate: 16000
    })

    console.log('合成结果:', result)

    if (result.audio) {
      // 将音频数据保存到云存储
      const audioBuffer = Buffer.from(result.audio, 'base64')
      const fileName = `tts/${Date.now()}_${Math.random().toString(36).slice(2)}.mp3`

      const uploadResult = await cloud.uploadFile({
        cloudPath: fileName,
        fileContent: audioBuffer
      })

      console.log('上传成功, fileID:', uploadResult.fileID)

      return {
        success: true,
        fileID: uploadResult.fileID,
        duration: result.duration || 0  // 音频时长（秒）
      }
    } else {
      throw new Error('合成失败，未返回音频数据')
    }

  } catch (error) {
    console.error('文字转语音失败:', error)
    return {
      success: false,
      error: error.message || '文字转语音失败',
      details: error
    }
  }
}
