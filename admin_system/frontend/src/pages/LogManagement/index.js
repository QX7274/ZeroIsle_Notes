import React, { useState, useEffect } from 'react';
import { Table, Card, Input, Button, Space, DatePicker, Select, Typography, Tag, Tooltip, message } from 'antd';
import { SearchOutlined, DeleteOutlined, ExportOutlined, ReloadOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { getAdminLogs, clearAdminLogs, exportAdminLogs } from '../../services/logService';

const { Title } = Typography;
const { RangePicker } = DatePicker;
const { Option } = Select;

const LogManagement = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });
  const [filters, setFilters] = useState({
    keyword: '',
    action: 'all',
    adminId: undefined,
    dateRange: null,
  });
  
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
  
  useEffect(() => {
    fetchLogs();
  }, []);
  
  // 处理表格变化
  const handleTableChange = (pagination, filters, sorter) => {
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
      <div className="page-header">
        <Title level={2}>操作日志</Title>
        <Space>
          <Button
            type="primary"
            icon={<ExportOutlined />}
            onClick={handleExport}
            loading={exporting}
          >
            导出日志
          </Button>
          <Button
            danger
            icon={<DeleteOutlined />}
            onClick={handleClear}
            loading={clearing}
          >
            清空日志
          </Button>
        </Space>
      </div>
      
      <Card className="search-card">
        <Space wrap>
          <Input
            placeholder="搜索关键词"
            value={filters.keyword}
            onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
            style={{ width: 200 }}
            allowClear
          />
          <Select
            placeholder="操作类型"
            value={filters.action}
            onChange={(value) => setFilters({ ...filters, action: value })}
            style={{ width: 120 }}
          >
            <Option value="all">全部操作</Option>
            <Option value="CREATE">创建</Option>
            <Option value="UPDATE">更新</Option>
            <Option value="DELETE">删除</Option>
            <Option value="LOGIN">登录</Option>
            <Option value="LOGOUT">登出</Option>
            <Option value="OTHER">其他</Option>
          </Select>
          <RangePicker
            value={filters.dateRange}
            onChange={(dates) => setFilters({ ...filters, dateRange: dates })}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
            搜索
          </Button>
          <Button icon={<ReloadOutlined />} onClick={handleReset}>
            重置
          </Button>
        </Space>
      </Card>
      
      <Table
        columns={columns}
        dataSource={logs}
        rowKey="id"
        pagination={pagination}
        loading={loading}
        onChange={handleTableChange}
      />
      
      <div className="log-tips">
        <InfoCircleOutlined /> 提示：操作日志记录了管理员在系统中的所有操作，包括登录、登出、创建、更新和删除等操作。
      </div>
    </div>
  );
};

export default LogManagement;
