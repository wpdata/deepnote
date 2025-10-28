import { useState, useEffect } from 'react'
import { Card, Button, message, Space, Typography, Alert, Spin } from 'antd'
import { UserOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { auth, callFunction } from '../utils/cloudbase'

const { Title, Text } = Typography

const Login = () => {
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [userInfo, setUserInfo] = useState(null)
  const navigate = useNavigate()

  // 自动登录并检查权限
  useEffect(() => {
    autoLoginAndCheckAdmin()
  }, [])

  const autoLoginAndCheckAdmin = async () => {
    setLoading(true)
    try {
      // 1. 检查登录状态
      let loginState = await auth.getLoginState()

      // 2. 如果未登录，自动匿名登录
      if (!loginState) {
        console.log('未登录，执行自动登录...')
        await auth.signInAnonymously()
        loginState = await auth.getLoginState()
      }

      console.log('登录状态:', loginState)

      // 3. 调用云函数验证是否是管理员
      // 从 localStorage 读取 openId（需要手动设置）
      const adminOpenId = localStorage.getItem('adminOpenId')

      if (!adminOpenId) {
        setIsAdmin(false)
        setLoading(false)
        message.error('请先设置管理员身份')
        console.error('请在控制台执行: localStorage.setItem("adminOpenId", "您的openId")')
        return
      }

      const result = await callFunction({
        name: 'checkAdmin',
        data: {
          openId: adminOpenId
        }
      })

      console.log('权限验证结果:', result)

      if (result.result && result.result.success && result.result.isAdmin) {
        // 是管理员，保存信息并跳转
        setIsAdmin(true)
        setUserInfo(result.result.data)

        message.success('欢迎回来，管理员！')
        setTimeout(() => {
          navigate('/')
        }, 500)
      } else {
        // 不是管理员
        setIsAdmin(false)
        setUserInfo(result.result?.data || null)
        message.error('抱歉，您没有管理员权限')
      }
    } catch (error) {
      console.error('登录检查失败:', error)
      message.error('登录失败：' + error.message)
    } finally {
      setLoading(false)
    }
  }

  // 加载中状态
  if (loading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <Card
          style={{
            width: 400,
            boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
            borderRadius: 12,
            textAlign: 'center'
          }}
        >
          <Space direction="vertical" size="large" style={{ width: '100%' }}>
            <Spin size="large" />
            <Text>正在验证权限...</Text>
          </Space>
        </Card>
      </div>
    )
  }

  // 非管理员状态
  if (!isAdmin) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
      }}>
        <Card
          style={{
            width: 400,
            boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
            borderRadius: 12
          }}
        >
          <Space direction="vertical" size="large" style={{ width: '100%', textAlign: 'center' }}>
            <div>
              <SafetyCertificateOutlined style={{ fontSize: 64, color: '#ff4d4f' }} />
            </div>

            <div>
              <Title level={3}>无访问权限</Title>
              <Text type="secondary">抱歉，您没有管理员权限访问后台</Text>
            </div>

            <Alert
              message="仅限管理员访问"
              description="如需获取管理员权限，请联系系统管理员"
              type="warning"
              showIcon
            />

            {userInfo && (
              <div style={{ marginTop: 16 }}>
                <Text type="secondary" style={{ fontSize: 12 }}>
                  当前用户: {userInfo.nickName || '未知'}
                </Text>
              </div>
            )}
          </Space>
        </Card>
      </div>
    )
  }

  // 管理员状态（会自动跳转）
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
    }}>
      <Card
        style={{
          width: 400,
          boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
          borderRadius: 12,
          textAlign: 'center'
        }}
      >
        <Space direction="vertical" size="large" style={{ width: '100%' }}>
          <Spin size="large" />
          <Text>登录成功，正在跳转...</Text>
        </Space>
      </Card>
    </div>
  )
}

export default Login
