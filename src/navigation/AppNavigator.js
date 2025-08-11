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
import { Loading, SplashScreen } from '../screens/common';

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
import { GroupScreen } from '../screens/groups';
import { CodeEditorScreen } from '../screens/code';
// 导入文件查看器组件
import PDFViewer from '../screens/viewers/PDFViewer';
import DocViewer from '../screens/viewers/DocViewer';
import MarkdownViewer from '../screens/viewers/MarkdownViewer';
import PPTViewer from '../screens/viewers/PPTViewer';
import InfiniteCanvasScreen from '../screens/canvas/InfiniteCanvasScreen';
import PagedNoteScreen from '../screens/note/PagedNoteScreen';
import { CategoryScreen } from '../screens/category';
import { AIAssistantScreen } from '../screens/ai';
import { SearchResultsScreen } from '../screens/search';
import { CommunityScreen, PostDetailScreen, CreatePostScreen } from '../screens/community';
import ApiTest from '../screens/community/ApiTest';
import CommunitySearchScreen from '../screens/community/CommunitySearchScreen';
// 导入知识图谱相关组件
import { KnowledgeGraphScreen, NodeDetailScreen, EdgeEditScreen, KnowledgeAnalysisScreen } from '../screens/knowledge';
// 导入思维导图相关组件
import { MindMapScreen, MindMapEditScreen, MindMapTemplateScreen } from '../screens/mind_map';
// 导入群组导航
import GroupsNavigator from './GroupsNavigator';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

// 定义一个函数来处理特定屏幕的底部导航栏显示逻辑
const getTabBarStyle = (route, colors) => {
  // 获取当前路由的状态
  const routeName = getFocusedRouteNameFromRoute(route) ?? 'Home';

  // 在这些屏幕中隐藏底部导航栏
  const hideTabBarScreens = ['PDFViewer', 'DocViewer', 'ImageViewer', 'VideoPlayer', 'MindMapEdit', 'MarkdownViewer', 'PPTViewer'];

  // 如果当前屏幕在隐藏列表中，则隐藏底部导航栏
  if (hideTabBarScreens.includes(routeName)) {
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
        }
      };
    }
  } catch (error) {
    console.error('AppNavigator: 获取主题失败:', error.message);
    // 使用默认主题
    theme = {
      colors: {
        background: '#F2F2F2',
      }
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
      isLoading: state?.user?.isLoading || false
    };
  });

  console.log('AppNavigator: 认证状态:', isAuthenticated ? '已认证' : '未认证');
  console.log('AppNavigator: 加载状态:', isLoading ? '加载中' : '已加载');

  // 应用启动时检查认证状态
  useEffect(() => {
    console.log('AppNavigator: 认证状态变化，当前状态:', isAuthenticated ? '已认证' : '未认证');
    if (isAuthenticated) {
      console.log('AppNavigator: 用户已认证');
      // 注意：authSlice中没有getProfile函数，暂时注释掉
      // dispatch(getProfile());
    }
  }, [dispatch, isAuthenticated]);

  // 如果正在检查认证状态，显示启动屏幕
  if (isLoading) {
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
      {isAuthenticated ? (
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
        }
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
      }
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
            case 'GroupsStack':
              iconName = 'people'; // 群组
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
                    marginTop: 2
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
        name="CategoryStack"
        component={CategoryStack}
        options={{
          headerShown: false,
          title: '分类',
          tabBarLabel: '分类',
        }}
      />
      <Tab.Screen
        name="ReminderStack"
        component={ReminderNavigator}
        options={{
          headerShown: false,
          title: '日程',
          tabBarLabel: '日程',
        }}
      />
      <Tab.Screen
        name="AIAssistant"
        component={AIAssistantNavigator}
        options={{
          headerShown: false,
          title: 'AI助手',
          tabBarLabel: 'AI助手',
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
      <Tab.Screen
        name="GroupsStack"
        component={GroupsNavigator}
        options={{
          headerShown: false,
          title: '群组',
          tabBarLabel: '群组',
        }}
      />
      <Tab.Screen
        name="MindMapStack"
        component={MindMapStack}
        options={{
          headerShown: false,
          title: '思维导图',
          tabBarLabel: '思维导图',
        }}
      />
      <Tab.Screen
        name="KnowledgeGraph"
        component={KnowledgeGraphStack}
        options={{
          headerShown: false,
          title: '知识图谱',
          tabBarLabel: '知识图谱',
        }}
      />
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
        }
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
      }
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
        name="Home"
        component={HomeScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="SearchResults"
        component={SearchResultsScreen}
        options={{
          title: '搜索结果',
          headerBackTitleVisible: false,
        }}
      />
      {/* 普通笔记功能已移除 */}
      <Stack.Screen
        name="PDFNote"
        component={PDFViewer}
        options={({ route }) => ({
          title: route.params?.title || 'PDF查看器',
          headerBackTitleVisible: false,
        })}
      />
      <Stack.Screen
        name="KnowledgeGraph"
        component={KnowledgeGraphScreen}
        options={{
          title: '知识图谱',
          headerBackTitleVisible: false,
        }}
      />
      <Stack.Screen
        name="MindMap"
        component={MindMapScreen}
        options={{
          title: '思维导图',
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
          headerBackTitleVisible: false,
        }}
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
      <Stack.Screen
        name="InfiniteCanvas"
        component={InfiniteCanvasScreen}
        options={({ route }) => ({
          title: route.params?.title || '无限画布',
          headerShown: false,
          gestureEnabled: true,
        })}
      />
      <Stack.Screen
        name="PagedNote"
        component={PagedNoteScreen}
        options={({ route }) => ({
          title: route.params?.title || '新建笔记',
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
        component={PDFViewer}
        options={({ navigation, route }) => ({
          title: route.params?.title || 'PDF查看器',
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
        name="MarkdownViewer"
        component={MarkdownViewer}
        options={({ navigation, route }) => ({
          title: route.params?.title || 'Markdown',
          headerShown: false,
          gestureEnabled: true,
        })}
      />
      <Stack.Screen
        name="PPTViewer"
        component={PPTViewer}
        options={({ navigation, route }) => ({
          title: route.params?.title || '演示文稿',
          headerShown: false,
          gestureEnabled: true,
        })}
      />
      <Stack.Screen
        name="DocViewer"
        component={DocViewer}
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
        }
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
      }
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
        }
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
      }
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
        }
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
      }
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
        name="Community"
        component={CommunityScreen}
        options={{ title: '社区' }}
      />
      <Stack.Screen
        name="PostDetail"
        component={PostDetailScreen}
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
        options={{
          title: '创建帖子',
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="CommunitySearch"
        component={CommunitySearchScreen}
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
        }
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
      }
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
        name="MindMapList"
        component={MindMapScreen}
        options={{ title: '思维导图' }}
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
        }
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
      }
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

export default AppNavigator;