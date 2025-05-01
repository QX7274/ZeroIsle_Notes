import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Input,
  DatePicker,
  Select,
  Row,
  Col,
  Statistic,
  message,
  Tooltip,
  Popconfirm,
  Modal
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  DownloadOutlined,
  SyncOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  EyeOutlined,
  FilterOutlined
} from '@ant-design/icons';
import { PageHeader } from '../../components/common';
import {
  getSystemLogs,
  getSystemLogStats,
  exportSystemLogs,
  syncSystemLogs
} from '../../services/logService';
import moment from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;

const SystemLogList = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  const [filters, setFilters] = useState({
    keyword: '',
    level: undefined,
    source: undefined,
    dateRange: []
  });
  const [stats, setStats] = useState({
    total_logs: 0,
    level_stats: {},
    source_stats: {}
  });
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [currentLog, setCurrentLog] = useState(null);

  // 获取系统日志
  const fetchLogs = async (params = {}) => {
    try {
      setLoading(true);
      const queryParams = {
        page: params.page || pagination.current,
        page_size: params.pageSize || pagination.pageSize,
        search: filters.keyword,
        level: filters.level,
        source: filters.source,
        ordering: '-timestamp'
      };

      if (filters.dateRange && filters.dateRange.length === 2) {
        queryParams.start_time = filters.dateRange[0].format('YYYY-MM-DD');
        queryParams.end_time = filters.dateRange[1].format('YYYY-MM-DD');
      }

      const response = await getSystemLogs(queryParams);
      setLogs(response.results || []);
      setPagination({
        ...pagination,
        current: params.page || pagination.current,
        pageSize: params.pageSize || pagination.pageSize,
        total: response.count || 0
      });
    } catch (error) {
      console.error('获取系统日志错误:', error);
      message.error('获取系统日志失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 获取日志统计数据
  const fetchStats = async () => {
    try {
      const response = await getSystemLogStats();
      if (response.status === 'success') {
        setStats(response.data);
      }
    } catch (error) {
      console.error('获取日志统计数据错误:', error);
    }
  };

  // 同步日志数据
  const handleSync = async () => {
    try {
      setSyncing(true);
      const response = await syncSystemLogs({ incremental: true });
      message.success('系统日志同步成功');
      fetchLogs();
      fetchStats();
    } catch (error) {
      console.error('同步系统日志错误:', error);
      message.error('同步系统日志失败，请稍后重试');
    } finally {
      setSyncing(false);
    }
  };

  // 导出日志
  const handleExport = async () => {
    try {
      const exportParams = {
        format: 'csv',
        search: filters.keyword,
        level: filters.level,
        source: filters.source
      };

      if (filters.dateRange && filters.dateRange.length === 2) {
        exportParams.start_time = filters.dateRange[0].format('YYYY-MM-DD');
        exportParams.end_time = filters.dateRange[1].format('YYYY-MM-DD');
      }

      await exportSystemLogs(exportParams);
      message.success('导出请求已发送，文件将在新窗口中下载');
    } catch (error) {
      console.error('导出系统日志错误:', error);
      message.error('导出系统日志失败，请稍后重试');
    }
  };

  // 处理表格变化
  const handleTableChange = (pagination, filters, sorter) => {
    fetchLogs({
      page: pagination.current,
      pageSize: pagination.pageSize
    });
  };

  // 处理搜索
  const handleSearch = () => {
    setPagination({ ...pagination, current: 1 });
    fetchLogs({ page: 1 });
  };

  // 重置搜索
  const handleReset = () => {
    setFilters({
      keyword: '',
      level: undefined,
      source: undefined,
      dateRange: []
    });
    setPagination({ ...pagination, current: 1 });
    fetchLogs({ page: 1 });
  };

  // 查看日志详情
  const handleViewDetail = (record) => {
    setCurrentLog(record);
    setDetailModalVisible(true);
  };

  useEffect(() => {
    fetchLogs();
    fetchStats();
  }, []);

  // 表格列定义
  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '级别',
      dataIndex: 'level',
      key: 'level',
      width: 100,
      render: (text, record) => {
        let color = 'blue';
        if (text === 'info') color = 'green';
        if (text === 'warning') color = 'orange';
        if (text === 'error') color = 'red';
        if (text === 'debug') color = 'cyan';

        return (
          <Tag color={color}>
            {record.level_display || text}
          </Tag>
        );
      }
    },
    {
      title: '来源',
      dataIndex: 'source',
      key: 'source',
      width: 120,
    },
    {
      title: '消息',
      dataIndex: 'message',
      key: 'message',
      ellipsis: true,
    },
    {
      title: '时间',
      dataIndex: 'timestamp',
      key: 'timestamp',
      width: 180,
      render: (text) => moment(text).format('YYYY-MM-DD HH:mm:ss')
    },
    {
      title: '操作',
      key: 'action',
      width: 80,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => handleViewDetail(record)}
            />
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className="system-log-list-page">
      <PageHeader
        title="系统日志"
        subTitle="查看和管理系统日志"
        breadcrumb={[
          { title: '首页', path: '/' },
          { title: '日志管理' },
          { title: '系统日志' }
        ]}
        extra={[
          <Button
            key="sync"
            icon={<SyncOutlined />}
            onClick={handleSync}
            loading={syncing}
          >
            同步日志
          </Button>,
          <Button
            key="export"
            icon={<DownloadOutlined />}
            onClick={handleExport}
          >
            导出
          </Button>,
          <Button
            key="exportPage"
            icon={<CloudDownloadOutlined />}
            onClick={() => window.location.href = '/logs/export'}
          >
            高级导出
          </Button>,
        ]}
      />

      <div className="stats-cards" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={6}>
            <Card>
              <Statistic
                title="总日志数"
                value={stats.total_logs}
                valueStyle={{ color: '#3f8600' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="信息日志"
                value={stats.level_stats?.info || 0}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="警告日志"
                value={stats.level_stats?.warning || 0}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="错误日志"
                value={stats.level_stats?.error || 0}
                valueStyle={{ color: '#f5222d' }}
              />
            </Card>
          </Col>
        </Row>
      </div>

      <Card>
        <div className="table-filter-wrapper" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={6}>
              <Input
                placeholder="搜索消息或来源"
                value={filters.keyword}
                onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
                prefix={<SearchOutlined />}
                allowClear
              />
            </Col>
            <Col span={4}>
              <Select
                placeholder="日志级别"
                style={{ width: '100%' }}
                value={filters.level}
                onChange={(value) => setFilters({ ...filters, level: value })}
                allowClear
              >
                <Option value="info">信息</Option>
                <Option value="warning">警告</Option>
                <Option value="error">错误</Option>
                <Option value="debug">调试</Option>
              </Select>
            </Col>
            <Col span={4}>
              <Select
                placeholder="来源"
                style={{ width: '100%' }}
                value={filters.source}
                onChange={(value) => setFilters({ ...filters, source: value })}
                allowClear
              >
                {Object.keys(stats.source_stats || {}).map(source => (
                  <Option key={source} value={source}>{source}</Option>
                ))}
              </Select>
            </Col>
            <Col span={6}>
              <RangePicker
                style={{ width: '100%' }}
                value={filters.dateRange}
                onChange={(dates) => setFilters({ ...filters, dateRange: dates })}
              />
            </Col>
            <Col span={4}>
              <Space>
                <Button type="primary" onClick={handleSearch}>
                  搜索
                </Button>
                <Button onClick={handleReset}>
                  重置
                </Button>
              </Space>
            </Col>
          </Row>
        </div>

        <Table
          columns={columns}
          dataSource={logs}
          rowKey="id"
          pagination={pagination}
          loading={loading}
          onChange={handleTableChange}
          scroll={{ x: 1000 }}
        />
      </Card>

      <Modal
        title="日志详情"
        visible={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={700}
      >
        {currentLog && (
          <div className="log-detail">
            <Row gutter={[16, 16]}>
              <Col span={12}>
                <div className="detail-item">
                  <div className="detail-label">ID:</div>
                  <div className="detail-value">{currentLog.id}</div>
                </div>
              </Col>
              <Col span={12}>
                <div className="detail-item">
                  <div className="detail-label">级别:</div>
                  <div className="detail-value">
                    <Tag color={
                      currentLog.level === 'info' ? 'green' :
                      currentLog.level === 'warning' ? 'orange' :
                      currentLog.level === 'error' ? 'red' :
                      currentLog.level === 'debug' ? 'cyan' : 'blue'
                    }>
                      {currentLog.level_display || currentLog.level}
                    </Tag>
                  </div>
                </div>
              </Col>
              <Col span={12}>
                <div className="detail-item">
                  <div className="detail-label">来源:</div>
                  <div className="detail-value">{currentLog.source}</div>
                </div>
              </Col>
              <Col span={12}>
                <div className="detail-item">
                  <div className="detail-label">时间:</div>
                  <div className="detail-value">{moment(currentLog.timestamp).format('YYYY-MM-DD HH:mm:ss')}</div>
                </div>
              </Col>
              <Col span={24}>
                <div className="detail-item">
                  <div className="detail-label">消息:</div>
                  <div className="detail-value">{currentLog.message}</div>
                </div>
              </Col>
            </Row>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default SystemLogList;
