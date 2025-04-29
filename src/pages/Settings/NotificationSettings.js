import React from 'react';
import { List, Switch, Typography, Divider } from 'antd';
import { 
  BellOutlined, 
  MessageOutlined, 
  TeamOutlined, 
  FileTextOutlined,
  MailOutlined,
  MobileOutlined
} from '@ant-design/icons';

const { Title, Text } = Typography;

const NotificationSettings = () => {
  // 通知设置列表
  const notificationSettings = [
    {
      category: '应用内通知',
      items: [
        {
          title: '系统通知',
          description: '接收系统更新和维护通知',
          icon: <BellOutlined />,
          defaultChecked: true
        },
        {
          title: '评论通知',
          description: '当有人评论您的笔记时通知您',
          icon: <MessageOutlined />,
          defaultChecked: true
        },
        {
          title: '关注通知',
          description: '当有人关注您时通知您',
          icon: <TeamOutlined />,
          defaultChecked: true
        },
        {
          title: '笔记更新',
          description: '当您关注的笔记有更新时通知您',
          icon: <FileTextOutlined />,
          defaultChecked: true
        }
      ]
    },
    {
      category: '邮件通知',
      items: [
        {
          title: '系统邮件',
          description: '接收系统更新和维护邮件',
          icon: <MailOutlined />,
          defaultChecked: true
        },
        {
          title: '活动邮件',
          description: '接收活动和促销邮件',
          icon: <MailOutlined />,
          defaultChecked: false
        },
        {
          title: '周报邮件',
          description: '接收每周使用统计和推荐',
          icon: <MailOutlined />,
          defaultChecked: false
        }
      ]
    },
    {
      category: '短信通知',
      items: [
        {
          title: '安全短信',
          description: '接收账户安全相关短信',
          icon: <MobileOutlined />,
          defaultChecked: true
        },
        {
          title: '活动短信',
          description: '接收活动和促销短信',
          icon: <MobileOutlined />,
          defaultChecked: false
        }
      ]
    }
  ];
  
  return (
    <div className="notification-settings">
      <Title level={3}>通知设置</Title>
      <Text type="secondary" style={{ marginBottom: 24, display: 'block' }}>
        管理您接收的通知类型和方式
      </Text>
      
      {notificationSettings.map(category => (
        <React.Fragment key={category.category}>
          <Divider orientation="left">{category.category}</Divider>
          
          <List
            itemLayout="horizontal"
            dataSource={category.items}
            renderItem={item => (
              <List.Item
                actions={[
                  <Switch defaultChecked={item.defaultChecked} />
                ]}
              >
                <List.Item.Meta
                  avatar={item.icon}
                  title={item.title}
                  description={item.description}
                />
              </List.Item>
            )}
          />
        </React.Fragment>
      ))}
    </div>
  );
};

export default NotificationSettings;
