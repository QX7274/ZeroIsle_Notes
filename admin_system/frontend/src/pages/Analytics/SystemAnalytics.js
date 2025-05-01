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
  BugOutlined,
  SettingOutlined,
  ClockCircleOutlined,
  PieChartOutlined,
  BarChartOutlined,
  ReloadOutlined,
  DownloadOutlined
} from '@ant-design/icons';
import { PageHeader } from '../../components/common';
import { getSystemAnalytics, generateReport, exportReport } from '../../services/analyticsService';
import { Column, Pie, Bar } from '@ant-design/charts';
import moment from 'dayjs';

const { RangePicker } = DatePicker;
const { TabPane } = Tabs;
const { Option } = Select;

const SystemAnalytics = () => {
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [analyticsData, setAnalyticsData] = useState({
    total_system_logs: 0,
    total_admin_logs: 0,
    level_distribution: [],
    source_distribution: [],
    time_distribution: [],
    action_distribution: [],
    module_distribution: []
  });
  const [dateRange, setDateRange] = useState([
    moment().subtract(30, 'days'),
    moment()
  ]);

  // 获取系统分析数据
  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      const params = {};
      if (dateRange && dateRange.length === 2) {
        params.start_date = dateRange[0].format('YYYY-MM-DD');
        params.end_date = dateRange[1].format('YYYY-MM-DD');
      }
      
      const data = await getSystemAnalytics(params);
      setAnalyticsData(data);
    } catch (error) {
      console.error('获取系统分析数据错误:', error);
      message.error('获取系统分析数据失败，请稍后重试');
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
        report_type: 'system',
        title: `系统分析报表 (${params.start_date} 至 ${params.end_date})`,
        description: '系统日志和管理员操作分析',
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

  // 日志级别分布图配置
  const levelDistributionConfig = {
    data: analyticsData.level_distribution,
    angleField: 'count',
    colorField: 'level',
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

  // 日志来源分布图配置
  const sourceDistributionConfig = {
    data: analyticsData.source_distribution,
    xField: 'source',
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
      source: {
        alias: '日志来源',
      },
      count: {
        alias: '日志数量',
      },
    },
  };

  // 日志时间分布图配置
  const timeDistributionConfig = {
    data: analyticsData.time_distribution,
    xField: 'hour',
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
      hour: {
        alias: '小时',
      },
      count: {
        alias: '日志数量',
      },
    },
    xAxis: {
      label: {
        formatter: (val) => `${val}:00`,
      },
    },
  };

  // 操作类型分布图配置
  const actionDistributionConfig = {
    data: analyticsData.action_distribution,
    angleField: 'count',
    colorField: 'action',
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

  // 模块分布图配置
  const moduleDistributionConfig = {
    data: analyticsData.module_distribution,
    xField: 'module',
    yField: 'count',
    color: '#fa8c16',
    label: {
      position: 'middle',
      style: {
        fill: '#FFFFFF',
        opacity: 0.6,
      },
    },
    meta: {
      module: {
        alias: '模块',
      },
      count: {
        alias: '操作次数',
      },
    },
  };

  return (
    <div className="system-analytics-page">
      <PageHeader
        title="系统分析"
        subTitle="系统日志和管理员操作分析"
        breadcrumb={[
          { title: '首页', path: '/' },
          { title: '数据分析' },
          { title: '系统分析' }
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
            <Col span={12}>
              <Card>
                <Statistic
                  title="系统日志总数"
                  value={analyticsData.total_system_logs}
                  prefix={<BugOutlined />}
                />
              </Card>
            </Col>
            <Col span={12}>
              <Card>
                <Statistic
                  title="管理员操作日志总数"
                  value={analyticsData.total_admin_logs}
                  prefix={<SettingOutlined />}
                />
              </Card>
            </Col>
          </Row>

          {/* 分析图表 */}
          <Tabs defaultActiveKey="system">
            <TabPane tab="系统日志分析" key="system">
              <Row gutter={16} className="analytics-charts">
                <Col span={12}>
                  <Card title="日志级别分布" className="chart-card">
                    {analyticsData.level_distribution.length > 0 ? (
                      <Pie {...levelDistributionConfig} />
                    ) : (
                      <Empty description="暂无数据" />
                    )}
                  </Card>
                </Col>
                <Col span={12}>
                  <Card title="日志来源分布" className="chart-card">
                    {analyticsData.source_distribution.length > 0 ? (
                      <Bar {...sourceDistributionConfig} />
                    ) : (
                      <Empty description="暂无数据" />
                    )}
                  </Card>
                </Col>
              </Row>

              <Row gutter={16} className="analytics-charts">
                <Col span={24}>
                  <Card title="日志时间分布" className="chart-card">
                    {analyticsData.time_distribution.length > 0 ? (
                      <Column {...timeDistributionConfig} />
                    ) : (
                      <Empty description="暂无数据" />
                    )}
                  </Card>
                </Col>
              </Row>
            </TabPane>

            <TabPane tab="管理员操作分析" key="admin">
              <Row gutter={16} className="analytics-charts">
                <Col span={12}>
                  <Card title="操作类型分布" className="chart-card">
                    {analyticsData.action_distribution.length > 0 ? (
                      <Pie {...actionDistributionConfig} />
                    ) : (
                      <Empty description="暂无数据" />
                    )}
                  </Card>
                </Col>
                <Col span={12}>
                  <Card title="模块分布" className="chart-card">
                    {analyticsData.module_distribution.length > 0 ? (
                      <Bar {...moduleDistributionConfig} />
                    ) : (
                      <Empty description="暂无数据" />
                    )}
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

export default SystemAnalytics;
