import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Typography, Tabs, Space } from 'antd';
import {
  SettingOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  NotificationOutlined,
  CloudSyncOutlined
} from '@ant-design/icons';
import GeneralSettings from './GeneralSettings';
import SecuritySettings from './SecuritySettings';
import AdminManagement from './AdminManagement';
import AnnouncementManagement from './AnnouncementManagement';
import BackupSettings from './BackupSettings';
import '../../styles/SystemSettings.css';

const { Title, Text } = Typography;
const { TabPane } = Tabs;

const SystemSettings = () => {
  return (
    <div className="system-settings-container">
      <Routes>
        <Route
          path="/"
          element={
            <>
              <div className="settings-header">
                <div className="settings-title">
                  <SettingOutlined className="settings-icon" />
                  <div className="title-content">
                    <Title level={3} style={{ margin: 0 }}>系统设置</Title>
                    <Text type="secondary">配置系统参数和管理系统功能</Text>
                  </div>
                </div>
              </div>

              <Tabs
                defaultActiveKey="general"
                type="card"
                className="settings-tabs"
                animated={{ inkBar: true, tabPane: true }}
              >
                <TabPane
                  tab={
                    <Space>
                      <SettingOutlined />
                      <span>基本设置</span>
                    </Space>
                  }
                  key="general"
                >
                  <GeneralSettings />
                </TabPane>

                <TabPane
                  tab={
                    <Space>
                      <SafetyCertificateOutlined />
                      <span>安全设置</span>
                    </Space>
                  }
                  key="security"
                >
                  <SecuritySettings />
                </TabPane>

                <TabPane
                  tab={
                    <Space>
                      <TeamOutlined />
                      <span>管理员管理</span>
                    </Space>
                  }
                  key="admin"
                >
                  <AdminManagement />
                </TabPane>

                <TabPane
                  tab={
                    <Space>
                      <NotificationOutlined />
                      <span>系统公告</span>
                    </Space>
                  }
                  key="announcement"
                >
                  <AnnouncementManagement />
                </TabPane>

                <TabPane
                  tab={
                    <Space>
                      <CloudSyncOutlined />
                      <span>备份与恢复</span>
                    </Space>
                  }
                  key="backup"
                >
                  <BackupSettings />
                </TabPane>
              </Tabs>
            </>
          }
        />
      </Routes>
    </div>
  );
};

export default SystemSettings;
