import React, { useState, useEffect } from 'react';
import {
  Card,
  Form,
  Input,
  Button,
  Switch,
  Select,
  InputNumber,
  TimePicker,
  Divider,
  Space,
  Typography,
  message,
  Alert,
  Spin,
  Descriptions,
  Badge,
  Statistic,
  Row,
  Col,
  Table,
  Tag,
  Tooltip,
  Modal
} from 'antd';
import {
  SyncOutlined,
  SaveOutlined,
  ClockCircleOutlined,
  SettingOutlined,
  InfoCircleOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  ExclamationCircleOutlined,
  HistoryOutlined,
  DatabaseOutlined,
  UserOutlined,
  FileTextOutlined,
  TagsOutlined,
  AppstoreOutlined
} from '@ant-design/icons';
import moment from 'moment';
import {
  getSyncStatus,
  getSyncConfig,
  updateSyncConfig,
  syncData,
  getSyncHistory
} from '../../services/syncService';

const { Title, Text } = Typography;
const { Option } = Select;
const { confirm } = Modal;

const SyncSettings = () => {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [configLoading, setConfigLoading] = useState(false);
  const [statusLoading, setStatusLoading] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [syncStatus, setSyncStatus] = useState(null);
  const [syncHistory, setSyncHistory] = useState([]);
  const [syncInProgress, setSyncInProgress] = useState(false);

  // 获取同步配置
  const fetchSyncConfig = async () => {
    try {
      setConfigLoading(true);
      const config = await getSyncConfig();
      
      // 转换配置值
      const formValues = {
        autoSync: config.auto_sync === 'true',
        syncInterval: parseInt(config.sync_interval || '60'),
        syncTime: config.sync_time ? moment(config.sync_time, 'HH:mm:ss') : moment('03:00:00', 'HH:mm:ss'),
        syncTypes: config.sync_types ? config.sync_types.split(',') : ['users', 'notes', 'categories', 'tags'],
        conflictResolution: config.conflict_resolution || 'newer',
        maxRetries: parseInt(config.max_retries || '3'),
        timeout: parseInt(config.timeout || '300'),
        batchSize: parseInt(config.batch_size || '100'),
        notifyOnComplete: config.notify_on_complete === 'true',
        notifyOnError: config.notify_on_error === 'true',
        logLevel: config.log_level || 'info'
      };
      
      form.setFieldsValue(formValues);
    } catch (error) {
      message.error('获取同步配置失败');
      console.error('获取同步配置失败:', error);
    } finally {
      setConfigLoading(false);
    }
  };

  // 获取同步状态
  const fetchSyncStatus = async () => {
    try {
      setStatusLoading(true);
      const status = await getSyncStatus();
      setSyncStatus(status);
      
      // 检查是否有同步正在进行中
      const inProgress = Object.values(status.latest_syncs || {}).some(
        sync => sync.status === 'in_progress'
      );
      setSyncInProgress(inProgress);
    } catch (error) {
      message.error('获取同步状态失败');
      console.error('获取同步状态失败:', error);
    } finally {
      setStatusLoading(false);
    }
  };

  // 获取同步历史
  const fetchSyncHistory = async () => {
    try {
      setHistoryLoading(true);
      const params = {
        page: 1,
        pageSize: 5
      };
      const history = await getSyncHistory(params);
      setSyncHistory(history.results || []);
    } catch (error) {
      message.error('获取同步历史失败');
      console.error('获取同步历史失败:', error);
    } finally {
      setHistoryLoading(false);
    }
  };

  // 保存同步配置
  const handleSaveConfig = async (values) => {
    try {
      setLoading(true);
      
      // 转换配置值为字符串
      const configData = {
        auto_sync: values.autoSync.toString(),
        sync_interval: values.syncInterval.toString(),
        sync_time: values.syncTime.format('HH:mm:ss'),
        sync_types: values.syncTypes.join(','),
        conflict_resolution: values.conflictResolution,
        max_retries: values.maxRetries.toString(),
        timeout: values.timeout.toString(),
        batch_size: values.batchSize.toString(),
        notify_on_complete: values.notifyOnComplete.toString(),
        notify_on_error: values.notifyOnError.toString(),
        log_level: values.logLevel
      };
      
      await updateSyncConfig(configData);
      message.success('同步配置保存成功');
    } catch (error) {
      message.error('保存同步配置失败');
      console.error('保存同步配置失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 执行同步
  const handleSync = (syncType) => {
    confirm({
      title: `确定要执行${syncType === 'full' ? '全量' : ''}同步吗？`,
      icon: <ExclamationCircleOutlined />,
      content: syncType === 'full' 
        ? '全量同步将同步所有数据，可能需要较长时间。' 
        : `将同步${syncType === 'users' ? '用户' : syncType === 'notes' ? '笔记' : syncType === 'categories' ? '分类' : '标签'}数据。`,
      onOk: async () => {
        try {
          setLoading(true);
          const options = {
            sync_type: syncType,
            options: {
              incremental: true
            }
          };
          
          const result = await syncData(options);
          message.success('同步任务已启动');
          
          // 刷新同步状态
          await fetchSyncStatus();
          await fetchSyncHistory();
        } catch (error) {
          message.error('启动同步任务失败');
          console.error('启动同步任务失败:', error);
        } finally {
          setLoading(false);
        }
      }
    });
  };

  // 刷新数据
  const handleRefresh = async () => {
    await fetchSyncStatus();
    await fetchSyncHistory();
  };

  // 初始化
  useEffect(() => {
    fetchSyncConfig();
    fetchSyncStatus();
    fetchSyncHistory();
    
    // 定时刷新同步状态
    const intervalId = setInterval(() => {
      if (syncInProgress) {
        fetchSyncStatus();
        fetchSyncHistory();
      }
    }, 5000);
    
    return () => clearInterval(intervalId);
  }, [syncInProgress]);

  // 同步历史表格列
  const historyColumns = [
    {
      title: '同步ID',
      dataIndex: 'sync_id',
      key: 'sync_id',
      ellipsis: true,
      width: 220,
    },
    {
      title: '类型',
      dataIndex: 'sync_type',
      key: 'sync_type',
      render: (text) => {
        const typeMap = {
          'full': { color: 'blue', text: '全量同步' },
          'users': { color: 'green', text: '用户同步' },
          'notes': { color: 'purple', text: '笔记同步' },
          'categories': { color: 'orange', text: '分类同步' },
          'tags': { color: 'cyan', text: '标签同步' },
        };
        
        return (
          <Tag color={typeMap[text]?.color || 'default'}>
            {typeMap[text]?.text || text}
          </Tag>
        );
      }
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (text) => {
        const statusMap = {
          'pending': { color: 'warning', text: '等待中', icon: <ClockCircleOutlined /> },
          'in_progress': { color: 'processing', text: '同步中', icon: <SyncOutlined spin /> },
          'completed': { color: 'success', text: '已完成', icon: <CheckCircleOutlined /> },
          'failed': { color: 'error', text: '失败', icon: <CloseCircleOutlined /> },
          'cancelled': { color: 'default', text: '已取消', icon: <CloseCircleOutlined /> },
        };
        
        return (
          <Badge
            status={statusMap[text]?.color || 'default'}
            text={
              <Space>
                {statusMap[text]?.icon}
                {statusMap[text]?.text || text}
              </Space>
            }
          />
        );
      }
    },
    {
      title: '开始时间',
      dataIndex: 'start_time',
      key: 'start_time',
      render: (text) => text && moment(text).format('YYYY-MM-DD HH:mm:ss')
    },
    {
      title: '结束时间',
      dataIndex: 'end_time',
      key: 'end_time',
      render: (text) => text ? moment(text).format('YYYY-MM-DD HH:mm:ss') : '-'
    },
    {
      title: '持续时间',
      dataIndex: 'duration',
      key: 'duration',
      render: (text) => {
        if (!text) return '-';
        
        const minutes = Math.floor(text / 60);
        const seconds = text % 60;
        
        if (minutes > 0) {
          return `${minutes}分${seconds}秒`;
        } else {
          return `${seconds}秒`;
        }
      }
    },
  ];

  return (
    <div className="sync-settings-container">
      <Card
        title={
          <Space>
            <SyncOutlined />
            <span>数据同步设置</span>
          </Space>
        }
        extra={
          <Button
            icon={<SyncOutlined />}
            onClick={handleRefresh}
            loading={statusLoading || historyLoading}
          >
            刷新
          </Button>
        }
      >
        <Row gutter={[24, 24]}>
          {/* 同步状态 */}
          <Col span={24}>
            <Card
              title={
                <Space>
                  <DatabaseOutlined />
                  <span>同步状态</span>
                </Space>
              }
              className="inner-card"
              loading={statusLoading}
            >
              {syncStatus ? (
                <>
                  <Row gutter={[24, 24]}>
                    <Col xs={24} sm={12} md={6}>
                      <Statistic
                        title={<Space><UserOutlined /> 用户数据</Space>}
                        value={syncStatus.data_stats?.users?.total || 0}
                        suffix={
                          <Tooltip title="今日新增">
                            <Tag color="blue">+{syncStatus.data_stats?.users?.today_new || 0}</Tag>
                          </Tooltip>
                        }
                      />
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                      <Statistic
                        title={<Space><FileTextOutlined /> 笔记数据</Space>}
                        value={syncStatus.data_stats?.notes?.total || 0}
                        suffix={
                          <Tooltip title="今日新增">
                            <Tag color="blue">+{syncStatus.data_stats?.notes?.today_new || 0}</Tag>
                          </Tooltip>
                        }
                      />
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                      <Statistic
                        title={<Space><AppstoreOutlined /> 分类数据</Space>}
                        value={syncStatus.data_stats?.categories?.total || 0}
                      />
                    </Col>
                    <Col xs={24} sm={12} md={6}>
                      <Statistic
                        title={<Space><TagsOutlined /> 标签数据</Space>}
                        value={syncStatus.data_stats?.tags?.total || 0}
                      />
                    </Col>
                  </Row>
                  
                  <Divider />
                  
                  <Descriptions title="最近同步信息" bordered size="small">
                    {Object.entries(syncStatus.latest_syncs || {}).map(([type, sync]) => (
                      <Descriptions.Item 
                        key={type} 
                        label={
                          type === 'full' ? '全量同步' : 
                          type === 'users' ? '用户同步' : 
                          type === 'notes' ? '笔记同步' : 
                          type === 'categories' ? '分类同步' : 
                          '标签同步'
                        }
                        span={3}
                      >
                        <Space>
                          <Badge
                            status={
                              sync.status === 'completed' ? 'success' :
                              sync.status === 'in_progress' ? 'processing' :
                              sync.status === 'failed' ? 'error' :
                              'default'
                            }
                            text={
                              sync.status === 'completed' ? '已完成' :
                              sync.status === 'in_progress' ? '同步中' :
                              sync.status === 'failed' ? '失败' :
                              sync.status
                            }
                          />
                          <span>开始时间: {moment(sync.start_time).format('YYYY-MM-DD HH:mm:ss')}</span>
                          {sync.end_time && (
                            <span>结束时间: {moment(sync.end_time).format('YYYY-MM-DD HH:mm:ss')}</span>
                          )}
                          {sync.duration && (
                            <span>持续时间: {sync.duration}秒</span>
                          )}
                        </Space>
                      </Descriptions.Item>
                    ))}
                  </Descriptions>
                </>
              ) : (
                <Alert
                  message="暂无同步数据"
                  description="尚未执行过同步操作，请点击下方的同步按钮开始同步数据。"
                  type="info"
                  showIcon
                />
              )}
              
              <Divider />
              
              <div className="sync-actions">
                <Space size="middle">
                  <Button
                    type="primary"
                    icon={<SyncOutlined />}
                    onClick={() => handleSync('full')}
                    loading={loading}
                    disabled={syncInProgress}
                  >
                    全量同步
                  </Button>
                  <Button
                    icon={<UserOutlined />}
                    onClick={() => handleSync('users')}
                    loading={loading}
                    disabled={syncInProgress}
                  >
                    同步用户
                  </Button>
                  <Button
                    icon={<FileTextOutlined />}
                    onClick={() => handleSync('notes')}
                    loading={loading}
                    disabled={syncInProgress}
                  >
                    同步笔记
                  </Button>
                  <Button
                    icon={<AppstoreOutlined />}
                    onClick={() => handleSync('categories')}
                    loading={loading}
                    disabled={syncInProgress}
                  >
                    同步分类
                  </Button>
                  <Button
                    icon={<TagsOutlined />}
                    onClick={() => handleSync('tags')}
                    loading={loading}
                    disabled={syncInProgress}
                  >
                    同步标签
                  </Button>
                </Space>
                
                {syncInProgress && (
                  <Alert
                    message="同步进行中"
                    description="当前有同步任务正在进行，请等待完成后再执行新的同步。"
                    type="warning"
                    showIcon
                    style={{ marginTop: 16 }}
                  />
                )}
              </div>
            </Card>
          </Col>
          
          {/* 同步历史 */}
          <Col span={24}>
            <Card
              title={
                <Space>
                  <HistoryOutlined />
                  <span>同步历史</span>
                </Space>
              }
              className="inner-card"
              extra={
                <Button
                  type="link"
                  onClick={() => window.location.href = '/sync/history'}
                >
                  查看更多
                </Button>
              }
              loading={historyLoading}
            >
              <Table
                columns={historyColumns}
                dataSource={syncHistory}
                rowKey="sync_id"
                pagination={false}
                size="small"
              />
            </Card>
          </Col>
          
          {/* 同步配置 */}
          <Col span={24}>
            <Card
              title={
                <Space>
                  <SettingOutlined />
                  <span>同步配置</span>
                </Space>
              }
              className="inner-card"
              loading={configLoading}
            >
              <Form
                form={form}
                layout="vertical"
                onFinish={handleSaveConfig}
                initialValues={{
                  autoSync: true,
                  syncInterval: 60,
                  syncTime: moment('03:00:00', 'HH:mm:ss'),
                  syncTypes: ['users', 'notes', 'categories', 'tags'],
                  conflictResolution: 'newer',
                  maxRetries: 3,
                  timeout: 300,
                  batchSize: 100,
                  notifyOnComplete: true,
                  notifyOnError: true,
                  logLevel: 'info'
                }}
              >
                <Row gutter={24}>
                  <Col span={8}>
                    <Form.Item
                      name="autoSync"
                      label="自动同步"
                      valuePropName="checked"
                    >
                      <Switch />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      name="syncInterval"
                      label="同步间隔(分钟)"
                      rules={[{ required: true, message: '请输入同步间隔' }]}
                    >
                      <InputNumber min={1} max={1440} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      name="syncTime"
                      label="定时同步时间"
                      rules={[{ required: true, message: '请选择定时同步时间' }]}
                    >
                      <TimePicker format="HH:mm:ss" style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>
                
                <Form.Item
                  name="syncTypes"
                  label="同步类型"
                  rules={[{ required: true, message: '请选择同步类型' }]}
                >
                  <Select mode="multiple" placeholder="请选择同步类型">
                    <Option value="users">用户数据</Option>
                    <Option value="notes">笔记数据</Option>
                    <Option value="categories">分类数据</Option>
                    <Option value="tags">标签数据</Option>
                  </Select>
                </Form.Item>
                
                <Row gutter={24}>
                  <Col span={8}>
                    <Form.Item
                      name="conflictResolution"
                      label="冲突解决策略"
                      rules={[{ required: true, message: '请选择冲突解决策略' }]}
                    >
                      <Select placeholder="请选择冲突解决策略">
                        <Option value="newer">使用较新的数据</Option>
                        <Option value="admin">使用管理系统数据</Option>
                        <Option value="main">使用主应用数据</Option>
                      </Select>
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      name="maxRetries"
                      label="最大重试次数"
                      rules={[{ required: true, message: '请输入最大重试次数' }]}
                    >
                      <InputNumber min={0} max={10} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      name="timeout"
                      label="超时时间(秒)"
                      rules={[{ required: true, message: '请输入超时时间' }]}
                    >
                      <InputNumber min={10} max={3600} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                </Row>
                
                <Row gutter={24}>
                  <Col span={8}>
                    <Form.Item
                      name="batchSize"
                      label="批处理大小"
                      rules={[{ required: true, message: '请输入批处理大小' }]}
                    >
                      <InputNumber min={10} max={1000} style={{ width: '100%' }} />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      name="notifyOnComplete"
                      label="同步完成通知"
                      valuePropName="checked"
                    >
                      <Switch />
                    </Form.Item>
                  </Col>
                  <Col span={8}>
                    <Form.Item
                      name="notifyOnError"
                      label="同步错误通知"
                      valuePropName="checked"
                    >
                      <Switch />
                    </Form.Item>
                  </Col>
                </Row>
                
                <Form.Item
                  name="logLevel"
                  label="日志级别"
                  rules={[{ required: true, message: '请选择日志级别' }]}
                >
                  <Select placeholder="请选择日志级别">
                    <Option value="debug">调试</Option>
                    <Option value="info">信息</Option>
                    <Option value="warning">警告</Option>
                    <Option value="error">错误</Option>
                  </Select>
                </Form.Item>
                
                <Form.Item>
                  <Button
                    type="primary"
                    htmlType="submit"
                    icon={<SaveOutlined />}
                    loading={loading}
                  >
                    保存配置
                  </Button>
                </Form.Item>
              </Form>
            </Card>
          </Col>
        </Row>
      </Card>
    </div>
  );
};

export default SyncSettings;
