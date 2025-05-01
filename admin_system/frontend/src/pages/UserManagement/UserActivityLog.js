import React, { useState, useEffect } from 'react';
import {
  Table, Card, Space, Typography, Tag, Input, Button, DatePicker,
  Select, Row, Col, message, Tooltip, Badge
} from 'antd';
import {
  SearchOutlined, ReloadOutlined, UserOutlined, ClockCircleOutlined,
  GlobalOutlined, DesktopOutlined, ExportOutlined
} from '@ant-design/icons';
import { getUserActivities } from '../../services/userService';
import { PageHeader } from '../../components/common';
import { exportToExcel } from '../../utils/exportUtils';
import moment from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;
const { Title, Text } = Typography;

const UserActivityLog = () => {
  const [activities, setActivities] = useState([]);
  const [loading, setLoading] = useState(false);
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
    activityType: 'all',
    dateRange: null,
  });

  // 获取用户活动记录
  const fetchActivities = async (params = {}) => {
    try {
      setLoading(true);
      const response = await getUserActivities({
        page: params.page || pagination.current,
        pageSize: params.pageSize || pagination.pageSize,
        keyword: filters.keyword,
        activity_type: filters.activityType !== 'all' ? filters.activityType : undefined,
        start_date: filters.dateRange?.[0]?.format('YYYY-MM-DD'),
        end_date: filters.dateRange?.[1]?.format('YYYY-MM-DD'),
        sortField: params.sortField,
        sortOrder: params.sortOrder,
      });

      setActivities(response.data || []);
      setPagination({
        ...pagination,
        current: params.page || pagination.current,
        pageSize: params.pageSize || pagination.pageSize,
        total: response.total || 0,
      });
    } catch (error) {
      console.error('获取用户活动记录失败:', error);
      message.error('获取用户活动记录失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();
  }, []);

  // 处理表格变化
  const handleTableChange = (pagination, filters, sorter) => {
    fetchActivities({
      page: pagination.current,
      pageSize: pagination.pageSize,
      sortField: sorter.field,
      sortOrder: sorter.order,
    });
  };

  // 处理搜索
  const handleSearch = () => {
    setPagination({ ...pagination, current: 1 });
    fetchActivities({ page: 1 });
  };

  // 处理重置
  const handleReset = () => {
    setFilters({
      keyword: '',
      activityType: 'all',
      dateRange: null,
    });
    setPagination({ ...pagination, current: 1 });
    fetchActivities({ page: 1 });
  };

  // 刷新数据
  const handleRefresh = () => {
    fetchActivities();
    message.success('数据已刷新');
  };

  // 导出活动记录
  const handleExport = () => {
    try {
      // 准备导出数据
      const exportData = activities.map(activity => ({
        用户名: activity.username || '',
        活动类型: getActivityTypeText(activity.activity_type),
        描述: activity.description,
        IP地址: activity.ip_address,
        设备信息: activity.user_agent,
        时间: activity.created_at
      }));

      // 导出Excel
      exportToExcel(exportData, '用户活动记录');
      message.success('导出成功');
    } catch (error) {
      console.error('导出失败:', error);
      message.error('导出失败，请稍后重试');
    }
  };

  // 获取活动类型文本
  const getActivityTypeText = (type) => {
    const typeMap = {
      'login': '登录',
      'logout': '登出',
      'register': '注册',
      'password_change': '修改密码',
      'profile_update': '更新资料',
      'note_create': '创建笔记',
      'note_update': '更新笔记',
      'note_delete': '删除笔记',
      'comment_create': '发表评论',
      'comment_update': '更新评论',
      'comment_delete': '删除评论',
      'user_banned': '用户被禁用',
      'user_activated': '用户被激活',
      'user_deleted': '用户被删除'
    };
    return typeMap[type] || type;
  };

  // 获取活动类型标签颜色
  const getActivityTypeColor = (type) => {
    const colorMap = {
      'login': 'green',
      'logout': 'blue',
      'register': 'purple',
      'password_change': 'orange',
      'profile_update': 'cyan',
      'note_create': 'green',
      'note_update': 'blue',
      'note_delete': 'red',
      'comment_create': 'green',
      'comment_update': 'blue',
      'comment_delete': 'red',
      'user_banned': 'red',
      'user_activated': 'green',
      'user_deleted': 'red'
    };
    return colorMap[type] || 'default';
  };

  // 表格列定义
  const columns = [
    {
      title: '用户',
      dataIndex: 'username',
      key: 'username',
      render: (text, record) => (
        <Space>
          <UserOutlined />
          {text || '系统'}
        </Space>
      ),
    },
    {
      title: '活动类型',
      dataIndex: 'activity_type',
      key: 'activity_type',
      render: (type) => (
        <Tag color={getActivityTypeColor(type)}>
          {getActivityTypeText(type)}
        </Tag>
      ),
      filters: [
        { text: '登录', value: 'login' },
        { text: '登出', value: 'logout' },
        { text: '注册', value: 'register' },
        { text: '修改密码', value: 'password_change' },
        { text: '更新资料', value: 'profile_update' },
        { text: '创建笔记', value: 'note_create' },
        { text: '更新笔记', value: 'note_update' },
        { text: '删除笔记', value: 'note_delete' },
        { text: '发表评论', value: 'comment_create' },
        { text: '更新评论', value: 'comment_update' },
        { text: '删除评论', value: 'comment_delete' },
        { text: '用户被禁用', value: 'user_banned' },
        { text: '用户被激活', value: 'user_activated' },
        { text: '用户被删除', value: 'user_deleted' },
      ],
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
      render: (ip) => (
        <Space>
          <GlobalOutlined />
          {ip || '-'}
        </Space>
      ),
    },
    {
      title: '设备信息',
      dataIndex: 'user_agent',
      key: 'user_agent',
      ellipsis: true,
      render: (ua) => (
        <Tooltip title={ua}>
          <Space>
            <DesktopOutlined />
            {ua ? (
              ua.includes('Mobile') ? '移动设备' : '桌面设备'
            ) : '-'}
          </Space>
        </Tooltip>
      ),
    },
    {
      title: '时间',
      dataIndex: 'created_at',
      key: 'created_at',
      sorter: true,
      render: (time) => (
        <Space>
          <ClockCircleOutlined />
          {time}
        </Space>
      ),
    },
  ];

  return (
    <div className="user-activity-log-container">
      <PageHeader
        title="用户活动日志"
        subTitle="查看用户活动记录"
        breadcrumb={[
          { title: '首页', path: '/' },
          { title: '用户管理', path: '/users' },
          { title: '活动日志' }
        ]}
        extra={[
          <Button
            key="export"
            icon={<ExportOutlined />}
            onClick={handleExport}
          >
            导出
          </Button>,
          <Button
            key="refresh"
            icon={<ReloadOutlined />}
            onClick={handleRefresh}
          >
            刷新
          </Button>,
        ]}
      />

      <div className="activity-search-form">
        <Row gutter={24} align="middle">
          <Col span={8}>
            <Input
              placeholder="搜索用户名/描述/IP地址"
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
              placeholder="活动类型"
              value={filters.activityType}
              onChange={(value) => setFilters({ ...filters, activityType: value })}
              style={{ width: '100%' }}
              size="large"
              dropdownStyle={{ borderRadius: '10px' }}
            >
              <Option value="all">全部类型</Option>
              <Option value="login">登录</Option>
              <Option value="logout">登出</Option>
              <Option value="register">注册</Option>
              <Option value="password_change">修改密码</Option>
              <Option value="profile_update">更新资料</Option>
              <Option value="note_create">创建笔记</Option>
              <Option value="note_update">更新笔记</Option>
              <Option value="note_delete">删除笔记</Option>
              <Option value="comment_create">发表评论</Option>
              <Option value="comment_update">更新评论</Option>
              <Option value="comment_delete">删除评论</Option>
              <Option value="user_banned">用户被禁用</Option>
              <Option value="user_activated">用户被激活</Option>
              <Option value="user_deleted">用户被删除</Option>
            </Select>
          </Col>
          <Col span={8}>
            <RangePicker
              value={filters.dateRange}
              onChange={(dates) => setFilters({ ...filters, dateRange: dates })}
              style={{ width: '100%' }}
              placeholder={['开始日期', '结束日期']}
              size="large"
              ranges={{
                '今天': [moment(), moment()],
                '本周': [moment().startOf('week'), moment().endOf('week')],
                '本月': [moment().startOf('month'), moment().endOf('month')],
                '上个月': [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')],
              }}
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

      <Card className="activity-table-card">
        <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(0, 0, 0, 0.05)' }}>
          <Space size={16}>
            <Typography.Title level={5} style={{ margin: 0 }}>活动记录</Typography.Title>
            <Typography.Text type="secondary">共 {pagination.total} 条记录</Typography.Text>
          </Space>
        </div>
        <Table
          columns={columns}
          dataSource={activities}
          rowKey="id"
          pagination={pagination}
          loading={loading}
          onChange={handleTableChange}
          scroll={{ x: 1200 }}
          size="middle"
        />
      </Card>
    </div>
  );
};

export default UserActivityLog;
