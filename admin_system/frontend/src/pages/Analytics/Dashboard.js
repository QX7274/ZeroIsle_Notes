import React, { useState, useEffect } from 'react';
import {
  Card,
  Row,
  Col,
  Statistic,
  Spin,
  DatePicker,
  Button,
  message,
  Tabs,
  Empty,
  Tooltip
} from 'antd';
import {
  UserOutlined,
  FileTextOutlined,
  CommentOutlined,
  PaperClipOutlined,
  TeamOutlined,
  EyeOutlined,
  PlusOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { PageHeader } from '../../components/common';
import { getDashboardData } from '../../services/analyticsService';
import { Line, Column, Pie } from '@ant-design/charts';
import moment from 'dayjs';

const { RangePicker } = DatePicker;
const { TabPane } = Tabs;

const Dashboard = () => {
  const [loading, setLoading] = useState(false);
  const [dashboardData, setDashboardData] = useState({
    users: { total: 0, active: 0, today_new: 0 },
    notes: { total: 0, published: 0, today_new: 0 },
    comments: { total: 0, today_new: 0 },
    attachments: { total: 0 },
    growth_trends: {
      users: [],
      notes: [],
      comments: []
    }
  });
  const [dateRange, setDateRange] = useState([
    moment().subtract(30, 'days'),
    moment()
  ]);

  // 获取仪表盘数据
  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const data = await getDashboardData();
      setDashboardData(data);
    } catch (error) {
      console.error('获取仪表盘数据错误:', error);
      message.error('获取仪表盘数据失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // 用户增长趋势图配置
  const userGrowthConfig = {
    data: dashboardData.growth_trends.users,
    xField: 'date',
    yField: 'count',
    seriesField: 'type',
    smooth: true,
    color: '#1890ff',
    point: {
      size: 3,
      shape: 'circle',
      style: {
        fill: 'white',
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

  // 笔记增长趋势图配置
  const noteGrowthConfig = {
    data: dashboardData.growth_trends.notes,
    xField: 'date',
    yField: 'count',
    seriesField: 'type',
    smooth: true,
    color: '#52c41a',
    point: {
      size: 3,
      shape: 'circle',
      style: {
        fill: 'white',
        stroke: '#52c41a',
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

  // 评论增长趋势图配置
  const commentGrowthConfig = {
    data: dashboardData.growth_trends.comments,
    xField: 'date',
    yField: 'count',
    seriesField: 'type',
    smooth: true,
    color: '#fa8c16',
    point: {
      size: 3,
      shape: 'circle',
      style: {
        fill: 'white',
        stroke: '#fa8c16',
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

  return (
    <div className="dashboard-page">
      <PageHeader
        title="数据仪表盘"
        subTitle="系统数据概览和趋势分析"
        breadcrumb={[
          { title: '首页', path: '/' },
          { title: '数据分析' },
          { title: '数据仪表盘' }
        ]}
        extra={[
          <Button
            key="refresh"
            icon={<ReloadOutlined />}
            onClick={fetchDashboardData}
            loading={loading}
          >
            刷新数据
          </Button>
        ]}
      />

      <Spin spinning={loading}>
        <div className="dashboard-content">
          {/* 统计卡片 */}
          <Row gutter={16} className="stat-cards">
            <Col span={6}>
              <Card>
                <Statistic
                  title="总用户数"
                  value={dashboardData.users.total}
                  prefix={<UserOutlined />}
                  suffix={<Tooltip title="今日新增"><small style={{ color: '#52c41a' }}>+{dashboardData.users.today_new}</small></Tooltip>}
                />
                <div className="stat-footer">
                  <span>活跃用户: {dashboardData.users.active}</span>
                </div>
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="总笔记数"
                  value={dashboardData.notes.total}
                  prefix={<FileTextOutlined />}
                  suffix={<Tooltip title="今日新增"><small style={{ color: '#52c41a' }}>+{dashboardData.notes.today_new}</small></Tooltip>}
                />
                <div className="stat-footer">
                  <span>已发布: {dashboardData.notes.published}</span>
                </div>
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="总评论数"
                  value={dashboardData.comments.total}
                  prefix={<CommentOutlined />}
                  suffix={<Tooltip title="今日新增"><small style={{ color: '#52c41a' }}>+{dashboardData.comments.today_new}</small></Tooltip>}
                />
                <div className="stat-footer">
                  <span>互动率: {dashboardData.notes.total > 0 ? Math.round(dashboardData.comments.total / dashboardData.notes.total * 100) : 0}%</span>
                </div>
              </Card>
            </Col>
            <Col span={6}>
              <Card>
                <Statistic
                  title="总附件数"
                  value={dashboardData.attachments.total}
                  prefix={<PaperClipOutlined />}
                />
                <div className="stat-footer">
                  <span>平均每笔记: {dashboardData.notes.total > 0 ? (dashboardData.attachments.total / dashboardData.notes.total).toFixed(2) : 0}</span>
                </div>
              </Card>
            </Col>
          </Row>

          {/* 趋势图表 */}
          <Card
            title="增长趋势"
            className="trend-chart-card"
            extra={
              <RangePicker
                value={dateRange}
                onChange={(dates) => setDateRange(dates)}
                allowClear={false}
              />
            }
          >
            <Tabs defaultActiveKey="users">
              <TabPane
                tab={
                  <span>
                    <TeamOutlined />
                    用户增长
                  </span>
                }
                key="users"
              >
                {dashboardData.growth_trends.users.length > 0 ? (
                  <Line {...userGrowthConfig} />
                ) : (
                  <Empty description="暂无数据" />
                )}
              </TabPane>
              <TabPane
                tab={
                  <span>
                    <FileTextOutlined />
                    笔记增长
                  </span>
                }
                key="notes"
              >
                {dashboardData.growth_trends.notes.length > 0 ? (
                  <Line {...noteGrowthConfig} />
                ) : (
                  <Empty description="暂无数据" />
                )}
              </TabPane>
              <TabPane
                tab={
                  <span>
                    <CommentOutlined />
                    评论增长
                  </span>
                }
                key="comments"
              >
                {dashboardData.growth_trends.comments.length > 0 ? (
                  <Line {...commentGrowthConfig} />
                ) : (
                  <Empty description="暂无数据" />
                )}
              </TabPane>
            </Tabs>
          </Card>
        </div>
      </Spin>
    </div>
  );
};

export default Dashboard;
