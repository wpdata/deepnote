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
    difficulty = 'medium'
  } = event

  // 获取openid，测试环境使用固定值
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID || 'test_user_openid'

  // 参数验证
  if (!content || !subject || !knowledgePoint) {
    return {
      success: false,
      error: '缺少必要参数：content, subject, knowledgePoint'
    }
  }

  try {
    // 1. 保存错题到 errors 集合
    const errorResult = await db.collection('errors').add({
      data: {
        _openid: openid,
        subject,
        knowledgePoint,
        difficulty,
        content,
        imageUrl,
        answer: '',  // 待填充
        mastered: false,
        masteredTime: null,
        practiceCount: 0,
        correctCount: 0,
        wrongCount: 0,
        lastPracticeTime: null,
        aiAnalysis: null,  // 待AI分析
        relatedKnowledge: [],
        createTime: new Date(),
        updateTime: new Date()
      }
    })

    const errorId = errorResult._id

    // 2. 更新用户统计
    await updateUserStats(openid, 'addError')

    // 3. 更新知识点统计
    await updateKnowledgeStats(openid, subject, knowledgePoint, 'addError')

    // 4. 如果有OCR记录，标记为已采纳
    if (imageUrl) {
      await markOCRAsAdopted(openid, imageUrl, errorId)
    }

    return {
      success: true,
      errorId,
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
