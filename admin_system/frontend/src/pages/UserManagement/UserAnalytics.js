import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Spin,
  Tabs,
  Table,
  Progress,
  Typography,
  DatePicker,
  Button,
  Select,
  Divider,
  Alert,
  List,
  Avatar,
  Tag,
  Space,
  Tooltip
} from 'antd';
import {
  UserOutlined,
  TeamOutlined,
  LockOutlined,
  StopOutlined,
  LineChartOutlined,
  BarChartOutlined,
  PieChartOutlined,
  CalendarOutlined,
  ReloadOutlined,
  RiseOutlined,
  FallOutlined,
  ClockCircleOutlined,
  UserSwitchOutlined,
  MailOutlined,
  PhoneOutlined,
  LoginOutlined,
  LogoutOutlined,
  InfoCircleOutlined
} from '@ant-design/icons';
import { Line, Pie, Column } from '@ant-design/plots';
import { PageHeader } from '../../components/common';
import { getUserStats, getUserGrowth } from '../../services/userService';
import moment from 'dayjs';

const { Title, Text } = Typography;
const { TabPane } = Tabs;
const { RangePicker } = DatePicker;
const { Option } = Select;

const UserAnalytics = () => {
  const [loading, setLoading] = useState(true);
  const [statsData, setStatsData] = useState({});
  const [dateRange, setDateRange] = useState([moment().subtract(30, 'days'), moment()]);
  const [growthPeriod, setGrowthPeriod] = useState(30);

  // 获取用户统计数据
  const fetchUserStats = async () => {
    try {
      setLoading(true);
      const data = await getUserStats();
      setStatsData(data);
    } catch (error) {
      console.error('获取用户统计数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 获取用户增长数据
  const fetchUserGrowth = async (days) => {
    try {
      setLoading(true);
      const data = await getUserGrowth(days);
      // 更新统计数据中的增长趋势
      setStatsData(prev => ({
        ...prev,
        growth_trend: data.data
      }));
    } catch (error) {
      console.error('获取用户增长数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 初始加载
  useEffect(() => {
    fetchUserStats();
  }, []);

  // 处理日期范围变化
  const handleDateRangeChange = (dates) => {
    if (dates && dates.length === 2) {
      setDateRange(dates);
      const days = dates[1].diff(dates[0], 'days') + 1;
      setGrowthPeriod(days);
      fetchUserGrowth(days);
    }
  };

  // 处理刷新
  const handleRefresh = () => {
    fetchUserStats();
  };

  // 用户增长趋势图配置
  const growthConfig = {
    data: statsData.growth_trend || [],
    xField: 'date',
    yField: 'count',
    seriesField: 'type',
    smooth: true,
    animation: {
      appear: {
        animation: 'path-in',
        duration: 1000,
      },
    },
    point: {
      size: 4,
      shape: 'circle',
      style: {
        fill: '#fff',
        stroke: '#1890ff',
        lineWidth: 2,
      },
    },
    tooltip: {
      showMarkers: false,
    },
    state: {
      active: {
        style: {
          shadowBlur: 4,
          stroke: '#000',
          fill: 'red',
        },
      },
    },
    interactions: [
      {
        type: 'marker-active',
      },
    ],
  };

  // 用户活跃度趋势图配置
  const activityConfig = {
    data: statsData.activity_trend || [],
    xField: 'date',
    yField: 'count',
    seriesField: 'type',
    smooth: true,
    color: ['#52c41a'],
    animation: {
      appear: {
        animation: 'path-in',
        duration: 1000,
      },
    },
    point: {
      size: 4,
      shape: 'circle',
      style: {
        fill: '#fff',
        stroke: '#52c41a',
        lineWidth: 2,
      },
    },
    tooltip: {
      showMarkers: false,
    },
  };

  // 用户状态分布图配置
  const statusDistributionConfig = {
    data: statsData.user_distribution?.status_distribution || [],
    angleField: 'value',
    colorField: 'name',
    radius: 0.8,
    innerRadius: 0.6,
    label: {
      type: 'inner',
      offset: '-50%',
      content: '{value}',
      style: {
        textAlign: 'center',
        fontSize: 14,
      },
    },
    interactions: [
      {
        type: 'element-selected',
      },
      {
        type: 'element-active',
      },
    ],
    statistic: {
      title: false,
      content: {
        style: {
          whiteSpace: 'pre-wrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          fontSize: '16px',
        },
        content: '用户状态',
      },
    },
    legend: {
      position: 'bottom',
    },
  };

  // 用户注册时间分布图配置
  const registrationDistributionConfig = {
    data: statsData.user_distribution?.registration_distribution || [],
    xField: 'name',
    yField: 'value',
    label: {
      position: 'middle',
      style: {
        fill: '#FFFFFF',
        opacity: 0.6,
      },
    },
    meta: {
      name: {
        alias: '注册时间',
      },
      value: {
        alias: '用户数量',
      },
    },
    color: '#1890ff',
  };

  // 用户活跃度分布图配置
  const activityDistributionConfig = {
    data: statsData.user_distribution?.activity_distribution || [],
    angleField: 'value',
    colorField: 'name',
    radius: 0.8,
    label: {
      type: 'outer',
      content: '{name}: {percentage}',
    },
    interactions: [
      {
        type: 'pie-legend-active',
      },
      {
        type: 'element-active',
      },
    ],
  };

  // 用户留存率表格列
  const retentionColumns = [
    {
      title: '留存周期',
      dataIndex: 'period',
      key: 'period',
    },
    {
      title: '新增用户数',
      dataIndex: 'new_users',
      key: 'new_users',
    },
    {
      title: '留存用户数',
      dataIndex: 'retained_users',
      key: 'retained_users',
    },
    {
      title: '留存率',
      dataIndex: 'rate',
      key: 'rate',
      render: (text) => (
        <div style={{ width: 200 }}>
          <Progress
            percent={text}
            size="small"
            status={text > 50 ? 'success' : text > 20 ? 'normal' : 'exception'}
            format={(percent) => `${percent}%`}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="user-analytics-container">
      <PageHeader
        title="用户分析"
        subTitle="用户数据统计与分析"
        breadcrumb={[
          { title: '首页', path: '/' },
          { title: '用户管理' },
          { title: '用户分析' }
        ]}
        extra={[
          <Button
            key="refresh"
            icon={<ReloadOutlined />}
            onClick={handleRefresh}
            loading={loading}
          >
            刷新数据
          </Button>,
        ]}
      />

      <Spin spinning={loading} tip="加载中...">
        <div className="analytics-content">
          {/* 用户概览统计卡片 */}
          <Row gutter={16} className="stats-row">
            <Col span={6}>
              <Card className="stat-card">
                <Statistic
                  title="总用户数"
                  value={statsData.total_users || 0}
                  prefix={<TeamOutlined />}
                  valueStyle={{ color: '#1890ff' }}
                />
                <div className="stat-footer">
                  <Text type="secondary">
                    今日新增: <Text strong style={{ color: '#52c41a' }}>{statsData.new_users_today || 0}</Text>
                  </Text>
                  <Text type="secondary">
                    本周新增: <Text strong>{statsData.new_users_this_week || 0}</Text>
                  </Text>
                </div>
              </Card>
            </Col>
            <Col span={6}>
              <Card className="stat-card">
                <Statistic
                  title="活跃用户"
                  value={statsData.active_users || 0}
                  prefix={<UserOutlined />}
                  valueStyle={{ color: '#52c41a' }}
                />
                <div className="stat-footer">
                  <Text type="secondary">
                    占比: <Text strong>{statsData.total_users ? Math.round((statsData.active_users / statsData.total_users) * 100) : 0}%</Text>
                  </Text>
                  <Text type="secondary">
                    今日登录: <Text strong style={{ color: '#52c41a' }}>{statsData.login_users_today || 0}</Text>
                  </Text>
                </div>
              </Card>
            </Col>
            <Col span={6}>
              <Card className="stat-card">
                <Statistic
                  title="禁用用户"
                  value={statsData.inactive_users || 0}
                  prefix={<LockOutlined />}
                  valueStyle={{ color: '#faad14' }}
                />
                <div className="stat-footer">
                  <Text type="secondary">
                    占比: <Text strong>{statsData.total_users ? Math.round((statsData.inactive_users / statsData.total_users) * 100) : 0}%</Text>
                  </Text>
                </div>
              </Card>
            </Col>
            <Col span={6}>
              <Card className="stat-card">
                <Statistic
                  title="封禁用户"
                  value={statsData.banned_users || 0}
                  prefix={<StopOutlined />}
                  valueStyle={{ color: '#ff4d4f' }}
                />
                <div className="stat-footer">
                  <Text type="secondary">
                    占比: <Text strong>{statsData.total_users ? Math.round((statsData.banned_users / statsData.total_users) * 100) : 0}%</Text>
                  </Text>
                </div>
              </Card>
            </Col>
          </Row>

          {/* 用户增长与活跃度 */}
          <Row gutter={16} className="chart-row">
            <Col span={24}>
              <Card
                title={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span><LineChartOutlined /> 用户增长趋势</span>
                    <RangePicker
                      value={dateRange}
                      onChange={handleDateRangeChange}
                      allowClear={false}
                      ranges={{
                        '最近7天': [moment().subtract(6, 'days'), moment()],
                        '最近30天': [moment().subtract(29, 'days'), moment()],
                        '最近90天': [moment().subtract(89, 'days'), moment()],
                      }}
                    />
                  </div>
                }
                className="chart-card"
              >
                {statsData.growth_trend && statsData.growth_trend.length > 0 ? (
                  <Line {...growthConfig} height={300} />
                ) : (
                  <div className="empty-chart">
                    <Text type="secondary">暂无数据</Text>
                  </div>
                )}
                <Row gutter={16} style={{ marginTop: 16 }}>
                  <Col span={6}>
                    <Statistic
                      title="今日新增"
                      value={statsData.new_users_today || 0}
                      valueStyle={{ color: '#1890ff' }}
                      prefix={<RiseOutlined />}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic
                      title="昨日新增"
                      value={statsData.new_users_yesterday || 0}
                      valueStyle={{ color: '#52c41a' }}
                    />
                    <div style={{ marginTop: 4 }}>
                      {statsData.new_users_today > statsData.new_users_yesterday ? (
                        <Text type="success">
                          <RiseOutlined /> 增长 {Math.round((statsData.new_users_today - statsData.new_users_yesterday) / (statsData.new_users_yesterday || 1) * 100)}%
                        </Text>
                      ) : (
                        <Text type="danger">
                          <FallOutlined /> 下降 {Math.round((statsData.new_users_yesterday - statsData.new_users_today) / (statsData.new_users_yesterday || 1) * 100)}%
                        </Text>
                      )}
                    </div>
                  </Col>
                  <Col span={6}>
                    <Statistic
                      title="本周新增"
                      value={statsData.new_users_this_week || 0}
                      valueStyle={{ color: '#722ed1' }}
                    />
                  </Col>
                  <Col span={6}>
                    <Statistic
                      title="本月新增"
                      value={statsData.new_users_this_month || 0}
                      valueStyle={{ color: '#eb2f96' }}
                    />
                  </Col>
                </Row>
              </Card>
            </Col>
          </Row>

          <Tabs defaultActiveKey="1" className="analytics-tabs">
            <TabPane tab={<span><BarChartOutlined /> 用户活跃度分析</span>} key="1">
              <Row gutter={16}>
                <Col span={16}>
                  <Card title="用户活跃度趋势" className="chart-card">
                    {statsData.activity_trend && statsData.activity_trend.length > 0 ? (
                      <Line {...activityConfig} height={300} />
                    ) : (
                      <div className="empty-chart">
                        <Text type="secondary">暂无数据</Text>
                      </div>
                    )}
                    <Row gutter={16} style={{ marginTop: 16 }}>
                      <Col span={8}>
                        <Statistic
                          title="今日活跃用户"
                          value={statsData.login_users_today || 0}
                          valueStyle={{ color: '#52c41a' }}
                          prefix={<LoginOutlined />}
                        />
                      </Col>
                      <Col span={8}>
                        <Statistic
                          title="昨日活跃用户"
                          value={statsData.login_users_yesterday || 0}
                          valueStyle={{ color: '#1890ff' }}
                        />
                        <div style={{ marginTop: 4 }}>
                          {statsData.login_users_today > statsData.login_users_yesterday ? (
                            <Text type="success">
                              <RiseOutlined /> 增长 {Math.round((statsData.login_users_today - statsData.login_users_yesterday) / (statsData.login_users_yesterday || 1) * 100)}%
                            </Text>
                          ) : (
                            <Text type="danger">
                              <FallOutlined /> 下降 {Math.round((statsData.login_users_yesterday - statsData.login_users_today) / (statsData.login_users_yesterday || 1) * 100)}%
                            </Text>
                          )}
                        </div>
                      </Col>
                      <Col span={8}>
                        <Statistic
                          title="本周活跃用户"
                          value={statsData.login_users_this_week || 0}
                          valueStyle={{ color: '#722ed1' }}
                        />
                      </Col>
                    </Row>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card title="用户活跃度分布" className="chart-card">
                    {statsData.user_distribution?.activity_distribution && statsData.user_distribution.activity_distribution.length > 0 ? (
                      <Pie {...activityDistributionConfig} height={300} />
                    ) : (
                      <div className="empty-chart">
                        <Text type="secondary">暂无数据</Text>
                      </div>
                    )}
                  </Card>
                </Col>
              </Row>
            </TabPane>

            <TabPane tab={<span><PieChartOutlined /> 用户分布分析</span>} key="2">
              <Row gutter={16}>
                <Col span={8}>
                  <Card title="用户状态分布" className="chart-card">
                    {statsData.user_distribution?.status_distribution && statsData.user_distribution.status_distribution.length > 0 ? (
                      <Pie {...statusDistributionConfig} height={300} />
                    ) : (
                      <div className="empty-chart">
                        <Text type="secondary">暂无数据</Text>
                      </div>
                    )}
                  </Card>
                </Col>
                <Col span={16}>
                  <Card title="用户注册时间分布" className="chart-card">
                    {statsData.user_distribution?.registration_distribution && statsData.user_distribution.registration_distribution.length > 0 ? (
                      <Column {...registrationDistributionConfig} height={300} />
                    ) : (
                      <div className="empty-chart">
                        <Text type="secondary">暂无数据</Text>
                      </div>
                    )}
                  </Card>
                </Col>
              </Row>
            </TabPane>

            <TabPane tab={<span><UserSwitchOutlined /> 用户留存分析</span>} key="3">
              <Row gutter={16}>
                <Col span={24}>
                  <Card title="用户留存率" className="chart-card">
                    <Alert
                      message="留存率说明"
                      description="留存率是指用户在某段时间内的活跃程度。次日留存率表示新用户注册后第二天仍然活跃的比例，7日留存率表示新用户注册后第7天仍然活跃的比例，30日留存率表示新用户注册后第30天仍然活跃的比例。"
                      type="info"
                      showIcon
                      style={{ marginBottom: 16 }}
                    />
                    <Table
                      dataSource={statsData.retention_rate || []}
                      columns={retentionColumns}
                      rowKey="period"
                      pagination={false}
                    />
                  </Card>
                </Col>
              </Row>
            </TabPane>

            <TabPane tab={<span><InfoCircleOutlined /> 用户详情</span>} key="4">
              <Row gutter={16}>
                <Col span={12}>
                  <Card title="最近注册用户" className="chart-card">
                    <List
                      itemLayout="horizontal"
                      dataSource={statsData.recent_users || []}
                      renderItem={item => (
                        <List.Item>
                          <List.Item.Meta
                            avatar={<Avatar icon={<UserOutlined />} src={item.avatar} />}
                            title={<a href={`/users/detail/${item.id}`}>{item.username}</a>}
                            description={
                              <Space>
                                <Text type="secondary"><MailOutlined /> {item.email}</Text>
                                <Text type="secondary"><CalendarOutlined /> 注册于 {moment(item.date_joined).format('YYYY-MM-DD HH:mm')}</Text>
                              </Space>
                            }
                          />
                        </List.Item>
                      )}
                    />
                  </Card>
                </Col>
                <Col span={12}>
                  <Card title="最活跃用户" className="chart-card">
                    <List
                      itemLayout="horizontal"
                      dataSource={statsData.most_active_users || []}
                      renderItem={item => (
                        <List.Item>
                          <List.Item.Meta
                            avatar={<Avatar icon={<UserOutlined />} src={item.avatar} />}
                            title={<a href={`/users/detail/${item.id}`}>{item.username}</a>}
                            description={
                              <Space>
                                <Text type="secondary"><MailOutlined /> {item.email}</Text>
                                <Text type="secondary"><LoginOutlined /> 登录次数: {item.login_count}</Text>
                              </Space>
                            }
                          />
                          <div>
                            <Tag color="green">活跃用户</Tag>
                          </div>
                        </List.Item>
                      )}
                    />
                  </Card>
                </Col>
              </Row>
            </TabPane>
          </Tabs>
        </div>
      </Spin>
    </div>
  );
};

export default UserAnalytics;
