// 云函数：更新错题掌握状态
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()
const _ = db.command

/**
 * 更新错题掌握状态云函数
 * 功能：标记错题为已掌握/未掌握
 *
 * @param {Object} event
 * @param {string} event.errorId - 错题ID
 * @param {boolean} event.mastered - 是否已掌握
 * @returns {Object} 更新结果
 */
exports.main = async (event, context) => {
  const { errorId, mastered } = event
  const openid = cloud.getWXContext().OPENID

  if (!errorId || typeof mastered !== 'boolean') {
    return {
      success: false,
      error: '缺少必要参数'
    }
  }

  try {
    // 1. 查询错题信息
    const errorResult = await db.collection('errors')
      .doc(errorId)
      .get()

    if (!errorResult.data) {
      return {
        success: false,
        error: '错题不存在'
      }
    }

    const error = errorResult.data

    // 验证权限
    if (error._openid !== openid) {
      return {
        success: false,
        error: '无权操作此错题'
      }
    }

    // 2. 更新错题状态
    const updateData = {
      mastered,
      updateTime: new Date()
    }

    if (mastered) {
      updateData.masteredTime = new Date()
    }

    await db.collection('errors')
      .doc(errorId)
      .update({
        data: updateData
      })

    // 3. 更新用户统计
    if (mastered && !error.mastered) {
      // 从未掌握变为已掌握
      await db.collection('users')
        .where({ _openid: openid })
        .update({
          data: {
            masteredErrors: _.inc(1),
            updateTime: new Date()
          }
        })
    } else if (!mastered && error.mastered) {
      // 从已掌握变为未掌握
      await db.collection('users')
        .where({ _openid: openid })
        .update({
          data: {
            masteredErrors: _.inc(-1),
            updateTime: new Date()
          }
        })
    }

    // 4. 更新知识点统计
    await updateKnowledgeStats(
      openid,
      error.subject,
      error.knowledgePoint,
      mastered,
      error.mastered
    )

    return {
      success: true,
      message: mastered ? '已标记为掌握' : '已标记为未掌握'
    }

  } catch (error) {
    console.error('更新错题状态失败:', error)
    return {
      success: false,
      error: error.message || '更新错题状态失败'
    }
  }
}

/**
 * 更新知识点统计
 */
async function updateKnowledgeStats(openid, subject, knowledgePoint, newMastered, oldMastered) {
  try {
    const statsResult = await db.collection('knowledge_stats')
      .where({
        _openid: openid,
        subject,
        knowledgePoint
      })
      .get()

    if (statsResult.data.length === 0) return

    const stats = statsResult.data[0]
    let masteredErrors = stats.masteredErrors

    if (newMastered && !oldMastered) {
      masteredErrors += 1
    } else if (!newMastered && oldMastered) {
      masteredErrors -= 1
    }

    const masteredRate = stats.totalErrors > 0
      ? Math.round((masteredErrors / stats.totalErrors) * 100)
      : 0

    await db.collection('knowledge_stats')
      .where({
        _openid: openid,
        subject,
        knowledgePoint
      })
      .update({
        data: {
          masteredErrors,
          masteredRate,
          updateTime: new Date()
        }
      })

  } catch (error) {
    console.error('更新知识点统计失败:', error)
  }
}
