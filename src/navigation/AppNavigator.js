/**
 * 应用主导航配置
 */

import React, { useEffect } from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useSelector, useDispatch } from 'react-redux';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTheme } from '../context/ThemeContext';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { navigationRef } from './navigationRef';

// 导入Redux操作
import { getProfile } from '../store/slices/authSlice';

// 导入组件
import { Loading } from '../components/common';

// 导入导航器
import AuthNavigator from './AuthNavigator';
import SettingsNavigator from './SettingsNavigator';

// 导入屏幕
import HomeScreen from '../screens/HomeScreen';
import ReminderScreen from '../screens/ReminderScreen';
import SettingsScreen from '../screens/SettingsScreen';
import ThemeSettingsScreen from '../screens/ThemeSettingsScreen';
import ThemeCustomizationScreen from '../screens/ThemeCustomizationScreen';
import AnalyticsScreen from '../screens/AnalyticsScreen';
import GroupScreen from '../screens/GroupScreen';
import CodeEditorScreen from '../screens/CodeEditorScreen';
import NoteScreen from '../screens/NoteScreen';
import CategoryScreen from '../screens/CategoryScreen';
import AIAssistantScreen from '../screens/AIAssistantScreen';
import AIAssistantSettingsScreen from '../screens/AIAssistantSettingsScreen';
import SearchResultsScreen from '../screens/SearchResultsScreen';
import { CommunityScreen, PostDetailScreen, CreatePostScreen } from '../screens/community';
import ApiTestComponent from '../components/ApiTestComponent';
// 直接导入知识图谱相关组件
import KnowledgeGraphScreen from '../screens/knowledge/KnowledgeGraphScreen';
import NodeDetailScreen from '../screens/knowledge/NodeDetailScreen';
import EdgeEditScreen from '../screens/knowledge/EdgeEditScreen';
import KnowledgeAnalysisScreen from '../screens/knowledge/KnowledgeAnalysisScreen';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

/**
 * 应用主导航器
 * 根据认证状态决定显示认证导航还是主功能导航
 */
const AppNavigator = () => {
  const dispatch = useDispatch();
  const { theme } = useTheme();

  // 从Redux获取认证状态
  const { isAuthenticated, isLoading } = useSelector(state => {
    // 兼容旧的Redux结构
    if (state.auth) {
      return state.auth;
    }
    // 兼容旧的Redux结构
    return {
      isAuthenticated: state.user?.isAuthenticated || false,
      isLoading: state.user?.isLoading || false
    };
  });

  // 应用启动时检查认证状态
  useEffect(() => {
    if (isAuthenticated) {
      dispatch(getProfile());
    }
  }, [dispatch, isAuthenticated]);

  // 如果正在检查认证状态，显示加载指示器
  if (isLoading) {
    return <Loading type="fullscreen" text="加载中..." />;
  }

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
 * 主标签导航
 * 包含首页、分类、社区和设置等主要功能模块
 */
const MainTabs = () => {
  const { theme } = useTheme();
  const { colors } = theme;

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ color, size }) => {
          let iconName;

          if (route.name === 'HomeStack') {
            iconName = 'home';
          } else if (route.name === 'CategoryStack') {
            iconName = 'folder';
          } else if (route.name === 'AIAssistant') {
            iconName = 'smart-toy';
          } else if (route.name === 'CommunityStack') {
            iconName = 'forum';
          } else if (route.name === 'Profile') {
            iconName = 'person';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          elevation: 8,
          shadowColor: colors.shadow,
          shadowOffset: { width: 0, height: -3 },
          shadowOpacity: 0.1,
          shadowRadius: 3,
          height: 60,
          paddingBottom: 8,
          paddingTop: 8,
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
        name="AIAssistant"
        component={AIAssistantScreen}
        options={{
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
        name="Profile"
        component={SettingsNavigator}
        options={{
          headerShown: false,
          title: '个人中心',
          tabBarLabel: '个人中心',
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
  const { theme } = useTheme();

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
      <Stack.Screen
        name="Note"
        component={NoteScreen}
        options={({ route }) => ({
          title: route.params?.title || '笔记详情',
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
 * 分类堆栈导航
 * 包含分类列表、笔记列表等功能
 */
const CategoryStack = () => {
  const { theme } = useTheme();

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
      <Stack.Screen
        name="NoteList"
        component={NoteScreen}
        options={({ route }) => ({
          title: route.params?.title || '笔记列表',
          headerBackTitleVisible: false,
        })}
      />
    </Stack.Navigator>
  );
};

/**
 * 社区堆栈导航
 * 包含社区首页、帖子详情等功能
 */
const CommunityStack = () => {
  const { theme } = useTheme();

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
        component={ApiTestComponent}
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
    </Stack.Navigator>
  );
};

export default AppNavigator;