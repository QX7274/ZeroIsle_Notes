import React, { useState, useEffect } from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { Typography, Button, Space, message } from 'antd';
import UserList from './UserList';
import UserDetail from './UserDetail';
import UserCreate from './UserCreate';
import UserEdit from './UserEdit';

const { Title } = Typography;

const UserManagement = () => {
  const navigate = useNavigate();
  
  return (
    <div className="user-management-container">
      <Routes>
        <Route 
          path="/" 
          element={
            <>
              <div className="page-header">
                <Title level={2}>用户管理</Title>
                <Button 
                  type="primary" 
                  onClick={() => navigate('/users/create')}
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
