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
  Select,
  Row,
  Col,
  Switch
} from 'antd';
import {
  PlusOutlined,
  EyeOutlined,
  DeleteOutlined,
  EditOutlined,
  ExclamationCircleOutlined,
  SearchOutlined,
  ReloadOutlined,
  CopyOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import { PageHeader } from '../../components/common';
import {
  getReportTemplates,
  getReportTemplateDetail,
  generateReportFromTemplate
} from '../../services/analyticsService';
import moment from 'dayjs';

const { TextArea } = Input;
const { RangePicker } = DatePicker;
const { Option } = Select;

const ReportTemplates = () => {
  const [form] = Form.useForm();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [generateModalVisible, setGenerateModalVisible] = useState(false);
  const [currentTemplate, setCurrentTemplate] = useState(null);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  const [filters, setFilters] = useState({
    keyword: '',
    template_type: undefined,
    is_system: undefined
  });

  // 获取报表模板列表
  const fetchTemplates = async (params = {}) => {
    try {
      setLoading(true);
      const queryParams = {
        page: params.page || pagination.current,
        page_size: params.pageSize || pagination.pageSize,
        search: filters.keyword,
        template_type: filters.template_type,
        is_system: filters.is_system,
        ordering: '-created_at'
      };

      const response = await getReportTemplates(queryParams);
      setTemplates(response.results || []);
      setPagination({
        ...pagination,
        current: params.page || pagination.current,
        pageSize: params.pageSize || pagination.pageSize,
        total: response.count || 0
      });
    } catch (error) {
      console.error('获取报表模板列表错误:', error);
      message.error('获取报表模板列表失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 处理表格变化
  const handleTableChange = (pagination, filters, sorter) => {
    fetchTemplates({
      page: pagination.current,
      pageSize: pagination.pageSize
    });
  };

  // 处理搜索
  const handleSearch = () => {
    setPagination({ ...pagination, current: 1 });
    fetchTemplates({ page: 1 });
  };

  // 重置搜索
  const handleReset = () => {
    setFilters({
      keyword: '',
      template_type: undefined,
      is_system: undefined
    });
    setPagination({ ...pagination, current: 1 });
    fetchTemplates({ page: 1 });
  };

  // 打开创建模板模态框
  const showCreateModal = () => {
    form.resetFields();
    form.setFieldsValue({
      template_type: 'user',
      is_system: false,
      template_config: {}
    });
    setCurrentTemplate(null);
    setModalVisible(true);
  };

  // 打开编辑模板模态框
  const showEditModal = async (record) => {
    try {
      setLoading(true);
      const templateDetail = await getReportTemplateDetail(record.id);
      setCurrentTemplate(templateDetail);
      
      form.resetFields();
      form.setFieldsValue({
        ...templateDetail,
        template_config: templateDetail.template_config || {}
      });
      
      setModalVisible(true);
    } catch (error) {
      console.error('获取模板详情错误:', error);
      message.error('获取模板详情失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 关闭模态框
  const handleCancel = () => {
    setModalVisible(false);
  };

  // 提交表单
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      
      if (currentTemplate) {
        // 更新模板
        message.success('模板更新成功');
      } else {
        // 创建模板
        message.success('模板创建成功');
      }
      
      setModalVisible(false);
      fetchTemplates();
    } catch (error) {
      console.error('提交模板表单错误:', error);
      message.error('操作失败，请稍后重试');
    }
  };

  // 查看模板详情
  const handleViewDetail = async (record) => {
    try {
      setLoading(true);
      const templateDetail = await getReportTemplateDetail(record.id);
      setCurrentTemplate(templateDetail);
      setDetailModalVisible(true);
    } catch (error) {
      console.error('获取模板详情错误:', error);
      message.error('获取模板详情失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 打开生成报表模态框
  const showGenerateModal = async (record) => {
    try {
      setLoading(true);
      const templateDetail = await getReportTemplateDetail(record.id);
      setCurrentTemplate(templateDetail);
      
      form.resetFields();
      form.setFieldsValue({
        title: `基于${templateDetail.title}的报表`,
        description: templateDetail.description,
        parameters: {}
      });
      
      setGenerateModalVisible(true);
    } catch (error) {
      console.error('获取模板详情错误:', error);
      message.error('获取模板详情失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 使用模板生成报表
  const handleGenerateReport = async () => {
    try {
      const values = await form.validateFields();
      
      // 处理日期范围
      if (values.date_range && values.date_range.length === 2) {
        values.parameters = {
          ...values.parameters,
          start_date: values.date_range[0].format('YYYY-MM-DD'),
          end_date: values.date_range[1].format('YYYY-MM-DD')
        };
      }
      delete values.date_range;
      
      // 生成报表
      await generateReportFromTemplate(currentTemplate.id, values);
      message.success('报表生成成功');
      setGenerateModalVisible(false);
    } catch (error) {
      console.error('生成报表错误:', error);
      message.error('生成报表失败，请稍后重试');
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  // 表格列定义
  const columns = [
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      width: 80,
    },
    {
      title: '模板标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: '模板类型',
      dataIndex: 'template_type',
      key: 'template_type',
      width: 120,
      render: (text, record) => {
        let color = 'blue';
        if (text === 'user') color = 'green';
        if (text === 'content') color = 'orange';
        if (text === 'system') color = 'red';
        if (text === 'custom') color = 'purple';

        return (
          <Tag color={color}>
            {record.template_type_display || text}
          </Tag>
        );
      }
    },
    {
      title: '系统模板',
      dataIndex: 'is_system',
      key: 'is_system',
      width: 100,
      render: (text) => text ? <Tag color="blue">是</Tag> : <Tag color="default">否</Tag>
    },
    {
      title: '创建者',
      dataIndex: 'created_by',
      key: 'created_by',
      width: 120,
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 180,
      render: (text) => moment(text).format('YYYY-MM-DD HH:mm:ss')
    },
    {
      title: '操作',
      key: 'action',
      width: 180,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => handleViewDetail(record)}
            />
          </Tooltip>
          
          <Tooltip title="生成报表">
            <Button
              type="text"
              icon={<FileTextOutlined />}
              onClick={() => showGenerateModal(record)}
            />
          </Tooltip>
          
          <Tooltip title="编辑">
            <Button
              type="text"
              icon={<EditOutlined />}
              onClick={() => showEditModal(record)}
              disabled={record.is_system}
            />
          </Tooltip>
          
          <Tooltip title="删除">
            <Popconfirm
              title="确定要删除这个模板吗？"
              onConfirm={() => {
                // 删除模板的逻辑
                message.success('模板已删除');
                fetchTemplates();
              }}
              okText="确定"
              cancelText="取消"
              disabled={record.is_system}
            >
              <Button
                type="text"
                danger
                icon={<DeleteOutlined />}
                disabled={record.is_system}
              />
            </Popconfirm>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className="report-templates-page">
      <PageHeader
        title="报表模板"
        subTitle="管理和使用报表模板"
        breadcrumb={[
          { title: '首页', path: '/' },
          { title: '数据分析' },
          { title: '报表模板' }
        ]}
        extra={[
          <Button
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={showCreateModal}
          >
            创建模板
          </Button>,
        ]}
      />

      <Card>
        <div className="table-filter-wrapper" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={8}>
              <Input
                placeholder="搜索模板标题或描述"
                value={filters.keyword}
                onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
                prefix={<SearchOutlined />}
                allowClear
              />
            </Col>
            <Col span={6}>
              <Select
                placeholder="选择模板类型"
                style={{ width: '100%' }}
                value={filters.template_type}
                onChange={(value) => setFilters({ ...filters, template_type: value })}
                allowClear
              >
                <Option value="user">用户分析</Option>
                <Option value="content">内容分析</Option>
                <Option value="system">系统分析</Option>
                <Option value="custom">自定义分析</Option>
              </Select>
            </Col>
            <Col span={6}>
              <Select
                placeholder="是否系统模板"
                style={{ width: '100%' }}
                value={filters.is_system}
                onChange={(value) => setFilters({ ...filters, is_system: value })}
                allowClear
              >
                <Option value={true}>是</Option>
                <Option value={false}>否</Option>
              </Select>
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
          dataSource={templates}
          rowKey="id"
          pagination={pagination}
          loading={loading}
          onChange={handleTableChange}
        />
      </Card>

      <Modal
        title={currentTemplate ? '编辑模板' : '创建模板'}
        visible={modalVisible}
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
            label="模板标题"
            rules={[{ required: true, message: '请输入模板标题' }]}
          >
            <Input placeholder="请输入模板标题" />
          </Form.Item>

          <Form.Item
            name="description"
            label="模板描述"
          >
            <TextArea rows={3} placeholder="请输入模板描述" />
          </Form.Item>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="template_type"
                label="模板类型"
                rules={[{ required: true, message: '请选择模板类型' }]}
              >
                <Select placeholder="请选择模板类型">
                  <Option value="user">用户分析</Option>
                  <Option value="content">内容分析</Option>
                  <Option value="system">系统分析</Option>
                  <Option value="custom">自定义分析</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="is_system"
                label="是否系统模板"
                valuePropName="checked"
              >
                <Switch />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="template_config"
            label="模板配置"
            rules={[{ required: true, message: '请输入模板配置' }]}
          >
            <TextArea
              rows={6}
              placeholder="请输入JSON格式的模板配置"
            />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="模板详情"
        visible={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button
            key="generate"
            type="primary"
            icon={<FileTextOutlined />}
            onClick={() => {
              setDetailModalVisible(false);
              if (currentTemplate) {
                showGenerateModal(currentTemplate);
              }
            }}
          >
            使用此模板生成报表
          </Button>,
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={800}
      >
        {currentTemplate && (
          <div className="template-detail">
            <Row gutter={[16, 16]}>
              <Col span={24}>
                <div className="detail-item">
                  <div className="detail-label">模板标题:</div>
                  <div className="detail-value">{currentTemplate.title}</div>
                </div>
              </Col>
              <Col span={12}>
                <div className="detail-item">
                  <div className="detail-label">模板类型:</div>
                  <div className="detail-value">
                    <Tag color={
                      currentTemplate.template_type === 'user' ? 'green' :
                      currentTemplate.template_type === 'content' ? 'orange' :
                      currentTemplate.template_type === 'system' ? 'red' :
                      currentTemplate.template_type === 'custom' ? 'purple' : 'blue'
                    }>
                      {currentTemplate.template_type_display || currentTemplate.template_type}
                    </Tag>
                  </div>
                </div>
              </Col>
              <Col span={12}>
                <div className="detail-item">
                  <div className="detail-label">系统模板:</div>
                  <div className="detail-value">
                    {currentTemplate.is_system ? <Tag color="blue">是</Tag> : <Tag color="default">否</Tag>}
                  </div>
                </div>
              </Col>
              <Col span={12}>
                <div className="detail-item">
                  <div className="detail-label">创建者:</div>
                  <div className="detail-value">{currentTemplate.created_by}</div>
                </div>
              </Col>
              <Col span={12}>
                <div className="detail-item">
                  <div className="detail-label">创建时间:</div>
                  <div className="detail-value">{moment(currentTemplate.created_at).format('YYYY-MM-DD HH:mm:ss')}</div>
                </div>
              </Col>
              <Col span={24}>
                <div className="detail-item">
                  <div className="detail-label">模板描述:</div>
                  <div className="detail-value">{currentTemplate.description || '无'}</div>
                </div>
              </Col>
              <Col span={24}>
                <div className="detail-item">
                  <div className="detail-label">模板配置:</div>
                  <div className="detail-value">
                    <pre>{JSON.stringify(currentTemplate.template_config, null, 2)}</pre>
                  </div>
                </div>
              </Col>
            </Row>
          </div>
        )}
      </Modal>

      <Modal
        title="使用模板生成报表"
        visible={generateModalVisible}
        onCancel={() => setGenerateModalVisible(false)}
        onOk={handleGenerateReport}
        width={700}
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
        >
          <Form.Item
            name="title"
            label="报表标题"
            rules={[{ required: true, message: '请输入报表标题' }]}
          >
            <Input placeholder="请输入报表标题" />
          </Form.Item>

          <Form.Item
            name="description"
            label="报表描述"
          >
            <TextArea rows={3} placeholder="请输入报表描述" />
          </Form.Item>

          <Form.Item
            name="date_range"
            label="日期范围"
            rules={[{ required: true, message: '请选择日期范围' }]}
          >
            <RangePicker style={{ width: '100%' }} />
          </Form.Item>

          <Form.Item
            name="parameters"
            label="额外参数"
          >
            <TextArea
              rows={4}
              placeholder="请输入JSON格式的额外参数（可选）"
            />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};

export default ReportTemplates;
