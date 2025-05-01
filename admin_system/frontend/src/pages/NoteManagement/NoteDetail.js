import React, { useState, useEffect } from 'react';
import {
  Card, Descriptions, Tag, Spin, Button, message,
  Typography, Space, Tabs, Divider, Row, Col, Avatar,
  Tooltip, Popconfirm, Badge, Statistic
} from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeftOutlined, UserOutlined, FileTextOutlined,
  TagOutlined, CalendarOutlined, EyeOutlined, LikeOutlined,
  CommentOutlined, EditOutlined, DeleteOutlined,
  CheckCircleOutlined, ExclamationCircleOutlined,
  HistoryOutlined, DownloadOutlined
} from '@ant-design/icons';
import { getNoteDetail, deleteNote, updateNoteStatus, getNoteVersions } from '../../services/noteService';
import { PageHeader } from '../../components/common';

const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;

const NoteDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [note, setNote] = useState(null);
  const [versions, setVersions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [versionsLoading, setVersionsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('1');

  // 获取笔记详情
  const fetchNoteDetail = async () => {
    try {
      setLoading(true);
      const data = await getNoteDetail(id);
      setNote(data);
    } catch (error) {
      console.error('获取笔记详情失败:', error);
      message.error('获取笔记详情失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 获取笔记版本历史
  const fetchNoteVersions = async () => {
    try {
      setVersionsLoading(true);
      const data = await getNoteVersions(id);
      setVersions(data);
    } catch (error) {
      console.error('获取笔记版本历史失败:', error);
      message.error('获取笔记版本历史失败，请稍后重试');
    } finally {
      setVersionsLoading(false);
    }
  };

  useEffect(() => {
    fetchNoteDetail();
  }, [id]);

  // 处理标签页切换
  const handleTabChange = (key) => {
    setActiveTab(key);
    if (key === '2' && versions.length === 0) {
      fetchNoteVersions();
    }
  };

  // 处理返回
  const handleBack = () => {
    navigate('/notes');
  };

  // 处理删除笔记
  const handleDelete = async () => {
    try {
      await deleteNote(id);
      message.success('删除笔记成功');
      navigate('/notes');
    } catch (error) {
      console.error('删除笔记失败:', error);
      message.error('删除笔记失败，请稍后重试');
    }
  };

  // 处理更新笔记状态
  const handleUpdateStatus = async (status) => {
    try {
      await updateNoteStatus(id, status);
      message.success(`${status === 'published' ? '发布' : '隐藏'}笔记成功`);
      fetchNoteDetail();
    } catch (error) {
      console.error('更新笔记状态失败:', error);
      message.error('更新笔记状态失败，请稍后重试');
    }
  };

  // 处理下载笔记
  const handleDownload = () => {
    if (!note) return;

    try {
      // 创建笔记内容
      let content = `# ${note.title}\n\n`;
      content += `作者: ${note.author.username}\n`;
      content += `分类: ${note.category?.name || '无分类'}\n`;
      content += `标签: ${note.tags?.map(tag => tag.name).join(', ') || '无标签'}\n`;
      content += `创建时间: ${note.createdAt}\n`;
      content += `更新时间: ${note.updatedAt}\n\n`;
      content += `${note.content}\n`;

      // 创建Blob对象
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });

      // 创建下载链接
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      // 设置下载属性
      link.setAttribute('href', url);
      link.setAttribute('download', `${note.title}.md`);
      link.style.visibility = 'hidden';

      // 添加到文档并触发点击
      document.body.appendChild(link);
      link.click();

      // 清理
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      message.success('笔记下载成功');
    } catch (error) {
      console.error('下载笔记失败:', error);
      message.error('下载笔记失败，请稍后重试');
    }
  };

  if (loading) {
    return (
      <div className="loading-container">
        <Spin size="large" />
        <p>加载笔记详情...</p>
      </div>
    );
  }

  if (!note) {
    return (
      <div className="not-found-container">
        <Title level={3}>未找到笔记</Title>
        <Button type="primary" onClick={() => navigate('/notes')}>
          返回笔记列表
        </Button>
      </div>
    );
  }

  return (
    <div className="note-detail-container">
      <PageHeader
        title={note.title}
        subTitle={
          <Badge
            status={note.status === 'published' ? 'success' : 'warning'}
            text={note.status === 'published' ? '已发布' : '草稿'}
          />
        }
        backButton={true}
        onBack={handleBack}
        breadcrumb={[
          { title: '首页', path: '/' },
          { title: '内容管理', path: '/notes' },
          { title: '笔记详情' }
        ]}
        extra={[
          <Button
            key="download"
            icon={<DownloadOutlined />}
            onClick={handleDownload}
          >
            下载
          </Button>,
          note.status === 'published' ? (
            <Popconfirm
              key="hide"
              title="确定要隐藏该笔记吗？"
              description="隐藏后用户将无法看到此笔记"
              onConfirm={() => handleUpdateStatus('draft')}
              okText="确定"
              cancelText="取消"
            >
              <Button icon={<ExclamationCircleOutlined />}>隐藏</Button>
            </Popconfirm>
          ) : (
            <Popconfirm
              key="publish"
              title="确定要发布该笔记吗？"
              description="发布后所有用户都能看到此笔记"
              onConfirm={() => handleUpdateStatus('published')}
              okText="确定"
              cancelText="取消"
            >
              <Button type="primary" icon={<CheckCircleOutlined />}>发布</Button>
            </Popconfirm>
          ),
          <Popconfirm
            key="delete"
            title="确定要删除该笔记吗？"
            description="此操作不可恢复，笔记的所有数据将被删除"
            onConfirm={handleDelete}
            okText="确定"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button danger icon={<DeleteOutlined />}>删除</Button>
          </Popconfirm>
        ]}
      />

      <Row gutter={24} className="note-info-row">
        <Col span={6}>
          <Card bordered={false}>
            <Statistic
              title="浏览量"
              value={note.views || 0}
              prefix={<EyeOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false}>
            <Statistic
              title="点赞数"
              value={note.likes || 0}
              prefix={<LikeOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false}>
            <Statistic
              title="评论数"
              value={note.commentsCount || 0}
              prefix={<CommentOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card bordered={false}>
            <Statistic
              title="版本数"
              value={versions.length || 1}
              prefix={<HistoryOutlined />}
            />
          </Card>
        </Col>
      </Row>

      <Tabs activeKey={activeTab} onChange={handleTabChange}>
        <TabPane tab="基本信息" key="1">
          <Card>
            <Row gutter={24}>
              <Col span={18}>
                <Descriptions bordered column={2} size="middle">
                  <Descriptions.Item label="ID" span={2}>{note.id}</Descriptions.Item>
                  <Descriptions.Item label={<><UserOutlined /> 作者</>}>
                    <Space>
                      <Avatar size="small" icon={<UserOutlined />} src={note.author?.avatar} />
                      <a onClick={() => navigate(`/users/detail/${note.author?.id}`)}>{note.author?.username}</a>
                    </Space>
                  </Descriptions.Item>
                  <Descriptions.Item label={<><FileTextOutlined /> 分类</>}>
                    {note.category?.name || '无分类'}
                  </Descriptions.Item>
                  <Descriptions.Item label={<><TagOutlined /> 标签</>} span={2}>
                    {note.tags?.length > 0 ? (
                      note.tags.map(tag => (
                        <Tag color={tag.color || 'blue'} key={tag.id}>
                          {tag.name}
                        </Tag>
                      ))
                    ) : (
                      <Text type="secondary">无标签</Text>
                    )}
                  </Descriptions.Item>
                  <Descriptions.Item label={<><CalendarOutlined /> 创建时间</>}>
                    {note.createdAt}
                  </Descriptions.Item>
                  <Descriptions.Item label={<><CalendarOutlined /> 更新时间</>}>
                    {note.updatedAt}
                  </Descriptions.Item>
                </Descriptions>
              </Col>
              <Col span={6}>
                <Card title="笔记状态" size="small">
                  <div style={{ textAlign: 'center' }}>
                    <Badge
                      status={note.status === 'published' ? 'success' : 'warning'}
                      text={
                        <Text style={{ fontSize: '16px' }}>
                          {note.status === 'published' ? '已发布' : '草稿'}
                        </Text>
                      }
                    />
                    <div style={{ marginTop: '16px' }}>
                      {note.status === 'published' ? (
                        <Button
                          icon={<ExclamationCircleOutlined />}
                          onClick={() => handleUpdateStatus('draft')}
                        >
                          隐藏笔记
                        </Button>
                      ) : (
                        <Button
                          type="primary"
                          icon={<CheckCircleOutlined />}
                          onClick={() => handleUpdateStatus('published')}
                        >
                          发布笔记
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              </Col>
            </Row>

            <Divider orientation="left">笔记内容</Divider>
            <div className="note-content">
              <Paragraph>
                {note.content}
              </Paragraph>
            </div>
          </Card>
        </TabPane>

        <TabPane tab="版本历史" key="2">
          <Card loading={versionsLoading}>
            {versions.length > 0 ? (
              <Table
                dataSource={versions}
                rowKey="id"
                columns={[
                  {
                    title: '版本号',
                    dataIndex: 'version',
                    key: 'version',
                  },
                  {
                    title: '修改时间',
                    dataIndex: 'createdAt',
                    key: 'createdAt',
                  },
                  {
                    title: '修改者',
                    dataIndex: 'createdBy',
                    key: 'createdBy',
                    render: (user) => user?.username || '-',
                  },
                  {
                    title: '操作',
                    key: 'action',
                    render: (_, record) => (
                      <Space>
                        <Button type="link" size="small">查看此版本</Button>
                        <Button type="link" size="small">恢复此版本</Button>
                      </Space>
                    ),
                  },
                ]}
                pagination={false}
              />
            ) : (
              <Empty description="暂无版本历史记录" />
            )}
          </Card>
        </TabPane>
      </Tabs>
    </div>
  );
};

export default NoteDetail;
