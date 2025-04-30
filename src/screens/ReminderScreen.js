import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
  SectionList,
  RefreshControl,
  Platform,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useDispatch, useSelector } from 'react-redux';
import { loadReminders, addReminder, updateReminder, deleteReminder } from '../store/slices/reminderSlice';
import reminderNotificationService from '../services/reminderNotificationService';
import networkService from '../services/networkService';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format, isToday, isPast, isFuture, addDays } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import Icon from 'react-native-vector-icons/MaterialIcons';

const ReminderScreen = () => {
  const { theme, colors } = useTheme();
  const dispatch = useDispatch();
  const reminders = useSelector(state => state.reminders.reminders);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [newReminder, setNewReminder] = useState({
    title: '',
    dueDate: new Date(),
    isEnabled: true,
  });
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [reminderSections, setReminderSections] = useState([]);
  const [isConnected, setIsConnected] = useState(true);

  // 初始化
  useEffect(() => {
    init();

    // 监听网络状态变化
    const unsubscribe = networkService.addNetworkListener(status => {
      setIsConnected(status.isConnected);

      // 如果网络恢复连接，尝试同步离线提醒
      if (status.isConnected) {
        syncOfflineReminders();
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  // 当提醒列表变化时，更新分组
  useEffect(() => {
    organizeReminders();
  }, [reminders]);

  // 初始化函数
  const init = async () => {
    try {
      setLoading(true);

      // 请求通知权限
      await reminderNotificationService.requestPermissions();

      // 检查网络连接
      const connected = await networkService.isNetworkConnected();
      setIsConnected(connected);

      // 加载提醒
      await loadRemindersData();

      // 如果有网络连接，同步离线提醒
      if (connected) {
        await syncOfflineReminders();
      }
    } catch (error) {
      console.error('初始化失败:', error);
    } finally {
      setLoading(false);
    }
  };

  // 加载提醒数据
  const loadRemindersData = async () => {
    try {
      // 获取本地存储的提醒
      const offlineReminders = await reminderNotificationService.getOfflineReminders();

      // 如果有网络连接，从服务器获取提醒
      if (isConnected) {
        // TODO: 从服务器获取提醒
        // const response = await reminderApi.getAllReminders();
        // if (response.success) {
        //   dispatch(loadReminders(response.data));
        // }
      } else {
        // 使用离线提醒
        dispatch(loadReminders(offlineReminders));
      }
    } catch (error) {
      console.error('加载提醒数据失败:', error);

      // 出错时使用离线提醒
      const offlineReminders = await reminderNotificationService.getOfflineReminders();
      dispatch(loadReminders(offlineReminders));
    }
  };

  // 同步离线提醒
  const syncOfflineReminders = async () => {
    if (!isConnected) return;

    try {
      setSyncing(true);
      await reminderNotificationService.syncOfflineReminders();
    } catch (error) {
      console.error('同步离线提醒失败:', error);
    } finally {
      setSyncing(false);
    }
  };

  // 将提醒按类别组织
  const organizeReminders = () => {
    if (!reminders || reminders.length === 0) {
      setReminderSections([]);
      return;
    }

    const now = new Date();
    const tomorrow = addDays(now, 1);

    // 过期提醒
    const overdue = reminders.filter(reminder => {
      const dueDate = new Date(reminder.dueDate || reminder.due_date);
      return isPast(dueDate) && !isToday(dueDate);
    });

    // 今日提醒
    const today = reminders.filter(reminder => {
      const dueDate = new Date(reminder.dueDate || reminder.due_date);
      return isToday(dueDate);
    });

    // 明日提醒
    const nextDay = reminders.filter(reminder => {
      const dueDate = new Date(reminder.dueDate || reminder.due_date);
      return isToday(addDays(dueDate, -1));
    });

    // 未来提醒
    const future = reminders.filter(reminder => {
      const dueDate = new Date(reminder.dueDate || reminder.due_date);
      return isFuture(dueDate) && !isToday(addDays(dueDate, -1));
    });

    const sections = [];

    if (overdue.length > 0) {
      sections.push({
        title: '已过期',
        data: overdue,
        key: 'overdue'
      });
    }

    if (today.length > 0) {
      sections.push({
        title: '今日',
        data: today,
        key: 'today'
      });
    }

    if (nextDay.length > 0) {
      sections.push({
        title: '明日',
        data: nextDay,
        key: 'tomorrow'
      });
    }

    if (future.length > 0) {
      sections.push({
        title: '未来',
        data: future,
        key: 'future'
      });
    }

    setReminderSections(sections);
  };

  // 添加提醒
  const handleAddReminder = async () => {
    try {
      setSyncing(true);

      // 创建新提醒对象
      const reminderData = {
        ...newReminder,
        id: `reminder_${Date.now()}`,
        createdAt: new Date().toISOString(),
      };

      // 调度添加提醒操作
      dispatch(addReminder(reminderData));

      // 安排本地通知
      await reminderNotificationService.scheduleReminderNotification(reminderData);

      // 如果有网络连接，同步到服务器
      if (isConnected) {
        // TODO: 同步到服务器
        // await reminderApi.createReminder(reminderData);
      } else {
        // 保存到离线存储
        await reminderNotificationService.saveOfflineReminder(reminderData);
      }

      // 重置表单
      setNewReminder({
        title: '',
        dueDate: new Date(),
        isEnabled: true,
      });

      // 显示成功消息
      Alert.alert('成功', '提醒已添加');
    } catch (error) {
      console.error('添加提醒失败:', error);
      Alert.alert('错误', '添加提醒失败');
    } finally {
      setSyncing(false);
    }
  };

  // 切换提醒启用状态
  const handleToggleReminder = async (reminder) => {
    try {
      setSyncing(true);

      // 更新提醒对象
      const updatedReminder = {
        ...reminder,
        isEnabled: !reminder.isEnabled,
        updatedAt: new Date().toISOString(),
      };

      // 调度更新提醒操作
      dispatch(updateReminder(updatedReminder));

      // 更新本地通知
      if (updatedReminder.isEnabled) {
        await reminderNotificationService.scheduleReminderNotification(updatedReminder);
      } else {
        // 查找并取消对应的通知
        const notifications = await reminderNotificationService.getAllScheduledNotifications();
        const notification = notifications.find(n =>
          n.content && n.content.data && n.content.data.reminderId === reminder.id
        );

        if (notification) {
          await reminderNotificationService.cancelReminderNotification(notification.identifier);
        }
      }

      // 如果有网络连接，同步到服务器
      if (isConnected) {
        // TODO: 同步到服务器
        // await reminderApi.updateReminder(updatedReminder);
      } else {
        // 保存到离线存储
        await reminderNotificationService.saveOfflineReminder(updatedReminder);
      }
    } catch (error) {
      console.error('更新提醒失败:', error);
      Alert.alert('错误', '更新提醒失败');
    } finally {
      setSyncing(false);
    }
  };

  // 删除提醒
  const handleDeleteReminder = async (reminder) => {
    try {
      // 确认删除
      Alert.alert(
        '确认删除',
        `确定要删除提醒"${reminder.title}"吗？`,
        [
          { text: '取消', style: 'cancel' },
          {
            text: '删除',
            style: 'destructive',
            onPress: async () => {
              try {
                setSyncing(true);

                // 调度删除提醒操作
                dispatch(deleteReminder(reminder.id));

                // 取消对应的通知
                const notifications = await reminderNotificationService.getAllScheduledNotifications();
                const notification = notifications.find(n =>
                  n.content && n.content.data && n.content.data.reminderId === reminder.id
                );

                if (notification) {
                  await reminderNotificationService.cancelReminderNotification(notification.identifier);
                }

                // 如果有网络连接，同步到服务器
                if (isConnected) {
                  // TODO: 同步到服务器
                  // await reminderApi.deleteReminder(reminder.id);
                }

                // 显示成功消息
                Alert.alert('成功', '提醒已删除');
              } catch (error) {
                console.error('删除提醒失败:', error);
                Alert.alert('错误', '删除提醒失败');
              } finally {
                setSyncing(false);
              }
            }
          }
        ]
      );
    } catch (error) {
      console.error('删除提醒操作失败:', error);
    }
  };

  // 刷新提醒列表
  const handleRefresh = useCallback(async () => {
    try {
      setRefreshing(true);
      await loadRemindersData();

      if (isConnected) {
        await syncOfflineReminders();
      }
    } catch (error) {
      console.error('刷新提醒列表失败:', error);
    } finally {
      setRefreshing(false);
    }
  }, [isConnected]);

  // 渲染提醒项
  const renderReminderItem = ({ item }) => {
    const dueDate = new Date(item.dueDate || item.due_date);
    const isPastDue = isPast(dueDate) && !isToday(dueDate);

    return (
      <View style={[
        styles.reminderItem,
        {
          backgroundColor: theme.cardBackground,
          borderLeftWidth: 4,
          borderLeftColor: isPastDue
            ? theme.error
            : isToday(dueDate)
              ? theme.warning
              : theme.primary
        }
      ]}>
        <View style={styles.reminderInfo}>
          <Text style={[
            styles.reminderTitle,
            {
              color: theme.text,
              textDecorationLine: !item.isEnabled ? 'line-through' : 'none'
            }
          ]}>
            {item.title}
          </Text>
          <Text style={[styles.reminderDate, { color: theme.textSecondary }]}>
            {format(dueDate, 'yyyy-MM-dd HH:mm', { locale: zhCN })}
          </Text>
        </View>
        <View style={styles.reminderActions}>
          <TouchableOpacity
            onPress={() => handleToggleReminder(item)}
            style={styles.iconButton}
          >
            <Icon
              name={item.isEnabled ? "notifications-active" : "notifications-off"}
              size={24}
              color={item.isEnabled ? theme.primary : theme.textSecondary}
            />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => handleDeleteReminder(item)}
            style={styles.iconButton}
          >
            <Icon name="delete" size={24} color={theme.error} />
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  // 渲染分组标题
  const renderSectionHeader = ({ section }) => (
    <View style={[styles.sectionHeader, { backgroundColor: theme.background }]}>
      <Text style={[styles.sectionTitle, { color: theme.text }]}>
        {section.title}
      </Text>
      <Text style={[styles.sectionCount, { color: theme.textSecondary }]}>
        {section.data.length}项
      </Text>
    </View>
  );

  // 渲染加载中状态
  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  // 渲染空状态
  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <Icon name="event-note" size={64} color={theme.textSecondary} />
      <Text style={[styles.emptyText, { color: theme.textSecondary }]}>
        暂无提醒
      </Text>
      <Text style={[styles.emptySubText, { color: theme.textSecondary }]}>
        点击右下角的加号按钮添加新提醒
      </Text>
    </View>
  );

  // 主渲染
  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {/* 网络状态提示 */}
      {!isConnected && (
        <View style={[styles.offlineBar, { backgroundColor: theme.warning }]}>
          <Icon name="cloud-off" size={16} color="#fff" />
          <Text style={styles.offlineText}>离线模式</Text>
        </View>
      )}

      {/* 同步状态提示 */}
      {syncing && (
        <View style={[styles.syncIndicator, { backgroundColor: theme.primary + '20' }]}>
          <ActivityIndicator size="small" color={theme.primary} />
          <Text style={[styles.syncText, { color: theme.text }]}>同步中...</Text>
        </View>
      )}

      {/* 提醒列表 */}
      <SectionList
        sections={reminderSections}
        renderItem={renderReminderItem}
        renderSectionHeader={renderSectionHeader}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.listContainer}
        ListEmptyComponent={renderEmptyList}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[theme.primary]}
            tintColor={theme.primary}
          />
        }
      />

      {/* 添加按钮 */}
      <View style={styles.addButtonContainer}>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: theme.primary }]}
          onPress={() => setShowDatePicker(true)}
        >
          <Icon name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* 日期选择器 */}
      {showDatePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="datetime"
          display="default"
          onChange={(_, date) => {
            setShowDatePicker(false);
            if (date) {
              setNewReminder({ ...newReminder, dueDate: date });

              // 在Android上使用Alert.prompt的替代方案
              if (Platform.OS === 'android') {
                Alert.alert(
                  '添加提醒',
                  '请输入提醒标题',
                  [
                    { text: '取消', style: 'cancel' },
                    {
                      text: '确定',
                      onPress: (title) => {
                        if (title) {
                          setNewReminder({ ...newReminder, title, dueDate: date });
                          handleAddReminder();
                        }
                      }
                    }
                  ],
                  { defaultValue: '' }
                );
              } else {
                // iOS使用Alert.prompt
                Alert.prompt(
                  '添加提醒',
                  '请输入提醒标题',
                  [
                    { text: '取消', style: 'cancel' },
                    {
                      text: '确定',
                      onPress: (title) => {
                        if (title) {
                          setNewReminder({ ...newReminder, title, dueDate: date });
                          handleAddReminder();
                        }
                      }
                    }
                  ],
                  'plain-text',
                  ''
                );
              }
            }
          }}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  // 离线状态栏
  offlineBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    width: '100%',
  },
  offlineText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  // 同步指示器
  syncIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 8,
    width: '100%',
  },
  syncText: {
    marginLeft: 10,
    fontSize: 14,
  },
  // 列表容器
  listContainer: {
    padding: 16,
    flexGrow: 1,
  },
  // 分组标题
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    marginTop: 8,
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
  },
  sectionCount: {
    fontSize: 14,
  },
  // 提醒项
  reminderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    marginBottom: 12,
    marginHorizontal: 4,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  reminderInfo: {
    flex: 1,
    marginRight: 8,
  },
  reminderTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  reminderDate: {
    fontSize: 14,
  },
  reminderActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconButton: {
    padding: 8,
    borderRadius: 20,
  },
  // 空状态
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
    marginTop: 64,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubText: {
    fontSize: 14,
    textAlign: 'center',
  },
  // 添加按钮
  addButtonContainer: {
    position: 'absolute',
    bottom: 16,
    right: 16,
    zIndex: 100,
  },
  addButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
  },
});

export default ReminderScreen;