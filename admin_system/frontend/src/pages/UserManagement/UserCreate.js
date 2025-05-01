import React, { useState } from 'react';
import { Form, Input, Button, Card, Select, message, Row, Col, Avatar, Upload, Switch, Divider } from 'antd';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftOutlined, UserOutlined, UploadOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { createUser } from '../../services/userService';
import { PageHeader } from '../../components/common';

const { Option } = Select;
const { TextArea } = Input;

const UserCreate = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const [avatarUrl, setAvatarUrl] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (values) => {
    try {
      setLoading(true);

      // 准备提交的数据
      const userData = {
        ...values,
        avatar: avatarUrl, // 包含头像URL
      };

      // 删除确认密码字段，不需要发送到后端
      delete userData.confirm_password;

      await createUser(userData);
      message.success('用户创建成功');
      navigate('/users');
    } catch (error) {
      console.error('创建用户失败:', error);
      message.error('创建用户失败: ' + (error.message || '未知错误'));
    } finally {
      setLoading(false);
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

  const handleBack = () => {
    navigate('/users');
  };

  return (
    <div className="user-create-container">
      <PageHeader
        title="创建新用户"
        subTitle="添加新的用户账户"
        backButton={true}
        onBack={handleBack}
        breadcrumb={[
          { title: '首页', path: '/' },
          { title: '用户管理', path: '/users' },
          { title: '创建用户' }
        ]}
      />

      <Card className="create-card">
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
          initialValues={{
            status: 'active',
            isEmailVerified: false,
            isPhoneVerified: false,
          }}
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
                  <Button icon={<UploadOutlined />}>上传头像</Button>
                </Upload>
              </div>

              <Card title="账户说明" size="small" className="info-card">
                <p><InfoCircleOutlined /> 创建用户后，系统将自动向用户邮箱发送激活邮件。</p>
                <p><InfoCircleOutlined /> 用户名一旦创建不可修改，请谨慎填写。</p>
                <p><InfoCircleOutlined /> 密码必须包含字母、数字和特殊字符，长度至少6位。</p>
              </Card>
            </Col>

            <Col span={18}>
              <Divider orientation="left">基本信息</Divider>
              <Row gutter={24}>
                <Col span={12}>
                  <Form.Item
                    name="username"
                    label="用户名"
                    rules={[
                      { required: true, message: '请输入用户名' },
                      { min: 3, message: '用户名至少3个字符' },
                      { pattern: /^[a-zA-Z0-9_]+$/, message: '用户名只能包含字母、数字和下划线' },
                    ]}
                  >
                    <Input placeholder="请输入用户名" />
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
              </Row>

              <Divider orientation="left">安全信息</Divider>
              <Row gutter={24}>
                <Col span={12}>
                  <Form.Item
                    name="password"
                    label="密码"
                    rules={[
                      { required: true, message: '请输入密码' },
                      { min: 6, message: '密码至少6个字符' },
                    ]}
                  >
                    <Input.Password placeholder="请输入密码" />
                  </Form.Item>
                </Col>

                <Col span={12}>
                  <Form.Item
                    name="confirm_password"
                    label="确认密码"
                    dependencies={['password']}
                    rules={[
                      { required: true, message: '请确认密码' },
                      ({ getFieldValue }) => ({
                        validator(_, value) {
                          if (!value || getFieldValue('password') === value) {
                            return Promise.resolve();
                          }
                          return Promise.reject(new Error('两次输入的密码不一致'));
                        },
                      }),
                    ]}
                  >
                    <Input.Password placeholder="请确认密码" />
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

              <Divider orientation="left">其他信息</Divider>
              <Row gutter={24}>
                <Col span={24}>
                  <Form.Item
                    name="bio"
                    label="个人简介"
                  >
                    <TextArea rows={4} placeholder="请输入个人简介" />
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item>
                <Button type="primary" htmlType="submit" size="large" loading={loading}>
                  创建用户
                </Button>
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Card>
    </div>
  );
};

export default UserCreate;
