import React from 'react';
import { Layout, Tabs, Typography, Card } from 'antd';
import { 
  UserOutlined, 
  LockOutlined, 
  BellOutlined, 
  GlobalOutlined,
  InfoCircleOutlined,
  CloudOutlined,
  BulbOutlined
} from '@ant-design/icons';
import './Settings.css';

// 导入设置子组件
import PersonalInfo from './PersonalInfo';
import SecuritySettings from './SecuritySettings';
import NotificationSettings from './NotificationSettings';
import ThemeSettings from './ThemeSettings';
import LanguageSettings from './LanguageSettings';
import AboutApp from './AboutApp';

const { Content } = Layout;
const { Title } = Typography;
const { TabPane } = Tabs;

// 设置页面组件
const Settings = () => {
  return (
    <Content className="settings-content">
      <div className="settings-container">
        <Title level={2}>设置</Title>
        <Card className="settings-card">
          <Tabs defaultActiveKey="personal" tabPosition="left">
            <TabPane 
              tab={
                <span>
                  <UserOutlined />
                  个人资料
                </span>
              } 
              key="personal"
            >
              <PersonalInfo />
            </TabPane>
            <TabPane 
              tab={
                <span>
                  <LockOutlined />
                  账户安全
                </span>
              } 
              key="security"
            >
              <SecuritySettings />
            </TabPane>
            <TabPane 
              tab={
                <span>
                  <BellOutlined />
                  通知设置
                </span>
              } 
              key="notification"
            >
              <NotificationSettings />
            </TabPane>
            <TabPane 
              tab={
                <span>
                  <BulbOutlined />
                  主题设置
                </span>
              } 
              key="theme"
            >
              <ThemeSettings />
            </TabPane>
            <TabPane 
              tab={
                <span>
                  <GlobalOutlined />
                  语言设置
                </span>
              } 
              key="language"
            >
              <LanguageSettings />
            </TabPane>
            <TabPane 
              tab={
                <span>
                  <CloudOutlined />
                  数据与同步
                </span>
              } 
              key="data"
            >
              <div>数据与同步设置内容</div>
            </TabPane>
            <TabPane 
              tab={
                <span>
                  <InfoCircleOutlined />
                  关于应用
                </span>
              } 
              key="about"
            >
              <AboutApp />
            </TabPane>
          </Tabs>
        </Card>
      </div>
    </Content>
  );
};

export default Settings;
