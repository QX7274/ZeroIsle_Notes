/**
 * 应用主导航配置
 */

import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { createStackNavigator } from '@react-navigation/stack';
import { useSelector, useDispatch } from 'react-redux';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { getFocusedRouteNameFromRoute } from '@react-navigation/native';
import { useTheme } from '../context/ThemeContext';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { navigationRef } from './navigationRef';

// 导入Redux操作
// 注意：authSlice中没有getProfile函数，暂时注释掉
// import { getProfile } from '../redux/slices/authSlice';

// 导入组件
import SplashScreen from '../screens/common/SplashScreen';

// 导入导航
import AuthNavigator from './AuthNavigator';
import SettingsNavigator from './SettingsNavigator';
import ReminderNavigator from './ReminderNavigator';

// 导入屏幕
import { HomeScreen } from '../screens/common';
import { AddReminderScreen, ReminderDetailScreen } from '../screens/reminder';
import { SettingsScreen, ThemeSettingsScreen, AIAssistantSettingsScreen } from '../screens/settings';
import { ThemeCustomizationScreen } from '../screens/theme';
import { AnalyticsScreen } from '../screens/analytics';
// 移除旧的 GroupScreen 入口，统一使用 GroupsNavigator
import { CodeEditorScreen } from '../screens/code';
// 导入文件查看器组件（直接使用原生实现）
import PDFViewerNative from '../screens/viewers/PDFViewerNative';
import DocViewer from '../screens/viewers/DocViewer';
import MarkdownViewer from '../screens/viewers/MarkdownViewer';
import PPTViewer from '../screens/viewers/PPTViewer';
import FluidInfiniteCanvasScreenNative from '../screens/canvas/FluidInfiniteCanvasScreenNative';
import SkiaPagedCanvasScreenNative from '../screens/note/SkiaPagedCanvasScreenNative';
import CardNoteScreen from '../screens/note/CardNoteScreen';
import { CategoryScreen } from '../screens/category';
import { AIAssistantScreen } from '../screens/ai';
import { SearchResultsScreen } from '../screens/search';
import { CommunityScreen, PostDetailScreen, CreatePostScreen, FollowersScreen, FollowingScreen, NotificationsScreen, ActivityScreen } from '../screens/community';
import ApiTest from '../screens/community/ApiTest';
import CommunitySearchScreen from '../screens/community/CommunitySearchScreen';
// 导入知识图谱相关组件（避免通过 barrel 导出导致的 undefined）
import KnowledgeGraphScreen from '../screens/knowledge/KnowledgeGraphScreen';
import NodeDetailScreen from '../screens/knowledge/NodeDetailScreen';
import EdgeEditScreen from '../screens/knowledge/EdgeEditScreen';
import KnowledgeAnalysisScreen from '../screens/knowledge/KnowledgeAnalysisScreen';
// 导入思维导图相关组件
import { MindMapScreen, MindMapEditScreen, MindMapTemplateScreen } from '../screens/mind_map';
// 导入群组导航

// 导入知识库导航
import KnowledgeNavigator from './KnowledgeNavigator';
// 导入个人纪录相关页面
import PersonalActivityScreen from '../screens/personal_activity/PersonalActivityScreen';
import CategoryManagerScreen from '../screens/personal_activity/CategoryManagerScreen';
import GoalManagerScreen from '../screens/personal_activity/GoalManagerScreen';
import PAAnalyticsScreen from '../screens/personal_activity/AnalyticsScreen';
import ActivityFormScreen from '../screens/personal_activity/ActivityFormScreen';


const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// 递归获取最深层聚焦路由
const getDeepestFocusedRoute = (route) => {
  const state = route?.state;
  if (!state || state.index === undefined || !state.routes?.[state.index]) {
    return route;
  }
  return getDeepestFocusedRoute(state.routes[state.index]);
};

// 获取最深层聚焦路由参数
const getFocusedRouteParams = (route) => {
  const deepestRoute = getDeepestFocusedRoute(route);
  return deepestRoute?.params || {};
};

// 获取最深层聚焦路由名称
const getFocusedRouteNameDeep = (route) => {
  const deepestRoute = getDeepestFocusedRoute(route);
  return deepestRoute?.name;
};

// 定义一个函数来处理特定屏幕的底部导航栏显示逻辑
const getTabBarStyle = (route, colors) => {
  // 获取最深层路由的参数与名称
  const params = getFocusedRouteParams(route);
  const routeName = getFocusedRouteNameDeep(route) || getFocusedRouteNameFromRoute(route) || 'Home';

  // 仅对“笔记编辑/查看”相关全屏页面隐藏底部栏
  const fullscreenScreens = [
    'NoteEditor',
    'InfiniteCanvas',
    'FluidPagedNote',
    'PDFViewer',
    'MarkdownViewer',
    'PPTViewer',
    'DocViewer',
    'CardNote',
  ];

  // HomeStack 当前激活页名（优先使用官方方法，兜底读取 state）
  const focusedHomeRouteName =
    getFocusedRouteNameFromRoute(route) ||
    route?.state?.routes?.[route?.state?.index]?.name ||
    'Home';

  // 显式参数优先：某页面声明 hideTabBar=true 则直接隐藏
  if (params.hideTabBar === true) {
    return { display: 'none' };
  }

  // 主页要保留底栏，仅当进入笔记相关页面时隐藏
  if (route.name === 'HomeStack' && fullscreenScreens.includes(focusedHomeRouteName)) {
    return { display: 'none' };
  }

  if (fullscreenScreens.includes(routeName)) {
    return { display: 'none' };
  }

  // 返回默认的底部导航栏样式
  return {
    backgroundColor: colors.card,
    borderTopColor: colors.border,
    height: 60,
    paddingBottom: 8,
    paddingTop: 8,
    elevation: 4,
    shadowColor: colors.shadow,
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  };
};

/**
 * 应用主导航器
 * 根据认证状态决定显示认证导航还是主功能导航
 */
const AppNavigator = () => {
  const dispatch = useDispatch();

  // 开发调试开关：真机联调时可直接跳过登录
  // 仅在 __DEV__ 下生效，避免影响生产构建
  const DEV_SKIP_LOGIN = __DEV__;

  // 使用 try-catch 包装 useTheme 调用，确保即使出错也能提供默认值
  let theme;
  try {
    const themeContext = useTheme();
    theme = themeContext.theme;

    // 如果 theme 或 theme.colors 为 undefined，使用默认值
    if (!theme || !theme.colors) {
      console.warn('AppNavigator: 主题未正确加载，使用默认主题');
      theme = {
        colors: {
          background: '#F2F2F2',
        },
      };
    }
  } catch (error) {
    console.error('AppNavigator: 获取主题失败:', error.message);
    // 使用默认主题
    theme = {
      colors: {
        background: '#F2F2F2',
      },
    };
  }

  // 从Redux获取认证状态
  console.log('AppNavigator: 尝试获取认证状态...');

  const { isAuthenticated, isLoading } = useSelector(state => {
    console.log('AppNavigator: Redux状态:', state ? '已加载' : '未加载');

    // 添加更多调试信息
    if (state) {
      console.log('AppNavigator: Redux状态结构:', Object.keys(state).join(', '));
      console.log('AppNavigator: auth状态:', state.auth ? '存在' : '不存在');
      console.log('AppNavigator: user状态:', state.user ? '存在' : '不存在');
    }

    // 兼容旧的Redux结构
    if (state && state.auth) {
      console.log('AppNavigator: 使用auth状态');
      return state.auth;
    }

    // 兼容旧的Redux结构
    console.log('AppNavigator: 使用user状态或默认值');
    return {
      isAuthenticated: state?.user?.isAuthenticated || false,
      isLoading: state?.user?.isLoading || false,
    };
  });

  const effectiveAuthenticated = DEV_SKIP_LOGIN ? true : isAuthenticated;
  const effectiveLoading = DEV_SKIP_LOGIN ? false : isLoading;

  if (DEV_SKIP_LOGIN) {
    console.log('AppNavigator: DEV_SKIP_LOGIN 已启用，直接进入主界面');
  }

  console.log('AppNavigator: 认证状态:', isAuthenticated ? '已认证' : '未认证');
  console.log('AppNavigator: 加载状态:', isLoading ? '加载中' : '已加载');

  // 应用启动时检查认证状态
  useEffect(() => {
    console.log('AppNavigator: 认证状态变化，当前状态:', isAuthenticated ? '已认证' : '未认证');
    if (effectiveAuthenticated) {
      console.log('AppNavigator: 用户已认证或处于开发跳过登录模式');
      // 注意：authSlice中没有getProfile函数，暂时注释掉
      // dispatch(getProfile());
    }
  }, [dispatch, isAuthenticated, effectiveAuthenticated]);

  // 如果正在检查认证状态，显示启动屏幕
  if (effectiveLoading) {
    console.log('AppNavigator: 显示启动屏幕...');
    return <SplashScreen message="应用加载中..." />;
  }

  console.log('AppNavigator: 准备渲染导航器...');

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        cardStyle: { backgroundColor: theme.colors.background },
      }}
    >
      {effectiveAuthenticated ? (
        <Stack.Screen name="MainTabs" component={MainTabs} />
      ) : (
        <Stack.Screen name="Auth" component={AuthNavigator} />
      )}
    </Stack.Navigator>
  );
};

/**
 * 主标签导航器
 * 包含首页、分类、社区和设置等主要功能模块
 */
const MainTabs = () => {
  // 使用 try-catch 包装 useTheme 调用，确保即使出错也能提供默认值
  let theme, colors;
  try {
    const themeContext = useTheme();
    theme = themeContext.theme;

    // 如果 theme 或 theme.colors 为 undefined，使用默认值
    if (!theme || !theme.colors) {
      console.warn('MainTabs: 主题未正确加载，使用默认主题');
      theme = {
        colors: {
          primary: '#007AFF',
          textSecondary: '#8E8E93',
          card: '#FFFFFF',
          shadow: 'rgba(0, 0, 0, 0.1)',
          text: '#000000',
          background: '#F2F2F2',
          border: '#E5E5EA',
        },
      };
    }
    colors = theme.colors;
  } catch (error) {
    console.error('MainTabs: 获取主题失败:', error.message);
    // 使用默认主题
    theme = {
      colors: {
        primary: '#007AFF',
        textSecondary: '#8E8E93',
        card: '#FFFFFF',
        shadow: 'rgba(0, 0, 0, 0.1)',
        text: '#000000',
        background: '#F2F2F2',
        border: '#E5E5EA',
      },
    };
    colors = theme.colors;
  }

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        // 使用getTabBarStyle函数控制底部导航栏的显示和样式
        tabBarStyle: getTabBarStyle(route, colors),
        tabBarIcon: ({ color, focused }) => {
          let iconName;
          let iconStyle = { marginBottom: 2 };

          // 使用简洁明了的图标
          switch (route.name) {
            case 'HomeStack':
              iconName = 'home'; // 首页
              break;
            case 'AIAssistant':
              iconName = 'smart-toy'; // AI助手
              break;
            case 'KnowledgeStack':
              iconName = 'auto-stories'; // 知识库
              break;
            case 'PersonalActivity':
              iconName = 'space-dashboard'; // 零屿空间
              break;
            case 'MindMapStack':
              iconName = 'account-tree'; // 思维导图
              break;
            case 'KnowledgeGraph':
              iconName = 'bubble-chart'; // 知识图谱
              break;
            case 'Profile':
              iconName = 'person'; // 我的
              break;
            // 保留其他图标定义，以便将来可能重新启用
            case 'CategoryStack':
              iconName = 'category'; // 分类
              break;
            case 'ReminderStack':
              iconName = 'event'; // 日程
              break;
            case 'CommunityStack':
              iconName = 'chat'; // 社区
              break;
            default:
              iconName = 'circle';
              break;
          }

          return (
            <View style={{ alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={iconName} size={22} color={color} style={iconStyle} />
              {focused && (
                <View
                  style={{
                    width: 4,
                    height: 4,
                    borderRadius: 2,
                    backgroundColor: color,
                    marginTop: 2,
                  }}
                />
              )}
            </View>
          );
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '400',
          marginBottom: 2,
        },
        headerStyle: {
          backgroundColor: colors.card,
          elevation: 4,
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 2,
        },
        headerTintColor: colors.text,
        headerTitleStyle: {
          fontWeight: '600',
        },
        tabBarTestID: 'nav.bottomTab',
        tabBarButton: (props) => {
          let tabButtonTestID;
          switch (route.name) {
            case 'HomeStack':
              tabButtonTestID = 'nav.tab.home';
              break;
            case 'AIAssistant':
              tabButtonTestID = 'nav.tab.ai';
              break;
            case 'CommunityStack':
              tabButtonTestID = 'nav.tab.community';
              break;
            case 'Profile':
              tabButtonTestID = 'nav.tab.profile';
              break;
            default:
              tabButtonTestID = undefined;
              break;
          }

          return <TouchableOpacity {...props} testID={tabButtonTestID} />;
        },
      })}
    >
      <Tab.Screen
        name="HomeStack"
        component={HomeStack}
        options={{
          headerShown: false,
          title: '首页',
          tabBarLabel: '首页',
        }}
      />
      <Tab.Screen
        name="AIAssistant"
        component={AIAssistantNavigator}
        options={{
          headerShown: false,
          title: 'AI',
          tabBarLabel: 'AI',
          tabBarButtonTestID: 'nav.tab.ai',
        }}
      />



      <Tab.Screen
        name="CommunityStack"
        component={CommunityStack}
        options={{
          headerShown: false,
          title: '社区',
          tabBarLabel: '社区',
        }}
      />

      {/* 删除：群组 Tab（已在“我的”中提供入口） */}
      <Tab.Screen
        name="Profile"
        component={SettingsNavigator}
        options={{
          headerShown: false,
          title: '我的',
          tabBarLabel: '我的',
        }}
      />
    </Tab.Navigator>
  );
};

/**
 * 首页堆栈导航
 * 包含首页、笔记详情、AI助手等功能
 */
const HomeStack = () => {
  // 使用 try-catch 包装 useTheme 调用，确保即使出错也能提供默认值
  let theme;
  try {
    const themeContext = useTheme();
    theme = themeContext.theme;

    // 如果 theme 或 theme.colors 为 undefined，使用默认值
    if (!theme || !theme.colors) {
      console.warn('HomeStack: 主题未正确加载，使用默认主题');
      theme = {
        colors: {
          card: '#FFFFFF',
          shadow: 'rgba(0, 0, 0, 0.1)',
          text: '#000000',
          background: '#F2F2F2',
        },
      };
    }
  } catch (error) {
    console.error('HomeStack: 获取主题失败:', error.message);
    // 使用默认主题
    theme = {
      colors: {
        card: '#FFFFFF',
        shadow: 'rgba(0, 0, 0, 0.1)',
        text: '#000000',
        background: '#F2F2F2',
      },
    };
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        headerStyle: {
          backgroundColor: theme.colors.card,
          elevation: 4,
          shadowColor: theme.colors.shadow,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 2,
        },
        headerTintColor: theme.colors.text,
        headerTitleStyle: {
          fontWeight: '600',
        },
        cardStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen
        name="Home"
        component={HomeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Category"
        component={CategoryScreen}
        options={{
          title: '分类',
          headerBackTitleVisible: false,
        }}
      />
      <Stack.Screen
        name="SearchResults"
        component={SearchResultsScreen}
        options={{
          title: '搜索结果',
          headerBackTitleVisible: false,
        }}
      />
      <Stack.Screen
        name="KnowledgeGraph"
        component={KnowledgeGraphScreen}
        options={{
          title: '知识图谱',
          headerShown: false,
          headerBackTitleVisible: false,
        }}
      />
      <Stack.Screen
        name="MindMap"
        component={MindMapScreen}
        options={{
          title: '思维导图',
          headerShown: false,
          headerBackTitleVisible: false,
        }}
      />
      <Stack.Screen
        name="MindMapEdit"
        component={MindMapEditScreen}
        options={{
          title: '编辑思维导图',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="MindMapTemplate"
        component={MindMapTemplateScreen}
        options={{
          title: '思维导图模板',
          headerShown: false,
          headerBackTitleVisible: false,
        }}
      />
      <Stack.Screen
        name="NodeDetail"
        component={NodeDetailScreen}
        options={({ route }) => ({
          title: route.params?.title || '节点详情',
          headerShown: false,
          headerBackTitleVisible: false,
        })}
      />
      <Stack.Screen
        name="EdgeEdit"
        component={EdgeEditScreen}
        options={({ route }) => ({
          title: route.params?.edgeId ? '编辑关系' : '创建关系',
          headerBackTitleVisible: false,
        })}
      />
      <Stack.Screen
        name="KnowledgeAnalysis"
        component={KnowledgeAnalysisScreen}
        options={{
          title: '知识分析',
          headerShown: false,
          headerBackTitleVisible: false,
        }}
      />
      <Stack.Screen
        name="InfiniteCanvas"
        component={FluidInfiniteCanvasScreenNative}
        initialParams={{ hideTabBar: true }}
        options={({ route }) => ({
          title: route.params?.title || '无限画布',
          headerShown: false,
          gestureEnabled: true,
        })}
      />
      <Stack.Screen
        name="FluidPagedNote"
        component={SkiaPagedCanvasScreenNative}
        initialParams={{ hideTabBar: true }}
        options={({ route }) => ({
          title: route.params?.title || '分页笔记',
          headerShown: false,
          gestureEnabled: true,
        })}
      />

      {/* ReminderScreen已移除，使用AddReminderScreen */}
      <Stack.Screen
        name="AddReminder"
        component={AddReminderScreen}
        options={{
          title: '添加提醒',
          headerBackTitleVisible: false,
        }}
      />
      <Stack.Screen
        name="ReminderDetail"
        component={ReminderDetailScreen}
        options={({ route }) => ({
          title: route.params?.title || '提醒详情',
          headerBackTitleVisible: false,
        })}
      />



      {/* 增强型文件查看器组件 */}
      <Stack.Screen
        name="PDFViewer"
        component={PDFViewerNative}
        initialParams={{ hideTabBar: true }}
        options={({ navigation, route }) => ({
          title: route.params?.title || 'PDF查看器',
          headerShown: false, // 隐藏头部导航栏，实现全屏显示
          gestureEnabled: true, // 启用手势返回
          // 使用默认的卡片动画，避免过渡期间显示主页内容
          presentation: 'card',
        })}
      />
      <Stack.Screen
        name="MarkdownViewer"
        component={MarkdownViewer}
        initialParams={{ hideTabBar: true }}
        options={({ navigation, route }) => ({
          title: route.params?.title || 'Markdown',
          headerShown: false,
          gestureEnabled: true,
        })}
      />
      <Stack.Screen
        name="PPTViewer"
        component={PPTViewer}
        initialParams={{ hideTabBar: true }}
        options={({ navigation, route }) => ({
          title: route.params?.title || '演示文稿',
          headerShown: false,
          gestureEnabled: true,
        })}
      />
      <Stack.Screen
        name="DocViewer"
        component={DocViewer}
        initialParams={{ hideTabBar: true }}
        options={({ navigation, route }) => ({
          title: route.params?.title || '文档查看器',
          headerShown: false, // 隐藏头部导航栏，实现全屏显示
          gestureEnabled: true, // 启用手势返回
          cardStyleInterpolator: ({ current, layouts }) => {
            return {
              cardStyle: {
                transform: [
                  {
                    translateX: current.progress.interpolate({
                      inputRange: [0, 1],
                      outputRange: [layouts.screen.width, 0],
                    }),
                  },
                ],
              },
            };
          },
        })}
      />
      <Stack.Screen
        name="CardNote"
        component={CardNoteScreen}
        initialParams={{ hideTabBar: true }}
        options={({ navigation, route }) => ({
          title: route.params?.title || '卡片笔记',
          headerShown: false,
          gestureEnabled: true,
        })}
      />
    </Stack.Navigator>
  );
};

/**
 * 分类堆栈导航
 * 包含分类列表、笔记列表等功能
 */
const CategoryStack = () => {
  // 使用 try-catch 包装 useTheme 调用，确保即使出错也能提供默认值
  let theme;
  try {
    const themeContext = useTheme();
    theme = themeContext.theme;

    // 如果 theme 或 theme.colors 为 undefined，使用默认值
    if (!theme || !theme.colors) {
      console.warn('CategoryStack: 主题未正确加载，使用默认主题');
      theme = {
        colors: {
          card: '#FFFFFF',
          shadow: 'rgba(0, 0, 0, 0.1)',
          text: '#000000',
          background: '#F2F2F2',
        },
      };
    }
  } catch (error) {
    console.error('CategoryStack: 获取主题失败:', error.message);
    // 使用默认主题
    theme = {
      colors: {
        card: '#FFFFFF',
        shadow: 'rgba(0, 0, 0, 0.1)',
        text: '#000000',
        background: '#F2F2F2',
      },
    };
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        headerStyle: {
          backgroundColor: theme.colors.card,
          elevation: 4,
          shadowColor: theme.colors.shadow,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 2,
        },
        headerTintColor: theme.colors.text,
        headerTitleStyle: {
          fontWeight: '600',
        },
        cardStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen
        name="CategoryList"
        component={CategoryScreen}
        options={{ title: '分类' }}
      />
      {/* 笔记列表功能已移除 */}
    </Stack.Navigator>
  );
};

/**
 * 知识图谱堆栈导航
 * 包含知识图谱主页、节点详情等功能
 */
const KnowledgeGraphStack = () => {
  // 使用 try-catch 包装 useTheme 调用，确保即使出错也能提供默认值
  let theme;
  try {
    const themeContext = useTheme();
    theme = themeContext.theme;

    // 如果 theme 或 theme.colors 为 undefined，使用默认值
    if (!theme || !theme.colors) {
      console.warn('KnowledgeGraphStack: 主题未正确加载，使用默认主题');
      theme = {
        colors: {
          card: '#FFFFFF',
          shadow: 'rgba(0, 0, 0, 0.1)',
          text: '#000000',
          background: '#F2F2F2',
        },
      };
    }
  } catch (error) {
    console.error('KnowledgeGraphStack: 获取主题失败:', error.message);
    // 使用默认主题
    theme = {
      colors: {
        card: '#FFFFFF',
        shadow: 'rgba(0, 0, 0, 0.1)',
        text: '#000000',
        background: '#F2F2F2',
      },
    };
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        headerStyle: {
          backgroundColor: theme.colors.card,
          elevation: 4,
          shadowColor: theme.colors.shadow,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 2,
        },
        headerTintColor: theme.colors.text,
        headerTitleStyle: {
          fontWeight: '600',
        },
        cardStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen
        name="KnowledgeGraphMain"
        component={KnowledgeGraphScreen}
        options={{ title: '知识图谱' }}
      />
      <Stack.Screen
        name="NodeDetail"
        component={NodeDetailScreen}
        options={({ route }) => ({
          title: route.params?.title || '节点详情',
          headerBackTitleVisible: false,
        })}
      />
      <Stack.Screen
        name="EdgeEdit"
        component={EdgeEditScreen}
        options={({ route }) => ({
          title: route.params?.edgeId ? '编辑关系' : '创建关系',
          headerBackTitleVisible: false,
        })}
      />
      <Stack.Screen
        name="KnowledgeAnalysis"
        component={KnowledgeAnalysisScreen}
        options={{
          title: '知识分析',
          headerBackTitleVisible: false,
        }}
      />
    </Stack.Navigator>
  );
};

/**
 * 社区堆栈导航
 * 包含社区首页、帖子详情等功能
 */
const CommunityStack = () => {
  // 使用 try-catch 包装 useTheme 调用，确保即使出错也能提供默认值
  let theme;
  try {
    const themeContext = useTheme();
    theme = themeContext.theme;

    // 如果 theme 或 theme.colors 为 undefined，使用默认值
    if (!theme || !theme.colors) {
      console.warn('CommunityStack: 主题未正确加载，使用默认主题');
      theme = {
        colors: {
          card: '#FFFFFF',
          shadow: 'rgba(0, 0, 0, 0.1)',
          text: '#000000',
          background: '#F2F2F2',
        },
      };
    }
  } catch (error) {
    console.error('CommunityStack: 获取主题失败:', error.message);
    // 使用默认主题
    theme = {
      colors: {
        card: '#FFFFFF',
        shadow: 'rgba(0, 0, 0, 0.1)',
        text: '#000000',
        background: '#F2F2F2',
      },
    };
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        headerStyle: {
          backgroundColor: theme.colors.card,
          elevation: 4,
          shadowColor: theme.colors.shadow,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 2,
        },
        headerTintColor: theme.colors.text,
        headerTitleStyle: {
          fontWeight: '600',
        },
        cardStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen
        name="Community"
        component={CommunityScreen}
        options={{ title: '社区' }}
      />
      <Stack.Screen
        name="Followers"
        component={FollowersScreen}
        options={{ title: '关注者' }}
      />
      <Stack.Screen
        name="Following"
        component={FollowingScreen}
        options={{ title: '关注中' }}
      />
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ title: '通知' }}
      />
      <Stack.Screen
        name="Activity"
        component={ActivityScreen}
        options={{ title: '动态' }}
      />
      <Stack.Screen
        name="PostDetail"
        component={PostDetailScreen}
        initialParams={{ hideTabBar: true }}
        options={({ route }) => ({
          title: route.params?.title || '帖子详情',
          headerBackTitleVisible: false,
        })}
      />
      <Stack.Screen
        name="ApiTest"
        component={ApiTest}
        options={{
          title: 'API测试',
          headerBackTitleVisible: false,
        }}
      />
      <Stack.Screen
        name="CreatePost"
        component={CreatePostScreen}
        initialParams={{ hideTabBar: true }}
        options={{
          title: '创建帖子',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="CommunitySearch"
        component={CommunitySearchScreen}
        initialParams={{ hideTabBar: true }}
        options={{
          title: '社区搜索',
          headerBackTitleVisible: false,
        }}
      />
    </Stack.Navigator>
  );
};

/**
 * 思维导图堆栈导航
 * 包含思维导图列表、编辑和模板等功能
 */
const MindMapStack = () => {
  // 使用 try-catch 包装 useTheme 调用，确保即使出错也能提供默认值
  let theme;
  try {
    const themeContext = useTheme();
    theme = themeContext.theme;

    // 如果 theme 或 theme.colors 为 undefined，使用默认值
    if (!theme || !theme.colors) {
      console.warn('MindMapStack: 主题未正确加载，使用默认主题');
      theme = {
        colors: {
          card: '#FFFFFF',
          shadow: 'rgba(0, 0, 0, 0.1)',
          text: '#000000',
          background: '#F2F2F2',
        },
      };
    }
  } catch (error) {
    console.error('MindMapStack: 获取主题失败:', error.message);
    // 使用默认主题
    theme = {
      colors: {
        card: '#FFFFFF',
        shadow: 'rgba(0, 0, 0, 0.1)',
        text: '#000000',
        background: '#F2F2F2',
      },
    };
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        headerStyle: {
          backgroundColor: theme.colors.card,
          elevation: 4,
          shadowColor: theme.colors.shadow,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 2,
        },
        headerTintColor: theme.colors.text,
        headerTitleStyle: {
          fontWeight: '600',
        },
        cardStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen
        name="MindMapList"
        component={MindMapScreen}
        options={{ title: '思维导图' }}
      />
      <Stack.Screen
        name="MindMapEdit"
        component={MindMapEditScreen}
        initialParams={{ hideTabBar: true }}
        options={{
          title: '编辑思维导图',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="MindMapTemplate"
        component={MindMapTemplateScreen}
        options={{
          title: '思维导图模板',
          headerBackTitleVisible: false,
        }}
      />
    </Stack.Navigator>
  );
};

/**
 * AI助手导航堆栈
 * 包含AI助手主页和聊天历史等功能
 */
const AIAssistantNavigator = () => {
  // 使用 try-catch 包装 useTheme 调用，确保即使出错也能提供默认值
  let theme;
  try {
    const themeContext = useTheme();
    theme = themeContext.theme;

    // 如果 theme 或 theme.colors 为 undefined，使用默认值
    if (!theme || !theme.colors) {
      console.warn('AIAssistantNavigator: 主题未正确加载，使用默认主题');
      theme = {
        colors: {
          card: '#FFFFFF',
          shadow: 'rgba(0, 0, 0, 0.1)',
          text: '#000000',
          background: '#F2F2F2',
        },
      };
    }
  } catch (error) {
    console.error('AIAssistantNavigator: 获取主题失败:', error.message);
    // 使用默认主题
    theme = {
      colors: {
        card: '#FFFFFF',
        shadow: 'rgba(0, 0, 0, 0.1)',
        text: '#000000',
        background: '#F2F2F2',
      },
    };
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.card,
          elevation: 4,
          shadowColor: theme.colors.shadow,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 2,
        },
        headerTintColor: theme.colors.text,
        headerTitleStyle: {
          fontWeight: '600',
        },
        cardStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen
        name="AIAssistantMain"
        component={AIAssistantScreen}
        options={{ headerShown: false }}
      />

    </Stack.Navigator>
  );
};

/**
 * 个人纪录堆栈导航
 */
const PersonalActivityStack = () => {
  let theme;
  try {
    const themeContext = useTheme();
    theme = themeContext.theme;
    if (!theme || !theme.colors) {
      theme = { colors: { card: '#FFFFFF', shadow: 'rgba(0,0,0,0.1)', text: '#000', background: '#F2F2F2' } };
    }
  } catch (e) {
    theme = { colors: { card: '#FFFFFF', shadow: 'rgba(0,0,0,0.1)', text: '#000', background: '#F2F2F2' } };
  }

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.colors.card,
          elevation: 4,
          shadowColor: theme.colors.shadow,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 2,
        },
        headerTintColor: theme.colors.text,
        headerTitleStyle: { fontWeight: '600' },
        cardStyle: { backgroundColor: theme.colors.background },
      }}
    >
      <Stack.Screen name="PersonalActivity" component={PersonalActivityScreen} options={{ title: '零屿空间' }} />
      <Stack.Screen name="PersonalActivityAnalytics" component={AnalyticsScreen} options={{ title: '数据分析' }} />
      <Stack.Screen name="PersonalActivitySettings" component={CategoryManagerScreen} options={{ title: '分类管理' }} />
      <Stack.Screen name="GoalManager" component={GoalManagerScreen} options={{ title: '目标管理' }} />
      <Stack.Screen name="ActivityForm" component={ActivityFormScreen} options={{ title: '活动表单', headerShown: false }} />
    </Stack.Navigator>
  );
};




export default AppNavigator;
