import React, { useState, useEffect } from 'react';
import { Layout, Menu, Avatar, Dropdown, Button, Badge, Tooltip, theme, message } from 'antd';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  DashboardOutlined,
  UserOutlined,
  FileTextOutlined,
  SettingOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  HistoryOutlined,
  BellOutlined,
  QuestionCircleOutlined,
  GithubOutlined,
  FullscreenOutlined,
  FullscreenExitOutlined,
} from '@ant-design/icons';
import { logout, getCurrentUser } from '../../services/authService';
import '../../styles/AdminLayout.css';

const { Header, Sider, Content, Footer } = Layout;

const AdminLayout = ({ setIsAuthenticated }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [userInfo, setUserInfo] = useState({});
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { token } = theme.useToken();

  // 获取用户信息
  useEffect(() => {
    const fetchUserInfo = async () => {
      try {
        setLoading(true);
        // 从localStorage获取用户信息
        const cachedUserInfo = JSON.parse(localStorage.getItem('adminUser') || '{}');
        setUserInfo(cachedUserInfo);

        // 获取最新的用户信息
        const userData = await getCurrentUser();
        if (userData) {
          setUserInfo(userData);
          localStorage.setItem('adminUser', JSON.stringify(userData));
        }
      } catch (error) {
        console.error('获取用户信息失败:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchUserInfo();
  }, []);

  // 处理全屏切换
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(err => {
        message.error(`全屏模式错误: ${err.message}`);
      });
      setFullscreen(true);
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen();
        setFullscreen(false);
      }
    }
  };

  // 监听全屏变化
  useEffect(() => {
    const handleFullscreenChange = () => {
      setFullscreen(!!document.fullscreenElement);
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);

    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
    };
  }, []);

  // 处理菜单点击
  const handleMenuClick = ({ key }) => {
    navigate(key);
  };

  // 处理退出登录
  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error('退出登录错误:', error);
    } finally {
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminUser');
      setIsAuthenticated(false);
      navigate('/login');
    }
  };

  // 用户下拉菜单
  const userMenu = (
    <Menu
      items={[
        {
          key: 'profile',
          icon: <UserOutlined />,
          label: '个人资料',
          onClick: () => navigate('/settings/profile'),
        },
        {
          key: 'settings',
          icon: <SettingOutlined />,
          label: '账号设置',
          onClick: () => navigate('/settings/account'),
        },
        {
          type: 'divider',
        },
        {
          key: 'logout',
          icon: <LogoutOutlined />,
          label: '退出登录',
          onClick: handleLogout,
          danger: true,
        },
      ]}
    />
  );

  // 通知下拉菜单
  const notificationMenu = (
    <Menu
      items={
        notifications.length > 0
          ? notifications.map((notification, index) => ({
              key: `notification-${index}`,
              label: (
                <div>
                  <div className="notification-title">{notification.title}</div>
                  <div className="notification-time">{notification.time}</div>
                </div>
              ),
              onClick: () => {
                // 处理通知点击
                if (notification.link) {
                  navigate(notification.link);
                }
              },
            }))
          : [
              {
                key: 'no-notification',
                label: '暂无通知',
                disabled: true,
              },
            ]
      }
      footer={
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <Button type="link" size="small" onClick={() => navigate('/notifications')}>
            查看全部
          </Button>
        </div>
      }
    />
  );

  // 获取当前选中的菜单项
  const getSelectedKey = () => {
    const path = location.pathname;
    if (path.startsWith('/users')) return '/users';
    if (path.startsWith('/notes')) return '/notes';
    if (path.startsWith('/settings')) return '/settings';
    if (path.startsWith('/logs')) return '/logs';
    return '/dashboard';
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        theme="light"
        style={{
          overflow: 'auto',
          height: '100vh',
          position: 'fixed',
          left: 0,
          top: 0,
          bottom: 0,
          boxShadow: '2px 0 8px rgba(0,0,0,0.05)',
          zIndex: 1000,
        }}
        width={220}
      >
        <div className="logo">
          {collapsed ? '零屿' : '零屿笔记管理系统'}
        </div>
        <Menu
          theme="light"
          mode="inline"
          selectedKeys={[getSelectedKey()]}
          onClick={handleMenuClick}
          items={[
            {
              key: '/dashboard',
              icon: <DashboardOutlined />,
              label: '仪表盘',
            },
            {
              key: '/users',
              icon: <UserOutlined />,
              label: '用户管理',
            },
            {
              key: '/notes',
              icon: <FileTextOutlined />,
              label: '内容管理',
            },
            {
              key: '/logs',
              icon: <HistoryOutlined />,
              label: '操作日志',
            },
            {
              key: '/settings',
              icon: <SettingOutlined />,
              label: '系统设置',
            },
          ]}
        />
        <div className="sider-footer">
          <div className="version">v1.0.0</div>
        </div>
      </Sider>
      <Layout style={{ marginLeft: collapsed ? 80 : 220, transition: 'all 0.2s' }}>
        <Header
          style={{
            padding: 0,
            background: token.colorBgContainer,
            boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
            position: 'sticky',
            top: 0,
            zIndex: 999,
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 64,
          }}
        >
          <div className="header-left">
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{
                fontSize: '16px',
                width: 64,
                height: 64,
              }}
            />
            <div className="breadcrumb-container">
              {/* 面包屑导航可以在这里添加 */}
            </div>
          </div>
          <div className="header-right">
            <Tooltip title="帮助文档">
              <Button
                type="text"
                icon={<QuestionCircleOutlined />}
                className="header-icon"
                onClick={() => window.open('https://github.com/your-repo/docs', '_blank')}
              />
            </Tooltip>
            <Tooltip title="GitHub仓库">
              <Button
                type="text"
                icon={<GithubOutlined />}
                className="header-icon"
                onClick={() => window.open('https://github.com/your-repo', '_blank')}
              />
            </Tooltip>
            <Tooltip title={fullscreen ? '退出全屏' : '全屏'}>
              <Button
                type="text"
                icon={fullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
                className="header-icon"
                onClick={toggleFullscreen}
              />
            </Tooltip>
            <Dropdown overlay={notificationMenu} placement="bottomRight" trigger={['click']}>
              <Badge count={notifications.length} className="notification-badge">
                <Button type="text" icon={<BellOutlined />} className="header-icon" />
              </Badge>
            </Dropdown>
            <Dropdown overlay={userMenu} placement="bottomRight" trigger={['click']}>
              <div className="user-info">
                <Avatar
                  size="small"
                  icon={<UserOutlined />}
                  src={userInfo.avatar}
                  style={{ backgroundColor: userInfo.avatar ? 'transparent' : '#1890ff' }}
                />
                <span className="username">{userInfo.username || '管理员'}</span>
              </div>
            </Dropdown>
          </div>
        </Header>
        <Content
          style={{
            margin: '24px 16px',
            padding: 24,
            background: token.colorBgContainer,
            borderRadius: token.borderRadius,
            minHeight: 280,
          }}
        >
          <Outlet />
        </Content>
        <Footer style={{ textAlign: 'center', padding: '12px 50px' }}>
          零屿笔记管理系统 ©{new Date().getFullYear()} 由 零屿团队 提供技术支持
        </Footer>
      </Layout>
    </Layout>
  );
};

export default AdminLayout;
