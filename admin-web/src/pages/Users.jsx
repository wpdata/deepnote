import { useEffect, useState } from 'react'
import {
  Table,
  Card,
  Space,
  Button,
  Input,
  Tag,
  message,
  Modal,
  Descriptions,
  Statistic,
  Row,
  Col
} from 'antd'
import {
  SearchOutlined,
  ReloadOutlined,
  UserOutlined,
  EyeOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { db } from '../utils/cloudbase'

const { Search } = Input

const Users = () => {
  const [loading, setLoading] = useState(false)
  const [users, setUsers] = useState([])
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0
  })
  const [keyword, setKeyword] = useState('')
  const [detailModalVisible, setDetailModalVisible] = useState(false)
  const [selectedUser, setSelectedUser] = useState(null)
  const [userStats, setUserStats] = useState(null)

  useEffect(() => {
    loadUsers()
  }, [])

  const loadUsers = async (page = 1) => {
    setLoading(true)
    try {
      let query = db.collection('users')

      // 关键词搜索
      if (keyword) {
        query = query.where({
          nickName: new db.RegExp({
            regexp: keyword,
            options: 'i'
          })
        })
      }

      // 获取总数
      const countRes = await query.count()
      const total = countRes.total

      // 分页查询 - 按 _id 降序排列（最新的在前面）
      const res = await query
        .skip((page - 1) * pagination.pageSize)
        .limit(pagination.pageSize)
        .get()

      setUsers(res.data || [])
      setPagination({
        ...pagination,
        current: page,
        total
      })
    } catch (error) {
      console.error('加载用户失败:', error)
      message.error('加载用户失败')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    loadUsers(1)
  }

  const handleReset = () => {
    setKeyword('')
    setTimeout(() => loadUsers(1), 0)
  }

  const handleViewDetail = async (user) => {
    setSelectedUser(user)
    setDetailModalVisible(true)

    // 加载用户统计数据
    try {
      // 获取用户的 openid（可能在 openId 或 _openid 字段）
      const userOpenId = user.openId || user._openid

      const [errorsRes, practicesRes, knowledgeRes] = await Promise.all([
        db.collection('errors').where({ _openid: userOpenId }).count(),
        db.collection('practices').where({ _openid: userOpenId }).count(),
        db.collection('knowledge_stats').where({ _openid: userOpenId }).get()
      ])

      // 计算掌握的知识点数量
      const masteredCount = knowledgeRes.data.filter(k => k.mastered).length

      setUserStats({
        totalErrors: errorsRes.total,
        totalPractices: practicesRes.total,
        totalKnowledge: knowledgeRes.data.length,
        masteredKnowledge: masteredCount
      })
    } catch (error) {
      console.error('加载用户统计失败:', error)
    }
  }

  const columns = [
    {
      title: '用户昵称',
      dataIndex: 'nickName',
      key: 'nickName',
      width: 150,
      render: (text, record) => (
        <Space>
          <UserOutlined />
          <span>{text || '未设置'}</span>
        </Space>
      )
    },
    {
      title: 'OpenID',
      dataIndex: '_openid',
      key: '_openid',
      width: 200,
      ellipsis: true,
      render: (text, record) => record.openId || record._openid || '-'
    },
    {
      title: '头像',
      dataIndex: 'avatarUrl',
      key: 'avatarUrl',
      width: 80,
      render: (url) => url ? (
        <img src={url} style={{ width: 40, height: 40, borderRadius: '50%' }} />
      ) : (
        <div style={{
          width: 40,
          height: 40,
          borderRadius: '50%',
          background: '#f0f0f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <UserOutlined />
        </div>
      )
    },
    {
      title: '注册时间',
      dataIndex: 'createTime',
      key: 'createTime',
      width: 180,
      render: (time) => time ? dayjs(time).format('YYYY-MM-DD HH:mm:ss') : '-',
      sorter: (a, b) => new Date(a.createTime) - new Date(b.createTime)
    },
    {
      title: '最后登录',
      dataIndex: 'lastLoginTime',
      key: 'lastLoginTime',
      width: 180,
      render: (time) => time ? dayjs(time).format('YYYY-MM-DD HH:mm:ss') : '-',
      sorter: (a, b) => new Date(a.lastLoginTime) - new Date(b.lastLoginTime)
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      fixed: 'right',
      render: (_, record) => (
        <Button
          type="link"
          size="small"
          icon={<EyeOutlined />}
          onClick={() => handleViewDetail(record)}
        >
          查看详情
        </Button>
      )
    }
  ]

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>用户管理</h2>

      <Card style={{ marginBottom: 16 }}>
        <Space>
          <Search
            placeholder="搜索用户昵称"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onSearch={handleSearch}
            style={{ width: 300 }}
            enterButton={<SearchOutlined />}
          />
          <Button icon={<ReloadOutlined />} onClick={handleReset}>
            重置
          </Button>
        </Space>
      </Card>

      <Card>
        <Table
          columns={columns}
          dataSource={users}
          rowKey="_id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 位用户`,
            pageSizeOptions: ['10', '20', '50', '100'],
            onChange: (page, pageSize) => {
              setPagination({ ...pagination, current: page, pageSize })
              loadUsers(page)
            }
          }}
          scroll={{ x: 1000 }}
        />
      </Card>

      {/* 用户详情弹窗 */}
      <Modal
        title="用户详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={800}
      >
        {selectedUser && (
          <div>
            <Descriptions bordered column={2}>
              <Descriptions.Item label="用户昵称">
                {selectedUser.nickName || '未设置'}
              </Descriptions.Item>
              <Descriptions.Item label="OpenID">
                {selectedUser.openId || selectedUser._openid || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="年级">
                {selectedUser.grade?.displayName || '-'}
              </Descriptions.Item>
              <Descriptions.Item label="注册时间">
                {selectedUser.createTime ? dayjs(selectedUser.createTime).format('YYYY-MM-DD HH:mm:ss') : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="总错题数">
                {selectedUser.totalErrors || 0}
              </Descriptions.Item>
              <Descriptions.Item label="已掌握错题">
                {selectedUser.masteredErrors || 0}
              </Descriptions.Item>
              <Descriptions.Item label="练习次数">
                {selectedUser.practiceCount || 0}
              </Descriptions.Item>
              <Descriptions.Item label="学习天数">
                {selectedUser.studyDays || 0}
              </Descriptions.Item>
            </Descriptions>

            {userStats && (
              <>
                <h3 style={{ marginTop: 24, marginBottom: 16 }}>使用统计</h3>
                <Row gutter={16}>
                  <Col span={6}>
                    <Card>
                      <Statistic
                        title="错题数量"
                        value={userStats.totalErrors}
                        suffix="道"
                        valueStyle={{ color: '#cf1322' }}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card>
                      <Statistic
                        title="练习次数"
                        value={userStats.totalPractices}
                        suffix="次"
                        valueStyle={{ color: '#1890ff' }}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card>
                      <Statistic
                        title="知识点总数"
                        value={userStats.totalKnowledge}
                        suffix="个"
                        valueStyle={{ color: '#722ed1' }}
                      />
                    </Card>
                  </Col>
                  <Col span={6}>
                    <Card>
                      <Statistic
                        title="已掌握知识点"
                        value={userStats.masteredKnowledge}
                        suffix="个"
                        valueStyle={{ color: '#3f8600' }}
                      />
                    </Card>
                  </Col>
                </Row>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  )
}

export default Users
