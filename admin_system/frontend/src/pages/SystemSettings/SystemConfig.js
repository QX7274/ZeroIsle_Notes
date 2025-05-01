import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  message,
  Tabs,
  Switch,
  InputNumber,
  Select,
  Divider,
  Space,
  Spin,
  Row,
  Col,
  Typography,
  Alert
} from 'antd';
import {
  SaveOutlined,
  SyncOutlined,
  ReloadOutlined,
  SettingOutlined,
  GlobalOutlined,
  SecurityScanOutlined,
  MailOutlined,
  FileOutlined,
  UserOutlined
} from '@ant-design/icons';
import { PageHeader } from '../../components/common';
import { getAllConfigs, updateConfig, syncSettings } from '../../services/settingService';

const { TabPane } = Tabs;
const { Option } = Select;
const { Title, Text } = Typography;

const SystemConfig = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [configs, setConfigs] = useState({});

  // 获取所有系统配置
  const fetchConfigs = async () => {
    try {
      setLoading(true);
      const response = await getAllConfigs();
      if (response.status === 'success') {
        setConfigs(response.data);
        form.setFieldsValue(response.data);
      } else {
        message.error('获取系统配置失败');
      }
    } catch (error) {
      console.error('获取系统配置错误:', error);
      message.error('获取系统配置失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 同步系统设置
  const handleSync = async () => {
    try {
      setSyncing(true);
      const response = await syncSettings({ incremental: true });
      message.success('系统设置同步成功');
      fetchConfigs();
    } catch (error) {
      console.error('同步系统设置错误:', error);
      message.error('同步系统设置失败，请稍后重试');
    } finally {
      setSyncing(false);
    }
  };

  // 保存系统配置
  const handleSave = async (values) => {
    try {
      setLoading(true);
      const response = await updateConfig(values);
      if (response.status === 'success') {
        message.success('系统配置保存成功');
        setConfigs(values);
      } else {
        message.error('系统配置保存失败');
      }
    } catch (error) {
      console.error('保存系统配置错误:', error);
      message.error('系统配置保存失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 重置表单
  const handleReset = () => {
    form.setFieldsValue(configs);
    message.info('表单已重置');
  };

  useEffect(() => {
    fetchConfigs();
  }, []);

  return (
    <div className="system-config-page">
      <PageHeader
        title="系统设置"
        subTitle="管理系统的基本配置和参数"
        breadcrumb={[
          { title: '首页', path: '/' },
          { title: '系统设置' }
        ]}
        extra={[
          <Button
            key="sync"
            icon={<SyncOutlined />}
            onClick={handleSync}
            loading={syncing}
          >
            同步设置
          </Button>,
          <Button
            key="reset"
            icon={<ReloadOutlined />}
            onClick={handleReset}
          >
            重置
          </Button>,
          <Button
            key="save"
            type="primary"
            icon={<SaveOutlined />}
            onClick={() => form.submit()}
            loading={loading}
          >
            保存设置
          </Button>,
        ]}
      />

      <Card>
        <Spin spinning={loading}>
          <Form
            form={form}
            layout="vertical"
            onFinish={handleSave}
            initialValues={configs}
          >
            <Tabs defaultActiveKey="basic">
              <TabPane
                tab={
                  <span>
                    <GlobalOutlined />
                    基本设置
                  </span>
                }
                key="basic"
              >
                <Row gutter={24}>
                  <Col span={12}>
                    <Form.Item
                      label="系统名称"
                      name="siteName"
                      rules={[{ required: true, message: '请输入系统名称' }]}
                    >
                      <Input placeholder="请输入系统名称" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      label="管理员邮箱"
                      name="adminEmail"
                      rules={[
                        { required: true, message: '请输入管理员邮箱' },
                        { type: 'email', message: '请输入有效的邮箱地址' }
                      ]}
                    >
                      <Input placeholder="请输入管理员邮箱" />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={24}>
                  <Col span={24}>
                    <Form.Item
                      label="系统描述"
                      name="siteDescription"
                    >
                      <Input.TextArea rows={3} placeholder="请输入系统描述" />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={24}>
                  <Col span={12}>
                    <Form.Item
                      label="系统关键词"
                      name="siteKeywords"
                    >
                      <Input placeholder="请输入系统关键词，用逗号分隔" />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      label="时区"
                      name="timezone"
                    >
                      <Select placeholder="请选择时区">
                        <Option value="Asia/Shanghai">中国标准时间 (UTC+8)</Option>
                        <Option value="America/New_York">美国东部时间 (UTC-5/4)</Option>
                        <Option value="Europe/London">英国标准时间 (UTC+0/1)</Option>
                        <Option value="Europe/Paris">欧洲中部时间 (UTC+1/2)</Option>
                        <Option value="Asia/Tokyo">日本标准时间 (UTC+9)</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={24}>
                  <Col span={12}>
                    <Form.Item
                      label="日期格式"
                      name="dateFormat"
                    >
                      <Select placeholder="请选择日期格式">
                        <Option value="YYYY-MM-DD">YYYY-MM-DD</Option>
                        <Option value="DD/MM/YYYY">DD/MM/YYYY</Option>
                        <Option value="MM/DD/YYYY">MM/DD/YYYY</Option>
                        <Option value="YYYY年MM月DD日">YYYY年MM月DD日</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      label="时间格式"
                      name="timeFormat"
                    >
                      <Select placeholder="请选择时间格式">
                        <Option value="HH:mm:ss">HH:mm:ss (24小时制)</Option>
                        <Option value="hh:mm:ss A">hh:mm:ss A (12小时制)</Option>
                        <Option value="HH:mm">HH:mm (24小时制)</Option>
                        <Option value="hh:mm A">hh:mm A (12小时制)</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>
              </TabPane>

              <TabPane
                tab={
                  <span>
                    <UserOutlined />
                    用户设置
                  </span>
                }
                key="user"
              >
                <Row gutter={24}>
                  <Col span={12}>
                    <Form.Item
                      label="允许用户注册"
                      name="userRegistration"
                      valuePropName="checked"
                      getValueFromEvent={(checked) => checked ? 'true' : 'false'}
                      getValueProps={(value) => ({ checked: value === 'true' })}
                    >
                      <Switch />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      label="邮箱验证"
                      name="emailVerification"
                      valuePropName="checked"
                      getValueFromEvent={(checked) => checked ? 'true' : 'false'}
                      getValueProps={(value) => ({ checked: value === 'true' })}
                    >
                      <Switch />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={24}>
                  <Col span={12}>
                    <Form.Item
                      label="默认用户角色"
                      name="defaultUserRole"
                    >
                      <Select placeholder="请选择默认用户角色">
                        <Option value="user">普通用户</Option>
                        <Option value="vip">VIP用户</Option>
                        <Option value="premium">高级用户</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      label="每页显示数量"
                      name="pageSize"
                    >
                      <InputNumber min={5} max={100} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>
              </TabPane>

              <TabPane
                tab={
                  <span>
                    <FileOutlined />
                    上传设置
                  </span>
                }
                key="upload"
              >
                <Row gutter={24}>
                  <Col span={12}>
                    <Form.Item
                      label="最大上传大小 (MB)"
                      name="uploadMaxSize"
                    >
                      <InputNumber min={1} max={100} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      label="允许的文件类型"
                      name="allowedFileTypes"
                    >
                      <Input placeholder="请输入允许的文件类型，用逗号分隔" />
                    </Form.Item>
                  </Col>
                </Row>

                <Alert
                  message="上传设置说明"
                  description="这里设置的上传限制将应用于所有用户上传的文件，包括笔记附件、用户头像等。请根据服务器容量和带宽合理设置。"
                  type="info"
                  showIcon
                />
              </TabPane>

              <TabPane
                tab={
                  <span>
                    <SecurityScanOutlined />
                    安全设置
                  </span>
                }
                key="security"
              >
                <Row gutter={24}>
                  <Col span={12}>
                    <Form.Item
                      label="密码最小长度"
                      name="passwordMinLength"
                    >
                      <InputNumber min={6} max={20} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      label="密码复杂度要求"
                      name="passwordComplexity"
                    >
                      <Select placeholder="请选择密码复杂度要求">
                        <Option value="low">低 (仅字母和数字)</Option>
                        <Option value="medium">中 (字母、数字和特殊字符)</Option>
                        <Option value="high">高 (大小写字母、数字和特殊字符)</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={24}>
                  <Col span={12}>
                    <Form.Item
                      label="登录尝试次数限制"
                      name="loginAttempts"
                    >
                      <InputNumber min={3} max={10} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      label="锁定时间 (分钟)"
                      name="lockoutDuration"
                    >
                      <InputNumber min={5} max={60} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>

                <Row gutter={24}>
                  <Col span={12}>
                    <Form.Item
                      label="启用验证码"
                      name="enableCaptcha"
                      valuePropName="checked"
                      getValueFromEvent={(checked) => checked ? 'true' : 'false'}
                      getValueProps={(value) => ({ checked: value === 'true' })}
                    >
                      <Switch />
                    </Form.Item>
                  </Col>
                  <Col span={12}>
                    <Form.Item
                      label="会话超时时间 (分钟)"
                      name="sessionTimeout"
                    >
                      <InputNumber min={15} max={1440} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>
              </TabPane>
            </Tabs>
          </Form>
        </Spin>
      </Card>
    </div>
  );
};

export default SystemConfig;
