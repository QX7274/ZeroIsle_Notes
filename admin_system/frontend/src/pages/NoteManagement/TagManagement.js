import React, { useState, useEffect } from 'react';
import { Table, Card, Button, Space, Input, Modal, Form, message, Typography, Popconfirm, Tag, Select } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ExclamationCircleOutlined, ArrowLeftOutlined, MergeCellsOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getTags, createTag, updateTag, deleteTag, batchDeleteTags, mergeTags, getTagStats } from '../../services/tagService';

const { Title, Text } = Typography;
const { confirm } = Modal;
const { Option } = Select;

const TagManagement = () => {
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [mergeModalVisible, setMergeModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [editingTag, setEditingTag] = useState(null);
  const [form] = Form.useForm();
  const [mergeForm] = Form.useForm();
  const [tagStats, setTagStats] = useState({});
  const [searchText, setSearchText] = useState('');
  
  const navigate = useNavigate();
  
  // 获取标签列表
  const fetchTags = async () => {
    try {
      setLoading(true);
      const data = await getTags();
      setTags(data);
    } catch (error) {
      console.error('获取标签列表失败:', error);
      message.error('获取标签列表失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };
  
  // 获取标签统计数据
  const fetchTagStats = async () => {
    try {
      const data = await getTagStats();
      setTagStats(data);
    } catch (error) {
      console.error('获取标签统计数据失败:', error);
    }
  };
  
  useEffect(() => {
    fetchTags();
    fetchTagStats();
  }, []);
  
  // 打开创建标签模态框
  const showCreateModal = () => {
    setModalTitle('创建标签');
    setEditingTag(null);
    form.resetFields();
    setModalVisible(true);
  };
  
  // 打开编辑标签模态框
  const showEditModal = (tag) => {
    setModalTitle('编辑标签');
    setEditingTag(tag);
    form.setFieldsValue({
      name: tag.name,
      color: tag.color || 'blue',
    });
    setModalVisible(true);
  };
  
  // 打开合并标签模态框
  const showMergeModal = () => {
    if (selectedRowKeys.length < 2) {
      message.warning('请至少选择两个标签进行合并');
      return;
    }
    
    mergeForm.resetFields();
    setMergeModalVisible(true);
  };
  
  // 处理模态框确认
  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      
      if (editingTag) {
        // 更新标签
        await updateTag(editingTag.id, values);
        message.success('更新标签成功');
      } else {
        // 创建标签
        await createTag(values);
        message.success('创建标签成功');
      }
      
      setModalVisible(false);
      fetchTags();
      fetchTagStats();
    } catch (error) {
      console.error('保存标签失败:', error);
      message.error('保存标签失败，请稍后重试');
    }
  };
  
  // 处理合并标签
  const handleMergeOk = async () => {
    try {
      const values = await mergeForm.validateFields();
      const { targetTagId } = values;
      
      // 获取源标签ID（除了目标标签外的所有选中标签）
      const sourceTagIds = selectedRowKeys.filter(id => id !== targetTagId);
      
      // 逐个合并标签
      for (const sourceId of sourceTagIds) {
        await mergeTags(sourceId, targetTagId);
      }
      
      message.success(`成功将 ${sourceTagIds.length} 个标签合并到目标标签`);
      setMergeModalVisible(false);
      setSelectedRowKeys([]);
      fetchTags();
      fetchTagStats();
    } catch (error) {
      console.error('合并标签失败:', error);
      message.error('合并标签失败，请稍后重试');
    }
  };
  
  // 处理删除标签
  const handleDelete = async (id) => {
    try {
      await deleteTag(id);
      message.success('删除标签成功');
      fetchTags();
      fetchTagStats();
    } catch (error) {
      console.error('删除标签失败:', error);
      message.error('删除标签失败，请稍后重试');
    }
  };
  
  // 处理批量删除标签
  const handleBatchDelete = () => {
    const selectedIds = selectedRowKeys;
    if (selectedIds.length === 0) {
      message.warning('请选择要删除的标签');
      return;
    }
    
    confirm({
      title: '确定要删除选中的标签吗？',
      icon: <ExclamationCircleOutlined />,
      content: '删除后不可恢复，相关笔记将失去这些标签',
      okText: '确定',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          await batchDeleteTags(selectedIds);
          message.success(`成功删除 ${selectedIds.length} 个标签`);
          setSelectedRowKeys([]);
          fetchTags();
          fetchTagStats();
        } catch (error) {
          console.error('批量删除标签失败:', error);
          message.error('批量删除标签失败，请稍后重试');
        }
      },
    });
  };
  
  // 表格列定义
  const columns = [
    {
      title: '标签名称',
      dataIndex: 'name',
      key: 'name',
      render: (text, record) => (
        <Tag color={record.color || 'blue'}>{text}</Tag>
      ),
    },
    {
      title: '笔记数量',
      dataIndex: 'id',
      key: 'notesCount',
      render: (id) => tagStats[id]?.notesCount || 0,
      sorter: (a, b) => (tagStats[a.id]?.notesCount || 0) - (tagStats[b.id]?.notesCount || 0),
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
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button
            type="text"
            icon={<EditOutlined />}
            onClick={() => showEditModal(record)}
          />
          <Popconfirm
            title="确定要删除该标签吗？"
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
  
  // 表格选择配置
  const [selectedRowKeys, setSelectedRowKeys] = useState([]);
  
  const rowSelection = {
    selectedRowKeys,
    onChange: (selectedRowKeys) => {
      setSelectedRowKeys(selectedRowKeys);
    },
  };
  
  // 过滤标签
  const filteredTags = tags.filter(
    (tag) => tag.name.toLowerCase().includes(searchText.toLowerCase())
  );
  
  return (
    <div className="tag-management-container">
      <div className="page-header">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/notes')}>
            返回
          </Button>
          <Title level={2}>标签管理</Title>
        </Space>
        <div>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={showCreateModal}
            style={{ marginRight: 16 }}
          >
            创建标签
          </Button>
          <Button
            icon={<MergeCellsOutlined />}
            onClick={showMergeModal}
            disabled={selectedRowKeys.length < 2}
            style={{ marginRight: 16 }}
          >
            合并标签
          </Button>
          <Button
            danger
            icon={<DeleteOutlined />}
            onClick={handleBatchDelete}
            disabled={selectedRowKeys.length === 0}
          >
            批量删除
          </Button>
        </div>
      </div>
      
      <Card className="search-card">
        <Input.Search
          placeholder="搜索标签名称"
          allowClear
          enterButton="搜索"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ width: 300 }}
        />
      </Card>
      
      <Table
        columns={columns}
        dataSource={filteredTags}
        rowKey="id"
        loading={loading}
        rowSelection={rowSelection}
        pagination={{ pageSize: 10 }}
      />
      
      {/* 创建/编辑标签模态框 */}
      <Modal
        title={modalTitle}
        open={modalVisible}
        onOk={handleModalOk}
        onCancel={() => setModalVisible(false)}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
        >
          <Form.Item
            name="name"
            label="标签名称"
            rules={[{ required: true, message: '请输入标签名称' }]}
          >
            <Input placeholder="请输入标签名称" />
          </Form.Item>
          <Form.Item
            name="color"
            label="标签颜色"
            initialValue="blue"
          >
            <Select>
              <Option value="blue">蓝色</Option>
              <Option value="green">绿色</Option>
              <Option value="red">红色</Option>
              <Option value="orange">橙色</Option>
              <Option value="purple">紫色</Option>
              <Option value="cyan">青色</Option>
              <Option value="pink">粉色</Option>
              <Option value="geekblue">极客蓝</Option>
              <Option value="volcano">火山红</Option>
              <Option value="gold">金色</Option>
              <Option value="lime">青柠绿</Option>
              <Option value="magenta">洋红</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
      
      {/* 合并标签模态框 */}
      <Modal
        title="合并标签"
        open={mergeModalVisible}
        onOk={handleMergeOk}
        onCancel={() => setMergeModalVisible(false)}
        destroyOnClose
      >
        <Form
          form={mergeForm}
          layout="vertical"
        >
          <Form.Item
            name="targetTagId"
            label="目标标签"
            rules={[{ required: true, message: '请选择目标标签' }]}
            extra="选中的标签将被合并到目标标签，其他标签将被删除"
          >
            <Select placeholder="请选择目标标签">
              {selectedRowKeys.map(id => {
                const tag = tags.find(t => t.id === id);
                return (
                  <Option key={id} value={id}>
                    <Tag color={tag.color || 'blue'}>{tag.name}</Tag>
                    ({tagStats[id]?.notesCount || 0} 篇笔记)
                  </Option>
                );
              })}
            </Select>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default TagManagement;
