/**
 * 管理员注册脚本
 * 使用方法：node scripts/register-admin.js
 */

const cloudbase = require('@cloudbase/node-sdk')

// 初始化云开发
const app = cloudbase.init({
  env: 'deepnote-3g0lr0fb3ce6ea1c'
})

// 注册管理员
async function registerAdmin() {
  console.log('🔐 管理员注册脚本')
  console.log('====================\n')

  // 从命令行获取参数
  const args = process.argv.slice(2)

  let email, password

  if (args.length >= 2) {
    email = args[0]
    password = args[1]
  } else {
    // 提示用户输入
    const readline = require('readline')
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    })

    email = await new Promise((resolve) => {
      rl.question('请输入管理员邮箱: ', (answer) => {
        resolve(answer.trim())
      })
    })

    password = await new Promise((resolve) => {
      rl.question('请输入密码 (至少6位): ', (answer) => {
        resolve(answer.trim())
      })
    })

    rl.close()
  }

  // 验证输入
  if (!email || !email.includes('@')) {
    console.error('❌ 邮箱格式不正确')
    process.exit(1)
  }

  if (!password || password.length < 6) {
    console.error('❌ 密码至少需要6位字符')
    process.exit(1)
  }

  try {
    console.log('\n📝 注册中...')

    // 调用云函数注册管理员
    const res = await app.callFunction({
      name: 'adminLogin',
      data: {
        email,
        password,
        action: 'register'
      }
    })

    if (res.result && res.result.success) {
      console.log('\n✅ 管理员注册成功！')
      console.log('====================')
      console.log(`📧 邮箱: ${email}`)
      console.log(`🆔 用户ID: ${res.result.data.userId}`)
      console.log('\n💡 现在可以使用该账号登录后台管理系统')
    } else {
      console.error('\n❌ 注册失败:', res.result?.error || '未知错误')
      process.exit(1)
    }

  } catch (error) {
    console.error('\n❌ 注册失败:', error.message)
    process.exit(1)
  }
}

// 执行注册
registerAdmin().catch(error => {
  console.error('执行失败:', error)
  process.exit(1)
})
