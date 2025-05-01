import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import Dashboard from './Dashboard';
import UserAnalytics from './UserAnalytics';
import ContentAnalytics from './ContentAnalytics';
import SystemAnalytics from './SystemAnalytics';
import ReportList from './ReportList';
import ReportTemplates from './ReportTemplates';

const Analytics = () => {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/analytics/dashboard" />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/user" element={<UserAnalytics />} />
      <Route path="/content" element={<ContentAnalytics />} />
      <Route path="/system" element={<SystemAnalytics />} />
      <Route path="/reports" element={<ReportList />} />
      <Route path="/templates" element={<ReportTemplates />} />
    </Routes>
  );
};

export default Analytics;
