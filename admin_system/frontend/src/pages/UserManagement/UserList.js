import React, { useState, useEffect } from 'react';
import {
  Table, Input, Button, Space, Tag, Popconfirm, message,
  Card, Select, DatePicker, Row, Col, Tooltip, Avatar,
  Typography, Divider, Badge, Statistic, Dropdown, Menu,
  Modal
} from 'antd';
import {
  SearchOutlined, EditOutlined, DeleteOutlined, EyeOutlined,
  LockOutlined, UnlockOutlined, UserOutlined, PlusOutlined,
  ReloadOutlined, DownloadOutlined, UserSwitchOutlined,
  MailOutlined, PhoneOutlined, ExportOutlined, FilterOutlined,
  MoreOutlined, ImportOutlined, SettingOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import {
  getUsers,
  deleteUser,
  updateUserStatus,
  getUserStats,
  syncUsers,
  batchActivateUsers,
  batchDeactivateUsers,
  batchDeleteUsers,
  exportUsers
} from '../../services/userService';
import { PageHeader } from '../../components/common';
import { exportToExcel } from '../../utils/exportUtils';
import moment from 'dayjs';

const { RangePicker } = DatePicker;
const { Option } = Select;

const { Title, Text } = Typography;

const UserList = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
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
    status: 'all',
    dateRange: null,
  });
  const [stats, setStats] = useState({
    totalUsers: 0,
    activeUsers: 0,
    inactiveUsers: 0,
    todayNewUsers: 0,
  });
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [selectedRows, setSelectedRows] = useState([]);

  const navigate = useNavigate();

  // 获取用户统计数据
  const fetchUserStats = async () => {
    try {
      setStatsLoading(true);
      const statsData = await getUserStats();
      setStats(statsData);
    } catch (error) {
      console.error('获取用户统计数据失败:', error);
      message.error('获取用户统计数据失败，请稍后重试');
    } finally {
      setStatsLoading(false);
    }
  };

  // 获取用户列表
  const fetchUsers = async (params = {}) => {
    try {
      setLoading(true);
      const response = await getUsers({
        page: params.page || pagination.current,
        pageSize: params.pageSize || pagination.pageSize,
        keyword: filters.keyword,
        status: filters.status !== 'all' ? filters.status : undefined,
        startDate: filters.dateRange?.[0]?.format('YYYY-MM-DD'),
        endDate: filters.dateRange?.[1]?.format('YYYY-MM-DD'),
        sortField: params.sortField,
        sortOrder: params.sortOrder,
      });

      setUsers(response.data || []);
      setPagination({
        ...pagination,
        current: params.page || pagination.current,
        pageSize: params.pageSize || pagination.pageSize,
        total: response.total || 0,
      });
    } catch (error) {
      console.error('获取用户列表失败:', error);
      message.error('获取用户列表失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchUserStats();
  }, []);

  // 处理表格变化
  const handleTableChange = (pagination, filters, sorter) => {
    fetchUsers({
      page: pagination.current,
      pageSize: pagination.pageSize,
      sortField: sorter.field,
      sortOrder: sorter.order,
    });
  };

  // 导出用户数据
  const handleExport = async () => {
    try {
      setLoading(true);
      // 准备导出参数
      const exportFilters = {
        keyword: filters.keyword,
        status: filters.status !== 'all' ? filters.status : undefined,
        start_date: filters.dateRange?.[0]?.format('YYYY-MM-DD'),
        end_date: filters.dateRange?.[1]?.format('YYYY-MM-DD'),
      };

      // 调用API导出数据
      const result = await exportUsers(exportFilters);

      if (result.data && result.data.length > 0) {
        // 准备导出数据
        const exportData = result.data.map(user => ({
          用户名: user.username,
          邮箱: user.email,
          手机号: user.phone || '',
          状态: user.status === 'active' ? '活跃' : (user.status === 'inactive' ? '禁用' : '封禁'),
          注册时间: user.date_joined,
          最后登录: user.last_login || '',
          笔记数量: user.note_count,
          画布数量: user.canvas_count,
          登录次数: user.login_count
        }));

        // 导出Excel
        exportToExcel(exportData, '用户列表');
        message.success(result.message || '导出成功');
      } else {
        message.info('没有符合条件的数据可导出');
      }
    } catch (error) {
      console.error('导出失败:', error);
      message.error('导出失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 刷新数据
  const handleRefresh = () => {
    fetchUsers();
    fetchUserStats();
    message.success('数据已刷新');
  };

  // 同步用户数据
  const handleSyncUsers = async () => {
    try {
      setLoading(true);
      const result = await syncUsers({ incremental: true });
      message.success('用户数据同步成功');
      fetchUsers();
      fetchUserStats();
    } catch (error) {
      console.error('同步用户数据失败:', error);
      message.error('同步用户数据失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 处理搜索
  const handleSearch = () => {
    setPagination({ ...pagination, current: 1 });
    fetchUsers({ page: 1 });
  };

  // 处理重置
  const handleReset = () => {
    setFilters({
      keyword: '',
      status: 'all',
      dateRange: null,
    });
    setPagination({ ...pagination, current: 1 });
    fetchUsers({ page: 1 });
  };

  // 处理删除用户
  const handleDelete = async (id) => {
    try {
      await deleteUser(id);
      message.success('删除用户成功');
      fetchUsers();
    } catch (error) {
      console.error('删除用户失败:', error);
      message.error('删除用户失败，请稍后重试');
    }
  };

  // 处理更新用户状态
  const handleUpdateStatus = async (id, status) => {
    try {
      await updateUserStatus(id, status);
      message.success(`${status === 'active' ? '启用' : '禁用'}用户成功`);
      fetchUsers();
    } catch (error) {
      console.error('更新用户状态失败:', error);
      message.error('更新用户状态失败，请稍后重试');
    }
  };

  // 表格列定义
  const columns = [
    {
      title: '用户信息',
      dataIndex: 'username',
      key: 'username',
      width: 250,
      render: (text, record) => (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <Avatar
            size={40}
            icon={<UserOutlined />}
            src={record.avatar}
            style={{ marginRight: 12 }}
          />
          <div>
            <div>
              <a
                onClick={() => navigate(`/users/detail/${record.id}`)}
                style={{ fontWeight: 'bold' }}
              >
                {text}
              </a>
              {record.isEmailVerified && (
                <Tooltip title="邮箱已验证">
                  <Badge status="success" style={{ marginLeft: 8 }} />
                </Tooltip>
              )}
            </div>
            <div style={{ fontSize: 12, color: '#999' }}>
              {record.nickname || ''}
            </div>
          </div>
        </div>
      ),
    },
    {
      title: '联系方式',
      dataIndex: 'contact',
      key: 'contact',
      width: 250,
      render: (_, record) => (
        <div>
          <div>
            <MailOutlined style={{ marginRight: 8, color: '#1890ff' }} />
            {record.email}
          </div>
          {record.phone && (
            <div style={{ marginTop: 4 }}>
              <PhoneOutlined style={{ marginRight: 8, color: '#52c41a' }} />
              {record.phone}
            </div>
          )}
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (status) => {
        let color = 'default';
        let text = '未知';

        if (status === 'active') {
          color = 'success';
          text = '活跃';
        } else if (status === 'inactive') {
          color = 'error';
          text = '禁用';
        } else if (status === 'banned') {
          color = 'warning';
          text = '封禁';
        }

        return <Badge status={color} text={text} />;
      },
      filters: [
        { text: '活跃', value: 'active' },
        { text: '禁用', value: 'inactive' },
        { text: '封禁', value: 'banned' },
      ],
    },
    {
      title: '注册时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 180,
      sorter: true,
    },
    {
      title: '最后登录',
      dataIndex: 'lastLoginAt',
      key: 'lastLoginAt',
      width: 180,
      sorter: true,
      render: (text) => text || '从未登录',
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      fixed: 'right',
      render: (_, record) => (
        <Space size="middle">
          <Tooltip title="查看详情">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => navigate(`/users/detail/${record.id}`)}
            />
          </Tooltip>
          <Tooltip title="编辑用户">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => navigate(`/users/edit/${record.id}`)}
            />
          </Tooltip>
          {record.status === 'active' ? (
            <Tooltip title="禁用用户">
              <Popconfirm
                title="确定要禁用该用户吗？"
                description="禁用后用户将无法登录系统"
                onConfirm={() => handleUpdateStatus(record.id, 'inactive')}
                okText="确定"
                cancelText="取消"
                okButtonProps={{ danger: true }}
              >
                <Button type="text" danger icon={<LockOutlined />} />
              </Popconfirm>
            </Tooltip>
          ) : (
            <Tooltip title="启用用户">
              <Popconfirm
                title="确定要启用该用户吗？"
                description="启用后用户可以正常登录系统"
                onConfirm={() => handleUpdateStatus(record.id, 'active')}
                okText="确定"
                cancelText="取消"
              >
                <Button type="text" icon={<UnlockOutlined />} />
              </Popconfirm>
            </Tooltip>
          )}
          <Tooltip title="删除用户">
            <Popconfirm
              title="确定要删除该用户吗？"
              description="此操作不可恢复，用户的所有数据将被删除"
              onConfirm={() => handleDelete(record.id)}
              okText="确定"
              cancelText="取消"
              okButtonProps={{ danger: true }}
            >
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className="user-list-container">
      <PageHeader
        title="用户管理"
        subTitle="管理系统用户账户"
        breadcrumb={[
          { title: '首页', path: '/' },
          { title: '用户管理' }
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
            key="sync"
            icon={<SyncOutlined />}
            onClick={handleSyncUsers}
            loading={loading}
          >
            同步用户
          </Button>,
          <Button
            key="refresh"
            icon={<ReloadOutlined />}
            onClick={handleRefresh}
          >
            刷新
          </Button>,
          <Button
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/users/create')}
          >
            创建用户
          </Button>,
        ]}
      />

      <Row gutter={24} className="stats-row">
        <Col span={6}>
          <Card className="user-stat-card" loading={statsLoading}>
            <div className="user-stat-icon" style={{ backgroundColor: 'rgba(67, 97, 238, 0.1)' }}>
              <UserOutlined style={{ color: '#4361EE' }} />
            </div>
            <div className="user-stat-content">
              <div className="user-stat-title">总用户数</div>
              <div className="user-stat-value">{stats.totalUsers}</div>
              <div className="user-stat-footer">
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
          <Card className="user-stat-card" loading={statsLoading}>
            <div className="user-stat-icon" style={{ backgroundColor: 'rgba(76, 201, 240, 0.1)' }}>
              <UserSwitchOutlined style={{ color: '#4CC9F0' }} />
            </div>
            <div className="user-stat-content">
              <div className="user-stat-title">活跃用户</div>
              <div className="user-stat-value">{stats.activeUsers}</div>
              <div className="user-stat-footer">
                <Badge
                  count={`${Math.round((stats.activeUsers / (stats.totalUsers || 1)) * 100)}%`}
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
          <Card className="user-stat-card" loading={statsLoading}>
            <div className="user-stat-icon" style={{ backgroundColor: 'rgba(247, 37, 133, 0.1)' }}>
              <LockOutlined style={{ color: '#F72585' }} />
            </div>
            <div className="user-stat-content">
              <div className="user-stat-title">禁用用户</div>
              <div className="user-stat-value">{stats.inactiveUsers}</div>
              <div className="user-stat-footer">
                <Badge
                  count={`${Math.round((stats.inactiveUsers / (stats.totalUsers || 1)) * 100)}%`}
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
        <Col span={6}>
          <Card className="user-stat-card" loading={statsLoading}>
            <div className="user-stat-icon" style={{ backgroundColor: 'rgba(58, 12, 163, 0.1)' }}>
              <PlusOutlined style={{ color: '#3A0CA3' }} />
            </div>
            <div className="user-stat-content">
              <div className="user-stat-title">今日注册</div>
              <div className="user-stat-value">{stats.todayNewUsers}</div>
              <div className="user-stat-footer">
                <Badge
                  count="新增用户"
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
                Modal.confirm({
                  title: '批量启用用户',
                  content: `确定要启用选中的 ${selectedRowKeys.length} 个用户吗？`,
                  onOk: async () => {
                    try {
                      setLoading(true);
                      const result = await batchActivateUsers(selectedRowKeys);
                      message.success(result.message || `已成功启用 ${result.activated_count} 个用户`);
                      setSelectedRowKeys([]);
                      setSelectedRows([]);
                      fetchUsers();
                      fetchUserStats();
                    } catch (error) {
                      console.error('批量启用失败:', error);
                      message.error('批量启用失败，请稍后重试');
                    } finally {
                      setLoading(false);
                    }
                  }
                });
              }}
              icon={<UnlockOutlined />}
            >
              批量启用
            </Button>
            <Button
              onClick={() => {
                Modal.confirm({
                  title: '批量禁用用户',
                  content: `确定要禁用选中的 ${selectedRowKeys.length} 个用户吗？`,
                  okButtonProps: { danger: true },
                  onOk: async () => {
                    try {
                      setLoading(true);
                      const result = await batchDeactivateUsers(selectedRowKeys);
                      message.success(result.message || `已成功禁用 ${result.deactivated_count} 个用户`);
                      setSelectedRowKeys([]);
                      setSelectedRows([]);
                      fetchUsers();
                      fetchUserStats();
                    } catch (error) {
                      console.error('批量禁用失败:', error);
                      message.error('批量禁用失败，请稍后重试');
                    } finally {
                      setLoading(false);
                    }
                  }
                });
              }}
              icon={<LockOutlined />}
              danger
            >
              批量禁用
            </Button>
            <Button
              onClick={() => {
                Modal.confirm({
                  title: '批量删除用户',
                  content: `确定要删除选中的 ${selectedRowKeys.length} 个用户吗？此操作不可恢复！`,
                  okButtonProps: { danger: true },
                  onOk: async () => {
                    try {
                      setLoading(true);
                      const result = await batchDeleteUsers(selectedRowKeys);
                      message.success(result.message || `已成功删除 ${result.deleted_count} 个用户`);
                      setSelectedRowKeys([]);
                      setSelectedRows([]);
                      fetchUsers();
                      fetchUserStats();
                    } catch (error) {
                      console.error('批量删除失败:', error);
                      message.error('批量删除失败，请稍后重试');
                    } finally {
                      setLoading(false);
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
              onClick={async () => {
                // 导出选中用户数据
                try {
                  setLoading(true);
                  // 调用API导出选中用户数据
                  const result = await exportUsers({}, selectedRowKeys);

                  if (result.data && result.data.length > 0) {
                    // 准备导出数据
                    const exportData = result.data.map(user => ({
                      用户名: user.username,
                      邮箱: user.email,
                      手机号: user.phone || '',
                      状态: user.status === 'active' ? '活跃' : (user.status === 'inactive' ? '禁用' : '封禁'),
                      注册时间: user.date_joined,
                      最后登录: user.last_login || '',
                      笔记数量: user.note_count,
                      画布数量: user.canvas_count,
                      登录次数: user.login_count
                    }));

                    // 导出Excel
                    exportToExcel(exportData, '选中用户列表');
                    message.success(result.message || '导出成功');
                  } else {
                    message.info('没有符合条件的数据可导出');
                  }
                } catch (error) {
                  console.error('导出失败:', error);
                  message.error('导出失败，请稍后重试');
                } finally {
                  setLoading(false);
                }
              }}
              icon={<ExportOutlined />}
            >
              导出选中
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

      <div className="user-search-form">
        <Row gutter={24} align="middle">
          <Col span={8}>
            <Input
              placeholder="搜索用户名/邮箱/手机号"
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
              placeholder="用户状态"
              value={filters.status}
              onChange={(value) => setFilters({ ...filters, status: value })}
              style={{ width: '100%' }}
              size="large"
              dropdownStyle={{ borderRadius: '10px' }}
            >
              <Option value="all">全部状态</Option>
              <Option value="active">活跃</Option>
              <Option value="inactive">禁用</Option>
              <Option value="banned">封禁</Option>
            </Select>
          </Col>
          <Col span={8}>
            <RangePicker
              value={filters.dateRange}
              onChange={(dates) => setFilters({ ...filters, dateRange: dates })}
              style={{ width: '100%' }}
              placeholder={['注册开始日期', '注册结束日期']}
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

      <Card className="user-table-card">
        <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(0, 0, 0, 0.05)' }}>
          <Space size={16}>
            <Typography.Title level={5} style={{ margin: 0 }}>用户列表</Typography.Title>
            <Typography.Text type="secondary">共 {pagination.total} 条记录</Typography.Text>
          </Space>
        </div>
        <Table
          columns={columns}
          dataSource={users}
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
            },
            selections: [
              Table.SELECTION_ALL,
              Table.SELECTION_INVERT,
              {
                key: 'active',
                text: '选择所有活跃用户',
                onSelect: changableRowKeys => {
                  let newSelectedRowKeys = [];
                  users.forEach((user, index) => {
                    if (user.status === 'active') {
                      newSelectedRowKeys.push(user.id);
                    }
                  });
                  return newSelectedRowKeys;
                },
              },
              {
                key: 'inactive',
                text: '选择所有禁用用户',
                onSelect: changableRowKeys => {
                  let newSelectedRowKeys = [];
                  users.forEach((user, index) => {
                    if (user.status === 'inactive') {
                      newSelectedRowKeys.push(user.id);
                    }
                  });
                  return newSelectedRowKeys;
                },
              },
            ],
          }}
        />
      </Card>
    </div>
  );
};

export default UserList;
