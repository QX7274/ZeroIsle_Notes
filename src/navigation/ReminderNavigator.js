import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useTheme } from '../context/ThemeContext';

// 导入屏幕
import {
  AddReminderScreen,
  ReminderDetailScreen,
  ReminderExportScreen,
} from '../screens/reminder';

// 创建一个临时的提醒列表屏幕
import { ReminderListView } from '../components/reminder';
import { View, TouchableOpacity, Text, StyleSheet, Platform, StatusBar } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';

const ReminderScreen = ({ navigation, route }) => {
  const { theme } = useTheme();
  const cardBg = theme?.cardBackground || theme?.colors?.card || '#FFFFFF';
  const border = theme?.border || theme?.colors?.border || '#E0E0E0';
  const primary = theme?.primary || theme?.colors?.primary || '#2196F3';
  const text = theme?.text || theme?.colors?.text || '#000000';
  const sampleReminder = {
    id: 'debug-reminder-sample',
    title: '联调详情样例提醒',
    description: '用于真机验证提醒详情页的可读性、按钮层级和页内提示，不代表真实服务端数据。',
    due_date: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    priority: 'medium',
    category: 'personal',
    frequency: 'once',
    tags: '联调,详情页',
    is_enabled: true,
    is_completed: false,
    repeat_end_date: null,
  };

  return (
      <View
        style={{ flex: 1, backgroundColor: theme?.background || theme?.colors?.background || '#FFFFFF' }}
        testID="screen.reminderList"
      >
      {/* 顶部导航栏（统一返回按钮样式） */}
      <View style={[styles.headerBar, { borderBottomColor: border, backgroundColor: cardBg }]}>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: primary + '15' }]}
          onPress={() => navigation.goBack()}
          activeOpacity={0.7}
        >
          <Icon name="arrow-back" size={22} color={primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: text }]}>日程</Text>
        <View style={styles.headerRight} />
      </View>

      <ReminderListView navigation={navigation} route={route} />
      {__DEV__ ? (
        <TouchableOpacity
          style={[
            styles.devSampleButton,
            {
              backgroundColor: cardBg + 'F2',
              borderColor: primary + '2E',
            },
          ]}
          onPress={() => navigation.navigate('ReminderDetail', {
            id: sampleReminder.id,
            reminder: sampleReminder,
          })}
          testID="action.reminder.openDetailSample"
        >
          <Icon name="science" size={16} color={primary} />
          <Text style={[styles.devSampleText, { color: primary }]}>详情样例</Text>
        </TouchableOpacity>
      ) : null}
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
        headerShown: false,
        cardStyle: { backgroundColor: theme.background },
      }}
    >
      <Stack.Screen
        name="ReminderList"
        component={ReminderScreen}
        initialParams={{ hideTabBar: true }}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="ReminderAdd"
        component={AddReminderScreen}
        initialParams={{ hideTabBar: true }}
        options={{ title: '添加提醒' }}
      />
      <Stack.Screen
        name="ReminderDetail"
        component={ReminderDetailScreen}
        initialParams={{ hideTabBar: true }}
        options={({ route }) => ({
          title: route.params?.title || '提醒详情',
          headerBackTitleVisible: false,
        })}
      />
      <Stack.Screen
        name="ReminderExport"
        component={ReminderExportScreen}
        initialParams={{ hideTabBar: true }}
        options={{
          title: '导入/导出提醒',
          headerBackTitleVisible: false,
        }}
      />
    </Stack.Navigator>
  );
};

const styles = StyleSheet.create({
  headerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: 24,
    borderBottomWidth: 1,
  },
  backButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: -4,
  },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontWeight: '600',
    fontSize: 18,
  },
  headerRight: {
    width: 40,
  },
  devSampleButton: {
    position: 'absolute',
    right: 20,
    bottom: 96,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 18,
    borderWidth: 1,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
  },
  devSampleText: {
    marginLeft: 6,
    fontSize: 13,
    fontWeight: '600',
  },
});

export default ReminderNavigator;
