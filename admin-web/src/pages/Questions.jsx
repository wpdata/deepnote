import { useEffect, useState } from 'react'
import {
  Table,
  Button,
  Space,
  Tag,
  Input,
  Select,
  message,
  Modal,
  Form,
  Row,
  Col,
  Card,
  Popconfirm
} from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined,
  ReloadOutlined
} from '@ant-design/icons'
import { db } from '../utils/cloudbase'

const { Search } = Input
const { Option } = Select
const { TextArea } = Input

const Questions = () => {
  const [loading, setLoading] = useState(false)
  const [questions, setQuestions] = useState([])
  const [subjects, setSubjects] = useState([])
  const [filters, setFilters] = useState({
    subject: '',
    difficulty: '',
    keyword: ''
  })
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  })
  const [editModalVisible, setEditModalVisible] = useState(false)
  const [editingQuestion, setEditingQuestion] = useState(null)
  const [form] = Form.useForm()

  useEffect(() => {
    loadSubjects()
    loadQuestions()
  }, [])

  // 加载学科列表
  const loadSubjects = async () => {
    try {
      const res = await db.collection('subjects').get()
      setSubjects(res.data || [])
    } catch (error) {
      console.error('加载学科失败:', error)
    }
  }

  // 加载题目列表
  const loadQuestions = async (page = 1) => {
    setLoading(true)
    try {
      const { subject, difficulty, keyword } = filters
      let query = db.collection('question_bank')

      // 应用筛选条件
      if (subject) {
        query = query.where({ subject })
      }
      if (difficulty) {
        query = query.where({ difficulty })
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

      setQuestions(res.data || [])
      setPagination({
        ...pagination,
        current: page,
        total
      })
    } catch (error) {
      console.error('加载题目失败:', error)
      message.error('加载题目失败')
    } finally {
      setLoading(false)
    }
  }

  // 搜索
  const handleSearch = () => {
    loadQuestions(1)
  }

  // 重置筛选
  const handleReset = () => {
    setFilters({
      subject: '',
      difficulty: '',
      keyword: ''
    })
    setTimeout(() => loadQuestions(1), 0)
  }

  // 编辑题目
  const handleEdit = (record) => {
    setEditingQuestion(record)
    form.setFieldsValue(record)
    setEditModalVisible(true)
  }

  // 保存编辑
  const handleSave = async () => {
    try {
      const values = await form.validateFields()
      const updateData = {
        ...values,
        updateTime: new Date()
      }

      await db.collection('question_bank')
        .doc(editingQuestion._id)
        .update(updateData)

      message.success('保存成功')
      setEditModalVisible(false)
      loadQuestions(pagination.current)
    } catch (error) {
      console.error('保存失败:', error)
      message.error('保存失败')
    }
  }

  // 删除题目
  const handleDelete = async (id) => {
    try {
      await db.collection('question_bank').doc(id).remove()
      message.success('删除成功')
      loadQuestions(pagination.current)
    } catch (error) {
      console.error('删除失败:', error)
      message.error('删除失败')
    }
  }

  // 表格列配置
  const columns = [
    {
      title: '学科',
      dataIndex: 'subject',
      key: 'subject',
      width: 80,
      render: (text) => <Tag color="blue">{text}</Tag>
    },
    {
      title: '知识点',
      dataIndex: 'knowledgePoint',
      key: 'knowledgePoint',
      width: 120
    },
    {
      title: '题目内容',
      dataIndex: 'content',
      key: 'content',
      ellipsis: true,
      render: (text) => (
        <div style={{ maxWidth: 300 }}>
          {text.length > 100 ? text.substring(0, 100) + '...' : text}
        </div>
      )
    },
    {
      title: '难度',
      dataIndex: 'difficulty',
      key: 'difficulty',
      width: 80,
      render: (text) => {
        const color = text === '简单' ? 'green' : text === '中等' ? 'orange' : 'red'
        return <Tag color={color}>{text}</Tag>
      }
    },
    {
      title: '使用次数',
      dataIndex: 'usedCount',
      key: 'usedCount',
      width: 100,
      sorter: (a, b) => a.usedCount - b.usedCount
    },
    {
      title: '正确率',
      dataIndex: 'correctRate',
      key: 'correctRate',
      width: 100,
      render: (rate) => `${rate || 0}%`
    },
    {
      title: '操作',
      key: 'action',
      width: 150,
      fixed: 'right',
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<EditOutlined />}
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确定删除这道题目吗？"
            onConfirm={() => handleDelete(record._id)}
            okText="确定"
            cancelText="取消"
          >
            <Button
              type="link"
              size="small"
              danger
              icon={<DeleteOutlined />}
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>题库管理</h2>

      {/* 筛选器 */}
      <Card style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={6}>
            <Select
              placeholder="选择学科"
              style={{ width: '100%' }}
              value={filters.subject}
              onChange={(value) => setFilters({ ...filters, subject: value })}
              allowClear
            >
              {subjects.map(s => (
                <Option key={s._id} value={s.name}>{s.name}</Option>
              ))}
            </Select>
          </Col>
          <Col span={6}>
            <Select
              placeholder="选择难度"
              style={{ width: '100%' }}
              value={filters.difficulty}
              onChange={(value) => setFilters({ ...filters, difficulty: value })}
              allowClear
            >
              <Option value="简单">简单</Option>
              <Option value="中等">中等</Option>
              <Option value="困难">困难</Option>
            </Select>
          </Col>
          <Col span={8}>
            <Input
              placeholder="搜索题目内容"
              value={filters.keyword}
              onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
              prefix={<SearchOutlined />}
            />
          </Col>
          <Col span={4}>
            <Space>
              <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
                搜索
              </Button>
              <Button icon={<ReloadOutlined />} onClick={handleReset}>
                重置
              </Button>
            </Space>
          </Col>
        </Row>
      </Card>

      {/* 题目列表 */}
      <Table
        columns={columns}
        dataSource={questions}
        rowKey="_id"
        loading={loading}
        pagination={{
          ...pagination,
          showSizeChanger: true,
          showTotal: (total) => `共 ${total} 条`,
          onChange: (page, pageSize) => {
            setPagination({ ...pagination, current: page, pageSize })
            loadQuestions(page)
          }
        }}
        scroll={{ x: 1200 }}
      />

      {/* 编辑弹窗 */}
      <Modal
        title="编辑题目"
        open={editModalVisible}
        onOk={handleSave}
        onCancel={() => setEditModalVisible(false)}
        width={800}
        okText="保存"
        cancelText="取消"
      >
        <Form form={form} layout="vertical">
          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="subject" label="学科" rules={[{ required: true }]}>
                <Select>
                  {subjects.map(s => (
                    <Option key={s._id} value={s.name}>{s.name}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="knowledgePoint" label="知识点" rules={[{ required: true }]}>
                <Input />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="difficulty" label="难度" rules={[{ required: true }]}>
                <Select>
                  <Option value="简单">简单</Option>
                  <Option value="中等">中等</Option>
                  <Option value="困难">困难</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item name="content" label="题目内容" rules={[{ required: true }]}>
            <TextArea rows={4} />
          </Form.Item>

          <Form.Item name="explanation" label="题目解析">
            <TextArea rows={3} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}

export default Questions
