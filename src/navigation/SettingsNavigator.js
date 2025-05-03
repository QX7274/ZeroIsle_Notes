/**
 * 个人中心导航栈
 */
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useTheme } from '../context/ThemeContext';

// 导入个人中心相关页面
import ProfileSettings from '../screens/settings/ProfileSettings';
import SettingsScreen from '../screens/settings/SettingsScreen';
import BindPhone from '../screens/settings/BindPhone';
import BindEmail from '../screens/settings/BindEmail';
import ThemeSettingsScreen from '../screens/settings/ThemeSettingsScreen';
import AIAssistantSettingsScreen from '../screens/settings/AIAssistantSettingsScreen';

const Stack = createStackNavigator();

/**
 * 个人中心导航栈
 * 包含个人中心主页、个人资料、手机绑定、邮箱绑定等页面
 */
const ProfileNavigator = () => {
  const { colors } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: colors.card,
          elevation: 0,
          shadowOpacity: 0,
        },
        headerTintColor: colors.text,
        headerTitleStyle: {
          fontWeight: '600',
        },
        cardStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen
        name="ProfileMain"
        component={ProfileSettings}
        options={{ title: '个人中心', headerShown: false }}
      />
      <Stack.Screen
        name="BindPhone"
        component={BindPhone}
        options={{ title: '手机绑定', headerShown: false }}
      />
      <Stack.Screen
        name="BindEmail"
        component={BindEmail}
        options={{ title: '邮箱绑定', headerShown: false }}
      />
      <Stack.Screen
        name="ThemeSettings"
        component={ThemeSettingsScreen}
        options={{ title: '主题设置', headerShown: false }}
      />
      <Stack.Screen
        name="AIAssistantSettings"
        component={AIAssistantSettingsScreen}
        options={{ title: 'AI助手设置', headerShown: false }}
      />
    </Stack.Navigator>
  );
};

export default ProfileNavigator;
