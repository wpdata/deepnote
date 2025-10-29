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
 */
exports.main = async (event, context) => {
  const { imageUrl, prompt, model = 'qwen-vl-max' } = event

  if (!imageUrl || !prompt) {
    return {
      success: false,
      error: '缺少必要参数: imageUrl, prompt'
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

    const requestData = {
      model: model,  // qwen-vl-max, qwen-vl-plus, qwen3-vl
      input: {
        messages: [
          {
            role: 'user',
            content: [
              {
                image: imageUrl
              },
              {
                text: prompt
              }
            ]
          }
        ]
      },
      parameters: {
        result_format: 'message'
      }
    }

    const result = await callQwenAPI(requestData)

    if (result && result.output && result.output.choices) {
      const content = result.output.choices[0].message.content

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
    const postData = JSON.stringify(data)

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

    const req = https.request(options, (res) => {
      let responseData = ''

      res.on('data', (chunk) => {
        responseData += chunk
      })

      res.on('end', () => {
        try {
          const result = JSON.parse(responseData)

          if (res.statusCode === 200) {
            resolve(result)
          } else {
            reject(new Error(`API错误: ${result.message || responseData}`))
          }
        } catch (error) {
          reject(new Error(`解析响应失败: ${error.message}`))
        }
      })
    })

    req.on('error', (error) => {
      reject(error)
    })

    req.write(postData)
    req.end()
  })
}
