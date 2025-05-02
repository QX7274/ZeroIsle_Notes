import React, { useState, useEffect } from 'react';
import {
  Table, Input, Button, Space, Tag, Popconfirm, message,
  Card, Select, DatePicker, Row, Col, Typography, Tooltip,
  Badge, Statistic, Avatar, Divider, Dropdown, Menu, Empty,
  Modal
} from 'antd';
import {
  SearchOutlined, EditOutlined, DeleteOutlined, EyeOutlined,
  PlusOutlined, TagOutlined, AppstoreOutlined, UserOutlined,
  FileTextOutlined, CalendarOutlined, FilterOutlined,
  SortAscendingOutlined, SortDescendingOutlined, ReloadOutlined,
  DownloadOutlined, CheckCircleOutlined, StopOutlined,
  ExportOutlined, MoreOutlined, FileSearchOutlined,
  ExclamationCircleOutlined, LikeOutlined, CommentOutlined,
  CloudDownloadOutlined, CopyOutlined, LinkOutlined
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import {
  getNotes,
  deleteNote,
  updateNoteStatus,
  getNoteStats,
  batchDeleteNotes,
  batchUpdateNoteStatus,
  exportNotes,
  syncNotes
} from '../../services/contentService';
import { getCategories, syncCategories } from '../../services/contentService';
import { getTags, syncTags } from '../../services/contentService';
import { PageHeader } from '../../components/common';
import { exportToExcel } from '../../utils/exportUtils';

const { RangePicker } = DatePicker;
const { Option } = Select;
const { Title, Text } = Typography;

const NoteList = () => {
  const [notes, setNotes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsModalVisible, setStatsModalVisible] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
    showSizeChanger: true,
    showQuickJumper: true,
    showTotal: (total) => `共 ${total} 条记录`,
  });
  const [filters, setFilters] = useState({
    keyword: '',
    categoryId: undefined,
    tagId: undefined,
    status: 'all',
    dateRange: null,
  });
  const [stats, setStats] = useState({
    totalNotes: 0,
    publishedNotes: 0,
    draftNotes: 0,
    todayNewNotes: 0,
  });
  const [sortField, setSortField] = useState('updatedAt');
  const [sortOrder, setSortOrder] = useState('descend');
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  const [selectedRows, setSelectedRows] = useState([]);

  const navigate = useNavigate();

  // 获取笔记列表
  const fetchNotes = async (params = {}) => {
    try {
      setLoading(true);
      const response = await getNotes({
        page: params.page || pagination.current,
        pageSize: params.pageSize || pagination.pageSize,
        keyword: filters.keyword,
        categoryId: filters.categoryId,
        tagId: filters.tagId,
        status: filters.status !== 'all' ? filters.status : undefined,
        startDate: filters.dateRange?.[0]?.format('YYYY-MM-DD'),
        endDate: filters.dateRange?.[1]?.format('YYYY-MM-DD'),
        sortField: params.sortField,
        sortOrder: params.sortOrder,
      });

      setNotes(response.data);
      setPagination({
        ...pagination,
        current: params.page || pagination.current,
        pageSize: params.pageSize || pagination.pageSize,
        total: response.total,
      });
    } catch (error) {
      console.error('获取笔记列表失败:', error);
      message.error('获取笔记列表失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 获取分类列表
  const fetchCategories = async () => {
    try {
      const data = await getCategories();
      setCategories(data);
    } catch (error) {
      console.error('获取分类列表失败:', error);
    }
  };

  // 获取标签列表
  const fetchTags = async () => {
    try {
      const data = await getTags();
      setTags(data);
    } catch (error) {
      console.error('获取标签列表失败:', error);
    }
  };

  // 获取笔记统计数据
  const fetchNoteStats = async () => {
    try {
      setStatsLoading(true);
      const response = await getNoteStats();

      if (response && response.status === 'success' && response.data) {
        // 处理统计数据
        const statsData = {
          totalNotes: response.data.total_notes || 0,
          publishedNotes: response.data.published_notes || 0,
          draftNotes: response.data.draft_notes || 0,
          todayNewNotes: response.data.today_new_notes || 0,
          publicNotes: response.data.public_notes || 0,
          privateNotes: response.data.private_notes || 0,
          recentNotes: response.data.recent_notes || 0,
          noteTypes: response.data.note_types || {},
          noteStatus: response.data.note_status || {},
          growthData: response.data.growth_data || [],
          topCategories: response.data.top_categories || [],
          topTags: response.data.top_tags || [],
          topViewedNotes: response.data.top_viewed_notes || [],
          topLikedNotes: response.data.top_liked_notes || [],
          topCommentedNotes: response.data.top_commented_notes || []
        };

        setStats(statsData);
      } else {
        console.error('获取笔记统计数据格式错误:', response);
        message.error('获取笔记统计数据格式错误');
      }
    } catch (error) {
      console.error('获取笔记统计数据失败:', error);
      message.error('获取笔记统计数据失败，请稍后重试');
    } finally {
      setStatsLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();
    fetchCategories();
    fetchTags();
    fetchNoteStats();
  }, []);

  // 处理表格变化
  const handleTableChange = (pagination, filters, sorter) => {
    if (sorter.field && sorter.order) {
      setSortField(sorter.field);
      setSortOrder(sorter.order);
    }

    fetchNotes({
      page: pagination.current,
      pageSize: pagination.pageSize,
      sortField: sorter.field,
      sortOrder: sorter.order,
    });
  };

  // 导出笔记数据
  const handleExport = async () => {
    try {
      setLoading(true);
      // 准备导出参数
      const exportFilters = {
        keyword: filters.keyword,
        status: filters.status !== 'all' ? filters.status : undefined,
        categoryId: filters.categoryId,
        tagId: filters.tagId,
        start_date: filters.dateRange?.[0]?.format('YYYY-MM-DD'),
        end_date: filters.dateRange?.[1]?.format('YYYY-MM-DD'),
      };

      // 调用API导出数据
      const result = await exportNotes(exportFilters);

      if (result.data && result.data.length > 0) {
        // 准备导出数据
        const exportData = result.data.map(note => ({
          标题: note.title,
          作者: note.username || '',
          分类: note.category_name || '无分类',
          状态: note.status_display || (note.status === 'published' ? '已发布' : '草稿'),
          笔记类型: note.note_type_display || note.note_type,
          是否公开: note.is_public ? '是' : '否',
          浏览量: note.view_count || 0,
          点赞数: note.like_count || 0,
          评论数: note.comment_count || 0,
          创建时间: note.created_at,
          更新时间: note.updated_at
        }));

        // 导出Excel
        exportToExcel(exportData, '笔记列表');
        message.success(result.message || '导出成功');
      } else {
        message.info('没有符合条件的数据可导出');
      }
    } catch (error) {
      console.error('导出失败:', error);
      message.error('导出失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 刷新数据
  const handleRefresh = () => {
    fetchNotes();
    fetchCategories();
    fetchTags();
    fetchNoteStats();
    message.success('数据已刷新');
  };

  // 处理下载笔记
  const handleDownload = (record) => {
    try {
      // 创建笔记内容
      let content = `# ${record.title}\n\n`;
      content += `作者: ${record.author?.username || ''}\n`;
      content += `分类: ${record.category?.name || '无分类'}\n`;
      content += `标签: ${record.tags?.map(tag => tag.name).join(', ') || '无标签'}\n`;
      content += `创建时间: ${record.createdAt}\n`;
      content += `更新时间: ${record.updatedAt}\n\n`;
      content += `${record.content || ''}\n`;

      // 创建Blob对象
      const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });

      // 创建下载链接
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);

      // 设置下载属性
      link.setAttribute('href', url);
      link.setAttribute('download', `${record.title}.md`);
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

  // 显示删除确认对话框
  const showDeleteConfirm = (record) => {
    Modal.confirm({
      title: '确定要删除该笔记吗？',
      content: '此操作不可恢复，笔记的所有数据将被删除',
      okText: '确定',
      okType: 'danger',
      cancelText: '取消',
      onOk() {
        handleDelete(record.id);
      },
    });
  };

  // 导出笔记数据
  const handleExport = () => {
    try {
      // 准备导出数据
      const exportData = notes.map(note => ({
        标题: note.title,
        作者: note.author?.username || '',
        分类: note.category?.name || '无分类',
        标签: note.tags?.map(tag => tag.name).join(', ') || '',
        状态: note.status === 'published' ? '已发布' : '草稿',
        创建时间: note.createdAt,
        更新时间: note.updatedAt,
        浏览量: note.views || 0,
        点赞数: note.likes || 0,
      }));

      // 导出Excel
      exportToExcel(exportData, '笔记列表');
      message.success('导出成功');
    } catch (error) {
      console.error('导出失败:', error);
      message.error('导出失败，请稍后重试');
    }
  };

  // 刷新数据
  const handleRefresh = () => {
    fetchNotes();
    fetchNoteStats();
    message.success('数据已刷新');
  };

  // 同步数据
  const handleSync = async () => {
    try {
      setLoading(true);
      message.loading('正在同步数据，请稍候...', 0);

      // 同步笔记数据
      const result = await syncNotes({ incremental: true });

      message.destroy();
      message.success(result.message || '数据同步成功');

      // 刷新数据
      fetchNotes();
      fetchNoteStats();
    } catch (error) {
      console.error('同步数据失败:', error);
      message.destroy();
      message.error('同步数据失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 处理搜索
  const handleSearch = () => {
    setPagination({ ...pagination, current: 1 });
    fetchNotes({ page: 1 });
  };

  // 处理重置
  const handleReset = () => {
    setFilters({
      keyword: '',
      categoryId: undefined,
      tagId: undefined,
      status: 'all',
      dateRange: null,
    });
    setPagination({ ...pagination, current: 1 });
    fetchNotes({ page: 1 });
  };

  // 处理删除笔记
  const handleDelete = async (id) => {
    try {
      await deleteNote(id);
      message.success('删除笔记成功');
      fetchNotes();
    } catch (error) {
      console.error('删除笔记失败:', error);
      message.error('删除笔记失败，请稍后重试');
    }
  };

  // 处理更新笔记状态
  const handleUpdateStatus = async (id, status) => {
    try {
      await updateNoteStatus(id, status);
      message.success(`${status === 'published' ? '发布' : '隐藏'}笔记成功`);
      fetchNotes();
    } catch (error) {
      console.error('更新笔记状态失败:', error);
      message.error('更新笔记状态失败，请稍后重试');
    }
  };

  // 表格列定义
  const columns = [
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      render: (text, record) => (
        <a onClick={() => navigate(`/notes/detail/${record.id}`)}>{text}</a>
      ),
    },
    {
      title: '作者',
      dataIndex: 'author',
      key: 'author',
      render: (author) => (
        <a onClick={() => navigate(`/users/detail/${author.id}`)}>{author.username}</a>
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
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => (
        <Tag color={status === 'published' ? 'green' : 'orange'}>
          {status === 'published' ? '已发布' : '草稿'}
        </Tag>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      sorter: true,
    },
    {
      title: '更新时间',
      dataIndex: 'updatedAt',
      key: 'updatedAt',
      sorter: true,
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button
            type="text"
            icon={<EyeOutlined />}
            onClick={() => navigate(`/notes/detail/${record.id}`)}
          />
          {record.status === 'published' ? (
            <Popconfirm
              title="确定要隐藏该笔记吗？"
              onConfirm={() => handleUpdateStatus(record.id, 'draft')}
              okText="确定"
              cancelText="取消"
            >
              <Button type="text" icon={<ExclamationCircleOutlined />} />
            </Popconfirm>
          ) : (
            <Popconfirm
              title="确定要发布该笔记吗？"
              onConfirm={() => handleUpdateStatus(record.id, 'published')}
              okText="确定"
              cancelText="取消"
            >
              <Button type="text" icon={<CheckCircleOutlined />} />
            </Popconfirm>
          )}
          <Popconfirm
            title="确定要删除该笔记吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
          >
            <Button type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="note-list-container">
      <PageHeader
        title="内容管理"
        subTitle="管理系统中的笔记和文档"
        breadcrumb={[
          { title: '首页', path: '/' },
          { title: '内容管理' }
        ]}
        extra={[
          <Button
            key="categories"
            icon={<AppstoreOutlined />}
            onClick={() => navigate('/notes/categories')}
          >
            分类管理
          </Button>,
          <Button
            key="tags"
            icon={<TagOutlined />}
            onClick={() => navigate('/notes/tags')}
          >
            标签管理
          </Button>,
          <Button
            key="export"
            icon={<ExportOutlined />}
            onClick={handleExport}
          >
            导出
          </Button>,
          <Button
            key="sync"
            icon={<CloudDownloadOutlined />}
            onClick={handleSync}
          >
            同步数据
          </Button>,
          <Button
            key="refresh"
            icon={<ReloadOutlined />}
            onClick={handleRefresh}
          >
            刷新
          </Button>,
          <Button
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/notes/create')}
          >
            创建笔记
          </Button>,
        ]}
      />

      <Row gutter={24} className="stats-row">
        <Col span={6}>
          <Card
            className="content-stat-card"
            loading={statsLoading}
            hoverable
            onClick={() => setStatsModalVisible(true)}
          >
            <div className="content-stat-icon" style={{ backgroundColor: 'rgba(67, 97, 238, 0.1)' }}>
              <FileTextOutlined style={{ color: '#4361EE' }} />
            </div>
            <div className="content-stat-content">
              <div className="content-stat-title">总笔记数</div>
              <div className="content-stat-value">{stats.totalNotes}</div>
              <div className="content-stat-footer">
                <Badge
                  count={`今日 +${stats.todayNewNotes}`}
                  className="stat-badge"
                  style={{
                    backgroundColor: 'rgba(67, 97, 238, 0.1)',
                    color: '#4361EE',
                    fontWeight: 500
                  }}
                />
              </div>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card
            className="content-stat-card"
            loading={statsLoading}
            hoverable
            onClick={() => setStatsModalVisible(true)}
          >
            <div className="content-stat-icon" style={{ backgroundColor: 'rgba(76, 201, 240, 0.1)' }}>
              <CheckCircleOutlined style={{ color: '#4CC9F0' }} />
            </div>
            <div className="content-stat-content">
              <div className="content-stat-title">已发布笔记</div>
              <div className="content-stat-value">{stats.publishedNotes}</div>
              <div className="content-stat-footer">
                <Badge
                  count={`${Math.round((stats.publishedNotes / (stats.totalNotes || 1)) * 100)}%`}
                  className="stat-badge"
                  style={{
                    backgroundColor: 'rgba(76, 201, 240, 0.1)',
                    color: '#4CC9F0',
                    fontWeight: 500
                  }}
                />
              </div>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card
            className="content-stat-card"
            loading={statsLoading}
            hoverable
            onClick={() => setStatsModalVisible(true)}
          >
            <div className="content-stat-icon" style={{ backgroundColor: 'rgba(255, 159, 28, 0.1)' }}>
              <FileSearchOutlined style={{ color: '#FF9F1C' }} />
            </div>
            <div className="content-stat-content">
              <div className="content-stat-title">草稿笔记</div>
              <div className="content-stat-value">{stats.draftNotes}</div>
              <div className="content-stat-footer">
                <Badge
                  count={`${Math.round((stats.draftNotes / (stats.totalNotes || 1)) * 100)}%`}
                  className="stat-badge"
                  style={{
                    backgroundColor: 'rgba(255, 159, 28, 0.1)',
                    color: '#FF9F1C',
                    fontWeight: 500
                  }}
                />
              </div>
            </div>
          </Card>
        </Col>
        <Col span={6}>
          <Card
            className="content-stat-card"
            loading={statsLoading}
            hoverable
            onClick={() => setStatsModalVisible(true)}
          >
            <div className="content-stat-icon" style={{ backgroundColor: 'rgba(58, 12, 163, 0.1)' }}>
              <PlusOutlined style={{ color: '#3A0CA3' }} />
            </div>
            <div className="content-stat-content">
              <div className="content-stat-title">今日新增</div>
              <div className="content-stat-value">{stats.todayNewNotes}</div>
              <div className="content-stat-footer">
                <Badge
                  count="新增笔记"
                  className="stat-badge"
                  style={{
                    backgroundColor: 'rgba(58, 12, 163, 0.1)',
                    color: '#3A0CA3',
                    fontWeight: 500
                  }}
                />
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      {selectedRowKeys.length > 0 && (
        <div className="batch-actions-toolbar">
          <div className="batch-actions-info">
            已选择 <Text strong>{selectedRowKeys.length}</Text> 项
          </div>
          <div className="batch-actions-buttons">
            <Button
              onClick={() => {
                Modal.confirm({
                  title: '批量发布笔记',
                  content: `确定要发布选中的 ${selectedRowKeys.length} 个笔记吗？`,
                  onOk: async () => {
                    try {
                      setLoading(true);
                      const result = await batchUpdateNoteStatus(selectedRowKeys, 'published');
                      message.success(result.message || `已成功发布 ${result.updated_count} 个笔记`);
                      setSelectedRowKeys([]);
                      setSelectedRows([]);
                      fetchNotes();
                      fetchNoteStats();
                    } catch (error) {
                      console.error('批量发布失败:', error);
                      message.error('批量发布失败，请稍后重试');
                    } finally {
                      setLoading(false);
                    }
                  }
                });
              }}
              icon={<CheckCircleOutlined />}
            >
              批量发布
            </Button>
            <Button
              onClick={() => {
                Modal.confirm({
                  title: '批量设为草稿',
                  content: `确定要将选中的 ${selectedRowKeys.length} 个笔记设为草稿吗？`,
                  onOk: async () => {
                    try {
                      setLoading(true);
                      const result = await batchUpdateNoteStatus(selectedRowKeys, 'draft');
                      message.success(result.message || `已成功将 ${result.updated_count} 个笔记设为草稿`);
                      setSelectedRowKeys([]);
                      setSelectedRows([]);
                      fetchNotes();
                      fetchNoteStats();
                    } catch (error) {
                      console.error('批量设为草稿失败:', error);
                      message.error('批量设为草稿失败，请稍后重试');
                    } finally {
                      setLoading(false);
                    }
                  }
                });
              }}
              icon={<FileSearchOutlined />}
            >
              批量设为草稿
            </Button>
            <Button
              onClick={() => {
                Modal.confirm({
                  title: '批量删除笔记',
                  content: `确定要删除选中的 ${selectedRowKeys.length} 个笔记吗？此操作不可恢复！`,
                  okButtonProps: { danger: true },
                  onOk: async () => {
                    try {
                      setLoading(true);
                      const result = await batchDeleteNotes(selectedRowKeys);
                      message.success(result.message || `已成功删除 ${result.deleted_count} 个笔记`);
                      setSelectedRowKeys([]);
                      setSelectedRows([]);
                      fetchNotes();
                      fetchNoteStats();
                    } catch (error) {
                      console.error('批量删除失败:', error);
                      message.error('批量删除失败，请稍后重试');
                    } finally {
                      setLoading(false);
                    }
                  }
                });
              }}
              icon={<DeleteOutlined />}
              danger
            >
              批量删除
            </Button>
            <Button
              onClick={async () => {
                // 导出选中笔记数据
                try {
                  setLoading(true);
                  // 调用API导出选中笔记数据
                  const result = await exportNotes({}, selectedRowKeys);

                  if (result.data && result.data.length > 0) {
                    // 准备导出数据
                    const exportData = result.data.map(note => ({
                      标题: note.title,
                      作者: note.username || '',
                      分类: note.category_name || '无分类',
                      状态: note.status_display || (note.status === 'published' ? '已发布' : '草稿'),
                      笔记类型: note.note_type_display || note.note_type,
                      是否公开: note.is_public ? '是' : '否',
                      浏览量: note.view_count || 0,
                      点赞数: note.like_count || 0,
                      评论数: note.comment_count || 0,
                      创建时间: note.created_at,
                      更新时间: note.updated_at
                    }));

                    // 导出Excel
                    exportToExcel(exportData, '选中笔记列表');
                    message.success(result.message || '导出成功');
                  } else {
                    message.info('没有符合条件的数据可导出');
                  }
                } catch (error) {
                  console.error('导出失败:', error);
                  message.error('导出失败，请稍后重试');
                } finally {
                  setLoading(false);
                }
              }}
              icon={<ExportOutlined />}
            >
              导出选中
            </Button>
            <Button
              onClick={() => {
                setSelectedRowKeys([]);
                setSelectedRows([]);
              }}
            >
              取消选择
            </Button>
          </div>
        </div>
      )}

      <div className="content-search-form">
        <Row gutter={24}>
          <Col span={8}>
            <Input
              placeholder="搜索标题/内容"
              value={filters.keyword}
              onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
              allowClear
              prefix={<SearchOutlined />}
              size="large"
              style={{ borderRadius: '10px' }}
            />
          </Col>
          <Col span={4}>
            <Select
              placeholder="选择分类"
              value={filters.categoryId}
              onChange={(value) => setFilters({ ...filters, categoryId: value })}
              style={{ width: '100%' }}
              allowClear
              size="large"
              dropdownStyle={{ borderRadius: '10px' }}
            >
              {categories.map((category) => (
                <Option key={category.id} value={category.id}>
                  {category.name}
                </Option>
              ))}
            </Select>
          </Col>
          <Col span={4}>
            <Select
              placeholder="选择标签"
              value={filters.tagId}
              onChange={(value) => setFilters({ ...filters, tagId: value })}
              style={{ width: '100%' }}
              allowClear
              size="large"
              dropdownStyle={{ borderRadius: '10px' }}
            >
              {tags.map((tag) => (
                <Option key={tag.id} value={tag.id}>
                  {tag.name}
                </Option>
              ))}
            </Select>
          </Col>
          <Col span={3}>
            <Select
              placeholder="笔记状态"
              value={filters.status}
              onChange={(value) => setFilters({ ...filters, status: value })}
              style={{ width: '100%' }}
              size="large"
              dropdownStyle={{ borderRadius: '10px' }}
            >
              <Option value="all">全部状态</Option>
              <Option value="published">已发布</Option>
              <Option value="draft">草稿</Option>
            </Select>
          </Col>
          <Col span={5}>
            <RangePicker
              value={filters.dateRange}
              onChange={(dates) => setFilters({ ...filters, dateRange: dates })}
              style={{ width: '100%' }}
              placeholder={['开始日期', '结束日期']}
              size="large"
              ranges={{
                '今天': [moment(), moment()],
                '本周': [moment().startOf('week'), moment().endOf('week')],
                '本月': [moment().startOf('month'), moment().endOf('month')],
                '上个月': [moment().subtract(1, 'month').startOf('month'), moment().subtract(1, 'month').endOf('month')],
              }}
            />
          </Col>
          <Col span={0}>
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
        <Row style={{ marginTop: 16 }}>
          <Col span={24} style={{ textAlign: 'right' }}>
            <Space>
              <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch} size="large">
                搜索
              </Button>
              <Button icon={<ReloadOutlined />} onClick={handleReset} size="large">
                重置
              </Button>
            </Space>
          </Col>
        </Row>
      </div>

      <Card className="content-table-card">
        <div style={{ padding: '16px 24px', borderBottom: '1px solid rgba(0, 0, 0, 0.05)' }}>
          <Space size={16}>
            <Typography.Title level={5} style={{ margin: 0 }}>笔记列表</Typography.Title>
            <Typography.Text type="secondary">共 {pagination.total} 条记录</Typography.Text>
          </Space>
        </div>
        {notes.length > 0 ? (
          <Table
            columns={columns}
            dataSource={notes}
            rowKey="id"
            pagination={pagination}
            loading={loading}
            onChange={handleTableChange}
            scroll={{ x: 1200 }}
            size="middle"
            rowSelection={{
              type: 'checkbox',
              selectedRowKeys,
              onChange: (selectedRowKeys, selectedRows) => {
                setSelectedRowKeys(selectedRowKeys);
                setSelectedRows(selectedRows);
              },
              selections: [
                Table.SELECTION_ALL,
                Table.SELECTION_INVERT,
                {
                  key: 'published',
                  text: '选择所有已发布笔记',
                  onSelect: changableRowKeys => {
                    let newSelectedRowKeys = [];
                    notes.forEach((note) => {
                      if (note.status === 'published') {
                        newSelectedRowKeys.push(note.id);
                      }
                    });
                    return newSelectedRowKeys;
                  },
                },
                {
                  key: 'draft',
                  text: '选择所有草稿笔记',
                  onSelect: changableRowKeys => {
                    let newSelectedRowKeys = [];
                    notes.forEach((note) => {
                      if (note.status === 'draft') {
                        newSelectedRowKeys.push(note.id);
                      }
                    });
                    return newSelectedRowKeys;
                  },
                },
              ],
            }}
          />
        ) : (
          <Empty
            description={
              <span>
                暂无笔记数据
                <Button
                  type="link"
                  onClick={() => navigate('/notes/create')}
                >
                  立即创建
                </Button>
              </span>
            }
            style={{ padding: '40px 0' }}
          />
        )}
      </Card>

      {/* 统计详情模态框 */}
      <Modal
        title="笔记统计详情"
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
                <Statistic title="总笔记数" value={stats.totalNotes} />
              </Col>
              <Col span={6}>
                <Statistic title="已发布笔记" value={stats.publishedNotes} />
              </Col>
              <Col span={6}>
                <Statistic title="草稿笔记" value={stats.draftNotes} />
              </Col>
              <Col span={6}>
                <Statistic title="今日新增" value={stats.todayNewNotes} />
              </Col>
              <Col span={6}>
                <Statistic title="公开笔记" value={stats.publicNotes} />
              </Col>
              <Col span={6}>
                <Statistic title="私密笔记" value={stats.privateNotes} />
              </Col>
              <Col span={6}>
                <Statistic title="最近一周新增" value={stats.recentNotes} />
              </Col>
            </Row>

            <Divider orientation="left">笔记类型分布</Divider>
            <Row gutter={[24, 24]}>
              {Object.entries(stats.noteTypes || {}).map(([type, data]) => (
                <Col span={6} key={type}>
                  <Card size="small">
                    <Statistic
                      title={data.display || type}
                      value={data.count}
                      suffix={`(${Math.round((data.count / (stats.totalNotes || 1)) * 100)}%)`}
                    />
                  </Card>
                </Col>
              ))}
            </Row>

            <Divider orientation="left">热门分类</Divider>
            <Row gutter={[24, 24]}>
              {(stats.topCategories || []).map((category) => (
                <Col span={6} key={category.id}>
                  <Card size="small">
                    <Statistic
                      title={category.name}
                      value={category.note_count}
                      suffix="篇笔记"
                    />
                  </Card>
                </Col>
              ))}
            </Row>

            <Divider orientation="left">热门标签</Divider>
            <Row gutter={[24, 24]}>
              {(stats.topTags || []).map((tag) => (
                <Col span={6} key={tag.id}>
                  <Card size="small">
                    <Statistic
                      title={tag.name}
                      value={tag.note_count}
                      suffix="篇笔记"
                    />
                  </Card>
                </Col>
              ))}
            </Row>

            <Divider orientation="left">浏览量最高的笔记</Divider>
            <Table
              dataSource={stats.topViewedNotes || []}
              columns={[
                { title: '标题', dataIndex: 'title', key: 'title' },
                { title: '浏览量', dataIndex: 'view_count', key: 'view_count' }
              ]}
              pagination={false}
              size="small"
              rowKey="id"
            />

            <Divider orientation="left">点赞数最多的笔记</Divider>
            <Table
              dataSource={stats.topLikedNotes || []}
              columns={[
                { title: '标题', dataIndex: 'title', key: 'title' },
                { title: '点赞数', dataIndex: 'like_count', key: 'like_count' }
              ]}
              pagination={false}
              size="small"
              rowKey="id"
            />

            <Divider orientation="left">评论数最多的笔记</Divider>
            <Table
              dataSource={stats.topCommentedNotes || []}
              columns={[
                { title: '标题', dataIndex: 'title', key: 'title' },
                { title: '评论数', dataIndex: 'comment_count', key: 'comment_count' }
              ]}
              pagination={false}
              size="small"
              rowKey="id"
            />
          </div>
        </Spin>
      </Modal>
    </div>
  );
};

export default NoteList;
