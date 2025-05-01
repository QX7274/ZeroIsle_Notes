import React, { useState, useEffect } from 'react';
import {
  Card, Table, Button, Space, Modal, Form,
  Input, DatePicker, Select, message, Popconfirm,
  Typography, Tabs, Badge, Tag, Row, Col, Tooltip,
  Divider, Empty, Alert
} from 'antd';
import {
  PlusOutlined, EditOutlined, DeleteOutlined,
  ExclamationCircleOutlined, SendOutlined,
  EyeOutlined, ClockCircleOutlined, UserOutlined,
  CalendarOutlined, BellOutlined, FileTextOutlined,
  CheckCircleOutlined, CloseCircleOutlined, InfoCircleOutlined
} from '@ant-design/icons';
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import dayjs from 'dayjs';

const { Option } = Select;
const { RangePicker } = DatePicker;
const { TextArea } = Input;
const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;

const AnnouncementManagement = () => {
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [form] = Form.useForm();
  const [editingId, setEditingId] = useState(null);
  const [previewVisible, setPreviewVisible] = useState(false);
  const [previewAnnouncement, setPreviewAnnouncement] = useState(null);
  const [activeTab, setActiveTab] = useState('all');
  const [stats, setStats] = useState({
    total: 0,
    published: 0,
    draft: 0,
    expired: 0
  });

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  // 更新统计数据
  useEffect(() => {
    const published = announcements.filter(item => item.status === 'published').length;
    const draft = announcements.filter(item => item.status === 'draft').length;
    const expired = announcements.filter(item => item.status === 'expired').length;

    setStats({
      total: announcements.length,
      published,
      draft,
      expired
    });
  }, [announcements]);

  const fetchAnnouncements = async () => {
    setLoading(true);
    try {
      // 在实际应用中，这里应该从API获取公告列表
      // const response = await axios.get('/api/settings/announcements');
      // setAnnouncements(response.data);

      // 模拟API响应
      setTimeout(() => {
        setAnnouncements([
          {
            id: '1',
            title: '系统维护通知',
            content: '<p>尊敬的用户，系统将于2025年5月1日凌晨2:00-4:00进行维护升级，期间系统将不可用。给您带来的不便，敬请谅解。</p>',
            status: 'published',
            start_time: '2025-04-25 00:00:00',
            end_time: '2025-05-05 23:59:59',
            created_by: 'admin',
            created_at: '2025-04-20 10:30:00',
          },
          {
            id: '2',
            title: '新功能发布公告',
            content: '<p>我们很高兴地通知您，零屿笔记新增了以下功能：</p><ul><li>AI辅助写作</li><li>多人协作编辑</li><li>版本历史管理</li></ul>',
            status: 'draft',
            start_time: '2025-05-10 00:00:00',
            end_time: '2025-05-20 23:59:59',
            created_by: 'admin',
            created_at: '2025-04-22 14:15:00',
          },
        ]);
        setLoading(false);
      }, 1000);
    } catch (error) {
      message.error('获取公告列表失败');
      setLoading(false);
    }
  };

  const handleAdd = () => {
    setModalTitle('创建公告');
    setEditingId(null);
    form.resetFields();
    form.setFieldsValue({
      status: 'draft',
    });
    setModalVisible(true);
  };

  const handleEdit = (record) => {
    setModalTitle('编辑公告');
    setEditingId(record.id);
    form.setFieldsValue({
      ...record,
      time_range: [
        dayjs(record.start_time),
        dayjs(record.end_time),
      ],
    });
    setModalVisible(true);
  };

  const handlePreview = (record) => {
    setPreviewAnnouncement(record);
    setPreviewVisible(true);
  };

  const handleDelete = async (id) => {
    try {
      // 在实际应用中，这里应该调用API删除公告
      // await axios.delete(`/api/settings/announcements/${id}`);

      setAnnouncements(announcements.filter(item => item.id !== id));
      message.success('公告删除成功');
    } catch (error) {
      message.error('删除公告失败');
    }
  };

  const handlePublish = async (id) => {
    try {
      // 在实际应用中，这里应该调用API发布公告
      // await axios.post(`/api/settings/announcements/${id}/publish`);

      setAnnouncements(announcements.map(item =>
        item.id === id ? { ...item, status: 'published' } : item
      ));
      message.success('公告发布成功');
    } catch (error) {
      message.error('发布公告失败');
    }
  };

  const handleModalOk = () => {
    form.validateFields().then(async (values) => {
      try {
        const { time_range, ...data } = values;
        const formData = {
          ...data,
          start_time: time_range[0].format('YYYY-MM-DD HH:mm:ss'),
          end_time: time_range[1].format('YYYY-MM-DD HH:mm:ss'),
        };

        if (editingId) {
          // 在实际应用中，这里应该调用API更新公告
          // await axios.put(`/api/settings/announcements/${editingId}`, formData);

          setAnnouncements(announcements.map(item =>
            item.id === editingId ? {
              ...item,
              ...formData,
              created_at: item.created_at,
            } : item
          ));
          message.success('公告更新成功');
        } else {
          // 在实际应用中，这里应该调用API创建公告
          // const response = await axios.post('/api/settings/announcements', formData);

          const newAnnouncement = {
            id: String(announcements.length + 1),
            ...formData,
            created_by: 'admin',
            created_at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
          };
          setAnnouncements([...announcements, newAnnouncement]);
          message.success('公告创建成功');
        }

        setModalVisible(false);
      } catch (error) {
        message.error(editingId ? '更新公告失败' : '创建公告失败');
      }
    });
  };

  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const statusMap = {
          draft: { text: '草稿', color: '#FF9F1C', icon: <ClockCircleOutlined /> },
          published: { text: '已发布', color: '#4CC9F0', icon: <CheckCircleOutlined /> },
          expired: { text: '已过期', color: '#F72585', icon: <CloseCircleOutlined /> },
        };
        return (
          <Tag
            icon={statusMap[status].icon}
            color={status === 'draft' ? 'warning' : status === 'published' ? 'success' : 'error'}
          >
            {statusMap[status].text}
          </Tag>
        );
      },
    },
    {
      title: '开始时间',
      dataIndex: 'start_time',
      key: 'start_time',
    },
    {
      title: '结束时间',
      dataIndex: 'end_time',
      key: 'end_time',
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
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button
            type="primary"
            icon={<EyeOutlined />}
            size="small"
            onClick={() => handlePreview(record)}
          >
            预览
          </Button>

          <Button
            type="primary"
            icon={<EditOutlined />}
            size="small"
            onClick={() => handleEdit(record)}
          >
            编辑
          </Button>

          {record.status === 'draft' && (
            <Button
              type="primary"
              icon={<SendOutlined />}
              size="small"
              onClick={() => handlePublish(record.id)}
            >
              发布
            </Button>
          )}

          <Popconfirm
            title="确定要删除这条公告吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
            icon={<ExclamationCircleOutlined style={{ color: 'red' }} />}
          >
            <Button
              danger
              icon={<DeleteOutlined />}
              size="small"
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  // 根据当前选中的标签过滤公告
  const getFilteredAnnouncements = () => {
    if (activeTab === 'all') return announcements;
    return announcements.filter(item => item.status === activeTab);
  };

  return (
    <div>
      <Card className="announcement-card">
        <div style={{ marginBottom: 24 }}>
          <Row gutter={24}>
            <Col span={6}>
              <Card
                className="settings-card"
                style={{ backgroundColor: 'rgba(67, 97, 238, 0.05)' }}
                hoverable
              >
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <FileTextOutlined style={{ fontSize: 36, color: '#4361EE', marginRight: 16 }} />
                  <div>
                    <div style={{ fontSize: 14, color: 'rgba(0, 0, 0, 0.45)', marginBottom: 4 }}>总公告数</div>
                    <div style={{ fontSize: 24, fontWeight: 600, color: 'rgba(0, 0, 0, 0.85)' }}>{stats.total}</div>
                  </div>
                </div>
              </Card>
            </Col>
            <Col span={6}>
              <Card
                className="settings-card"
                style={{ backgroundColor: 'rgba(76, 201, 240, 0.05)' }}
                hoverable
              >
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <CheckCircleOutlined style={{ fontSize: 36, color: '#4CC9F0', marginRight: 16 }} />
                  <div>
                    <div style={{ fontSize: 14, color: 'rgba(0, 0, 0, 0.45)', marginBottom: 4 }}>已发布</div>
                    <div style={{ fontSize: 24, fontWeight: 600, color: 'rgba(0, 0, 0, 0.85)' }}>{stats.published}</div>
                  </div>
                </div>
              </Card>
            </Col>
            <Col span={6}>
              <Card
                className="settings-card"
                style={{ backgroundColor: 'rgba(255, 159, 28, 0.05)' }}
                hoverable
              >
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <ClockCircleOutlined style={{ fontSize: 36, color: '#FF9F1C', marginRight: 16 }} />
                  <div>
                    <div style={{ fontSize: 14, color: 'rgba(0, 0, 0, 0.45)', marginBottom: 4 }}>草稿</div>
                    <div style={{ fontSize: 24, fontWeight: 600, color: 'rgba(0, 0, 0, 0.85)' }}>{stats.draft}</div>
                  </div>
                </div>
              </Card>
            </Col>
            <Col span={6}>
              <Card
                className="settings-card"
                style={{ backgroundColor: 'rgba(247, 37, 133, 0.05)' }}
                hoverable
              >
                <div style={{ display: 'flex', alignItems: 'center' }}>
                  <CloseCircleOutlined style={{ fontSize: 36, color: '#F72585', marginRight: 16 }} />
                  <div>
                    <div style={{ fontSize: 14, color: 'rgba(0, 0, 0, 0.45)', marginBottom: 4 }}>已过期</div>
                    <div style={{ fontSize: 24, fontWeight: 600, color: 'rgba(0, 0, 0, 0.85)' }}>{stats.expired}</div>
                  </div>
                </div>
              </Card>
            </Col>
          </Row>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <Title level={4} style={{ margin: 0 }}>公告管理</Title>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={handleAdd}
          >
            创建公告
          </Button>
        </div>

        <Tabs
          activeKey={activeTab}
          onChange={setActiveTab}
          className="settings-tabs"
        >
          <TabPane
            tab={
              <span>
                <FileTextOutlined />
                全部公告
              </span>
            }
            key="all"
          />
          <TabPane
            tab={
              <span>
                <CheckCircleOutlined />
                已发布
              </span>
            }
            key="published"
          />
          <TabPane
            tab={
              <span>
                <ClockCircleOutlined />
                草稿
              </span>
            }
            key="draft"
          />
          <TabPane
            tab={
              <span>
                <CloseCircleOutlined />
                已过期
              </span>
            }
            key="expired"
          />
        </Tabs>

        <Table
          columns={columns}
          dataSource={getFilteredAnnouncements()}
          rowKey="id"
          loading={loading}
          pagination={{ pageSize: 10 }}
          className="settings-table"
        />

      <Modal
        title={modalTitle}
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={() => setModalVisible(false)}
        width={800}
        className="settings-modal"
      >
        <Form
          form={form}
          layout="vertical"
          className="settings-form"
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
            />
          </Form.Item>

          <Form.Item
            name="time_range"
            label="有效时间"
            rules={[{ required: true, message: '请选择有效时间' }]}
          >
            <RangePicker
              showTime
              format="YYYY-MM-DD HH:mm:ss"
              style={{ width: '100%' }}
            />
          </Form.Item>

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

          <Alert
            message="提示"
            description="公告发布后将在指定的时间范围内向所有用户显示。过期后将自动停止显示。"
            type="info"
            showIcon
            style={{ marginBottom: 16 }}
          />
        </Form>
      </Modal>

      <Modal
        title="公告预览"
        open={previewVisible}
        onCancel={() => setPreviewVisible(false)}
        footer={[
          <Button key="back" onClick={() => setPreviewVisible(false)}>
            关闭
          </Button>,
          previewAnnouncement?.status === 'draft' && (
            <Button
              key="publish"
              type="primary"
              onClick={() => {
                handlePublish(previewAnnouncement.id);
                setPreviewVisible(false);
              }}
            >
              发布公告
            </Button>
          )
        ]}
        width={700}
      >
        {previewAnnouncement && (
          <div className="announcement-preview">
            <div className="announcement-preview-title">
              {previewAnnouncement.title}
            </div>
            <Divider style={{ margin: '12px 0' }} />
            <div
              className="announcement-preview-content"
              dangerouslySetInnerHTML={{ __html: previewAnnouncement.content }}
            />
            <div className="announcement-preview-meta">
              <span>
                <UserOutlined style={{ marginRight: 4 }} />
                {previewAnnouncement.created_by}
              </span>
              <span>
                <CalendarOutlined style={{ marginRight: 4 }} />
                {previewAnnouncement.created_at}
              </span>
            </div>
          </div>
        )}
      </Modal>
    </Card>
    </div>
  );
};

export default AnnouncementManagement;
