import React, { useState, useEffect } from 'react';
import { Table, Input, Button, Space, Tag, Popconfirm, message, Card, Select, DatePicker } from 'antd';
import { SearchOutlined, EyeOutlined, DeleteOutlined, ExclamationCircleOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getNotes, deleteNote, updateNoteStatus } from '../../services/noteService';
import { getCategories } from '../../services/categoryService';
import { getTags } from '../../services/tagService';

const { RangePicker } = DatePicker;
const { Option } = Select;

const NoteList = () => {
  const [notes, setNotes] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0,
  });
  const [filters, setFilters] = useState({
    keyword: '',
    categoryId: undefined,
    tagId: undefined,
    status: 'all',
    dateRange: null,
  });
  
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

  useEffect(() => {
    fetchNotes();
    fetchCategories();
    fetchTags();
  }, []);

  // 处理表格变化
  const handleTableChange = (pagination, filters, sorter) => {
    fetchNotes({
      page: pagination.current,
      pageSize: pagination.pageSize,
      sortField: sorter.field,
      sortOrder: sorter.order,
    });
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
      <Card className="search-card">
        <Space wrap>
          <Input
            placeholder="搜索标题/内容"
            value={filters.keyword}
            onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
            style={{ width: 250 }}
            allowClear
          />
          <Select
            placeholder="选择分类"
            value={filters.categoryId}
            onChange={(value) => setFilters({ ...filters, categoryId: value })}
            style={{ width: 150 }}
            allowClear
          >
            {categories.map((category) => (
              <Option key={category.id} value={category.id}>
                {category.name}
              </Option>
            ))}
          </Select>
          <Select
            placeholder="选择标签"
            value={filters.tagId}
            onChange={(value) => setFilters({ ...filters, tagId: value })}
            style={{ width: 150 }}
            allowClear
          >
            {tags.map((tag) => (
              <Option key={tag.id} value={tag.id}>
                {tag.name}
              </Option>
            ))}
          </Select>
          <Select
            placeholder="笔记状态"
            value={filters.status}
            onChange={(value) => setFilters({ ...filters, status: value })}
            style={{ width: 120 }}
          >
            <Option value="all">全部状态</Option>
            <Option value="published">已发布</Option>
            <Option value="draft">草稿</Option>
          </Select>
          <RangePicker
            value={filters.dateRange}
            onChange={(dates) => setFilters({ ...filters, dateRange: dates })}
          />
          <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch}>
            搜索
          </Button>
          <Button onClick={handleReset}>重置</Button>
        </Space>
      </Card>

      <Table
        columns={columns}
        dataSource={notes}
        rowKey="id"
        pagination={pagination}
        loading={loading}
        onChange={handleTableChange}
      />
    </div>
  );
};

export default NoteList;
