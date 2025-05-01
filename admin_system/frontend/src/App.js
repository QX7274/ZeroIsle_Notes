import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { ConfigProvider, App as AntdApp } from 'antd';
import zhCN from 'antd/lib/locale/zh_CN';

// 导入页面组件
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import UserManagement from './pages/UserManagement';
import NoteManagement from './pages/NoteManagement';
import SystemSettings from './pages/SystemSettings';
import LogManagement from './pages/LogManagement';
import Analytics from './pages/Analytics';
import NotFound from './pages/NotFound';

// 导入布局组件
import AdminLayout from './components/Layout/AdminLayout';

// 导入通用组件
import { ScrollToTop } from './components/common';
import { Loading } from './components/feedback';

// 导入服务和工具
import { checkAuth } from './services/authService';
import theme from './styles/theme';

// 导入样式
import './styles/global.css';
import './styles/App.css';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const verifyAuth = async () => {
      try {
        const authStatus = await checkAuth();
        setIsAuthenticated(authStatus);
      } catch (error) {
        console.error('认证检查失败:', error);
        setIsAuthenticated(false);
      } finally {
        setLoading(false);
      }
    };

    verifyAuth();
  }, []);

  if (loading) {
    return (
      <Loading tip="系统加载中，请稍候..." height={window.innerHeight} />
    );
  }

  return (
    <ConfigProvider locale={zhCN} theme={theme}>
      <AntdApp>
        <div className="app-container">
          <Routes>
            <Route path="/login" element={!isAuthenticated ? <Login setIsAuthenticated={setIsAuthenticated} /> : <Navigate to="/dashboard" />} />

            <Route element={isAuthenticated ? <AdminLayout setIsAuthenticated={setIsAuthenticated} /> : <Navigate to="/login" />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/users/*" element={<UserManagement />} />
              <Route path="/notes/*" element={<NoteManagement />} />
              <Route path="/settings/*" element={<SystemSettings />} />
              <Route path="/logs/*" element={<LogManagement />} />
              <Route path="/analytics/*" element={<Analytics />} />
            </Route>

            <Route path="/" element={<Navigate to="/dashboard" />} />
            <Route path="*" element={<NotFound />} />
          </Routes>

          {/* 滚动到顶部按钮 */}
          <ScrollToTop visibilityHeight={300} duration={500} />
        </div>
      </AntdApp>
    </ConfigProvider>
  );
}

export default App;
