import React, { useState, useEffect } from 'react';
import {
  Table, Input, Button, Space, Tag, Popconfirm, message,
  Card, Select, DatePicker, Row, Col, Tooltip, Avatar,
  Typography, Divider, Badge, Statistic, Dropdown, Menu,
  Modal, Upload
} from 'antd';
import {
  SearchOutlined, EditOutlined, DeleteOutlined, EyeOutlined,
  LockOutlined, UnlockOutlined, UserOutlined, PlusOutlined,
  ReloadOutlined, DownloadOutlined, UserSwitchOutlined,
  MailOutlined, PhoneOutlined, ExportOutlined, FilterOutlined,
  MoreOutlined, ImportOutlined, SettingOutlined, SyncOutlined,
  UploadOutlined, InboxOutlined
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
  exportUsers,
  importUsers
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
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importLoading, setImportLoading] = useState(false);

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

  // 处理导入模态框显示
  const showImportModal = () => {
    setImportModalVisible(true);
    setImportFile(null);
  };

  // 处理导入模态框关闭
  const handleImportCancel = () => {
    setImportModalVisible(false);
    setImportFile(null);
  };

  // 处理文件上传前的检查
  const beforeUpload = (file) => {
    // 检查文件类型
    const isJSON = file.type === 'application/json';
    const isCSV = file.type === 'text/csv';
    const isExcel = file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' ||
                   file.type === 'application/vnd.ms-excel';

    if (!isJSON && !isCSV && !isExcel) {
      message.error('只支持上传JSON、CSV或Excel文件!');
      return Upload.LIST_IGNORE;
    }

    // 检查文件大小
    const isLt2M = file.size / 1024 / 1024 < 2;
    if (!isLt2M) {
      message.error('文件大小不能超过2MB!');
      return Upload.LIST_IGNORE;
    }

    // 保存文件
    setImportFile(file);
    return false; // 阻止自动上传
  };

  // 处理用户导入
  const handleImportUsers = async () => {
    if (!importFile) {
      message.error('请先选择要导入的文件');
      return;
    }

    setImportLoading(true);

    try {
      // 读取文件内容
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          let usersData;

          // 根据文件类型解析数据
          if (importFile.type === 'application/json') {
            usersData = JSON.parse(e.target.result);
          } else {
            // 对于CSV和Excel文件，这里需要更复杂的解析逻辑
            // 简化处理，假设已经解析为JSON格式
            message.error('暂不支持CSV和Excel格式，请使用JSON格式');
            setImportLoading(false);
            return;
          }

          // 检查数据格式
          if (!Array.isArray(usersData)) {
            usersData = [usersData]; // 如果不是数组，转换为数组
          }

          // 调用API导入用户
          const result = await importUsers(usersData);

          // 显示导入结果
          Modal.success({
            title: '导入完成',
            content: (
              <div>
                <p>成功导入 {result.imported_count} 个新用户</p>
                <p>更新 {result.updated_count} 个现有用户</p>
                {result.failed_count > 0 && (
                  <p>失败 {result.failed_count} 个用户</p>
                )}
              </div>
            ),
          });

          // 刷新用户列表和统计数据
          fetchUsers();
          fetchUserStats();

          // 关闭模态框
          setImportModalVisible(false);
          setImportFile(null);
        } catch (error) {
          console.error('解析文件失败:', error);
          message.error('解析文件失败，请检查文件格式');
        } finally {
          setImportLoading(false);
        }
      };

      reader.onerror = () => {
        message.error('读取文件失败');
        setImportLoading(false);
      };

      reader.readAsText(importFile);
    } catch (error) {
      console.error('导入用户失败:', error);
      message.error('导入用户失败，请稍后重试');
      setImportLoading(false);
    }
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
            key="import"
            icon={<ImportOutlined />}
            onClick={showImportModal}
          >
            导入
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

      {/* 导入用户模态框 */}
      <Modal
        title="导入用户"
        open={importModalVisible}
        onCancel={handleImportCancel}
        footer={[
          <Button key="cancel" onClick={handleImportCancel}>
            取消
          </Button>,
          <Button
            key="import"
            type="primary"
            onClick={handleImportUsers}
            loading={importLoading}
            disabled={!importFile}
          >
            导入
          </Button>,
        ]}
      >
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <Upload.Dragger
            name="file"
            beforeUpload={beforeUpload}
            showUploadList={false}
            accept=".json,.csv,.xlsx,.xls"
          >
            <p className="ant-upload-drag-icon">
              <InboxOutlined />
            </p>
            <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
            <p className="ant-upload-hint">
              支持JSON、CSV或Excel格式，文件大小不超过2MB
            </p>
          </Upload.Dragger>

          {importFile && (
            <div style={{ marginTop: 16 }}>
              <Tag color="blue" icon={<UploadOutlined />}>
                已选择文件: {importFile.name}
              </Tag>
            </div>
          )}

          <div style={{ marginTop: 16, textAlign: 'left' }}>
            <Typography.Title level={5}>导入说明:</Typography.Title>
            <Typography.Paragraph>
              1. JSON文件格式示例:
              <pre style={{ background: '#f5f5f5', padding: 10, borderRadius: 4 }}>
                {JSON.stringify([
                  {
                    username: 'user1',
                    email: 'user1@example.com',
                    phone: '13800138001',
                    nickname: '用户1',
                    status: 'active'
                  }
                ], null, 2)}
              </pre>
            </Typography.Paragraph>
            <Typography.Paragraph>
              2. 必填字段: username (用户名)
            </Typography.Paragraph>
            <Typography.Paragraph>
              3. 可选字段: email (邮箱), phone (手机号), nickname (昵称),
              status (状态: active/inactive/banned), is_active (是否激活),
              avatar (头像URL), bio (个人简介)
            </Typography.Paragraph>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default UserList;
