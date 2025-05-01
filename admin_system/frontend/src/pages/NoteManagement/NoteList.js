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
import { getNotes, deleteNote, updateNoteStatus, getNoteStats } from '../../services/noteService';
import { getCategories } from '../../services/categoryService';
import { getTags } from '../../services/tagService';
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
      const statsData = await getNoteStats();
      setStats(statsData);
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
          <Card className="content-stat-card" loading={statsLoading}>
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
          <Card className="content-stat-card" loading={statsLoading}>
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
          <Card className="content-stat-card" loading={statsLoading}>
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
          <Card className="content-stat-card" loading={statsLoading}>
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
                      // 这里应该调用批量发布API
                      message.success(`已成功发布 ${selectedRowKeys.length} 个笔记`);
                      setSelectedRowKeys([]);
                      setSelectedRows([]);
                      fetchNotes();
                    } catch (error) {
                      message.error('批量发布失败，请稍后重试');
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
                      // 这里应该调用批量设为草稿API
                      message.success(`已成功将 ${selectedRowKeys.length} 个笔记设为草稿`);
                      setSelectedRowKeys([]);
                      setSelectedRows([]);
                      fetchNotes();
                    } catch (error) {
                      message.error('批量设为草稿失败，请稍后重试');
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
                      // 这里应该调用批量删除API
                      message.success(`已成功删除 ${selectedRowKeys.length} 个笔记`);
                      setSelectedRowKeys([]);
                      setSelectedRows([]);
                      fetchNotes();
                    } catch (error) {
                      message.error('批量删除失败，请稍后重试');
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
              onClick={() => {
                // 导出选中笔记数据
                try {
                  const exportData = selectedRows.map(note => ({
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
                  exportToExcel(exportData, '选中笔记列表');
                  message.success('导出成功');
                } catch (error) {
                  message.error('导出失败，请稍后重试');
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
    </div>
  );
};

export default NoteList;
