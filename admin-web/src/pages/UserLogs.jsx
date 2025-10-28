import { useEffect, useState } from 'react';
import {
  Table,
  Card,
  Space,
  Button,
  DatePicker,
  Select,
  Input,
  Tag,
  message,
  Tooltip
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';
import { callFunction } from '../utils/cloudbase';

const { RangePicker } = DatePicker;
const { Option } = Select;

const UserLogs = () => {
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState([]);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 20,
    total: 0
  });
  const [filters, setFilters] = useState({
    subject: '',
    mastered: undefined,
    startDate: null,
    endDate: null
  });

  useEffect(() => {
    loadLogs();
  }, [pagination.current, pagination.pageSize]);

  const loadLogs = async () => {
    setLoading(true);
    try {
      const res = await callFunction({
        name: 'getUserLogs',
        data: {
          page: pagination.current,
          pageSize: pagination.pageSize,
          filters: {
            subject: filters.subject || undefined,
            mastered: filters.mastered,
            startDate: filters.startDate?.toISOString(),
            endDate: filters.endDate?.toISOString()
          }
        }
      });

      if (res.result.success) {
        setLogs(res.result.data.logs);
        setPagination(prev => ({
          ...prev,
          total: res.result.data.pagination.total
        }));
      } else {
        message.error('加载日志失败: ' + res.result.error);
      }
    } catch (error) {
      console.error('加载用户日志失败:', error);
      message.error('加载日志失败');
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    setPagination(prev => ({ ...prev, current: 1 }));
    loadLogs();
  };

  const handleReset = () => {
    setFilters({
      subject: '',
      mastered: undefined,
      startDate: null,
      endDate: null
    });
    setPagination(prev => ({ ...prev, current: 1 }));
    setTimeout(() => loadLogs(), 100);
  };

  const handleTableChange = (newPagination) => {
    setPagination(prev => ({
      ...prev,
      current: newPagination.current,
      pageSize: newPagination.pageSize
    }));
  };

  const columns = [
    {
      title: '时间',
      dataIndex: 'createTime',
      key: 'createTime',
      width: 180,
      render: (time) => dayjs(time).format('YYYY-MM-DD HH:mm:ss'),
      sorter: (a, b) => new Date(a.createTime) - new Date(b.createTime)
    },
    {
      title: '用户',
      dataIndex: 'userName',
      key: 'userName',
      width: 150,
      render: (name, record) => (
        <Tooltip title={`OpenID: ${record.userOpenId}`}>
          <span>{name}</span>
        </Tooltip>
      )
    },
    {
      title: '学科',
      dataIndex: 'subject',
      key: 'subject',
      width: 100,
      render: (subject) => <Tag color="blue">{subject}</Tag>
    },
    {
      title: '知识点',
      dataIndex: 'knowledgePoint',
      key: 'knowledgePoint',
      ellipsis: {
        showTitle: false
      },
      render: (text) => (
        <Tooltip placement="topLeft" title={text}>
          {text}
        </Tooltip>
      )
    },
    {
      title: '掌握状态',
      dataIndex: 'mastered',
      key: 'mastered',
      width: 100,
      align: 'center',
      filters: [
        { text: '已掌握', value: true },
        { text: '未掌握', value: false }
      ],
      onFilter: (value, record) => record.mastered === value,
      render: (mastered) =>
        mastered ? (
          <Tag icon={<CheckCircleOutlined />} color="success">
            已掌握
          </Tag>
        ) : (
          <Tag icon={<CloseCircleOutlined />} color="error">
            未掌握
          </Tag>
        )
    },
    {
      title: '练习次数',
      dataIndex: 'practiceCount',
      key: 'practiceCount',
      width: 100,
      align: 'center'
    },
    {
      title: '操作',
      key: 'action',
      width: 120,
      render: (_, record) => (
        <Space size="small">
          <Button
            type="link"
            size="small"
            icon={<FileTextOutlined />}
            onClick={() => handleViewDetail(record)}
          >
            详情
          </Button>
        </Space>
      )
    }
  ];

  const handleViewDetail = (record) => {
    // 显示详细信息弹窗
    console.log('查看详情:', record);
    message.info('详情功能开发中');
  };

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>用户操作日志</h2>

      <Card style={{ marginBottom: 16 }}>
        <Space size="middle" wrap>
          <Select
            placeholder="学科"
            value={filters.subject}
            onChange={(value) => setFilters({ ...filters, subject: value })}
            style={{ width: 150 }}
            allowClear
          >
            <Option value="算数">算数</Option>
            <Option value="数学">数学</Option>
            <Option value="语文">语文</Option>
            <Option value="英语">英语</Option>
            <Option value="物理">物理</Option>
            <Option value="化学">化学</Option>
          </Select>

          <Select
            placeholder="掌握状态"
            value={filters.mastered}
            onChange={(value) => setFilters({ ...filters, mastered: value })}
            style={{ width: 150 }}
            allowClear
          >
            <Option value={true}>已掌握</Option>
            <Option value={false}>未掌握</Option>
          </Select>

          <RangePicker
            value={[filters.startDate, filters.endDate]}
            onChange={(dates) =>
              setFilters({
                ...filters,
                startDate: dates?.[0],
                endDate: dates?.[1]
              })
            }
            placeholder={['开始时间', '结束时间']}
            showTime
          />

          <Button
            type="primary"
            icon={<SearchOutlined />}
            onClick={handleSearch}
          >
            查询
          </Button>

          <Button icon={<ReloadOutlined />} onClick={handleReset}>
            重置
          </Button>
        </Space>
      </Card>

      <Card>
        <Table
          columns={columns}
          dataSource={logs}
          rowKey="id"
          loading={loading}
          pagination={{
            ...pagination,
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
            pageSizeOptions: ['10', '20', '50', '100']
          }}
          onChange={handleTableChange}
          size="small"
          scroll={{ x: 1200 }}
        />
      </Card>
    </div>
  );
};

export default UserLogs;
