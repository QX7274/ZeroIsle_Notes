import React, { useEffect, useState } from 'react';
import {
  View,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  Text,
  Switch,
  Platform,
  Alert
} from 'react-native';
import { useTheme } from '../../context/ThemeContext';
import { useDispatch, useSelector } from 'react-redux';
import { reminderApi } from '../../services/api';
import {
  addReminder,
  addLocalReminder,
  updateReminder,
  updateLocalReminder,
  deleteReminder,
  deleteLocalReminder,
  syncReminders
} from '../../redux/slices/reminderSlice';
import Icon from 'react-native-vector-icons/Ionicons';
import { dateUtils } from '../../utils';
import SafeDateTimePicker from '../../components/common/SafeDateTimePicker';
import NetInfo from '@react-native-community/netinfo';
import reminderNotificationService from '../../services/reminder/reminderNotificationService';

const ReminderScreen = ({ navigation }) => {
  // 使用 try-catch 包装 useTheme 调用，确保即使出错也能提供默认值
  let colors;
  try {
    const themeContext = useTheme();
    colors = themeContext.theme.colors;

    // 如果 colors 为 undefined，使用默认值
    if (!colors) {
      console.warn('ReminderScreen: 主题颜色未正确加载，使用默认颜色');
      colors = {
        background: '#F2F2F2',
        card: '#FFFFFF',
        text: '#000000',
        border: '#E5E5EA',
        notification: '#FF3B30',
        primary: '#007AFF'
      };
    }
  } catch (error) {
    console.error('ReminderScreen: 获取主题失败:', error.message);
    // 使用默认颜色
    colors = {
      background: '#F2F2F2',
      card: '#FFFFFF',
      text: '#000000',
      border: '#E5E5EA',
      notification: '#FF3B30',
      primary: '#007AFF'
    };
  }
  const dispatch = useDispatch();
  const reminders = useSelector(state => state.reminders.reminders);
  const offlineReminders = useSelector(state => state.reminders.offlineReminders);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [isConnected, setIsConnected] = useState(true);

  useEffect(() => {
    // 检查网络状态
    const unsubscribe = NetInfo.addEventListener(state => {
      setIsConnected(state.isConnected);
    });

    loadReminders();

    return () => {
      unsubscribe();
    };
  }, []);

  const loadReminders = async () => {
    try {
      // 检查网络连接
      const networkState = await NetInfo.fetch();
      setIsConnected(networkState.isConnected);

      if (networkState.isConnected) {
        // 有网络连接，从API获取数据
        const response = await reminderApi.getAllReminders();
        if (response.success) {
          dispatch(updateReminder(response.data));
        } else {
          console.error('加载提醒失败:', response.message);
          // 加载本地缓存的提醒
          loadLocalReminders();
        }
      } else {
        // 无网络连接，加载本地缓存的提醒
        loadLocalReminders();
      }
    } catch (error) {
      console.error('加载提醒失败:', error);
      // 加载本地缓存的提醒
      loadLocalReminders();
    }
  };

  const loadLocalReminders = async () => {
    try {
      // 从本地存储加载提醒
      const localReminders = await reminderNotificationService.getAllReminders();
      if (localReminders && localReminders.length > 0) {
        dispatch(updateReminder(localReminders));
      }
    } catch (error) {
      console.error('加载本地提醒失败:', error);
    }
  };

  const handleAddReminder = () => {
    setShowDatePicker(true);
  };

  const handleDateChange = async (event, date) => {
    try {
      // 无论如何，先关闭日期选择器
      setShowDatePicker(false);

      // 只有当用户选择了日期时才创建提醒
      if (date) {
        const reminderData = {
          title: '新提醒',
          due_date: date.toISOString(),
          is_enabled: true,
          priority: 'medium',
          category: 'other',
          description: '',
          is_completed: false,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        if (isConnected) {
          // 有网络连接，通过API创建提醒
          try {
            const response = await reminderApi.createReminder(reminderData);
            if (response.success) {
              // 更新Redux状态
              dispatch(addReminder(response.data));

              // 安排本地通知
              await reminderNotificationService.scheduleReminderNotification(response.data);

              // 保存到本地存储
              await reminderNotificationService.saveAllReminders([...reminders, response.data]);
            } else {
              console.error('创建提醒失败:', response.message);
              // 网络请求失败，创建本地提醒
              createLocalReminder(reminderData);
            }
          } catch (error) {
            console.error('创建提醒失败:', error);
            // 网络请求失败，创建本地提醒
            createLocalReminder(reminderData);
          }
        } else {
          // 无网络连接，创建本地提醒
          createLocalReminder(reminderData);
        }
      }
    } catch (error) {
      console.error('处理日期选择错误:', error);
      // 确保选择器关闭
      setShowDatePicker(false);
    }
  };

  // 创建本地提醒
  const createLocalReminder = async (reminderData) => {
    try {
      // 生成本地ID
      const localId = `local_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const localReminder = {
        ...reminderData,
        id: localId,
        isLocal: true // 标记为本地创建
      };

      // 更新Redux状态
      dispatch(addLocalReminder(localReminder));

      // 保存到本地存储
      await reminderNotificationService.saveOfflineReminder(localReminder);

      // 安排本地通知
      await reminderNotificationService.scheduleReminderNotification(localReminder);

      // 显示提示
      Alert.alert(
        '离线模式',
        '提醒已在本地创建，将在网络连接恢复后同步到云端',
        [{ text: '确定', style: 'default' }]
      );
    } catch (error) {
      console.error('创建本地提醒失败:', error);
      Alert.alert('错误', '创建提醒失败');
    }
  };

  const handleToggleReminder = async (reminder) => {
    try {
      const updatedReminderData = {
        ...reminder,
        is_enabled: !reminder.is_enabled,
        updated_at: new Date().toISOString()
      };

      if (isConnected && !reminder.isLocal) {
        // 有网络连接且不是本地创建的提醒，通过API更新
        try {
          const response = await reminderApi.updateReminder(reminder.id, updatedReminderData);
          if (response.success) {
            // 更新Redux状态
            dispatch(updateReminder(response.data));

            // 更新本地存储
            const allReminders = [...reminders];
            const index = allReminders.findIndex(r => r.id === reminder.id);
            if (index !== -1) {
              allReminders[index] = response.data;
              await reminderNotificationService.saveAllReminders(allReminders);
            }

            // 更新本地通知
            if (response.data.is_enabled) {
              await reminderNotificationService.scheduleReminderNotification(response.data);
            } else {
              await reminderNotificationService.cancelReminderNotification(response.data.id);
            }
          } else {
            console.error('更新提醒失败:', response.message);
            // 网络请求失败，本地更新
            updateLocalReminder(reminder, updatedReminderData);
          }
        } catch (error) {
          console.error('更新提醒失败:', error);
          // 网络请求失败，本地更新
          updateLocalReminder(reminder, updatedReminderData);
        }
      } else {
        // 无网络连接或是本地创建的提醒，本地更新
        updateLocalReminder(reminder, updatedReminderData);
      }
    } catch (error) {
      console.error('处理提醒切换错误:', error);
    }
  };

  // 本地更新提醒
  const updateLocalReminder = async (reminder, updatedData) => {
    try {
      // 更新Redux状态
      dispatch(updateLocalReminder({ id: reminder.id, reminderData: updatedData }));

      // 保存到本地存储
      await reminderNotificationService.saveOfflineOperation('update', updatedData);

      // 更新本地通知
      if (updatedData.is_enabled) {
        await reminderNotificationService.scheduleReminderNotification(updatedData);
      } else {
        await reminderNotificationService.cancelReminderNotification(updatedData.id);
      }
    } catch (error) {
      console.error('本地更新提醒失败:', error);
    }
  };

  const handleDeleteReminder = async (id) => {
    try {
      const reminder = reminders.find(r => r.id === id);
      if (!reminder) return;

      if (isConnected && !reminder.isLocal) {
        // 有网络连接且不是本地创建的提醒，通过API删除
        try {
          const response = await reminderApi.deleteReminder(id);
          if (response.success) {
            // 更新Redux状态
            dispatch(deleteReminder(id));

            // 更新本地存储
            const allReminders = reminders.filter(r => r.id !== id);
            await reminderNotificationService.saveAllReminders(allReminders);

            // 取消本地通知
            await reminderNotificationService.cancelReminderNotification(id);
          } else {
            console.error('删除提醒失败:', response.message);
            // 网络请求失败，本地删除
            deleteLocalReminder(id, reminder);
          }
        } catch (error) {
          console.error('删除提醒失败:', error);
          // 网络请求失败，本地删除
          deleteLocalReminder(id, reminder);
        }
      } else {
        // 无网络连接或是本地创建的提醒，本地删除
        deleteLocalReminder(id, reminder);
      }
    } catch (error) {
      console.error('处理提醒删除错误:', error);
    }
  };

  // 本地删除提醒
  const deleteLocalReminder = async (id, reminder) => {
    try {
      // 更新Redux状态
      dispatch(deleteLocalReminder(id));

      // 保存到本地存储
      await reminderNotificationService.saveOfflineOperation('delete', { id, ...reminder });

      // 取消本地通知
      await reminderNotificationService.cancelReminderNotification(id);
    } catch (error) {
      console.error('本地删除提醒失败:', error);
    }
  };

  const renderReminderItem = ({ item }) => {
    const priorityColor = getPriorityColor(item.priority || 'medium');
    const isLocalReminder = item.isLocal || false;

    return (
      <TouchableOpacity
        style={[
          styles.reminderItem,
          { backgroundColor: colors.card },
          isLocalReminder && styles.localReminderItem
        ]}
        onPress={() => navigation.navigate('ReminderDetail', { id: item.id })}
      >
        <View style={[styles.priorityIndicator, { backgroundColor: priorityColor }]} />
        <View style={styles.reminderContent}>
          <View style={styles.titleContainer}>
            <Text style={[styles.reminderTitle, { color: colors.text }]}>
              {item.title}
            </Text>
            {isLocalReminder && (
              <View style={styles.localBadge}>
                <Text style={styles.localBadgeText}>本地</Text>
              </View>
            )}
          </View>
          <Text style={[styles.reminderDate, { color: colors.textSecondary }]}>
            {dateUtils.format(new Date(item.due_date || item.dueDate || item.date))}
          </Text>
          <View style={styles.tagsContainer}>
            {item.category && (
              <View style={[styles.categoryTag, { backgroundColor: colors.primary + '20' }]}>
                <Text style={[styles.categoryText, { color: colors.primary }]}>
                  {getCategoryLabel(item.category)}
                </Text>
              </View>
            )}
            {isLocalReminder && !isConnected && (
              <View style={[styles.statusTag, { backgroundColor: colors.notification + '20' }]}>
                <Text style={[styles.statusTagText, { color: colors.notification }]}>
                  待同步
                </Text>
              </View>
            )}
          </View>
        </View>
        <View style={styles.reminderActions}>
          <Switch
            value={item.is_enabled || item.isEnabled}
            onValueChange={() => handleToggleReminder(item)}
            trackColor={{ false: colors.border, true: colors.primary }}
            thumbColor={Platform.OS === 'android' ? (item.is_enabled || item.isEnabled ? colors.primary : '#f4f3f4') : ''}
          />
          <TouchableOpacity
            onPress={() => handleDeleteReminder(item.id)}
            style={styles.deleteButton}
          >
            <Icon name="trash-outline" size={20} color={colors.notification} />
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

  // 获取优先级颜色
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'high':
        return '#FF3B30';
      case 'medium':
        return '#FF9500';
      case 'low':
        return '#34C759';
      default:
        return '#007AFF';
    }
  };

  // 获取分类标签
  const getCategoryLabel = (category) => {
    switch (category) {
      case 'work':
        return '工作';
      case 'study':
        return '学习';
      case 'personal':
        return '个人';
      case 'health':
        return '健康';
      case 'finance':
        return '财务';
      case 'social':
        return '社交';
      default:
        return '其他';
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { backgroundColor: colors.card, marginTop: 20 }]}>
        <Text style={[styles.headerTitle, { color: colors.text }]}>日程管理</Text>
        {/* 网络状态指示器 */}
        <View style={[styles.networkStatus, { backgroundColor: isConnected ? '#34C759' : '#FF3B30' }]}>
          <Text style={styles.networkStatusText}>
            {isConnected ? '在线' : '离线'}
          </Text>
        </View>
      </View>

      {/* 离线提醒数量提示 */}
      {offlineReminders.length > 0 && (
        <View style={[styles.offlineAlert, { backgroundColor: colors.notification + '20' }]}>
          <Icon name="cloud-offline" size={20} color={colors.notification} />
          <Text style={[styles.offlineAlertText, { color: colors.text }]}>
            有 {offlineReminders.length} 个提醒等待同步
          </Text>
          {isConnected && (
            <TouchableOpacity
              style={styles.syncButton}
              onPress={() => dispatch(syncReminders())}
            >
              <Text style={[styles.syncButtonText, { color: colors.primary }]}>同步</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {reminders.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Icon name="calendar" size={64} color={colors.textSecondary} />
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            暂无日程安排
          </Text>
          <Text style={[styles.emptySubText, { color: colors.textTertiary }]}>
            点击下方按钮添加新的日程提醒
          </Text>
          <Text style={[styles.emptySubText, { color: colors.textTertiary, marginTop: 8 }]}>
            {isConnected ? '当前为在线模式' : '当前为离线模式，提醒将保存在本地'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={reminders}
          renderItem={renderReminderItem}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.listContainer}
          showsVerticalScrollIndicator={false}
        />
      )}

      <TouchableOpacity
        style={[styles.addButton, { backgroundColor: colors.primary }]}
        onPress={handleAddReminder}
      >
        <Icon name="add" size={28} color="#FFFFFF" />
        <Text style={styles.addButtonText}>添加</Text>
      </TouchableOpacity>

      <SafeDateTimePicker
        value={selectedDate}
        mode="datetime"
        is24Hour={true}
        display={Platform.OS === 'ios' ? 'spinner' : 'default'}
        onChange={handleDateChange}
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        onError={(error) => console.log('DateTimePicker error:', error)}
        testID="dateTimePicker"
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  networkStatus: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  networkStatusText: {
    color: '#FFFFFF',
    fontSize: 12,
    fontWeight: 'bold',
  },
  offlineAlert: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    marginHorizontal: 16,
    marginTop: 10,
    borderRadius: 8,
  },
  offlineAlertText: {
    marginLeft: 8,
    flex: 1,
    fontSize: 14,
  },
  syncButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 4,
  },
  syncButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
  },
  headerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  headerButtonText: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 4,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 80, // 为底部按钮留出空间
  },
  reminderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    overflow: 'hidden',
  },
  priorityIndicator: {
    position: 'absolute',
    left: 0,
    top: 0,
    bottom: 0,
    width: 4,
  },
  reminderContent: {
    flex: 1,
    paddingLeft: 8,
  },
  titleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  reminderTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    flex: 1,
  },
  localBadge: {
    backgroundColor: '#FF9500',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    marginLeft: 8,
  },
  localBadgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: 'bold',
  },
  reminderDate: {
    fontSize: 14,
    marginBottom: 6,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: 4,
  },
  categoryTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
    marginRight: 6,
  },
  categoryText: {
    fontSize: 12,
    fontWeight: '500',
  },
  statusTag: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  statusTagText: {
    fontSize: 12,
    fontWeight: '500',
  },
  localReminderItem: {
    borderLeftWidth: 3,
    borderLeftColor: '#FF9500',
  },
  reminderActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  deleteButton: {
    marginLeft: 12,
    padding: 6,
  },
  addButton: {
    position: 'absolute',
    right: 16,
    bottom: 24,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 24,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    elevation: 6,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  addButtonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 18,
    marginLeft: 10,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 32,
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
    maxWidth: 250,
  }
});

export default ReminderScreen;