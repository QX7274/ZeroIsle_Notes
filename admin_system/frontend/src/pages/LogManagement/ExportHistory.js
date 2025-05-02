import React, { useState, useEffect } from 'react';
import {
  Card, Table, Button, Space, Tag, Tooltip, Typography, 
  Row, Col, Statistic, Divider, Alert, Empty, Spin,
  DatePicker, Select, Input, Form, Popconfirm
} from 'antd';
import {
  DownloadOutlined, DeleteOutlined, FileExcelOutlined,
  FileTextOutlined, FilePdfOutlined, SearchOutlined,
  ReloadOutlined, BarChartOutlined, PieChartOutlined,
  InfoCircleOutlined, ClockCircleOutlined, UserOutlined
} from '@ant-design/icons';
import { PageHeader } from '../../components/common';
import { getExportHistory, deleteExportHistory, getExportStats } from '../../services/logService';
import moment from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;
const { Text, Title } = Typography;

const ExportHistory = () => {
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [exportHistory, setExportHistory] = useState([]);
  const [stats, setStats] = useState({
    total_exports: 0,
    log_type_stats: {},
    format_stats: {},
    user_stats: {}
  });
  const [searchForm] = Form.useForm();

  // 获取导出历史
  const fetchExportHistory = async (params = {}) => {
    try {
      setLoading(true);
      const response = await getExportHistory(params);
      setExportHistory(response.data || []);
    } catch (error) {
      console.error('获取导出历史失败:', error);
      message.error('获取导出历史失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 获取统计数据
  const fetchStats = async () => {
    try {
      setStatsLoading(true);
      const response = await getExportStats();
      setStats(response.data || {
        total_exports: 0,
        log_type_stats: {},
        format_stats: {},
        user_stats: {}
      });
    } catch (error) {
      console.error('获取统计数据失败:', error);
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    fetchExportHistory();
    fetchStats();
  }, []);

  // 处理搜索
  const handleSearch = (values) => {
    const params = { ...values };
    
    if (values.dateRange && values.dateRange.length === 2) {
      params.start_time = values.dateRange[0].format('YYYY-MM-DD');
      params.end_time = values.dateRange[1].format('YYYY-MM-DD');
      delete params.dateRange;
    }
    
    fetchExportHistory(params);
  };

  // 处理重置
  const handleReset = () => {
    searchForm.resetFields();
    fetchExportHistory();
  };

  // 处理删除
  const handleDelete = async (id) => {
    try {
      await deleteExportHistory(id);
      message.success('删除成功');
      fetchExportHistory();
      fetchStats();
    } catch (error) {
      console.error('删除失败:', error);
      message.error('删除失败，请稍后重试');
    }
  };

  // 表格列定义
  const columns = [
    {
      title: '文件名',
      dataIndex: 'file_name',
      key: 'file_name',
      render: (text, record) => (
        <Space>
          {record.format === 'csv' && <FileTextOutlined />}
          {record.format === 'excel' && <FileExcelOutlined />}
          {record.format === 'json' && <FilePdfOutlined />}
          <Text>{text}</Text>
        </Space>
      ),
    },
    {
      title: '日志类型',
      dataIndex: 'log_type',
      key: 'log_type',
      render: (text) => (
        <Tag color={text === 'system' ? 'blue' : 'purple'}>
          {text === 'system' ? '系统日志' : '管理员日志'}
        </Tag>
      ),
    },
    {
      title: '格式',
      dataIndex: 'format',
      key: 'format',
      render: (text) => (
        <Tag color="green">{text.toUpperCase()}</Tag>
      ),
    },
    {
      title: '记录数量',
      dataIndex: 'record_count',
      key: 'record_count',
      sorter: (a, b) => a.record_count - b.record_count,
    },
    {
      title: '文件大小',
      dataIndex: 'file_size',
      key: 'file_size',
      render: (text) => {
        if (!text) return '-';
        const kb = text / 1024;
        if (kb < 1024) {
          return `${kb.toFixed(2)} KB`;
        } else {
          return `${(kb / 1024).toFixed(2)} MB`;
        }
      },
      sorter: (a, b) => a.file_size - b.file_size,
    },
    {
      title: '创建者',
      dataIndex: 'created_by',
      key: 'created_by',
      render: (text) => (
        <Space>
          <UserOutlined />
          {text}
        </Space>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text) => (
        <Space>
          <ClockCircleOutlined />
          {moment(text).format('YYYY-MM-DD HH:mm:ss')}
        </Space>
      ),
      sorter: (a, b) => moment(a.created_at).unix() - moment(b.created_at).unix(),
      defaultSortOrder: 'descend',
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          {record.download_url && (
            <Tooltip title="下载">
              <Button
                type="link"
                icon={<DownloadOutlined />}
                onClick={() => window.open(record.download_url, '_blank')}
              />
            </Tooltip>
          )}
          <Popconfirm
            title="确定要删除这条记录吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Tooltip title="删除">
              <Button
                type="link"
                danger
                icon={<DeleteOutlined />}
              />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="export-history-page">
      <PageHeader
        title="导出历史记录"
        subTitle="查看和管理日志导出历史"
        breadcrumb={[
          { title: '首页', path: '/' },
          { title: '日志管理' },
          { title: '导出历史记录' }
        ]}
      />

      <Row gutter={24}>
        <Col span={24}>
          <Card title="导出统计" className="stats-card">
            <Spin spinning={statsLoading}>
              <Row gutter={24}>
                <Col span={6}>
                  <Statistic
                    title="总导出次数"
                    value={stats.total_exports}
                    prefix={<BarChartOutlined />}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="系统日志导出"
                    value={stats.log_type_stats?.system || 0}
                    valueStyle={{ color: '#1890ff' }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="管理员日志导出"
                    value={stats.log_type_stats?.admin || 0}
                    valueStyle={{ color: '#722ed1' }}
                  />
                </Col>
                <Col span={6}>
                  <Statistic
                    title="导出用户数"
                    value={Object.keys(stats.user_stats || {}).length}
                    prefix={<UserOutlined />}
                  />
                </Col>
              </Row>

              <Divider />

              <Row gutter={24}>
                <Col span={8}>
                  <Title level={5}>格式分布</Title>
                  <div className="format-stats">
                    {Object.entries(stats.format_stats || {}).map(([format, count]) => (
                      <Tag key={format} color="blue" style={{ margin: '5px' }}>
                        {format.toUpperCase()}: {count}
                      </Tag>
                    ))}
                  </div>
                </Col>
                <Col span={16}>
                  <Title level={5}>用户导出情况</Title>
                  <div className="user-stats">
                    {Object.entries(stats.user_stats || {}).map(([user, count]) => (
                      <Tag key={user} color="purple" style={{ margin: '5px' }}>
                        {user}: {count}次
                      </Tag>
                    ))}
                  </div>
                </Col>
              </Row>
            </Spin>
          </Card>
        </Col>
      </Row>

      <Card 
        title="导出历史记录" 
        className="history-card"
        style={{ marginTop: 24 }}
        extra={
          <Button
            type="primary"
            icon={<ReloadOutlined />}
            onClick={() => {
              fetchExportHistory();
              fetchStats();
            }}
          >
            刷新
          </Button>
        }
      >
        <Form
          form={searchForm}
          layout="inline"
          onFinish={handleSearch}
          style={{ marginBottom: 24 }}
        >
          <Form.Item name="log_type" label="日志类型">
            <Select style={{ width: 120 }} allowClear placeholder="日志类型">
              <Option value="system">系统日志</Option>
              <Option value="admin">管理员日志</Option>
            </Select>
          </Form.Item>
          <Form.Item name="format" label="格式">
            <Select style={{ width: 120 }} allowClear placeholder="格式">
              <Option value="csv">CSV</Option>
              <Option value="json">JSON</Option>
              <Option value="excel">Excel</Option>
            </Select>
          </Form.Item>
          <Form.Item name="created_by" label="创建者">
            <Input placeholder="创建者" allowClear />
          </Form.Item>
          <Form.Item name="dateRange" label="创建时间">
            <RangePicker />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" icon={<SearchOutlined />}>
              搜索
            </Button>
          </Form.Item>
          <Form.Item>
            <Button onClick={handleReset}>重置</Button>
          </Form.Item>
        </Form>

        <Table
          columns={columns}
          dataSource={exportHistory}
          rowKey="id"
          loading={loading}
          pagination={{
            showSizeChanger: true,
            showQuickJumper: true,
            showTotal: (total) => `共 ${total} 条记录`,
          }}
          locale={{
            emptyText: <Empty description="暂无导出历史记录" />,
          }}
        />
      </Card>
    </div>
  );
};

export default ExportHistory;
