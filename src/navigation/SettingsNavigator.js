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
// 备份与恢复功能已移除
import NotificationSettingsScreen from '../screens/settings/NotificationSettingsScreen';
import AboutScreen from '../screens/settings/AboutScreen';
import HelpScreen from '../screens/settings/HelpScreen';
import AIAssistantSettingsScreen from '../screens/settings/AIAssistantSettingsScreen';
import SyncSettingsScreen from '../screens/settings/SyncSettingsScreen';
import { ThemeCustomizationScreen } from '../screens/theme';

// 导入功能中心相关导航器和屏幕
import ReminderNavigator from './ReminderNavigator';
import GroupsNavigator from './GroupsNavigator';
import { MindMapScreen, MindMapEditScreen, MindMapTemplateScreen } from '../screens/mind_map';
import { KnowledgeGraphScreen, NodeDetailScreen, EdgeEditScreen, KnowledgeAnalysisScreen, KnowledgeBaseListScreen, KnowledgeBaseDetailScreen, KnowledgeBaseEditScreen, KnowledgeNodeEditScreen } from '../screens/knowledge';
import PersonalActivityScreen from '../screens/personal_activity/PersonalActivityScreen';
import ActivityFormScreen from '../screens/personal_activity/ActivityFormScreen';

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
        initialParams={{ hideTabBar: true }}
        options={{ title: '手机绑定', headerShown: false }}
      />
      <Stack.Screen
        name="BindEmail"
        component={BindEmail}
        initialParams={{ hideTabBar: true }}
        options={{ title: '邮箱绑定', headerShown: false }}
      />
      <Stack.Screen
        name="BindWechat"
        component={BindWechat}
        initialParams={{ hideTabBar: true }}
        options={{ title: '微信绑定', headerShown: false }}
      />
      <Stack.Screen
        name="BindQQ"
        component={BindQQ}
        initialParams={{ hideTabBar: true }}
        options={{ title: 'QQ绑定', headerShown: false }}
      />
      <Stack.Screen
        name="ThemeSettings"
        component={ThemeSettingsScreen}
        initialParams={{ hideTabBar: true }}
        options={{ title: '主题设置', headerShown: false }}
      />
      <Stack.Screen
        name="FontSettings"
        component={FontSettings}
        initialParams={{ hideTabBar: true }}
        options={{ title: '字体设置', headerShown: false }}
      />
      <Stack.Screen
        name="AIAssistantSettings"
        component={AIAssistantSettingsScreen}
        initialParams={{ hideTabBar: true }}
        options={{ title: 'AI助手设置', headerShown: false }}
      />
      <Stack.Screen
        name="ThemeCustomization"
        component={ThemeCustomizationScreen}
        initialParams={{ hideTabBar: true }}
        options={{ title: '自定义主题', headerShown: false }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        initialParams={{ hideTabBar: true }}
        options={{ title: '设置', headerShown: false }}
      />
      <Stack.Screen
        name="OfflineData"
        component={OfflineDataScreen}
        initialParams={{ hideTabBar: true }}
        options={{ title: '离线数据', headerShown: false }}
      />
      <Stack.Screen
        name="SyncSettings"
        component={SyncSettingsScreen}
        initialParams={{ hideTabBar: true }}
        options={{ title: '数据同步', headerShown: false }}
      />
      {/* 备份与恢复功能已移除 */}
      <Stack.Screen
        name="NotificationSettings"
        component={NotificationSettingsScreen}
        initialParams={{ hideTabBar: true }}
        options={{ title: '通知设置', headerShown: false }}
      />
      <Stack.Screen
        name="About"
        component={AboutScreen}
        initialParams={{ hideTabBar: true }}
        options={{ title: '关于', headerShown: false }}
      />
      <Stack.Screen
        name="Help"
        component={HelpScreen}
        initialParams={{ hideTabBar: true }}
        options={{ title: '帮助与反馈', headerShown: false }}
      />
      {/* 功能中心相关屏幕 */}
      <Stack.Screen
        name="Reminder"
        component={ReminderNavigator}
        initialParams={{ hideTabBar: true }}
        options={{ title: '日程', headerShown: false }}
      />
      <Stack.Screen
        name="Groups"
        component={GroupsNavigator}
        initialParams={{ hideTabBar: true }}
        options={{ title: '群组', headerShown: false }}
      />
      <Stack.Screen
        name="MindMap"
        component={MindMapScreen}
        initialParams={{ hideTabBar: true }}
        options={{ title: '思维导图', headerShown: false }}
      />
      <Stack.Screen
        name="MindMapEdit"
        component={MindMapEditScreen}
        initialParams={{ hideTabBar: true }}
        options={{ title: '编辑思维导图', headerShown: false }}
      />
      <Stack.Screen
        name="MindMapTemplate"
        component={MindMapTemplateScreen}
        options={{ title: '思维导图模板' }}
      />
      <Stack.Screen
        name="KnowledgeGraph"
        component={KnowledgeGraphScreen}
        initialParams={{ hideTabBar: true }}
        options={{ title: '知识图谱', headerShown: false }}
      />
      <Stack.Screen
        name="NodeDetail"
        component={NodeDetailScreen}
        options={({ route }) => ({
          title: route.params?.title || '节点详情',
        })}
      />
      <Stack.Screen
        name="EdgeEdit"
        component={EdgeEditScreen}
        options={({ route }) => ({
          title: route.params?.edgeId ? '编辑关系' : '创建关系',
        })}
      />
      <Stack.Screen
        name="KnowledgeAnalysis"
        component={KnowledgeAnalysisScreen}
        options={{ title: '知识分析' }}
      />
      {/* 知识库相关 */}
      <Stack.Screen
        name="KnowledgeBase"
        component={KnowledgeBaseListScreen}
        initialParams={{ hideTabBar: true }}
        options={{ title: '知识库', headerShown: false }}
      />
      <Stack.Screen
        name="KnowledgeBaseDetail"
        component={KnowledgeBaseDetailScreen}
        initialParams={{ hideTabBar: true }}
        options={{ title: '知识库详情', headerShown: false }}
      />
      <Stack.Screen
        name="KnowledgeBaseEdit"
        component={KnowledgeBaseEditScreen}
        initialParams={{ hideTabBar: true }}
        options={{ title: '编辑知识库', headerShown: false }}
      />
      <Stack.Screen
        name="KnowledgeNodeEdit"
        component={KnowledgeNodeEditScreen}
        initialParams={{ hideTabBar: true }}
        options={{ title: '编辑知识节点', headerShown: false }}
      />

      <Stack.Screen
        name="PersonalActivity"
        component={PersonalActivityScreen}
        initialParams={{ hideTabBar: true }}
        options={{ title: '零屿空间', headerShown: false }}
      />
      <Stack.Screen
        name="ActivityForm"
        component={ActivityFormScreen}
        initialParams={{ hideTabBar: true }}
        options={{ title: '活动表单', headerShown: false }}
      />
    </Stack.Navigator>
  );
};

export default ProfileNavigator;
