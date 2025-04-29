import React from 'react';
import { Typography, Divider, List, Button, Card } from 'antd';
import { 
  InfoCircleOutlined, 
  QuestionCircleOutlined, 
  FileTextOutlined,
  GithubOutlined,
  MailOutlined
} from '@ant-design/icons';

const { Title, Text, Paragraph } = Typography;

const AboutApp = () => {
  // 应用信息
  const appInfo = {
    name: '零屿笔记',
    version: 'v1.0.0',
    description: '一款简洁高效的笔记应用，帮助您随时随地记录灵感和管理知识。',
    developer: 'ZeroIsle Team',
    copyright: `© ${new Date().getFullYear()} ZeroIsle. All rights reserved.`
  };
  
  // 联系方式
  const contactInfo = [
    {
      title: '官方网站',
      icon: <GithubOutlined />,
      content: 'https://zeroislenotes.com'
    },
    {
      title: '技术支持',
      icon: <MailOutlined />,
      content: 'support@zeroislenotes.com'
    },
    {
      title: '问题反馈',
      icon: <QuestionCircleOutlined />,
      content: 'feedback@zeroislenotes.com'
    }
  ];
  
  return (
    <div className="about-app">
      <Title level={3}>关于应用</Title>
      <Text type="secondary" style={{ marginBottom: 24, display: 'block' }}>
        了解应用信息和获取帮助
      </Text>
      
      <Card className="app-info-card" style={{ marginBottom: 24 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <img 
            src="/logo.png" 
            alt="App Logo" 
            style={{ width: 80, height: 80, marginBottom: 16 }}
          />
          <Title level={4} style={{ margin: 0 }}>{appInfo.name}</Title>
          <Text type="secondary">{appInfo.version}</Text>
        </div>
        
        <Paragraph style={{ textAlign: 'center' }}>
          {appInfo.description}
        </Paragraph>
      </Card>
      
      <Divider orientation="left">联系我们</Divider>
      
      <List
        itemLayout="horizontal"
        dataSource={contactInfo}
        renderItem={item => (
          <List.Item>
            <List.Item.Meta
              avatar={item.icon}
              title={item.title}
              description={item.content}
            />
          </List.Item>
        )}
      />
      
      <Divider orientation="left">法律信息</Divider>
      
      <div style={{ marginBottom: 24 }}>
        <Button 
          type="link" 
          icon={<FileTextOutlined />}
          style={{ paddingLeft: 0 }}
        >
          用户协议
        </Button>
        <Button 
          type="link" 
          icon={<FileTextOutlined />}
          style={{ paddingLeft: 0 }}
        >
          隐私政策
        </Button>
      </div>
      
      <div style={{ textAlign: 'center', marginTop: 32 }}>
        <Text type="secondary">{appInfo.copyright}</Text>
        <br />
        <Text type="secondary">开发者: {appInfo.developer}</Text>
      </div>
    </div>
  );
};

export default AboutApp;
