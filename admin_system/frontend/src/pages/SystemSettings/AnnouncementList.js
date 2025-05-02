import React, { useState, useEffect } from 'react';
import {
  Card,
  Table,
  Button,
  Space,
  Tag,
  Modal,
  Form,
  Input,
  DatePicker,
  message,
  Popconfirm,
  Tooltip,
  Badge,
  Select,
  Row,
  Col,
  Typography,
  Switch,
  Tabs,
  Alert,
  Divider,
  Statistic,
  Spin,
  Empty
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  SyncOutlined,
  CheckCircleOutlined,
  ClockCircleOutlined,
  SearchOutlined,
  ReloadOutlined,
  SendOutlined,
  StopOutlined,
  EyeOutlined,
  BellOutlined,
  NotificationOutlined,
  SettingOutlined
} from '@ant-design/icons';
import { PageHeader } from '../../components/common';
import {
  getAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
  publishAnnouncement,
  expireAnnouncement,
  syncAnnouncements,
  sendAnnouncementNotification,
  getAnnouncementStats
} from '../../services/settingService';
import moment from 'dayjs';
import ReactQuill from 'react-quill';

const { TextArea } = Input;
const { RangePicker } = DatePicker;
const { Option } = Select;
const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;

const AnnouncementList = () => {
  const [form] = Form.useForm();
  const [notificationForm] = Form.useForm();
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [previewModalVisible, setPreviewModalVisible] = useState(false);
  const [notificationModalVisible, setNotificationModalVisible] = useState(false);
  const [statsModalVisible, setStatsModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('创建公告');
  const [editingId, setEditingId] = useState(null);
  const [currentAnnouncement, setCurrentAnnouncement] = useState(null);
  const [stats, setStats] = useState({
    totalAnnouncements: 0,
    draftCount: 0,
    publishedCount: 0,
    expiredCount: 0,
    activeCount: 0,
    recentAnnouncements: 0,
    todayNewAnnouncements: 0,
    growthData: [],
    creatorsData: []
  });
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  const [filters, setFilters] = useState({
    status: undefined,
    keyword: '',
    dateRange: []
  });
  const [notificationSettings, setNotificationSettings] = useState({
    enableEmailNotification: true,
    enableAppNotification: true,
    notifyAllUsers: false,
    selectedUserGroups: [],
    notificationDelay: 0,
    sendReminder: false,
    reminderInterval: 24
  });

  // 获取公告列表
  const fetchAnnouncements = async (params = {}) => {
    try {
      setLoading(true);
      const queryParams = {
        page: params.page || pagination.current,
        page_size: params.pageSize || pagination.pageSize,
        status: filters.status,
        search: filters.keyword,
        ordering: '-created_at'
      };

      if (filters.dateRange && filters.dateRange.length === 2) {
        queryParams.start_date = filters.dateRange[0].format('YYYY-MM-DD');
        queryParams.end_date = filters.dateRange[1].format('YYYY-MM-DD');
      }

      const response = await getAnnouncements(queryParams);
      setAnnouncements(response.results || []);
      setPagination({
        ...pagination,
        current: params.page || pagination.current,
        pageSize: params.pageSize || pagination.pageSize,
        total: response.count || 0
      });
    } catch (error) {
      console.error('获取公告列表错误:', error);
      message.error('获取公告列表失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 同步公告数据
  const handleSync = async () => {
    try {
      setSyncing(true);
      const response = await syncAnnouncements({ incremental: true });
      message.success('公告数据同步成功');
      fetchAnnouncements();
    } catch (error) {
      console.error('同步公告数据错误:', error);
      message.error('同步公告数据失败，请稍后重试');
    } finally {
      setSyncing(false);
    }
  };

  // 处理表格变化
  const handleTableChange = (pagination, filters, sorter) => {
    fetchAnnouncements({
      page: pagination.current,
      pageSize: pagination.pageSize
    });
  };

  // 处理搜索
  const handleSearch = () => {
    setPagination({ ...pagination, current: 1 });
    fetchAnnouncements({ page: 1 });
  };

  // 重置搜索
  const handleReset = () => {
    setFilters({
      status: undefined,
      keyword: '',
      dateRange: []
    });
    setPagination({ ...pagination, current: 1 });
    fetchAnnouncements({ page: 1 });
  };

  // 打开创建公告模态框
  const showCreateModal = () => {
    setModalTitle('创建公告');
    setEditingId(null);
    form.resetFields();
    form.setFieldsValue({
      status: 'draft',
      start_time: moment(),
      end_time: moment().add(7, 'days')
    });
    setModalVisible(true);
  };

  // 打开编辑公告模态框
  const showEditModal = (record) => {
    setModalTitle('编辑公告');
    setEditingId(record.id);
    form.setFieldsValue({
      ...record,
      start_time: moment(record.start_time),
      end_time: moment(record.end_time)
    });
    setModalVisible(true);
  };

  // 关闭模态框
  const handleCancel = () => {
    setModalVisible(false);
  };

  // 提交表单
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();

      // 格式化日期
      const formattedValues = {
        ...values,
        start_time: values.start_time.format('YYYY-MM-DDTHH:mm:ss'),
        end_time: values.end_time.format('YYYY-MM-DDTHH:mm:ss')
      };

      if (editingId) {
        // 更新公告
        await updateAnnouncement(editingId, formattedValues);
        message.success('公告更新成功');
      } else {
        // 创建公告
        await createAnnouncement(formattedValues);
        message.success('公告创建成功');
      }

      setModalVisible(false);
      fetchAnnouncements();
    } catch (error) {
      console.error('提交公告表单错误:', error);
      message.error('操作失败，请稍后重试');
    }
  };

  // 删除公告
  const handleDelete = async (id) => {
    try {
      await deleteAnnouncement(id);
      message.success('公告删除成功');
      fetchAnnouncements();
    } catch (error) {
      console.error('删除公告错误:', error);
      message.error('删除公告失败，请稍后重试');
    }
  };

  // 发布公告
  const handlePublish = async (id) => {
    try {
      await publishAnnouncement(id);
      message.success('公告已发布');
      fetchAnnouncements();
    } catch (error) {
      console.error('发布公告错误:', error);
      message.error('发布公告失败，请稍后重试');
    }
  };

  // 发布公告并发送通知
  const handlePublishWithNotification = async (record) => {
    Modal.confirm({
      title: '发布公告并发送通知',
      icon: <NotificationOutlined />,
      content: '确定要发布此公告并发送通知吗？发布后将根据通知设置向用户发送通知。',
      okText: '确定',
      cancelText: '取消',
      onOk: () => {
        showNotificationModal(record, true);
      }
    });
  };

  // 设置公告为过期
  const handleExpire = async (id) => {
    try {
      await expireAnnouncement(id);
      message.success('公告已设置为过期');
      fetchAnnouncements();
    } catch (error) {
      console.error('设置公告为过期错误:', error);
      message.error('设置公告为过期失败，请稍后重试');
    }
  };

  // 预览公告
  const handlePreview = (record) => {
    setCurrentAnnouncement(record);
    setPreviewModalVisible(true);
  };

  // 打开通知设置模态框
  const showNotificationModal = (record, isPublish = false) => {
    setCurrentAnnouncement(record);
    notificationForm.setFieldsValue(notificationSettings);
    setNotificationModalVisible(true);

    // 如果是发布并通知，设置标志
    if (isPublish) {
      notificationForm.setFieldsValue({
        ...notificationSettings,
        isPublishAction: true
      });
    } else {
      notificationForm.setFieldsValue({
        ...notificationSettings,
        isPublishAction: false
      });
    }
  };

  // 保存通知设置
  const handleSaveNotificationSettings = async () => {
    try {
      const values = await notificationForm.validateFields();
      setNotificationSettings(values);

      const isPublishAction = values.isPublishAction;

      // 如果是发布操作，先发布公告再发送通知
      if (isPublishAction && currentAnnouncement && currentAnnouncement.status === 'draft') {
        try {
          await publishAnnouncement(currentAnnouncement.id, values);
          message.success('公告已发布');
          fetchAnnouncements();
        } catch (error) {
          console.error('发布公告错误:', error);
          message.error('发布公告失败，请稍后重试');
          setNotificationModalVisible(false);
          return;
        }
      }

      // 如果是已发布的公告，发送通知
      if (currentAnnouncement && (currentAnnouncement.status === 'published' || isPublishAction)) {
        await handleSendNotification(values);
      } else {
        message.success('通知设置已保存');
        setNotificationModalVisible(false);
      }
    } catch (error) {
      console.error('保存通知设置错误:', error);
      message.error('保存通知设置失败，请稍后重试');
    }
  };

  // 发送通知
  const handleSendNotification = async (values = null) => {
    try {
      const notificationData = values || await notificationForm.validateFields();

      // 发送通知
      const result = await sendAnnouncementNotification(currentAnnouncement.id, notificationData);

      if (result.status === 'success') {
        message.success('通知已发送');
        setNotificationModalVisible(false);
      } else {
        message.error(`发送通知失败: ${result.message}`);
      }
    } catch (error) {
      console.error('发送通知错误:', error);
      message.error('发送通知失败，请稍后重试');
    }
  };

  // 获取公告统计数据
  const fetchAnnouncementStats = async () => {
    try {
      setStatsLoading(true);
      const response = await getAnnouncementStats();

      if (response && response.status === 'success' && response.data) {
        // 处理统计数据
        const statsData = {
          totalAnnouncements: response.data.total_announcements || 0,
          draftCount: response.data.draft_count || 0,
          publishedCount: response.data.published_count || 0,
          expiredCount: response.data.expired_count || 0,
          activeCount: response.data.active_count || 0,
          recentAnnouncements: response.data.recent_announcements || 0,
          todayNewAnnouncements: response.data.today_new_announcements || 0,
          growthData: response.data.growth_data || [],
          creatorsData: response.data.creators_data || []
        };

        setStats(statsData);
      } else {
        console.error('获取公告统计数据格式错误:', response);
        message.error('获取公告统计数据格式错误');
      }
    } catch (error) {
      console.error('获取公告统计数据失败:', error);
      message.error('获取公告统计数据失败，请稍后重试');
    } finally {
      setStatsLoading(false);
    }
  };

  // 显示统计模态框
  const showStatsModal = () => {
    setStatsModalVisible(true);
    fetchAnnouncementStats();
  };

  useEffect(() => {
    fetchAnnouncements();
    fetchAnnouncementStats();
  }, []);

  // 表格列定义
  const columns = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status, record) => {
        let color = 'default';
        let icon = null;
        let text = record.status_display || status;

        switch (status) {
          case 'draft':
            color = 'default';
            icon = <EditOutlined />;
            break;
          case 'published':
            color = 'success';
            icon = <CheckCircleOutlined />;
            break;
          case 'expired':
            color = 'error';
            icon = <ClockCircleOutlined />;
            break;
          default:
            break;
        }

        return (
          <Tag color={color} icon={icon}>
            {text}
          </Tag>
        );
      }
    },
    {
      title: '开始时间',
      dataIndex: 'start_time',
      key: 'start_time',
      render: (text) => moment(text).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '结束时间',
      dataIndex: 'end_time',
      key: 'end_time',
      render: (text) => moment(text).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '创建者',
      dataIndex: 'created_by',
      key: 'created_by',
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      render: (text) => moment(text).format('YYYY-MM-DD HH:mm')
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="预览">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => handlePreview(record)}
            />
          </Tooltip>

          <Tooltip title="编辑">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => showEditModal(record)}
              disabled={record.status === 'expired'}
            />
          </Tooltip>

          {record.status === 'draft' && (
            <>
              <Tooltip title="发布">
                <Button
                  type="text"
                  icon={<SendOutlined />}
                  onClick={() => handlePublish(record.id)}
                />
              </Tooltip>

              <Tooltip title="发布并通知">
                <Button
                  type="text"
                  icon={<NotificationOutlined />}
                  onClick={() => handlePublishWithNotification(record)}
                />
              </Tooltip>
            </>
          )}

          {record.status === 'published' && (
            <>
              <Tooltip title="设为过期">
                <Button
                  type="text"
                  icon={<StopOutlined />}
                  onClick={() => handleExpire(record.id)}
                />
              </Tooltip>

              <Tooltip title="通知设置">
                <Button
                  type="text"
                  icon={<BellOutlined />}
                  onClick={() => showNotificationModal(record)}
                />
              </Tooltip>
            </>
          )}

          <Tooltip title="删除">
            <Popconfirm
              title="确定要删除这条公告吗？"
              onConfirm={() => handleDelete(record.id)}
              okText="确定"
              cancelText="取消"
            >
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
              />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className="announcement-list-page">
      <PageHeader
        title="公告管理"
        subTitle="管理系统公告"
        breadcrumb={[
          { title: '首页', path: '/' },
          { title: '系统设置' },
          { title: '公告管理' }
        ]}
        extra={[
          <Button
            key="sync"
            icon={<SyncOutlined />}
            onClick={handleSync}
            loading={syncing}
          >
            同步公告
          </Button>,
          <Button
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={showCreateModal}
          >
            创建公告
          </Button>,
        ]}
      />

      {/* 统计卡片 */}
      <Row gutter={24} style={{ marginBottom: 24 }}>
        <Col span={6}>
          <Card
            className="stat-card"
            loading={statsLoading}
            hoverable
            onClick={showStatsModal}
          >
            <Statistic
              title="公告总数"
              value={stats.totalAnnouncements}
              prefix={<NotificationOutlined />}
              suffix={
                <Badge
                  count={`今日 +${stats.todayNewAnnouncements}`}
                  style={{
                    backgroundColor: 'rgba(67, 97, 238, 0.1)',
                    color: '#4361EE',
                    fontWeight: 500
                  }}
                />
              }
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card
            className="stat-card"
            loading={statsLoading}
            hoverable
            onClick={showStatsModal}
          >
            <Statistic
              title="已发布公告"
              value={stats.publishedCount}
              prefix={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              valueStyle={{ color: '#52c41a' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card
            className="stat-card"
            loading={statsLoading}
            hoverable
            onClick={showStatsModal}
          >
            <Statistic
              title="草稿公告"
              value={stats.draftCount}
              prefix={<EditOutlined style={{ color: '#faad14' }} />}
              valueStyle={{ color: '#faad14' }}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card
            className="stat-card"
            loading={statsLoading}
            hoverable
            onClick={showStatsModal}
          >
            <Statistic
              title="当前有效公告"
              value={stats.activeCount}
              prefix={<BellOutlined style={{ color: '#1890ff' }} />}
              valueStyle={{ color: '#1890ff' }}
            />
          </Card>
        </Col>
      </Row>

      <Card>
        <div className="table-filter-wrapper" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={6}>
              <Input
                placeholder="搜索公告标题或内容"
                value={filters.keyword}
                onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
                prefix={<SearchOutlined />}
                allowClear
              />
            </Col>
            <Col span={6}>
              <Select
                placeholder="选择状态"
                style={{ width: '100%' }}
                value={filters.status}
                onChange={(value) => setFilters({ ...filters, status: value })}
                allowClear
              >
                <Option value="draft">草稿</Option>
                <Option value="published">已发布</Option>
                <Option value="expired">已过期</Option>
              </Select>
            </Col>
            <Col span={8}>
              <RangePicker
                style={{ width: '100%' }}
                value={filters.dateRange}
                onChange={(dates) => setFilters({ ...filters, dateRange: dates })}
              />
            </Col>
            <Col span={4}>
              <Space>
                <Button type="primary" onClick={handleSearch}>
                  搜索
                </Button>
                <Button onClick={handleReset}>
                  重置
                </Button>
              </Space>
            </Col>
          </Row>
        </div>

        <Table
          columns={columns}
          dataSource={announcements}
          rowKey="id"
          pagination={pagination}
          loading={loading}
          onChange={handleTableChange}
        />
      </Card>

      <Modal
        title={modalTitle}
        open={modalVisible}
        onCancel={handleCancel}
        onOk={handleSubmit}
        width={700}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
        >
          <Form.Item
            name="title"
            label="公告标题"
            rules={[{ required: true, message: '请输入公告标题' }]}
          >
            <Input placeholder="请输入公告标题" />
          </Form.Item>

          <Form.Item
            name="content"
            label="公告内容"
            rules={[{ required: true, message: '请输入公告内容' }]}
          >
            <ReactQuill
              theme="snow"
              style={{ height: 200, marginBottom: 50 }}
              placeholder="请输入公告内容"
            />
          </Form.Item>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item
                name="status"
                label="状态"
                rules={[{ required: true, message: '请选择状态' }]}
              >
                <Select placeholder="请选择状态">
                  <Option value="draft">草稿</Option>
                  <Option value="published">已发布</Option>
                  <Option value="expired">已过期</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="start_time"
                label="开始时间"
                rules={[{ required: true, message: '请选择开始时间' }]}
              >
                <DatePicker
                  showTime
                  style={{ width: '100%' }}
                  format="YYYY-MM-DD HH:mm:ss"
                />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item
                name="end_time"
                label="结束时间"
                rules={[
                  { required: true, message: '请选择结束时间' },
                  ({ getFieldValue }) => ({
                    validator(_, value) {
                      if (!value || !getFieldValue('start_time') || value.isAfter(getFieldValue('start_time'))) {
                        return Promise.resolve();
                      }
                      return Promise.reject(new Error('结束时间必须晚于开始时间'));
                    },
                  }),
                ]}
              >
                <DatePicker
                  showTime
                  style={{ width: '100%' }}
                  format="YYYY-MM-DD HH:mm:ss"
                />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="created_by"
            label="创建者"
            rules={[{ required: true, message: '请输入创建者' }]}
            initialValue="admin"
          >
            <Input placeholder="请输入创建者" />
          </Form.Item>
        </Form>
      </Modal>

      {/* 公告预览模态框 */}
      <Modal
        title="公告预览"
        open={previewModalVisible}
        onCancel={() => setPreviewModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setPreviewModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={700}
      >
        {currentAnnouncement && (
          <div className="announcement-preview">
            <div className="preview-header">
              <Title level={4}>{currentAnnouncement.title}</Title>
              <div className="preview-meta">
                <Space split={<Divider type="vertical" />}>
                  <Text type="secondary">
                    <ClockCircleOutlined /> 有效期: {moment(currentAnnouncement.start_time).format('YYYY-MM-DD')} 至 {moment(currentAnnouncement.end_time).format('YYYY-MM-DD')}
                  </Text>
                  <Text type="secondary">
                    发布者: {currentAnnouncement.created_by}
                  </Text>
                  <Text type="secondary">
                    状态: <Tag color={
                      currentAnnouncement.status === 'published' ? 'success' :
                      currentAnnouncement.status === 'draft' ? 'warning' : 'default'
                    }>
                      {currentAnnouncement.status === 'published' ? '已发布' :
                       currentAnnouncement.status === 'draft' ? '草稿' : '已过期'}
                    </Tag>
                  </Text>
                </Space>
              </div>
            </div>
            <Divider />
            <div className="preview-content">
              <div
                className="announcement-content"
                dangerouslySetInnerHTML={{ __html: currentAnnouncement.content }}
              />
            </div>
          </div>
        )}
      </Modal>

      {/* 通知设置模态框 */}
      <Modal
        title="通知设置"
        open={notificationModalVisible}
        onCancel={() => setNotificationModalVisible(false)}
        onOk={handleSaveNotificationSettings}
        width={700}
      >
        <Form
          form={notificationForm}
          layout="vertical"
          className="notification-settings"
        >
          {/* 隐藏字段，用于标记是否是发布操作 */}
          <Form.Item
            name="isPublishAction"
            hidden
          >
            <Input type="hidden" />
          </Form.Item>

          <Tabs defaultActiveKey="1">
            <TabPane tab="通知方式" key="1">
              <Row gutter={16}>
                <Col span={12}>
                  <Form.Item
                    name="enableEmailNotification"
                    label="邮件通知"
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                </Col>
                <Col span={12}>
                  <Form.Item
                    name="enableAppNotification"
                    label="应用内通知"
                    valuePropName="checked"
                  >
                    <Switch />
                  </Form.Item>
                </Col>
              </Row>
              <Form.Item
                name="notificationDelay"
                label="延迟发送"
                extra="设置通知延迟发送的时间（小时），0表示立即发送"
              >
                <Select>
                  <Option value={0}>立即发送</Option>
                  <Option value={1}>1小时后</Option>
                  <Option value={3}>3小时后</Option>
                  <Option value={6}>6小时后</Option>
                  <Option value={12}>12小时后</Option>
                  <Option value={24}>24小时后</Option>
                </Select>
              </Form.Item>
            </TabPane>
            <TabPane tab="接收对象" key="2">
              <Form.Item
                name="notifyAllUsers"
                label="通知所有用户"
                valuePropName="checked"
              >
                <Switch onChange={(checked) => {
                  // 更新状态，以便禁用/启用用户组选择
                  setNotificationSettings({
                    ...notificationSettings,
                    notifyAllUsers: checked
                  });
                }} />
              </Form.Item>
              <Form.Item
                name="selectedUserGroups"
                label="选择用户组"
                extra="仅当"通知所有用户"关闭时生效"
              >
                <Select
                  mode="multiple"
                  placeholder="请选择用户组"
                  disabled={notificationSettings.notifyAllUsers}
                >
                  <Option value="admin">管理员</Option>
                  <Option value="editor">编辑</Option>
                  <Option value="user">普通用户</Option>
                  <Option value="vip">VIP用户</Option>
                </Select>
              </Form.Item>
            </TabPane>
            <TabPane tab="提醒设置" key="3">
              <Form.Item
                name="sendReminder"
                label="发送提醒"
                valuePropName="checked"
                extra="对于长期有效的公告，可以设置定期提醒"
              >
                <Switch onChange={(checked) => {
                  // 更新状态，以便禁用/启用提醒间隔选择
                  setNotificationSettings({
                    ...notificationSettings,
                    sendReminder: checked
                  });
                }} />
              </Form.Item>
              <Form.Item
                name="reminderInterval"
                label="提醒间隔（小时）"
                extra="设置提醒的间隔时间"
              >
                <Select disabled={!notificationSettings.sendReminder}>
                  <Option value={24}>每天</Option>
                  <Option value={72}>每3天</Option>
                  <Option value={168}>每周</Option>
                  <Option value={336}>每两周</Option>
                  <Option value={720}>每月</Option>
                </Select>
              </Form.Item>
            </TabPane>
          </Tabs>
          <Divider />

          {notificationForm.getFieldValue('isPublishAction') && (
            <Alert
              message="发布并通知"
              description="保存后将发布公告并根据设置发送通知。"
              type="warning"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}

          <Alert
            message="通知提示"
            description="通知将根据设置发送给指定用户。请确保通知内容简洁明了，避免频繁发送通知打扰用户。"
            type="info"
            showIcon
          />
        </Form>
      </Modal>

      {/* 统计详情模态框 */}
      <Modal
        title="公告统计详情"
        open={statsModalVisible}
        onCancel={() => setStatsModalVisible(false)}
        width={800}
        footer={[
          <Button key="close" onClick={() => setStatsModalVisible(false)}>
            关闭
          </Button>
        ]}
      >
        <Spin spinning={statsLoading}>
          <div className="stats-modal-content">
            <Divider orientation="left">基本统计</Divider>
            <Row gutter={[24, 24]}>
              <Col span={6}>
                <Statistic title="公告总数" value={stats.totalAnnouncements} />
              </Col>
              <Col span={6}>
                <Statistic title="已发布公告" value={stats.publishedCount} />
              </Col>
              <Col span={6}>
                <Statistic title="草稿公告" value={stats.draftCount} />
              </Col>
              <Col span={6}>
                <Statistic title="已过期公告" value={stats.expiredCount} />
              </Col>
              <Col span={6}>
                <Statistic title="当前有效公告" value={stats.activeCount} />
              </Col>
              <Col span={6}>
                <Statistic title="最近一周新增" value={stats.recentAnnouncements} />
              </Col>
              <Col span={6}>
                <Statistic title="今日新增" value={stats.todayNewAnnouncements} />
              </Col>
            </Row>

            <Divider orientation="left">公告创建者分布</Divider>
            <Row gutter={[24, 24]}>
              {(stats.creatorsData || []).map((creator) => (
                <Col span={6} key={creator.name}>
                  <Card size="small">
                    <Statistic
                      title={creator.name}
                      value={creator.count}
                      suffix="条公告"
                    />
                  </Card>
                </Col>
              ))}
            </Row>

            <Divider orientation="left">最近30天公告增长趋势</Divider>
            {stats.growthData && stats.growthData.length > 0 ? (
              <div style={{ height: 300 }}>
                {/* 这里可以添加图表组件，如ECharts或Recharts */}
                <Table
                  dataSource={stats.growthData}
                  columns={[
                    { title: '日期', dataIndex: 'date', key: 'date' },
                    { title: '新增公告数', dataIndex: 'count', key: 'count' }
                  ]}
                  pagination={false}
                  size="small"
                  rowKey="date"
                />
              </div>
            ) : (
              <Empty description="暂无数据" />
            )}
          </div>
        </Spin>
      </Modal>
    </div>
  );
};

export default AnnouncementList;
