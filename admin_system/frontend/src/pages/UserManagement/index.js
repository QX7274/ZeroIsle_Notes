import React, { useState, useEffect } from 'react';
import {Routes,
  Route,
  useNavigate} from 'react-router-dom';
import {Typography,
  Button,
  Space} from 'antd';
import {UserOutlined,
  PlusOutlined,
  LineChartOutlined,
  HistoryOutlined} from '@ant-design/icons';
import UserList from './UserList';
import UserDetail from './UserDetail';
import UserCreate from './UserCreate';
import UserEdit from './UserEdit';
import UserAnalytics from './UserAnalytics';
import UserActivityLog from './UserActivityLog';
import '../../styles/UserManagement.css';

const { Title, Text } = Typography;

// 用户列表页（含页头操作区）。
//
// 抽出为独立组件的原因：侧边栏菜单把"用户列表"指向 /users/list，
// 而这里原本只注册了 path="/"（即 /users），导致该菜单项是**死链**
// （点进去落到 NotFound）。现同时注册 "/" 与 "/list" 两个路径，
// 避免去改菜单 key 而影响其它地方的路径判断。
const UserListPage = () => {
  const navigate = useNavigate();

  return (
    <>
      <div className="user-list-header">
        <div className="user-list-title">
          <UserOutlined className="user-list-icon" />
          <div className="title-content">
            <Title level={3} style={{ margin: 0 }}>用户管理</Title>
            <Text type="secondary">管理系统用户账户和权限</Text>
          </div>
        </div>
        <Space>
          <Button
            icon={<HistoryOutlined />}
            onClick={() => navigate('/users/activity-log')}
            size="large"
          >
            活动日志
          </Button>
          <Button
            icon={<LineChartOutlined />}
            onClick={() => navigate('/users/analytics')}
            size="large"
          >
            用户分析
          </Button>
          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/users/create')}
            size="large"
          >
            创建用户
          </Button>
        </Space>
      </div>
      <UserList />
    </>
  );
};

const UserManagement = () => {
  return (
    <div className="user-management-container">
      <Routes>
        <Route path="/" element={<UserListPage />} />
        {/* 侧边栏菜单使用的路径，与 "/" 等价，避免死链 */}
        <Route path="/list" element={<UserListPage />} />
        <Route path="/detail/:id" element={<UserDetail />} />
        <Route path="/create" element={<UserCreate />} />
        <Route path="/edit/:id" element={<UserEdit />} />
        <Route path="/analytics" element={<UserAnalytics />} />
        <Route path="/activity-log" element={<UserActivityLog />} />
      </Routes>
    </div>
  );
};

export default UserManagement;
