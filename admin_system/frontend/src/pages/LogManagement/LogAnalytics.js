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
  Tag,
  Space,
  Tooltip,
  Radio
} from 'antd';
import {
  LineChartOutlined,
  BarChartOutlined,
  PieChartOutlined,
  CalendarOutlined,
  ReloadOutlined,
  RiseOutlined,
  FallOutlined,
  ClockCircleOutlined,
  WarningOutlined,
  InfoCircleOutlined,
  ExclamationCircleOutlined,
  BugOutlined,
  FileTextOutlined,
  UserOutlined,
  SettingOutlined,
  DatabaseOutlined,
  ApiOutlined,
  CloudServerOutlined,
  DesktopOutlined,
  MobileOutlined,
  GlobalOutlined
} from '@ant-design/icons';
import { Line, Pie, Column, Bar } from '@ant-design/plots';
import { PageHeader } from '../../components/common';
import {
  getAdminLogStats,
  getSystemLogStats,
  getLogAnalytics
} from '../../services/logService';
import moment from 'dayjs';

const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;
const { RangePicker } = DatePicker;
const { Option } = Select;

// 日志分析页面组件

const LogAnalytics = () => {
  const [loading, setLoading] = useState(true);
  const [adminStats, setAdminStats] = useState({});
  const [systemStats, setSystemStats] = useState({});
  const [analyticsData, setAnalyticsData] = useState({});
  const [dateRange, setDateRange] = useState([moment().subtract(30, 'days'), moment()]);
  const [analyticsPeriod, setAnalyticsPeriod] = useState(30);
  const [logType, setLogType] = useState('all');

  // 获取管理员日志统计数据
  const fetchAdminLogStats = async () => {
    try {
      setLoading(true);
      const data = await getAdminLogStats();
      if (data.status === 'success') {
        setAdminStats(data.data);
      }
    } catch (error) {
      console.error('获取管理员日志统计数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 获取系统日志统计数据
  const fetchSystemLogStats = async () => {
    try {
      setLoading(true);
      const data = await getSystemLogStats();
      if (data.status === 'success') {
        setSystemStats(data.data);
      }
    } catch (error) {
      console.error('获取系统日志统计数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 获取日志分析数据
  const fetchLogAnalytics = async (days, type = 'all') => {
    try {
      setLoading(true);
      const params = {
        days,
        type
      };
      const data = await getLogAnalytics(params);
      if (data.status === 'success') {
        setAnalyticsData(data.data);
      }
    } catch (error) {
      console.error('获取日志分析数据失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 初始加载
  useEffect(() => {
    fetchAdminLogStats();
    fetchSystemLogStats();
    fetchLogAnalytics(30, 'all');
  }, []);

  // 处理日期范围变化
  const handleDateRangeChange = (dates) => {
    if (dates && dates.length === 2) {
      setDateRange(dates);
      const days = dates[1].diff(dates[0], 'days') + 1;
      setAnalyticsPeriod(days);
      fetchLogAnalytics(days, logType);
    }
  };

  // 处理日志类型变化
  const handleLogTypeChange = (e) => {
    const type = e.target.value;
    setLogType(type);
    fetchLogAnalytics(analyticsPeriod, type);
  };

  // 处理刷新
  const handleRefresh = () => {
    fetchAdminLogStats();
    fetchSystemLogStats();
    fetchLogAnalytics(analyticsPeriod, logType);
  };

  // 日志趋势图配置
  const logTrendConfig = {
    data: analyticsData.log_trend || [],
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
    legend: {
      position: 'top',
    },
  };

  // 错误日志趋势图配置
  const errorTrendConfig = {
    data: analyticsData.error_trend || [],
    xField: 'date',
    yField: 'count',
    seriesField: 'type',
    smooth: true,
    color: ['#ff4d4f', '#faad14'],
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
        stroke: '#ff4d4f',
        lineWidth: 2,
      },
    },
    tooltip: {
      showMarkers: false,
    },
  };

  // 日志类型分布图配置
  const logTypeDistributionConfig = {
    data: analyticsData.log_type_distribution || [],
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
        content: '日志类型',
      },
    },
    legend: {
      position: 'bottom',
    },
  };

  // 系统日志级别分布图配置
  const logLevelDistributionConfig = {
    data: analyticsData.log_level_distribution || [],
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
        alias: '日志级别',
      },
      value: {
        alias: '数量',
      },
    },
    color: ({ name }) => {
      if (name === '错误') return '#ff4d4f';
      if (name === '警告') return '#faad14';
      if (name === '信息') return '#52c41a';
      if (name === '调试') return '#1890ff';
      return '#722ed1';
    },
  };

  // 管理员操作类型分布图配置
  const adminActionDistributionConfig = {
    data: analyticsData.admin_action_distribution || [],
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

  // 热门模块排行榜配置
  const topModulesConfig = {
    data: analyticsData.top_modules || [],
    xField: 'value',
    yField: 'name',
    seriesField: 'name',
    legend: { position: 'top-left' },
    barBackground: { style: { fill: 'rgba(0,0,0,0.05)' } },
    interactions: [{ type: 'active-region', enable: false }],
    label: {
      position: 'right',
      offset: 4,
    },
    color: ({ name }) => {
      const colors = ['#1890ff', '#52c41a', '#722ed1', '#eb2f96', '#faad14', '#13c2c2', '#fa541c'];
      const index = (analyticsData.top_modules || []).findIndex(item => item.name === name);
      return colors[index % colors.length];
    },
  };

  // 热门IP地址排行榜配置
  const topIpsConfig = {
    data: analyticsData.top_ips || [],
    xField: 'value',
    yField: 'name',
    seriesField: 'name',
    legend: { position: 'top-left' },
    barBackground: { style: { fill: 'rgba(0,0,0,0.05)' } },
    interactions: [{ type: 'active-region', enable: false }],
    label: {
      position: 'right',
      offset: 4,
    },
  };

  // 热门错误消息表格列
  const topErrorsColumns = [
    {
      title: '错误消息',
      dataIndex: 'message',
      key: 'message',
      ellipsis: true,
      render: (text) => (
        <Tooltip title={text}>
          <span>{text}</span>
        </Tooltip>
      ),
    },
    {
      title: '来源',
      dataIndex: 'source',
      key: 'source',
      width: 120,
    },
    {
      title: '次数',
      dataIndex: 'count',
      key: 'count',
      width: 80,
      sorter: (a, b) => a.count - b.count,
      defaultSortOrder: 'descend',
    },
    {
      title: '最后出现时间',
      dataIndex: 'last_time',
      key: 'last_time',
      width: 180,
      render: (text) => moment(text).format('YYYY-MM-DD HH:mm:ss')
    },
  ];

  return (
    <div className="log-analytics-container">
      <PageHeader
        title="日志分析"
        subTitle="日志数据统计与分析"
        breadcrumb={[
          { title: '首页', path: '/' },
          { title: '日志管理' },
          { title: '日志分析' }
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
          {/* 日志概览统计卡片 */}
          <Row gutter={16} className="stats-row">
            <Col span={6}>
              <Card className="stat-card">
                <Statistic
                  title="总日志数"
                  value={(adminStats.total_logs || 0) + (systemStats.total_logs || 0)}
                  prefix={<FileTextOutlined />}
                  valueStyle={{ color: '#1890ff' }}
                />
                <div className="stat-footer">
                  <Text type="secondary">
                    管理日志: <Text strong>{adminStats.total_logs || 0}</Text>
                  </Text>
                  <Text type="secondary">
                    系统日志: <Text strong>{systemStats.total_logs || 0}</Text>
                  </Text>
                </div>
              </Card>
            </Col>
            <Col span={6}>
              <Card className="stat-card">
                <Statistic
                  title="错误日志"
                  value={(systemStats.level_stats?.error || 0)}
                  prefix={<ExclamationCircleOutlined />}
                  valueStyle={{ color: '#ff4d4f' }}
                />
                <div className="stat-footer">
                  <Text type="secondary">
                    占比: <Text strong>{systemStats.total_logs ? Math.round((systemStats.level_stats?.error || 0) / systemStats.total_logs * 100) : 0}%</Text>
                  </Text>
                </div>
              </Card>
            </Col>
            <Col span={6}>
              <Card className="stat-card">
                <Statistic
                  title="警告日志"
                  value={(systemStats.level_stats?.warning || 0)}
                  prefix={<WarningOutlined />}
                  valueStyle={{ color: '#faad14' }}
                />
                <div className="stat-footer">
                  <Text type="secondary">
                    占比: <Text strong>{systemStats.total_logs ? Math.round((systemStats.level_stats?.warning || 0) / systemStats.total_logs * 100) : 0}%</Text>
                  </Text>
                </div>
              </Card>
            </Col>
            <Col span={6}>
              <Card className="stat-card">
                <Statistic
                  title="管理员操作"
                  value={(adminStats.total_logs || 0)}
                  prefix={<UserOutlined />}
                  valueStyle={{ color: '#722ed1' }}
                />
                <div className="stat-footer">
                  <Text type="secondary">
                    创建: <Text strong>{adminStats.action_stats?.create || 0}</Text>
                  </Text>
                  <Text type="secondary">
                    更新: <Text strong>{adminStats.action_stats?.update || 0}</Text>
                  </Text>
                </div>
              </Card>
            </Col>
          </Row>

          {/* 日志趋势图 */}
          <Row gutter={16} className="chart-row">
            <Col span={24}>
              <Card
                title={
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Space>
                      <LineChartOutlined /> 日志趋势
                      <Radio.Group value={logType} onChange={handleLogTypeChange} buttonStyle="solid" size="small">
                        <Radio.Button value="all">全部</Radio.Button>
                        <Radio.Button value="admin">管理日志</Radio.Button>
                        <Radio.Button value="system">系统日志</Radio.Button>
                      </Radio.Group>
                    </Space>
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
                {analyticsData.log_trend && analyticsData.log_trend.length > 0 ? (
                  <Line {...logTrendConfig} height={300} />
                ) : (
                  <div className="empty-chart">
                    <Text type="secondary">暂无数据</Text>
                  </div>
                )}
              </Card>
            </Col>
          </Row>

          <Tabs defaultActiveKey="1" className="analytics-tabs">
            <TabPane tab={<span><BarChartOutlined /> 日志分布分析</span>} key="1">
              <Row gutter={16}>
                <Col span={12}>
                  <Card title="日志类型分布" className="chart-card">
                    {analyticsData.log_type_distribution && analyticsData.log_type_distribution.length > 0 ? (
                      <Pie {...logTypeDistributionConfig} height={300} />
                    ) : (
                      <div className="empty-chart">
                        <Text type="secondary">暂无数据</Text>
                      </div>
                    )}
                  </Card>
                </Col>
                <Col span={12}>
                  <Card title="系统日志级别分布" className="chart-card">
                    {analyticsData.log_level_distribution && analyticsData.log_level_distribution.length > 0 ? (
                      <Column {...logLevelDistributionConfig} height={300} />
                    ) : (
                      <div className="empty-chart">
                        <Text type="secondary">暂无数据</Text>
                      </div>
                    )}
                  </Card>
                </Col>
              </Row>
              <Row gutter={16} style={{ marginTop: 16 }}>
                <Col span={12}>
                  <Card title="管理员操作类型分布" className="chart-card">
                    {analyticsData.admin_action_distribution && analyticsData.admin_action_distribution.length > 0 ? (
                      <Pie {...adminActionDistributionConfig} height={300} />
                    ) : (
                      <div className="empty-chart">
                        <Text type="secondary">暂无数据</Text>
                      </div>
                    )}
                  </Card>
                </Col>
                <Col span={12}>
                  <Card title="热门模块排行榜" className="chart-card">
                    {analyticsData.top_modules && analyticsData.top_modules.length > 0 ? (
                      <Bar {...topModulesConfig} height={300} />
                    ) : (
                      <div className="empty-chart">
                        <Text type="secondary">暂无数据</Text>
                      </div>
                    )}
                  </Card>
                </Col>
              </Row>
            </TabPane>

            <TabPane tab={<span><ExclamationCircleOutlined /> 错误分析</span>} key="2">
              <Row gutter={16}>
                <Col span={24}>
                  <Card title="错误日志趋势" className="chart-card">
                    {analyticsData.error_trend && analyticsData.error_trend.length > 0 ? (
                      <Line {...errorTrendConfig} height={300} />
                    ) : (
                      <div className="empty-chart">
                        <Text type="secondary">暂无数据</Text>
                      </div>
                    )}
                  </Card>
                </Col>
              </Row>
              <Row gutter={16} style={{ marginTop: 16 }}>
                <Col span={24}>
                  <Card title="热门错误消息" className="chart-card">
                    <Alert
                      message="错误分析"
                      description="以下是系统中出现频率最高的错误消息，可以帮助您快速定位和解决系统问题。"
                      type="error"
                      showIcon
                      style={{ marginBottom: 16 }}
                    />
                    <Table
                      dataSource={analyticsData.top_errors || []}
                      columns={topErrorsColumns}
                      rowKey="message"
                      pagination={{ pageSize: 5 }}
                    />
                  </Card>
                </Col>
              </Row>
            </TabPane>

            <TabPane tab={<span><UserOutlined /> 用户行为分析</span>} key="3">
              <Row gutter={16}>
                <Col span={12}>
                  <Card title="热门IP地址" className="chart-card">
                    {analyticsData.top_ips && analyticsData.top_ips.length > 0 ? (
                      <Bar {...topIpsConfig} height={300} />
                    ) : (
                      <div className="empty-chart">
                        <Text type="secondary">暂无数据</Text>
                      </div>
                    )}
                  </Card>
                </Col>
                <Col span={12}>
                  <Card title="活跃管理员排行" className="chart-card">
                    <List
                      itemLayout="horizontal"
                      dataSource={analyticsData.top_admins || []}
                      renderItem={(item, index) => (
                        <List.Item>
                          <List.Item.Meta
                            avatar={
                              <div className="rank-avatar">
                                {index + 1}
                              </div>
                            }
                            title={<a href={`/users/detail/${item.admin_id}`}>{item.admin_username}</a>}
                            description={`操作次数: ${item.count}`}
                          />
                          <div>
                            <Tag color={index < 3 ? 'gold' : 'blue'}>
                              {index < 3 ? '活跃管理员' : '普通管理员'}
                            </Tag>
                          </div>
                        </List.Item>
                      )}
                    />
                  </Card>
                </Col>
              </Row>
              <Row gutter={16} style={{ marginTop: 16 }}>
                <Col span={24}>
                  <Card title="管理员操作时间分布" className="chart-card">
                    {analyticsData.admin_time_distribution && analyticsData.admin_time_distribution.length > 0 ? (
                      <Column
                        data={analyticsData.admin_time_distribution}
                        xField="hour"
                        yField="count"
                        label={{
                          position: 'middle',
                          style: {
                            fill: '#FFFFFF',
                            opacity: 0.6,
                          },
                        }}
                        meta={{
                          hour: {
                            alias: '小时',
                          },
                          count: {
                            alias: '操作次数',
                          },
                        }}
                        color="#722ed1"
                        height={300}
                      />
                    ) : (
                      <div className="empty-chart">
                        <Text type="secondary">暂无数据</Text>
                      </div>
                    )}
                  </Card>
                </Col>
              </Row>
            </TabPane>

            <TabPane tab={<span><InfoCircleOutlined /> 系统健康分析</span>} key="4">
              <Row gutter={16}>
                <Col span={24}>
                  <Alert
                    message="系统健康状态"
                    description={
                      <div>
                        <p>
                          根据日志分析，系统当前健康状态为:
                          <Tag color={
                            analyticsData.health_status === 'good' ? 'green' :
                            analyticsData.health_status === 'warning' ? 'orange' :
                            analyticsData.health_status === 'critical' ? 'red' : 'blue'
                          }>
                            {analyticsData.health_status === 'good' ? '良好' :
                             analyticsData.health_status === 'warning' ? '警告' :
                             analyticsData.health_status === 'critical' ? '严重' : '未知'}
                          </Tag>
                        </p>
                        <p>
                          {analyticsData.health_description || '系统运行正常，未发现严重问题。'}
                        </p>
                      </div>
                    }
                    type={
                      analyticsData.health_status === 'good' ? 'success' :
                      analyticsData.health_status === 'warning' ? 'warning' :
                      analyticsData.health_status === 'critical' ? 'error' : 'info'
                    }
                    showIcon
                    style={{ marginBottom: 16 }}
                  />
                </Col>
              </Row>
              <Row gutter={16}>
                <Col span={8}>
                  <Card title="错误率" className="chart-card">
                    <Statistic
                      title="系统错误率"
                      value={analyticsData.error_rate || 0}
                      precision={2}
                      valueStyle={{ color: analyticsData.error_rate > 5 ? '#ff4d4f' : '#52c41a' }}
                      suffix="%"
                    />
                    <Progress
                      percent={analyticsData.error_rate || 0}
                      status={analyticsData.error_rate > 5 ? 'exception' : 'success'}
                      strokeWidth={8}
                      style={{ marginTop: 16 }}
                    />
                    <div style={{ marginTop: 16 }}>
                      <Text type="secondary">
                        健康标准: 错误率低于 5%
                      </Text>
                    </div>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card title="系统稳定性" className="chart-card">
                    <Statistic
                      title="稳定性评分"
                      value={analyticsData.stability_score || 0}
                      precision={1}
                      valueStyle={{ color: analyticsData.stability_score > 80 ? '#52c41a' : '#faad14' }}
                      suffix="/100"
                    />
                    <Progress
                      percent={analyticsData.stability_score || 0}
                      status={analyticsData.stability_score > 80 ? 'success' : 'normal'}
                      strokeWidth={8}
                      style={{ marginTop: 16 }}
                    />
                    <div style={{ marginTop: 16 }}>
                      <Text type="secondary">
                        健康标准: 稳定性评分高于 80
                      </Text>
                    </div>
                  </Card>
                </Col>
                <Col span={8}>
                  <Card title="系统性能" className="chart-card">
                    <Statistic
                      title="性能评分"
                      value={analyticsData.performance_score || 0}
                      precision={1}
                      valueStyle={{ color: analyticsData.performance_score > 75 ? '#52c41a' : '#faad14' }}
                      suffix="/100"
                    />
                    <Progress
                      percent={analyticsData.performance_score || 0}
                      status={analyticsData.performance_score > 75 ? 'success' : 'normal'}
                      strokeWidth={8}
                      style={{ marginTop: 16 }}
                    />
                    <div style={{ marginTop: 16 }}>
                      <Text type="secondary">
                        健康标准: 性能评分高于 75
                      </Text>
                    </div>
                  </Card>
                </Col>
              </Row>
              <Row gutter={16} style={{ marginTop: 16 }}>
                <Col span={24}>
                  <Card title="系统健康建议" className="chart-card">
                    <List
                      itemLayout="horizontal"
                      dataSource={analyticsData.health_suggestions || []}
                      renderItem={(item, index) => (
                        <List.Item>
                          <List.Item.Meta
                            avatar={
                              <div className={`suggestion-avatar ${item.priority}`}>
                                {item.priority === 'high' ? <ExclamationCircleOutlined /> :
                                 item.priority === 'medium' ? <WarningOutlined /> :
                                 <InfoCircleOutlined />}
                              </div>
                            }
                            title={
                              <Space>
                                {item.title}
                                <Tag color={
                                  item.priority === 'high' ? 'red' :
                                  item.priority === 'medium' ? 'orange' : 'blue'
                                }>
                                  {item.priority === 'high' ? '高优先级' :
                                   item.priority === 'medium' ? '中优先级' : '低优先级'}
                                </Tag>
                              </Space>
                            }
                            description={item.description}
                          />
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

export default LogAnalytics;
