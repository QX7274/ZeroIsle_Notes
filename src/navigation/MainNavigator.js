/**
 * 主功能导航配置
 */

import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { useSelector } from 'react-redux';
import { selectTheme } from '../redux/slices/uiSlice';
import { colors } from '../utils/constants/colors';

// 导入知识图谱组件
import { KnowledgeGraphScreen, NodeDetailScreen, KnowledgeAnalysisScreen } from '../screens/knowledge';
import { NoteListScreen, VoiceToTextScreen, NoteDetailScreen } from '../screens/notes';
import NoteEditorScreen from '../screens/note/NoteEditorScreen';
import { InfiniteCanvasListScreen } from '../screens/canvas';
import FluidInfiniteCanvasScreenNative from '../screens/canvas/FluidInfiniteCanvasScreenNative';
import { MindMapScreen, MindMapEditScreen, MindMapTemplateScreen } from '../screens/mind_map';
import { SearchScreen } from '../screens/search';
import { ProfileSettings, SettingsScreen, BindPhone, BindEmail, ThemeSettingsScreen, SyncSettingsScreen } from '../screens/settings';
import { FileViewerScreen } from '../screens/common';
import AIAssistantScreen from '../screens/ai/AIAssistantScreen';
import CommunityScreen from '../screens/community/CommunityScreen';
import CategoryScreen from '../screens/category/CategoryScreen';
import TemplateManagerScreen from '../screens/templates/TemplateManagerScreen';
import TemplateEditorScreen from '../screens/templates/TemplateEditorScreen';

// 临时占位组件
import { View, Text } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

// 临时占位屏幕组件
const PlaceholderScreen = ({ route }) => (
  <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
    <Text style={{ fontSize: 18 }}>{route.name} 屏幕正在开发中...</Text>
  </View>
);

// 笔记导航堆栈
const NotesNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: true }}>
    <Stack.Screen name="NotesList" component={NoteListScreen} options={{ title: '我的笔记' }} />
    <Stack.Screen name="Category" component={CategoryScreen} options={{ title: '分类' }} />
    <Stack.Screen name="NoteEditor" component={NoteEditorScreen} options={{ title: '编辑笔记' }} />
    <Stack.Screen name="NoteDetail" component={NoteDetailScreen} options={({ route }) => ({
      title: route.params?.title || '笔记详情',
      headerBackTitleVisible: false,
    })} />
    <Stack.Screen name="KnowledgeAnalysis" component={KnowledgeAnalysisScreen} options={{ title: '知识图谱分析' }} />
    <Stack.Screen name="VoiceToText" component={VoiceToTextScreen} options={{ title: '语音转文本', headerShown: false }} />
    <Stack.Screen name="Search" component={SearchScreen} options={{ title: '搜索', headerShown: false }} />
    <Stack.Screen name="InfiniteCanvasList" component={InfiniteCanvasListScreen} options={{ title: '我的草稿' }} />
    <Stack.Screen name="InfiniteCanvas" component={FluidInfiniteCanvasScreenNative} options={{ title: '无限草稿' }} />
    <Stack.Screen name="FileViewer" component={FileViewerScreen} options={{ title: '文件查看器', headerShown: false }} />
  </Stack.Navigator>
);

// 思维导图导航堆栈
const MindMapNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: true }}>
    <Stack.Screen name="MindMapList" component={MindMapScreen} options={{ title: '思维导图', headerShown: false }} />
    <Stack.Screen name="MindMapEdit" component={MindMapEditScreen} options={{ title: '编辑思维导图', headerShown: false }} />
    <Stack.Screen name="MindMapTemplate" component={MindMapTemplateScreen} options={{ title: '思维导图模板', headerShown: false }} />
    <Stack.Screen name="FileViewer" component={FileViewerScreen} options={{ title: '文件查看器', headerShown: false }} />
  </Stack.Navigator>
);

// 知识图谱导航堆栈
const KnowledgeGraphNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: true }}>
    <Stack.Screen name="KnowledgeGraph" component={KnowledgeGraphScreen} options={{ title: '知识图谱', headerShown: false }} />
    <Stack.Screen name="NodeDetail" component={NodeDetailScreen} options={{ title: '节点详情', headerShown: false }} />
    <Stack.Screen name="KnowledgeAnalysis" component={KnowledgeAnalysisScreen} options={{ title: '知识图谱分析', headerShown: false }} />
    <Stack.Screen name="VoiceToText" component={VoiceToTextScreen} options={{ title: '语音转文本', headerShown: false }} />
    <Stack.Screen name="Search" component={SearchScreen} options={{ title: '搜索', headerShown: false }} />
    <Stack.Screen name="MindMap" component={MindMapScreen} options={{ title: '思维导图', headerShown: false }} />
    <Stack.Screen name="MindMapEdit" component={MindMapEditScreen} options={{ title: '编辑思维导图', headerShown: false }} />
    <Stack.Screen name="MindMapTemplate" component={MindMapTemplateScreen} options={{ title: '思维导图模板', headerShown: false }} />
    <Stack.Screen name="FileViewer" component={FileViewerScreen} options={{ title: '文件查看器', headerShown: false }} />
  </Stack.Navigator>
);

// AI助手导航堆栈
const AINavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="AIAssistantMain" component={AIAssistantScreen} options={{ title: 'AI助手' }} />
  </Stack.Navigator>
);

// 社区导航堆栈
const CommunityNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: true }}>
    <Stack.Screen name="CommunityMain" component={CommunityScreen} options={{ title: '社区', headerShown: false }} />
  </Stack.Navigator>
);

// 个人中心导航堆栈
const ProfileNavigator = () => (
  <Stack.Navigator screenOptions={{ headerShown: false }}>
    <Stack.Screen name="ProfileMain" component={ProfileSettings} options={{ title: '个人中心' }} />
    <Stack.Screen name="BindPhone" component={BindPhone} options={{ title: '手机绑定' }} />
    <Stack.Screen name="BindEmail" component={BindEmail} options={{ title: '邮箱绑定' }} />
    <Stack.Screen name="ThemeSettings" component={ThemeSettingsScreen} options={{ title: '主题设置' }} />
    <Stack.Screen name="Settings" component={SettingsScreen} options={{ title: '设置' }} />
    <Stack.Screen name="SyncSettings" component={SyncSettingsScreen} options={{ title: '同步设置' }} />
    <Stack.Screen name="MindMap" component={MindMapScreen} options={{ title: '思维导图' }} />
    <Stack.Screen name="MindMapEdit" component={MindMapEditScreen} options={{ title: '编辑思维导图', headerShown: false }} />
    <Stack.Screen name="MindMapTemplate" component={MindMapTemplateScreen} options={{ title: '思维导图模板', headerShown: false }} />
    <Stack.Screen name="KnowledgeGraph" component={KnowledgeGraphScreen} options={{ title: '知识图谱', headerShown: false }} />
    <Stack.Screen name="NodeDetail" component={NodeDetailScreen} options={{ title: '节点详情' }} />
    <Stack.Screen name="FileViewer" component={FileViewerScreen} options={{ title: '文件查看器', headerShown: false }} />
    <Stack.Screen name="TemplateManager" component={TemplateManagerScreen} options={{ title: '模板管理' }} />
    <Stack.Screen name="TemplateEditor" component={TemplateEditorScreen} options={{ title: '模板编辑器' }} />
  </Stack.Navigator>
);

/**
 * 主功能导航器
 * 使用底部标签导航，包含笔记、思维导图、知识图谱和设置等主要功能模块
 */
const MainNavigator = () => {
  const theme = useSelector(selectTheme);
  const isDarkMode = theme === 'dark';

  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textLight,
        tabBarStyle: {
          backgroundColor: isDarkMode ? colors.darkBackground : colors.white,
          borderTopColor: isDarkMode ? colors.darkBorder : colors.border,
        },
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="Notes"
        component={NotesNavigator}
        options={{
          title: '首页',
          tabBarIcon: ({ color, size }) => (
            <Text style={{ color, fontSize: size }}>🏠</Text>
          ),
        }}
      />
      <Tab.Screen
        name="AI"
        component={AINavigator}
        options={{
          title: 'AI',
          tabBarIcon: ({ color, size }) => (
            <Icon name="smart-toy" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Community"
        component={CommunityNavigator}
        options={{
          title: '社区',
          tabBarIcon: ({ color, size }) => (
            <Icon name="people" size={size} color={color} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileNavigator}
        options={{
          title: '我的',
          tabBarIcon: ({ color, size }) => (
            <Text style={{ color, fontSize: size }}>👤</Text>
          ),
        }}
      />
    </Tab.Navigator>
  );
};

export default MainNavigator;
