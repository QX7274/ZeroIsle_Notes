/**
 * 应用主导航配置
 */

import React, { useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { useSelector, useDispatch } from 'react-redux';
import { checkAuthState } from '../redux/slices/authSlice';
import { setCurrentScreen } from '../redux/slices/uiSlice';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import { Loading } from '../components/common';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useTheme } from '../context/ThemeContext';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { Ionicons } from '@expo/vector-icons';

import HomeScreen from '../screens/HomeScreen';
import ReminderScreen from '../screens/ReminderScreen';
import SettingsScreen from '../screens/SettingsScreen';
import AnalyticsScreen from '../screens/AnalyticsScreen';
import GroupScreen from '../screens/GroupScreen';
import CodeEditorScreen from '../screens/CodeEditorScreen';
import NoteScreen from '../screens/NoteScreen';
import CategoryScreen from '../screens/CategoryScreen';
import AIAssistantScreen from '../screens/AIAssistantScreen';
import AIAssistantSettingsScreen from '../screens/AIAssistantSettingsScreen';
import { CommunityScreen, PostDetailScreen } from '../screens/community';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();

/**
 * 应用主导航器
 * 根据认证状态决定显示认证导航还是主功能导航
 */
const AppNavigator = () => {
  const dispatch = useDispatch();
  const { isAuthenticated, isLoading } = useSelector(state => state.auth);
  const { colors } = useTheme();

  // 应用启动时检查认证状态
  useEffect(() => {
    dispatch(checkAuthState());
  }, [dispatch]);

  // 监听路由变化，更新当前屏幕
  const onStateChange = (state) => {
    const currentRouteName = getActiveRouteName(state);
    dispatch(setCurrentScreen(currentRouteName));
  };

  // 如果正在检查认证状态，显示加载指示器
  if (isLoading) {
    return <Loading type="fullscreen" text="加载中..." />;
  }

  return (
    <NavigationContainer onStateChange={onStateChange}>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <Stack.Screen name="MainTabs" component={MainTabs} />
        ) : (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const MainTabs = () => {
  const { colors } = useTheme();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => {
          let iconName;

          if (route.name === 'HomeStack') {
            iconName = 'home';
          } else if (route.name === 'CategoryStack') {
            iconName = 'folder';
          } else if (route.name === 'CommunityStack') {
            iconName = 'forum';
          } else if (route.name === 'Settings') {
            iconName = 'settings';
          }

          return <Icon name={iconName} size={size} color={color} />;
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.text,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
        },
        headerStyle: {
          backgroundColor: colors.background,
        },
        headerTintColor: colors.text,
      })}
    >
      <Tab.Screen
        name="HomeStack"
        component={HomeStack}
        options={{ headerShown: false, title: '首页' }}
      />
      <Tab.Screen
        name="CategoryStack"
        component={CategoryStack}
        options={{ headerShown: false, title: '分类' }}
      />
      <Tab.Screen
        name="CommunityStack"
        component={CommunityStack}
        options={{ headerShown: false, title: '社区' }}
      />
      <Tab.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: '设置' }}
      />
    </Tab.Navigator>
  );
};

const HomeStack = () => (
  <Stack.Navigator>
    <Stack.Screen
      name="Home"
      component={HomeScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="Note"
      component={NoteScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="AIAssistant"
      component={AIAssistantScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="AIAssistantSettings"
      component={AIAssistantSettingsScreen}
      options={{ headerShown: false }}
    />
  </Stack.Navigator>
);

const CategoryStack = () => (
  <Stack.Navigator>
    <Stack.Screen
      name="CategoryList"
      component={CategoryScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="NoteList"
      component={NoteScreen}
      options={{ headerShown: false }}
    />
  </Stack.Navigator>
);

const CommunityStack = () => (
  <Stack.Navigator>
    <Stack.Screen
      name="Community"
      component={CommunityScreen}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="PostDetail"
      component={PostDetailScreen}
      options={{ headerShown: false }}
    />
  </Stack.Navigator>
);

/**
 * 获取当前活动路由名称
 */
const getActiveRouteName = (state) => {
  const route = state.routes[state.index];
  if (route.state) {
    // 嵌套导航器
    return getActiveRouteName(route.state);
  }
  return route.name;
};

export default AppNavigator;