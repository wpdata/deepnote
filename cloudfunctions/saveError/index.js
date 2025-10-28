// 云函数：保存错题
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

/**
 * 保存错题云函数
 * 功能：将错题保存到数据库，并更新统计信息
 *
 * @param {Object} event
 * @param {string} event.content - 题目内容
 * @param {string} event.subject - 学科
 * @param {string} event.knowledgePoint - 知识点
 * @param {string} event.imageUrl - 题目图片URL（可选）
 * @param {string} event.difficulty - 难度（可选）
 * @returns {Object} 保存结果
 */
exports.main = async (event, context) => {
  const {
    content,
    subject,
    knowledgePoint,
    imageUrl = '',
    difficulty = 'medium',
    questionType = '未知',
    userAnswer = '',
    correctAnswer = '',
    isCorrect = null,
    aiAnalysisText = '',    // AI分析文本
    mode = 'add',           // 新增模式参数: 'add'=新增, 'update'=更新
    errorId = null          // 更新时需要提供errorId
  } = event

  // 获取用户身份信息
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID || 'test_user_openid'

  // 获取 userId（从数据库查询）
  let userId = null
  try {
    const userQuery = await db.collection('users').where({
      openId: openid
    }).get()

    if (userQuery.data.length > 0) {
      userId = userQuery.data[0]._id
    }
  } catch (error) {
    console.error('获取userId失败:', error)
  }

  // 参数验证
  if (!content || !subject || !knowledgePoint) {
    return {
      success: false,
      error: '缺少必要参数：content, subject, knowledgePoint'
    }
  }

  try {
    // 更新模式
    if (mode === 'update' && errorId) {
      const updateResult = await db.collection('errors')
        .doc(errorId)
        .update({
          data: {
            subject,
            knowledgePoint,
            difficulty,
            questionType,
            content,
            imageUrl,
            userAnswer,
            correctAnswer,
            isCorrect,
            answer: correctAnswer || '',
            aiAnalysis: aiAnalysisText,  // 更新AI分析
            updateTime: new Date()
          }
        })

      return {
        success: true,
        errorId,
        mode: 'update',
        message: '错题更新成功'
      }
    }

    // 新增模式
    const errorResult = await db.collection('errors').add({
      data: {
        _openid: openid,
        userId: userId,    // 新增 userId 字段
        subject,
        knowledgePoint,
        difficulty,
        questionType,
        content,
        imageUrl,
        // 答案相关字段
        userAnswer,        // 学生填写的答案
        correctAnswer,     // 正确答案
        isCorrect,         // 是否正确 (true/false/null)
        answer: correctAnswer || '',  // 兼容旧字段
        // AI分析
        aiAnalysis: aiAnalysisText,  // DeepSeek生成的专业分析
        // 练习统计
        mastered: false,
        masteredTime: null,
        practiceCount: 0,
        correctCount: 0,
        wrongCount: 0,
        lastPracticeTime: null,
        relatedKnowledge: [],
        createTime: new Date(),
        updateTime: new Date()
      }
    })

    const newErrorId = errorResult._id

    // 2. 更新用户统计
    await updateUserStats(openid, 'addError')

    // 3. 更新知识点统计
    await updateKnowledgeStats(openid, subject, knowledgePoint, 'addError')

    // 4. 如果有OCR记录，标记为已采纳
    if (imageUrl) {
      await markOCRAsAdopted(openid, imageUrl, newErrorId)
    }

    return {
      success: true,
      errorId: newErrorId,
      message: '错题保存成功'
    }

  } catch (error) {
    console.error('保存错题失败:', error)
    return {
      success: false,
      error: error.message || '保存错题失败'
    }
  }
}

/**
 * 更新用户统计数据
 */
async function updateUserStats(openid, action) {
  const _ = db.command

  try {
    // 查询用户是否存在
    const userResult = await db.collection('users')
      .where({ _openid: openid })
      .get()

    if (userResult.data.length === 0) {
      // 创建新用户
      await db.collection('users').add({
        data: {
          _openid: openid,
          studyDays: 1,
          totalErrors: action === 'addError' ? 1 : 0,
          masteredErrors: 0,
          practiceCount: 0,
          createTime: new Date(),
          updateTime: new Date()
        }
      })
    } else {
      // 更新现有用户
      const updates = {
        updateTime: new Date()
      }

      if (action === 'addError') {
        updates.totalErrors = _.inc(1)
      } else if (action === 'markMastered') {
        updates.masteredErrors = _.inc(1)
      } else if (action === 'practice') {
        updates.practiceCount = _.inc(1)
      }

      await db.collection('users')
        .where({ _openid: openid })
        .update({
          data: updates
        })
    }
  } catch (error) {
    console.error('更新用户统计失败:', error)
  }
}

/**
 * 更新知识点统计
 */
async function updateKnowledgeStats(openid, subject, knowledgePoint, action) {
  const _ = db.command

  try {
    // 查询知识点统计是否存在
    const statsResult = await db.collection('knowledge_stats')
      .where({
        _openid: openid,
        subject,
        knowledgePoint
      })
      .get()

    if (statsResult.data.length === 0) {
      // 创建新的知识点统计
      await db.collection('knowledge_stats').add({
        data: {
          _openid: openid,
          subject,
          knowledgePoint,
          totalErrors: action === 'addError' ? 1 : 0,
          masteredErrors: 0,
          masteredRate: 0,
          practiceCount: 0,
          correctCount: 0,
          wrongCount: 0,
          lastPracticeTime: null,
          createTime: new Date(),
          updateTime: new Date()
        }
      })
    } else {
      // 更新现有统计
      const updates = {
        updateTime: new Date()
      }

      if (action === 'addError') {
        updates.totalErrors = _.inc(1)
      } else if (action === 'markMastered') {
        updates.masteredErrors = _.inc(1)
      }

      // 重新计算掌握率
      const stats = statsResult.data[0]
      const newMasteredErrors = action === 'markMastered'
        ? stats.masteredErrors + 1
        : stats.masteredErrors
      const newTotalErrors = action === 'addError'
        ? stats.totalErrors + 1
        : stats.totalErrors

      updates.masteredRate = newTotalErrors > 0
        ? Math.round((newMasteredErrors / newTotalErrors) * 100)
        : 0

      await db.collection('knowledge_stats')
        .where({
          _openid: openid,
          subject,
          knowledgePoint
        })
        .update({
          data: updates
        })
    }
  } catch (error) {
    console.error('更新知识点统计失败:', error)
  }
}

/**
 * 标记OCR记录为已采纳
 */
async function markOCRAsAdopted(openid, imageUrl, errorId) {
  try {
    await db.collection('ocr_records')
      .where({
        _openid: openid,
        imageUrl
      })
      .update({
        data: {
          isAdopted: true,
          errorId
        }
      })
  } catch (error) {
    console.error('标记OCR记录失败:', error)
  }
}
