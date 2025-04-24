import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { Typography, Tabs } from 'antd';
import GeneralSettings from './GeneralSettings';
import SecuritySettings from './SecuritySettings';
import AdminManagement from './AdminManagement';
import AnnouncementManagement from './AnnouncementManagement';
import BackupSettings from './BackupSettings';

const { Title } = Typography;
const { TabPane } = Tabs;

const SystemSettings = () => {
  return (
    <div className="system-settings-container">
      <Routes>
        <Route 
          path="/" 
          element={
            <>
              <div className="page-header">
                <Title level={2}>系统设置</Title>
              </div>
              <Tabs defaultActiveKey="general" type="card">
                <TabPane tab="基本设置" key="general">
                  <GeneralSettings />
                </TabPane>
                <TabPane tab="安全设置" key="security">
                  <SecuritySettings />
                </TabPane>
                <TabPane tab="管理员管理" key="admin">
                  <AdminManagement />
                </TabPane>
                <TabPane tab="系统公告" key="announcement">
                  <AnnouncementManagement />
                </TabPane>
                <TabPane tab="备份与恢复" key="backup">
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
