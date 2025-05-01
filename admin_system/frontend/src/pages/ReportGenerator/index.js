import React, { useState, useEffect } from 'react';
import { 
  Card, Row, Col, Tabs, Button, DatePicker, 
  Select, Typography, Spin, Empty, Space, Tooltip, 
  List, Tag, Progress, Form, Input, Checkbox, Radio,
  Divider, Alert, Modal, message
} from 'antd';
import {
  FileTextOutlined, DownloadOutlined, ReloadOutlined,
  BarChartOutlined, UserOutlined, AppstoreOutlined,
  SettingOutlined, PlusOutlined, HistoryOutlined,
  ClockCircleOutlined, CheckCircleOutlined, CloseCircleOutlined,
  FileExcelOutlined, FilePdfOutlined, FileWordOutlined,
  FileImageOutlined, MailOutlined, PrinterOutlined
} from '@ant-design/icons';
import '../../styles/ReportGenerator.css';

const { Title, Text, Paragraph } = Typography;
const { TabPane } = Tabs;
const { RangePicker } = DatePicker;
const { Option } = Select;
const { TextArea } = Input;

const ReportGenerator = () => {
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('templates');
  const [reportTemplates, setReportTemplates] = useState([]);
  const [reportHistory, setReportHistory] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [generatingReport, setGeneratingReport] = useState(false);
  const [form] = Form.useForm();

  useEffect(() => {
    fetchTemplates();
    fetchReportHistory();
  }, []);

  const fetchTemplates = () => {
    // 模拟获取报表模板
    setLoading(true);
    setTimeout(() => {
      setReportTemplates([
        {
          id: '1',
          title: '用户活动月度报表',
          description: '包含用户注册、活跃度、内容创建等数据的月度统计报表',
          type: 'user',
          format: 'excel',
          lastGenerated: '2025-01-15',
          frequency: 'monthly'
        },
        {
          id: '2',
          title: '内容分析季度报表',
          description: '包含内容创建、分类、标签、热门内容等数据的季度统计报表',
          type: 'content',
          format: 'pdf',
          lastGenerated: '2025-01-01',
          frequency: 'quarterly'
        },
        {
          id: '3',
          title: '系统性能周报',
          description: '包含系统资源使用、响应时间、错误日志等数据的周度统计报表',
          type: 'system',
          format: 'excel',
          lastGenerated: '2025-01-20',
          frequency: 'weekly'
        },
        {
          id: '4',
          title: '管理员操作日志报表',
          description: '包含管理员登录、操作记录等数据的统计报表',
          type: 'admin',
          format: 'pdf',
          lastGenerated: '2025-01-18',
          frequency: 'monthly'
        }
      ]);
      setLoading(false);
    }, 1000);
  };

  const fetchReportHistory = () => {
    // 模拟获取报表历史
    setLoading(true);
    setTimeout(() => {
      setReportHistory([
        {
          id: '1',
          title: '用户活动月度报表 - 2025年1月',
          type: 'user',
          format: 'excel',
          generatedAt: '2025-01-15 10:30:00',
          generatedBy: 'admin',
          size: '1.2MB',
          status: 'completed'
        },
        {
          id: '2',
          title: '内容分析季度报表 - 2024年Q4',
          type: 'content',
          format: 'pdf',
          generatedAt: '2025-01-01 14:15:00',
          generatedBy: 'admin',
          size: '3.5MB',
          status: 'completed'
        },
        {
          id: '3',
          title: '系统性能周报 - 2025年第3周',
          type: 'system',
          format: 'excel',
          generatedAt: '2025-01-20 09:45:00',
          generatedBy: 'admin',
          size: '0.8MB',
          status: 'completed'
        }
      ]);
      setLoading(false);
    }, 1000);
  };

  const handleTemplateSelect = (template) => {
    setSelectedTemplate(template);
    form.resetFields();
    form.setFieldsValue({
      title: template.title,
      format: template.format,
      includeCharts: true,
      includeTables: true,
      includeRawData: false
    });
    setModalVisible(true);
  };

  const handleGenerateReport = () => {
    form.validateFields().then(values => {
      setGeneratingReport(true);
      
      // 模拟报表生成过程
      setTimeout(() => {
        setGeneratingReport(false);
        setModalVisible(false);
        
        // 添加到历史记录
        const newReport = {
          id: String(reportHistory.length + 1),
          title: values.title,
          type: selectedTemplate.type,
          format: values.format,
          generatedAt: new Date().toLocaleString(),
          generatedBy: 'admin',
          size: '1.5MB',
          status: 'completed'
        };
        
        setReportHistory([newReport, ...reportHistory]);
        message.success('报表生成成功');
      }, 3000);
    });
  };

  const handleDownloadReport = (report) => {
    message.success(`开始下载报表: ${report.title}`);
  };

  const handleDeleteReport = (reportId) => {
    setReportHistory(reportHistory.filter(report => report.id !== reportId));
    message.success('报表删除成功');
  };

  const getFormatIcon = (format) => {
    switch (format) {
      case 'excel':
        return <FileExcelOutlined style={{ color: '#217346' }} />;
      case 'pdf':
        return <FilePdfOutlined style={{ color: '#F40F02' }} />;
      case 'word':
        return <FileWordOutlined style={{ color: '#2B579A' }} />;
      case 'image':
        return <FileImageOutlined style={{ color: '#4361EE' }} />;
      default:
        return <FileTextOutlined />;
    }
  };

  const getTypeTag = (type) => {
    switch (type) {
      case 'user':
        return <Tag color="#4361EE" icon={<UserOutlined />}>用户</Tag>;
      case 'content':
        return <Tag color="#4CC9F0" icon={<FileTextOutlined />}>内容</Tag>;
      case 'system':
        return <Tag color="#F72585" icon={<SettingOutlined />}>系统</Tag>;
      case 'admin':
        return <Tag color="#3A0CA3" icon={<UserOutlined />}>管理员</Tag>;
      default:
        return <Tag color="default">其他</Tag>;
    }
  };

  const renderTemplatesTab = () => (
    <div className="report-templates">
      <Alert
        message="报表模板"
        description="选择一个报表模板，自定义参数后生成报表。您可以根据需要选择不同类型的报表模板。"
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />
      
      <List
        grid={{ gutter: 24, column: 2 }}
        dataSource={reportTemplates}
        renderItem={template => (
          <List.Item>
            <div 
              className="report-template-item"
              onClick={() => handleTemplateSelect(template)}
            >
              <div className="report-template-item-header">
                <div className="report-template-item-title">
                  {template.title}
                </div>
                <Space>
                  {getTypeTag(template.type)}
                  <Tag icon={getFormatIcon(template.format)}>
                    {template.format.toUpperCase()}
                  </Tag>
                </Space>
              </div>
              <div className="report-template-item-description">
                {template.description}
              </div>
              <div className="report-template-item-meta">
                <span>
                  <ClockCircleOutlined style={{ marginRight: 4 }} />
                  频率: {
                    template.frequency === 'weekly' ? '每周' :
                    template.frequency === 'monthly' ? '每月' :
                    template.frequency === 'quarterly' ? '每季度' : '自定义'
                  }
                </span>
                <span>
                  <HistoryOutlined style={{ marginRight: 4 }} />
                  上次生成: {template.lastGenerated}
                </span>
              </div>
            </div>
          </List.Item>
        )}
      />
    </div>
  );

  const renderHistoryTab = () => (
    <div className="report-history">
      <Alert
        message="报表历史"
        description="查看已生成的报表历史记录，您可以下载或删除这些报表。"
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />
      
      {reportHistory.length > 0 ? (
        <List
          dataSource={reportHistory}
          renderItem={report => (
            <div className="report-history-item">
              <div className="report-history-item-header">
                <div className="report-history-item-title">
                  {report.title}
                </div>
                <Space>
                  {getTypeTag(report.type)}
                  <Tag icon={getFormatIcon(report.format)}>
                    {report.format.toUpperCase()}
                  </Tag>
                  <Tag color="green" icon={<CheckCircleOutlined />}>
                    已完成
                  </Tag>
                </Space>
              </div>
              <div className="report-history-item-meta">
                <span>
                  <ClockCircleOutlined style={{ marginRight: 4 }} />
                  生成时间: {report.generatedAt}
                </span>
                <span>
                  <UserOutlined style={{ marginRight: 4 }} />
                  生成者: {report.generatedBy}
                </span>
                <span>
                  <FileTextOutlined style={{ marginRight: 4 }} />
                  大小: {report.size}
                </span>
              </div>
              <div className="report-history-item-actions">
                <Button 
                  type="primary" 
                  icon={<DownloadOutlined />}
                  onClick={() => handleDownloadReport(report)}
                >
                  下载
                </Button>
                <Button 
                  icon={<MailOutlined />}
                >
                  发送
                </Button>
                <Button 
                  icon={<PrinterOutlined />}
                >
                  打印
                </Button>
                <Button 
                  danger 
                  icon={<CloseCircleOutlined />}
                  onClick={() => handleDeleteReport(report.id)}
                >
                  删除
                </Button>
              </div>
            </div>
          )}
        />
      ) : (
        <Empty description="暂无报表历史记录" />
      )}
    </div>
  );

  const renderCustomTab = () => (
    <div className="custom-report">
      <Alert
        message="自定义报表"
        description="创建自定义报表，选择数据源、时间范围和报表格式。"
        type="info"
        showIcon
        style={{ marginBottom: 24 }}
      />
      
      <Card className="report-card">
        <Form layout="vertical">
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item
                label="报表标题"
                name="customTitle"
                rules={[{ required: true, message: '请输入报表标题' }]}
              >
                <Input placeholder="请输入报表标题" />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="报表类型"
                name="customType"
                rules={[{ required: true, message: '请选择报表类型' }]}
              >
                <Select placeholder="请选择报表类型">
                  <Option value="user">用户报表</Option>
                  <Option value="content">内容报表</Option>
                  <Option value="system">系统报表</Option>
                  <Option value="admin">管理员报表</Option>
                  <Option value="custom">自定义报表</Option>
                </Select>
              </Form.Item>
            </Col>
          </Row>
          
          <Row gutter={24}>
            <Col span={12}>
              <Form.Item
                label="时间范围"
                name="customDateRange"
                rules={[{ required: true, message: '请选择时间范围' }]}
              >
                <RangePicker style={{ width: '100%' }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item
                label="报表格式"
                name="customFormat"
                rules={[{ required: true, message: '请选择报表格式' }]}
              >
                <Radio.Group>
                  <Radio value="excel">Excel</Radio>
                  <Radio value="pdf">PDF</Radio>
                  <Radio value="word">Word</Radio>
                  <Radio value="image">图片</Radio>
                </Radio.Group>
              </Form.Item>
            </Col>
          </Row>
          
          <Form.Item
            label="数据源"
            name="customDataSources"
            rules={[{ required: true, message: '请选择至少一个数据源' }]}
          >
            <Checkbox.Group style={{ width: '100%' }}>
              <Row gutter={[16, 16]}>
                <Col span={8}>
                  <Checkbox value="users">用户数据</Checkbox>
                </Col>
                <Col span={8}>
                  <Checkbox value="notes">笔记数据</Checkbox>
                </Col>
                <Col span={8}>
                  <Checkbox value="tags">标签数据</Checkbox>
                </Col>
                <Col span={8}>
                  <Checkbox value="comments">评论数据</Checkbox>
                </Col>
                <Col span={8}>
                  <Checkbox value="system">系统数据</Checkbox>
                </Col>
                <Col span={8}>
                  <Checkbox value="logs">日志数据</Checkbox>
                </Col>
              </Row>
            </Checkbox.Group>
          </Form.Item>
          
          <Form.Item
            label="报表内容"
            name="customContent"
            rules={[{ required: true, message: '请选择至少一项报表内容' }]}
          >
            <Checkbox.Group style={{ width: '100%' }}>
              <Row gutter={[16, 16]}>
                <Col span={8}>
                  <Checkbox value="summary">摘要信息</Checkbox>
                </Col>
                <Col span={8}>
                  <Checkbox value="charts">图表</Checkbox>
                </Col>
                <Col span={8}>
                  <Checkbox value="tables">表格</Checkbox>
                </Col>
                <Col span={8}>
                  <Checkbox value="trends">趋势分析</Checkbox>
                </Col>
                <Col span={8}>
                  <Checkbox value="comparisons">对比分析</Checkbox>
                </Col>
                <Col span={8}>
                  <Checkbox value="rawData">原始数据</Checkbox>
                </Col>
              </Row>
            </Checkbox.Group>
          </Form.Item>
          
          <Form.Item
            label="备注"
            name="customRemarks"
          >
            <TextArea rows={4} placeholder="请输入备注信息" />
          </Form.Item>
          
          <Form.Item>
            <Button type="primary" icon={<BarChartOutlined />}>
              生成报表
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );

  return (
    <div className="report-generator-container">
      <div className="report-header">
        <div className="report-title">
          <FileTextOutlined className="report-icon" />
          <div className="title-content">
            <Title level={3} style={{ margin: 0 }}>报表生成器</Title>
            <Text type="secondary">生成系统数据报表</Text>
          </div>
        </div>
        <Space>
          <Button 
            icon={<ReloadOutlined />} 
            onClick={() => {
              fetchTemplates();
              fetchReportHistory();
            }}
          >
            刷新
          </Button>
          <Button 
            type="primary" 
            icon={<PlusOutlined />} 
            onClick={() => setActiveTab('custom')}
          >
            创建自定义报表
          </Button>
        </Space>
      </div>

      <Tabs 
        activeKey={activeTab} 
        onChange={setActiveTab}
        className="report-tabs"
      >
        <TabPane 
          tab={
            <span>
              <AppstoreOutlined />
              报表模板
            </span>
          } 
          key="templates"
        />
        <TabPane 
          tab={
            <span>
              <HistoryOutlined />
              报表历史
            </span>
          } 
          key="history"
        />
        <TabPane 
          tab={
            <span>
              <PlusOutlined />
              自定义报表
            </span>
          } 
          key="custom"
        />
      </Tabs>

      {loading ? (
        <div className="report-loading">
          <Spin size="large" />
          <p>加载数据中...</p>
        </div>
      ) : (
        <div className="report-content">
          {activeTab === 'templates' && renderTemplatesTab()}
          {activeTab === 'history' && renderHistoryTab()}
          {activeTab === 'custom' && renderCustomTab()}
        </div>
      )}

      <Modal
        title="生成报表"
        open={modalVisible}
        onCancel={() => setModalVisible(false)}
        footer={[
          <Button key="back" onClick={() => setModalVisible(false)}>
            取消
          </Button>,
          <Button 
            key="submit" 
            type="primary" 
            loading={generatingReport}
            onClick={handleGenerateReport}
          >
            生成
          </Button>
        ]}
        width={700}
      >
        {selectedTemplate && (
          <Form
            form={form}
            layout="vertical"
            className="report-form"
          >
            <Alert
              message={`您选择了: ${selectedTemplate.title}`}
              description={selectedTemplate.description}
              type="info"
              showIcon
              style={{ marginBottom: 24 }}
            />
            
            <Row gutter={24}>
              <Col span={16}>
                <Form.Item
                  name="title"
                  label="报表标题"
                  rules={[{ required: true, message: '请输入报表标题' }]}
                >
                  <Input placeholder="请输入报表标题" />
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="format"
                  label="报表格式"
                  rules={[{ required: true, message: '请选择报表格式' }]}
                >
                  <Select placeholder="请选择报表格式">
                    <Option value="excel">Excel</Option>
                    <Option value="pdf">PDF</Option>
                    <Option value="word">Word</Option>
                    <Option value="image">图片</Option>
                  </Select>
                </Form.Item>
              </Col>
            </Row>
            
            <Form.Item
              name="dateRange"
              label="时间范围"
              rules={[{ required: true, message: '请选择时间范围' }]}
            >
              <RangePicker style={{ width: '100%' }} />
            </Form.Item>
            
            <Divider orientation="left">报表内容</Divider>
            
            <Row gutter={24}>
              <Col span={8}>
                <Form.Item
                  name="includeCharts"
                  valuePropName="checked"
                >
                  <Checkbox>包含图表</Checkbox>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="includeTables"
                  valuePropName="checked"
                >
                  <Checkbox>包含表格</Checkbox>
                </Form.Item>
              </Col>
              <Col span={8}>
                <Form.Item
                  name="includeRawData"
                  valuePropName="checked"
                >
                  <Checkbox>包含原始数据</Checkbox>
                </Form.Item>
              </Col>
            </Row>
            
            <Form.Item
              name="remarks"
              label="备注"
            >
              <TextArea rows={4} placeholder="请输入备注信息" />
            </Form.Item>
            
            {generatingReport && (
              <div className="report-progress">
                <Progress percent={75} status="active" />
                <div className="report-progress-text">
                  正在生成报表，请稍候...
                </div>
              </div>
            )}
          </Form>
        )}
      </Modal>
    </div>
  );
};

export default ReportGenerator;
