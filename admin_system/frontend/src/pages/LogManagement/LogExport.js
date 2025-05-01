import React, { useState, useEffect } from 'react';
import {
  Card, Form, Button, Select, DatePicker, Radio, Checkbox, 
  Space, message, Alert, Divider, Typography, Row, Col, 
  Spin, Progress, List, Tag, Tooltip, Modal, Input
} from 'antd';
import {
  DownloadOutlined, CloudDownloadOutlined, SaveOutlined,
  DeleteOutlined, ExclamationCircleOutlined, FileTextOutlined,
  ClockCircleOutlined, InfoCircleOutlined, SettingOutlined
} from '@ant-design/icons';
import { PageHeader } from '../../components/common';
import { 
  exportSystemLogs, 
  exportAdminLogs, 
  getLogExportHistory,
  createLogBackup,
  getLogBackups,
  deleteLogBackup,
  downloadLogBackup
} from '../../services/logService';
import moment from 'dayjs';

const { Option } = Select;
const { RangePicker } = DatePicker;
const { Title, Text, Paragraph } = Typography;
const { confirm } = Modal;

const LogExport = () => {
  const [form] = Form.useForm();
  const [backupForm] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [backupLoading, setBackupLoading] = useState(false);
  const [exportHistory, setExportHistory] = useState([]);
  const [backups, setBackups] = useState([]);
  const [exportProgress, setExportProgress] = useState(0);
  const [backupProgress, setBackupProgress] = useState(0);
  const [exporting, setExporting] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [backupModalVisible, setBackupModalVisible] = useState(false);

  // 获取导出历史
  const fetchExportHistory = async () => {
    try {
      setLoading(true);
      const response = await getLogExportHistory();
      setExportHistory(response.data || []);
    } catch (error) {
      console.error('获取导出历史失败:', error);
      message.error('获取导出历史失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 获取备份列表
  const fetchBackups = async () => {
    try {
      setBackupLoading(true);
      const response = await getLogBackups();
      setBackups(response.data || []);
    } catch (error) {
      console.error('获取备份列表失败:', error);
      message.error('获取备份列表失败，请稍后重试');
    } finally {
      setBackupLoading(false);
    }
  };

  useEffect(() => {
    fetchExportHistory();
    fetchBackups();
  }, []);

  // 处理导出
  const handleExport = async (values) => {
    try {
      setExporting(true);
      setExportProgress(0);
      
      // 模拟进度
      const progressInterval = setInterval(() => {
        setExportProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 10;
        });
      }, 500);

      const exportParams = {
        format: values.format,
        log_type: values.logType,
        include_fields: values.includeFields,
      };

      if (values.dateRange && values.dateRange.length === 2) {
        exportParams.start_time = values.dateRange[0].format('YYYY-MM-DD');
        exportParams.end_time = values.dateRange[1].format('YYYY-MM-DD');
      }

      if (values.logType === 'system') {
        if (values.level) {
          exportParams.level = values.level;
        }
        if (values.source) {
          exportParams.source = values.source;
        }
        await exportSystemLogs(exportParams);
      } else if (values.logType === 'admin') {
        if (values.action) {
          exportParams.action = values.action;
        }
        if (values.module) {
          exportParams.module = values.module;
        }
        await exportAdminLogs(exportParams);
      } else {
        // 导出所有日志
        await Promise.all([
          exportSystemLogs(exportParams),
          exportAdminLogs(exportParams)
        ]);
      }

      clearInterval(progressInterval);
      setExportProgress(100);
      
      message.success('导出请求已发送，文件将在新窗口中下载');
      fetchExportHistory();
      
      // 重置进度条
      setTimeout(() => {
        setExporting(false);
        setExportProgress(0);
      }, 2000);
    } catch (error) {
      console.error('导出日志失败:', error);
      message.error('导出日志失败，请稍后重试');
      setExporting(false);
      setExportProgress(0);
    }
  };

  // 处理创建备份
  const handleCreateBackup = async (values) => {
    try {
      setBackingUp(true);
      setBackupProgress(0);
      
      // 模拟进度
      const progressInterval = setInterval(() => {
        setBackupProgress(prev => {
          if (prev >= 90) {
            clearInterval(progressInterval);
            return 90;
          }
          return prev + 5;
        });
      }, 300);

      const backupParams = {
        name: values.name,
        description: values.description,
        log_type: values.logType,
        include_all: values.includeAll,
      };

      if (values.dateRange && values.dateRange.length === 2) {
        backupParams.start_time = values.dateRange[0].format('YYYY-MM-DD');
        backupParams.end_time = values.dateRange[1].format('YYYY-MM-DD');
      }

      await createLogBackup(backupParams);

      clearInterval(progressInterval);
      setBackupProgress(100);
      
      message.success('日志备份创建成功');
      fetchBackups();
      setBackupModalVisible(false);
      
      // 重置进度条
      setTimeout(() => {
        setBackingUp(false);
        setBackupProgress(0);
      }, 2000);
    } catch (error) {
      console.error('创建备份失败:', error);
      message.error('创建备份失败，请稍后重试');
      setBackingUp(false);
      setBackupProgress(0);
    }
  };

  // 处理删除备份
  const handleDeleteBackup = (backupId) => {
    confirm({
      title: '确认删除',
      icon: <ExclamationCircleOutlined />,
      content: '确定要删除这个日志备份吗？此操作不可恢复。',
      onOk: async () => {
        try {
          await deleteLogBackup(backupId);
          message.success('备份删除成功');
          fetchBackups();
        } catch (error) {
          console.error('删除备份失败:', error);
          message.error('删除备份失败，请稍后重试');
        }
      }
    });
  };

  // 处理下载备份
  const handleDownloadBackup = async (backupId) => {
    try {
      await downloadLogBackup(backupId);
      message.success('备份下载请求已发送，文件将在新窗口中下载');
    } catch (error) {
      console.error('下载备份失败:', error);
      message.error('下载备份失败，请稍后重试');
    }
  };

  return (
    <div className="log-export-page">
      <PageHeader
        title="日志导出与备份"
        subTitle="导出和备份系统日志"
        breadcrumb={[
          { title: '首页', path: '/' },
          { title: '日志管理' },
          { title: '日志导出与备份' }
        ]}
      />

      <Row gutter={24}>
        <Col span={16}>
          <Card title={<Space><DownloadOutlined /> 日志导出</Space>} className="export-card">
            <Alert
              message="导出说明"
              description="您可以根据需要导出系统日志和管理员操作日志，支持多种格式和筛选条件。导出的文件将直接下载到您的设备上。"
              type="info"
              showIcon
              style={{ marginBottom: 24 }}
            />

            <Form
              form={form}
              layout="vertical"
              onFinish={handleExport}
              initialValues={{
                logType: 'all',
                format: 'csv',
                dateRange: [moment().subtract(7, 'days'), moment()],
                includeFields: ['timestamp', 'level', 'source', 'message', 'admin_username', 'action', 'module', 'description', 'ip_address']
              }}
            >
              <Row gutter={24}>
                <Col span={12}>
                  <Form.Item
                    name="logType"
                    label="日志类型"
                    rules={[{ required: true, message: '请选择日志类型' }]}
                  >
                    <Radio.Group>
                      <Radio.Button value="all">所有日志</Radio.Button>
                      <Radio.Button value="system">系统日志</Radio.Button>
                      <Radio.Button value="admin">管理员日志</Radio.Button>
                    </Radio.Group>
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="format"
                    label="导出格式"
                    rules={[{ required: true, message: '请选择导出格式' }]}
                  >
                    <Radio.Group>
                      <Radio.Button value="csv">CSV</Radio.Button>
                      <Radio.Button value="json">JSON</Radio.Button>
                      <Radio.Button value="excel">Excel</Radio.Button>
                    </Radio.Group>
                  </Form.Item>
                </Col>
              </Row>

              <Form.Item
                name="dateRange"
                label="日期范围"
                rules={[{ required: true, message: '请选择日期范围' }]}
              >
                <RangePicker
                  style={{ width: '100%' }}
                  ranges={{
                    '今天': [moment(), moment()],
                    '昨天': [moment().subtract(1, 'days'), moment().subtract(1, 'days')],
                    '最近7天': [moment().subtract(6, 'days'), moment()],
                    '最近30天': [moment().subtract(29, 'days'), moment()],
                    '本月': [moment().startOf('month'), moment().endOf('month')],
                  }}
                />
              </Form.Item>

              <Form.Item
                noStyle
                shouldUpdate={(prevValues, currentValues) => prevValues.logType !== currentValues.logType}
              >
                {({ getFieldValue }) => {
                  const logType = getFieldValue('logType');
                  return logType === 'system' || logType === 'all' ? (
                    <Row gutter={24}>
                      <Col span={12}>
                        <Form.Item
                          name="level"
                          label="日志级别"
                        >
                          <Select placeholder="选择日志级别" allowClear>
                            <Option value="info">信息</Option>
                            <Option value="warning">警告</Option>
                            <Option value="error">错误</Option>
                            <Option value="debug">调试</Option>
                          </Select>
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item
                          name="source"
                          label="日志来源"
                        >
                          <Select placeholder="选择日志来源" allowClear>
                            <Option value="app">应用程序</Option>
                            <Option value="database">数据库</Option>
                            <Option value="api">API</Option>
                            <Option value="auth">认证</Option>
                            <Option value="system">系统</Option>
                          </Select>
                        </Form.Item>
                      </Col>
                    </Row>
                  ) : null;
                }}
              </Form.Item>

              <Form.Item
                noStyle
                shouldUpdate={(prevValues, currentValues) => prevValues.logType !== currentValues.logType}
              >
                {({ getFieldValue }) => {
                  const logType = getFieldValue('logType');
                  return logType === 'admin' || logType === 'all' ? (
                    <Row gutter={24}>
                      <Col span={12}>
                        <Form.Item
                          name="action"
                          label="操作类型"
                        >
                          <Select placeholder="选择操作类型" allowClear>
                            <Option value="create">创建</Option>
                            <Option value="update">更新</Option>
                            <Option value="delete">删除</Option>
                            <Option value="login">登录</Option>
                            <Option value="logout">登出</Option>
                          </Select>
                        </Form.Item>
                      </Col>
                      <Col span={12}>
                        <Form.Item
                          name="module"
                          label="模块"
                        >
                          <Select placeholder="选择模块" allowClear>
                            <Option value="user">用户</Option>
                            <Option value="note">笔记</Option>
                            <Option value="comment">评论</Option>
                            <Option value="attachment">附件</Option>
                            <Option value="system">系统</Option>
                          </Select>
                        </Form.Item>
                      </Col>
                    </Row>
                  ) : null;
                }}
              </Form.Item>

              <Form.Item
                name="includeFields"
                label="包含字段"
              >
                <Checkbox.Group style={{ width: '100%' }}>
                  <Row>
                    <Col span={8}>
                      <Checkbox value="timestamp">时间戳</Checkbox>
                    </Col>
                    <Col span={8}>
                      <Checkbox value="level">日志级别</Checkbox>
                    </Col>
                    <Col span={8}>
                      <Checkbox value="source">来源</Checkbox>
                    </Col>
                    <Col span={8}>
                      <Checkbox value="message">消息</Checkbox>
                    </Col>
                    <Col span={8}>
                      <Checkbox value="admin_username">管理员</Checkbox>
                    </Col>
                    <Col span={8}>
                      <Checkbox value="action">操作类型</Checkbox>
                    </Col>
                    <Col span={8}>
                      <Checkbox value="module">模块</Checkbox>
                    </Col>
                    <Col span={8}>
                      <Checkbox value="description">描述</Checkbox>
                    </Col>
                    <Col span={8}>
                      <Checkbox value="ip_address">IP地址</Checkbox>
                    </Col>
                  </Row>
                </Checkbox.Group>
              </Form.Item>

              {exporting && (
                <div style={{ marginBottom: 24 }}>
                  <Progress percent={exportProgress} status={exportProgress < 100 ? "active" : "success"} />
                </div>
              )}

              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  icon={<DownloadOutlined />}
                  loading={exporting}
                  disabled={exporting}
                >
                  导出日志
                </Button>
              </Form.Item>
            </Form>
          </Card>

          <Card 
            title={<Space><CloudDownloadOutlined /> 导出历史</Space>} 
            className="export-history-card"
            style={{ marginTop: 24 }}
          >
            <Spin spinning={loading}>
              {exportHistory.length > 0 ? (
                <List
                  itemLayout="horizontal"
                  dataSource={exportHistory}
                  renderItem={item => (
                    <List.Item
                      actions={[
                        <Tooltip title="下载">
                          <Button
                            type="link"
                            icon={<DownloadOutlined />}
                            onClick={() => window.open(item.download_url, '_blank')}
                          />
                        </Tooltip>
                      ]}
                    >
                      <List.Item.Meta
                        avatar={<FileTextOutlined style={{ fontSize: 24 }} />}
                        title={
                          <Space>
                            {item.file_name}
                            <Tag color={item.log_type === 'system' ? 'blue' : 'purple'}>
                              {item.log_type === 'system' ? '系统日志' : '管理员日志'}
                            </Tag>
                            <Tag color="green">{item.format.toUpperCase()}</Tag>
                          </Space>
                        }
                        description={
                          <Space>
                            <ClockCircleOutlined /> {moment(item.created_at).format('YYYY-MM-DD HH:mm:ss')}
                            <InfoCircleOutlined /> {item.record_count} 条记录
                          </Space>
                        }
                      />
                    </List.Item>
                  )}
                />
              ) : (
                <div className="empty-history">
                  <Text type="secondary">暂无导出历史记录</Text>
                </div>
              )}
            </Spin>
          </Card>
        </Col>

        <Col span={8}>
          <Card 
            title={<Space><SaveOutlined /> 日志备份</Space>} 
            className="backup-card"
            extra={
              <Button 
                type="primary" 
                icon={<SaveOutlined />}
                onClick={() => setBackupModalVisible(true)}
              >
                创建备份
              </Button>
            }
          >
            <Alert
              message="备份说明"
              description="日志备份可以帮助您保存重要的系统日志和管理员操作记录，以便将来查询和分析。"
              type="info"
              showIcon
              style={{ marginBottom: 24 }}
            />

            <Spin spinning={backupLoading}>
              {backups.length > 0 ? (
                <List
                  itemLayout="vertical"
                  dataSource={backups}
                  renderItem={item => (
                    <List.Item
                      actions={[
                        <Button
                          type="link"
                          icon={<DownloadOutlined />}
                          onClick={() => handleDownloadBackup(item.id)}
                        >
                          下载
                        </Button>,
                        <Button
                          type="link"
                          danger
                          icon={<DeleteOutlined />}
                          onClick={() => handleDeleteBackup(item.id)}
                        >
                          删除
                        </Button>
                      ]}
                    >
                      <List.Item.Meta
                        title={
                          <Space>
                            {item.name}
                            <Tag color={
                              item.log_type === 'all' ? 'green' :
                              item.log_type === 'system' ? 'blue' : 'purple'
                            }>
                              {item.log_type === 'all' ? '所有日志' :
                               item.log_type === 'system' ? '系统日志' : '管理员日志'}
                            </Tag>
                          </Space>
                        }
                        description={
                          <div>
                            <div>{item.description}</div>
                            <div style={{ marginTop: 8 }}>
                              <Space>
                                <ClockCircleOutlined /> {moment(item.created_at).format('YYYY-MM-DD HH:mm:ss')}
                                <InfoCircleOutlined /> {item.record_count} 条记录
                                <Text type="secondary">{item.file_size}</Text>
                              </Space>
                            </div>
                          </div>
                        }
                      />
                    </List.Item>
                  )}
                />
              ) : (
                <div className="empty-backups">
                  <Text type="secondary">暂无备份记录</Text>
                </div>
              )}
            </Spin>
          </Card>
        </Col>
      </Row>

      <Modal
        title="创建日志备份"
        visible={backupModalVisible}
        onCancel={() => setBackupModalVisible(false)}
        footer={null}
        width={600}
      >
        <Form
          form={backupForm}
          layout="vertical"
          onFinish={handleCreateBackup}
          initialValues={{
            logType: 'all',
            includeAll: true,
            dateRange: [moment().subtract(30, 'days'), moment()]
          }}
        >
          <Form.Item
            name="name"
            label="备份名称"
            rules={[{ required: true, message: '请输入备份名称' }]}
          >
            <Input placeholder="输入备份名称" />
          </Form.Item>

          <Form.Item
            name="description"
            label="备份描述"
          >
            <Input.TextArea placeholder="输入备份描述" rows={3} />
          </Form.Item>

          <Form.Item
            name="logType"
            label="日志类型"
            rules={[{ required: true, message: '请选择日志类型' }]}
          >
            <Radio.Group>
              <Radio.Button value="all">所有日志</Radio.Button>
              <Radio.Button value="system">系统日志</Radio.Button>
              <Radio.Button value="admin">管理员日志</Radio.Button>
            </Radio.Group>
          </Form.Item>

          <Form.Item
            name="includeAll"
            valuePropName="checked"
          >
            <Checkbox>包含所有历史日志</Checkbox>
          </Form.Item>

          <Form.Item
            noStyle
            shouldUpdate={(prevValues, currentValues) => prevValues.includeAll !== currentValues.includeAll}
          >
            {({ getFieldValue }) => {
              const includeAll = getFieldValue('includeAll');
              return !includeAll ? (
                <Form.Item
                  name="dateRange"
                  label="日期范围"
                  rules={[{ required: true, message: '请选择日期范围' }]}
                >
                  <RangePicker
                    style={{ width: '100%' }}
                    ranges={{
                      '最近7天': [moment().subtract(6, 'days'), moment()],
                      '最近30天': [moment().subtract(29, 'days'), moment()],
                      '最近90天': [moment().subtract(89, 'days'), moment()],
                      '本年': [moment().startOf('year'), moment()]
                    }}
                  />
                </Form.Item>
              ) : null;
            }}
          </Form.Item>

          {backingUp && (
            <div style={{ marginBottom: 24 }}>
              <Progress percent={backupProgress} status={backupProgress < 100 ? "active" : "success"} />
            </div>
          )}

          <Form.Item>
            <Space>
              <Button onClick={() => setBackupModalVisible(false)}>
                取消
              </Button>
              <Button
                type="primary"
                htmlType="submit"
                icon={<SaveOutlined />}
                loading={backingUp}
                disabled={backingUp}
              >
                创建备份
              </Button>
            </Space>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default LogExport;
