import React, { useState, useEffect } from 'react';
import { Layout, Menu, Avatar, Dropdown, Button, Badge, Tooltip, theme, message, Space, Typography } from 'antd';
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
  AppstoreOutlined,
  TagOutlined,
  CloudOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
  HomeOutlined,
  BarChartOutlined,
  FileExcelOutlined,
  PieChartOutlined,
  LineChartOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import { logout, getCurrentUser } from '../../services/authService';
import '../../styles/AdminLayout.css';

const { Text } = Typography;

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
    if (path.startsWith('/analytics')) return '/analytics';
    if (path.startsWith('/reports')) return '/reports';
    return '/dashboard';
  };

  // 获取面包屑导航
  const getBreadcrumb = () => {
    const path = location.pathname;
    const breadcrumbMap = {
      '/dashboard': [{ title: '仪表盘', icon: <HomeOutlined /> }],
      '/users': [{ title: '首页', path: '/dashboard', icon: <HomeOutlined /> }, { title: '用户管理', icon: <TeamOutlined /> }],
      '/notes': [{ title: '首页', path: '/dashboard', icon: <HomeOutlined /> }, { title: '内容管理', icon: <FileTextOutlined /> }],
      '/settings': [{ title: '首页', path: '/dashboard', icon: <HomeOutlined /> }, { title: '系统设置', icon: <SettingOutlined /> }],
      '/logs': [{ title: '首页', path: '/dashboard', icon: <HomeOutlined /> }, { title: '操作日志', icon: <HistoryOutlined /> }],
      '/analytics': [{ title: '首页', path: '/dashboard', icon: <HomeOutlined /> }, { title: '数据分析', icon: <BarChartOutlined /> }],
      '/reports': [{ title: '首页', path: '/dashboard', icon: <HomeOutlined /> }, { title: '报表生成', icon: <FileExcelOutlined /> }],
    };

    // 处理子路径
    if (path.startsWith('/users/')) {
      if (path.includes('/users/analytics')) {
        return [...breadcrumbMap['/users'], { title: '用户分析', icon: <LineChartOutlined /> }];
      } else if (path.includes('/users/list')) {
        return [...breadcrumbMap['/users'], { title: '用户列表', icon: <UnorderedListOutlined /> }];
      } else {
        return [...breadcrumbMap['/users'], { title: '用户详情', icon: <UserOutlined /> }];
      }
    } else if (path.startsWith('/notes/')) {
      return [...breadcrumbMap['/notes'], { title: '笔记详情', icon: <FileTextOutlined /> }];
    } else if (path.startsWith('/settings/')) {
      const settingTitle = path.includes('config') ? '系统配置' :
                          path.includes('announcements') ? '公告管理' :
                          path.includes('profile') ? '个人资料' : '系统设置';
      const settingIcon = path.includes('config') ? <SettingOutlined /> :
                         path.includes('announcements') ? <BellOutlined /> :
                         path.includes('profile') ? <UserOutlined /> : <AppstoreOutlined />;
      return [...breadcrumbMap['/settings'], { title: settingTitle, icon: settingIcon }];
    }

    return breadcrumbMap[path] || breadcrumbMap['/dashboard'];
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
          boxShadow: '2px 0 20px rgba(0,0,0,0.08)', // 增强阴影效果
          zIndex: 1000,
          borderRight: '1px solid rgba(0,0,0,0.03)', // 添加细边框
          background: 'linear-gradient(135deg, #FFFFFF, #F8FAFF)', // 更新渐变背景
        }}
        width={260} // 增加宽度
      >
        <div className="logo">
          {collapsed ? '零屿' : '零屿笔记管理系统'}
        </div>
        <Menu
          theme="light"
          mode="inline"
          selectedKeys={[getSelectedKey()]}
          onClick={handleMenuClick}
          style={{
            background: 'transparent', // 透明背景
            border: 'none', // 移除边框
            padding: '12px', // 增加内边距
          }}
          items={[
            {
              key: '/dashboard',
              icon: <DashboardOutlined className="menu-icon" />,
              label: '仪表盘',
            },
            {
              key: '/users',
              icon: <TeamOutlined className="menu-icon" />,
              label: '用户管理',
              children: [
                {
                  key: '/users/list',
                  label: '用户列表',
                },
                {
                  key: '/users/analytics',
                  label: '用户分析',
                },
              ],
            },
            {
              key: '/notes',
              icon: <FileTextOutlined className="menu-icon" />,
              label: '内容管理',
              children: [
                {
                  key: '/notes/list',
                  label: '笔记列表',
                },
                {
                  key: '/notes/categories',
                  label: '分类管理',
                },
                {
                  key: '/notes/tags',
                  label: '标签管理',
                },
              ],
            },
            {
              key: '/logs',
              icon: <HistoryOutlined className="menu-icon" />,
              label: '操作日志',
              children: [
                {
                  key: '/logs/admin',
                  label: '管理员操作日志',
                },
                {
                  key: '/logs/system',
                  label: '系统日志',
                },
                {
                  key: '/logs/analytics',
                  label: '日志分析',
                },
              ],
            },
            {
              key: '/analytics',
              icon: <BarChartOutlined className="menu-icon" />,
              label: '数据分析',
              children: [
                {
                  key: '/analytics/dashboard',
                  label: '数据仪表盘',
                },
                {
                  key: '/analytics/user',
                  label: '用户分析',
                },
                {
                  key: '/analytics/content',
                  label: '内容分析',
                },
                {
                  key: '/analytics/system',
                  label: '系统分析',
                },
                {
                  key: '/analytics/reports',
                  label: '报表管理',
                },
                {
                  key: '/analytics/templates',
                  label: '报表模板',
                },
              ],
            },

            {
              key: '/settings',
              icon: <SettingOutlined className="menu-icon" />,
              label: '系统设置',
              children: [
                {
                  key: '/settings/config',
                  label: '系统配置',
                },
                {
                  key: '/settings/announcements',
                  label: '公告管理',
                },
                {
                  key: '/settings/backups',
                  label: '备份管理',
                },
              ],
            },
          ]}
        />
        <div className="sider-footer">
          <div className="version">v1.0.0</div>
          <div className="copyright">零屿团队 © {new Date().getFullYear()}</div>
        </div>
      </Sider>
      <Layout style={{ marginLeft: collapsed ? 80 : 240, transition: 'all 0.3s ease' }}>
        <Header
          className="main-header"
          style={{
            padding: 0,
            background: 'rgba(255, 255, 255, 0.98)', // 半透明背景
            position: 'sticky',
            top: 0,
            zIndex: 999,
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            height: 72, // 增加高度
            backdropFilter: 'blur(10px)', // 增强毛玻璃效果
          }}
        >
          <div className="header-left">
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{
                fontSize: '20px', // 增加图标大小
                width: 72, // 增加按钮宽度
                height: 72, // 增加按钮高度
                color: '#4361EE', // 使用主色调
              }}
              className="trigger-button"
            />
            <div className="breadcrumb-container">
              <Space size={8}>
                {getBreadcrumb().map((item, index) => (
                  <React.Fragment key={index}>
                    {index > 0 && <span className="breadcrumb-separator">/</span>}
                    <Space size={4} className="breadcrumb-item">
                      {item.icon}
                      {item.path ? (
                        <Text
                          className="breadcrumb-text clickable"
                          onClick={() => navigate(item.path)}
                        >
                          {item.title}
                        </Text>
                      ) : (
                        <Text className="breadcrumb-text current">{item.title}</Text>
                      )}
                    </Space>
                  </React.Fragment>
                ))}
              </Space>
            </div>
          </div>
          <div className="header-right">
            <Tooltip title="帮助文档" placement="bottom">
              <Button
                type="text"
                icon={<QuestionCircleOutlined />}
                className="header-icon"
                onClick={() => window.open('https://github.com/your-repo/docs', '_blank')}
              />
            </Tooltip>
            <Tooltip title="GitHub仓库" placement="bottom">
              <Button
                type="text"
                icon={<GithubOutlined />}
                className="header-icon"
                onClick={() => window.open('https://github.com/your-repo', '_blank')}
              />
            </Tooltip>
            <Tooltip title={fullscreen ? '退出全屏' : '全屏'} placement="bottom">
              <Button
                type="text"
                icon={fullscreen ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
                className="header-icon"
                onClick={toggleFullscreen}
              />
            </Tooltip>
            <Dropdown overlay={notificationMenu} placement="bottomRight" trigger={['click']}>
              <Badge count={notifications.length} className="notification-badge" style={{ backgroundColor: token.colorPrimary }}>
                <Button type="text" icon={<BellOutlined />} className="header-icon" />
              </Badge>
            </Dropdown>
            <Dropdown overlay={userMenu} placement="bottomRight" trigger={['click']}>
              <div className="user-info">
                <Avatar
                  size={40} // 增加头像大小
                  icon={<UserOutlined />}
                  src={userInfo.avatar}
                  style={{
                    backgroundColor: userInfo.avatar ? 'transparent' : token.colorPrimary,
                    boxShadow: '0 3px 10px rgba(67, 97, 238, 0.2)', // 增强阴影
                  }}
                />
                <span className="username">{userInfo.username || '管理员'}</span>
              </div>
            </Dropdown>
          </div>
        </Header>
        <Content
          className="main-content"
          style={{
            margin: '24px',
            padding: '32px', // 增加内边距
            background: token.colorBgContainer,
            borderRadius: '16px', // 增加圆角
            minHeight: 280,
            boxShadow: '0 6px 24px rgba(0, 0, 0, 0.06)', // 增强阴影
            animation: 'fadeIn 0.5s ease-out', // 添加淡入动画
          }}
        >
          <Outlet />
        </Content>
        <Footer style={{
          textAlign: 'center',
          padding: '20px 50px', // 增加内边距
          background: 'rgba(245, 247, 250, 0.7)', // 添加背景色
          borderTop: '1px solid rgba(0, 0, 0, 0.05)', // 添加顶部边框
          color: 'rgba(0, 0, 0, 0.65)', // 更新文字颜色
          fontSize: '14px', // 设置字体大小
          fontWeight: '500', // 增加字体粗细
          backdropFilter: 'blur(5px)', // 添加毛玻璃效果
        }}>
          零屿笔记管理系统 ©{new Date().getFullYear()} 由 零屿团队 提供技术支持
        </Footer>
      </Layout>
    </Layout>
  );
};

export default AdminLayout;
