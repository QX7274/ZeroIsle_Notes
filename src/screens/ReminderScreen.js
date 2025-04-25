import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useDispatch, useSelector } from 'react-redux';
import { loadReminders, addReminder, updateReminder, deleteReminder } from '../store/slices/reminderSlice';
import { websocketService } from '../services/websocket';
import { notificationService } from '../services/notification';
import { offlineStorageService } from '../services/offlineStorage';
import { analyticsService } from '../services/analytics';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import Icon from 'react-native-vector-icons/Ionicons';

const ReminderScreen = () => {
  const { theme } = useTheme();
  const dispatch = useDispatch();
  const reminders = useSelector(state => state.reminder.reminders);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [newReminder, setNewReminder] = useState({
    title: '',
    dueDate: new Date(),
    isEnabled: true,
  });
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    init();
    return () => {
      websocketService.removeListener('notification', handleNotification);
      websocketService.disconnect();
    };
  }, []);

  const init = async () => {
    try {
      setLoading(true);
      await offlineStorageService.init();
      websocketService.connect();
      websocketService.addListener('notification', handleNotification);
      await loadLocalReminders();
    } catch (error) {
      console.error('初始化失败:', error);
      analyticsService.trackError(error, { operation: 'init' });
    } finally {
      setLoading(false);
    }
  };

  const loadLocalReminders = async () => {
    try {
      const localReminders = await offlineStorageService.getReminders();
      dispatch(loadReminders(localReminders));
    } catch (error) {
      console.error('加载本地提醒失败:', error);
      analyticsService.trackError(error, { operation: 'load_local_reminders' });
    }
  };

  const handleNotification = (data) => {
    const reminder = reminders.find(r => r.id === data.reminder_id);
    if (reminder) {
      notificationService.scheduleLocalNotification(
        '提醒',
        reminder.title,
        new Date(reminder.dueDate)
      );
    }
  };

  const handleAddReminder = async () => {
    try {
      setSyncing(true);
      const reminder = await dispatch(addReminder(newReminder)).unwrap();
      await offlineStorageService.saveReminder(reminder);
      notificationService.scheduleLocalNotification(
        '提醒',
        reminder.title,
        new Date(reminder.dueDate)
      );
      setNewReminder({
        title: '',
        dueDate: new Date(),
        isEnabled: true,
      });
      analyticsService.trackReminderAction('create', reminder.id);
    } catch (error) {
      Alert.alert('错误', '添加提醒失败');
      analyticsService.trackError(error, { operation: 'add_reminder' });
    } finally {
      setSyncing(false);
    }
  };

  const handleToggleReminder = async (reminder) => {
    try {
      setSyncing(true);
      const updatedReminder = await dispatch(updateReminder({
        ...reminder,
        isEnabled: !reminder.isEnabled,
      })).unwrap();
      await offlineStorageService.saveReminder(updatedReminder);
      
      if (!reminder.isEnabled) {
        notificationService.scheduleLocalNotification(
          '提醒',
          reminder.title,
          new Date(reminder.dueDate)
        );
      } else {
        notificationService.cancelAllNotifications();
        const notifications = await notificationService.getScheduledNotifications();
        notifications.forEach(notification => {
          notificationService.scheduleLocalNotification(
            notification.title,
            notification.message,
            new Date(notification.date)
          );
        });
      }
      analyticsService.trackReminderAction('toggle', reminder.id);
    } catch (error) {
      Alert.alert('错误', '更新提醒失败');
      analyticsService.trackError(error, { operation: 'toggle_reminder' });
    } finally {
      setSyncing(false);
    }
  };

  const handleDeleteReminder = async (reminder) => {
    try {
      setSyncing(true);
      await dispatch(deleteReminder(reminder.id)).unwrap();
      await offlineStorageService.deleteReminder(reminder.id);
      notificationService.cancelAllNotifications();
      const notifications = await notificationService.getScheduledNotifications();
      notifications.forEach(notification => {
        notificationService.scheduleLocalNotification(
          notification.title,
          notification.message,
          new Date(notification.date)
        );
      });
      analyticsService.trackReminderAction('delete', reminder.id);
    } catch (error) {
      Alert.alert('错误', '删除提醒失败');
      analyticsService.trackError(error, { operation: 'delete_reminder' });
    } finally {
      setSyncing(false);
    }
  };

  const renderReminder = ({ item }) => (
    <View style={[styles.reminderItem, { backgroundColor: theme.cardBackground }]}>
      <View style={styles.reminderInfo}>
        <Text style={[styles.reminderTitle, { color: theme.text }]}>{item.title}</Text>
        <Text style={[styles.reminderDate, { color: theme.textSecondary }]}>
          {format(new Date(item.dueDate), 'yyyy-MM-dd HH:mm', { locale: zhCN })}
        </Text>
      </View>
      <View style={styles.reminderActions}>
        <TouchableOpacity
          onPress={() => handleToggleReminder(item)}
          style={[styles.toggleButton, { backgroundColor: item.isEnabled ? theme.primary : theme.error }]}
        >
          <Text style={styles.toggleButtonText}>{item.isEnabled ? '启用' : '禁用'}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={() => handleDeleteReminder(item)}
          style={[styles.deleteButton, { backgroundColor: theme.error }]}
        >
          <Text style={styles.deleteButtonText}>删除</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
      </View>
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: theme.background }]}>
      {syncing && (
        <View style={styles.syncIndicator}>
          <ActivityIndicator size="small" color={theme.primary} />
          <Text style={[styles.syncText, { color: theme.text }]}>同步中...</Text>
        </View>
      )}
      <FlatList
        data={reminders}
        renderItem={renderReminder}
        keyExtractor={item => item.id.toString()}
        contentContainerStyle={styles.listContainer}
      />
      <View style={styles.addButtonContainer}>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: theme.primary }]}
          onPress={() => setShowDatePicker(true)}
        >
          <Icon name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>
      {showDatePicker && (
        <DateTimePicker
          value={selectedDate}
          mode="datetime"
          display="default"
          onChange={(event, date) => {
            setShowDatePicker(false);
            if (date) {
              setNewReminder({ ...newReminder, dueDate: date });
              Alert.prompt(
                '添加提醒',
                '请输入提醒标题',
                (title) => {
                  if (title) {
                    setNewReminder({ ...newReminder, title, dueDate: date });
                    handleAddReminder();
                  }
                }
              );
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
  syncIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: 'rgba(0,0,0,0.1)',
  },
  syncText: {
    marginLeft: 10,
    fontSize: 14,
  },
  listContainer: {
    padding: 16,
  },
  reminderItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    marginBottom: 8,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  reminderInfo: {
    flex: 1,
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
  toggleButton: {
    padding: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  toggleButtonText: {
    color: '#fff',
    fontSize: 12,
  },
  deleteButton: {
    padding: 8,
    borderRadius: 4,
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 12,
  },
  addButtonContainer: {
    position: 'absolute',
    bottom: 16,
    right: 16,
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