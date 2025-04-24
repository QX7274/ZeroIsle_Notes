import React, { useState, useEffect } from 'react';
import { Table, Input, Button, Space, Tag, Popconfirm, message, Card, Select, DatePicker } from 'antd';
import { SearchOutlined, EditOutlined, DeleteOutlined, EyeOutlined, LockOutlined, UnlockOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getUsers, deleteUser, updateUserStatus } from '../../services/userService';

const { RangePicker } = DatePicker;
const { Option } = Select;

const UserList = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });
  const [filters, setFilters] = useState({
    keyword: '',
    status: 'all',
    dateRange: null,
  });
  
  const navigate = useNavigate();

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
      });
      
      setUsers(response.data);
      setPagination({
        ...pagination,
        current: params.page || pagination.current,
        pageSize: params.pageSize || pagination.pageSize,
        total: response.total,
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
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      render: (text, record) => (
        <a onClick={() => navigate(`/users/detail/${record.id}`)}>{text}</a>
      ),
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: '手机号',
      dataIndex: 'phone',
      key: 'phone',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={status === 'active' ? 'green' : 'red'}>
          {status === 'active' ? '活跃' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '注册时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      sorter: true,
    },
    {
      title: '最后登录',
      dataIndex: 'lastLoginAt',
      key: 'lastLoginAt',
      sorter: true,
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/users/detail/${record.id}`)}
          />
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => navigate(`/users/edit/${record.id}`)}
          />
          {record.status === 'active' ? (
            <Popconfirm
              title="确定要禁用该用户吗？"
              onConfirm={() => handleUpdateStatus(record.id, 'inactive')}
              okText="确定"
              cancelText="取消"
            >
              <Button type="text" danger icon={<LockOutlined />} />
            </Popconfirm>
          ) : (
            <Popconfirm
              title="确定要启用该用户吗？"
              onConfirm={() => handleUpdateStatus(record.id, 'active')}
              okText="确定"
              cancelText="取消"
            >
              <Button type="text" icon={<UnlockOutlined />} />
            </Popconfirm>
          )}
          <Popconfirm
            title="确定要删除该用户吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="user-list-container">
      <Card className="search-card">
        <Space wrap>
          <Input
            placeholder="搜索用户名/邮箱/手机号"
            value={filters.keyword}
            onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
            style={{ width: 250 }}
            allowClear
          />
          <Select
            placeholder="用户状态"
            value={filters.status}
            onChange={(value) => setFilters({ ...filters, status: value })}
            style={{ width: 120 }}
          >
            <Option value="all">全部状态</Option>
            <Option value="active">活跃</Option>
            <Option value="inactive">禁用</Option>
          </Select>
          <RangePicker
            value={filters.dateRange}
            onChange={(dates) => setFilters({ ...filters, dateRange: dates })}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
            搜索
          </Button>
          <Button onClick={handleReset}>重置</Button>
        </Space>
      </Card>

      <Table
        columns={columns}
        dataSource={users}
        rowKey="id"
        pagination={pagination}
        loading={loading}
        onChange={handleTableChange}
      />
    </div>
  );
};

export default UserList;
