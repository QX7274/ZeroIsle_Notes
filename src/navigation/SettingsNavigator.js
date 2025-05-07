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
import BindWechat from '../screens/settings/BindWechat';
import BindQQ from '../screens/settings/BindQQ';
import ThemeSettingsScreen from '../screens/settings/ThemeSettingsScreen';
import FontSettings from '../screens/settings/FontSettings';
import OfflineDataScreen from '../screens/settings/OfflineDataScreen';
import BackupRestoreScreen from '../screens/settings/BackupRestoreScreen';
import NotificationSettingsScreen from '../screens/settings/NotificationSettingsScreen';
import AboutScreen from '../screens/settings/AboutScreen';
import HelpScreen from '../screens/settings/HelpScreen';
import AIAssistantSettingsScreen from '../screens/settings/AIAssistantSettingsScreen';
import { ThemeCustomizationScreen } from '../screens/theme';

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
        name="BindWechat"
        component={BindWechat}
        options={{ title: '微信绑定', headerShown: false }}
      />
      <Stack.Screen
        name="BindQQ"
        component={BindQQ}
        options={{ title: 'QQ绑定', headerShown: false }}
      />
      <Stack.Screen
        name="ThemeSettings"
        component={ThemeSettingsScreen}
        options={{ title: '主题设置', headerShown: false }}
      />
      <Stack.Screen
        name="FontSettings"
        component={FontSettings}
        options={{ title: '字体设置', headerShown: false }}
      />
      <Stack.Screen
        name="AIAssistantSettings"
        component={AIAssistantSettingsScreen}
        options={{ title: 'AI助手设置', headerShown: false }}
      />
      <Stack.Screen
        name="ThemeCustomization"
        component={ThemeCustomizationScreen}
        options={{ title: '自定义主题', headerShown: false }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: '设置', headerShown: false }}
      />
      <Stack.Screen
        name="OfflineData"
        component={OfflineDataScreen}
        options={{ title: '离线数据', headerShown: false }}
      />
      <Stack.Screen
        name="BackupRestore"
        component={BackupRestoreScreen}
        options={{ title: '备份与恢复', headerShown: false }}
      />
      <Stack.Screen
        name="NotificationSettings"
        component={NotificationSettingsScreen}
        options={{ title: '通知设置', headerShown: false }}
      />
      <Stack.Screen
        name="About"
        component={AboutScreen}
        options={{ title: '关于', headerShown: false }}
      />
      <Stack.Screen
        name="Help"
        component={HelpScreen}
        options={{ title: '帮助与反馈', headerShown: false }}
      />
    </Stack.Navigator>
  );
};

export default ProfileNavigator;
