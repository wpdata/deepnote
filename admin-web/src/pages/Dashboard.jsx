import { useEffect, useState } from 'react'
import { Row, Col, Card, Statistic, Spin } from 'antd'
import {
  DatabaseOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  RiseOutlined
} from '@ant-design/icons'
import { db } from '../utils/cloudbase'

const Dashboard = () => {
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    totalQuestions: 0,
    totalSubjects: 0,
    totalUsedCount: 0,
    avgCorrectRate: 0
  })

  useEffect(() => {
    loadStatistics()
  }, [])

  const loadStatistics = async () => {
    setLoading(true)
    try {
      // 获取题库总数
      const questionsResult = await db.collection('question_bank').count()
      const totalQuestions = questionsResult.total

      // 获取学科数量
      const subjectsResult = await db.collection('subjects').count()
      const totalSubjects = subjectsResult.total

      // 获取题目统计数据
      const questionsData = await db.collection('question_bank')
        .field({ usedCount: true, correctRate: true })
        .get()

      let totalUsedCount = 0
      let totalCorrectRate = 0
      let validCount = 0

      questionsData.data.forEach(q => {
        totalUsedCount += q.usedCount || 0
        if (q.usedCount > 0) {
          totalCorrectRate += q.correctRate || 0
          validCount++
        }
      })

      const avgCorrectRate = validCount > 0 ? (totalCorrectRate / validCount).toFixed(1) : 0

      setStats({
        totalQuestions,
        totalSubjects,
        totalUsedCount,
        avgCorrectRate
      })
    } catch (error) {
      console.error('加载统计数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" tip="加载统计数据..." />
      </div>
    )
  }

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>数据概览</h2>

      <Row gutter={16}>
        <Col span={6}>
          <Card>
            <Statistic
              title="题库总数"
              value={stats.totalQuestions}
              prefix={<DatabaseOutlined />}
              valueStyle={{ color: '#3f8600' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="学科数量"
              value={stats.totalSubjects}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="累计使用"
              value={stats.totalUsedCount}
              prefix={<RiseOutlined />}
              suffix="次"
              valueStyle={{ color: '#cf1322' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card>
            <Statistic
              title="平均正确率"
              value={stats.avgCorrectRate}
              prefix={<CheckCircleOutlined />}
              suffix="%"
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginTop: 24 }}>
        <Col span={24}>
          <Card title="快速操作">
            <p>• 题库管理：查看、编辑、删除题目</p>
            <p>• 批量上传：支持图片、PDF、Word文件批量导入</p>
            <p>• 统计分析：查看题目使用情况和正确率分析</p>
          </Card>
        </Col>
      </Row>
    </div>
  )
}

export default Dashboard
