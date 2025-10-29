// 云函数: 调用 DeepSeek API
const cloud = require('wx-server-sdk')
const https = require('https')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 从环境变量读取 API Key
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || ''

/**
 * 调用 DeepSeek API
 */
exports.main = async (event, context) => {
  const {
    prompt,
    model = 'deepseek-chat',
    maxTokens = 500,
    temperature = 0.7
  } = event

  if (!prompt) {
    return {
      success: false,
      error: '缺少必要参数: prompt'
    }
  }

  if (!DEEPSEEK_API_KEY) {
    return {
      success: false,
      error: 'DeepSeek API Key 未配置'
    }
  }

  try {
    console.log('调用 DeepSeek API:', model)

    const requestData = {
      model: model,
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      max_tokens: maxTokens,
      temperature: temperature
    }

    const result = await callDeepSeekAPI(requestData)

    if (result && result.choices && result.choices.length > 0) {
      const content = result.choices[0].message.content

      return {
        success: true,
        content: content,
        usage: result.usage
      }
    } else {
      throw new Error('API 返回格式错误')
    }

  } catch (error) {
    console.error('DeepSeek API 调用失败:', error)
    return {
      success: false,
      error: error.message || 'API调用失败'
    }
  }
}

/**
 * 调用 DeepSeek API
 */
function callDeepSeekAPI(data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data)

    const options = {
      hostname: 'api.deepseek.com',
      port: 443,
      path: '/chat/completions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DEEPSEEK_API_KEY}`,
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
            reject(new Error(`API错误: ${result.error?.message || responseData}`))
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
