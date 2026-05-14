/**
 * 提醒通知服务
 * 处理提醒的本地通知和离线存储
 * 使用 MongoDB 替代 AsyncStorage
 */
import PushNotification from 'react-native-push-notification';
import { Platform } from 'react-native';
import reminderApi from '../api/reminderApi';
import analyticsService from '../analytics/analyticsService';
import { isNetworkConnected } from '../network/networkService';
import reminderMongoDBService from './reminderMongoDBService';
import realmService from '../database/realmService';


// 本地存储键
const STORAGE_KEYS = {
  PENDING_REMINDERS: 'pending_reminders',
  OFFLINE_REMINDERS: 'offline_reminders',
  ALL_REMINDERS: 'all_reminders',
  OFFLINE_OPERATIONS: 'offline_operations',
  LAST_SYNC_TIME: 'last_sync_time',
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

  buildOfflineReminderPayload(reminder) {
    const offlineId = reminder.offlineId || realmService.createObjectId();
    const localId = reminder.id || `local-${offlineId}`;

    return {
      ...reminder,
      id: localId,
      offlineId,
      isLocal: true,
    };
  }

  sanitizeReminderForCreate(reminder) {
    const {
      id,
      offlineId,
      isLocal,
      createdAt,
      updatedAt,
      notificationId,
      ...serverPayload
    } = reminder || {};

    return serverPayload;
  }

  /**
   * 初始化通知服务
   */
  async init() {
    if (this.initialized) { return; }

    try {
      // 配置通知
      PushNotification.configure({
        // 当应用程序打开时收到远程通知时调用
        onNotification: function (notification) {
          console.log('收到通知:', notification);
        },

        // 当用户点击通知时调用
        onAction: function (notification) {
          console.log('用户点击通知:', notification.action);
        },

        // 当注册令牌时调用
        onRegistrationError: function (err) {
          console.error('注册令牌错误:', err.message);
        },

        // 是否应该在前台显示通知
        popInitialNotification: true,

        // 请求权限处理
        requestPermissions: true,
      });

      // 创建通知渠道（仅Android）
      if (Platform.OS === 'android') {
        PushNotification.createChannel(
          {
            channelId: REMINDER_CHANNEL_ID,
            channelName: '提醒通知',
            channelDescription: '提醒和待办事项的通知',
            importance: 4, // HIGH
            vibrate: true,
            vibration: 300,
            playSound: true,
            soundName: 'default',
          },
          (created) => console.log(`通知渠道创建${created ? '成功' : '失败'}`)
        );
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
      // react-native-push-notification在configure时会自动请求权限
      // 这里我们返回一个Promise，模拟权限请求
      return new Promise((resolve) => {
        PushNotification.checkPermissions((permissions) => {
          const isGranted = Platform.OS === 'ios'
            ? permissions.alert && permissions.badge && permissions.sound
            : true; // Android通常默认授予权限

          analyticsService.trackEvent('request_notification_permissions', {
            permissions,
            isGranted,
          });

          resolve(isGranted);
        });
      });
    } catch (error) {
      console.error('请求通知权限失败:', error);
      analyticsService.trackError(error, { action: 'request_notification_permissions' });
      throw error;
    }
  }

  /**
   * 检查通知权限
   * @returns {Promise<boolean>} 是否有权限
   */
  async checkPermissions() {
    try {
      return new Promise((resolve) => {
        PushNotification.checkPermissions((permissions) => {
          const isGranted = Platform.OS === 'ios'
            ? permissions.alert && permissions.badge && permissions.sound
            : true; // Android通常默认授予权限

          resolve(isGranted);
        });
      });
    } catch (error) {
      console.error('检查通知权限失败:', error);
      analyticsService.trackError(error, { action: 'check_notification_permissions' });
      throw error;
    }
  }

  /**
   * 取消提醒通知
   * @param {string} reminderId 提醒ID
   * @returns {Promise<boolean>} 是否成功
   */
  async cancelReminderNotification(reminderId) {
    try {
      await this.init();

      // 生成通知ID
      const notificationId = `reminder_${reminderId}`;

      // 取消通知
      PushNotification.cancelLocalNotification(notificationId);

      console.log('已取消提醒通知:', notificationId);
      return true;
    } catch (error) {
      console.error('取消提醒通知失败:', error);
      throw error;
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

      // 业务跳过：提醒已完成或未启用时不应发送通知（非错误场景，返回 null 表示未创建通知）
      if (reminder.is_completed || !reminder.is_enabled) {
        console.log('提醒已完成或未启用，不发送通知:', reminder.title);
        return null;
      }

      // 计算通知时间
      const notificationTime = new Date(reminder.dueDate || reminder.due_date);

      // 业务跳过：提醒时间已过时不再安排通知（非错误场景，返回 null 表示未创建通知）
      if (notificationTime < new Date()) {
        console.log('提醒时间已过，不发送通知:', reminder.title);
        return null;
      }

      // 生成通知ID
      const notificationId = `reminder_${reminder.id || realmService.createObjectId()}`;

      // 根据优先级设置通知颜色
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

      // 安排通知
      PushNotification.localNotificationSchedule({
        id: notificationId,
        channelId: REMINDER_CHANNEL_ID,
        title: reminder.title,
        message: reminder.description || '您有一个待办事项需要处理',
        date: notificationTime,
        allowWhileIdle: true,
        playSound: true,
        soundName: 'default',
        vibrate: true,
        vibration: 300,
        priority: 'high',
        visibility: 'private',
        importance: 'high',
        color: color,
        userInfo: {
          reminderId: reminder.id,
          type: 'reminder',
          category: reminder.category || 'other',
          priority: reminder.priority || 'medium',
          frequency: reminder.frequency || 'once',
        },
      });

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
      throw error;
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
          // 业务跳过：已达到重复结束时间（非错误场景，返回 null 表示无需继续安排）
          console.log('已达到重复结束时间，不再安排下一次通知:', reminder.title);
          return null;
        }
      }

      // 创建下一次提醒对象
      const nextReminder = {
        ...reminder,
        due_date: nextNotificationTime.toISOString(),
      };

      return nextReminder;
    } catch (error) {
      console.error('安排重复提醒失败:', error);
      analyticsService.trackError(error, { action: 'schedule_repeating_reminder' });
      throw error;
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
        // 业务语义：不支持/未配置重复频率时不计算下一次时间（非错误，返回 null）
        return null;
    }

    return nextTime;
  }

  /**
   * 取消提醒通知
   * @param {string} notificationId 通知ID
   * @returns {Promise<boolean>} 是否成功
   */
  async cancelNotificationById(notificationId) {
    try {
      PushNotification.cancelLocalNotification(notificationId);

      analyticsService.trackEvent('cancel_reminder_notification', {
        notificationId,
      });

      return true;
    } catch (error) {
      console.error('取消提醒通知失败:', error);
      analyticsService.trackError(error, { action: 'cancel_reminder_notification' });
      throw error;
    }
  }

  /**
   * 获取所有已安排的通知
   * @returns {Promise<Array>} 通知列表
   */
  async getAllScheduledNotifications() {
    try {
      return new Promise((resolve) => {
        PushNotification.getScheduledLocalNotifications((notifications) => {
          resolve(notifications);
        });
      });
    } catch (error) {
      console.error('获取已安排的通知失败:', error);
      analyticsService.trackError(error, { action: 'get_all_scheduled_notifications' });
      throw error;
    }
  }

  /**
   * 清除所有通知
   * @returns {Promise<boolean>} 是否成功
   */
  async clearAllNotifications() {
    try {
      PushNotification.cancelAllLocalNotifications();
      PushNotification.removeAllDeliveredNotifications();

      analyticsService.trackEvent('clear_all_notifications');

      return true;
    } catch (error) {
      console.error('清除所有通知失败:', error);
      analyticsService.trackError(error, { action: 'clear_all_notifications' });
      throw error;
    }
  }

  /**
   * 同步离线操作
   * @returns {Promise<Object>} 同步结果
   */
  async syncOfflineReminders() {
    try {
      // 检查网络连接
      const isConnected = await isNetworkConnected();
      if (!isConnected) {
        console.log('无网络连接，无法同步离线操作');
        throw new Error('无网络连接，无法同步离线操作，请连接网络后重试');
      }

      // 获取离线操作记录
      const operations = await this.getOfflineOperations();
      if (!operations || operations.length === 0) {
        console.log('没有离线操作需要同步');
        return { success: true, message: '没有离线操作需要同步', synced: 0, failed: 0 };
      }

      console.log(`开始同步${operations.length}个离线操作`);

      let synced = 0;
      let failed = 0;
      const failedOperations = [];

      // 按时间戳排序，确保按正确顺序处理操作
      operations.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

      // 同步每个操作
      for (const operation of operations) {
        try {
          let result;

          switch (operation.operation) {
            case 'create':
              result = await reminderApi.createReminder(this.sanitizeReminderForCreate(operation.data));
              break;
            case 'update':
              result = await reminderApi.updateReminder(operation.data.id, operation.data);
              break;
            case 'delete':
              result = await reminderApi.deleteReminder(operation.data.id);
              break;
            default:
              console.warn(`未知的操作类型: ${operation.operation}`);
              failedOperations.push(operation);
              failed++;
              continue;
          }

          if (result && result.success) {
            console.log(`成功同步操作: ${operation.operation} ${operation.data.title || operation.data.id}`);
            synced++;

            // 如果是创建操作，需要更新本地通知
            if (operation.operation === 'create' && result.data) {
              // 取消旧的本地通知
              if (operation.data.notificationId) {
                await this.cancelReminderNotification(operation.data.notificationId);
              }

              // 安排新的通知
              await this.scheduleReminderNotification(result.data);
            }
          } else {
            console.error(`同步操作失败: ${operation.operation} ${operation.data.title || operation.data.id}`, result?.message);
            failedOperations.push(operation);
            failed++;
          }
        } catch (error) {
          console.error(`同步操作出错: ${operation.operation} ${operation.data.title || operation.data.id}`, error);
          failedOperations.push(operation);
          failed++;
        }
      }

      // 更新离线操作存储
      if (failedOperations.length > 0) {
        await reminderMongoDBService.setItem(STORAGE_KEYS.OFFLINE_OPERATIONS, failedOperations);
        console.log(`${failedOperations.length}个操作同步失败，将在下次尝试`);
      } else {
        await reminderMongoDBService.removeItem(STORAGE_KEYS.OFFLINE_OPERATIONS);
        console.log('所有离线操作同步成功');
      }

      // 更新最后同步时间
      await reminderMongoDBService.setItem(STORAGE_KEYS.LAST_SYNC_TIME, new Date().toISOString());

      // 如果有成功同步的操作，从服务器获取最新数据
      if (synced > 0) {
        try {
          const response = await reminderApi.getAllReminders();
          if (response.success) {
            await this.saveAllReminders(response.data);
          }
        } catch (error) {
          console.error('获取最新提醒数据失败:', error);
        }
      }

      analyticsService.trackEvent('sync_offline_operations', {
        totalCount: operations.length,
        successCount: synced,
        failedCount: failed,
      });

      if (failed > 0) {
        throw new Error(`${failed}个离线操作同步失败，请稍后重试`);
      }

      return {
        succeeded: true,
        message: '所有操作同步成功',
        synced,
        failed,
      };
    } catch (error) {
      console.error('同步离线操作失败:', error);
      analyticsService.trackError(error, { action: 'sync_offline_operations' });
      throw error;
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
      const offlineReminders = await reminderMongoDBService.getItem(STORAGE_KEYS.OFFLINE_REMINDERS) || [];
      const offlineReminder = this.buildOfflineReminderPayload(reminder);
      const nextOfflineReminder = {
        ...offlineReminder,
        createdAt: offlineReminder.createdAt || new Date().toISOString(),
      };
      const updatedOfflineReminders = offlineReminders.filter(item => item.id !== nextOfflineReminder.id);

      // 添加或覆盖同 id 的本地提醒，避免通知调度失败后重复重试时不断插入新副本
      updatedOfflineReminders.push(nextOfflineReminder);

      // 保存更新后的离线提醒
      await reminderMongoDBService.setItem(STORAGE_KEYS.OFFLINE_REMINDERS, updatedOfflineReminders);

      // 保存离线操作记录
      await this.saveOfflineOperation('create', offlineReminder);

      analyticsService.trackEvent('save_offline_reminder', {
        title: offlineReminder.title,
      });

      return nextOfflineReminder;
    } catch (error) {
      console.error('保存离线提醒失败:', error);
      analyticsService.trackError(error, { action: 'save_offline_reminder' });
      throw error;
    }
  }

  /**
   * 保存离线更新提醒
   * @param {Object} reminder 提醒对象
   * @returns {Promise<boolean>} 是否成功
   */
  async saveOfflineReminderUpdate(reminder) {
    try {
      const offlineReminders = await reminderMongoDBService.getItem(STORAGE_KEYS.OFFLINE_REMINDERS) || [];
      const updatedOfflineReminders = offlineReminders.filter(item => item.id !== reminder.id);

      updatedOfflineReminders.push({
        ...reminder,
        offlineId: reminder.offlineId || realmService.createObjectId(),
        updatedAt: new Date().toISOString(),
      });

      await reminderMongoDBService.setItem(STORAGE_KEYS.OFFLINE_REMINDERS, updatedOfflineReminders);
      await this.saveOfflineOperation('update', reminder);

      analyticsService.trackEvent('save_offline_reminder_update', {
        id: reminder.id,
        title: reminder.title,
      });

      return true;
    } catch (error) {
      console.error('保存离线更新提醒失败:', error);
      analyticsService.trackError(error, { action: 'save_offline_reminder_update' });
      throw error;
    }
  }

  /**
   * 获取离线提醒
   * @returns {Promise<Array>} 离线提醒列表
   */
  async getOfflineReminders() {
    try {
      return await reminderMongoDBService.getItem(STORAGE_KEYS.OFFLINE_REMINDERS) || [];
    } catch (error) {
      console.error('获取离线提醒失败:', error);
      analyticsService.trackError(error, { action: 'get_offline_reminders' });
      throw error;
    }
  }

  /**
   * 保存所有提醒到本地存储
   * @param {Array} reminders 提醒列表
   * @returns {Promise<boolean>} 是否成功
   */
  async saveAllReminders(reminders) {
    try {
      await reminderMongoDBService.setItem(STORAGE_KEYS.ALL_REMINDERS, reminders);
      await reminderMongoDBService.setItem(STORAGE_KEYS.LAST_SYNC_TIME, new Date().toISOString());

      analyticsService.trackEvent('save_all_reminders', {
        count: reminders.length,
      });

      return true;
    } catch (error) {
      console.error('保存所有提醒失败:', error);
      analyticsService.trackError(error, { action: 'save_all_reminders' });
      throw error;
    }
  }

  /**
   * 获取所有本地存储的提醒
   * @returns {Promise<Array>} 提醒列表
   */
  async getAllReminders() {
    try {
      return await reminderMongoDBService.getItem(STORAGE_KEYS.ALL_REMINDERS) || [];
    } catch (error) {
      console.error('获取所有提醒失败:', error);
      analyticsService.trackError(error, { action: 'get_all_reminders' });
      throw error;
    }
  }

  /**
   * 保存离线操作记录
   * @param {string} operation 操作类型 ('create', 'update', 'delete')
   * @param {Object} data 操作数据
   * @returns {Promise<boolean>} 是否成功
   */
  async saveOfflineOperation(operation, data) {
    try {
      // 获取现有的离线操作
      const operations = await reminderMongoDBService.getItem(STORAGE_KEYS.OFFLINE_OPERATIONS) || [];

      // 添加新的操作
      operations.push({
        id: `${operation}_${realmService.createObjectId()}`,
        operation,
        data,
        timestamp: new Date().toISOString(),
      });

      // 保存更新后的操作记录
      await reminderMongoDBService.setItem(STORAGE_KEYS.OFFLINE_OPERATIONS, operations);

      return true;
    } catch (error) {
      console.error('保存离线操作记录失败:', error);
      analyticsService.trackError(error, { action: 'save_offline_operation' });
      throw error;
    }
  }

  /**
   * 保存离线删除提醒
   * @param {Object|string} reminder 提醒对象或提醒ID
   * @returns {Promise<boolean>} 是否成功
   */
  async saveOfflineReminderDelete(reminder) {
    try {
      const reminderId = typeof reminder === 'string' ? reminder : reminder?.id;
      if (!reminderId) {
        throw new Error('保存离线删除提醒失败：缺少 reminderId');
      }

      await this.removeOfflineReminder(reminderId);
      await this.saveOfflineOperation('delete', { id: reminderId });

      analyticsService.trackEvent('save_offline_reminder_delete', {
        id: reminderId,
      });

      return true;
    } catch (error) {
      console.error('保存离线删除提醒失败:', error);
      analyticsService.trackError(error, { action: 'save_offline_reminder_delete' });
      throw error;
    }
  }

  /**
   * 获取离线操作记录
   * @returns {Promise<Array>} 操作记录列表
   */
  async getOfflineOperations() {
    try {
      return await reminderMongoDBService.getItem(STORAGE_KEYS.OFFLINE_OPERATIONS) || [];
    } catch (error) {
      console.error('获取离线操作记录失败:', error);
      analyticsService.trackError(error, { action: 'get_offline_operations' });
      throw error;
    }
  }

  /**
   * 清除离线操作记录
   * @returns {Promise<boolean>} 是否成功
   */
  async clearOfflineOperations() {
    try {
      await reminderMongoDBService.removeItem(STORAGE_KEYS.OFFLINE_OPERATIONS);
      return true;
    } catch (error) {
      console.error('清除离线操作记录失败:', error);
      analyticsService.trackError(error, { action: 'clear_offline_operations' });
      throw error;
    }
  }

  /**
   * 移除离线提醒
   * @param {string} id 提醒ID
   * @returns {Promise<boolean>} 是否成功
   */
  async removeOfflineReminder(id) {
    try {
      // 获取现有的离线提醒
      const offlineReminders = await reminderMongoDBService.getItem(STORAGE_KEYS.OFFLINE_REMINDERS);
      if (!offlineReminders || !Array.isArray(offlineReminders)) { return true; }

      // 过滤掉要移除的提醒
      const updatedReminders = offlineReminders.filter(reminder =>
        reminder.id !== id && reminder.offlineId !== id
      );

      // 保存更新后的离线提醒
      if (updatedReminders.length > 0) {
        await reminderMongoDBService.setItem(STORAGE_KEYS.OFFLINE_REMINDERS, updatedReminders);
      } else {
        await reminderMongoDBService.removeItem(STORAGE_KEYS.OFFLINE_REMINDERS);
      }

      return true;
    } catch (error) {
      console.error('移除离线提醒失败:', error);
      analyticsService.trackError(error, { action: 'remove_offline_reminder' });
      throw error;
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
        errors: [],
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
            repeat_end_date: reminder.repeat_end_date || null,
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
        failed: result.failed,
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
      'repeat_end_date', 'completed_at',
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
    // 工具契约：空输入视为无可解析数据（非错误，返回空数组）
    if (!csv) {
      return [];
    }

    // 分割行
    const lines = csv.split('\n');
    // 工具契约：仅有表头或无有效数据行时返回空数组（非错误）
    if (lines.length < 2) {
      return [];
    }

    // 解析头部
    const headers = this._parseCSVLine(lines[0]);

    // 解析数据行
    const reminders = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) { continue; }

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

// 创建单例实例
const reminderNotificationService = new ReminderNotificationService();

// 导出单例实例
export default reminderNotificationService;
