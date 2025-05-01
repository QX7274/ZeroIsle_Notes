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

const NoteManagement = () => {
  const navigate = useNavigate();

  return (
    <div className="content-management-container">
      <Routes>
        <Route
          path="/"
          element={
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
                  <Button
                    type="primary"
                    icon={<PlusOutlined />}
                    onClick={() => navigate('/notes/create')}
                    size="large"
                  >
                    创建笔记
                  </Button>
                </Space>
              </div>
              <NoteList />
            </>
          }
        />
        <Route path="/detail/:id" element={<NoteDetail />} />
        <Route path="/categories" element={<CategoryManagement />} />
        <Route path="/tags" element={<TagManagement />} />
      </Routes>
    </div>
  );
};

export default NoteManagement;
