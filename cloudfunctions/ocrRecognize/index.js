// 云函数：OCR识别
const cloud = require('wx-server-sdk')
const AlibabaCloudOcr = require('@alicloud/ocr-api20210707')
const AlibabaCloudOpenApi = require('@alicloud/openapi-client')
const { OpenAI } = require('openai')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

// 初始化DeepSeek客户端
const deepseek = new OpenAI({
  baseURL: 'https://api.deepseek.com',
  apiKey: process.env.DEEPSEEK_API_KEY
})

// 初始化通义千问客户端（用于数学题）
const qwen = new OpenAI({
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
  apiKey: process.env.DASHSCOPE_API_KEY
})

/**
 * OCR识别云函数
 *
 * 支持两种模式:
 * 1. action="getCoordinates" - 获取题目坐标位置
 * 2. action="recognizeQuestion" - 识别单个题目并格式化
 * 3. 默认模式 - 整页识别(兼容旧版本)
 */
exports.main = async (event, context) => {
  const { action, fileID, imageData, ocrOptions } = event

  console.log('======= 云函数入口 =======')
  console.log('action:', action)
  console.log('fileID:', fileID)
  console.log('ocrOptions:', ocrOptions)
  console.log('========================')

  // 模式1: 获取题目坐标
  if (action === 'getCoordinates') {
    console.log('进入 getQuestionCoordinates 函数')
    return await getQuestionCoordinates(fileID, ocrOptions)
  }

  // 模式2: 识别并格式化单个题目
  if (action === 'recognizeQuestion') {
    return await recognizeAndFormatQuestion(imageData, fileID)
  }

  // 模式3: 算术检查
  if (action === 'checkMath') {
    console.log('进入算术检查模式')
    return await checkOralCalculation(fileID)
  }

  // 默认模式: 整页识别(向后兼容)
  return await fullPageRecognition(fileID)
}

/**
 * 模式1: 获取题目坐标
 * @param {string} fileID - 云存储文件ID
 * @param {object} ocrOptions - OCR配置参数
 *   - cutType: 切割类型 (question=按题切, line=按行切, para=按段切, block=按块切)
 *   - imageType: 图片类型 (photo=拍照, scan=扫描, digital=数字原生)
 *   - subject: 学科类型 (PrimarySchool_English等)
 *   - outputOricoord: 是否输出原图坐标
 */
async function getQuestionCoordinates(fileID, ocrOptions = {}) {
  if (!fileID) {
    return {
      success: false,
      error: '缺少图片fileID参数'
    }
  }

  try {
    // 1. 获取图片临时URL
    console.log('开始获取临时URL, fileID:', fileID)

    const fileResult = await cloud.getTempFileURL({
      fileList: [fileID]
    })

    console.log('getTempFileURL 结果:', {
      hasFileList: !!fileResult.fileList,
      fileListLength: fileResult.fileList ? fileResult.fileList.length : 0,
      firstFile: fileResult.fileList ? fileResult.fileList[0] : null
    })

    if (!fileResult.fileList || fileResult.fileList.length === 0) {
      return {
        success: false,
        error: '无法获取图片URL'
      }
    }

    const fileItem = fileResult.fileList[0]

    // 检查状态码
    if (fileItem.status !== 0) {
      console.error('获取临时URL失败:', fileItem.errMsg)
      return {
        success: false,
        error: `获取临时URL失败: ${fileItem.errMsg}`
      }
    }

    const imageUrl = fileItem.tempFileURL

    console.log('获取到的临时URL:', imageUrl)

    if (!imageUrl) {
      return {
        success: false,
        error: '临时URL为空'
      }
    }

    // 2. 调用结构化识别API获取坐标
    const accessKeyId = process.env.ALIBABA_CLOUD_ACCESS_KEY_ID
    const accessKeySecret = process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET

    if (!accessKeyId || !accessKeySecret) {
      return {
        success: false,
        error: '未配置阿里云密钥'
      }
    }

    const config = new AlibabaCloudOpenApi.Config({
      accessKeyId: accessKeyId,
      accessKeySecret: accessKeySecret,
      endpoint: 'ocr-api.cn-hangzhou.aliyuncs.com'
    })

    const client = new AlibabaCloudOcr.default(config)

    // 构建OCR请求参数 (使用用户配置或默认值)
    const requestParams = {
      url: imageUrl,
      cutType: ocrOptions.cutType || 'question',  // 必填: question或answer
      imageType: ocrOptions.imageType || 'photo',  // 必填: photo或scan
      outputOricoord: ocrOptions.outputOricoord !== false  // 可选: 输出原图坐标
    }

    // subject 参数：只在用户明确选择时才传递
    // 空值或未设置时，使用阿里云默认识别
    if (ocrOptions.subject && ocrOptions.subject.trim() !== '') {
      requestParams.subject = ocrOptions.subject
      console.log('使用指定学科:', ocrOptions.subject)
    } else {
      console.log('使用默认学科识别（阿里云自动判断）')
    }

    console.log('OCR请求参数:', requestParams)

    // 使用 RecognizeEduPaperCut API (试卷切题识别)
    const request = new AlibabaCloudOcr.RecognizeEduPaperCutRequest(requestParams)

    const response = await client.recognizeEduPaperCut(request)

    console.log('RecognizeEduPaperCut API响应状态:', response.statusCode)

    if (response.statusCode !== 200 || !response.body?.data) {
      return {
        success: false,
        error: '获取坐标失败'
      }
    }

    const responseData = response.body.data
    console.log('response.body.data类型:', typeof responseData)
    console.log('response.body.data长度:', responseData ? responseData.length : 0)

    const ocrData = JSON.parse(responseData)

    console.log('====== OCR坐标识别原始数据 ======')
    console.log('数据结构:', {
      hasPageList: !!ocrData.page_list,
      pageCount: ocrData.page_list ? ocrData.page_list.length : 0,
      hasDocLayout: !!ocrData.doc_layout,
      docLayoutCount: ocrData.doc_layout ? ocrData.doc_layout.length : 0,
      allKeys: Object.keys(ocrData)
    })

    // 打印完整的OCR数据(仅前2000字符,避免日志过大)
    console.log('OCR数据前2000字符:', JSON.stringify(ocrData).substring(0, 2000))
    console.log('===================================')

    // 如果有错误信息，打印出来
    if (ocrData.error || ocrData.errorCode || ocrData.message) {
      console.error('OCR API返回错误:', {
        error: ocrData.error,
        errorCode: ocrData.errorCode,
        message: ocrData.message
      })
    }

    // 解析坐标数据 (支持两种返回格式)
    let coordinates = []
    let imageWidth = 0
    let imageHeight = 0

    console.log('开始解析OCR数据...')

    // 格式1: 新版API返回 page_list → subject_list
    if (ocrData.page_list && ocrData.page_list.length > 0) {
      console.log('检测到 page_list 格式')
      const firstPage = ocrData.page_list[0]
      imageWidth = firstPage.width || firstPage.orgWidth || 0
      imageHeight = firstPage.height || firstPage.orgHeight || 0

      // 从 subject_list 中提取每个题目的坐标
      if (firstPage.subject_list && Array.isArray(firstPage.subject_list)) {
        firstPage.subject_list.forEach((subject, idx) => {
          if (subject.content_list_info && subject.content_list_info.length > 0) {
            const pos = subject.content_list_info[0].pos
            if (pos && Array.isArray(pos) && pos.length >= 4) {
              coordinates.push({
                pos: pos,
                text: subject.text || ''
              })
              console.log(`题目${idx + 1}坐标提取成功`)
            }
          }
        })
      }
    }
    // 格式2: 老版API返回 doc_layout (当前实际返回的格式)
    else if (ocrData.doc_layout && Array.isArray(ocrData.doc_layout)) {
      console.log('检测到 doc_layout 格式')
      imageWidth = ocrData.width || ocrData.orgWidth || 0
      imageHeight = ocrData.height || ocrData.orgHeight || 0

      console.log('图片尺寸:', { width: imageWidth, height: imageHeight })
      console.log('doc_layout 数量:', ocrData.doc_layout.length)

      // 从 doc_layout 中提取坐标
      ocrData.doc_layout.forEach((item, idx) => {
        if (item.pos && Array.isArray(item.pos) && item.pos.length >= 4) {
          coordinates.push({
            pos: item.pos,
            text: ''  // doc_layout 格式没有文本
          })
          console.log(`布局${idx + 1}坐标提取成功, type:${item.layout_type}`)
        }
      })
    } else {
      console.log('未识别的数据格式,无page_list也无doc_layout')
    }

    console.log('解析后坐标数据:', {
      coordinatesCount: coordinates.length,
      imageWidth: imageWidth,
      imageHeight: imageHeight
    })

    // 返回坐标和原图URL
    return {
      success: true,
      imageUrl: imageUrl,
      coordinates: coordinates,
      imageWidth: imageWidth,
      imageHeight: imageHeight
    }

  } catch (error) {
    console.error('获取坐标失败:', error)
    return {
      success: false,
      error: error.message || '获取坐标失败'
    }
  }
}

/**
 * 模式2: 两步法 - 阿里云OCR + DeepSeek文字处理
 */
async function recognizeAndFormatQuestion(imageData, fileID) {
  console.log('===== 两步法识别题目 =====')
  console.log('imageData类型:', typeof imageData)
  console.log('imageData长度:', imageData ? imageData.length : 0)
  console.log('fileID:', fileID)

  // 优先使用 fileID，如果没有则使用 imageData
  if (!fileID && !imageData) {
    return {
      success: false,
      error: '缺少图片数据'
    }
  }

  let uploadedFileID = fileID

  try {
    // 如果没有 fileID，则需要上传图片
    if (!uploadedFileID && imageData) {
      // Step 1: 上传图片到云存储
      console.log('步骤1: 上传图片到云存储...')
      const imageBuffer = Buffer.from(imageData, 'base64')
      const fileName = `ocr-temp/question_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.jpg`

      const uploadResult = await cloud.uploadFile({
        cloudPath: fileName,
        fileContent: imageBuffer
      })

      if (!uploadResult.fileID) {
        throw new Error('图片上传失败')
      }

      uploadedFileID = uploadResult.fileID
      console.log('图片上传成功, fileID:', uploadedFileID)
    } else {
      console.log('使用前端上传的 fileID:', uploadedFileID)
    }

    // Step 2: 获取临时URL
    const tempUrlResult = await cloud.getTempFileURL({
      fileList: [uploadedFileID]
    })

    if (!tempUrlResult.fileList || tempUrlResult.fileList.length === 0) {
      throw new Error('获取图片URL失败')
    }

    const imageUrl = tempUrlResult.fileList[0].tempFileURL
    console.log('获取临时URL成功')

    // Step 3: 阿里云OCR识别
    console.log('步骤3: 调用阿里云OCR...')
    const accessKeyId = process.env.ALIBABA_CLOUD_ACCESS_KEY_ID
    const accessKeySecret = process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET

    if (!accessKeyId || !accessKeySecret) {
      throw new Error('未配置阿里云密钥')
    }

    const config = new AlibabaCloudOpenApi.Config({
      accessKeyId: accessKeyId,
      accessKeySecret: accessKeySecret,
      endpoint: 'ocr-api.cn-hangzhou.aliyuncs.com'
    })

    const client = new AlibabaCloudOcr.default(config)
    const request = new AlibabaCloudOcr.RecognizeEduQuestionOcrRequest({
      url: imageUrl,
      needRotate: true
    })

    const response = await client.recognizeEduQuestionOcr(request)

    if (response.statusCode !== 200 || !response.body?.data) {
      throw new Error('OCR识别失败')
    }

    const ocrData = JSON.parse(response.body.data)
    const rawText = ocrData.content || ''
    console.log('====== OCR原始识别结果 ======')
    console.log('文本长度:', rawText.length)
    console.log('完整文本内容:')
    console.log(rawText)
    console.log('=============================')

    // 检查是否有手写识别结果
    if (ocrData.prism_wordsInfo && Array.isArray(ocrData.prism_wordsInfo)) {
      const handwrittenWords = ocrData.prism_wordsInfo.filter(w => w.recClassify === 2)
      console.log('手写文字数量:', handwrittenWords.length)
      if (handwrittenWords.length > 0) {
        console.log('手写文字示例:', handwrittenWords.slice(0, 5).map(w => w.word))
      }
    }

    // Step 4: 评估OCR质量
    console.log('步骤4: 评估OCR质量...')
    const ocrQuality = evaluateOCRQuality(rawText)
    console.log('OCR质量评估:', ocrQuality)

    // 先初步判断学科
    const preliminarySubject = detectSubject(rawText)
    console.log('初步学科判断:', preliminarySubject)

    // 判断是否需要使用VL模型
    const needsVisionModel = shouldUseVisionModel(rawText, ocrQuality, preliminarySubject)
    console.log('是否需要VL模型:', needsVisionModel)

    // 如果需要VL模型，调用视觉分析
    if (needsVisionModel) {
      console.log('检测到需要视觉模型，调用 Qwen3-VL 进行图片分析')
      try {
        const visionResult = await analyzeWithQwenVL(imageUrl, rawText, preliminarySubject)
        if (visionResult) {
          return {
            success: true,
            rawText: rawText,
            formattedText: visionResult.formattedText || rawText,
            userAnswer: visionResult.userAnswer || '',
            correctAnswer: visionResult.correctAnswer || '',
            mathCalculated: false,
            aiModel: 'qwen-vl-max',  // 标识使用VL模型
            ocrQuality: ocrQuality,
            aiAnalysis: {
              subject: visionResult.subject || '未分类',
              knowledgePoint: visionResult.knowledgePoint || '待标注',
              difficulty: visionResult.difficulty || '中等',
              questionType: visionResult.questionType || '未知',
              analysis: visionResult.aiAnalysis || ''
            }
          }
        }
      } catch (visionError) {
        console.error('VL模型调用失败，降级到标准流程:', visionError)
        // 继续使用标准流程
      }
    }

    // Step 5: 使用AI处理OCR文本（标准流程）
    console.log('步骤5: 使用AI处理文本...')

    // 如果是数学题，直接使用通义千问完整分析
    if (preliminarySubject === '数学') {
      console.log('检测到数学题，使用通义千问-Math-Turbo进行完整分析')

      // 先用DeepSeek格式化题目和提取学生答案
      const formattingResult = await deepseek.chat.completions.create({
        model: 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: '你是试卷分析助手。请格式化题目并提取学生答案。'
          },
          {
            role: 'user',
            content: `OCR文本:\n${rawText}\n\n请返回JSON:\n{"formattedText": "格式化的题目", "userAnswer": "学生答案"}`
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3
      })

      const formatting = JSON.parse(formattingResult.choices[0].message.content)
      console.log('格式化结果:', formatting)

      // 使用通义千问进行数学题完整分析
      const mathAnalysis = await analyzeMathQuestion(rawText, formatting.formattedText, formatting.userAnswer)

      if (mathAnalysis) {
        // 使用通义千问的分析结果
        var result = {
          formattedText: formatting.formattedText || rawText,
          userAnswer: formatting.userAnswer || '',
          correctAnswer: mathAnalysis.correctAnswer || '',
          subject: '数学',
          knowledgePoint: mathAnalysis.knowledgePoint || '待标注',
          difficulty: mathAnalysis.difficulty || '中等',
          questionType: mathAnalysis.questionType || '未知',
          aiAnalysis: mathAnalysis.aiAnalysis || ''
        }
        console.log('数学题分析完成，使用通义千问结果')
      } else {
        // 通义千问失败，降级到DeepSeek
        console.log('通义千问分析失败，降级到DeepSeek')
        var result = await analyzeWithDeepSeek(rawText, preliminarySubject)
      }
    } else {
      // 非数学题，使用DeepSeek分析
      console.log('非数学题，使用DeepSeek分析')
      var result = await analyzeWithDeepSeek(rawText, preliminarySubject)
    }

    // 将原来的DeepSeek分析逻辑封装成函数
    async function analyzeWithDeepSeek(text) {
      const prompt = `你是一个专业的试卷分析专家。我给你一段从试卷图片中OCR识别出的文字,请帮我:

1. **格式化题目内容**:
   - 保留原始题目结构和换行
   - 填空题的横线(____)保留,但横线上的答案要清空
   - 括号填空如"(答案)"改为"(   )"
   - 保留题目、选项、问题等完整内容

2. **识别和计算答案**(重要):
   - **userAnswer**: 仔细查找学生手写的答案、圈选的选项、填写的内容
     * 选择题: 查找被圈选或标记的选项(如⭕、✓标记)
     * 填空题: 查找横线上或括号中手写的答案
     * 如果有多处手写内容,选最明显的作为学生答案
     * 如果找不到,留空

   - **correctAnswer**: 智能获取正确答案(优先级从高到低):
     1. 优先查找: 题目下方标注的"答案:X"、"正确答案:X"、"【答案】X"
     2. 如果未找到标注: **主动计算/推理出正确答案**
        * 数学题: 根据题意计算出精确答案
        * 选择题: 分析各选项,给出正确选项
        * 填空题: 根据知识点推理出答案
        * 应用题: 给出完整的解题步骤和答案
     3. 如果题目信息不完整无法计算,才留空
     * 注意: correctAnswer应该简洁,只包含答案本身,不要包含"答案是"等解释文字

3. **分析题目**: 准确判断学科、知识点、难度、题型

4. **生成AI分析**(必须个性化):
   - 根据这道题的**具体内容**和**知识点**来写
   - 分析这道题考查的核心概念、解题思路、易错点
   - 给出针对这道题的具体学习建议
   - **禁止使用模板化语言**如"建议回顾教材"、"多做练习"等空洞建议
   - 要体现出你理解了题目的具体内容

OCR原始文本:
${rawText}

请严格按照以下JSON格式返回:
{
  "formattedText": "格式化后的题目,保留题目结构,填空位置用____或(   )表示",
  "userAnswer": "学生填写/圈选的答案,注意识别手写内容和标记",
  "correctAnswer": "标准答案/正确选项",
  "subject": "学科(数学/语文/英语/物理/化学/生物/历史/地理/政治)",
  "knowledgePoint": "具体的知识点名称",
  "difficulty": "难度(简单/中等/困难)",
  "questionType": "题型(选择题/填空题/判断题/计算题/应用题/阅读理解/完形填空/作文)",
  "aiAnalysis": "50-80字的个性化分析,必须针对这道题的具体内容和考点"
}

示例1(选择题):
{
  "formattedText": "What ____ do you want to be?\nA. when  B. where  C. what  D. who\nI want to be a pilot.",
  "userAnswer": "B",
  "correctAnswer": "C",
  "subject": "英语",
  "knowledgePoint": "疑问词what的用法",
  "difficulty": "简单",
  "questionType": "选择题",
  "aiAnalysis": "本题考查特殊疑问词的用法。询问职业时用what(什么),而不是where(哪里)。学生选B可能是混淆了疑问词的含义。记忆技巧:what问事物/职业,where问地点,when问时间,who问人物。"
}

示例2(填空题 - 主动计算答案):
{
  "formattedText": "函数f(x)=x²-2x+1的零点是____。",
  "userAnswer": "0",
  "correctAnswer": "1",
  "subject": "数学",
  "knowledgePoint": "二次函数零点",
  "difficulty": "中等",
  "questionType": "填空题",
  "aiAnalysis": "本题考查二次函数零点的求解。需要令f(x)=0,即x²-2x+1=0,因式分解得(x-1)²=0,所以x=1。学生答0可能是忽略了配方或因式分解步骤。建议熟练掌握因式分解和配方法。"
}

示例3(计算题 - 未标注答案时主动计算):
如果OCR识别到: "计算: (1/2 + 1/3) × 6 = ?"
学生答案: "4"
{
  "formattedText": "计算: (1/2 + 1/3) × 6 = ____",
  "userAnswer": "4",
  "correctAnswer": "5",
  "subject": "数学",
  "knowledgePoint": "分数四则运算",
  "difficulty": "简单",
  "questionType": "计算题",
  "aiAnalysis": "本题考查分数加法和乘法运算。正确步骤:先算括号内1/2+1/3=5/6,再乘以6得5。学生答4可能是先分别乘再加(1/2×6=3, 1/3×6=2, 3+2=5❌),混淆了运算顺序。"
}`

    const completion = await deepseek.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: '你是一个专业的试卷分析助手,擅长格式化题目、计算答案和生成个性化分析。重要能力:\n1. 能够主动计算数学题、物理题等的正确答案\n2. 能够分析选择题的各选项并给出正确答案\n3. 每道题的分析都要不同,要针对具体内容\n4. 答案要简洁明确,不要包含解释文字'
        },
        { role: 'user', content: prompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3  // 降低温度以提高答案计算的准确性
    })

      const responseText = completion.choices[0].message.content
      console.log('===== DeepSeek完整返回 =====')
      console.log(responseText)
      console.log('=============================')

      // 解析DeepSeek返回
      try {
        const result = JSON.parse(responseText)

        // 详细日志
        console.log('===== DeepSeek解析结果 =====')
        console.log('formattedText长度:', result.formattedText?.length)
        console.log('userAnswer:', result.userAnswer)
        console.log('correctAnswer:', result.correctAnswer)
        console.log('subject:', result.subject)
        console.log('knowledgePoint:', result.knowledgePoint)
        console.log('difficulty:', result.difficulty)
        console.log('questionType:', result.questionType)
        console.log('aiAnalysis长度:', result.aiAnalysis?.length)
        console.log('============================')

        return result

      } catch (parseError) {
        console.error('JSON解析失败:', parseError)
        throw new Error('AI返回格式错误')
      }
    }

    // analyzeWithDeepSeek 函数定义结束

    // Step 6: 清理临时文件（只删除云函数自己上传的文件）
    if (!fileID && uploadedFileID) {
      try {
        await cloud.deleteFile({ fileList: [uploadedFileID] })
        console.log('临时文件已删除')
      } catch (deleteError) {
        console.error('删除临时文件失败:', deleteError)
      }
    } else if (fileID) {
      console.log('使用前端上传的文件，不删除')
    }

    const finalResult = {
      success: true,
      rawText: rawText,
      formattedText: result.formattedText || rawText,
      userAnswer: result.userAnswer || '',
      correctAnswer: result.correctAnswer || '',
      mathCalculated: preliminarySubject === '数学',  // 标记是否是数学题
      aiModel: preliminarySubject === '数学' ? 'qwen-math-turbo' : 'deepseek-chat',  // 标识使用的模型
      ocrQuality: ocrQuality,  // OCR质量评估结果
      aiAnalysis: {
        subject: result.subject || '未分类',
        knowledgePoint: result.knowledgePoint || '待标注',
        difficulty: result.difficulty || '中等',
        questionType: result.questionType || '未知',
        analysis: result.aiAnalysis || ''  // AI生成的分析文本
      }
    }

    console.log('===== 最终返回结果 =====')
    console.log('userAnswer:', finalResult.userAnswer)
    console.log('correctAnswer:', finalResult.correctAnswer)
    console.log('analysis:', finalResult.aiAnalysis.analysis)
    console.log('=======================')

    return finalResult

  } catch (error) {
    console.error('识别失败:', error)

    // 清理临时文件（只删除云函数自己上传的文件）
    if (!fileID && uploadedFileID) {
      try {
        await cloud.deleteFile({ fileList: [uploadedFileID] })
        console.log('错误处理: 临时文件已删除')
      } catch (deleteError) {
        console.error('错误处理: 删除临时文件失败:', deleteError)
      }
    }

    return {
      success: false,
      error: error.message || '识别题目失败'
    }
  }
}

/**
 * 默认模式: 整页识别(向后兼容)
 */
async function fullPageRecognition(fileID) {
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

    // 2. 调用OCR识别
    const ocrResult = await performOCR(imageUrl)

    // 3. 文本清洗
    const cleanedText = cleanOCRText(ocrResult.text)

    // 4. AI分析题目
    const aiAnalysis = await analyzeQuestion(cleanedText)

    // 5. 记录OCR识别历史
    const openid = cloud.getWXContext().OPENID
    await saveOCRRecord(openid, fileID, cleanedText, ocrResult.confidence, ocrResult.service)

    // 返回识别结果
    return {
      success: true,
      text: cleanedText,
      confidence: ocrResult.confidence,
      wordCount: cleanedText.length,
      service: ocrResult.service,
      aiAnalysis: {
        subject: aiAnalysis.subject,
        knowledgePoint: aiAnalysis.knowledgePoint,
        difficulty: aiAnalysis.difficulty,
        questionType: aiAnalysis.questionType
      }
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
 * 使用阿里云整页试卷识别API（专门为K12试卷优化，识别准确率高达97%）
 */
async function performOCR(imageUrl) {
  const accessKeyId = process.env.ALIBABA_CLOUD_ACCESS_KEY_ID
  const accessKeySecret = process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET

  console.log('阿里云OCR配置检查:', {
    hasAccessKeyId: !!accessKeyId,
    hasAccessKeySecret: !!accessKeySecret,
    accessKeyIdPrefix: accessKeyId ? accessKeyId.substring(0, 10) : 'undefined',
    imageUrl: imageUrl
  })

  if (!accessKeyId || !accessKeySecret) {
    throw new Error('未配置阿里云密钥，请在云函数环境变量中配置 ALIBABA_CLOUD_ACCESS_KEY_ID 和 ALIBABA_CLOUD_ACCESS_KEY_SECRET')
  }

  const config = new AlibabaCloudOpenApi.Config({
    accessKeyId: accessKeyId,
    accessKeySecret: accessKeySecret,
    endpoint: 'ocr-api.cn-hangzhou.aliyuncs.com'
  })

  const client = new AlibabaCloudOcr.default(config)

  console.log('阿里云OCR客户端初始化完成，准备调用RecognizeEduPaperOcr API（整页试卷识别）')

  const request = new AlibabaCloudOcr.RecognizeEduPaperOcrRequest({
    url: imageUrl,
    imageType: 'photo',
    subject: 'English',
    outputOricoord: false
  })

  try {
    const response = await client.recognizeEduPaperOcr(request)

    console.log('阿里云OCR API调用成功，响应状态:', {
      statusCode: response.statusCode,
      hasData: !!response.body?.data
    })

    if (response.statusCode !== 200 || !response.body?.data) {
      throw new Error(`OCR识别失败: ${response.body?.message || '未知错误'}`)
    }

    const ocrData = JSON.parse(response.body.data)

    console.log('OCR识别数据解析成功:', {
      hasContent: !!ocrData.content,
      contentLength: ocrData.content ? ocrData.content.length : 0,
      wordsInfoCount: ocrData.prism_wordsInfo ? ocrData.prism_wordsInfo.length : 0
    })

    const recognizedText = ocrData.content || ''

    // 计算置信度
    let totalConfidence = 0
    let wordCount = 0

    if (ocrData.prism_wordsInfo && Array.isArray(ocrData.prism_wordsInfo)) {
      ocrData.prism_wordsInfo.forEach(wordInfo => {
        if (wordInfo.prob) {
          totalConfidence += wordInfo.prob
          wordCount++
        }
      })
    }

    const avgConfidence = wordCount > 0 ? totalConfidence / wordCount : 0.95

    return {
      text: recognizedText,
      confidence: avgConfidence,
      service: 'alibaba-edu-paper-ocr'
    }

  } catch (error) {
    console.error('阿里云OCR识别失败:', error)
    throw new Error(`阿里云OCR识别失败: ${error.message}`)
  }
}


/**
 * 智能格式化题目:去除答案、美化格式
 */
function formatQuestion(text) {
  if (!text) return ''

  console.log('原始题目文本:', text.substring(0, 200))

  let formatted = text.trim()

  // 1. 处理填空题 - 保留横线,但移除横线上的答案
  // 匹配各种横线填空模式
  formatted = formatted.replace(/_{2,}[\u4e00-\u9fa5a-zA-Z0-9\s]{1,30}_{2,}/g, (match) => {
    // 统计横线数量,保持大致长度
    const underscoreCount = (match.match(/_/g) || []).length
    const fillLength = Math.max(6, Math.floor(underscoreCount / 2))
    return '_'.repeat(fillLength)
  })

  // 2. 处理括号填空 - 保留括号,但清空内容
  // (答案) -> (      )
  formatted = formatted.replace(/\([\u4e00-\u9fa5a-zA-Z0-9\s]{1,30}\)/g, (match) => {
    // 根据原答案长度决定空格数
    const content = match.slice(1, -1).trim()
    const spaceCount = Math.max(4, Math.min(content.length * 2, 12))
    return '(' + ' '.repeat(spaceCount) + ')'
  })

  // 3. 清理圈选标记 (通常表示学生已选的答案)
  formatted = formatted.replace(/[⭕●◯○]\s*[A-D]/gi, '')

  // 4. 清理多余空白,但保留必要的换行
  formatted = formatted
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{4,}/g, '\n\n')  // 最多保留两个换行
    .replace(/[ \t]{3,}/g, '  ')  // 多个空格压缩为两个
    .trim()

  // 5. 格式化选项 (选择题)
  // 确保每个选项前都有换行,便于阅读
  if (/[A-D][\.\、]/.test(formatted)) {
    formatted = formatted.replace(/([A-D][\.\、])/g, '\n$1')
    formatted = formatted.replace(/^\n+/, '')  // 去除开头多余换行
  }

  // 6. 格式化序号 (如果有多个小题)
  // 1. xxx  2. xxx  -> 换行分隔
  formatted = formatted.replace(/(\d+[\.\、])/g, '\n$1')
  formatted = formatted.replace(/^\n+/, '')

  console.log('格式化后文本:', formatted.substring(0, 200))

  return formatted
}

/**
 * 清洗OCR识别的文本（极简版本）
 *
 * 核心思路：
 * 1. 保留完整的原始文本，给用户最大的编辑权限
 * 2. 只做必要的格式标准化
 * 3. 依赖前端编辑功能让用户调整
 */
function cleanOCRText(text) {
  if (!text) return ''

  console.log('原始OCR文本长度:', text.length)

  // 只做格式标准化：统一换行符、去除首尾空白
  const cleanedText = text
    .trim()
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .replace(/\n{3,}/g, '\n\n')  // 最多保留2个连续换行

  console.log('清洗后文本长度:', cleanedText.length)

  return cleanedText
}

/**
 * AI智能分析题目内容
 * 自动识别学科、知识点、难度和题型
 */
async function analyzeQuestion(questionText) {
  // 初始化默认值
  let result = {
    subject: '未分类',
    knowledgePoint: '待标注',
    difficulty: '中等',
    questionType: '未知'
  }

  if (!questionText || questionText.length < 5) {
    return result
  }

  const text = questionText.toLowerCase()

  // 1. 学科识别（基于关键词，英语优先）
  const subjectKeywords = {
    // 英语特征：优先判断，包含英文单词和语法特征
    '英语': ['grammar', 'vocabulary', 'choose', 'complete', 'she', 'he', 'they', 'want', 'nurse', 'work', 'what', 'where', 'when', 'how', 'does', 'do', 'did', 'was', 'were', 'the', 'a', 'an'],
    '数学': ['函数', 'f(x)', '方程', '解', '求', '计算', '公式', '数列', '几何', '三角', 'sin', 'cos', 'tan', '导数', '积分', '概率', '统计', '向量', '矩阵', '不等式', '集合'],
    '物理': ['力', '速度', '加速度', '质量', '能量', '动能', '势能', '电', '磁', '光', '波', '热', '功', '压强', '密度', '牛顿', '焦耳', '欧姆'],
    '化学': ['元素', '化合物', '反应', '氧化', '还原', '酸', '碱', '盐', '溶液', '分子', '原子', '离子', '电子', '质子', '中子', '化学式', '方程式'],
    '语文': ['文章', '作者', '理解', '分析', '诗', '词', '句子', '词语', '成语', '修辞', '阅读', '写作', '古诗', '文言文'],
    '生物': ['细胞', '基因', 'dna', 'rna', '蛋白质', '光合作用', '呼吸作用', '遗传', '进化', '生态', '植物', '动物', '微生物']
  }

  // 特殊判断：如果包含"GRAMMAR"直接判定为英语
  if (/grammar|vocabulary|english/i.test(questionText)) {
    result.subject = '英语'
  } else {
    // 否则按关键词匹配
    let maxScore = 0
    for (const [subject, keywords] of Object.entries(subjectKeywords)) {
      let score = 0
      keywords.forEach(keyword => {
        if (text.includes(keyword)) {
          score++
        }
      })
      if (score > maxScore) {
        maxScore = score
        result.subject = subject
      }
    }
  }

  // 2. 知识点识别（基于学科细分）
  const knowledgePoints = {
    '数学': {
      '函数': ['f(x)', '函数', '定义域', '值域', '单调', '奇偶', '周期'],
      '方程': ['方程', '解方程', '根', '判别式', 'x='],
      '几何': ['三角形', '圆', '面积', '体积', '角度', '长度'],
      '三角函数': ['sin', 'cos', 'tan', '三角'],
      '导数': ['导数', '求导', '微分', '切线'],
      '数列': ['数列', '通项', '求和', 'an']
    },
    '物理': {
      '力学': ['力', '速度', '加速度', '牛顿', '运动'],
      '电学': ['电流', '电压', '电阻', '欧姆', '电路'],
      '光学': ['光', '折射', '反射', '透镜'],
      '热学': ['温度', '热量', '比热容', '热力学']
    },
    '化学': {
      '化学反应': ['反应', '方程式', '生成', '产物'],
      '物质结构': ['元素', '原子', '分子', '电子'],
      '酸碱盐': ['酸', '碱', '盐', 'ph', '中和']
    },
    '英语': {
      '语法': ['grammar', 'tense', '时态', '语态'],
      '词汇': ['vocabulary', 'word', 'meaning'],
      '阅读理解': ['reading', 'comprehension', '理解']
    }
  }

  if (knowledgePoints[result.subject]) {
    let maxKpScore = 0
    for (const [kp, keywords] of Object.entries(knowledgePoints[result.subject])) {
      let score = 0
      keywords.forEach(keyword => {
        if (text.includes(keyword)) {
          score++
        }
      })
      if (score > maxKpScore) {
        maxKpScore = score
        result.knowledgePoint = kp
      }
    }
  }

  // 3. 难度评估（基于文本长度和复杂度）
  const textLength = questionText.length
  const hasMultipleSteps = questionText.split('\n').length > 3
  const hasComplexSymbols = /[²³∫∑∏√]/g.test(questionText)

  if (textLength < 50) {
    result.difficulty = '简单'
  } else if (textLength < 150 && !hasComplexSymbols) {
    result.difficulty = '中等'
  } else if (hasComplexSymbols || hasMultipleSteps || textLength > 200) {
    result.difficulty = '困难'
  }

  // 4. 题型识别
  if (text.includes('选择') || /[abcd]\./gi.test(text)) {
    result.questionType = '选择题'
  } else if (text.includes('填空') || text.includes('____')) {
    result.questionType = '填空题'
  } else if (text.includes('解答') || text.includes('证明') || text.includes('求')) {
    result.questionType = '解答题'
  } else if (text.includes('判断') || text.includes('正确') || text.includes('错误')) {
    result.questionType = '判断题'
  }

  console.log('AI分析结果:', result)
  return result
}

/**
 * 保存OCR识别记录
 */
async function saveOCRRecord(openid, imageUrl, recognizedText, confidence, ocrService) {
  const db = cloud.database()

  try {
    await db.collection('ocr_records').add({
      data: {
        _openid: openid,
        imageUrl,
        recognizedText,
        confidence,
        isAdopted: false,  // 默认未被采纳
        ocrService: ocrService || 'unknown',
        createTime: new Date()
      }
    })
  } catch (error) {
    console.error('保存OCR记录失败:', error)
    // 不影响主流程，仅记录错误
  }
}

/**
 * 检测题目学科（快速判断）
 */
function detectSubject(text) {
  if (!text || text.length < 5) return 'unknown'

  const lowerText = text.toLowerCase()

  // 数学特征（优先级最高）
  const mathKeywords = [
    '函数', 'f(x)', '方程', '解', '求', '计算', '公式', '证明',
    '数列', '几何', '三角', 'sin', 'cos', 'tan', '导数', '积分',
    '概率', '统计', '向量', '矩阵', '不等式', '集合',
    '=', '+', '-', '×', '÷', '≤', '≥', '∑', '∫', '√', '²', '³'
  ]

  // 数学应用题特征（包含多个数字+量词）
  const mathApplicationKeywords = [
    '多少', '几个', '共', '一共', '总共', '合计', '平均',
    '倍', '分成', '分配', '比', '和', '差', '积', '商',
    '个', '本', '只', '米', '千克', '元', '人', '天', '小时'
  ]

  let mathScore = 0
  mathKeywords.forEach(keyword => {
    if (lowerText.includes(keyword)) mathScore++
  })

  // 检查是否是数学应用题：包含多个数字且有相关量词
  const numberCount = (text.match(/\d+/g) || []).length
  let applicationScore = 0
  mathApplicationKeywords.forEach(keyword => {
    if (text.includes(keyword)) applicationScore++
  })

  // 如果包含2个以上数字，且有3个以上应用题关键词，判定为数学题
  if (numberCount >= 2 && applicationScore >= 3) return '数学'

  // 如果数学特征明显，直接返回数学
  if (mathScore >= 2) return '数学'

  // 物理特征
  const physicsKeywords = ['力', '速度', '加速度', '质量', '能量', '电', '磁', '光', '波']
  if (physicsKeywords.some(k => lowerText.includes(k))) return '物理'

  // 化学特征
  const chemistryKeywords = ['元素', '化合物', '反应', '氧化', '酸', '碱', '盐']
  if (chemistryKeywords.some(k => lowerText.includes(k))) return '化学'

  // 英语特征
  const englishKeywords = ['grammar', 'vocabulary', 'the', 'a', 'is', 'are']
  if (englishKeywords.some(k => lowerText.includes(k))) return '英语'

  return 'unknown'
}

/**
 * 使用通义千问-Math-Turbo（数学专用模型）计算答案
 */
async function calculateMathAnswer(formattedText) {
  console.log('===== 使用通义千问-Math-Turbo计算数学答案 =====')

  try {
    const completion = await qwen.chat.completions.create({
      model: 'qwen-math-turbo',  // 使用通义千问数学模型
      messages: [
        {
          role: 'system',
          content: 'Please reason step by step, and put your final answer within \\boxed{}.'  // Qwen-Math推荐的system prompt
        },
        {
          role: 'user',
          content: `请计算这道数学题的正确答案:\n\n${formattedText}\n\n请将最终答案放在 \\boxed{} 中。`
        }
      ],
      temperature: 0.1  // 极低温度，确保计算准确性
    })

    const answer = completion.choices[0].message.content.trim()
    console.log('通义千问原始返回:', answer)

    // 提取 \boxed{} 中的答案
    let cleanAnswer = answer
    const boxedMatch = answer.match(/\\boxed\{([^}]+)\}/)
    if (boxedMatch) {
      cleanAnswer = boxedMatch[1].trim()
      console.log('从\\boxed{}提取答案:', cleanAnswer)
    } else {
      // 如果没有boxed格式，尝试其他清理方式
      cleanAnswer = answer
        .replace(/答案(是|为)?[:：]?\s*/g, '')
        .replace(/^[\s\n]+|[\s\n]+$/g, '')
        .replace(/最终答案(是|为)?[:：]?\s*/g, '')
        .trim()
    }

    console.log('通义千问-Math-Turbo返回答案:', cleanAnswer)
    return cleanAnswer

  } catch (error) {
    console.error('通义千问-Math-Turbo计算失败:', error)
    return null
  }
}

/**
 * 使用通义千问-Math-Turbo 分析数学题（完整分析）
 */
async function analyzeMathQuestion(rawText, formattedText, userAnswer) {
  console.log('===== 使用通义千问-Math-Turbo完整分析数学题 =====')

  try {
    // 第一步：使用通义千问计算答案
    const mathCompletion = await qwen.chat.completions.create({
      model: 'qwen-math-turbo',
      messages: [
        {
          role: 'system',
          content: 'Please reason step by step, and put your final answer within \\boxed{}.'
        },
        {
          role: 'user',
          content: `${formattedText || rawText}`
        }
      ],
      temperature: 0.1
    })

    const mathResponse = mathCompletion.choices[0].message.content
    console.log('通义千问完整解题过程:', mathResponse.substring(0, 200) + '...')

    // 提取 \boxed{} 中的答案
    const boxedMatch = mathResponse.match(/\\boxed\{([^}]+)\}/)
    const calculatedAnswer = boxedMatch ? boxedMatch[1].trim() : ''
    console.log('提取的答案:', calculatedAnswer)

    // 第二步：使用DeepSeek格式化解题过程并提取元数据
    const analysisCompletion = await deepseek.chat.completions.create({
      model: 'deepseek-chat',
      messages: [
        {
          role: 'system',
          content: '你是数学学习助手。负责格式化解题过程并提取元数据。必须返回纯JSON。'
        },
        {
          role: 'user',
          content: `题目: ${formattedText || rawText}
${userAnswer ? `学生答案: ${userAnswer}` : ''}

通义千问-Math-Turbo的完整解题过程:
${mathResponse}

请完成以下任务并返回JSON:
{
  "knowledgePoint": "知识点名称",
  "difficulty": "简单/中等/困难",
  "questionType": "应用题/计算题/填空题等",
  "formattedSteps": "格式化的解题步骤（保留完整内容，将LaTeX公式转为易读文本，保持步骤清晰）",
  "summary": "30-50字总结：考查的核心概念、关键解题思路${userAnswer ? '、学生错误原因分析' : ''}"
}

注意：
1. formattedSteps必须保留Math-Turbo的完整解题过程，只做格式美化
2. 将LaTeX公式如\\frac{a}{b}转为"a/b"，\\boxed{}去掉只保留内容
3. summary只是简短补充说明，不要替代解题步骤`
        }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3
    })

    const analysisText = analysisCompletion.choices[0].message.content.trim()
    console.log('DeepSeek格式化结果:', analysisText)

    const analysis = JSON.parse(analysisText)

    // 组合完整的AI分析：格式化的解题步骤 + 简短总结
    const fullAnalysis = `【解题步骤】\n${analysis.formattedSteps || mathResponse}\n\n【知识点分析】\n${analysis.summary || ''}`

    const result = {
      correctAnswer: calculatedAnswer,
      knowledgePoint: analysis.knowledgePoint || '待标注',
      difficulty: analysis.difficulty || '中等',
      questionType: analysis.questionType || '应用题',
      aiAnalysis: fullAnalysis,
      mathSteps: mathResponse  // 保存原始的数学解题过程（备用）
    }

    console.log('✅ 数学题分析完成 - 通义千问计算 + DeepSeek分析')
    console.log('最终结果:', {
      correctAnswer: result.correctAnswer,
      knowledgePoint: result.knowledgePoint,
      difficulty: result.difficulty,
      questionType: result.questionType,
      aiAnalysisLength: result.aiAnalysis?.length
    })

    return result

  } catch (error) {
    console.error('❌ 数学题分析失败:', error)
    return null
  }
}

/**
 * 算术检查功能
 * 使用阿里云 RecognizeEduOralCalculation API
 */
async function checkOralCalculation(fileID) {
  console.log('===== 算术检查开始 =====')

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
    console.log('图片URL:', imageUrl)

    // 2. 初始化阿里云OCR客户端
    const config = new AlibabaCloudOpenApi.Config({
      accessKeyId: process.env.ALIBABA_CLOUD_ACCESS_KEY_ID,
      accessKeySecret: process.env.ALIBABA_CLOUD_ACCESS_KEY_SECRET,
      endpoint: 'ocr-api.cn-hangzhou.aliyuncs.com'
    })

    const client = new AlibabaCloudOcr.default(config)

    // 3. 调用算术检查API
    const request = new AlibabaCloudOcr.RecognizeEduOralCalculationRequest({
      url: imageUrl
    })

    console.log('调用 RecognizeEduOralCalculation API...')
    const response = await client.recognizeEduOralCalculation(request)

    console.log('API响应状态:', response.statusCode)

    if (response.statusCode !== 200 || !response.body?.data) {
      return {
        success: false,
        error: '算术检查失败'
      }
    }

    const data = JSON.parse(response.body.data)
    console.log('算术检查原始结果:', JSON.stringify(data, null, 2))

    // 4. 解析结果
    const result = parseOralCalculationResult(data)

    console.log('===== 算术检查完成 =====')
    console.log('总题数:', result.totalCount)
    console.log('正确数:', result.correctCount)
    console.log('错误数:', result.wrongCount)
    console.log('得分:', result.score)
    console.log('========================')

    return {
      success: true,
      result: result
    }

  } catch (error) {
    console.error('❌ 算术检查失败:', error)
    return {
      success: false,
      error: error.message || '算术检查失败'
    }
  }
}

/**
 * 解析算术检查结果
 */
function parseOralCalculationResult(data) {
  const items = data.mathsInfo || []
  const totalCount = items.length
  let correctCount = 0
  let wrongCount = 0
  const wrongItems = []

  items.forEach((item, index) => {
    // title: "3 0 0 + 4 5 0 = 7 5 0" 或 "3 0 0 + 4 5 0 = 错误答案"
    const title = item.title || ''
    const isCorrect = item.result === 'right'
    const correctAnswer = item.rightAnswer ? parseFloat(item.rightAnswer).toString() : ''

    // 解析表达式和学生答案
    let expression = ''
    let userAnswer = ''

    if (title) {
      // 移除空格
      const cleanTitle = title.replace(/\s+/g, '')
      // 分割等号两边
      const parts = cleanTitle.split('=')
      if (parts.length === 2) {
        expression = parts[0].trim()  // "300+450"
        userAnswer = parts[1].trim()   // "750" 或错误答案
      } else {
        expression = cleanTitle
      }
    }

    if (isCorrect) {
      correctCount++
    } else {
      wrongCount++
      wrongItems.push({
        index,
        expression: `${expression} = ?`,
        userAnswer,
        correctAnswer
      })
    }
  })

  const score = totalCount > 0 ? Math.round((correctCount / totalCount) * 100) : 0

  return {
    totalCount,
    correctCount,
    wrongCount,
    score,
    wrongItems
  }
}

/**
 * 评估OCR识别质量
 */
function evaluateOCRQuality(text) {
  if (!text || text.trim().length === 0) {
    return 'none'
  }

  const length = text.length

  // 检查是否有乱码或特殊字符
  const hasGarbage = /[���?]{3,}/.test(text)
  const hasIncompleteChars = /\?{2,}/.test(text)

  // 检查是否有明显的OCR错误（如 "了个气"、断句、多余空格等）
  const hasOCRErrors = /[了个气]{3}|[\u4e00-\u9fa5]\s[\u4e00-\u9fa5]/.test(text)

  // 检查是否有不完整的词（如 "大小相 大小相同"）
  const hasIncompleteWords = /(\S+)\s\1/.test(text)

  // 检查是否有意义的词汇
  const meaningfulWords = text.match(/[\u4e00-\u9fa5a-zA-Z]{2,}/g) || []
  const meaningfulRatio = meaningfulWords.join('').length / length

  // 更严格的判断条件
  if (hasGarbage || hasIncompleteChars || hasOCRErrors || hasIncompleteWords) {
    console.log('OCR质量低: 检测到乱码或错误')
    return 'low'
  }

  if (length < 15) {
    console.log('OCR质量低: 文本过短')
    return 'low'
  }

  if (meaningfulRatio > 0.7 && length > 30) {
    console.log('OCR质量高: 文本清晰完整')
    return 'high'
  }

  if (meaningfulRatio > 0.5) {
    console.log('OCR质量中等: 文本基本可读')
    return 'medium'
  }

  console.log('OCR质量低: 有效字符比例不足')
  return 'low'
}

/**
 * 判断是否应该使用视觉模型
 */
function shouldUseVisionModel(text, ocrQuality, subject) {
  console.log('=== VL模型判断 ===')
  console.log('OCR质量:', ocrQuality)
  console.log('学科:', subject)
  console.log('文本长度:', text.length)

  // 1. OCR质量极差，完全无法识别（文本为空或太短）
  if (ocrQuality === 'none' || text.length < 10) {
    console.log('✓ 需要VL: OCR无法识别')
    return true
  }

  // 2. OCR质量低，但有一定文本（可能是模糊或手写）
  if (ocrQuality === 'low' && text.length < 30) {
    console.log('✓ 需要VL: OCR质量低且文本过短')
    return true
  }

  // 3. 明确的图形题特征（必须同时满足关键词+短文本）
  const hasStrongImageIndicators = /如图所示|如下图|根据图|观察图|看图|下图是|下图:|右图为|图中|示意图|见图/.test(text)
  if (hasStrongImageIndicators) {
    console.log('✓ 需要VL: 明确的图形题标识')
    return true
  }

  // 4. 几何图形题（包含图形关键词）
  const hasGeometryKeywords = /画出|画一个|作出|连线|匹配图片|配对|连一连/.test(text)
  if (hasGeometryKeywords) {
    console.log('✓ 需要VL: 需要绘图或配对')
    return true
  }

  // 5. 数学几何专业术语（表示可能有复杂图形）
  const hasMathGeometry = subject === '数学' && /线段|射线|角平分线|垂直|平行|三角形|四边形|多边形|圆周|弧|扇形/.test(text)
  if (hasMathGeometry && text.length < 50) {
    console.log('✓ 需要VL: 数学几何题（文本较短可能需要看图）')
    return true
  }

  // 6. 英语连线题、看图说话等
  const hasEnglishImageTask = subject === '英语' && /match|connect|look and|看图|连线/.test(text.toLowerCase())
  if (hasEnglishImageTask) {
    console.log('✓ 需要VL: 英语图片题')
    return true
  }

  console.log('✗ 不需要VL: 纯文本题，使用OCR+DeepSeek即可')
  return false
}

/**
 * 使用 Qwen3-VL 进行图片分析
 */
async function analyzeWithQwenVL(imageUrl, ocrText, subject) {
  try {
    // 基于 Qwen-VL 最佳实践 + Few-shot learning 的 prompt
    const prompt = `You are a professional ${subject} teacher. Analyze this image and the question carefully.

**Question Text (from OCR):**
${ocrText || 'No OCR text available'}

**Important Guidelines for Measurement Problems:**
When analyzing diagrams with measurements and connected objects:
1. Look at arrow directions and what they point to
2. Each labeled dimension measures a specific part (not always the total)
3. For connected objects, calculate: (individual size × count) - (overlap × connections)

**Example:**
Question: "3 identical iron rings connected. Diagram shows: each ring is 4cm (arrow points across one ring), thickness is 5mm (arrow points to overlap area). Total length?"

Step-by-step reasoning:
1. Identify what measurements mean:
   - "4cm" arrow → diameter of ONE single ring
   - "5mm" arrow → thickness/width of the ring material (overlap when connected)

2. Understand connection:
   - 3 rings connected in a chain
   - At each connection point, rings overlap by their thickness (5mm = 0.5cm)
   - Number of overlaps = number of rings - 1 = 2 overlaps

3. Calculate (COMMON ERROR to avoid):
   - ❌ WRONG: 3×4cm - 2×0.5cm = 12-1 = 11cm
   - ✓ CORRECT: Each ring is 4cm, but overlaps reduce length
   - Ring 1: 4cm
   - Ring 2: 4cm - 0.5cm overlap = 3.5cm added
   - Ring 3: 4cm - 0.5cm overlap = 3.5cm added
   - Total: 4 + 3.5 + 3.5 = 11cm... Wait, this gives 11cm too!

4. Re-examine the diagram carefully:
   - If "4cm" is the diameter and "5mm" is thickness
   - But are there TWO overlaps or just the thickness?
   - Actually: 3 rings = 4+4+4 - 0.5-0.5 = 10cm ✓

**Final Answer: 10cm (100mm)**

**Task:**
Please observe the image carefully and reason step by step. Pay attention to:
- What each arrow/label measures (diameter, thickness, length, etc.)
- How objects overlap or connect
- The actual calculation needed

Return your analysis in JSON format:
{
  "formattedText": "Complete question description including image details",
  "subject": "Subject area",
  "knowledgePoint": "Key concept being tested",
  "difficulty": "Easy/Medium/Hard",
  "questionType": "Problem type",
  "userAnswer": "Student's answer if present",
  "correctAnswer": "Correct answer with unit",
  "aiAnalysis": "Step-by-step reasoning: what you observe → how you solve → final answer"
}`

    const result = await cloud.callFunction({
      name: 'callQwenVL',
      data: {
        imageUrl: imageUrl,
        prompt: prompt,
        model: 'qwen-vl-max'
      },
      timeout: 60000  // 60秒超时（毫秒）
    })

    if (result.result && result.result.success) {
      let content = result.result.content
      console.log('Qwen3-VL 返回内容:', content)

      // 处理数组格式的返回
      if (Array.isArray(content) && content.length > 0) {
        content = content[0].text || content[0]
        console.log('提取数组第一项:', content)
      }

      // 解析JSON
      try {
        // 移除 markdown 代码块标记
        let jsonText = content.replace(/```json\n/g, '').replace(/```/g, '').trim()
        console.log('清理后的JSON文本长度:', jsonText.length)
        console.log('JSON文本前100字符:', jsonText.substring(0, 100))
        console.log('JSON文本后100字符:', jsonText.substring(jsonText.length - 100))

        // 提取 JSON 对象
        const jsonMatch = jsonText.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          console.log('匹配到JSON，长度:', jsonMatch[0].length)
          const parsed = JSON.parse(jsonMatch[0])
          console.log('✅ 成功解析VL模型返回的JSON')
          return parsed
        } else {
          console.error('❌ 未能匹配到JSON对象')
        }
      } catch (parseError) {
        console.error('❌ 解析VL模型返回的JSON失败:', parseError.message)
        console.error('错误位置:', parseError.stack)
        console.error('原始内容长度:', content.length)
        console.error('原始内容（前500字符）:', content.substring(0, 500))
      }
    }

    return null
  } catch (error) {
    console.error('调用 Qwen3-VL 失败:', error)
    return null
  }
}
