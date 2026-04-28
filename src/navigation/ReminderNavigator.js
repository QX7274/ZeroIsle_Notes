import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { useTheme } from '../context/ThemeContext';

// 导入屏幕
import AddReminderScreen from '../screens/reminder/AddReminderScreen';
import ReminderDetailScreen from '../screens/reminder/ReminderDetailScreen';
import ReminderExportScreen from '../screens/reminder/ReminderExportScreen';

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

  return (
    <View style={{ flex: 1, backgroundColor: theme?.background || theme?.colors?.background || '#FFFFFF' }}>
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
        name="AddReminder"
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
});

export default ReminderNavigator;
