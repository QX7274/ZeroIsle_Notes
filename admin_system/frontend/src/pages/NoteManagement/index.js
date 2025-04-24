import React from 'react';
import { Routes, Route, useNavigate } from 'react-router-dom';
import { Typography, Button } from 'antd';
import NoteList from './NoteList';
import NoteDetail from './NoteDetail';
import CategoryManagement from './CategoryManagement';
import TagManagement from './TagManagement';

const { Title } = Typography;

const NoteManagement = () => {
  const navigate = useNavigate();
  
  return (
    <div className="note-management-container">
      <Routes>
        <Route 
          path="/" 
          element={
            <>
              <div className="page-header">
                <Title level={2}>内容管理</Title>
                <div>
                  <Button 
                    type="primary" 
                    onClick={() => navigate('/notes/categories')}
                    style={{ marginRight: 16 }}
                  >
                    分类管理
                  </Button>
                  <Button 
                    onClick={() => navigate('/notes/tags')}
                  >
                    标签管理
                  </Button>
                </div>
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
