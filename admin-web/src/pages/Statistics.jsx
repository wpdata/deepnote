import { useEffect, useState } from 'react';
import {
  Row,
  Col,
  Card,
  Statistic,
  Spin,
  DatePicker,
  Space,
  Table,
  message
} from 'antd';
import {
  UserOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  RiseOutlined,
  CameraOutlined,
  BookOutlined
} from '@ant-design/icons';
import ReactECharts from 'echarts-for-react';
import dayjs from 'dayjs';
import { callFunction } from '../utils/cloudbase';

const { RangePicker } = DatePicker;

const Statistics = () => {
  const [loading, setLoading] = useState(true);
  const [statsData, setStatsData] = useState(null);
  const [dateRange, setDateRange] = useState(null);

  useEffect(() => {
    loadStatistics();
  }, [dateRange]);

  const loadStatistics = async () => {
    setLoading(true);
    try {
      // 调用云函数获取统计数据
      const res = await callFunction({
        name: 'getAdminStats',
        data: {
          startDate: dateRange?.[0]?.toISOString(),
          endDate: dateRange?.[1]?.toISOString()
        }
      });

      if (res.result.success) {
        setStatsData(res.result.data);
      } else {
        console.error('获取统计数据失败:', res.result.error);
        message.error('获取统计数据失败: ' + res.result.error);
      }
    } catch (error) {
      console.error('加载统计数据失败:', error);
      message.error('加载统计数据失败');
    } finally {
      setLoading(false);
    }
  };

  // 用户趋势图配置
  const getUserTrendOption = () => {
    if (!statsData?.trends?.dailyUsers) return {};

    return {
      title: {
        text: '用户增长趋势',
        left: 'center'
      },
      tooltip: {
        trigger: 'axis'
      },
      xAxis: {
        type: 'category',
        data: statsData.trends.dailyUsers.map(item =>
          dayjs(item.date).format('MM-DD')
        )
      },
      yAxis: {
        type: 'value',
        name: '新增用户数'
      },
      series: [
        {
          name: '新增用户',
          type: 'line',
          smooth: true,
          data: statsData.trends.dailyUsers.map(item => item.count),
          areaStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: 'rgba(24, 144, 255, 0.3)' },
                { offset: 1, color: 'rgba(24, 144, 255, 0.05)' }
              ]
            }
          }
        }
      ]
    };
  };

  // 错题趋势图配置
  const getErrorTrendOption = () => {
    if (!statsData?.trends?.dailyErrors) return {};

    return {
      title: {
        text: '错题录入趋势',
        left: 'center'
      },
      tooltip: {
        trigger: 'axis'
      },
      xAxis: {
        type: 'category',
        data: statsData.trends.dailyErrors.map(item =>
          dayjs(item.date).format('MM-DD')
        )
      },
      yAxis: {
        type: 'value',
        name: '错题数量'
      },
      series: [
        {
          name: '新增错题',
          type: 'bar',
          data: statsData.trends.dailyErrors.map(item => item.count),
          itemStyle: {
            color: {
              type: 'linear',
              x: 0,
              y: 0,
              x2: 0,
              y2: 1,
              colorStops: [
                { offset: 0, color: '#ff6b6b' },
                { offset: 1, color: '#ff9999' }
              ]
            }
          }
        }
      ]
    };
  };

  // 学科分布饼图配置
  const getSubjectDistributionOption = () => {
    if (!statsData?.subjects) return {};

    return {
      title: {
        text: '学科错题分布',
        left: 'center'
      },
      tooltip: {
        trigger: 'item',
        formatter: '{b}: {c} ({d}%)'
      },
      legend: {
        orient: 'vertical',
        left: 'left'
      },
      series: [
        {
          name: '错题数量',
          type: 'pie',
          radius: '50%',
          data: statsData.subjects.map(item => ({
            name: item.subjectName,
            value: item.errorCount
          })),
          emphasis: {
            itemStyle: {
              shadowBlur: 10,
              shadowOffsetX: 0,
              shadowColor: 'rgba(0, 0, 0, 0.5)'
            }
          }
        }
      ]
    };
  };

  // 知识点统计表格列
  const knowledgeColumns = [
    {
      title: '排名',
      key: 'rank',
      render: (_, __, index) => index + 1,
      width: 80
    },
    {
      title: '知识点',
      dataIndex: 'knowledgePoint',
      key: 'knowledgePoint'
    },
    {
      title: '错题数量',
      dataIndex: 'errorCount',
      key: 'errorCount',
      sorter: (a, b) => a.errorCount - b.errorCount,
      render: (count) => (
        <span style={{ color: '#ff4d4f', fontWeight: 'bold' }}>{count}</span>
      )
    },
    {
      title: '已掌握',
      dataIndex: 'masteredCount',
      key: 'masteredCount',
      render: (count) => (
        <span style={{ color: '#52c41a' }}>{count}</span>
      )
    },
    {
      title: '掌握率',
      key: 'masteredRate',
      render: (_, record) => {
        const rate = record.errorCount > 0
          ? ((record.masteredCount / record.errorCount) * 100).toFixed(1)
          : 0;
        return `${rate}%`;
      }
    }
  ];

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '100px 0' }}>
        <Spin size="large" tip="加载统计数据..." />
      </div>
    );
  }

  if (!statsData) {
    return <div>暂无数据</div>;
  }

  const { overview } = statsData;

  return (
    <div>
      <div style={{ marginBottom: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>数据统计分析</h2>
        <Space>
          <RangePicker
            onChange={(dates) => setDateRange(dates)}
            placeholder={['开始日期', '结束日期']}
          />
        </Space>
      </div>

      {/* 核心指标卡片 */}
      <Row gutter={[16, 16]}>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="总用户数"
              value={overview.users.total}
              prefix={<UserOutlined />}
              valueStyle={{ color: '#1890ff' }}
              suffix={
                <span style={{ fontSize: 14, color: '#999', marginLeft: 8 }}>
                  新增 {overview.users.new}
                </span>
              }
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="活跃用户"
              value={overview.users.active}
              prefix={<RiseOutlined />}
              valueStyle={{ color: '#52c41a' }}
              suffix={
                <span style={{ fontSize: 14, color: '#999', marginLeft: 8 }}>
                  近7天
                </span>
              }
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="错题总数"
              value={overview.errors.total}
              prefix={<FileTextOutlined />}
              valueStyle={{ color: '#ff4d4f' }}
              suffix={
                <span style={{ fontSize: 14, color: '#999', marginLeft: 8 }}>
                  未解决 {overview.errors.unsolved}
                </span>
              }
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="掌握率"
              value={overview.errors.masteredRate}
              prefix={<CheckCircleOutlined />}
              suffix="%"
              valueStyle={{ color: '#722ed1' }}
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="练习总次数"
              value={overview.practices.total}
              prefix={<BookOutlined />}
              valueStyle={{ color: '#fa8c16' }}
              suffix={
                <span style={{ fontSize: 14, color: '#999', marginLeft: 8 }}>
                  近7天 {overview.practices.recent}
                </span>
              }
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="OCR识别"
              value={overview.ocr.total}
              prefix={<CameraOutlined />}
              valueStyle={{ color: '#13c2c2' }}
              suffix={
                <span style={{ fontSize: 14, color: '#999', marginLeft: 8 }}>
                  成功 {overview.ocr.success}
                </span>
              }
            />
          </Card>
        </Col>
        <Col xs={24} sm={12} lg={6}>
          <Card>
            <Statistic
              title="OCR成功率"
              value={overview.ocr.successRate}
              suffix="%"
              valueStyle={{ color: '#13c2c2' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 趋势分析 */}
      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={12}>
          <Card>
            <ReactECharts
              option={getUserTrendOption()}
              style={{ height: '350px' }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card>
            <ReactECharts
              option={getErrorTrendOption()}
              style={{ height: '350px' }}
            />
          </Card>
        </Col>
      </Row>

      {/* 学科分布和知识点分析 */}
      <Row gutter={[16, 16]} style={{ marginTop: 24 }}>
        <Col xs={24} lg={10}>
          <Card>
            <ReactECharts
              option={getSubjectDistributionOption()}
              style={{ height: '400px' }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={14}>
          <Card title="高频错题知识点 TOP 10">
            <Table
              columns={knowledgeColumns}
              dataSource={statsData.knowledgePoints}
              rowKey="knowledgePoint"
              pagination={false}
              size="small"
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Statistics;
