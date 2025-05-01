import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Card, Select, Spin, message, Row, Col, Avatar, Upload, Switch } from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeftOutlined, UserOutlined, UploadOutlined, LockOutlined } from '@ant-design/icons';
import { getUserDetail, updateUser, resetUserPassword } from '../../services/userService';
import { PageHeader } from '../../components/common';

const { Option } = Select;
const { TextArea } = Input;

const UserEdit = () => {
  const { id } = useParams();
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  const [avatarUrl, setAvatarUrl] = useState('');
  const [resetPasswordVisible, setResetPasswordVisible] = useState(false);
  const [resetPasswordForm] = Form.useForm();

  useEffect(() => {
    const fetchUser = async () => {
      try {
        setLoading(true);
        const userData = await getUserDetail(id);

        // 设置表单字段值
        form.setFieldsValue({
          username: userData.username,
          email: userData.email,
          phone: userData.phone,
          nickname: userData.nickname || '',
          status: userData.status,
          bio: userData.bio || '',
          isEmailVerified: userData.isEmailVerified || false,
          isPhoneVerified: userData.isPhoneVerified || false,
        });

        // 设置头像URL
        if (userData.avatar) {
          setAvatarUrl(userData.avatar);
        }

        setLoading(false);
      } catch (error) {
        console.error('获取用户数据失败:', error);
        message.error('获取用户数据失败');
        setLoading(false);
      }
    };

    fetchUser();
  }, [id, form]);

  const handleSubmit = async (values) => {
    try {
      // 准备提交的数据
      const userData = {
        ...values,
        avatar: avatarUrl, // 包含头像URL
      };

      await updateUser(id, userData);
      message.success('用户更新成功');
      navigate('/users');
    } catch (error) {
      console.error('更新用户失败:', error);
      message.error('更新用户失败');
    }
  };

  // 处理头像上传
  const handleAvatarChange = (info) => {
    if (info.file.status === 'done') {
      // 上传成功，获取URL
      setAvatarUrl(info.file.response.url);
      message.success('头像上传成功');
    } else if (info.file.status === 'error') {
      message.error('头像上传失败');
    }
  };

  // 处理密码重置
  const handleResetPassword = async () => {
    try {
      const values = await resetPasswordForm.validateFields();

      if (values.newPassword !== values.confirmPassword) {
        message.error('两次输入的密码不一致');
        return;
      }

      await resetUserPassword(id, values.newPassword);
      message.success('密码重置成功');
      setResetPasswordVisible(false);
      resetPasswordForm.resetFields();
    } catch (error) {
      console.error('密码重置失败:', error);
      message.error('密码重置失败');
    }
  };

  const handleBack = () => {
    navigate('/users');
  };

  if (loading) {
    return (
      <div className="loading-container">
        <Spin size="large" />
        <p>加载用户数据...</p>
      </div>
    );
  }

  return (
    <div className="user-edit-container">
      <PageHeader
        title={`编辑用户: ${form.getFieldValue('username')}`}
        subTitle="修改用户信息"
        backButton={true}
        onBack={handleBack}
        breadcrumb={[
          { title: '首页', path: '/' },
          { title: '用户管理', path: '/users' },
          { title: '编辑用户' }
        ]}
      />

      <Card className="edit-card">
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Row gutter={24}>
            <Col span={6}>
              <div style={{ textAlign: 'center', marginBottom: 24 }}>
                <Avatar
                  size={120}
                  icon={<UserOutlined />}
                  src={avatarUrl}
                  style={{ marginBottom: 16 }}
                />
                <Upload
                  name="avatar"
                  action="/api/upload/avatar"
                  showUploadList={false}
                  onChange={handleAvatarChange}
                >
                  <Button icon={<UploadOutlined />}>更换头像</Button>
                </Upload>
              </div>

              <Card title="账户安全" size="small" className="security-card">
                <div className="security-item">
                  <div>
                    <LockOutlined /> 密码
                  </div>
                  <Button
                    type="link"
                    onClick={() => setResetPasswordVisible(!resetPasswordVisible)}
                  >
                    重置密码
                  </Button>
                </div>

                {resetPasswordVisible && (
                  <Form
                    form={resetPasswordForm}
                    layout="vertical"
                    style={{ marginTop: 16 }}
                  >
                    <Form.Item
                      name="newPassword"
                      label="新密码"
                      rules={[
                        { required: true, message: '请输入新密码' },
                        { min: 6, message: '密码至少6个字符' }
                      ]}
                    >
                      <Input.Password placeholder="请输入新密码" />
                    </Form.Item>

                    <Form.Item
                      name="confirmPassword"
                      label="确认密码"
                      rules={[
                        { required: true, message: '请确认新密码' },
                        ({ getFieldValue }) => ({
                          validator(_, value) {
                            if (!value || getFieldValue('newPassword') === value) {
                              return Promise.resolve();
                            }
                            return Promise.reject(new Error('两次输入的密码不一致'));
                          },
                        }),
                      ]}
                    >
                      <Input.Password placeholder="请确认新密码" />
                    </Form.Item>

                    <Button type="primary" onClick={handleResetPassword}>
                      确认重置
                    </Button>
                  </Form>
                )}
              </Card>
            </Col>

            <Col span={18}>
              <Row gutter={24}>
                <Col span={12}>
                  <Form.Item
                    name="username"
                    label="用户名"
                  >
                    <Input disabled />
                  </Form.Item>
                </Col>

                <Col span={12}>
                  <Form.Item
                    name="nickname"
                    label="昵称"
                  >
                    <Input placeholder="请输入昵称" />
                  </Form.Item>
                </Col>

                <Col span={12}>
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
                </Col>

                <Col span={12}>
                  <Form.Item
                    name="isEmailVerified"
                    label="邮箱验证状态"
                    valuePropName="checked"
                  >
                    <Switch checkedChildren="已验证" unCheckedChildren="未验证" />
                  </Form.Item>
                </Col>

                <Col span={12}>
                  <Form.Item
                    name="phone"
                    label="手机号"
                  >
                    <Input placeholder="请输入手机号" />
                  </Form.Item>
                </Col>

                <Col span={12}>
                  <Form.Item
                    name="isPhoneVerified"
                    label="手机验证状态"
                    valuePropName="checked"
                  >
                    <Switch checkedChildren="已验证" unCheckedChildren="未验证" />
                  </Form.Item>
                </Col>

                <Col span={24}>
                  <Form.Item
                    name="bio"
                    label="个人简介"
                  >
                    <TextArea rows={4} placeholder="请输入个人简介" />
                  </Form.Item>
                </Col>

                <Col span={12}>
                  <Form.Item
                    name="status"
                    label="账户状态"
                    rules={[{ required: true, message: '请选择状态' }]}
                  >
                    <Select placeholder="请选择状态">
                      <Option value="active">活跃</Option>
                      <Option value="inactive">未激活</Option>
                      <Option value="banned">已禁用</Option>
                    </Select>
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item>
                <Button type="primary" htmlType="submit" size="large">
                  保存修改
                </Button>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>
    </div>
  );
};

export default UserEdit;
