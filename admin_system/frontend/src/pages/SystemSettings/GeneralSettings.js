import React, { useState, useEffect } from 'react';
import { Form, Input, Button, Card, Switch, InputNumber, Select, message, Spin, Divider, Typography, Row, Col } from 'antd';
import { getSystemConfig, updateSystemConfig } from '../../services/settingsService';

const { Option } = Select;
const { Title, Text } = Typography;

const GeneralSettings = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  
  // 获取系统配置
  const fetchSystemConfig = async () => {
    try {
      setLoading(true);
      const data = await getSystemConfig();
      
      // 设置表单初始值
      form.setFieldsValue({
        siteName: data.siteName,
        siteDescription: data.siteDescription,
        siteKeywords: data.siteKeywords,
        siteLogo: data.siteLogo,
        siteFavicon: data.siteFavicon,
        adminEmail: data.adminEmail,
        userRegistration: data.userRegistration,
        emailVerification: data.emailVerification,
        defaultUserRole: data.defaultUserRole,
        pageSize: data.pageSize,
        uploadMaxSize: data.uploadMaxSize,
        allowedFileTypes: data.allowedFileTypes,
        timezone: data.timezone,
        dateFormat: data.dateFormat,
        timeFormat: data.timeFormat,
      });
    } catch (error) {
      console.error('获取系统配置失败:', error);
      message.error('获取系统配置失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };
  
  useEffect(() => {
    fetchSystemConfig();
  }, []);
  
  // 提交表单
  const handleSubmit = async (values) => {
    try {
      setSubmitting(true);
      await updateSystemConfig(values);
      message.success('更新系统配置成功');
    } catch (error) {
      console.error('更新系统配置失败:', error);
      message.error('更新系统配置失败，请稍后重试');
    } finally {
      setSubmitting(false);
    }
  };
  
  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px 0' }}>
        <Spin size="large" />
        <p>加载系统配置...</p>
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
          userRegistration: true,
          emailVerification: true,
          defaultUserRole: 'user',
          pageSize: 10,
          uploadMaxSize: 10,
          allowedFileTypes: ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'doc', 'docx'],
          timezone: 'Asia/Shanghai',
          dateFormat: 'YYYY-MM-DD',
          timeFormat: 'HH:mm:ss',
        }}
      >
        <Divider orientation="left">
          <Title level={4}>网站基本信息</Title>
        </Divider>
        
        <Row gutter={24}>
          <Col span={12}>
            <Form.Item
              name="siteName"
              label="网站名称"
              rules={[{ required: true, message: '请输入网站名称' }]}
            >
              <Input placeholder="请输入网站名称" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="adminEmail"
              label="管理员邮箱"
              rules={[
                { required: true, message: '请输入管理员邮箱' },
                { type: 'email', message: '请输入有效的邮箱地址' },
              ]}
            >
              <Input placeholder="请输入管理员邮箱" />
            </Form.Item>
          </Col>
        </Row>
        
        <Form.Item
          name="siteDescription"
          label="网站描述"
        >
          <Input.TextArea rows={3} placeholder="请输入网站描述" />
        </Form.Item>
        
        <Form.Item
          name="siteKeywords"
          label="网站关键词"
        >
          <Input placeholder="请输入网站关键词，多个关键词用逗号分隔" />
        </Form.Item>
        
        <Row gutter={24}>
          <Col span={12}>
            <Form.Item
              name="siteLogo"
              label="网站Logo"
            >
              <Input placeholder="请输入Logo URL或上传Logo" />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item
              name="siteFavicon"
              label="网站图标"
            >
              <Input placeholder="请输入图标URL或上传图标" />
            </Form.Item>
          </Col>
        </Row>
        
        <Divider orientation="left">
          <Title level={4}>用户设置</Title>
        </Divider>
        
        <Row gutter={24}>
          <Col span={8}>
            <Form.Item
              name="userRegistration"
              label="允许用户注册"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="emailVerification"
              label="邮箱验证"
              valuePropName="checked"
            >
              <Switch />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="defaultUserRole"
              label="默认用户角色"
            >
              <Select>
                <Option value="user">普通用户</Option>
                <Option value="vip">VIP用户</Option>
                <Option value="premium">高级用户</Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>
        
        <Divider orientation="left">
          <Title level={4}>内容设置</Title>
        </Divider>
        
        <Row gutter={24}>
          <Col span={8}>
            <Form.Item
              name="pageSize"
              label="每页显示条数"
              rules={[{ required: true, message: '请输入每页显示条数' }]}
            >
              <InputNumber min={5} max={100} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="uploadMaxSize"
              label="上传文件大小限制(MB)"
              rules={[{ required: true, message: '请输入上传文件大小限制' }]}
            >
              <InputNumber min={1} max={100} style={{ width: '100%' }} />
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="allowedFileTypes"
              label="允许上传的文件类型"
              rules={[{ required: true, message: '请选择允许上传的文件类型' }]}
            >
              <Select mode="multiple" placeholder="请选择允许上传的文件类型">
                <Option value="jpg">JPG</Option>
                <Option value="jpeg">JPEG</Option>
                <Option value="png">PNG</Option>
                <Option value="gif">GIF</Option>
                <Option value="pdf">PDF</Option>
                <Option value="doc">DOC</Option>
                <Option value="docx">DOCX</Option>
                <Option value="xls">XLS</Option>
                <Option value="xlsx">XLSX</Option>
                <Option value="ppt">PPT</Option>
                <Option value="pptx">PPTX</Option>
                <Option value="txt">TXT</Option>
                <Option value="zip">ZIP</Option>
                <Option value="rar">RAR</Option>
              </Select>
            </Form.Item>
          </Col>
        </Row>
        
        <Divider orientation="left">
          <Title level={4}>区域设置</Title>
        </Divider>
        
        <Row gutter={24}>
          <Col span={8}>
            <Form.Item
              name="timezone"
              label="时区"
              rules={[{ required: true, message: '请选择时区' }]}
            >
              <Select>
                <Option value="Asia/Shanghai">中国标准时间 (UTC+8)</Option>
                <Option value="America/New_York">美国东部时间 (UTC-5)</Option>
                <Option value="Europe/London">英国标准时间 (UTC+0)</Option>
                <Option value="Europe/Paris">欧洲中部时间 (UTC+1)</Option>
                <Option value="Asia/Tokyo">日本标准时间 (UTC+9)</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="dateFormat"
              label="日期格式"
              rules={[{ required: true, message: '请选择日期格式' }]}
            >
              <Select>
                <Option value="YYYY-MM-DD">YYYY-MM-DD</Option>
                <Option value="MM/DD/YYYY">MM/DD/YYYY</Option>
                <Option value="DD/MM/YYYY">DD/MM/YYYY</Option>
                <Option value="YYYY年MM月DD日">YYYY年MM月DD日</Option>
              </Select>
            </Form.Item>
          </Col>
          <Col span={8}>
            <Form.Item
              name="timeFormat"
              label="时间格式"
              rules={[{ required: true, message: '请选择时间格式' }]}
            >
              <Select>
                <Option value="HH:mm:ss">24小时制 (HH:mm:ss)</Option>
                <Option value="hh:mm:ss A">12小时制 (hh:mm:ss AM/PM)</Option>
              </Select>
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

export default GeneralSettings;
