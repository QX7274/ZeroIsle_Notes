import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import AdminLogList from './AdminLogList';
import SystemLogList from './SystemLogList';
import LogAnalytics from './LogAnalytics';
import LogExport from './LogExport';
import '../../styles/LogManagement.css';

const LogManagement = () => {

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/logs/admin" />} />
      <Route path="/admin" element={<AdminLogList />} />
      <Route path="/system" element={<SystemLogList />} />
      <Route path="/analytics" element={<LogAnalytics />} />
      <Route path="/export" element={<LogExport />} />
    </Routes>
  );
};

export default LogManagement;
