import React, { useState, useEffect } from 'react';
import { 
  Card, Table, Button, Space, Modal, Form, 
  Input, DatePicker, Select, message, Popconfirm, 
  Upload, Divider, Alert, Switch, TimePicker
} from 'antd';
import { 
  UploadOutlined, DownloadOutlined, DeleteOutlined, 
  ExclamationCircleOutlined, CloudUploadOutlined,
  CloudDownloadOutlined, SettingOutlined
} from '@ant-design/icons';
import dayjs from 'dayjs';

const { Option } = Select;

const BackupSettings = () => {
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [settingsModalVisible, setSettingsModalVisible] = useState(false);
  const [backupModalVisible, setBackupModalVisible] = useState(false);
  const [settingsForm] = Form.useForm();
  const [backupForm] = Form.useForm();

  useEffect(() => {
    fetchBackups();
    fetchBackupSettings();
  }, []);

  const fetchBackups = async () => {
    setLoading(true);
    try {
      // 在实际应用中，这里应该从API获取备份列表
      // const response = await axios.get('/api/settings/backups');
      // setBackups(response.data);
      
      // 模拟API响应
      setTimeout(() => {
        setBackups([
          {
            id: '1',
            name: 'backup_20250420_103000.zip',
            size: '25.4 MB',
            type: 'auto',
            status: 'success',
            created_at: '2025-04-20 10:30:00',
          },
          {
            id: '2',
            name: 'backup_20250421_143000.zip',
            size: '26.1 MB',
            type: 'manual',
            status: 'success',
            created_at: '2025-04-21 14:30:00',
          },
          {
            id: '3',
            name: 'backup_20250422_103000.zip',
            size: '26.8 MB',
            type: 'auto',
            status: 'success',
            created_at: '2025-04-22 10:30:00',
          },
        ]);
        setLoading(false);
      }, 1000);
    } catch (error) {
      message.error('获取备份列表失败');
      setLoading(false);
    }
  };

  const fetchBackupSettings = async () => {
    try {
      // 在实际应用中，这里应该从API获取备份设置
      // const response = await axios.get('/api/settings/backup-settings');
      // settingsForm.setFieldsValue(response.data);
      
      // 模拟API响应
      setTimeout(() => {
        settingsForm.setFieldsValue({
          auto_backup: true,
          backup_time: dayjs('10:30:00', 'HH:mm:ss'),
          backup_frequency: 'daily',
          retention_days: 30,
          backup_location: 'local',
        });
      }, 500);
    } catch (error) {
      message.error('获取备份设置失败');
    }
  };

  const handleCreateBackup = async () => {
    try {
      // 在实际应用中，这里应该调用API创建备份
      // await axios.post('/api/settings/backups');
      
      message.loading('正在创建备份...', 2);
      
      setTimeout(() => {
        const newBackup = {
          id: String(backups.length + 1),
          name: `backup_${dayjs().format('YYYYMMDD_HHmmss')}.zip`,
          size: '27.2 MB',
          type: 'manual',
          status: 'success',
          created_at: dayjs().format('YYYY-MM-DD HH:mm:ss'),
        };
        setBackups([newBackup, ...backups]);
        message.success('备份创建成功');
      }, 2000);
    } catch (error) {
      message.error('创建备份失败');
    }
  };

  const handleDownload = async (id) => {
    try {
      // 在实际应用中，这里应该调用API下载备份
      // window.location.href = `/api/settings/backups/${id}/download`;
      
      message.success('备份下载已开始');
    } catch (error) {
      message.error('下载备份失败');
    }
  };

  const handleDelete = async (id) => {
    try {
      // 在实际应用中，这里应该调用API删除备份
      // await axios.delete(`/api/settings/backups/${id}`);
      
      setBackups(backups.filter(item => item.id !== id));
      message.success('备份删除成功');
    } catch (error) {
      message.error('删除备份失败');
    }
  };

  const handleRestoreBackup = async () => {
    try {
      backupForm.validateFields().then(async (values) => {
        // 在实际应用中，这里应该调用API恢复备份
        // const formData = new FormData();
        // formData.append('file', values.backup_file.file);
        // await axios.post('/api/settings/backups/restore', formData);
        
        message.loading('正在恢复备份...', 3);
        
        setTimeout(() => {
          setBackupModalVisible(false);
          message.success('备份恢复成功，系统将在5秒后刷新');
          
          // 模拟页面刷新
          // setTimeout(() => {
          //   window.location.reload();
          // }, 5000);
        }, 3000);
      });
    } catch (error) {
      message.error('恢复备份失败');
    }
  };

  const handleSaveSettings = async () => {
    try {
      settingsForm.validateFields().then(async (values) => {
        // 在实际应用中，这里应该调用API保存备份设置
        // await axios.put('/api/settings/backup-settings', {
        //   ...values,
        //   backup_time: values.backup_time.format('HH:mm:ss'),
        // });
        
        message.success('备份设置保存成功');
        setSettingsModalVisible(false);
      });
    } catch (error) {
      message.error('保存备份设置失败');
    }
  };

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
    },
    {
      title: '大小',
      dataIndex: 'size',
      key: 'size',
    },
    {
      title: '类型',
      dataIndex: 'type',
      key: 'type',
      render: (type) => {
        const typeMap = {
          auto: '自动',
          manual: '手动',
        };
        return typeMap[type] || type;
      },
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (status) => {
        const statusMap = {
          success: { text: '成功', color: '#52c41a' },
          failed: { text: '失败', color: '#f5222d' },
          in_progress: { text: '进行中', color: '#1890ff' },
        };
        return (
          <span style={{ color: statusMap[status].color }}>
            {statusMap[status].text}
          </span>
        );
      },
    },
    {
      title: '创建时间',
      dataIndex: 'created_at',
      key: 'created_at',
    },
    {
      title: '操作',
      key: 'action',
      render: (_, record) => (
        <Space size="middle">
          <Button 
            type="primary" 
            icon={<DownloadOutlined />} 
            size="small"
            onClick={() => handleDownload(record.id)}
          >
            下载
          </Button>
          
          <Popconfirm
            title="确定要删除这个备份吗？"
            onConfirm={() => handleDelete(record.id)}
            okText="确定"
            cancelText="取消"
            icon={<ExclamationCircleOutlined style={{ color: 'red' }} />}
          >
            <Button 
              danger 
              icon={<DeleteOutlined />} 
              size="small"
            >
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <Card title="备份与恢复">
      <Space style={{ marginBottom: 16 }}>
        <Button 
          type="primary" 
          icon={<CloudUploadOutlined />} 
          onClick={handleCreateBackup}
        >
          创建备份
        </Button>
        
        <Button 
          icon={<CloudDownloadOutlined />} 
          onClick={() => setBackupModalVisible(true)}
        >
          恢复备份
        </Button>
        
        <Button 
          icon={<SettingOutlined />} 
          onClick={() => setSettingsModalVisible(true)}
        >
          备份设置
        </Button>
      </Space>
      
      <Alert
        message="备份提示"
        description="备份包含系统所有数据，包括用户数据、笔记内容、系统设置等。建议定期备份以防数据丢失。"
        type="info"
        showIcon
        style={{ marginBottom: 16 }}
      />
      
      <Table 
        columns={columns} 
        dataSource={backups} 
        rowKey="id" 
        loading={loading}
        pagination={{ pageSize: 10 }}
      />
      
      <Modal
        title="备份设置"
        open={settingsModalVisible}
        onOk={handleSaveSettings}
        onCancel={() => setSettingsModalVisible(false)}
        width={600}
      >
        <Form
          form={settingsForm}
          layout="vertical"
        >
          <Form.Item
            name="auto_backup"
            label="自动备份"
            valuePropName="checked"
          >
            <Switch />
          </Form.Item>
          
          <Form.Item
            name="backup_time"
            label="备份时间"
            dependencies={['auto_backup']}
            rules={[
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!getFieldValue('auto_backup') || value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('请选择备份时间'));
                },
              }),
            ]}
          >
            <TimePicker format="HH:mm:ss" />
          </Form.Item>
          
          <Form.Item
            name="backup_frequency"
            label="备份频率"
            dependencies={['auto_backup']}
            rules={[
              ({ getFieldValue }) => ({
                validator(_, value) {
                  if (!getFieldValue('auto_backup') || value) {
                    return Promise.resolve();
                  }
                  return Promise.reject(new Error('请选择备份频率'));
                },
              }),
            ]}
          >
            <Select placeholder="请选择备份频率">
              <Option value="daily">每天</Option>
              <Option value="weekly">每周</Option>
              <Option value="monthly">每月</Option>
            </Select>
          </Form.Item>
          
          <Form.Item
            name="retention_days"
            label="保留天数"
            rules={[{ required: true, message: '请输入保留天数' }]}
          >
            <Input type="number" min={1} max={365} />
          </Form.Item>
          
          <Form.Item
            name="backup_location"
            label="备份位置"
            rules={[{ required: true, message: '请选择备份位置' }]}
          >
            <Select placeholder="请选择备份位置">
              <Option value="local">本地存储</Option>
              <Option value="cloud">云存储</Option>
            </Select>
          </Form.Item>
        </Form>
      </Modal>
      
      <Modal
        title="恢复备份"
        open={backupModalVisible}
        onOk={handleRestoreBackup}
        onCancel={() => setBackupModalVisible(false)}
        width={600}
      >
        <Alert
          message="警告"
          description="恢复备份将覆盖当前系统的所有数据，此操作不可逆，请谨慎操作！"
          type="warning"
          showIcon
          style={{ marginBottom: 16 }}
        />
        
        <Form
          form={backupForm}
          layout="vertical"
        >
          <Form.Item
            name="backup_file"
            label="备份文件"
            rules={[{ required: true, message: '请上传备份文件' }]}
          >
            <Upload
              maxCount={1}
              beforeUpload={() => false}
            >
              <Button icon={<UploadOutlined />}>选择备份文件</Button>
            </Upload>
          </Form.Item>
        </Form>
      </Modal>
    </Card>
  );
};

export default BackupSettings;
