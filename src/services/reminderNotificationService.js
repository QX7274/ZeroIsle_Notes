/**
 * 提醒通知服务
 * 处理提醒的本地通知和离线存储
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import reminderApi from './api/reminderApi';
import analyticsService from './analytics/analyticsService';
import { isNetworkConnected } from './networkService';

// 本地存储键
const STORAGE_KEYS = {
  PENDING_REMINDERS: 'pending_reminders',
  OFFLINE_REMINDERS: 'offline_reminders',
};

// 通知渠道ID
const REMINDER_CHANNEL_ID = 'reminder-notifications';

/**
 * 提醒通知服务
 */
class ReminderNotificationService {
  constructor() {
    this.initialized = false;
    this.init();
  }

  /**
   * 初始化通知服务
   */
  async init() {
    if (this.initialized) return;

    try {
      // 配置通知处理
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: true,
          shouldSetBadge: true,
        }),
      });

      // 创建通知渠道（仅Android）
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync(REMINDER_CHANNEL_ID, {
          name: '提醒通知',
          importance: Notifications.AndroidImportance.HIGH,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#FF231F7C',
        });
      }

      this.initialized = true;
      console.log('提醒通知服务初始化成功');
    } catch (error) {
      console.error('初始化提醒通知服务失败:', error);
      analyticsService.trackError(error, { action: 'init_reminder_notification_service' });
    }
  }

  /**
   * 请求通知权限
   * @returns {Promise<boolean>} 是否获得权限
   */
  async requestPermissions() {
    try {
      const { status } = await Notifications.requestPermissionsAsync();
      const isGranted = status === 'granted';
      
      analyticsService.trackEvent('request_notification_permissions', {
        status,
        isGranted,
      });
      
      return isGranted;
    } catch (error) {
      console.error('请求通知权限失败:', error);
      analyticsService.trackError(error, { action: 'request_notification_permissions' });
      return false;
    }
  }

  /**
   * 检查通知权限
   * @returns {Promise<boolean>} 是否有权限
   */
  async checkPermissions() {
    try {
      const { status } = await Notifications.getPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('检查通知权限失败:', error);
      analyticsService.trackError(error, { action: 'check_notification_permissions' });
      return false;
    }
  }

  /**
   * 安排提醒通知
   * @param {Object} reminder 提醒对象
   * @returns {Promise<string>} 通知ID
   */
  async scheduleReminderNotification(reminder) {
    try {
      await this.init();
      
      const hasPermission = await this.checkPermissions();
      if (!hasPermission) {
        const granted = await this.requestPermissions();
        if (!granted) {
          throw new Error('没有通知权限');
        }
      }
      
      // 计算通知时间
      const notificationTime = new Date(reminder.dueDate || reminder.due_date);
      
      // 如果时间已过，不发送通知
      if (notificationTime < new Date()) {
        console.log('提醒时间已过，不发送通知:', reminder.title);
        return null;
      }
      
      // 安排通知
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: {
          title: reminder.title,
          body: reminder.description || '您有一个待办事项需要处理',
          data: { reminderId: reminder.id, type: 'reminder' },
          sound: true,
        },
        trigger: {
          date: notificationTime,
        },
      });
      
      analyticsService.trackEvent('schedule_reminder_notification', {
        reminderId: reminder.id,
        title: reminder.title,
        notificationTime: notificationTime.toISOString(),
      });
      
      return notificationId;
    } catch (error) {
      console.error('安排提醒通知失败:', error);
      analyticsService.trackError(error, { action: 'schedule_reminder_notification' });
      return null;
    }
  }

  /**
   * 取消提醒通知
   * @param {string} notificationId 通知ID
   * @returns {Promise<boolean>} 是否成功
   */
  async cancelReminderNotification(notificationId) {
    try {
      await Notifications.cancelScheduledNotificationAsync(notificationId);
      
      analyticsService.trackEvent('cancel_reminder_notification', {
        notificationId,
      });
      
      return true;
    } catch (error) {
      console.error('取消提醒通知失败:', error);
      analyticsService.trackError(error, { action: 'cancel_reminder_notification' });
      return false;
    }
  }

  /**
   * 获取所有已安排的通知
   * @returns {Promise<Array>} 通知列表
   */
  async getAllScheduledNotifications() {
    try {
      return await Notifications.getAllScheduledNotificationsAsync();
    } catch (error) {
      console.error('获取已安排的通知失败:', error);
      analyticsService.trackError(error, { action: 'get_all_scheduled_notifications' });
      return [];
    }
  }

  /**
   * 清除所有通知
   * @returns {Promise<boolean>} 是否成功
   */
  async clearAllNotifications() {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      await Notifications.dismissAllNotificationsAsync();
      
      analyticsService.trackEvent('clear_all_notifications');
      
      return true;
    } catch (error) {
      console.error('清除所有通知失败:', error);
      analyticsService.trackError(error, { action: 'clear_all_notifications' });
      return false;
    }
  }

  /**
   * 同步离线创建的提醒
   * @returns {Promise<boolean>} 是否成功
   */
  async syncOfflineReminders() {
    try {
      // 检查网络连接
      const isConnected = await isNetworkConnected();
      if (!isConnected) {
        console.log('无网络连接，无法同步离线提醒');
        return false;
      }
      
      // 获取离线提醒
      const offlineRemindersJson = await AsyncStorage.getItem(STORAGE_KEYS.OFFLINE_REMINDERS);
      if (!offlineRemindersJson) {
        return true; // 没有离线提醒需要同步
      }
      
      const offlineReminders = JSON.parse(offlineRemindersJson);
      if (!offlineReminders.length) {
        return true; // 没有离线提醒需要同步
      }
      
      console.log(`开始同步${offlineReminders.length}个离线提醒`);
      
      // 同步每个离线提醒
      const syncPromises = offlineReminders.map(async (reminder) => {
        try {
          const result = await reminderApi.createReminder(reminder);
          if (result.success) {
            console.log(`成功同步提醒: ${reminder.title}`);
            return { success: true, reminder };
          } else {
            console.error(`同步提醒失败: ${reminder.title}`, result.message);
            return { success: false, reminder };
          }
        } catch (error) {
          console.error(`同步提醒出错: ${reminder.title}`, error);
          return { success: false, reminder };
        }
      });
      
      // 等待所有同步完成
      const results = await Promise.all(syncPromises);
      
      // 过滤出同步失败的提醒
      const failedReminders = results
        .filter(result => !result.success)
        .map(result => result.reminder);
      
      // 更新离线提醒存储
      if (failedReminders.length > 0) {
        await AsyncStorage.setItem(STORAGE_KEYS.OFFLINE_REMINDERS, JSON.stringify(failedReminders));
        console.log(`${failedReminders.length}个提醒同步失败，将在下次尝试`);
      } else {
        await AsyncStorage.removeItem(STORAGE_KEYS.OFFLINE_REMINDERS);
        console.log('所有离线提醒同步成功');
      }
      
      analyticsService.trackEvent('sync_offline_reminders', {
        totalCount: offlineReminders.length,
        successCount: offlineReminders.length - failedReminders.length,
        failedCount: failedReminders.length,
      });
      
      return failedReminders.length === 0;
    } catch (error) {
      console.error('同步离线提醒失败:', error);
      analyticsService.trackError(error, { action: 'sync_offline_reminders' });
      return false;
    }
  }

  /**
   * 保存离线提醒
   * @param {Object} reminder 提醒对象
   * @returns {Promise<boolean>} 是否成功
   */
  async saveOfflineReminder(reminder) {
    try {
      // 获取现有的离线提醒
      const offlineRemindersJson = await AsyncStorage.getItem(STORAGE_KEYS.OFFLINE_REMINDERS);
      const offlineReminders = offlineRemindersJson ? JSON.parse(offlineRemindersJson) : [];
      
      // 添加新的离线提醒
      offlineReminders.push({
        ...reminder,
        offlineId: `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date().toISOString(),
      });
      
      // 保存更新后的离线提醒
      await AsyncStorage.setItem(STORAGE_KEYS.OFFLINE_REMINDERS, JSON.stringify(offlineReminders));
      
      analyticsService.trackEvent('save_offline_reminder', {
        title: reminder.title,
      });
      
      return true;
    } catch (error) {
      console.error('保存离线提醒失败:', error);
      analyticsService.trackError(error, { action: 'save_offline_reminder' });
      return false;
    }
  }

  /**
   * 获取离线提醒
   * @returns {Promise<Array>} 离线提醒列表
   */
  async getOfflineReminders() {
    try {
      const offlineRemindersJson = await AsyncStorage.getItem(STORAGE_KEYS.OFFLINE_REMINDERS);
      return offlineRemindersJson ? JSON.parse(offlineRemindersJson) : [];
    } catch (error) {
      console.error('获取离线提醒失败:', error);
      analyticsService.trackError(error, { action: 'get_offline_reminders' });
      return [];
    }
  }
}

export default new ReminderNotificationService();
