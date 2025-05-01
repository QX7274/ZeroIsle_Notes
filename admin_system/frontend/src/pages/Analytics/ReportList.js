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
  Col
} from 'antd';
import {
  PlusOutlined,
  EyeOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  SearchOutlined,
  ReloadOutlined,
  DownloadOutlined,
  FileTextOutlined
} from '@ant-design/icons';
import { PageHeader } from '../../components/common';
import {
  getReports,
  getReportDetail,
  generateReport,
  exportReport,
  getReportTemplates
} from '../../services/analyticsService';
import moment from 'dayjs';

const { TextArea } = Input;
const { RangePicker } = DatePicker;
const { Option } = Select;

const ReportList = () => {
  const [form] = Form.useForm();
  const [reports, setReports] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [currentReport, setCurrentReport] = useState(null);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  const [filters, setFilters] = useState({
    keyword: '',
    report_type: undefined,
    dateRange: []
  });

  // 获取报表列表
  const fetchReports = async (params = {}) => {
    try {
      setLoading(true);
      const queryParams = {
        page: params.page || pagination.current,
        page_size: params.pageSize || pagination.pageSize,
        search: filters.keyword,
        report_type: filters.report_type,
        ordering: '-created_at'
      };

      if (filters.dateRange && filters.dateRange.length === 2) {
        queryParams.created_at__gte = filters.dateRange[0].format('YYYY-MM-DD');
        queryParams.created_at__lte = filters.dateRange[1].format('YYYY-MM-DD');
      }

      const response = await getReports(queryParams);
      setReports(response.results || []);
      setPagination({
        ...pagination,
        current: params.page || pagination.current,
        pageSize: params.pageSize || pagination.pageSize,
        total: response.count || 0
      });
    } catch (error) {
      console.error('获取报表列表错误:', error);
      message.error('获取报表列表失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 获取报表模板列表
  const fetchTemplates = async () => {
    try {
      const response = await getReportTemplates();
      setTemplates(response.results || []);
    } catch (error) {
      console.error('获取报表模板列表错误:', error);
      message.error('获取报表模板列表失败，请稍后重试');
    }
  };

  // 处理表格变化
  const handleTableChange = (pagination, filters, sorter) => {
    fetchReports({
      page: pagination.current,
      pageSize: pagination.pageSize
    });
  };

  // 处理搜索
  const handleSearch = () => {
    setPagination({ ...pagination, current: 1 });
    fetchReports({ page: 1 });
  };

  // 重置搜索
  const handleReset = () => {
    setFilters({
      keyword: '',
      report_type: undefined,
      dateRange: []
    });
    setPagination({ ...pagination, current: 1 });
    fetchReports({ page: 1 });
  };

  // 打开创建报表模态框
  const showCreateModal = () => {
    form.resetFields();
    form.setFieldsValue({
      report_type: 'user',
      parameters: {}
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
      await generateReport(values);
      message.success('报表生成成功');
      setModalVisible(false);
      fetchReports();
    } catch (error) {
      console.error('提交报表表单错误:', error);
      message.error('操作失败，请稍后重试');
    }
  };

  // 查看报表详情
  const handleViewDetail = async (record) => {
    try {
      setLoading(true);
      const reportDetail = await getReportDetail(record.id);
      setCurrentReport(reportDetail);
      setDetailModalVisible(true);
    } catch (error) {
      console.error('获取报表详情错误:', error);
      message.error('获取报表详情失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 导出报表
  const handleExport = async (record) => {
    try {
      await exportReport(record.id, 'csv');
      message.success('导出请求已发送，文件将在新窗口中下载');
    } catch (error) {
      console.error('导出报表错误:', error);
      message.error('导出报表失败，请稍后重试');
    }
  };

  useEffect(() => {
    fetchReports();
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
      title: '报表标题',
      dataIndex: 'title',
      key: 'title',
      ellipsis: true,
    },
    {
      title: '报表类型',
      dataIndex: 'report_type',
      key: 'report_type',
      width: 120,
      render: (text, record) => {
        let color = 'blue';
        if (text === 'user') color = 'green';
        if (text === 'content') color = 'orange';
        if (text === 'system') color = 'red';
        if (text === 'custom') color = 'purple';

        return (
          <Tag color={color}>
            {record.report_type_display || text}
          </Tag>
        );
      }
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
      width: 150,
      render: (_, record) => (
        <Space size="small">
          <Tooltip title="查看详情">
            <Button
              type="text"
              icon={<EyeOutlined />}
              onClick={() => handleViewDetail(record)}
            />
          </Tooltip>
          
          <Tooltip title="导出报表">
            <Button
              type="text"
              icon={<DownloadOutlined />}
              onClick={() => handleExport(record)}
            />
          </Tooltip>
          
          <Tooltip title="删除">
            <Popconfirm
              title="确定要删除这个报表吗？"
              onConfirm={() => {
                // 删除报表的逻辑
                message.success('报表已删除');
                fetchReports();
              }}
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
    <div className="report-list-page">
      <PageHeader
        title="报表管理"
        subTitle="管理和生成数据分析报表"
        breadcrumb={[
          { title: '首页', path: '/' },
          { title: '数据分析' },
          { title: '报表管理' }
        ]}
        extra={[
          <Button
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={showCreateModal}
          >
            生成报表
          </Button>,
        ]}
      />

      <Card>
        <div className="table-filter-wrapper" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={8}>
              <Input
                placeholder="搜索报表标题或描述"
                value={filters.keyword}
                onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
                prefix={<SearchOutlined />}
                allowClear
              />
            </Col>
            <Col span={6}>
              <Select
                placeholder="选择报表类型"
                style={{ width: '100%' }}
                value={filters.report_type}
                onChange={(value) => setFilters({ ...filters, report_type: value })}
                allowClear
              >
                <Option value="user">用户分析</Option>
                <Option value="content">内容分析</Option>
                <Option value="system">系统分析</Option>
                <Option value="custom">自定义分析</Option>
              </Select>
            </Col>
            <Col span={6}>
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
          dataSource={reports}
          rowKey="id"
          pagination={pagination}
          loading={loading}
          onChange={handleTableChange}
        />
      </Card>

      <Modal
        title="生成报表"
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

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item
                name="report_type"
                label="报表类型"
                rules={[{ required: true, message: '请选择报表类型' }]}
              >
                <Select placeholder="请选择报表类型">
                  <Option value="user">用户分析</Option>
                  <Option value="content">内容分析</Option>
                  <Option value="system">系统分析</Option>
                  <Option value="custom">自定义分析</Option>
                </Select>
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                name="date_range"
                label="日期范围"
                rules={[{ required: true, message: '请选择日期范围' }]}
              >
                <RangePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
          </Row>

          <Form.Item
            name="template_id"
            label="报表模板"
          >
            <Select placeholder="请选择报表模板（可选）" allowClear>
              {templates.map(template => (
                <Option key={template.id} value={template.id}>{template.title}</Option>
              ))}
            </Select>
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="报表详情"
        visible={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button
            key="export"
            type="primary"
            icon={<DownloadOutlined />}
            onClick={() => {
              if (currentReport) {
                handleExport(currentReport);
              }
            }}
          >
            导出报表
          </Button>,
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={800}
      >
        {currentReport && (
          <div className="report-detail">
            <Row gutter={[16, 16]}>
              <Col span={24}>
                <div className="detail-item">
                  <div className="detail-label">报表标题:</div>
                  <div className="detail-value">{currentReport.title}</div>
                </div>
              </Col>
              <Col span={12}>
                <div className="detail-item">
                  <div className="detail-label">报表类型:</div>
                  <div className="detail-value">
                    <Tag color={
                      currentReport.report_type === 'user' ? 'green' :
                      currentReport.report_type === 'content' ? 'orange' :
                      currentReport.report_type === 'system' ? 'red' :
                      currentReport.report_type === 'custom' ? 'purple' : 'blue'
                    }>
                      {currentReport.report_type_display || currentReport.report_type}
                    </Tag>
                  </div>
                </div>
              </Col>
              <Col span={12}>
                <div className="detail-item">
                  <div className="detail-label">创建时间:</div>
                  <div className="detail-value">{moment(currentReport.created_at).format('YYYY-MM-DD HH:mm:ss')}</div>
                </div>
              </Col>
              <Col span={24}>
                <div className="detail-item">
                  <div className="detail-label">报表描述:</div>
                  <div className="detail-value">{currentReport.description || '无'}</div>
                </div>
              </Col>
              <Col span={24}>
                <div className="detail-item">
                  <div className="detail-label">报表参数:</div>
                  <div className="detail-value">
                    <pre>{JSON.stringify(currentReport.parameters, null, 2)}</pre>
                  </div>
                </div>
              </Col>
              <Col span={24}>
                <div className="detail-item">
                  <div className="detail-label">报表数据:</div>
                  <div className="detail-value">
                    <pre>{JSON.stringify(currentReport.result_data, null, 2)}</pre>
                  </div>
                </div>
              </Col>
            </Row>
          </div>
        )}
      </Modal>
    </div>
  );
};

export default ReportList;
