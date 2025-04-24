import React, { useState, useEffect } from 'react';
import { Table, Card, Button, Space, Input, Modal, Form, message, Typography, Popconfirm, Tag, Select, Avatar } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ExclamationCircleOutlined, UserOutlined, LockOutlined } from '@ant-design/icons';
import { getAdmins, createAdmin, updateAdmin, deleteAdmin, getRoles } from '../../services/settingsService';

const { Title, Text } = Typography;
const { confirm } = Modal;
const { Option } = Select;

const AdminManagement = () => {
  const [admins, setAdmins] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [passwordModalVisible, setPasswordModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [editingAdmin, setEditingAdmin] = useState(null);
  const [form] = Form.useForm();
  const [passwordForm] = Form.useForm();
  const [searchText, setSearchText] = useState('');
  
  // 获取管理员列表
  const fetchAdmins = async () => {
    try {
      setLoading(true);
      const data = await getAdmins();
      setAdmins(data);
    } catch (error) {
      console.error('获取管理员列表失败:', error);
      message.error('获取管理员列表失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };
  
  // 获取角色列表
  const fetchRoles = async () => {
    try {
      const data = await getRoles();
      setRoles(data);
    } catch (error) {
      console.error('获取角色列表失败:', error);
      message.error('获取角色列表失败，请稍后重试');
    }
  };
  
  useEffect(() => {
    fetchAdmins();
    fetchRoles();
  }, []);
  
  // 打开创建管理员模态框
  const showCreateModal = () => {
    setModalTitle('创建管理员');
    setEditingAdmin(null);
    form.resetFields();
    setModalVisible(true);
  };
  
  // 打开编辑管理员模态框
  const showEditModal = (admin) => {
    setModalTitle('编辑管理员');
    setEditingAdmin(admin);
    form.setFieldsValue({
      username: admin.username,
      email: admin.email,
      roleId: admin.roleId,
      isActive: admin.isActive,
    });
    setModalVisible(true);
  };
  
  // 打开重置密码模态框
  const showPasswordModal = (admin) => {
    setEditingAdmin(admin);
    passwordForm.resetFields();
    setPasswordModalVisible(true);
  };
  
  // 处理模态框确认
  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      
      if (editingAdmin) {
        // 更新管理员
        await updateAdmin(editingAdmin.id, values);
        message.success('更新管理员成功');
      } else {
        // 创建管理员
        await createAdmin(values);
        message.success('创建管理员成功');
      }
      
      setModalVisible(false);
      fetchAdmins();
    } catch (error) {
      console.error('保存管理员失败:', error);
      message.error('保存管理员失败，请稍后重试');
    }
  };
  
  // 处理重置密码
  const handlePasswordOk = async () => {
    try {
      const values = await passwordForm.validateFields();
      
      // 确认两次密码输入一致
      if (values.password !== values.confirmPassword) {
        message.error('两次输入的密码不一致');
        return;
      }
      
      // 更新管理员密码
      await updateAdmin(editingAdmin.id, { password: values.password });
      message.success('重置密码成功');
      setPasswordModalVisible(false);
    } catch (error) {
      console.error('重置密码失败:', error);
      message.error('重置密码失败，请稍后重试');
    }
  };
  
  // 处理删除管理员
  const handleDelete = async (id) => {
    try {
      await deleteAdmin(id);
      message.success('删除管理员成功');
      fetchAdmins();
    } catch (error) {
      console.error('删除管理员失败:', error);
      message.error('删除管理员失败，请稍后重试');
    }
  };
  
  // 表格列定义
  const columns = [
    {
      title: '用户名',
      dataIndex: 'username',
      key: 'username',
      render: (text, record) => (
        <Space>
          <Avatar icon={<UserOutlined />} src={record.avatar} />
          {text}
        </Space>
      ),
    },
    {
      title: '邮箱',
      dataIndex: 'email',
      key: 'email',
    },
    {
      title: '角色',
      dataIndex: 'role',
      key: 'role',
      render: (role) => role?.name || '-',
    },
    {
      title: '状态',
      dataIndex: 'isActive',
      key: 'isActive',
      render: (isActive) => (
        <Tag color={isActive ? 'green' : 'red'}>
          {isActive ? '活跃' : '禁用'}
        </Tag>
      ),
    },
    {
      title: '最后登录时间',
      dataIndex: 'lastLoginTime',
      key: 'lastLoginTime',
      render: (time) => time || '-',
    },
    {
      title: '最后登录IP',
      dataIndex: 'lastLoginIp',
      key: 'lastLoginIp',
      render: (ip) => ip || '-',
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => showEditModal(record)}
          />
          <Button
            type="text"
            icon={<LockOutlined />}
            onClick={() => showPasswordModal(record)}
          />
          <Popconfirm
            title="确定要删除该管理员吗？"
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
  
  // 过滤管理员
  const filteredAdmins = admins.filter(
    (admin) => 
      admin.username.toLowerCase().includes(searchText.toLowerCase()) ||
      admin.email.toLowerCase().includes(searchText.toLowerCase())
  );
  
  return (
    <div className="admin-management-container">
      <div className="page-header">
        <Title level={3}>管理员管理</Title>
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={showCreateModal}
        >
          创建管理员
        </Button>
      </div>
      
      <Card className="search-card">
        <Input.Search
          placeholder="搜索用户名/邮箱"
          allowClear
          enterButton="搜索"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ width: 300 }}
        />
      </Card>
      
      <Table
        columns={columns}
        dataSource={filteredAdmins}
        rowKey="id"
        loading={loading}
        pagination={{ pageSize: 10 }}
      />
      
      {/* 创建/编辑管理员模态框 */}
      <Modal
        title={modalTitle}
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={() => setModalVisible(false)}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
        >
          <Form.Item
            name="username"
            label="用户名"
            rules={[{ required: true, message: '请输入用户名' }]}
          >
            <Input placeholder="请输入用户名" />
          </Form.Item>
          <Form.Item
            name="email"
            label="邮箱"
            rules={[
              { required: true, message: '请输入邮箱' },
              { type: 'email', message: '请输入有效的邮箱地址' },
            ]}
          >
            <Input placeholder="请输入邮箱" />
          </Form.Item>
          {!editingAdmin && (
            <Form.Item
              name="password"
              label="密码"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password placeholder="请输入密码" />
            </Form.Item>
          )}
          <Form.Item
            name="roleId"
            label="角色"
            rules={[{ required: true, message: '请选择角色' }]}
          >
            <Select placeholder="请选择角色">
              {roles.map((role) => (
                <Option key={role.id} value={role.id}>
                  {role.name}
                </Option>
              ))}
            </Select>
          </Form.Item>
          <Form.Item
            name="isActive"
            label="状态"
            valuePropName="checked"
            initialValue={true}
          >
            <Select>
              <Option value={true}>活跃</Option>
              <Option value={false}>禁用</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
      
      {/* 重置密码模态框 */}
      <Modal
        title="重置密码"
        open={passwordModalVisible}
        onOk={handlePasswordOk}
        onCancel={() => setPasswordModalVisible(false)}
        destroyOnClose
      >
        <Form
          form={passwordForm}
          layout="vertical"
        >
          <Form.Item
            name="password"
            label="新密码"
            rules={[{ required: true, message: '请输入新密码' }]}
          >
            <Input.Password placeholder="请输入新密码" />
          </Form.Item>
          <Form.Item
            name="confirmPassword"
            label="确认密码"
            rules={[{ required: true, message: '请确认新密码' }]}
          >
            <Input.Password placeholder="请确认新密码" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default AdminManagement;
