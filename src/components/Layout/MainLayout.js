import React from 'react';
import { Layout, Menu, Avatar, Dropdown, Button, theme } from 'antd';
import {
  UserOutlined,
  SettingOutlined,
  HomeOutlined,
  FileTextOutlined,
  BulbOutlined,
  LogoutOutlined,
  MenuUnfoldOutlined,
  MenuFoldOutlined,
} from '@ant-design/icons';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import authStorage from '../../services/auth/authStorage';
import { clearAuthInfo } from '../../services/auth/authUtils';
import './MainLayout.css';

const { Header, Sider, Content } = Layout;

const MainLayout = ({ children, toggleTheme, isDarkMode }) => {
  const [collapsed, setCollapsed] = React.useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { token } = theme.useToken();

  // 用户信息状态
  const [user, setUser] = React.useState(null);

  // 加载用户信息
  React.useEffect(() => {
    const loadUser = async () => {
      const userData = await authStorage.getUser();
      setUser(userData);
    };
    loadUser();
  }, []);

  // 处理登出
  const handleLogout = async () => {
    await clearAuthInfo();
    navigate('/login');
  };

  // 用户下拉菜单
  const userMenu = (
    <Menu>
      <Menu.Item key="profile" icon={<UserOutlined />} onClick={() => navigate('/settings/personal-info')}>
        个人资料
      </Menu.Item>
      <Menu.Item key="settings" icon={<SettingOutlined />} onClick={() => navigate('/settings')}>
        设置
      </Menu.Item>
      <Menu.Divider />
      <Menu.Item key="logout" icon={<LogoutOutlined />} onClick={handleLogout}>
        退出登录
      </Menu.Item>
    </Menu>
  );

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        theme={isDarkMode ? 'dark' : 'light'}
        className="main-sider"
      >
        <div className="logo">
          {!collapsed && <span>零屿笔记</span>}
        </div>
        <Menu
          theme={isDarkMode ? 'dark' : 'light'}
          mode="inline"
          selectedKeys={[location.pathname]}
        >
          <Menu.Item key="/" icon={<HomeOutlined />}>
            <Link to="/">首页</Link>
          </Menu.Item>
          <Menu.Item key="/notes" icon={<FileTextOutlined />}>
            <Link to="/notes">笔记</Link>
          </Menu.Item>
          <Menu.Item key="/profile" icon={<UserOutlined />}>
            <Link to="/profile">个人中心</Link>
          </Menu.Item>
        </Menu>
        <div className="sider-footer">
          <Button
            type="text"
            icon={isDarkMode ? <BulbOutlined /> : <BulbOutlined />}
            onClick={toggleTheme}
            style={{ width: '100%', textAlign: 'left' }}
          >
            {!collapsed && (isDarkMode ? '浅色模式' : '深色模式')}
          </Button>
        </div>
      </Sider>
      <Layout>
        <Header className="main-header" style={{ background: token.colorBgContainer }}>
          <Button
            type="text"
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
            className="trigger-button"
          />
          <div className="header-right">
            <Dropdown overlay={userMenu} trigger={['click']}>
              <div className="user-dropdown">
                <Avatar icon={<UserOutlined />} src={user?.avatar} />
                {!collapsed && <span className="username">{user?.username || '用户'}</span>}
              </div>
            </Dropdown>
          </div>
        </Header>
        <Content className="main-content">
          {children}
        </Content>
      </Layout>
    </Layout>
  );
};

export default MainLayout;
