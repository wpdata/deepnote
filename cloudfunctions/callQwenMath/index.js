// 云函数：调用Qwen数学模型
const cloud = require('wx-server-sdk')
const https = require('https')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 从环境变量读取 API Key
const DASHSCOPE_API_KEY = process.env.DASHSCOPE_API_KEY || ''

/**
 * 调用Qwen数学模型API
 * 专门用于数学题的AI对话
 */
exports.main = async (event, context) => {
  const {
    messages,
    model = 'qwen-math-turbo',
    maxTokens = 800,
    temperature = 0.3
  } = event

  if (!messages) {
    return {
      success: false,
      error: '缺少必要参数: messages'
    }
  }

  if (!DASHSCOPE_API_KEY) {
    return {
      success: false,
      error: 'DashScope API Key 未配置'
    }
  }

  try {
    console.log('调用Qwen Math API:', model)

    const requestData = {
      model: model,
      input: {
        messages: messages
      },
      parameters: {
        max_tokens: maxTokens,
        temperature: temperature,
        result_format: 'message'
      }
    }

    const result = await callQwenAPI(requestData)

    if (result && result.output && result.output.choices && result.output.choices.length > 0) {
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
    console.error('Qwen Math API 调用失败:', error)
    return {
      success: false,
      error: error.message || 'API调用失败'
    }
  }
}

/**
 * 调用DashScope API
 */
function callQwenAPI(data) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data)

    const options = {
      hostname: 'dashscope.aliyuncs.com',
      port: 443,
      path: '/compatible-mode/v1/chat/completions',
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${DASHSCOPE_API_KEY}`,
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
