/**
 * 群组相关导航配置
 */
import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import GroupsScreen from '../screens/groups/GroupsScreen';
import GroupDetailScreen from '../screens/groups/GroupDetailScreen';
import CreateGroupScreen from '../screens/groups/CreateGroupScreen';
import JoinGroupScreen from '../screens/groups/JoinGroupScreen';
import ScreenShareScreen from '../screens/groups/ScreenShareScreen';

const Stack = createStackNavigator();

/**
 * 群组相关导航堆栈
 * 包含群组列表、群组详情、创建群组、加入群组、屏幕共享等功能
 */
const GroupsNavigator = () => {
  return (
    <Stack.Navigator
      initialRouteName="GroupsList"
      screenOptions={{
        headerShown: true,
        cardStyle: { backgroundColor: 'white' },
      }}
    >
      <Stack.Screen
        name="GroupsList"
        component={GroupsScreen}
        options={{ title: '群组' }}
      />
      <Stack.Screen
        name="GroupDetail"
        component={GroupDetailScreen}
        options={{ title: '群组详情' }}
      />
      <Stack.Screen
        name="CreateGroup"
        component={CreateGroupScreen}
        options={{ title: '创建群组' }}
      />
      <Stack.Screen
        name="JoinGroup"
        component={JoinGroupScreen}
        options={{ title: '加入群组' }}
      />
      <Stack.Screen
        name="ScreenShare"
        component={ScreenShareScreen}
        options={{ title: '屏幕共享' }}
      />
    </Stack.Navigator>
  );
};

export default GroupsNavigator;
