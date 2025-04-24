import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Card, message, Typography, Space, Checkbox, Alert, Divider } from 'antd';
import { UserOutlined, LockOutlined, SafetyOutlined, GithubOutlined } from '@ant-design/icons';
import { login } from '../services/authService';
import { Loading } from '../components/feedback';
import { FadeIn, Pulse } from '../components/animations';
import '../styles/Login.css';

const { Title } = Typography;

const Login = ({ setIsAuthenticated }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [systemInfo, setSystemInfo] = useState({
    name: '零屿笔记管理系统',
    version: 'v1.0.0',
    year: new Date().getFullYear()
  });
  const [pageLoading, setPageLoading] = useState(true);

  // 模拟页面加载
  useEffect(() => {
    const timer = setTimeout(() => {
      setPageLoading(false);
    }, 1000);

    return () => clearTimeout(timer);
  }, []);

  const onFinish = async (values) => {
    try {
      setLoading(true);
      setError('');
      const response = await login(values.username, values.password);

      if (response.success) {
        localStorage.setItem('adminToken', response.token);
        localStorage.setItem('adminUser', JSON.stringify(response.user));

        if (values.remember) {
          localStorage.setItem('adminRemember', values.username);
        } else {
          localStorage.removeItem('adminRemember');
        }

        message.success('登录成功，欢迎回来！');
        setIsAuthenticated(true);
      } else {
        setError(response.message || '登录失败，请检查用户名和密码');
      }
    } catch (error) {
      console.error('登录错误:', error);
      setError('登录失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 获取记住的用户名
  const rememberedUsername = localStorage.getItem('adminRemember');

  if (pageLoading) {
    return (
      <Loading
        tip="系统加载中..."
        className="login-loading"
        height={window.innerHeight}
      />
    );
  }

  return (
    <div className="login-container">
      <div className="login-background"></div>
      <FadeIn duration={800}>
        <Card className="login-card">
          <div className="login-header">
            <Pulse scale={1.05} duration={3}>
              <div className="login-logo">
                <img src="/images/logo.svg" alt="Logo" />
              </div>
            </Pulse>
            <Title level={2}>{systemInfo.name}</Title>
            <p className="login-subtitle">管理员登录</p>
          </div>

          {error && (
            <Alert
              message="登录失败"
              description={error}
              type="error"
              showIcon
              closable
              style={{ marginBottom: 24 }}
            />
          )}

          <Form
            name="login"
            initialValues={{
              remember: !!rememberedUsername,
              username: rememberedUsername || '',
            }}
            onFinish={onFinish}
            size="large"
            layout="vertical"
          >
            <Form.Item
              name="username"
              rules={[{ required: true, message: '请输入用户名' }]}
            >
              <Input
                prefix={<UserOutlined className="site-form-item-icon" />}
                placeholder="用户名"
                autoComplete="username"
              />
            </Form.Item>

            <Form.Item
              name="password"
              rules={[{ required: true, message: '请输入密码' }]}
            >
              <Input.Password
                prefix={<LockOutlined className="site-form-item-icon" />}
                placeholder="密码"
                autoComplete="current-password"
              />
            </Form.Item>

            <Form.Item>
              <Form.Item name="remember" valuePropName="checked" noStyle>
                <Checkbox>记住用户名</Checkbox>
              </Form.Item>

              <a className="login-form-forgot" href="#forgot">
                忘记密码?
              </a>
            </Form.Item>

            <Form.Item>
              <Button
                type="primary"
                htmlType="submit"
                className="login-button"
                loading={loading}
                block
              >
                登录
              </Button>
            </Form.Item>
          </Form>

          <Divider>
            <span className="login-divider-text">其他登录方式</span>
          </Divider>

          <div className="login-other-methods">
            <Button type="link" icon={<GithubOutlined />} size="large" />
            <Button type="link" icon={<SafetyOutlined />} size="large" />
          </div>

          <div className="login-footer">
            <p>© {systemInfo.year} 零屿笔记. 保留所有权利.</p>
            <p className="login-version">{systemInfo.version}</p>
          </div>
        </Card>
      </FadeIn>
    </div>
  );
};

export default Login;
