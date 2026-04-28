/**
 * 知识库导航器
 * @description 管理所有与知识库功能相关的屏幕导航。
 */
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import {
  KnowledgeBaseListScreen,
  KnowledgeBaseDetailScreen,
  KnowledgeBaseEditScreen,
  KnowledgeNodeEditScreen, // 导入新创建的屏幕
  KnowledgeBaseSearchScreen,
} from '../screens/knowledge';

const KnowledgeStack = createStackNavigator();

const KnowledgeNavigator = () => {
  return (
    <KnowledgeStack.Navigator
      initialRouteName="KnowledgeBaseList"
      screenOptions={{
        headerShown: true,
        headerTitleAlign: 'center',
        // 在这里可以定义统一的头部样式
      }}
    >
      <KnowledgeStack.Screen
        name="KnowledgeBaseList"
        component={KnowledgeBaseListScreen}
        options={{ title: '知识库' }}
      />
      <KnowledgeStack.Screen
        name="KnowledgeBaseDetail"
        component={KnowledgeBaseDetailScreen}
        initialParams={{ hideTabBar: true }}
      // 标题将在详情页内动态设置
      />
      <KnowledgeStack.Screen
        name="KnowledgeBaseEdit"
        component={KnowledgeBaseEditScreen}
        initialParams={{ hideTabBar: true }}
        options={{ title: '创建知识库' }}
      />
      <KnowledgeStack.Screen
        name="KnowledgeNodeEdit"
        component={KnowledgeNodeEditScreen}
        initialParams={{ hideTabBar: true }}
      // 标题在屏幕内动态设置
      />
      <KnowledgeStack.Screen
        name="KnowledgeBaseSearch"
        component={KnowledgeBaseSearchScreen}
        options={{ headerShown: false }} // 搜索页通常自定义头部
      />
    </KnowledgeStack.Navigator>
  );
};

export default KnowledgeNavigator;

