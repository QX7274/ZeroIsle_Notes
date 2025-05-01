import React, { useState, useEffect } from 'react';
import { Row, Col, Table, Typography, Spin, Alert, Progress, Tooltip, Badge, DatePicker, Button, Space, Tabs, Avatar, List, Tag, Card, Statistic } from 'antd';
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
  HddOutlined,
  AppstoreOutlined,
  BellOutlined,
  CheckCircleOutlined,
  ExclamationCircleOutlined,
  CloseCircleOutlined,
  SyncOutlined,
  AreaChartOutlined,
  PieChartOutlined,
  BarChartOutlined,
  LineChartOutlined,
  CalendarOutlined,
  ReloadOutlined,
  SettingOutlined,
  EditOutlined,
  EyeOutlined,
  DeleteOutlined,
  DashboardOutlined,
  TeamOutlined,
  FileOutlined,
  FolderOutlined,
  StarOutlined,
  FireOutlined,
  ThunderboltOutlined,
  TrophyOutlined,
  RocketOutlined,
  BarChartOutlined as BarIcon,
  PieChartOutlined as PieIcon,
  LineChartOutlined as LineIcon,
  AreaChartOutlined as AreaIcon
} from '@ant-design/icons';
import { getDashboardStats } from '../services/statsService';
import dayjs from 'dayjs';
import '../styles/Dashboard.css';

const { Title } = Typography;

const { TabPane } = Tabs;
const { RangePicker } = DatePicker;

const Dashboard = () => {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [dateRange, setDateRange] = useState([dayjs().subtract(30, 'day'), dayjs()]);
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  const [chartType, setChartType] = useState('line');

  // 获取仪表盘数据
  const fetchStats = async (startDate, endDate) => {
    try {
      setRefreshing(true);
      const params = {};

      if (startDate && endDate) {
        params.startDate = startDate.format('YYYY-MM-DD');
        params.endDate = endDate.format('YYYY-MM-DD');
      }

      const data = await getDashboardStats(params);
      setStats(data);
      setError(null);
    } catch (err) {
      console.error('获取仪表盘数据失败:', err);
      setError('获取数据失败，请稍后重试');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // 处理日期范围变化
  const handleDateRangeChange = (dates) => {
    if (dates && dates.length === 2) {
      setDateRange(dates);
      fetchStats(dates[0], dates[1]);
    }
  };

  // 手动刷新数据
  const handleRefresh = () => {
    fetchStats(dateRange[0], dateRange[1]);
  };

  // 切换图表类型
  const handleChartTypeChange = (type) => {
    setChartType(type);
  };

  // 初始加载和定时刷新
  useEffect(() => {
    fetchStats(dateRange[0], dateRange[1]);

    // 设置定时刷新
    const intervalId = setInterval(() => {
      fetchStats(dateRange[0], dateRange[1]);
    }, 5 * 60 * 1000); // 每5分钟刷新一次

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
        <div className="loading-spinner">
          <Spin size="large" />
        </div>
        <div className="loading-text">
          <p>加载仪表盘数据...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <Alert
          message="错误"
          description={error}
          type="error"
          showIcon
          action={
            <Button type="primary" size="small" onClick={handleRefresh}>
              重试
            </Button>
          }
          style={{
            borderRadius: '12px',
            boxShadow: '0 6px 16px rgba(0, 0, 0, 0.08)',
            margin: '24px'
          }}
        />
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-header">
        <div className="dashboard-title">
          <DashboardOutlined className="dashboard-icon" />
          <div className="title-content">
            <Typography.Title level={3} style={{ margin: 0 }}>仪表盘</Typography.Title>
            <Typography.Text type="secondary">系统概览和数据统计</Typography.Text>
          </div>
        </div>
        <div className="dashboard-actions">
          <Space size={16}>
            <RangePicker
              value={dateRange}
              onChange={handleDateRangeChange}
              allowClear={false}
              style={{
                borderRadius: '10px',
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.05)'
              }}
            />
            <Button
              type="primary"
              icon={<ReloadOutlined />}
              loading={refreshing}
              onClick={handleRefresh}
              style={{
                borderRadius: '10px',
                boxShadow: '0 2px 8px rgba(67, 97, 238, 0.2)'
              }}
            >
              刷新数据
            </Button>
          </Space>
        </div>
      </div>

      {/* 统计卡片 */}
      <Row gutter={[24, 24]} className="stats-row">
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card" hoverable>
            <div className="stat-icon" style={{ backgroundColor: 'rgba(67, 97, 238, 0.1)' }}>
              <TeamOutlined style={{ color: '#4361EE' }} />
            </div>
            <div className="stat-content">
              <div className="stat-title">总用户数</div>
              <div className="stat-value">{stats?.totalUsers || 0}</div>
              <div className="stat-footer">
                <Badge
                  count={`今日 +${stats?.todayNewUsers || 0}`}
                  className="stat-badge"
                  style={{
                    backgroundColor: 'rgba(67, 97, 238, 0.1)',
                    color: '#4361EE',
                    fontWeight: 500
                  }}
                />
                <RiseOutlined className="stat-trend" style={{ color: '#52C41A' }} />
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card" hoverable>
            <div className="stat-icon" style={{ backgroundColor: 'rgba(76, 201, 240, 0.1)' }}>
              <FileOutlined style={{ color: '#4CC9F0' }} />
            </div>
            <div className="stat-content">
              <div className="stat-title">总笔记数</div>
              <div className="stat-value">{stats?.totalNotes || 0}</div>
              <div className="stat-footer">
                <Badge
                  count={`今日 +${stats?.todayNewNotes || 0}`}
                  className="stat-badge"
                  style={{
                    backgroundColor: 'rgba(76, 201, 240, 0.1)',
                    color: '#4CC9F0',
                    fontWeight: 500
                  }}
                />
                <RiseOutlined className="stat-trend" style={{ color: '#52C41A' }} />
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card" hoverable>
            <div className="stat-icon" style={{ backgroundColor: 'rgba(58, 12, 163, 0.1)' }}>
              <TagsOutlined style={{ color: '#3A0CA3' }} />
            </div>
            <div className="stat-content">
              <div className="stat-title">总标签数</div>
              <div className="stat-value">{stats?.totalTags || 0}</div>
              <div className="stat-footer">
                <Badge
                  count="标签管理"
                  className="stat-badge"
                  style={{
                    backgroundColor: 'rgba(58, 12, 163, 0.1)',
                    color: '#3A0CA3',
                    fontWeight: 500
                  }}
                />
              </div>
            </div>
          </Card>
        </Col>
        <Col xs={24} sm={12} md={6}>
          <Card className="stat-card" hoverable>
            <div className="stat-icon" style={{ backgroundColor: 'rgba(247, 37, 133, 0.1)' }}>
              <CommentOutlined style={{ color: '#F72585' }} />
            </div>
            <div className="stat-content">
              <div className="stat-title">总评论数</div>
              <div className="stat-value">{stats?.totalComments || 0}</div>
              <div className="stat-footer">
                <Badge
                  count="评论管理"
                  className="stat-badge"
                  style={{
                    backgroundColor: 'rgba(247, 37, 133, 0.1)',
                    color: '#F72585',
                    fontWeight: 500
                  }}
                />
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {/* 用户增长趋势和内容分布 */}
      <Row gutter={[24, 24]} className="charts-row">
        <Col xs={24} lg={12}>
          <Card
            title={
              <div className="chart-title">
                <LineChartOutlined />
                <span>用户增长趋势</span>
              </div>
            }
            className="chart-card"
            hoverable
            extra={
              <Space>
                <Tooltip title="今日新增用户">
                  <Badge
                    count={`+${stats?.todayNewUsers || 0}`}
                    style={{
                      backgroundColor: 'rgba(76, 201, 240, 0.15)',
                      color: '#4CC9F0',
                      fontWeight: 600,
                      borderRadius: '12px',
                      padding: '0 10px',
                      boxShadow: '0 3px 10px rgba(76, 201, 240, 0.15)'
                    }}
                  />
                </Tooltip>
                <Button
                  type="text"
                  icon={<ReloadOutlined />}
                  onClick={handleRefresh}
                  size="small"
                  className="chart-refresh-btn"
                />
              </Space>
            }
          >
            <div className="chart-container">
              {loading ? (
                <div className="chart-loading">
                  <Spin />
                  <span>加载中...</span>
                </div>
              ) : (
                <div className="chart-placeholder">
                  <div className="chart-line-placeholder">
                    <div className="chart-line-bg"></div>
                    <div className="chart-line-data"></div>
                  </div>
                  <div className="chart-legend">
                    <div className="chart-legend-item">
                      <div className="chart-legend-color" style={{ backgroundColor: '#4361EE' }}></div>
                      <div className="chart-legend-text">新增用户</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            title={
              <div className="chart-title">
                <PieChartOutlined />
                <span>内容类型分布</span>
              </div>
            }
            className="chart-card"
            hoverable
            extra={
              <Button
                type="text"
                icon={<ReloadOutlined />}
                onClick={handleRefresh}
                size="small"
                className="chart-refresh-btn"
              />
            }
          >
            <div className="chart-container">
              {loading ? (
                <div className="chart-loading">
                  <Spin />
                  <span>加载中...</span>
                </div>
              ) : (
                <div className="chart-placeholder">
                  <div className="chart-pie-placeholder">
                    <div className="chart-pie-center"></div>
                  </div>
                  <div className="chart-legend">
                    <div className="chart-legend-item">
                      <div className="chart-legend-color" style={{ backgroundColor: '#4361EE' }}></div>
                      <div className="chart-legend-text">笔记</div>
                    </div>
                    <div className="chart-legend-item">
                      <div className="chart-legend-color" style={{ backgroundColor: '#4CC9F0' }}></div>
                      <div className="chart-legend-text">图片</div>
                    </div>
                    <div className="chart-legend-item">
                      <div className="chart-legend-color" style={{ backgroundColor: '#3A0CA3' }}></div>
                      <div className="chart-legend-text">音频</div>
                    </div>
                    <div className="chart-legend-item">
                      <div className="chart-legend-color" style={{ backgroundColor: '#F72585' }}></div>
                      <div className="chart-legend-text">视频</div>
                    </div>
                    <div className="chart-legend-item">
                      <div className="chart-legend-color" style={{ backgroundColor: '#7209B7' }}></div>
                      <div className="chart-legend-text">文档</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </Col>
      </Row>

      {/* 用户活跃度和最近用户 */}
      <Row gutter={[24, 24]} className="charts-row">
        <Col xs={24} lg={12}>
          <Card
            title={
              <div className="chart-title">
                <AreaChartOutlined />
                <span>用户活跃度趋势</span>
              </div>
            }
            className="chart-card"
            hoverable
            extra={
              <Button
                type="text"
                icon={<ReloadOutlined />}
                onClick={handleRefresh}
                size="small"
                className="chart-refresh-btn"
              />
            }
          >
            <div className="chart-container">
              {loading ? (
                <div className="chart-loading">
                  <Spin />
                  <span>加载中...</span>
                </div>
              ) : (
                <div className="chart-placeholder">
                  <div className="chart-area-placeholder">
                    <div className="chart-area-bg"></div>
                    <div className="chart-area-data"></div>
                  </div>
                  <div className="chart-legend">
                    <div className="chart-legend-item">
                      <div className="chart-legend-color" style={{ backgroundColor: '#4CC9F0' }}></div>
                      <div className="chart-legend-text">活跃用户</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card
            title={
              <div className="chart-title">
                <TeamOutlined />
                <span>最近注册用户</span>
              </div>
            }
            className="chart-card"
            hoverable
            extra={
              <Button
                type="text"
                icon={<ReloadOutlined />}
                onClick={handleRefresh}
                size="small"
                className="chart-refresh-btn"
              />
            }
          >
            <div className="recent-users-container">
              {loading ? (
                <div className="chart-loading">
                  <Spin />
                  <span>加载中...</span>
                </div>
              ) : (
                <Table
                  columns={userColumns}
                  dataSource={stats?.recentUsers || []}
                  rowKey="id"
                  pagination={{ pageSize: 5 }}
                  size="small"
                  className="recent-users-table"
                />
              )}
            </div>
          </Card>
        </Col>
      </Row>

      {/* 系统状态 */}
      <SlideIn direction="up" distance={30} delay={500}>
        <Card
          title={
            <div className="chart-title">
              <CloudServerOutlined />
              系统状态
            </div>
          }
          className="system-status-card"
          hoverable
          extra={
            <Button
              type="text"
              icon={<ReloadOutlined />}
              onClick={handleRefresh}
              size="small"
            />
          }
        >
          <Stagger animation="fadeInUp" staggerDelay={100} distance={20}>
            <Row gutter={[24, 24]}>
              <Col xs={24} sm={8}>
                <Card className="status-card" hoverable>
                  <div className="status-header">
                    <span className="status-title">
                      <CloudServerOutlined />
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
                    strokeWidth={10}
                    strokeColor={
                      stats?.systemStatus?.cpu > 80
                        ? '#F72585'
                        : stats?.systemStatus?.cpu > 60
                          ? '#FAAD14'
                          : '#52C41A'
                    }
                    trailColor="#F0F5FF"
                    style={{ borderRadius: '8px', overflow: 'hidden' }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={8}>
                <Card className="status-card" hoverable>
                  <div className="status-header">
                    <span className="status-title">
                      <DatabaseOutlined />
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
                    strokeWidth={10}
                    strokeColor={
                      stats?.systemStatus?.memory > 80
                        ? '#F72585'
                        : stats?.systemStatus?.memory > 60
                          ? '#FAAD14'
                          : '#52C41A'
                    }
                    trailColor="#F0F5FF"
                    style={{ borderRadius: '8px', overflow: 'hidden' }}
                  />
                </Card>
              </Col>
              <Col xs={24} sm={8}>
                <Card className="status-card" hoverable>
                  <div className="status-header">
                    <span className="status-title">
                      <HddOutlined />
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
                    strokeWidth={10}
                    strokeColor={
                      stats?.systemStatus?.disk > 80
                        ? '#F72585'
                        : stats?.systemStatus?.disk > 60
                          ? '#FAAD14'
                          : '#52C41A'
                    }
                    trailColor="#F0F5FF"
                    style={{ borderRadius: '8px', overflow: 'hidden' }}
                  />
                </Card>
              </Col>
            </Row>
          </Stagger>
        </Card>
      </SlideIn>
    </div>
  );
};

export default Dashboard;
