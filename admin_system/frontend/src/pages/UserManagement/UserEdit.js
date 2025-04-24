import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Card, Select, Spin, message } from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeftOutlined } from '@ant-design/icons';

const { Option } = Select;

const UserEdit = () => {
  const { id } = useParams();
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        setLoading(true);
        // 在实际应用中，这里应该从API获取用户数据
        // const response = await axios.get(`/api/users/profiles/${id}`);
        // form.setFieldsValue(response.data);
        
        // 模拟API响应
        setTimeout(() => {
          form.setFieldsValue({
            username: 'user123',
            email: 'user123@example.com',
            phone: '13800138000',
            nickname: '示例用户',
            status: 'active',
          });
          setLoading(false);
        }, 1000);
      } catch (error) {
        message.error('获取用户数据失败');
        setLoading(false);
      }
    };

    fetchUser();
  }, [id, form]);

  const handleSubmit = async (values) => {
    try {
      // 在实际应用中，这里应该调用API更新用户
      // await axios.put(`/api/users/profiles/${id}`, values);
      
      console.log('提交的表单数据:', values);
      message.success('用户更新成功');
      navigate('/users');
    } catch (error) {
      message.error('更新用户失败');
    }
  };

  const handleBack = () => {
    navigate('/users');
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <Button 
        type="link" 
        icon={<ArrowLeftOutlined />} 
        onClick={handleBack}
        style={{ marginBottom: 16 }}
      >
        返回用户列表
      </Button>
      
      <Card title={`编辑用户: ${form.getFieldValue('username')}`}>
        <Form
          form={form}
          layout="vertical"
          onFinish={handleSubmit}
        >
          <Form.Item
            name="username"
            label="用户名"
          >
            <Input disabled />
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

          <Form.Item
            name="phone"
            label="手机号"
          >
            <Input placeholder="请输入手机号" />
          </Form.Item>

          <Form.Item
            name="nickname"
            label="昵称"
          >
            <Input placeholder="请输入昵称" />
          </Form.Item>

          <Form.Item
            name="status"
            label="状态"
            rules={[{ required: true, message: '请选择状态' }]}
          >
            <Select placeholder="请选择状态">
              <Option value="active">活跃</Option>
              <Option value="inactive">未激活</Option>
              <Option value="banned">已禁用</Option>
            </Select>
          </Form.Item>

          <Form.Item>
            <Button type="primary" htmlType="submit">
              保存修改
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};

export default UserEdit;
