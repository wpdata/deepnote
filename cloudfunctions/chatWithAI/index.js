// 云函数：AI互动对话（支持语音）
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

/**
 * AI对话云函数
 * 支持文字和语音混合交互
 *
 * @param {Object} event
 * @param {string} event.errorId - 错题ID
 * @param {string} event.userMessage - 用户消息文字
 * @param {boolean} event.needVoice - 是否需要语音回复
 * @returns {Object} AI回复结果
 */
exports.main = async (event, context) => {
  const {
    errorId,
    userMessage,
    needVoice = false  // 是否需要语音回复
  } = event

  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  if (!errorId || !userMessage) {
    return {
      success: false,
      error: '缺少必要参数: errorId, userMessage'
    }
  }

  try {
    // 1. 获取错题详情
    const errorDoc = await db.collection('errors')
      .doc(errorId)
      .get()

    if (!errorDoc.data) {
      throw new Error('错题不存在')
    }

    const error = errorDoc.data

    // 2. 获取对话历史
    const chatHistory = error.chatHistory || []

    // 3. 检查是否有图片
    const hasImage = !!error.imageUrl

    // 如果有图片，获取临时访问链接
    let imagePublicUrl = null
    if (hasImage) {
      try {
        const tempFileResult = await cloud.getTempFileURL({
          fileList: [error.imageUrl]
        })
        if (tempFileResult.fileList && tempFileResult.fileList.length > 0) {
          imagePublicUrl = tempFileResult.fileList[0].tempFileURL
          console.log('✓ 获取图片临时链接成功')
        }
      } catch (err) {
        console.error('获取图片链接失败:', err)
      }
    }

    // 4. 根据学科和是否有图片选择合适的模型
    let useQwenMath = false
    let useQwenVL = false
    let modelName = 'deepseek-chat'  // 默认通用模型

    if (hasImage && imagePublicUrl) {
      // 有图片：必须使用视觉模型
      useQwenVL = true
      modelName = 'qwen-vl-max'
      console.log('✓ 检测到图片，使用 qwen-vl-max 视觉模型')
    } else if (error.subject === '数学' || error.subject === 'math' || error.subject === '数学题') {
      // 数学学科且无图片：使用Qwen数学模型
      useQwenMath = true
      modelName = 'qwen-math-turbo'
      console.log('✓ 检测到数学题（无图片），使用 qwen-math-turbo 模型')
    } else {
      console.log('✓ 使用 deepseek-chat 通用模型')
    }

    // 5. 构建系统提示词
    const systemPrompt = `你是一位耐心、专业的${error.subject}老师。

【题目信息】
题目内容: ${error.content}
知识点: ${error.knowledgePoint}
难度: ${error.difficulty}
${error.correctAnswer ? `正确答案: ${error.correctAnswer}` : ''}

【AI初步分析】
${error.aiAnalysis || '暂无'}

【你的角色】
- 根据学生的问题，提供清晰、详细的解答
- 如果学生没理解，换个角度、用更简单的语言再讲一遍
- 鼓励学生思考，引导而非直接给答案
- 回答要简洁明了，每次回复控制在150字以内（因为可能要转语音）

【注意事项】
- 不要重复已经说过的内容
- 语言要口语化、易懂
- 可以用生活中的例子帮助理解`

    // 6. 构建消息列表（不包含历史对话，每次都是新的独立对话）
    let messages = []

    if (useQwenVL && imagePublicUrl) {
      // 视觉模型：使用多模态消息格式，每次都重新发送图片
      messages = [
        { role: 'system', content: systemPrompt },
        {
          role: 'user',
          content: [
            { type: 'image', image: imagePublicUrl },
            { type: 'text', text: userMessage }
          ]
        }
      ]
    } else {
      // 文本模型：普通消息格式
      messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage }
      ]
    }

    // 7. 调用AI模型（根据是否有图片选择合适的模型）
    let aiReply = ''

    if (useQwenVL) {
      // 有图片：调用Qwen视觉模型
      console.log('调用Qwen-VL, 模型:', modelName, '消息数:', messages.length)

      const qwenResult = await cloud.callFunction({
        name: 'callQwenVL',  // 使用专门的视觉模型云函数
        data: {
          messages: messages,
          model: modelName,
          maxTokens: 800,
          temperature: 0.7
        }
      })

      if (!qwenResult.result || !qwenResult.result.success) {
        throw new Error('Qwen视觉模型调用失败')
      }

      aiReply = qwenResult.result.content

    } else if (useQwenMath) {
      // 数学题（无图片）：调用Qwen Math API
      console.log('调用Qwen-Math, 模型:', modelName, '消息数:', messages.length)

      const qwenResult = await cloud.callFunction({
        name: 'callQwenMath',
        data: {
          messages: messages,
          model: modelName,
          maxTokens: 800,      // 数学题需要更多步骤
          temperature: 0.3     // 降低随机性，提高准确度
        }
      })

      if (!qwenResult.result || !qwenResult.result.success) {
        throw new Error('Qwen Math调用失败')
      }

      aiReply = qwenResult.result.content

    } else {
      // 其他学科：调用DeepSeek API
      console.log('调用DeepSeek, 模型:', modelName, '消息数:', messages.length)

      const aiResult = await cloud.callFunction({
        name: 'callDeepSeek',
        data: {
          messages: messages,
          model: modelName,
          maxTokens: 500,
          temperature: 0.7
        }
      })

      if (!aiResult.result || !aiResult.result.success) {
        throw new Error('DeepSeek调用失败')
      }

      aiReply = aiResult.result.content
    }

    // 8. 如果需要语音，调用TTS
    let voiceFileID = null
    if (needVoice) {
      console.log('生成语音回复...')
      const ttsResult = await cloud.callFunction({
        name: 'textToSpeech',
        data: {
          text: aiReply,
          voiceType: '101001'  // 温柔女声
        }
      })

      if (ttsResult.result && ttsResult.result.success) {
        voiceFileID = ttsResult.result.fileID
      }
    }

    // 9. 保存对话历史
    const newChatHistory = [
      ...chatHistory,
      {
        role: 'user',
        content: userMessage,
        timestamp: new Date(),
        hasVoice: false
      },
      {
        role: 'assistant',
        content: aiReply,
        timestamp: new Date(),
        voiceFileID: voiceFileID,
        hasVoice: !!voiceFileID
      }
    ]

    // 只保留最近10轮对话（防止上下文过长）
    const recentHistory = newChatHistory.slice(-20)

    await db.collection('errors')
      .doc(errorId)
      .update({
        data: {
          chatHistory: recentHistory,
          updateTime: new Date()
        }
      })

    // 10. 返回结果
    return {
      success: true,
      reply: aiReply,
      voiceFileID: voiceFileID,
      hasVoice: !!voiceFileID
    }

  } catch (error) {
    console.error('AI对话失败:', error)
    return {
      success: false,
      error: error.message || 'AI对话失败'
    }
  }
}
