import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Card, Switch, InputNumber, Select, message, Spin, Divider, Typography, Row, Col, Slider } from 'antd';
import { getSecurityConfig, updateSecurityConfig } from '../../services/settingsService';

const { Option } = Select;
const { Title, Text } = Typography;

const SecuritySettings = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // 获取安全配置
  const fetchSecurityConfig = async () => {
    try {
      setLoading(true);
      const data = await getSecurityConfig();
      
      // 设置表单初始值
      form.setFieldsValue({
        passwordMinLength: data.passwordMinLength,
        passwordComplexity: data.passwordComplexity,
        loginAttempts: data.loginAttempts,
        lockoutDuration: data.lockoutDuration,
        sessionTimeout: data.sessionTimeout,
        jwtExpiration: data.jwtExpiration,
        jwtRefreshExpiration: data.jwtRefreshExpiration,
        enableCaptcha: data.enableCaptcha,
        captchaType: data.captchaType,
        twoFactorAuth: data.twoFactorAuth,
        twoFactorAuthType: data.twoFactorAuthType,
        ipWhitelist: data.ipWhitelist?.join('\n'),
        ipBlacklist: data.ipBlacklist?.join('\n'),
        corsAllowedOrigins: data.corsAllowedOrigins?.join('\n'),
        csrfProtection: data.csrfProtection,
        xssProtection: data.xssProtection,
        sqlInjectionProtection: data.sqlInjectionProtection,
        rateLimit: data.rateLimit,
        rateLimitRequests: data.rateLimitRequests,
        rateLimitWindow: data.rateLimitWindow,
      });
    } catch (error) {
      console.error('获取安全配置失败:', error);
      message.error('获取安全配置失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchSecurityConfig();
  }, []);
  
  // 提交表单
  const handleSubmit = async (values) => {
    try {
      setSubmitting(true);
      
      // 处理IP白名单、黑名单和CORS允许的源
      const formattedValues = {
        ...values,
        ipWhitelist: values.ipWhitelist ? values.ipWhitelist.split('\n').filter(ip => ip.trim()) : [],
        ipBlacklist: values.ipBlacklist ? values.ipBlacklist.split('\n').filter(ip => ip.trim()) : [],
        corsAllowedOrigins: values.corsAllowedOrigins ? values.corsAllowedOrigins.split('\n').filter(origin => origin.trim()) : [],
      };
      
      await updateSecurityConfig(formattedValues);
      message.success('更新安全配置成功');
    } catch (error) {
      console.error('更新安全配置失败:', error);
      message.error('更新安全配置失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };
  
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px 0' }}>
        <Spin size="large" />
        <p>加载安全配置...</p>
      </div>
    );
  }
  
  return (
    <Card>
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        initialValues={{
          passwordMinLength: 8,
          passwordComplexity: 'medium',
          loginAttempts: 5,
          lockoutDuration: 30,
          sessionTimeout: 120,
          jwtExpiration: 60,
          jwtRefreshExpiration: 1440,
          enableCaptcha: true,
          captchaType: 'image',
          twoFactorAuth: false,
          twoFactorAuthType: 'app',
          csrfProtection: true,
          xssProtection: true,
          sqlInjectionProtection: true,
          rateLimit: true,
          rateLimitRequests: 100,
          rateLimitWindow: 15,
        }}
      >
        <Divider orientation="left">
          <Title level={4}>密码安全</Title>
        </Divider>
        
        <Row gutter={24}>
          <Col span={12}>
            <Form.Item
              name="passwordMinLength"
              label="密码最小长度"
              rules={[{ required: true, message: '请输入密码最小长度' }]}
            >
              <InputNumber min={6} max={32} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="passwordComplexity"
              label="密码复杂度要求"
              rules={[{ required: true, message: '请选择密码复杂度要求' }]}
            >
              <Select>
                <Option value="low">低（仅字母和数字）</Option>
                <Option value="medium">中（字母、数字和特殊字符）</Option>
                <Option value="high">高（大小写字母、数字和特殊字符）</Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>
        
        <Divider orientation="left">
          <Title level={4}>登录安全</Title>
        </Divider>
        
        <Row gutter={24}>
          <Col span={12}>
            <Form.Item
              name="loginAttempts"
              label="最大登录尝试次数"
              rules={[{ required: true, message: '请输入最大登录尝试次数' }]}
              tooltip="超过此次数后账户将被锁定"
            >
              <InputNumber min={1} max={10} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="lockoutDuration"
              label="账户锁定时长（分钟）"
              rules={[{ required: true, message: '请输入账户锁定时长' }]}
              tooltip="账户锁定后，需要等待此时长才能再次尝试登录"
            >
              <InputNumber min={5} max={1440} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>
        
        <Row gutter={24}>
          <Col span={8}>
            <Form.Item
              name="enableCaptcha"
              label="启用验证码"
              valuePropName="checked"
              tooltip="登录时是否需要验证码"
            >
              <Switch />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="captchaType"
              label="验证码类型"
              rules={[{ required: true, message: '请选择验证码类型' }]}
            >
              <Select>
                <Option value="image">图片验证码</Option>
                <Option value="slide">滑动验证码</Option>
                <Option value="click">点击验证码</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="twoFactorAuth"
              label="启用两因素认证"
              valuePropName="checked"
              tooltip="登录时是否需要两因素认证"
            >
              <Switch />
            </Form.Item>
          </Col>
        </Row>
        
        <Form.Item
          name="twoFactorAuthType"
          label="两因素认证类型"
          rules={[{ required: true, message: '请选择两因素认证类型' }]}
          tooltip="选择两因素认证的方式"
        >
          <Select>
            <Option value="app">认证器应用（如Google Authenticator）</Option>
            <Option value="sms">短信验证码</Option>
            <Option value="email">邮箱验证码</Option>
          </Select>
        </Form.Item>
        
        <Divider orientation="left">
          <Title level={4}>会话安全</Title>
        </Divider>
        
        <Row gutter={24}>
          <Col span={8}>
            <Form.Item
              name="sessionTimeout"
              label="会话超时时间（分钟）"
              rules={[{ required: true, message: '请输入会话超时时间' }]}
              tooltip="用户无操作超过此时间后，需要重新登录"
            >
              <InputNumber min={5} max={1440} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="jwtExpiration"
              label="JWT令牌有效期（分钟）"
              rules={[{ required: true, message: '请输入JWT令牌有效期' }]}
              tooltip="JWT令牌的有效期，过期后需要使用刷新令牌获取新令牌"
            >
              <InputNumber min={5} max={1440} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="jwtRefreshExpiration"
              label="刷新令牌有效期（分钟）"
              rules={[{ required: true, message: '请输入刷新令牌有效期' }]}
              tooltip="刷新令牌的有效期，过期后需要重新登录"
            >
              <InputNumber min={60} max={10080} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>
        
        <Divider orientation="left">
          <Title level={4}>IP访问控制</Title>
        </Divider>
        
        <Row gutter={24}>
          <Col span={12}>
            <Form.Item
              name="ipWhitelist"
              label="IP白名单"
              tooltip="每行一个IP地址或CIDR格式，留空表示不启用白名单"
            >
              <Input.TextArea rows={4} placeholder="例如：192.168.1.1&#10;10.0.0.0/24" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="ipBlacklist"
              label="IP黑名单"
              tooltip="每行一个IP地址或CIDR格式，留空表示不启用黑名单"
            >
              <Input.TextArea rows={4} placeholder="例如：192.168.1.100&#10;172.16.0.0/16" />
            </Form.Item>
          </Col>
        </Row>
        
        <Form.Item
          name="corsAllowedOrigins"
          label="CORS允许的源"
          tooltip="每行一个源，留空表示不允许跨域请求"
        >
          <Input.TextArea rows={3} placeholder="例如：https://example.com&#10;https://*.example.org" />
        </Form.Item>
        
        <Divider orientation="left">
          <Title level={4}>防护设置</Title>
        </Divider>
        
        <Row gutter={24}>
          <Col span={8}>
            <Form.Item
              name="csrfProtection"
              label="CSRF防护"
              valuePropName="checked"
              tooltip="启用跨站请求伪造防护"
            >
              <Switch />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="xssProtection"
              label="XSS防护"
              valuePropName="checked"
              tooltip="启用跨站脚本攻击防护"
            >
              <Switch />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="sqlInjectionProtection"
              label="SQL注入防护"
              valuePropName="checked"
              tooltip="启用SQL注入攻击防护"
            >
              <Switch />
            </Form.Item>
          </Col>
        </Row>
        
        <Form.Item
          name="rateLimit"
          label="启用请求速率限制"
          valuePropName="checked"
          tooltip="限制单个IP在一定时间内的请求次数"
        >
          <Switch />
        </Form.Item>
        
        <Row gutter={24}>
          <Col span={12}>
            <Form.Item
              name="rateLimitRequests"
              label="最大请求次数"
              rules={[{ required: true, message: '请输入最大请求次数' }]}
            >
              <InputNumber min={10} max={1000} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="rateLimitWindow"
              label="时间窗口（分钟）"
              rules={[{ required: true, message: '请输入时间窗口' }]}
            >
              <InputNumber min={1} max={60} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
        </Row>
        
        <Form.Item>
          <Button type="primary" htmlType="submit" loading={submitting}>
            保存设置
          </Button>
        </Form.Item>
      </Form>
    </Card>
  );
};

export default SecuritySettings;
