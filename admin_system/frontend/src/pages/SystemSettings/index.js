import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { Typography } from 'antd';
import {
  SettingOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  NotificationOutlined,
  CloudSyncOutlined,
  SyncOutlined,
  DatabaseOutlined
} from '@ant-design/icons';
import SystemConfig from './SystemConfig';
import AnnouncementList from './AnnouncementList';
import BackupManagement from './BackupManagement';
import '../../styles/SystemSettings.css';

const { Title, Text } = Typography;

const SystemSettings = () => {
  return (
    <div className="system-settings-container">
      <Routes>
        <Route path="/" element={<Navigate to="/settings/config" />} />
        <Route path="/config" element={<SystemConfig />} />
        <Route path="/announcements" element={<AnnouncementList />} />
        <Route path="/backups" element={<BackupManagement />} />
      </Routes>
    </div>
  );
};

export default SystemSettings;
