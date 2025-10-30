// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: cloud.DYNAMIC_CURRENT_ENV
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const { errorId, favorited } = event
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID

  try {
    // 更新错题的收藏状态
    await db.collection('errors').doc(errorId).update({
      data: {
        favorited: favorited,
        updateTime: db.serverDate()
      }
    })

    return {
      success: true,
      message: favorited ? '收藏成功' : '取消收藏成功'
    }
  } catch (error) {
    console.error('切换收藏状态失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}
