// 云函数: 调用阿里云 Qwen3-VL API
const cloud = require('wx-server-sdk')
const https = require('https')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 从环境变量读取 API Key (复用阿里云 DashScope Key)
const QWEN_API_KEY = process.env.DASHSCOPE_API_KEY || process.env.QWEN_API_KEY || ''

/**
 * 调用阿里云 Qwen3-VL API
 *
 * 支持两种模式：
 * 1. 简单模式：传入 imageUrl + prompt（向后兼容）
 * 2. 高级模式：传入完整的 messages 数组（支持多轮对话）
 */
exports.main = async (event, context) => {
  const {
    imageUrl,
    prompt,
    messages,  // 新增：支持完整消息历史
    model = 'qwen-vl-max',
    maxTokens = 800,
    temperature = 0.7
  } = event

  // 参数校验：要么提供 messages，要么提供 imageUrl+prompt
  if (!messages && (!imageUrl || !prompt)) {
    return {
      success: false,
      error: '缺少必要参数: messages 或 (imageUrl + prompt)'
    }
  }

  if (!QWEN_API_KEY) {
    return {
      success: false,
      error: 'Qwen API Key 未配置'
    }
  }

  try {
    console.log('调用 Qwen-VL API:', model)

    // 构建请求消息
    let apiMessages = []

    if (messages) {
      // 高级模式：使用传入的完整消息历史
      apiMessages = messages
      console.log('使用完整消息历史，共', messages.length, '条消息')
    } else {
      // 简单模式：构建单条消息
      apiMessages = [
        {
          role: 'user',
          content: [
            { image: imageUrl },
            { text: prompt }
          ]
        }
      ]
      console.log('使用简单模式：单图片+提示')
    }

    const requestData = {
      model: model,  // qwen-vl-max, qwen-vl-plus, qwen3-vl
      input: {
        messages: apiMessages
      },
      parameters: {
        max_tokens: maxTokens,
        temperature: temperature,
        result_format: 'message'
      }
    }

    console.log('准备调用通义千问 API，开始计时...')
    const startTime = Date.now()

    const result = await callQwenAPI(requestData)

    const elapsed = Date.now() - startTime
    console.log(`API 调用完成，耗时: ${elapsed}ms`)

    if (result && result.output && result.output.choices) {
      let content = result.output.choices[0].message.content

      // 处理 Qwen-VL 的特殊返回格式
      // content 可能是数组 [{text: "..."}] 或字符串
      if (Array.isArray(content)) {
        // 提取所有 text 字段并合并
        content = content
          .filter(item => item && item.text)
          .map(item => item.text)
          .join('\n')
      }

      return {
        success: true,
        content: content,
        usage: result.usage
      }
    } else {
      throw new Error('API 返回格式错误')
    }

  } catch (error) {
    console.error('Qwen-VL API 调用失败:', error)
    return {
      success: false,
      error: error.message || 'API调用失败'
    }
  }
}

/**
 * 调用阿里云 API
 */
function callQwenAPI(data) {
  return new Promise((resolve, reject) => {
    console.log('📡 callQwenAPI 开始执行')
    const postData = JSON.stringify(data)
    console.log('📦 请求数据大小:', Buffer.byteLength(postData), 'bytes')

    const options = {
      hostname: 'dashscope.aliyuncs.com',
      port: 443,
      path: '/api/v1/services/aigc/multimodal-generation/generation',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${QWEN_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }

    console.log('🔗 创建 HTTPS 请求...')
    const req = https.request(options, (res) => {
      console.log('📥 收到响应，状态码:', res.statusCode)
      let responseData = ''

      res.on('data', (chunk) => {
        responseData += chunk
        console.log('📨 接收数据块，当前总大小:', responseData.length, 'bytes')
      })

      res.on('end', () => {
        console.log('✅ 响应接收完成，总大小:', responseData.length, 'bytes')
        try {
          const result = JSON.parse(responseData)

          if (res.statusCode === 200) {
            console.log('✅ Qwen-VL API 调用成功')
            resolve(result)
          } else {
            console.error('❌ Qwen-VL API 返回错误:', result.message || responseData)
            reject(new Error(`API错误: ${result.message || responseData}`))
          }
        } catch (error) {
          console.error('❌ 解析 Qwen-VL 响应失败:', error.message)
          reject(new Error(`解析响应失败: ${error.message}`))
        }
      })
    })

    // 设置 90 秒超时（VL 模型需要更长时间处理）
    req.setTimeout(90000, () => {
      console.error('❌ Qwen-VL 请求超时（90秒）')
      req.destroy()
      reject(new Error('API请求超时（90秒）'))
    })

    req.on('error', (error) => {
      console.error('❌ Qwen-VL 请求错误:', error.message)
      reject(error)
    })

    console.log('📤 发送请求数据...')
    req.write(postData)
    req.end()
    console.log('✉️ 请求已发送，等待响应...')
  })
}
