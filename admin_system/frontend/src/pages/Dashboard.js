import React, { useState, useEffect } from 'react';
import { Row, Col, Table, Typography, Spin, Alert, Progress, Tooltip, Badge } from 'antd';
import {
  UserOutlined,
  FileTextOutlined,
  TagsOutlined,
  CommentOutlined,
  RiseOutlined,
  FallOutlined,
  ClockCircleOutlined,
  CloudServerOutlined,
  DatabaseOutlined,
  HddOutlined
} from '@ant-design/icons';
import { getDashboardStats } from '../services/statsService';
import { PageHeader, StatCard } from '../components/common';
import { LineChart, PieChart } from '../components/charts';
import { Card, Statistic } from '../components/data-display';
import { FadeIn, Stagger } from '../components/animations';
import '../styles/Dashboard.css';

const { Title } = Typography;

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        setLoading(true);
        const data = await getDashboardStats();
        setStats(data);
        setError(null);
      } catch (err) {
        console.error('获取仪表盘数据失败:', err);
        setError('获取数据失败，请稍后重试');
      } finally {
        setLoading(false);
      }
    };

    fetchStats();

    // 设置定时刷新
    const intervalId = setInterval(fetchStats, 5 * 60 * 1000); // 每5分钟刷新一次

    return () => clearInterval(intervalId);
  }, []);

  // 获取用户增长数据
  const getUserGrowthData = () => {
    if (!stats || !stats.userGrowthData) return { xAxis: [], data: [] };

    return {
      xAxis: stats.userGrowthData.dates,
      data: [
        {
          name: '新增用户',
          data: stats.userGrowthData.values,
        }
      ]
    };
  };

  // 获取内容分布数据
  const getContentDistributionData = () => {
    if (!stats || !stats.contentDistribution) return [];

    return [
      { value: stats.contentDistribution.notes, name: '笔记' },
      { value: stats.contentDistribution.images, name: '图片' },
      { value: stats.contentDistribution.audio, name: '音频' },
      { value: stats.contentDistribution.video, name: '视频' },
      { value: stats.contentDistribution.documents, name: '文档' }
    ];
  };

  // 获取用户活跃度数据
  const getUserActivityData = () => {
    if (!stats || !stats.userActivityData) return { xAxis: [], data: [] };

    return {
      xAxis: stats.userActivityData?.dates || [],
      data: [
        {
          name: '活跃用户',
          data: stats.userActivityData?.values || [],
        }
      ]
    };
  };

  // 最近用户表格列
  const userColumns = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: '注册时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <span style={{ color: status === 'active' ? 'green' : 'red' }}>
          {status === 'active' ? '活跃' : '禁用'}
        </span>
      ),
    },
  ];

  if (loading) {
    return (
      <div className="loading-container">
        <Spin size="large" />
        <p>加载仪表盘数据...</p>
      </div>
    );
  }

  if (error) {
    return (
      <Alert
        message="错误"
        description={error}
        type="error"
        showIcon
      />
    );
  }

  return (
    <div className="dashboard-container">
      <FadeIn>
        <PageHeader
          title="仪表盘"
          subTitle="系统概览和数据统计"
          breadcrumb={[
            { title: '首页', path: '/' },
            { title: '仪表盘' }
          ]}
        />
      </FadeIn>

      {/* 统计卡片 */}
      <Stagger animation="fadeIn" staggerDelay={100}>
        <Row gutter={[16, 16]} className="stats-row">
          <Col xs={24} sm={12} md={6}>
            <StatCard
              title="总用户数"
              value={stats?.totalUsers || 0}
              prefix={<UserOutlined />}
              color="#1890ff"
              tooltip="系统中注册的用户总数"
              suffix={
                <Badge
                  count={`+${stats?.todayNewUsers || 0}`}
                  style={{ backgroundColor: '#52c41a' }}
                />
              }
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <StatCard
              title="总笔记数"
              value={stats?.totalNotes || 0}
              prefix={<FileTextOutlined />}
              color="#52c41a"
              tooltip="系统中创建的笔记总数"
              suffix={
                <Badge
                  count={`+${stats?.todayNewNotes || 0}`}
                  style={{ backgroundColor: '#1890ff' }}
                />
              }
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <StatCard
              title="总标签数"
              value={stats?.totalTags || 0}
              prefix={<TagsOutlined />}
              color="#faad14"
              tooltip="系统中创建的标签总数"
            />
          </Col>
          <Col xs={24} sm={12} md={6}>
            <StatCard
              title="总评论数"
              value={stats?.totalComments || 0}
              prefix={<CommentOutlined />}
              color="#722ed1"
              tooltip="系统中发布的评论总数"
            />
          </Col>
        </Row>
      </Stagger>

      {/* 用户增长趋势 */}
      <Row gutter={[16, 16]} className="charts-row">
        <Col xs={24} lg={12}>
          <FadeIn delay={300}>
            <Card
              title="用户增长趋势"
              className="chart-card"
              hoverable
              extra={
                <Tooltip title="今日新增用户">
                  <Badge
                    count={stats?.todayNewUsers || 0}
                    style={{ backgroundColor: '#52c41a' }}
                  />
                </Tooltip>
              }
            >
              <LineChart
                {...getUserGrowthData()}
                title=""
                smooth={true}
                area={true}
                loading={loading}
                colors={['#1890ff']}
              />
            </Card>
          </FadeIn>
        </Col>
        <Col xs={24} lg={12}>
          <FadeIn delay={400}>
            <Card
              title="内容类型分布"
              className="chart-card"
              hoverable
            >
              <PieChart
                data={getContentDistributionData()}
                title=""
                donut={true}
                loading={loading}
              />
            </Card>
          </FadeIn>
        </Col>
      </Row>

      <Row gutter={[16, 16]} className="charts-row">
        <Col xs={24} lg={12}>
          <FadeIn delay={500}>
            <Card
              title="用户活跃度趋势"
              className="chart-card"
              hoverable
            >
              <LineChart
                {...getUserActivityData()}
                title=""
                smooth={true}
                area={false}
                loading={loading}
                colors={['#52c41a']}
              />
            </Card>
          </FadeIn>
        </Col>
        <Col xs={24} lg={12}>
          <FadeIn delay={600}>
            <Card
              title="最近注册用户"
              className="recent-users-card"
              hoverable
            >
              <Table
                columns={userColumns}
                dataSource={stats?.recentUsers || []}
                rowKey="id"
                pagination={{ pageSize: 5 }}
                size="small"
              />
            </Card>
          </FadeIn>
        </Col>
      </Row>

      {/* 系统状态 */}
      <FadeIn delay={700}>
        <Card
          title={
            <span>
              <CloudServerOutlined style={{ marginRight: 8 }} />
              系统状态
            </span>
          }
          className="system-status-card"
          hoverable
        >
          <Row gutter={[16, 16]}>
            <Col xs={24} sm={8}>
              <Card className="status-card" hoverable>
                <div className="status-header">
                  <span className="status-title">
                    <CloudServerOutlined style={{ marginRight: 8 }} />
                    CPU使用率
                  </span>
                  <span className={`status-value ${stats?.systemStatus?.cpu > 80 ? 'status-danger' : stats?.systemStatus?.cpu > 60 ? 'status-warning' : 'status-normal'}`}>
                    {stats?.systemStatus?.cpu || 0}%
                  </span>
                </div>
                <Progress
                  percent={stats?.systemStatus?.cpu || 0}
                  status={stats?.systemStatus?.cpu > 80 ? 'exception' : stats?.systemStatus?.cpu > 60 ? 'warning' : 'normal'}
                  showInfo={false}
                  strokeWidth={8}
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card className="status-card" hoverable>
                <div className="status-header">
                  <span className="status-title">
                    <DatabaseOutlined style={{ marginRight: 8 }} />
                    内存使用率
                  </span>
                  <span className={`status-value ${stats?.systemStatus?.memory > 80 ? 'status-danger' : stats?.systemStatus?.memory > 60 ? 'status-warning' : 'status-normal'}`}>
                    {stats?.systemStatus?.memory || 0}%
                  </span>
                </div>
                <Progress
                  percent={stats?.systemStatus?.memory || 0}
                  status={stats?.systemStatus?.memory > 80 ? 'exception' : stats?.systemStatus?.memory > 60 ? 'warning' : 'normal'}
                  showInfo={false}
                  strokeWidth={8}
                />
              </Card>
            </Col>
            <Col xs={24} sm={8}>
              <Card className="status-card" hoverable>
                <div className="status-header">
                  <span className="status-title">
                    <HddOutlined style={{ marginRight: 8 }} />
                    磁盘使用率
                  </span>
                  <span className={`status-value ${stats?.systemStatus?.disk > 80 ? 'status-danger' : stats?.systemStatus?.disk > 60 ? 'status-warning' : 'status-normal'}`}>
                    {stats?.systemStatus?.disk || 0}%
                  </span>
                </div>
                <Progress
                  percent={stats?.systemStatus?.disk || 0}
                  status={stats?.systemStatus?.disk > 80 ? 'exception' : stats?.systemStatus?.disk > 60 ? 'warning' : 'normal'}
                  showInfo={false}
                  strokeWidth={8}
                />
              </Card>
            </Col>
          </Row>
        </Card>
      </FadeIn>
    </div>
  );
};

export default Dashboard;
