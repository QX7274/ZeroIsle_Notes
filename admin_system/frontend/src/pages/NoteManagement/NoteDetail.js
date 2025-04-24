import React, { useState, useEffect } from 'react';
import { Card, Descriptions, Tag, Spin, Button, message } from 'antd';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeftOutlined } from '@ant-design/icons';
import axios from 'axios';

const NoteDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [note, setNote] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchNote = async () => {
      try {
        setLoading(true);
        // 在实际应用中，这里应该从API获取笔记详情
        // const response = await axios.get(`/api/content/notes/${id}`);
        // setNote(response.data);
        
        // 模拟API响应
        setTimeout(() => {
          setNote({
            id: id,
            title: '示例笔记标题',
            content: '这是笔记的详细内容，包含了用户记录的信息。',
            author: '用户名',
            category: '工作',
            tags: ['重要', '会议', '项目'],
            created_at: '2025-04-20 14:30:00',
            updated_at: '2025-04-21 09:15:00',
            status: 'published',
            views: 42,
            likes: 7
          });
          setLoading(false);
        }, 1000);
      } catch (error) {
        message.error('获取笔记详情失败');
        setLoading(false);
      }
    };

    fetchNote();
  }, [id]);

  const handleBack = () => {
    navigate('/notes');
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '50px' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div>
      <Button 
        type="link" 
        icon={<ArrowLeftOutlined />} 
        onClick={handleBack}
        style={{ marginBottom: 16 }}
      >
        返回笔记列表
      </Button>
      
      <Card title={`笔记详情: ${note.title}`}>
        <Descriptions bordered column={2}>
          <Descriptions.Item label="ID">{note.id}</Descriptions.Item>
          <Descriptions.Item label="作者">{note.author}</Descriptions.Item>
          <Descriptions.Item label="分类">{note.category}</Descriptions.Item>
          <Descriptions.Item label="状态">{note.status}</Descriptions.Item>
          <Descriptions.Item label="创建时间">{note.created_at}</Descriptions.Item>
          <Descriptions.Item label="更新时间">{note.updated_at}</Descriptions.Item>
          <Descriptions.Item label="浏览量">{note.views}</Descriptions.Item>
          <Descriptions.Item label="点赞数">{note.likes}</Descriptions.Item>
          <Descriptions.Item label="标签" span={2}>
            {note.tags.map(tag => (
              <Tag color="blue" key={tag}>{tag}</Tag>
            ))}
          </Descriptions.Item>
          <Descriptions.Item label="内容" span={2}>
            {note.content}
          </Descriptions.Item>
        </Descriptions>
      </Card>
    </div>
  );
};

export default NoteDetail;
