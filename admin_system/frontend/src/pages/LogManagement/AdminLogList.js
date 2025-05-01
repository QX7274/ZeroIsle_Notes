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
  getAdminLogs,
  getAdminLogStats,
  exportAdminLogs,
  syncAdminLogs
} from '../../services/logService';
import moment from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;

const AdminLogList = () => {
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
    action: undefined,
    module: undefined,
    dateRange: []
  });
  const [stats, setStats] = useState({
    total_logs: 0,
    action_stats: {},
    module_stats: {}
  });
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [currentLog, setCurrentLog] = useState(null);

  // 获取管理员操作日志
  const fetchLogs = async (params = {}) => {
    try {
      setLoading(true);
      const queryParams = {
        page: params.page || pagination.current,
        page_size: params.pageSize || pagination.pageSize,
        search: filters.keyword,
        action: filters.action,
        module: filters.module,
        ordering: '-operation_time'
      };

      if (filters.dateRange && filters.dateRange.length === 2) {
        queryParams.start_time = filters.dateRange[0].format('YYYY-MM-DD');
        queryParams.end_time = filters.dateRange[1].format('YYYY-MM-DD');
      }

      const response = await getAdminLogs(queryParams);
      setLogs(response.results || []);
      setPagination({
        ...pagination,
        current: params.page || pagination.current,
        pageSize: params.pageSize || pagination.pageSize,
        total: response.count || 0
      });
    } catch (error) {
      console.error('获取管理员操作日志错误:', error);
      message.error('获取管理员操作日志失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 获取日志统计数据
  const fetchStats = async () => {
    try {
      const response = await getAdminLogStats();
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
      const response = await syncAdminLogs({ incremental: true });
      message.success('管理员操作日志同步成功');
      fetchLogs();
      fetchStats();
    } catch (error) {
      console.error('同步管理员操作日志错误:', error);
      message.error('同步管理员操作日志失败，请稍后重试');
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
        action: filters.action,
        module: filters.module
      };

      if (filters.dateRange && filters.dateRange.length === 2) {
        exportParams.start_time = filters.dateRange[0].format('YYYY-MM-DD');
        exportParams.end_time = filters.dateRange[1].format('YYYY-MM-DD');
      }

      await exportAdminLogs(exportParams);
      message.success('导出请求已发送，文件将在新窗口中下载');
    } catch (error) {
      console.error('导出管理员操作日志错误:', error);
      message.error('导出管理员操作日志失败，请稍后重试');
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
      action: undefined,
      module: undefined,
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
      title: '管理员',
      dataIndex: 'admin_username',
      key: 'admin_username',
      width: 120,
    },
    {
      title: '操作类型',
      dataIndex: 'action',
      key: 'action',
      width: 120,
      render: (text, record) => {
        let color = 'blue';
        if (text === 'create') color = 'green';
        if (text === 'update') color = 'orange';
        if (text === 'delete') color = 'red';
        if (text === 'login') color = 'cyan';
        if (text === 'logout') color = 'purple';

        return (
          <Tag color={color}>
            {record.action_display || text}
          </Tag>
        );
      }
    },
    {
      title: '模块',
      dataIndex: 'module',
      key: 'module',
      width: 120,
    },
    {
      title: '资源ID',
      dataIndex: 'resource_id',
      key: 'resource_id',
      width: 100,
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: 'IP地址',
      dataIndex: 'ip_address',
      key: 'ip_address',
      width: 130,
    },
    {
      title: '操作时间',
      dataIndex: 'operation_time',
      key: 'operation_time',
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
    <div className="admin-log-list-page">
      <PageHeader
        title="管理员操作日志"
        subTitle="查看和管理系统操作日志"
        breadcrumb={[
          { title: '首页', path: '/' },
          { title: '日志管理' },
          { title: '管理员操作日志' }
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
                title="创建操作"
                value={stats.action_stats?.create || 0}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="更新操作"
                value={stats.action_stats?.update || 0}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="删除操作"
                value={stats.action_stats?.delete || 0}
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
                placeholder="搜索管理员、描述或IP"
                value={filters.keyword}
                onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
                prefix={<SearchOutlined />}
                allowClear
              />
            </Col>
            <Col span={4}>
              <Select
                placeholder="操作类型"
                style={{ width: '100%' }}
                value={filters.action}
                onChange={(value) => setFilters({ ...filters, action: value })}
                allowClear
              >
                <Option value="create">创建</Option>
                <Option value="update">更新</Option>
                <Option value="delete">删除</Option>
                <Option value="login">登录</Option>
                <Option value="logout">登出</Option>
                <Option value="other">其他</Option>
              </Select>
            </Col>
            <Col span={4}>
              <Select
                placeholder="模块"
                style={{ width: '100%' }}
                value={filters.module}
                onChange={(value) => setFilters({ ...filters, module: value })}
                allowClear
              >
                {Object.keys(stats.module_stats || {}).map(module => (
                  <Option key={module} value={module}>{module}</Option>
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
          scroll={{ x: 1200 }}
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
                  <div className="detail-label">管理员:</div>
                  <div className="detail-value">{currentLog.admin_username}</div>
                </div>
              </Col>
              <Col span={12}>
                <div className="detail-item">
                  <div className="detail-label">操作类型:</div>
                  <div className="detail-value">
                    <Tag color={
                      currentLog.action === 'create' ? 'green' :
                      currentLog.action === 'update' ? 'orange' :
                      currentLog.action === 'delete' ? 'red' :
                      currentLog.action === 'login' ? 'cyan' :
                      currentLog.action === 'logout' ? 'purple' : 'blue'
                    }>
                      {currentLog.action_display || currentLog.action}
                    </Tag>
                  </div>
                </div>
              </Col>
              <Col span={12}>
                <div className="detail-item">
                  <div className="detail-label">模块:</div>
                  <div className="detail-value">{currentLog.module}</div>
                </div>
              </Col>
              <Col span={12}>
                <div className="detail-item">
                  <div className="detail-label">资源ID:</div>
                  <div className="detail-value">{currentLog.resource_id || '-'}</div>
                </div>
              </Col>
              <Col span={12}>
                <div className="detail-item">
                  <div className="detail-label">IP地址:</div>
                  <div className="detail-value">{currentLog.ip_address}</div>
                </div>
              </Col>
              <Col span={24}>
                <div className="detail-item">
                  <div className="detail-label">操作时间:</div>
                  <div className="detail-value">{moment(currentLog.operation_time).format('YYYY-MM-DD HH:mm:ss')}</div>
                </div>
              </Col>
              <Col span={24}>
                <div className="detail-item">
                  <div className="detail-label">描述:</div>
                  <div className="detail-value">{currentLog.description}</div>
                </div>
              </Col>
            </Row>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default AdminLogList;
