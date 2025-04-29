import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Upload, Avatar, message, Typography } from 'antd';
import { UserOutlined, UploadOutlined } from '@ant-design/icons';
import ImgCrop from 'antd-img-crop';

const { Title, Text } = Typography;
const { TextArea } = Input;

const PersonalInfo = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState('');
  
  // 从localStorage获取用户信息
  const userString = localStorage.getItem('user');
  const user = userString ? JSON.parse(userString) : null;
  
  useEffect(() => {
    if (user) {
      form.setFieldsValue({
        username: user.username,
        email: user.email,
        bio: user.bio || '',
      });
      setAvatarUrl(user.avatar || '');
    }
  }, [form, user]);
  
  // 处理表单提交
  const handleSubmit = async (values) => {
    setLoading(true);
    
    try {
      // 这里应该有一个API请求来更新用户信息
      // 模拟API请求
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // 更新本地存储的用户信息
      const updatedUser = {
        ...user,
        username: values.username,
        bio: values.bio,
        avatar: avatarUrl
      };
      
      localStorage.setItem('user', JSON.stringify(updatedUser));
      
      message.success('个人资料更新成功');
    } catch (error) {
      message.error('更新失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };
  
  // 处理头像上传
  const handleAvatarChange = (info) => {
    if (info.file.status === 'done') {
      // 假设服务器返回了图片URL
      const imageUrl = info.file.response?.url || URL.createObjectURL(info.file.originFileObj);
      setAvatarUrl(imageUrl);
      message.success('头像上传成功');
    } else if (info.file.status === 'error') {
      message.error('头像上传失败');
    }
  };
  
  // 自定义上传按钮
  const uploadButton = (
    <div>
      <UploadOutlined />
      <div style={{ marginTop: 8 }}>上传头像</div>
    </div>
  );
  
  return (
    <div className="personal-info">
      <Title level={3}>个人资料</Title>
      <Text type="secondary" style={{ marginBottom: 24, display: 'block' }}>
        管理您的个人信息和账户
      </Text>
      
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <ImgCrop rotate>
          <Upload
            name="avatar"
            listType="picture-card"
            className="avatar-uploader"
            showUploadList={false}
            action="https://www.mocky.io/v2/5cc8019d300000980a055e76" // 替换为实际的上传API
            onChange={handleAvatarChange}
          >
            {avatarUrl ? (
              <Avatar 
                src={avatarUrl} 
                size={100}
                style={{ marginBottom: 8 }}
              />
            ) : (
              <Avatar 
                icon={<UserOutlined />} 
                size={100}
                style={{ marginBottom: 8 }}
              />
            )}
            {uploadButton}
          </Upload>
        </ImgCrop>
      </div>
      
      <Form
        form={form}
        layout="vertical"
        onFinish={handleSubmit}
        className="settings-form"
      >
        <Form.Item
          name="username"
          label="用户名"
          rules={[{ required: true, message: '请输入用户名' }]}
          className="settings-form-item"
        >
          <Input placeholder="请输入用户名" />
        </Form.Item>
        
        <Form.Item
          name="email"
          label="邮箱"
          className="settings-form-item"
        >
          <Input disabled placeholder="请绑定邮箱" />
        </Form.Item>
        
        <Form.Item
          name="bio"
          label="个人简介"
          className="settings-form-item"
        >
          <TextArea 
            placeholder="介绍一下自己吧" 
            autoSize={{ minRows: 3, maxRows: 6 }}
          />
        </Form.Item>
        
        <Form.Item>
          <Button 
            type="primary" 
            htmlType="submit" 
            loading={loading}
            className="settings-button"
          >
            保存修改
          </Button>
        </Form.Item>
      </Form>
    </div>
  );
};

export default PersonalInfo;
