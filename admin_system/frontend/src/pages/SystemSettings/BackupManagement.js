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
  Select,
  message,
  Popconfirm,
  Tooltip,
  Row,
  Col,
  Statistic,
  Divider,
  Alert,
  Progress,
  Typography,
  Upload
} from 'antd';
import {
  PlusOutlined,
  DownloadOutlined,
  ReloadOutlined,
  DeleteOutlined,
  ExclamationCircleOutlined,
  SyncOutlined,
  CloudUploadOutlined,
  CloudDownloadOutlined,
  InfoCircleOutlined,
  SearchOutlined,
  DatabaseOutlined,
  SettingOutlined,
  UploadOutlined,
  InboxOutlined
} from '@ant-design/icons';
import { PageHeader } from '../../components/common';
import {
  getBackups,
  getBackupDetail,
  createBackup,
  deleteBackup,
  restoreBackup,
  downloadBackup,
  getBackupInfo,
  createFullBackup,
  createDataBackup,
  createSettingsBackup,
  importBackup
} from '../../services/settingService';
import moment from 'dayjs';

const { TextArea } = Input;
const { Option } = Select;
const { Title, Text } = Typography;

const BackupManagement = () => {
  const [form] = Form.useForm();
  const [importForm] = Form.useForm();
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [importModalVisible, setImportModalVisible] = useState(false);
  const [detailModalVisible, setDetailModalVisible] = useState(false);
  const [currentBackup, setCurrentBackup] = useState(null);
  const [backupInProgress, setBackupInProgress] = useState(false);
  const [restoreInProgress, setRestoreInProgress] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [pagination, setPagination] = useState({
    current: 1,
    pageSize: 10,
    total: 0
  });
  const [filters, setFilters] = useState({
    keyword: '',
    backup_type: undefined,
    status: undefined
  });
  const [stats, setStats] = useState({
    total: 0,
    completed: 0,
    failed: 0,
    pending: 0
  });

  // 获取备份列表
  const fetchBackups = async (params = {}) => {
    try {
      setLoading(true);
      const queryParams = {
        page: params.page || pagination.current,
        page_size: params.pageSize || pagination.pageSize,
        search: filters.keyword,
        backup_type: filters.backup_type,
        status: filters.status,
        ordering: '-created_at'
      };

      const response = await getBackups(queryParams);
      setBackups(response.results || []);
      setPagination({
        ...pagination,
        current: params.page || pagination.current,
        pageSize: params.pageSize || pagination.pageSize,
        total: response.count || 0
      });

      // 计算统计数据
      const total = response.count || 0;
      const completed = (response.results || []).filter(b => b.status === 'completed').length;
      const failed = (response.results || []).filter(b => b.status === 'failed').length;
      const pending = (response.results || []).filter(b => ['pending', 'running'].includes(b.status)).length;

      setStats({
        total,
        completed,
        failed,
        pending
      });
    } catch (error) {
      console.error('获取备份列表错误:', error);
      message.error('获取备份列表失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 处理表格变化
  const handleTableChange = (pagination, filters, sorter) => {
    fetchBackups({
      page: pagination.current,
      pageSize: pagination.pageSize
    });
  };

  // 处理搜索
  const handleSearch = () => {
    setPagination({ ...pagination, current: 1 });
    fetchBackups({ page: 1 });
  };

  // 重置搜索
  const handleReset = () => {
    setFilters({
      keyword: '',
      backup_type: undefined,
      status: undefined
    });
    setPagination({ ...pagination, current: 1 });
    fetchBackups({ page: 1 });
  };

  // 打开创建备份模态框
  const showCreateModal = () => {
    form.resetFields();
    form.setFieldsValue({
      backup_type: 'full',
      name: `完整备份 ${moment().format('YYYY-MM-DD HH:mm:ss')}`,
      description: '手动创建的完整备份'
    });
    setModalVisible(true);
  };

  // 打开导入备份模态框
  const showImportModal = () => {
    importForm.resetFields();
    setImportFile(null);
    setImportModalVisible(true);
  };

  // 关闭模态框
  const handleCancel = () => {
    setModalVisible(false);
  };

  // 关闭导入模态框
  const handleImportCancel = () => {
    setImportModalVisible(false);
    setImportFile(null);
  };

  // 处理文件上传前的检查
  const beforeUpload = (file) => {
    // 检查文件类型
    const isZip = file.type === 'application/zip' ||
                 file.type === 'application/x-zip-compressed' ||
                 file.name.endsWith('.zip');

    if (!isZip) {
      message.error('只支持上传ZIP格式的备份文件!');
      return Upload.LIST_IGNORE;
    }

    // 检查文件大小
    const isLt100M = file.size / 1024 / 1024 < 100;
    if (!isLt100M) {
      message.error('文件大小不能超过100MB!');
      return Upload.LIST_IGNORE;
    }

    // 保存文件
    setImportFile(file);
    return false; // 阻止自动上传
  };

  // 处理导入备份
  const handleImportBackup = async () => {
    if (!importFile) {
      message.error('请先选择要导入的备份文件');
      return;
    }

    try {
      setBackupInProgress(true);

      // 创建FormData对象
      const formData = new FormData();
      formData.append('backup_file', importFile);
      formData.append('name', importFile.name);
      formData.append('description', '导入的备份文件');

      // 调用API导入备份
      const response = await importBackup(formData);

      if (response.status === 'success') {
        message.success(response.message || '备份导入成功');
        setImportModalVisible(false);
        fetchBackups();
      } else {
        message.error(response.message || '备份导入失败');
      }
    } catch (error) {
      console.error('导入备份错误:', error);
      message.error('导入备份失败，请稍后重试');
    } finally {
      setBackupInProgress(false);
    }
  };

  // 提交表单
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      setBackupInProgress(true);

      let response;
      if (values.backup_type === 'full') {
        response = await createFullBackup(values);
      } else if (values.backup_type === 'data') {
        response = await createDataBackup(values);
      } else if (values.backup_type === 'settings') {
        response = await createSettingsBackup(values);
      } else {
        response = await createBackup(values);
      }

      message.success('备份创建成功');
      setModalVisible(false);
      fetchBackups();
    } catch (error) {
      console.error('创建备份错误:', error);
      message.error('创建备份失败，请稍后重试');
    } finally {
      setBackupInProgress(false);
    }
  };

  // 查看备份详情
  const handleViewDetail = async (record) => {
    try {
      setLoading(true);
      const backupDetail = await getBackupDetail(record.id);
      setCurrentBackup(backupDetail);
      setDetailModalVisible(true);
    } catch (error) {
      console.error('获取备份详情错误:', error);
      message.error('获取备份详情失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  // 下载备份
  const handleDownload = async (record) => {
    try {
      await downloadBackup(record.id);
      message.success('下载请求已发送，文件将在新窗口中下载');
    } catch (error) {
      console.error('下载备份错误:', error);
      message.error('下载备份失败，请稍后重试');
    }
  };

  // 恢复备份
  const handleRestore = async (record) => {
    Modal.confirm({
      title: '确定要恢复此备份吗？',
      icon: <ExclamationCircleOutlined />,
      content: '恢复备份将覆盖当前数据，此操作不可逆！建议先创建当前数据的备份。',
      okText: '确定恢复',
      okType: 'danger',
      cancelText: '取消',
      onOk: async () => {
        try {
          setRestoreInProgress(true);
          const response = await restoreBackup(record.id);
          message.success('备份恢复成功');
          fetchBackups();
        } catch (error) {
          console.error('恢复备份错误:', error);
          message.error('恢复备份失败，请稍后重试');
        } finally {
          setRestoreInProgress(false);
        }
      }
    });
  };

  // 删除备份
  const handleDelete = async (record) => {
    try {
      await deleteBackup(record.id);
      message.success('备份删除成功');
      fetchBackups();
    } catch (error) {
      console.error('删除备份错误:', error);
      message.error('删除备份失败，请稍后重试');
    }
  };

  // 获取备份类型标签颜色
  const getBackupTypeColor = (type) => {
    switch (type) {
      case 'full':
        return 'blue';
      case 'data':
        return 'green';
      case 'settings':
        return 'orange';
      case 'user':
        return 'purple';
      case 'content':
        return 'cyan';
      default:
        return 'default';
    }
  };

  // 获取备份状态标签颜色
  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'success';
      case 'running':
        return 'processing';
      case 'pending':
        return 'warning';
      case 'failed':
        return 'error';
      default:
        return 'default';
    }
  };

  useEffect(() => {
    fetchBackups();
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
      title: '备份名称',
      dataIndex: 'name',
      key: 'name',
      ellipsis: true,
    },
    {
      title: '备份类型',
      dataIndex: 'backup_type',
      key: 'backup_type',
      width: 120,
      render: (text, record) => (
        <Tag color={getBackupTypeColor(text)}>
          {record.backup_type_display || text}
        </Tag>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 100,
      render: (text, record) => (
        <Tag color={getStatusColor(text)}>
          {record.status_display || text}
        </Tag>
      ),
    },
    {
      title: '文件大小',
      dataIndex: 'file_size_display',
      key: 'file_size_display',
      width: 120,
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
              icon={<InfoCircleOutlined />}
              onClick={() => handleViewDetail(record)}
            />
          </Tooltip>

          {record.status === 'completed' && (
            <>
              <Tooltip title="下载备份">
                <Button
                  type="text"
                  icon={<DownloadOutlined />}
                  onClick={() => handleDownload(record)}
                />
              </Tooltip>

              <Tooltip title="恢复备份">
                <Button
                  type="text"
                  icon={<CloudDownloadOutlined />}
                  onClick={() => handleRestore(record)}
                  loading={restoreInProgress}
                />
              </Tooltip>
            </>
          )}

          <Tooltip title="删除">
            <Popconfirm
              title="确定要删除这个备份吗？"
              onConfirm={() => handleDelete(record)}
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
    <div className="backup-management-page">
      <PageHeader
        title="备份管理"
        subTitle="管理系统备份和恢复"
        breadcrumb={[
          { title: '首页', path: '/' },
          { title: '系统设置' },
          { title: '备份管理' }
        ]}
        extra={[
          <Button
            key="import"
            icon={<UploadOutlined />}
            onClick={showImportModal}
            style={{ marginRight: 8 }}
          >
            导入备份
          </Button>,
          <Button
            key="create"
            type="primary"
            icon={<PlusOutlined />}
            onClick={showCreateModal}
          >
            创建备份
          </Button>,
        ]}
      />

      <div className="backup-stats" style={{ marginBottom: 16 }}>
        <Row gutter={16}>
          <Col span={6}>
            <Card>
              <Statistic
                title="总备份数"
                value={stats.total}
                valueStyle={{ color: '#3f8600' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="完成备份"
                value={stats.completed}
                valueStyle={{ color: '#52c41a' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="失败备份"
                value={stats.failed}
                valueStyle={{ color: '#f5222d' }}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card>
              <Statistic
                title="进行中备份"
                value={stats.pending}
                valueStyle={{ color: '#faad14' }}
              />
            </Card>
          </Col>
        </Row>
      </div>

      <Card>
        <div className="table-filter-wrapper" style={{ marginBottom: 16 }}>
          <Row gutter={16}>
            <Col span={8}>
              <Input
                placeholder="搜索备份名称或描述"
                value={filters.keyword}
                onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
                prefix={<SearchOutlined />}
                allowClear
              />
            </Col>
            <Col span={6}>
              <Select
                placeholder="备份类型"
                style={{ width: '100%' }}
                value={filters.backup_type}
                onChange={(value) => setFilters({ ...filters, backup_type: value })}
                allowClear
              >
                <Option value="full">完整备份</Option>
                <Option value="data">数据备份</Option>
                <Option value="settings">设置备份</Option>
                <Option value="user">用户备份</Option>
                <Option value="content">内容备份</Option>
              </Select>
            </Col>
            <Col span={6}>
              <Select
                placeholder="状态"
                style={{ width: '100%' }}
                value={filters.status}
                onChange={(value) => setFilters({ ...filters, status: value })}
                allowClear
              >
                <Option value="completed">已完成</Option>
                <Option value="running">进行中</Option>
                <Option value="pending">等待中</Option>
                <Option value="failed">失败</Option>
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
          dataSource={backups}
          rowKey="id"
          pagination={pagination}
          loading={loading}
          onChange={handleTableChange}
        />
      </Card>

      <Modal
        title="创建备份"
        open={modalVisible}
        onCancel={handleCancel}
        onOk={handleSubmit}
        confirmLoading={backupInProgress}
        width={600}
      >
        <Form
          form={form}
          layout="vertical"
        >
          <Form.Item
            name="backup_type"
            label="备份类型"
            rules={[{ required: true, message: '请选择备份类型' }]}
          >
            <Select
              placeholder="请选择备份类型"
              onChange={(value) => {
                let name = '';
                let description = '';

                if (value === 'full') {
                  name = `完整备份 ${moment().format('YYYY-MM-DD HH:mm:ss')}`;
                  description = '手动创建的完整备份';
                } else if (value === 'data') {
                  name = `数据备份 ${moment().format('YYYY-MM-DD HH:mm:ss')}`;
                  description = '手动创建的数据备份';
                } else if (value === 'settings') {
                  name = `设置备份 ${moment().format('YYYY-MM-DD HH:mm:ss')}`;
                  description = '手动创建的设置备份';
                } else if (value === 'user') {
                  name = `用户备份 ${moment().format('YYYY-MM-DD HH:mm:ss')}`;
                  description = '手动创建的用户备份';
                } else if (value === 'content') {
                  name = `内容备份 ${moment().format('YYYY-MM-DD HH:mm:ss')}`;
                  description = '手动创建的内容备份';
                }

                form.setFieldsValue({
                  name,
                  description
                });
              }}
            >
              <Option value="full">完整备份</Option>
              <Option value="data">数据备份</Option>
              <Option value="settings">设置备份</Option>
              <Option value="user">用户备份</Option>
              <Option value="content">内容备份</Option>
            </Select>
          </Form.Item>

          <Form.Item
            name="name"
            label="备份名称"
            rules={[{ required: true, message: '请输入备份名称' }]}
          >
            <Input placeholder="请输入备份名称" />
          </Form.Item>

          <Form.Item
            name="description"
            label="备份描述"
          >
            <TextArea rows={3} placeholder="请输入备份描述" />
          </Form.Item>

          <Alert
            message="备份提示"
            description="备份过程可能需要一些时间，请耐心等待。备份完成后，您可以下载备份文件或在需要时恢复备份。"
            type="info"
            showIcon
          />
        </Form>
      </Modal>

      <Modal
        title="备份详情"
        open={detailModalVisible}
        onCancel={() => setDetailModalVisible(false)}
        footer={[
          <Button
            key="download"
            type="primary"
            icon={<DownloadOutlined />}
            onClick={() => {
              if (currentBackup) {
                handleDownload(currentBackup);
              }
            }}
            disabled={currentBackup?.status !== 'completed'}
          >
            下载备份
          </Button>,
          <Button
            key="restore"
            type="primary"
            danger
            icon={<CloudDownloadOutlined />}
            onClick={() => {
              if (currentBackup) {
                handleRestore(currentBackup);
              }
              setDetailModalVisible(false);
            }}
            disabled={currentBackup?.status !== 'completed'}
          >
            恢复备份
          </Button>,
          <Button key="close" onClick={() => setDetailModalVisible(false)}>
            关闭
          </Button>
        ]}
        width={700}
      >
        {currentBackup && (
          <div className="backup-detail">
            <Row gutter={[16, 16]}>
              <Col span={24}>
                <div className="detail-item">
                  <div className="detail-label">备份名称:</div>
                  <div className="detail-value">{currentBackup.name}</div>
                </div>
              </Col>
              <Col span={12}>
                <div className="detail-item">
                  <div className="detail-label">备份类型:</div>
                  <div className="detail-value">
                    <Tag color={getBackupTypeColor(currentBackup.backup_type)}>
                      {currentBackup.backup_type_display || currentBackup.backup_type}
                    </Tag>
                  </div>
                </div>
              </Col>
              <Col span={12}>
                <div className="detail-item">
                  <div className="detail-label">状态:</div>
                  <div className="detail-value">
                    <Tag color={getStatusColor(currentBackup.status)}>
                      {currentBackup.status_display || currentBackup.status}
                    </Tag>
                  </div>
                </div>
              </Col>
              <Col span={12}>
                <div className="detail-item">
                  <div className="detail-label">文件大小:</div>
                  <div className="detail-value">{currentBackup.file_size_display}</div>
                </div>
              </Col>
              <Col span={12}>
                <div className="detail-item">
                  <div className="detail-label">创建者:</div>
                  <div className="detail-value">{currentBackup.created_by}</div>
                </div>
              </Col>
              <Col span={12}>
                <div className="detail-item">
                  <div className="detail-label">创建时间:</div>
                  <div className="detail-value">{moment(currentBackup.created_at).format('YYYY-MM-DD HH:mm:ss')}</div>
                </div>
              </Col>
              <Col span={12}>
                <div className="detail-item">
                  <div className="detail-label">完成时间:</div>
                  <div className="detail-value">
                    {currentBackup.completed_at
                      ? moment(currentBackup.completed_at).format('YYYY-MM-DD HH:mm:ss')
                      : '-'}
                  </div>
                </div>
              </Col>
              <Col span={24}>
                <div className="detail-item">
                  <div className="detail-label">备份描述:</div>
                  <div className="detail-value">{currentBackup.description || '无'}</div>
                </div>
              </Col>
              {currentBackup.status === 'failed' && (
                <Col span={24}>
                  <Alert
                    message="备份失败"
                    description="此备份创建失败，请检查系统日志以获取更多信息。"
                    type="error"
                    showIcon
                  />
                </Col>
              )}
              {currentBackup.status === 'running' && (
                <Col span={24}>
                  <Alert
                    message="备份进行中"
                    description="备份正在进行中，请稍后刷新查看结果。"
                    type="info"
                    showIcon
                  />
                  <Progress percent={50} status="active" />
                </Col>
              )}
            </Row>
          </div>
        )}
      </Modal>

      {/* 导入备份模态框 */}
      <Modal
        title="导入备份"
        open={importModalVisible}
        onCancel={handleImportCancel}
        onOk={handleImportBackup}
        confirmLoading={backupInProgress}
        width={600}
      >
        <Alert
          message="导入说明"
          description="请上传之前从系统导出的备份文件（ZIP格式）。导入后，您可以查看备份详情或恢复备份。"
          type="info"
          showIcon
          style={{ marginBottom: 24 }}
        />

        <Form
          form={importForm}
          layout="vertical"
        >
          <Form.Item
            label="备份文件"
            required
          >
            <Upload.Dragger
              name="backup_file"
              beforeUpload={beforeUpload}
              showUploadList={false}
              accept=".zip"
            >
              <p className="ant-upload-drag-icon">
                <InboxOutlined />
              </p>
              <p className="ant-upload-text">点击或拖拽文件到此区域上传</p>
              <p className="ant-upload-hint">
                支持ZIP格式的备份文件，文件大小不超过100MB
              </p>
            </Upload.Dragger>

            {importFile && (
              <div style={{ marginTop: 16, textAlign: 'center' }}>
                <Tag color="blue" icon={<UploadOutlined />}>
                  已选择文件: {importFile.name}
                </Tag>
              </div>
            )}
          </Form.Item>

          <Alert
            message="警告"
            description="导入备份后，您需要手动恢复备份才能使其生效。恢复备份将覆盖当前数据，请谨慎操作。"
            type="warning"
            showIcon
          />
        </Form>
      </Modal>
    </div>
  );
};

export default BackupManagement;
