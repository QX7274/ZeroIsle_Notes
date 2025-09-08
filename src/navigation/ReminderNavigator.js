import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useTheme } from '../context/ThemeContext';

// 导入屏幕
import AddReminderScreen from '../screens/reminder/AddReminderScreen';
import ReminderDetailScreen from '../screens/reminder/ReminderDetailScreen';
import ReminderExportScreen from '../screens/reminder/ReminderExportScreen';

// 创建一个临时的提醒列表屏幕
import { ReminderListView } from '../components/reminder';
import { View } from 'react-native';

const ReminderScreen = ({ navigation, route }) => {
  return (
    <View style={{ flex: 1 }}>
      <ReminderListView navigation={navigation} route={route} />
    </View>
  );
};

const Stack = createStackNavigator();

/**
 * 提醒导航器
 * 包含提醒列表、添加提醒、提醒详情等功能
 */
const ReminderNavigator = () => {
  const { theme } = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerStyle: {
          backgroundColor: theme.cardBackground,
          elevation: 4,
          shadowColor: theme.shadow,
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.1,
          shadowRadius: 2,
        },
        headerTintColor: theme.text,
        headerTitleStyle: {
          fontWeight: '600',
        },
        cardStyle: { backgroundColor: theme.background },
      }}
    >
      <Stack.Screen
        name="ReminderList"
        component={ReminderScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="AddReminder"
        component={AddReminderScreen}
        options={{ title: '添加提醒' }}
      />
      <Stack.Screen
        name="ReminderDetail"
        component={ReminderDetailScreen}
        options={({ route }) => ({
          title: route.params?.title || '提醒详情',
          headerBackTitleVisible: false,
        })}
      />
      <Stack.Screen
        name="ReminderExport"
        component={ReminderExportScreen}
        options={{
          title: '导入/导出提醒',
          headerBackTitleVisible: false,
        }}
      />
    </Stack.Navigator>
  );
};

export default ReminderNavigator;
