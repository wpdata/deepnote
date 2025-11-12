import { useEffect, useState } from 'react'
import {
  Table,
  Card,
  Space,
  Button,
  Input,
  Select,
  Tag,
  message,
  Modal,
  Image
} from 'antd'
import {
  SearchOutlined,
  ReloadOutlined,
  EyeOutlined,
  UserOutlined
} from '@ant-design/icons'
import dayjs from 'dayjs'
import { db } from '../utils/cloudbase'

const { Search } = Input
const { Option } = Select

const Errors = () => {
  const [loading, setLoading] = useState(false)
  const [errors, setErrors] = useState([])
  const [users, setUsers] = useState([])
  const [subjects, setSubjects] = useState([])
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0
  })
  const [filters, setFilters] = useState({
    userId: '',
    subject: '',
    keyword: ''
  })
  const [detailModalVisible, setDetailModalVisible] = useState(false)
  const [selectedError, setSelectedError] = useState(null)

  useEffect(() => {
    loadUsers()
    loadSubjects()
    loadErrors()
  }, [])

  const loadUsers = async () => {
    try {
      const res = await db.collection('users').get()
      setUsers(res.data || [])
    } catch (error) {
      console.error('加载用户失败:', error)
    }
  }

  const loadSubjects = async () => {
    try {
      const res = await db.collection('subjects').get()
      setSubjects(res.data || [])
    } catch (error) {
      console.error('加载学科失败:', error)
    }
  }

  const loadErrors = async (page = 1) => {
    setLoading(true)
    try {
      const { userId, subject, keyword } = filters
      let query = db.collection('errors')

      // 应用筛选条件
      const conditions = []
      if (userId) {
        conditions.push({ _openid: userId })
      }
      if (subject) {
        conditions.push({ subject })
      }

      if (conditions.length > 0) {
        query = query.where(
          conditions.length === 1 ? conditions[0] : db.command.and(conditions)
        )
      }

      if (keyword) {
        query = query.where({
          content: new db.RegExp({
            regexp: keyword,
            options: 'i'
          })
        })
      }

      // 获取总数
      const countRes = await query.count()
      const total = countRes.total

      // 分页查询
      const res = await query
        .skip((page - 1) * pagination.pageSize)
        .limit(pagination.pageSize)
        .orderBy('createTime', 'desc')
        .get()

      // 关联用户信息
      const errorsWithUser = res.data.map((error) => {
        const user = users.find(u => (u.openId || u._openid) === error._openid)
        return {
          ...error,
          userName: user?.nickName || error._openid?.substring(0, 8) + '...' || '未知用户'
        }
      })

      setErrors(errorsWithUser)
      setPagination({
        ...pagination,
        current: page,
        total
      })
    } catch (error) {
      console.error('加载错题失败:', error)
      message.error('加载错题失败')
    } finally {
      setLoading(false)
    }
  }

  const handleSearch = () => {
    loadErrors(1)
  }

  const handleReset = () => {
    setFilters({
      userId: '',
      subject: '',
      keyword: ''
    })
    setTimeout(() => loadErrors(1), 0)
  }

  const handleViewDetail = (record) => {
    setSelectedError(record)
    setDetailModalVisible(true)
  }

  const columns = [
    {
      title: '用户',
      dataIndex: 'userName',
      key: 'userName',
      width: 120,
      render: (text) => (
        <Space>
          <UserOutlined />
          <span>{text}</span>
        </Space>
      )
    },
    {
      title: '学科',
      dataIndex: 'subject',
      key: 'subject',
      width: 100,
      render: (text) => <Tag color="blue">{text}</Tag>
    },
    {
      title: '知识点',
      dataIndex: 'knowledgePoint',
      key: 'knowledgePoint',
      width: 150
    },
    {
      title: '题目内容',
      dataIndex: 'content',
      key: 'content',
      ellipsis: true,
      render: (text) => (
        <div style={{ maxWidth: 300 }}>
          {text?.length > 100 ? text.substring(0, 100) + '...' : text || '暂无内容'}
        </div>
      )
    },
    {
      title: '难度',
      dataIndex: 'difficulty',
      key: 'difficulty',
      width: 80,
      render: (text) => {
        if (!text) return '-'
        const color = text === '简单' ? 'green' : text === '中等' ? 'orange' : 'red'
        return <Tag color={color}>{text}</Tag>
      }
    },
    {
      title: '错误次数',
      dataIndex: 'wrongCount',
      key: 'wrongCount',
      width: 100,
      sorter: (a, b) => (a.wrongCount || 0) - (b.wrongCount || 0),
      render: (count) => <Tag color="red">{count || 0}</Tag>
    },
    {
      title: '是否掌握',
      dataIndex: 'mastered',
      key: 'mastered',
      width: 100,
      render: (mastered) => (
        <Tag color={mastered ? 'success' : 'default'}>
          {mastered ? '已掌握' : '未掌握'}
        </Tag>
      )
    },
    {
      title: '添加时间',
      dataIndex: 'createTime',
      key: 'createTime',
      width: 180,
      render: (time) => time ? dayjs(time).format('YYYY-MM-DD HH:mm:ss') : '-',
      sorter: (a, b) => new Date(a.createTime) - new Date(b.createTime)
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
      <h2 style={{ marginBottom: 24 }}>错题管理</h2>

      <Card style={{ marginBottom: 16 }}>
        <Space wrap>
          <Select
            placeholder="选择用户"
            value={filters.userId}
            onChange={(value) => setFilters({ ...filters, userId: value })}
            style={{ width: 200 }}
            allowClear
            showSearch
            optionFilterProp="children"
          >
            {users.map(u => (
              <Option key={u._id} value={u.openId || u._openid}>
                {u.nickName || (u.openId || u._openid)?.substring(0, 12) + '...'}
              </Option>
            ))}
          </Select>

          <Select
            placeholder="选择学科"
            value={filters.subject}
            onChange={(value) => setFilters({ ...filters, subject: value })}
            style={{ width: 150 }}
            allowClear
          >
            {subjects.map(s => (
              <Option key={s._id} value={s.name}>{s.name}</Option>
            ))}
          </Select>

          <Search
            placeholder="搜索题目内容"
            value={filters.keyword}
            onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
            onSearch={handleSearch}
            style={{ width: 250 }}
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
          dataSource={errors}
          rowKey="_id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 道错题`,
            pageSizeOptions: ['10', '20', '50', '100'],
            onChange: (page, pageSize) => {
              setPagination({ ...pagination, current: page, pageSize })
              loadErrors(page)
            }
          }}
          scroll={{ x: 1400 }}
        />
      </Card>

      {/* 错题详情弹窗 */}
      <Modal
        title="错题详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={null}
        width={800}
      >
        {selectedError && (
          <div>
            <Space direction="vertical" size="large" style={{ width: '100%' }}>
              <div>
                <h4>基本信息</h4>
                <p><strong>用户：</strong>{selectedError.userName}</p>
                <p><strong>学科：</strong><Tag color="blue">{selectedError.subject}</Tag></p>
                <p><strong>知识点：</strong>{selectedError.knowledgePoint}</p>
                <p><strong>难度：</strong>
                  {selectedError.difficulty && (
                    <Tag color={
                      selectedError.difficulty === '简单' ? 'green' :
                      selectedError.difficulty === '中等' ? 'orange' : 'red'
                    }>
                      {selectedError.difficulty}
                    </Tag>
                  )}
                </p>
              </div>

              {selectedError.imageUrl && (
                <div>
                  <h4>题目图片</h4>
                  <Image
                    src={selectedError.imageUrl}
                    alt="错题图片"
                    style={{ maxWidth: '100%' }}
                  />
                </div>
              )}

              <div>
                <h4>题目内容</h4>
                <p style={{ whiteSpace: 'pre-wrap' }}>
                  {selectedError.content || '暂无内容'}
                </p>
              </div>

              {selectedError.explanation && (
                <div>
                  <h4>题目解析</h4>
                  <p style={{ whiteSpace: 'pre-wrap' }}>
                    {selectedError.explanation}
                  </p>
                </div>
              )}

              <div>
                <h4>统计信息</h4>
                <p><strong>错误次数：</strong><Tag color="red">{selectedError.wrongCount || 0}</Tag></p>
                <p><strong>掌握状态：</strong>
                  <Tag color={selectedError.mastered ? 'success' : 'default'}>
                    {selectedError.mastered ? '已掌握' : '未掌握'}
                  </Tag>
                </p>
                <p><strong>添加时间：</strong>
                  {selectedError.createTime ? dayjs(selectedError.createTime).format('YYYY-MM-DD HH:mm:ss') : '-'}
                </p>
                <p><strong>最后练习：</strong>
                  {selectedError.lastPracticeTime ? dayjs(selectedError.lastPracticeTime).format('YYYY-MM-DD HH:mm:ss') : '-'}
                </p>
              </div>
            </Space>
          </div>
        )}
      </Modal>
    </div>
  )
}

export default Errors
