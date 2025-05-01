import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { Typography, Button, Space, message } from 'antd';
import { UserOutlined, PlusOutlined } from '@ant-design/icons';
import UserList from './UserList';
import UserDetail from './UserDetail';
import UserCreate from './UserCreate';
import UserEdit from './UserEdit';
import '../../styles/UserManagement.css';

const { Title, Text } = Typography;

const UserManagement = () => {
  const navigate = useNavigate();

  return (
    <div className="user-management-container">
      <Routes>
        <Route
          path="/"
          element={
            <>
              <div className="user-list-header">
                <div className="user-list-title">
                  <UserOutlined className="user-list-icon" />
                  <div className="title-content">
                    <Title level={3} style={{ margin: 0 }}>用户管理</Title>
                    <Text type="secondary">管理系统用户账户和权限</Text>
                  </div>
                </div>
                <Button
                  type="primary"
                  icon={<PlusOutlined />}
                  onClick={() => navigate('/users/create')}
                  size="large"
                >
                  创建用户
                </Button>
              </div>
              <UserList />
            </>
          }
        />
        <Route path="/detail/:id" element={<UserDetail />} />
        <Route path="/create" element={<UserCreate />} />
        <Route path="/edit/:id" element={<UserEdit />} />
      </Routes>
    </div>
  );
};

export default UserManagement;
