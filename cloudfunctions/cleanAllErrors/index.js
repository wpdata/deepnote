// 云函数: 清理所有错题数据和图片
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

exports.main = async (event, context) => {
  const { targetOpenid, cleanAll } = event
  const wxContext = cloud.getWXContext()
  const openid = targetOpenid || wxContext.OPENID

  try {
    console.log('开始清理数据, openid:', openid, 'cleanAll:', cleanAll)

    // 1. 获取错题 (如果是cleanAll则获取所有错题)
    let query = db.collection('errors')
    if (!cleanAll && openid) {
      query = query.where({ _openid: openid })
    }

    const errorsRes = await query.get()

    console.log(`找到 ${errorsRes.data.length} 条错题记录`)

    // 2. 删除所有错题图片
    const fileIDs = []
    errorsRes.data.forEach(error => {
      if (error.imageUrl && error.imageUrl.startsWith('cloud://')) {
        fileIDs.push(error.imageUrl)
      }
    })

    if (fileIDs.length > 0) {
      console.log(`准备删除 ${fileIDs.length} 个图片文件`)
      try {
        await cloud.deleteFile({
          fileList: fileIDs
        })
        console.log('图片文件删除成功')
      } catch (deleteError) {
        console.error('删除图片文件失败:', deleteError)
      }
    }

    // 3. 删除所有错题记录
    const deletePromises = errorsRes.data.map(error =>
      db.collection('errors').doc(error._id).remove()
    )
    await Promise.all(deletePromises)
    console.log('错题记录删除成功')

    // 4. 清空知识点统计
    let statsQuery = db.collection('knowledge_stats')
    if (!cleanAll && openid) {
      statsQuery = statsQuery.where({ _openid: openid })
    }
    const statsRes = await statsQuery.get()

    const statsDeletePromises = statsRes.data.map(stat =>
      db.collection('knowledge_stats').doc(stat._id).remove()
    )
    await Promise.all(statsDeletePromises)
    console.log('知识点统计清空成功')

    // 5. 重置用户统计
    if (!cleanAll && openid) {
      await db.collection('users')
        .where({ _openid: openid })
        .update({
          data: {
            totalErrors: 0,
            masteredErrors: 0,
            practiceCount: 0,
            updateTime: new Date()
          }
        })
      console.log('用户统计重置成功')
    } else if (cleanAll) {
      // 清空所有用户统计
      const usersRes = await db.collection('users').get()
      const userUpdatePromises = usersRes.data.map(user =>
        db.collection('users').doc(user._id).update({
          data: {
            totalErrors: 0,
            masteredErrors: 0,
            practiceCount: 0,
            updateTime: new Date()
          }
        })
      )
      await Promise.all(userUpdatePromises)
      console.log('所有用户统计重置成功')
    }

    return {
      success: true,
      message: `清理完成! 删除了 ${errorsRes.data.length} 条错题记录和 ${fileIDs.length} 个图片文件`,
      deletedErrors: errorsRes.data.length,
      deletedFiles: fileIDs.length
    }
  } catch (error) {
    console.error('清理失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}
