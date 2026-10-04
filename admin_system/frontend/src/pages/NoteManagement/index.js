import React from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { Typography, Button, Space } from 'antd';
import { FileTextOutlined, AppstoreOutlined, TagOutlined, PlusOutlined } from '@ant-design/icons';
import NoteList from './NoteList';
import NoteDetail from './NoteDetail';
import CategoryManagement from './CategoryManagement';
import TagManagement from './TagManagement';
import '../../styles/ContentManagement.css';

const { Title, Text } = Typography;

// 笔记列表页（含页头操作区）。
//
// 抽出为独立组件的原因与 UserManagement 相同：侧边栏菜单把"笔记列表"
// 指向 /notes/list，而这里原本只注册了 path="/"（即 /notes），
// 导致该菜单项是死链。现同时注册 "/" 与 "/list"。
const NoteListPage = () => {
  const navigate = useNavigate();

  return (
    <>
      <div className="content-list-header">
        <div className="content-list-title">
          <FileTextOutlined className="content-list-icon" />
          <div className="title-content">
            <Title level={3} style={{ margin: 0 }}>内容管理</Title>
            <Text type="secondary">管理系统中的笔记、分类和标签</Text>
          </div>
        </div>
        <Space>
          <Button
            icon={<AppstoreOutlined />}
            onClick={() => navigate('/notes/categories')}
            size="large"
          >
            分类管理
          </Button>
          <Button
            icon={<TagOutlined />}
            onClick={() => navigate('/notes/tags')}
            size="large"
          >
            标签管理
          </Button>
        </Space>
      </div>
      <NoteList />
    </>
  );
};
const NoteManagement = () => {
  const navigate = useNavigate();

  return (
    <div className="content-management-container">
      <Routes>
        <Route path="/" element={<NoteListPage />} />
        {/* 侧边栏菜单使用的路径，与 "/" 等价，避免死链 */}
        <Route path="/list" element={<NoteListPage />} />
        <Route path="/detail/:id" element={<NoteDetail />} />
        <Route path="/categories" element={<CategoryManagement />} />
        <Route path="/tags" element={<TagManagement />} />
      </Routes>
    </div>
  );
};

export default NoteManagement;
