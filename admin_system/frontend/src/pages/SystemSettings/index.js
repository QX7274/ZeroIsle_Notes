import React from 'react';
import {Routes,
  Route,
  Navigate} from 'react-router-dom';
import {Typography} from 'antd';

import SystemConfig from './SystemConfig';
import AnnouncementList from './AnnouncementList';
import BackupManagement from './BackupManagement';
// 以下三个页面此前「已实现但从未挂载路由」（阶段1 基线记录的未接入页面）：
//   - SyncSettings 是 /api/sync/* 全部 10 个后端接口的唯一消费方，
//     不挂载等于整块同步管理功能不可达；
//   - SecuritySettings / GeneralSettings 均对接真实的 /settings/system/* 接口。
import SyncSettings from './SyncSettings';
import SecuritySettings from './SecuritySettings';
import GeneralSettings from './GeneralSettings';
// 管理员管理：此前因后端缺 /settings/admins 与 /settings/roles 而无法接入；
// 本轮补齐后端后接入（页面原有 mock 兜底也已切回真实接口）。
import AdminManagement from './AdminManagement';
import '../../styles/SystemSettings.css';

const SystemSettings = () => {
  return (
    <div className="system-settings-container">
      <Routes>
        <Route path="/" element={<Navigate to="/settings/config" />} />
        <Route path="/config" element={<SystemConfig />} />
        <Route path="/announcements" element={<AnnouncementList />} />
        <Route path="/backups" element={<BackupManagement />} />
        <Route path="/sync" element={<SyncSettings />} />
        <Route path="/security" element={<SecuritySettings />} />
        <Route path="/general" element={<GeneralSettings />} />
        <Route path="/admins" element={<AdminManagement />} />
      </Routes>
    </div>
  );
};

export default SystemSettings;
