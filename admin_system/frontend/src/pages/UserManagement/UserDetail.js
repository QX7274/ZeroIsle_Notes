import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Card,
  Descriptions,
  Button,
  Tabs,
  Table,
  Tag,
  Space,
  Spin,
  Typography,
  message,
  Popconfirm,
  Avatar,
  Row,
  Col,
  Statistic,
} from 'antd';
import {
  UserOutlined,
  EditOutlined,
  DeleteOutlined,
  LockOutlined,
  UnlockOutlined,
  MailOutlined,
  PhoneOutlined,
  CalendarOutlined,
  FileTextOutlined,
  TagOutlined,
  CommentOutlined,
} from '@ant-design/icons';
import { getUserDetail, updateUserStatus, deleteUser } from '../../services/userService';
import { getUserNotes, getUserComments } from '../../services/contentService';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

const UserDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [user, setUser] = useState(null);
  const [notes, setNotes] = useState([]);
  const [comments, setComments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [notesLoading, setNotesLoading] = useState(false);
  const [commentsLoading, setCommentsLoading] = useState(false);
  
  // 获取用户详情
  const fetchUserDetail = async () => {
    try {
      setLoading(true);
      const data = await getUserDetail(id);
      setUser(data);
    } catch (error) {
      console.error('获取用户详情失败:', error);
      message.error('获取用户详情失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };
  
  // 获取用户笔记
  const fetchUserNotes = async () => {
    try {
      setNotesLoading(true);
      const data = await getUserNotes(id);
      setNotes(data);
    } catch (error) {
      console.error('获取用户笔记失败:', error);
      message.error('获取用户笔记失败，请稍后重试');
    } finally {
      setNotesLoading(false);
    }
  };
  
  // 获取用户评论
  const fetchUserComments = async () => {
    try {
      setCommentsLoading(true);
      const data = await getUserComments(id);
      setComments(data);
    } catch (error) {
      console.error('获取用户评论失败:', error);
      message.error('获取用户评论失败，请稍后重试');
    } finally {
      setCommentsLoading(false);
    }
  };
  
  useEffect(() => {
    fetchUserDetail();
  }, [id]);
  
  // 处理标签页切换
  const handleTabChange = (key) => {
    if (key === '2' && notes.length === 0) {
      fetchUserNotes();
    } else if (key === '3' && comments.length === 0) {
      fetchUserComments();
    }
  };
  
  // 处理更新用户状态
  const handleUpdateStatus = async (status) => {
    try {
      await updateUserStatus(id, status);
      message.success(`${status === 'active' ? '启用' : '禁用'}用户成功`);
      fetchUserDetail();
    } catch (error) {
      console.error('更新用户状态失败:', error);
      message.error('更新用户状态失败，请稍后重试');
    }
  };
  
  // 处理删除用户
  const handleDelete = async () => {
    try {
      await deleteUser(id);
      message.success('删除用户成功');
      navigate('/users');
    } catch (error) {
      console.error('删除用户失败:', error);
      message.error('删除用户失败，请稍后重试');
    }
  };
  
  // 笔记表格列
  const noteColumns = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      render: (text, record) => (
        <a onClick={() => navigate(`/notes/detail/${record.id}`)}>{text}</a>
      ),
    },
    {
      title: '分类',
      dataIndex: 'category',
      key: 'category',
      render: (category) => category?.name || '-',
    },
    {
      title: '标签',
      dataIndex: 'tags',
      key: 'tags',
      render: (tags) => (
        <>
          {tags?.map((tag) => (
            <Tag color="blue" key={tag.id}>
              {tag.name}
            </Tag>
          ))}
        </>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
    },
  ];
  
  // 评论表格列
  const commentColumns = [
    {
      title: '内容',
      dataIndex: 'content',
      key: 'content',
      ellipsis: true,
    },
    {
      title: '所属笔记',
      dataIndex: 'note',
      key: 'note',
      render: (note) => (
        <a onClick={() => navigate(`/notes/detail/${note.id}`)}>{note.title}</a>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
    },
  ];
  
  if (loading) {
    return (
      <div className="loading-container">
        <Spin size="large" />
        <p>加载用户详情...</p>
      </div>
    );
  }
  
  if (!user) {
    return (
      <div className="not-found-container">
        <Title level={3}>未找到用户</Title>
        <Button type="primary" onClick={() => navigate('/users')}>
          返回用户列表
        </Button>
      </div>
    );
  }
  
  return (
    <div className="user-detail-container">
      <Card>
        <div className="page-header">
          <Space>
            <Button onClick={() => navigate('/users')}>返回</Button>
            <Title level={2}>用户详情</Title>
          </Space>
          <Space>
            <Button
              type="primary"
              icon={<EditOutlined />}
              onClick={() => navigate(`/users/edit/${id}`)}
            >
              编辑
            </Button>
            {user.status === 'active' ? (
              <Popconfirm
                title="确定要禁用该用户吗？"
                onConfirm={() => handleUpdateStatus('inactive')}
                okText="确定"
                cancelText="取消"
              >
                <Button danger icon={<LockOutlined />}>
                  禁用
                </Button>
              </Popconfirm>
            ) : (
              <Popconfirm
                title="确定要启用该用户吗？"
                onConfirm={() => handleUpdateStatus('active')}
                okText="确定"
                cancelText="取消"
              >
                <Button icon={<UnlockOutlined />}>启用</Button>
              </Popconfirm>
            )}
            <Popconfirm
              title="确定要删除该用户吗？此操作不可恢复！"
              onConfirm={handleDelete}
              okText="确定"
              cancelText="取消"
              okButtonProps={{ danger: true }}
            >
              <Button danger icon={<DeleteOutlined />}>
                删除
              </Button>
            </Popconfirm>
          </Space>
        </div>
        
        <Row gutter={24} style={{ marginBottom: 24 }}>
          <Col span={6}>
            <Card bordered={false} style={{ textAlign: 'center' }}>
              <Avatar size={80} icon={<UserOutlined />} src={user.avatar} />
              <Title level={4} style={{ marginTop: 16, marginBottom: 0 }}>
                {user.username}
              </Title>
              <Text type="secondary">{user.email}</Text>
              <div style={{ marginTop: 16 }}>
                <Tag color={user.status === 'active' ? 'green' : 'red'}>
                  {user.status === 'active' ? '活跃' : '禁用'}
                </Tag>
              </div>
            </Card>
          </Col>
          <Col span={6}>
            <Statistic
              title="笔记数量"
              value={user.notesCount || 0}
              prefix={<FileTextOutlined />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="评论数量"
              value={user.commentsCount || 0}
              prefix={<CommentOutlined />}
            />
          </Col>
          <Col span={6}>
            <Statistic
              title="标签数量"
              value={user.tagsCount || 0}
              prefix={<TagOutlined />}
            />
          </Col>
        </Row>
        
        <Tabs defaultActiveKey="1" onChange={handleTabChange}>
          <TabPane tab="基本信息" key="1">
            <Descriptions bordered column={{ xxl: 4, xl: 3, lg: 3, md: 2, sm: 1, xs: 1 }}>
              <Descriptions.Item label="用户ID">{user.id}</Descriptions.Item>
              <Descriptions.Item label="用户名">{user.username}</Descriptions.Item>
              <Descriptions.Item label="邮箱">
                <Space>
                  <MailOutlined />
                  {user.email}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="手机号">
                <Space>
                  <PhoneOutlined />
                  {user.phone || '-'}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="状态">
                <Tag color={user.status === 'active' ? 'green' : 'red'}>
                  {user.status === 'active' ? '活跃' : '禁用'}
                </Tag>
              </Descriptions.Item>
              <Descriptions.Item label="注册时间">
                <Space>
                  <CalendarOutlined />
                  {user.createdAt}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="最后登录">
                <Space>
                  <CalendarOutlined />
                  {user.lastLoginAt || '-'}
                </Space>
              </Descriptions.Item>
              <Descriptions.Item label="登录IP">{user.lastLoginIp || '-'}</Descriptions.Item>
              <Descriptions.Item label="个人简介" span={2}>
                {user.bio || '-'}
              </Descriptions.Item>
            </Descriptions>
          </TabPane>
          
          <TabPane tab="笔记列表" key="2">
            <Table
              columns={noteColumns}
              dataSource={notes}
              rowKey="id"
              loading={notesLoading}
              pagination={{ pageSize: 5 }}
            />
          </TabPane>
          
          <TabPane tab="评论列表" key="3">
            <Table
              columns={commentColumns}
              dataSource={comments}
              rowKey="id"
              loading={commentsLoading}
              pagination={{ pageSize: 5 }}
            />
          </TabPane>
        </Tabs>
      </Card>
    </div>
  );
};

export default UserDetail;
