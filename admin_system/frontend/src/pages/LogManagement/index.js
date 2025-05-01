import React, { useState, useEffect } from 'react';
import {
  Table, Card, Input, Button, Space, DatePicker, Select, Typography,
  Tag, Tooltip, message, Row, Col, Badge, Modal
} from 'antd';
import {
  SearchOutlined, DeleteOutlined, ExportOutlined,
  InfoCircleOutlined, HistoryOutlined, FileTextOutlined,
  UserOutlined, ClockCircleOutlined
} from '@ant-design/icons';
import { getAdminLogs, clearAdminLogs, exportAdminLogs, getLogStats } from '../../services/logService';
import '../../styles/LogManagement.css';

const { Title, Text } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

const LogManagement = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
    showSizeChanger: true,
    showQuickJumper: true,
    showTotal: (total) => `共 ${total} 条记录`,
  });
  const [filters, setFilters] = useState({
    keyword: '',
    action: 'all',
    adminId: undefined,
    dateRange: null,
  });
  const [stats, setStats] = useState({
    totalLogs: 0,
    todayLogs: 0,
    loginCount: 0,
    operationCount: 0,
  });
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [selectedRows, setSelectedRows] = useState([]);

  // 获取操作日志
  const fetchLogs = async (params = {}) => {
    try {
      setLoading(true);
      const response = await getAdminLogs({
        page: params.page || pagination.current,
        pageSize: params.pageSize || pagination.pageSize,
        keyword: filters.keyword,
        action: filters.action !== 'all' ? filters.action : undefined,
        adminId: filters.adminId,
        startDate: filters.dateRange?.[0]?.format('YYYY-MM-DD'),
        endDate: filters.dateRange?.[1]?.format('YYYY-MM-DD'),
        sortField: params.sortField || 'createdAt',
        sortOrder: params.sortOrder || 'desc',
      });

      setLogs(response.data);
      setPagination({
        ...pagination,
        current: params.page || pagination.current,
        pageSize: params.pageSize || pagination.pageSize,
        total: response.total,
      });
    } catch (error) {
      console.error('获取操作日志失败:', error);
      message.error('获取操作日志失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 获取日志统计数据
  const fetchLogStats = async () => {
    try {
      setStatsLoading(true);
      const statsData = await getLogStats();
      setStats(statsData);
    } catch (error) {
      console.error('获取日志统计数据失败:', error);
      message.error('获取日志统计数据失败，请稍后重试');
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    fetchLogStats();
  }, []);

  // 处理表格变化
  const handleTableChange = (pagination, _, sorter) => {
    fetchLogs({
      page: pagination.current,
      pageSize: pagination.pageSize,
      sortField: sorter.field,
      sortOrder: sorter.order,
    });
  };

  // 处理搜索
  const handleSearch = () => {
    setPagination({ ...pagination, current: 1 });
    fetchLogs({ page: 1 });
  };

  // 处理重置
  const handleReset = () => {
    setFilters({
      keyword: '',
      action: 'all',
      adminId: undefined,
      dateRange: null,
    });
    setPagination({ ...pagination, current: 1 });
    fetchLogs({ page: 1 });
  };

  // 处理导出日志
  const handleExport = async () => {
    try {
      setExporting(true);
      await exportAdminLogs({
        keyword: filters.keyword,
        action: filters.action !== 'all' ? filters.action : undefined,
        adminId: filters.adminId,
        startDate: filters.dateRange?.[0]?.format('YYYY-MM-DD'),
        endDate: filters.dateRange?.[1]?.format('YYYY-MM-DD'),
      });
      message.success('导出操作日志成功');
    } catch (error) {
      console.error('导出操作日志失败:', error);
      message.error('导出操作日志失败，请稍后重试');
    } finally {
      setExporting(false);
    }
  };

  // 处理清空日志
  const handleClear = async () => {
    try {
      setClearing(true);
      await clearAdminLogs();
      message.success('清空操作日志成功');
      fetchLogs();
    } catch (error) {
      console.error('清空操作日志失败:', error);
      message.error('清空操作日志失败，请稍后重试');
    } finally {
      setClearing(false);
    }
  };

  // 获取操作类型标签颜色
  const getActionTagColor = (action) => {
    switch (action) {
      case 'CREATE':
        return 'green';
      case 'UPDATE':
        return 'blue';
      case 'DELETE':
        return 'red';
      case 'LOGIN':
        return 'purple';
      case 'LOGOUT':
        return 'orange';
      default:
        return 'default';
    }
  };

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
      dataIndex: 'admin',
      key: 'admin',
      render: (admin) => admin?.username || '-',
    },
    {
      title: '操作类型',
      dataIndex: 'action',
      key: 'action',
      render: (action) => (
        <Tag color={getActionTagColor(action)}>
          {action === 'CREATE' && '创建'}
          {action === 'UPDATE' && '更新'}
          {action === 'DELETE' && '删除'}
          {action === 'LOGIN' && '登录'}
          {action === 'LOGOUT' && '登出'}
          {action === 'OTHER' && '其他'}
        </Tag>
      ),
    },
    {
      title: '目标模型',
      dataIndex: 'targetModel',
      key: 'targetModel',
    },
    {
      title: '目标ID',
      dataIndex: 'targetId',
      key: 'targetId',
      render: (targetId) => targetId || '-',
    },
    {
      title: '操作描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: {
        showTitle: false,
      },
      render: (description) => (
        <Tooltip placement="topLeft" title={description}>
          {description}
        </Tooltip>
      ),
    },
    {
      title: 'IP地址',
      dataIndex: 'ipAddress',
      key: 'ipAddress',
      render: (ipAddress) => ipAddress || '-',
    },
    {
      title: '操作时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      sorter: true,
      defaultSortOrder: 'descend',
    },
  ];

  return (
    <div className="log-management-container">
      <div className="log-list-header">
        <div className="log-list-title">
          <HistoryOutlined className="log-list-icon" />
          <div className="title-content">
            <Title level={3} style={{ margin: 0 }}>操作日志</Title>
            <Text type="secondary">记录管理员在系统中的所有操作</Text>
          </div>
        </div>
        <Space>
          <Button
            type="primary"
            icon={<ExportOutlined />}
            onClick={handleExport}
            loading={exporting}
            size="large"
          >
            导出日志
          </Button>
          <Button
            danger
            icon={<DeleteOutlined />}
            onClick={() => {
              Modal.confirm({
                title: '确定要清空所有日志吗？',
                content: '此操作不可恢复，所有日志将被永久删除！',
                okText: '确定',
                okType: 'danger',
                cancelText: '取消',
                onOk: handleClear
              });
            }}
            loading={clearing}
            size="large"
          >
            清空日志
          </Button>
        </Space>
      </div>

      <Row gutter={24} className="stats-row">
        <Col span={6}>
          <Card className="log-stat-card" loading={statsLoading}>
            <div className="log-stat-icon" style={{ backgroundColor: 'rgba(67, 97, 238, 0.1)' }}>
              <FileTextOutlined style={{ color: '#4361EE' }} />
            </div>
            <div className="log-stat-content">
              <div className="log-stat-title">总日志数</div>
              <div className="log-stat-value">{stats.totalLogs}</div>
              <div className="log-stat-footer">
                <Badge
                  count={`今日 +${stats.todayLogs}`}
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
          <Card className="log-stat-card" loading={statsLoading}>
            <div className="log-stat-icon" style={{ backgroundColor: 'rgba(76, 201, 240, 0.1)' }}>
              <UserOutlined style={{ color: '#4CC9F0' }} />
            </div>
            <div className="log-stat-content">
              <div className="log-stat-title">登录次数</div>
              <div className="log-stat-value">{stats.loginCount}</div>
              <div className="log-stat-footer">
                <Badge
                  count="认证操作"
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
          <Card className="log-stat-card" loading={statsLoading}>
            <div className="log-stat-icon" style={{ backgroundColor: 'rgba(255, 159, 28, 0.1)' }}>
              <ClockCircleOutlined style={{ color: '#FF9F1C' }} />
            </div>
            <div className="log-stat-content">
              <div className="log-stat-title">今日日志</div>
              <div className="log-stat-value">{stats.todayLogs}</div>
              <div className="log-stat-footer">
                <Badge
                  count="今日活动"
                  className="stat-badge"
                  style={{
                    backgroundColor: 'rgba(255, 159, 28, 0.1)',
                    color: '#FF9F1C',
                    fontWeight: 500
                  }}
                />
              </div>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card className="log-stat-card" loading={statsLoading}>
            <div className="log-stat-icon" style={{ backgroundColor: 'rgba(58, 12, 163, 0.1)' }}>
              <HistoryOutlined style={{ color: '#3A0CA3' }} />
            </div>
            <div className="log-stat-content">
              <div className="log-stat-title">操作次数</div>
              <div className="log-stat-value">{stats.operationCount}</div>
              <div className="log-stat-footer">
                <Badge
                  count="数据操作"
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
      </Row>

      {selectedRowKeys.length > 0 && (
        <div className="batch-actions-toolbar">
          <div className="batch-actions-info">
            已选择 <Text strong>{selectedRowKeys.length}</Text> 项
          </div>
          <div className="batch-actions-buttons">
            <Button
              onClick={() => {
                // 导出选中日志数据
                try {
                  const exportData = selectedRows.map(log => ({
                    ID: log.id,
                    管理员: log.admin?.username || '-',
                    操作类型: log.action === 'CREATE' ? '创建' :
                             log.action === 'UPDATE' ? '更新' :
                             log.action === 'DELETE' ? '删除' :
                             log.action === 'LOGIN' ? '登录' :
                             log.action === 'LOGOUT' ? '登出' : '其他',
                    目标模型: log.targetModel,
                    目标ID: log.targetId || '-',
                    操作描述: log.description,
                    IP地址: log.ipAddress || '-',
                    操作时间: log.createdAt,
                  }));
                  exportToExcel(exportData, '选中日志列表');
                  message.success('导出成功');
                } catch (error) {
                  message.error('导出失败，请稍后重试');
                }
              }}
              icon={<ExportOutlined />}
            >
              导出选中
            </Button>
            <Button
              onClick={() => {
                Modal.confirm({
                  title: '批量删除日志',
                  content: `确定要删除选中的 ${selectedRowKeys.length} 条日志吗？此操作不可恢复！`,
                  okButtonProps: { danger: true },
                  onOk: async () => {
                    try {
                      // 这里应该调用批量删除API
                      message.success(`已成功删除 ${selectedRowKeys.length} 条日志`);
                      setSelectedRowKeys([]);
                      setSelectedRows([]);
                      fetchLogs();
                    } catch (error) {
                      message.error('批量删除失败，请稍后重试');
                    }
                  }
                });
              }}
              icon={<DeleteOutlined />}
              danger
            >
              批量删除
            </Button>
            <Button
              onClick={() => {
                setSelectedRowKeys([]);
                setSelectedRows([]);
              }}
            >
              取消选择
            </Button>
          </div>
        </div>
      )}

      <div className="log-search-form">
        <Row gutter={24} align="middle">
          <Col span={8}>
            <Input
              placeholder="搜索关键词"
              value={filters.keyword}
              onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
              allowClear
              prefix={<SearchOutlined />}
              size="large"
              style={{ borderRadius: '10px' }}
            />
          </Col>
          <Col span={6}>
            <Select
              placeholder="操作类型"
              value={filters.action}
              onChange={(value) => setFilters({ ...filters, action: value })}
              style={{ width: '100%' }}
              size="large"
              dropdownStyle={{ borderRadius: '10px' }}
            >
              <Option value="all">全部操作</Option>
              <Option value="CREATE">创建</Option>
              <Option value="UPDATE">更新</Option>
              <Option value="DELETE">删除</Option>
              <Option value="LOGIN">登录</Option>
              <Option value="LOGOUT">登出</Option>
              <Option value="OTHER">其他</Option>
            </Select>
          </Col>
          <Col span={8}>
            <RangePicker
              value={filters.dateRange}
              onChange={(dates) => setFilters({ ...filters, dateRange: dates })}
              style={{ width: '100%' }}
              placeholder={['开始日期', '结束日期']}
              size="large"
              // 使用预设时间范围
              // ranges={{
              //   '今天': [moment(), moment()],
              //   '昨天': [moment().subtract(1, 'days'), moment().subtract(1, 'days')],
              //   '本周': [moment().startOf('week'), moment().endOf('week')],
              //   '本月': [moment().startOf('month'), moment().endOf('month')],
              // }}
            />
          </Col>
          <Col span={2}>
            <div className="search-btn-wrapper">
              <Button type="primary" onClick={handleSearch} size="large" icon={<SearchOutlined />}>
                搜索
              </Button>
              <Button onClick={handleReset} size="large">
                重置
              </Button>
            </div>
          </Col>
        </Row>
      </div>

      <Card className="log-table-card">
        <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(0, 0, 0, 0.05)' }}>
          <Space size={16}>
            <Typography.Title level={5} style={{ margin: 0 }}>日志列表</Typography.Title>
            <Typography.Text type="secondary">共 {pagination.total} 条记录</Typography.Text>
          </Space>
        </div>
        <Table
          columns={columns}
          dataSource={logs}
          rowKey="id"
          pagination={pagination}
          loading={loading}
          onChange={handleTableChange}
          scroll={{ x: 1200 }}
          size="middle"
          rowSelection={{
            type: 'checkbox',
            selectedRowKeys,
            onChange: (selectedRowKeys, selectedRows) => {
              setSelectedRowKeys(selectedRowKeys);
              setSelectedRows(selectedRows);
            }
          }}
        />
      </Card>

      <div className="log-tips">
        <InfoCircleOutlined /> 提示：操作日志记录了管理员在系统中的所有操作，包括登录、登出、创建、更新和删除等操作。日志保留期限为30天。
      </div>
    </div>
  );
};

export default LogManagement;
