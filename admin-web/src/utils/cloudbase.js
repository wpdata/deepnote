// 云开发初始化
import cloudbase from '@cloudbase/js-sdk'
import { cloudbaseConfig } from '../../cloudbase.config'

// 初始化云开发
const app = cloudbase.init(cloudbaseConfig)

// 获取认证对象
export const auth = app.auth({
  persistence: 'local'
})

// 获取数据库对象
export const db = app.database()

// 获取存储对象
export const storage = app.uploadFile.bind(app)

// 获取云函数调用对象 - 包装以确保已登录
const rawCallFunction = app.callFunction.bind(app)

// 确保已登录的云函数调用
async function ensureAuthAndCall(params) {
  // 检查是否已登录
  const loginState = await auth.getLoginState()

  if (!loginState) {
    // 未登录，先进行匿名登录
    console.log('未登录，执行匿名登录...')
    try {
      await auth.signInAnonymously()
      console.log('匿名登录成功')
    } catch (error) {
      console.error('匿名登录失败:', error)
      throw error
    }
  }

  // 调用云函数
  return rawCallFunction(params)
}

export const callFunction = ensureAuthAndCall

// 登录状态检查
export const checkLoginStatus = () => {
  return auth.hasLoginState()
}

// 管理员邮箱+密码登录
export const adminLogin = async (email, password) => {
  try {
    const res = await callFunction({
      name: 'adminLogin',
      data: {
        email,
        password,
        action: 'login'
      }
    })

    if (res.result && res.result.success) {
      return {
        success: true,
        data: res.result.data
      }
    } else {
      return {
        success: false,
        error: res.result?.error || '登录失败'
      }
    }
  } catch (error) {
    console.error('管理员登录失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// 注册管理员账号
export const registerAdmin = async (email, password) => {
  try {
    const res = await callFunction({
      name: 'adminLogin',
      data: {
        email,
        password,
        action: 'register'
      }
    })

    if (res.result && res.result.success) {
      return {
        success: true,
        message: res.result.message
      }
    } else {
      return {
        success: false,
        error: res.result?.error || '注册失败'
      }
    }
  } catch (error) {
    console.error('注册管理员失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// 验证管理员权限
export const checkAdmin = async (token) => {
  try {
    const res = await callFunction({
      name: 'checkAdmin',
      data: {
        token
      }
    })

    if (res.result && res.result.success) {
      return {
        success: true,
        isAdmin: res.result.isAdmin,
        data: res.result.data
      }
    } else {
      return {
        success: false,
        isAdmin: false,
        error: res.result?.error || '验证失败'
      }
    }
  } catch (error) {
    console.error('验证管理员权限失败:', error)
    return {
      success: false,
      isAdmin: false,
      error: error.message
    }
  }
}

// 登出
export const logout = async () => {
  try {
    // 清除本地存储
    localStorage.removeItem('adminToken')
    localStorage.removeItem('adminUser')

    return {
      success: true,
      message: '登出成功'
    }
  } catch (error) {
    console.error('登出失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
}

// 获取当前管理员信息
export const getCurrentAdmin = () => {
  const adminUser = localStorage.getItem('adminUser')
  const adminToken = localStorage.getItem('adminToken')

  if (adminUser && adminToken) {
    return {
      ...JSON.parse(adminUser),
      token: adminToken
    }
  }

  return null
}

export default app
