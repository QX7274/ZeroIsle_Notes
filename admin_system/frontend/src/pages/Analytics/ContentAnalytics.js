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
  FileTextOutlined,
  CommentOutlined,
  ClockCircleOutlined,
  PieChartOutlined,
  BarChartOutlined,
  ReloadOutlined,
  DownloadOutlined
} from '@ant-design/icons';
import { PageHeader } from '../../components/common';
import { getContentAnalytics, generateReport, exportReport } from '../../services/analyticsService';
import { Column, Pie, Bar } from '@ant-design/charts';
import moment from 'dayjs';

const { RangePicker } = DatePicker;
const { TabPane } = Tabs;
const { Option } = Select;

const ContentAnalytics = () => {
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [analyticsData, setAnalyticsData] = useState({
    total_notes: 0,
    total_comments: 0,
    status_distribution: [],
    length_distribution: [],
    creation_by_hour: [],
    comment_length_distribution: []
  });
  const [dateRange, setDateRange] = useState([
    moment().subtract(30, 'days'),
    moment()
  ]);

  // 获取内容分析数据
  const fetchAnalyticsData = async () => {
    try {
      setLoading(true);
      const params = {};
      if (dateRange && dateRange.length === 2) {
        params.start_date = dateRange[0].format('YYYY-MM-DD');
        params.end_date = dateRange[1].format('YYYY-MM-DD');
      }
      
      const data = await getContentAnalytics(params);
      setAnalyticsData(data);
    } catch (error) {
      console.error('获取内容分析数据错误:', error);
      message.error('获取内容分析数据失败，请稍后重试');
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
        report_type: 'content',
        title: `内容分析报表 (${params.start_date} 至 ${params.end_date})`,
        description: '笔记和评论数据分析',
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

  // 笔记状态分布图配置
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

  // 笔记长度分布图配置
  const lengthDistributionConfig = {
    data: analyticsData.length_distribution,
    xField: 'category',
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
      category: {
        alias: '笔记长度',
      },
      count: {
        alias: '笔记数',
      },
    },
  };

  // 笔记创建时间分布图配置
  const creationByHourConfig = {
    data: analyticsData.creation_by_hour,
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
        alias: '创建数量',
      },
    },
    xAxis: {
      label: {
        formatter: (val) => `${val}:00`,
      },
    },
  };

  // 评论长度分布图配置
  const commentLengthDistributionConfig = {
    data: analyticsData.comment_length_distribution,
    xField: 'category',
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
      category: {
        alias: '评论长度',
      },
      count: {
        alias: '评论数',
      },
    },
  };

  return (
    <div className="content-analytics-page">
      <PageHeader
        title="内容分析"
        subTitle="笔记和评论数据分析"
        breadcrumb={[
          { title: '首页', path: '/' },
          { title: '数据分析' },
          { title: '内容分析' }
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
                  title="总笔记数"
                  value={analyticsData.total_notes}
                  prefix={<FileTextOutlined />}
                />
              </Card>
            </Col>
            <Col span={12}>
              <Card>
                <Statistic
                  title="总评论数"
                  value={analyticsData.total_comments}
                  prefix={<CommentOutlined />}
                />
                <div className="stat-footer">
                  <span>平均每笔记: {analyticsData.total_notes > 0 ? (analyticsData.total_comments / analyticsData.total_notes).toFixed(2) : 0} 条评论</span>
                </div>
              </Card>
            </Col>
          </Row>

          {/* 分析图表 */}
          <Row gutter={16} className="analytics-charts">
            <Col span={12}>
              <Card title="笔记状态分布" className="chart-card">
                {analyticsData.status_distribution.length > 0 ? (
                  <Pie {...statusDistributionConfig} />
                ) : (
                  <Empty description="暂无数据" />
                )}
              </Card>
            </Col>
            <Col span={12}>
              <Card title="笔记长度分布" className="chart-card">
                {analyticsData.length_distribution.length > 0 ? (
                  <Bar {...lengthDistributionConfig} />
                ) : (
                  <Empty description="暂无数据" />
                )}
              </Card>
            </Col>
          </Row>

          <Row gutter={16} className="analytics-charts">
            <Col span={12}>
              <Card title="笔记创建时间分布" className="chart-card">
                {analyticsData.creation_by_hour.length > 0 ? (
                  <Column {...creationByHourConfig} />
                ) : (
                  <Empty description="暂无数据" />
                )}
              </Card>
            </Col>
            <Col span={12}>
              <Card title="评论长度分布" className="chart-card">
                {analyticsData.comment_length_distribution.length > 0 ? (
                  <Bar {...commentLengthDistributionConfig} />
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

export default ContentAnalytics;
