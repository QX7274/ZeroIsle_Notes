import React, { useState, useEffect } from 'react';
import { 
  Card, Row, Col, Tabs, Button, DatePicker, 
  Select, Typography, Spin, Empty, Space, Tooltip, 
  Statistic, Badge, Divider, Alert
} from 'antd';
import {
  UserOutlined, FileTextOutlined, TagOutlined,
  CommentOutlined, LikeOutlined, EyeOutlined,
  DownloadOutlined, ReloadOutlined, BarChartOutlined,
  LineChartOutlined, PieChartOutlined, AreaChartOutlined,
  DashboardOutlined, TeamOutlined, AppstoreOutlined,
  SettingOutlined, InfoCircleOutlined
} from '@ant-design/icons';
import { Line, Bar, Pie, Area } from '@ant-design/plots';
import { getDashboardStats } from '../../services/statsService';
import '../../styles/DataAnalytics.css';

const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;
const { RangePicker } = DatePicker;
const { Option } = Select;

const DataAnalytics = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalNotes: 0,
    totalTags: 0,
    totalComments: 0,
    todayNewUsers: 0,
    todayNewNotes: 0,
    userGrowthData: { dates: [], values: [] },
    userActivityData: { dates: [], values: [] },
    contentDistribution: {},
    systemStatus: { cpu: 0, memory: 0, disk: 0 },
    recentUsers: []
  });
  const [dateRange, setDateRange] = useState([null, null]);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    setLoading(true);
    try {
      // 在实际应用中，这里应该从API获取统计数据
      // const response = await getDashboardStats();
      // setStats(response);
      
      // 模拟API响应
      setTimeout(() => {
        const mockData = {
          totalUsers: 1234,
          totalNotes: 5678,
          totalTags: 256,
          totalComments: 789,
          todayNewUsers: 12,
          todayNewNotes: 45,
          userGrowthData: {
            dates: ['2025-01-01', '2025-01-02', '2025-01-03', '2025-01-04', '2025-01-05', '2025-01-06', '2025-01-07'],
            values: [100, 120, 140, 160, 180, 200, 220]
          },
          userActivityData: {
            dates: ['2025-01-01', '2025-01-02', '2025-01-03', '2025-01-04', '2025-01-05', '2025-01-06', '2025-01-07'],
            values: [50, 60, 45, 80, 65, 75, 90]
          },
          contentDistribution: {
            notes: 45,
            images: 25,
            audio: 15,
            video: 10,
            documents: 5
          },
          systemStatus: {
            cpu: 35,
            memory: 60,
            disk: 45
          },
          recentUsers: [
            { id: 1, username: 'user1', email: 'user1@example.com', createdAt: '2025-01-07', status: 'active' },
            { id: 2, username: 'user2', email: 'user2@example.com', createdAt: '2025-01-06', status: 'active' },
            { id: 3, username: 'user3', email: 'user3@example.com', createdAt: '2025-01-05', status: 'inactive' }
          ]
        };
        setStats(mockData);
        setLoading(false);
      }, 1000);
    } catch (error) {
      console.error('获取统计数据失败:', error);
      setLoading(false);
    }
  };

  const handleDateRangeChange = (dates) => {
    setDateRange(dates);
    // 在实际应用中，这里应该根据日期范围重新获取数据
    // fetchStats({ startDate: dates[0], endDate: dates[1] });
  };

  const handleRefresh = () => {
    fetchStats();
  };

  const handleExport = () => {
    // 在实际应用中，这里应该导出统计数据
    // exportStats();
    console.log('导出统计数据');
  };

  // 用户增长趋势图配置
  const userGrowthConfig = {
    data: stats.userGrowthData.dates.map((date, index) => ({
      date,
      value: stats.userGrowthData.values[index]
    })),
    xField: 'date',
    yField: 'value',
    seriesField: '',
    smooth: true,
    color: '#4361EE',
    areaStyle: {
      fill: 'l(270) 0:#4361EE 0.5:#4361EE10 1:#4361EE01',
    },
    xAxis: {
      title: {
        text: '日期',
      },
    },
    yAxis: {
      title: {
        text: '用户数',
      },
    },
    tooltip: {
      title: '用户增长',
    },
    point: {
      size: 5,
      shape: 'circle',
      style: {
        fill: 'white',
        stroke: '#4361EE',
        lineWidth: 2,
      },
    },
  };

  // 用户活跃度图配置
  const userActivityConfig = {
    data: stats.userActivityData.dates.map((date, index) => ({
      date,
      value: stats.userActivityData.values[index]
    })),
    xField: 'date',
    yField: 'value',
    seriesField: '',
    color: '#4CC9F0',
    columnStyle: {
      radius: [10, 10, 0, 0],
    },
    xAxis: {
      title: {
        text: '日期',
      },
    },
    yAxis: {
      title: {
        text: '活跃用户数',
      },
    },
    tooltip: {
      title: '用户活跃度',
    },
  };

  // 内容分布图配置
  const contentDistributionConfig = {
    data: Object.entries(stats.contentDistribution).map(([type, value]) => ({
      type: type === 'notes' ? '笔记' : 
            type === 'images' ? '图片' : 
            type === 'audio' ? '音频' : 
            type === 'video' ? '视频' : '文档',
      value
    })),
    angleField: 'value',
    colorField: 'type',
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
    interactions: [{ type: 'element-selected' }, { type: 'element-active' }],
    statistic: {
      title: false,
      content: {
        style: {
          whiteSpace: 'pre-wrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          fontSize: '16px',
        },
        content: '内容分布',
      },
    },
    legend: {
      layout: 'horizontal',
      position: 'bottom',
    },
  };

  // 系统状态图配置
  const systemStatusConfig = {
    data: [
      { type: 'CPU', value: stats.systemStatus.cpu },
      { type: '内存', value: stats.systemStatus.memory },
      { type: '磁盘', value: stats.systemStatus.disk }
    ],
    xField: 'type',
    yField: 'value',
    seriesField: 'type',
    color: ({ type }) => {
      if (type === 'CPU') return '#4361EE';
      if (type === '内存') return '#4CC9F0';
      return '#F72585';
    },
    columnStyle: {
      radius: [10, 10, 0, 0],
    },
    label: {
      position: 'middle',
      style: {
        fill: '#FFFFFF',
        opacity: 0.6,
      },
      formatter: (datum) => `${datum.value}%`,
    },
    xAxis: {
      title: {
        text: '资源类型',
      },
    },
    yAxis: {
      title: {
        text: '使用率 (%)',
      },
      max: 100,
    },
    tooltip: {
      title: '系统资源使用率',
      formatter: (datum) => {
        return { name: datum.type, value: datum.value + '%' };
      },
    },
  };

  const renderOverviewTab = () => (
    <div className="analytics-overview">
      <Row gutter={[24, 24]}>
        <Col span={6}>
          <Card className="analytics-stat-card">
            <div className="analytics-stat-icon" style={{ backgroundColor: 'rgba(67, 97, 238, 0.1)' }}>
              <UserOutlined style={{ color: '#4361EE' }} />
            </div>
            <div className="analytics-stat-content">
              <div className="analytics-stat-title">总用户数</div>
              <div className="analytics-stat-value">{stats.totalUsers}</div>
              <div className="analytics-stat-footer">
                <Badge
                  count={`今日 +${stats.todayNewUsers}`}
                  className="stat-badge"
                  style={{
                    backgroundColor: 'rgba(67, 97, 238, 0.1)',
                    color: '#4361EE',
                    fontWeight: 500
                  }}
                />
              </div>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card className="analytics-stat-card">
            <div className="analytics-stat-icon" style={{ backgroundColor: 'rgba(76, 201, 240, 0.1)' }}>
              <FileTextOutlined style={{ color: '#4CC9F0' }} />
            </div>
            <div className="analytics-stat-content">
              <div className="analytics-stat-title">总笔记数</div>
              <div className="analytics-stat-value">{stats.totalNotes}</div>
              <div className="analytics-stat-footer">
                <Badge
                  count={`今日 +${stats.todayNewNotes}`}
                  className="stat-badge"
                  style={{
                    backgroundColor: 'rgba(76, 201, 240, 0.1)',
                    color: '#4CC9F0',
                    fontWeight: 500
                  }}
                />
              </div>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card className="analytics-stat-card">
            <div className="analytics-stat-icon" style={{ backgroundColor: 'rgba(58, 12, 163, 0.1)' }}>
              <TagOutlined style={{ color: '#3A0CA3' }} />
            </div>
            <div className="analytics-stat-content">
              <div className="analytics-stat-title">总标签数</div>
              <div className="analytics-stat-value">{stats.totalTags}</div>
              <div className="analytics-stat-footer">
                <Badge
                  count="分类标签"
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
        <Col span={6}>
          <Card className="analytics-stat-card">
            <div className="analytics-stat-icon" style={{ backgroundColor: 'rgba(247, 37, 133, 0.1)' }}>
              <CommentOutlined style={{ color: '#F72585' }} />
            </div>
            <div className="analytics-stat-content">
              <div className="analytics-stat-title">总评论数</div>
              <div className="analytics-stat-value">{stats.totalComments}</div>
              <div className="analytics-stat-footer">
                <Badge
                  count="用户互动"
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

      <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
        <Col span={12}>
          <Card 
            title={
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <LineChartOutlined style={{ marginRight: 8, color: '#4361EE' }} />
                用户增长趋势
              </div>
            } 
            className="analytics-card"
          >
            <div className="analytics-chart-container">
              <Line {...userGrowthConfig} />
            </div>
          </Card>
        </Col>
        <Col span={12}>
          <Card 
            title={
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <BarChartOutlined style={{ marginRight: 8, color: '#4CC9F0' }} />
                用户活跃度
              </div>
            } 
            className="analytics-card"
          >
            <div className="analytics-chart-container">
              <Bar {...userActivityConfig} />
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
        <Col span={12}>
          <Card 
            title={
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <PieChartOutlined style={{ marginRight: 8, color: '#3A0CA3' }} />
                内容分布
              </div>
            } 
            className="analytics-card"
          >
            <div className="analytics-chart-container">
              <Pie {...contentDistributionConfig} />
            </div>
          </Card>
        </Col>
        <Col span={12}>
          <Card 
            title={
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <DashboardOutlined style={{ marginRight: 8, color: '#F72585' }} />
                系统状态
              </div>
            } 
            className="analytics-card"
          >
            <div className="analytics-chart-container">
              <Bar {...systemStatusConfig} />
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );

  const renderUserAnalyticsTab = () => (
    <div className="user-analytics">
      <Alert
        message="用户分析"
        description="此模块提供用户相关的详细分析，包括用户增长、活跃度、地域分布、设备使用情况等。"
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />
      
      <Row gutter={[24, 24]}>
        <Col span={24}>
          <Card 
            title={
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <LineChartOutlined style={{ marginRight: 8, color: '#4361EE' }} />
                用户增长趋势
              </div>
            } 
            className="analytics-card"
          >
            <div className="analytics-chart-container" style={{ height: 400 }}>
              <Line {...userGrowthConfig} />
            </div>
          </Card>
        </Col>
      </Row>
      
      <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
        <Col span={12}>
          <Card 
            title={
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <BarChartOutlined style={{ marginRight: 8, color: '#4CC9F0' }} />
                用户活跃度
              </div>
            } 
            className="analytics-card"
          >
            <div className="analytics-chart-container">
              <Bar {...userActivityConfig} />
            </div>
          </Card>
        </Col>
        <Col span={12}>
          <Card 
            title={
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <TeamOutlined style={{ marginRight: 8, color: '#3A0CA3' }} />
                用户构成
              </div>
            } 
            className="analytics-card"
          >
            <Empty description="暂无数据" />
          </Card>
        </Col>
      </Row>
    </div>
  );

  const renderContentAnalyticsTab = () => (
    <div className="content-analytics">
      <Alert
        message="内容分析"
        description="此模块提供内容相关的详细分析，包括内容分布、热门内容、内容增长趋势等。"
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />
      
      <Row gutter={[24, 24]}>
        <Col span={12}>
          <Card 
            title={
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <PieChartOutlined style={{ marginRight: 8, color: '#3A0CA3' }} />
                内容分布
              </div>
            } 
            className="analytics-card"
          >
            <div className="analytics-chart-container">
              <Pie {...contentDistributionConfig} />
            </div>
          </Card>
        </Col>
        <Col span={12}>
          <Card 
            title={
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <AreaChartOutlined style={{ marginRight: 8, color: '#4CC9F0' }} />
                内容增长趋势
              </div>
            } 
            className="analytics-card"
          >
            <Empty description="暂无数据" />
          </Card>
        </Col>
      </Row>
      
      <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
        <Col span={24}>
          <Card 
            title={
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <AppstoreOutlined style={{ marginRight: 8, color: '#F72585' }} />
                热门内容
              </div>
            } 
            className="analytics-card"
          >
            <Empty description="暂无数据" />
          </Card>
        </Col>
      </Row>
    </div>
  );

  const renderSystemAnalyticsTab = () => (
    <div className="system-analytics">
      <Alert
        message="系统分析"
        description="此模块提供系统相关的详细分析，包括系统性能、资源使用情况、错误日志分析等。"
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />
      
      <Row gutter={[24, 24]}>
        <Col span={24}>
          <Card 
            title={
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <DashboardOutlined style={{ marginRight: 8, color: '#F72585' }} />
                系统资源使用情况
              </div>
            } 
            className="analytics-card"
          >
            <div className="analytics-chart-container" style={{ height: 400 }}>
              <Bar {...systemStatusConfig} />
            </div>
          </Card>
        </Col>
      </Row>
      
      <Row gutter={[24, 24]} style={{ marginTop: 24 }}>
        <Col span={12}>
          <Card 
            title={
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <SettingOutlined style={{ marginRight: 8, color: '#4361EE' }} />
                系统性能趋势
              </div>
            } 
            className="analytics-card"
          >
            <Empty description="暂无数据" />
          </Card>
        </Col>
        <Col span={12}>
          <Card 
            title={
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <InfoCircleOutlined style={{ marginRight: 8, color: '#4CC9F0' }} />
                错误日志分析
              </div>
            } 
            className="analytics-card"
          >
            <Empty description="暂无数据" />
          </Card>
        </Col>
      </Row>
    </div>
  );

  return (
    <div className="data-analytics-container">
      <div className="analytics-header">
        <div className="analytics-title">
          <BarChartOutlined className="analytics-icon" />
          <div className="title-content">
            <Title level={3} style={{ margin: 0 }}>数据分析</Title>
            <Text type="secondary">系统数据统计与分析</Text>
          </div>
        </div>
        <Space>
          <RangePicker 
            onChange={handleDateRangeChange} 
            value={dateRange}
            placeholder={['开始日期', '结束日期']}
          />
          <Button 
            icon={<ReloadOutlined />} 
            onClick={handleRefresh}
          >
            刷新
          </Button>
          <Button 
            type="primary" 
            icon={<DownloadOutlined />} 
            onClick={handleExport}
          >
            导出数据
          </Button>
        </Space>
      </div>

      <Tabs 
        activeKey={activeTab} 
        onChange={setActiveTab}
        className="analytics-tabs"
      >
        <TabPane 
          tab={
            <span>
              <DashboardOutlined />
              概览
            </span>
          } 
          key="overview"
        />
        <TabPane 
          tab={
            <span>
              <UserOutlined />
              用户分析
            </span>
          } 
          key="user"
        />
        <TabPane 
          tab={
            <span>
              <FileTextOutlined />
              内容分析
            </span>
          } 
          key="content"
        />
        <TabPane 
          tab={
            <span>
              <SettingOutlined />
              系统分析
            </span>
          } 
          key="system"
        />
      </Tabs>

      {loading ? (
        <div className="analytics-loading">
          <Spin size="large" />
          <p>加载数据中...</p>
        </div>
      ) : (
        <div className="analytics-content">
          {activeTab === 'overview' && renderOverviewTab()}
          {activeTab === 'user' && renderUserAnalyticsTab()}
          {activeTab === 'content' && renderContentAnalyticsTab()}
          {activeTab === 'system' && renderSystemAnalyticsTab()}
        </div>
      )}
    </div>
  );
};

export default DataAnalytics;
