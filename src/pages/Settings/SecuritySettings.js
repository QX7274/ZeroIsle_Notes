import React from 'react';
import { Form, Input, Button, Divider, Typography, List, Switch } from 'antd';
import { LockOutlined, PhoneOutlined, MailOutlined, SafetyOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;

const SecuritySettings = () => {
  const [form] = Form.useForm();
  
  // 从localStorage获取用户信息
  const userString = localStorage.getItem('user');
  const user = userString ? JSON.parse(userString) : null;
  
  // 处理密码修改
  const handlePasswordChange = (values) => {
    console.log('修改密码:', values);
    // 这里应该有一个API请求来修改密码
  };
  
  // 安全选项列表
  const securityOptions = [
    {
      title: '两步验证',
      description: '启用两步验证以增强账户安全性',
      icon: <SafetyOutlined />,
      action: <Switch />
    },
    {
      title: '登录通知',
      description: '当有新设备登录时通过邮件通知',
      icon: <MailOutlined />,
      action: <Switch defaultChecked />
    },
    {
      title: '异常登录保护',
      description: '检测到异常登录时要求额外验证',
      icon: <SafetyOutlined />,
      action: <Switch defaultChecked />
    }
  ];
  
  return (
    <div className="security-settings">
      <Title level={3}>账户安全</Title>
      <Text type="secondary" style={{ marginBottom: 24, display: 'block' }}>
        管理您的密码和安全选项
      </Text>
      
      <Divider orientation="left">修改密码</Divider>
      
      <Form
        form={form}
        layout="vertical"
        onFinish={handlePasswordChange}
        className="settings-form"
      >
        <Form.Item
          name="currentPassword"
          label="当前密码"
          rules={[{ required: true, message: '请输入当前密码' }]}
          className="settings-form-item"
        >
          <Input.Password 
            prefix={<LockOutlined />} 
            placeholder="请输入当前密码" 
          />
        </Form.Item>
        
        <Form.Item
          name="newPassword"
          label="新密码"
          rules={[
            { required: true, message: '请输入新密码' },
            { min: 8, message: '密码长度不能少于8个字符' }
          ]}
          className="settings-form-item"
        >
          <Input.Password 
            prefix={<LockOutlined />} 
            placeholder="请输入新密码" 
          />
        </Form.Item>
        
        <Form.Item
          name="confirmPassword"
          label="确认新密码"
          dependencies={['newPassword']}
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
          className="settings-form-item"
        >
          <Input.Password 
            prefix={<LockOutlined />} 
            placeholder="请确认新密码" 
          />
        </Form.Item>
        
        <Form.Item>
          <Button 
            type="primary" 
            htmlType="submit" 
            className="settings-button"
          >
            修改密码
          </Button>
        </Form.Item>
      </Form>
      
      <Divider orientation="left">账户绑定</Divider>
      
      <List
        itemLayout="horizontal"
        dataSource={[
          {
            title: '手机绑定',
            description: user?.phone || '未绑定手机号码',
            icon: <PhoneOutlined />,
            action: <Button type="link">绑定</Button>
          },
          {
            title: '邮箱绑定',
            description: user?.email || '未绑定邮箱',
            icon: <MailOutlined />,
            action: <Button type="link">绑定</Button>
          }
        ]}
        renderItem={item => (
          <List.Item
            actions={[item.action]}
          >
            <List.Item.Meta
              avatar={item.icon}
              title={item.title}
              description={item.description}
            />
          </List.Item>
        )}
      />
      
      <Divider orientation="left">安全选项</Divider>
      
      <List
        itemLayout="horizontal"
        dataSource={securityOptions}
        renderItem={item => (
          <List.Item
            actions={[item.action]}
          >
            <List.Item.Meta
              avatar={item.icon}
              title={item.title}
              description={item.description}
            />
          </List.Item>
        )}
      />
    </div>
  );
};

export default SecuritySettings;
