import React, { useState, useEffect } from 'react';
import { Table, Card, Button, Space, Input, Modal, Form, message, Typography, Popconfirm, Tag } from 'antd';
import { PlusOutlined, EditOutlined, DeleteOutlined, ExclamationCircleOutlined, ArrowLeftOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { getCategories, createCategory, updateCategory, deleteCategory, getCategoryStats } from '../../services/categoryService';

const { Title, Text } = Typography;
const { confirm } = Modal;

const CategoryManagement = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [editingCategory, setEditingCategory] = useState(null);
  const [form] = Form.useForm();
  const [categoryStats, setCategoryStats] = useState({});
  const [searchText, setSearchText] = useState('');
  
  const navigate = useNavigate();
  
  // 获取分类列表
  const fetchCategories = async () => {
    try {
      setLoading(true);
      const data = await getCategories();
      setCategories(data);
    } catch (error) {
      console.error('获取分类列表失败:', error);
      message.error('获取分类列表失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };
  
  // 获取分类统计数据
  const fetchCategoryStats = async () => {
    try {
      const data = await getCategoryStats();
      setCategoryStats(data);
    } catch (error) {
      console.error('获取分类统计数据失败:', error);
    }
  };
  
  useEffect(() => {
    fetchCategories();
    fetchCategoryStats();
  }, []);
  
  // 打开创建分类模态框
  const showCreateModal = () => {
    setModalTitle('创建分类');
    setEditingCategory(null);
    form.resetFields();
    setModalVisible(true);
  };
  
  // 打开编辑分类模态框
  const showEditModal = (category) => {
    setModalTitle('编辑分类');
    setEditingCategory(category);
    form.setFieldsValue({
      name: category.name,
      description: category.description,
      order: category.order,
    });
    setModalVisible(true);
  };
  
  // 处理模态框确认
  const handleModalOk = async () => {
    try {
      const values = await form.validateFields();
      
      if (editingCategory) {
        // 更新分类
        await updateCategory(editingCategory.id, values);
        message.success('更新分类成功');
      } else {
        // 创建分类
        await createCategory(values);
        message.success('创建分类成功');
      }
      
      setModalVisible(false);
      fetchCategories();
      fetchCategoryStats();
    } catch (error) {
      console.error('保存分类失败:', error);
      message.error('保存分类失败，请稍后重试');
    }
  };
  
  // 处理删除分类
  const handleDelete = async (id) => {
    try {
      await deleteCategory(id);
      message.success('删除分类成功');
      fetchCategories();
      fetchCategoryStats();
    } catch (error) {
      console.error('删除分类失败:', error);
      message.error('删除分类失败，请稍后重试');
    }
  };
  
  // 处理批量删除分类
  const handleBatchDelete = () => {
    const selectedIds = selectedRowKeys;
    if (selectedIds.length === 0) {
      message.warning('请选择要删除的分类');
      return;
    }
    
    confirm({
      title: '确定要删除选中的分类吗？',
      icon: <ExclamationCircleOutlined />,
      content: '删除后不可恢复，分类下的笔记将变为未分类状态',
      okText: '确定',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          // 逐个删除选中的分类
          for (const id of selectedIds) {
            await deleteCategory(id);
          }
          message.success(`成功删除 ${selectedIds.length} 个分类`);
          setSelectedRowKeys([]);
          fetchCategories();
          fetchCategoryStats();
        } catch (error) {
          console.error('批量删除分类失败:', error);
          message.error('批量删除分类失败，请稍后重试');
        }
      },
    });
  };
  
  // 表格列定义
  const columns = [
    {
      title: '分类名称',
      dataIndex: 'name',
      key: 'name',
    },
    {
      title: '描述',
      dataIndex: 'description',
      key: 'description',
      ellipsis: true,
    },
    {
      title: '笔记数量',
      dataIndex: 'id',
      key: 'notesCount',
      render: (id) => categoryStats[id]?.notesCount || 0,
    },
    {
      title: '排序',
      dataIndex: 'order',
      key: 'order',
      sorter: (a, b) => a.order - b.order,
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
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
            title="确定要删除该分类吗？"
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
  
  // 过滤分类
  const filteredCategories = categories.filter(
    (category) => category.name.toLowerCase().includes(searchText.toLowerCase())
  );
  
  return (
    <div className="category-management-container">
      <div className="page-header">
        <Space>
          <Button icon={<ArrowLeftOutlined />} onClick={() => navigate('/notes')}>
            返回
          </Button>
          <Title level={2}>分类管理</Title>
        </Space>
        <div>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={showCreateModal}
            style={{ marginRight: 16 }}
          >
            创建分类
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
          placeholder="搜索分类名称"
          allowClear
          enterButton="搜索"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          style={{ width: 300 }}
        />
      </Card>
      
      <Table
        columns={columns}
        dataSource={filteredCategories}
        rowKey="id"
        loading={loading}
        rowSelection={rowSelection}
        pagination={{ pageSize: 10 }}
      />
      
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
            label="分类名称"
            rules={[{ required: true, message: '请输入分类名称' }]}
          >
            <Input placeholder="请输入分类名称" />
          </Form.Item>
          <Form.Item
            name="description"
            label="分类描述"
          >
            <Input.TextArea rows={3} placeholder="请输入分类描述" />
          </Form.Item>
          <Form.Item
            name="order"
            label="排序"
            initialValue={0}
            rules={[{ required: true, message: '请输入排序值' }]}
          >
            <Input type="number" placeholder="数字越小排序越靠前" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default CategoryManagement;
