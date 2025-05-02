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

      // 如果提醒已完成或未启用，不发送通知
      if (reminder.is_completed || !reminder.is_enabled) {
        console.log('提醒已完成或未启用，不发送通知:', reminder.title);
        return null;
      }

      // 计算通知时间
      const notificationTime = new Date(reminder.dueDate || reminder.due_date);

      // 如果时间已过，不发送通知
      if (notificationTime < new Date()) {
        console.log('提醒时间已过，不发送通知:', reminder.title);
        return null;
      }

      // 准备通知内容
      const notificationContent = {
        title: reminder.title,
        body: reminder.description || '您有一个待办事项需要处理',
        data: {
          reminderId: reminder.id,
          type: 'reminder',
          category: reminder.category || 'other',
          priority: reminder.priority || 'medium',
          frequency: reminder.frequency || 'once'
        },
        sound: true,
      };

      // 根据优先级设置通知颜色（仅Android）
      if (Platform.OS === 'android') {
        let color = '#3498db'; // 默认蓝色

        if (reminder.color) {
          color = reminder.color;
        } else if (reminder.priority === 'high') {
          color = '#e74c3c'; // 红色
        } else if (reminder.priority === 'medium') {
          color = '#f39c12'; // 橙色
        } else if (reminder.priority === 'low') {
          color = '#2ecc71'; // 绿色
        }

        notificationContent.color = color;
      }

      // 安排通知
      const notificationId = await Notifications.scheduleNotificationAsync({
        content: notificationContent,
        trigger: {
          date: notificationTime,
          channelId: REMINDER_CHANNEL_ID,
        },
      });

      // 如果是重复提醒，安排下一次通知
      if (reminder.frequency && reminder.frequency !== 'once') {
        await this._scheduleRepeatingReminder(reminder, notificationTime);
      }

      analyticsService.trackEvent('schedule_reminder_notification', {
        reminderId: reminder.id,
        title: reminder.title,
        notificationTime: notificationTime.toISOString(),
        frequency: reminder.frequency,
        category: reminder.category,
      });

      return notificationId;
    } catch (error) {
      console.error('安排提醒通知失败:', error);
      analyticsService.trackError(error, { action: 'schedule_reminder_notification' });
      return null;
    }
  }

  /**
   * 安排重复提醒的下一次通知
   * @param {Object} reminder 提醒对象
   * @param {Date} lastNotificationTime 上一次通知时间
   * @returns {Promise<string>} 通知ID
   * @private
   */
  async _scheduleRepeatingReminder(reminder, lastNotificationTime) {
    try {
      // 计算下一次通知时间
      const nextNotificationTime = this._calculateNextNotificationTime(
        reminder.frequency,
        new Date(lastNotificationTime)
      );

      // 如果有重复结束时间，检查是否已超过
      if (reminder.repeat_end_date) {
        const endDate = new Date(reminder.repeat_end_date);
        if (nextNotificationTime > endDate) {
          console.log('已达到重复结束时间，不再安排下一次通知:', reminder.title);
          return null;
        }
      }

      // 创建下一次提醒对象
      const nextReminder = {
        ...reminder,
        due_date: nextNotificationTime.toISOString(),
      };

      // 安排下一次通知
      return await this.scheduleReminderNotification(nextReminder);
    } catch (error) {
      console.error('安排重复提醒失败:', error);
      analyticsService.trackError(error, { action: 'schedule_repeating_reminder' });
      return null;
    }
  }

  /**
   * 计算下一次通知时间
   * @param {string} frequency 频率（daily, weekly, monthly, yearly）
   * @param {Date} lastTime 上一次时间
   * @returns {Date} 下一次时间
   * @private
   */
  _calculateNextNotificationTime(frequency, lastTime) {
    const nextTime = new Date(lastTime);

    switch (frequency) {
      case 'daily':
        nextTime.setDate(nextTime.getDate() + 1);
        break;
      case 'weekly':
        nextTime.setDate(nextTime.getDate() + 7);
        break;
      case 'monthly':
        // 处理月份边界情况
        const currentMonth = nextTime.getMonth();
        nextTime.setMonth(currentMonth + 1);

        // 处理月份天数不同的情况（如31日到30日的月份）
        if (nextTime.getMonth() !== (currentMonth + 1) % 12) {
          // 设置为月末
          nextTime.setDate(0);
        }
        break;
      case 'yearly':
        nextTime.setFullYear(nextTime.getFullYear() + 1);
        break;
      default:
        // 默认不重复
        return null;
    }

    return nextTime;
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

  /**
   * 导出提醒数据
   * @param {Object} options 导出选项
   * @param {string} options.format 导出格式 ('json' 或 'csv')
   * @param {boolean} options.includeCompleted 是否包含已完成的提醒
   * @returns {Promise<string>} 导出的数据
   */
  async exportReminders(options = { format: 'json', includeCompleted: false }) {
    try {
      // 获取提醒数据
      let reminders = [];

      // 检查网络连接
      const isConnected = await isNetworkConnected();
      if (isConnected) {
        // 从服务器获取提醒
        const response = await reminderApi.getAllReminders();
        if (response.success) {
          reminders = response.data;
        }
      } else {
        // 使用离线提醒
        reminders = await this.getOfflineReminders();
      }

      // 过滤已完成的提醒
      if (!options.includeCompleted) {
        reminders = reminders.filter(reminder => !reminder.is_completed);
      }

      // 格式化数据
      if (options.format === 'csv') {
        return this._convertToCSV(reminders);
      } else {
        return JSON.stringify(reminders, null, 2);
      }
    } catch (error) {
      console.error('导出提醒数据失败:', error);
      analyticsService.trackError(error, { action: 'export_reminders' });
      throw error;
    }
  }

  /**
   * 导入提醒数据
   * @param {string} data 导入的数据
   * @param {string} format 数据格式 ('json' 或 'csv')
   * @returns {Promise<Object>} 导入结果
   */
  async importReminders(data, format = 'json') {
    try {
      // 解析数据
      let reminders = [];

      if (format === 'json') {
        reminders = JSON.parse(data);
      } else if (format === 'csv') {
        reminders = this._parseCSV(data);
      } else {
        throw new Error('不支持的数据格式');
      }

      if (!Array.isArray(reminders)) {
        throw new Error('导入数据必须是提醒数组');
      }

      // 导入结果
      const result = {
        total: reminders.length,
        imported: 0,
        failed: 0,
        errors: []
      };

      // 检查网络连接
      const isConnected = await isNetworkConnected();

      // 导入每个提醒
      for (const reminder of reminders) {
        try {
          // 验证必填字段
          if (!reminder.title) {
            result.failed++;
            result.errors.push(`提醒缺少标题: ${JSON.stringify(reminder)}`);
            continue;
          }

          if (!reminder.due_date && !reminder.dueDate) {
            result.failed++;
            result.errors.push(`提醒缺少到期时间: ${JSON.stringify(reminder)}`);
            continue;
          }

          // 准备提醒数据
          const reminderData = {
            title: reminder.title,
            description: reminder.description || '',
            due_date: reminder.due_date || reminder.dueDate,
            priority: reminder.priority || 'medium',
            frequency: reminder.frequency || 'once',
            category: reminder.category || 'other',
            color: reminder.color || '#3498db',
            tags: reminder.tags || '',
            is_enabled: reminder.is_enabled !== undefined ? reminder.is_enabled : true,
            is_completed: reminder.is_completed || false,
            repeat_end_date: reminder.repeat_end_date || null
          };

          if (isConnected) {
            // 创建提醒到服务器
            const response = await reminderApi.createReminder(reminderData);
            if (response.success) {
              result.imported++;

              // 安排本地通知
              await this.scheduleReminderNotification(response.data);
            } else {
              result.failed++;
              result.errors.push(`创建提醒失败: ${response.message}`);
            }
          } else {
            // 保存到离线存储
            await this.saveOfflineReminder(reminderData);
            result.imported++;

            // 安排本地通知
            await this.scheduleReminderNotification(reminderData);
          }
        } catch (error) {
          result.failed++;
          result.errors.push(`导入提醒失败: ${error.message}`);
        }
      }

      analyticsService.trackEvent('import_reminders', {
        format,
        total: result.total,
        imported: result.imported,
        failed: result.failed
      });

      return result;
    } catch (error) {
      console.error('导入提醒数据失败:', error);
      analyticsService.trackError(error, { action: 'import_reminders' });
      throw error;
    }
  }

  /**
   * 将提醒数据转换为CSV格式
   * @param {Array} reminders 提醒数组
   * @returns {string} CSV字符串
   * @private
   */
  _convertToCSV(reminders) {
    if (!reminders || reminders.length === 0) {
      return '';
    }

    // 获取所有字段
    const fields = [
      'title', 'description', 'due_date', 'priority', 'frequency',
      'category', 'color', 'tags', 'is_enabled', 'is_completed',
      'repeat_end_date', 'completed_at'
    ];

    // 创建CSV头
    let csv = fields.join(',') + '\n';

    // 添加每行数据
    for (const reminder of reminders) {
      const row = fields.map(field => {
        const value = reminder[field];

        // 处理不同类型的值
        if (value === undefined || value === null) {
          return '';
        } else if (typeof value === 'string') {
          // 转义引号并用引号包裹字符串
          return `"${value.replace(/"/g, '""')}"`;
        } else {
          return String(value);
        }
      });

      csv += row.join(',') + '\n';
    }

    return csv;
  }

  /**
   * 解析CSV格式的提醒数据
   * @param {string} csv CSV字符串
   * @returns {Array} 提醒数组
   * @private
   */
  _parseCSV(csv) {
    if (!csv) {
      return [];
    }

    // 分割行
    const lines = csv.split('\n');
    if (lines.length < 2) {
      return [];
    }

    // 解析头部
    const headers = this._parseCSVLine(lines[0]);

    // 解析数据行
    const reminders = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = this._parseCSVLine(line);

      // 创建提醒对象
      const reminder = {};
      headers.forEach((header, index) => {
        if (index < values.length) {
          reminder[header] = values[index];
        }
      });

      reminders.push(reminder);
    }

    return reminders;
  }

  /**
   * 解析CSV行
   * @param {string} line CSV行
   * @returns {Array} 字段值数组
   * @private
   */
  _parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        // 处理引号
        if (inQuotes && i + 1 < line.length && line[i + 1] === '"') {
          // 转义的引号
          current += '"';
          i++;
        } else {
          // 开始或结束引号
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        // 字段分隔符
        result.push(current);
        current = '';
      } else {
        // 普通字符
        current += char;
      }
    }

    // 添加最后一个字段
    result.push(current);

    return result;
  }
}

export default new ReminderNotificationService();
