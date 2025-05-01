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
  Tooltip,
  Select,
  Space
} from 'antd';
import {
  UserOutlined,
  ClockCircleOutlined,
  PieChartOutlined,
  BarChartOutlined,
  ReloadOutlined,
  DownloadOutlined
} from '@ant-design/icons';
import { PageHeader } from '../../components/common';
import { getUserAnalytics, generateReport, exportReport } from '../../services/analyticsService';
import { Column, Pie, Bar } from '@ant-design/charts';
import moment from 'dayjs';

const { RangePicker } = DatePicker;
const { TabPane } = Tabs;
const { Option } = Select;

const UserAnalytics = () => {
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [analyticsData, setAnalyticsData] = useState({
    total_users: 0,
    registration_by_hour: [],
    status_distribution: [],
    login_distribution: []
  });
  const [dateRange, setDateRange] = useState([
    moment().subtract(30, 'days'),
    moment()
  ]);

  // 获取用户分析数据
  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      const params = {};
      if (dateRange && dateRange.length === 2) {
        params.start_date = dateRange[0].format('YYYY-MM-DD');
        params.end_date = dateRange[1].format('YYYY-MM-DD');
      }
      
      const data = await getUserAnalytics(params);
      setAnalyticsData(data);
    } catch (error) {
      console.error('获取用户分析数据错误:', error);
      message.error('获取用户分析数据失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 生成报表
  const handleGenerateReport = async () => {
    try {
      setGenerating(true);
      const params = {};
      if (dateRange && dateRange.length === 2) {
        params.start_date = dateRange[0].format('YYYY-MM-DD');
        params.end_date = dateRange[1].format('YYYY-MM-DD');
      }
      
      const reportData = {
        report_type: 'user',
        title: `用户分析报表 (${params.start_date} 至 ${params.end_date})`,
        description: '用户注册、状态和活跃度分析',
        parameters: params
      };
      
      const result = await generateReport(reportData);
      message.success('报表生成成功');
      
      // 导出报表
      await exportReport(result.id, 'csv');
    } catch (error) {
      console.error('生成报表错误:', error);
      message.error('生成报表失败，请稍后重试');
    } finally {
      setGenerating(false);
    }
  };

  useEffect(() => {
    fetchAnalyticsData();
  }, []);

  // 用户注册时间分布图配置
  const registrationByHourConfig = {
    data: analyticsData.registration_by_hour,
    xField: 'hour',
    yField: 'count',
    color: '#1890ff',
    label: {
      position: 'middle',
      style: {
        fill: '#FFFFFF',
        opacity: 0.6,
      },
    },
    meta: {
      hour: {
        alias: '小时',
      },
      count: {
        alias: '注册人数',
      },
    },
    xAxis: {
      label: {
        formatter: (val) => `${val}:00`,
      },
    },
  };

  // 用户状态分布图配置
  const statusDistributionConfig = {
    data: analyticsData.status_distribution,
    angleField: 'count',
    colorField: 'status',
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

  // 用户登录次数分布图配置
  const loginDistributionConfig = {
    data: analyticsData.login_distribution,
    xField: 'category',
    yField: 'count',
    color: '#52c41a',
    label: {
      position: 'middle',
      style: {
        fill: '#FFFFFF',
        opacity: 0.6,
      },
    },
    meta: {
      category: {
        alias: '登录次数',
      },
      count: {
        alias: '用户数',
      },
    },
  };

  return (
    <div className="user-analytics-page">
      <PageHeader
        title="用户分析"
        subTitle="用户数据分析和趋势"
        breadcrumb={[
          { title: '首页', path: '/' },
          { title: '数据分析' },
          { title: '用户分析' }
        ]}
        extra={[
          <RangePicker
            key="date-range"
            value={dateRange}
            onChange={(dates) => setDateRange(dates)}
            allowClear={false}
          />,
          <Button
            key="refresh"
            icon={<ReloadOutlined />}
            onClick={fetchAnalyticsData}
            loading={loading}
          >
            刷新数据
          </Button>,
          <Button
            key="export"
            type="primary"
            icon={<DownloadOutlined />}
            onClick={handleGenerateReport}
            loading={generating}
          >
            生成报表
          </Button>
        ]}
      />

      <Spin spinning={loading}>
        <div className="analytics-content">
          {/* 统计卡片 */}
          <Row gutter={16} className="stat-cards">
            <Col span={8}>
              <Card>
                <Statistic
                  title="总用户数"
                  value={analyticsData.total_users}
                  prefix={<UserOutlined />}
                />
              </Card>
            </Col>
          </Row>

          {/* 分析图表 */}
          <Row gutter={16} className="analytics-charts">
            <Col span={12}>
              <Card title="用户注册时间分布" className="chart-card">
                {analyticsData.registration_by_hour.length > 0 ? (
                  <Column {...registrationByHourConfig} />
                ) : (
                  <Empty description="暂无数据" />
                )}
              </Card>
            </Col>
            <Col span={12}>
              <Card title="用户状态分布" className="chart-card">
                {analyticsData.status_distribution.length > 0 ? (
                  <Pie {...statusDistributionConfig} />
                ) : (
                  <Empty description="暂无数据" />
                )}
              </Card>
            </Col>
          </Row>

          <Row gutter={16} className="analytics-charts">
            <Col span={24}>
              <Card title="用户登录次数分布" className="chart-card">
                {analyticsData.login_distribution.length > 0 ? (
                  <Bar {...loginDistributionConfig} />
                ) : (
                  <Empty description="暂无数据" />
                )}
              </Card>
            </Col>
          </Row>
        </div>
      </Spin>
    </div>
  );
};

export default UserAnalytics;
