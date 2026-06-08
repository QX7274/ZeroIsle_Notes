import PushNotification from 'react-native-push-notification';
import { Platform } from 'react-native';
import { analyticsService } from '../analytics/analyticsService';
import { initializeFirebase } from '../firebase/firebaseInit';
import {
  checkNotificationPermission,
  requestNotificationPermission,
} from '../../utils/permissions';

class NotificationService {
  constructor() {
    this.lastId = 0;
    this.initPromise = null;
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) {
      return true;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this._initializeInternal();
    return this.initPromise;
  }

  async _initializeInternal() {
    try {
      console.log('开始初始化通知服务...');

      // 确保 Firebase 已初始化，但不阻止通知服务的初始化
      let firebaseInitialized = false;
      try {
        firebaseInitialized = await initializeFirebase();
        if (firebaseInitialized) {
          console.log('Firebase 初始化成功，继续初始化通知服务');
        } else {
          console.warn('Firebase 未完成初始化，将以本地通知降级继续运行');
        }
      } catch (firebaseError) {
        console.warn('Firebase 初始化失败，但将继续初始化通知服务:', firebaseError);
        // 不抛出错误，继续初始化通知服务
      }

      // 启动阶段只检查通知权限，不主动拉起系统权限弹窗。
      // 真正申请权限交给设置页或具体功能入口显式触发，避免污染冷启动验收链路。
      let hasNotificationPermission = false;
      try {
        console.log('检查通知权限...');
        const permissionPromise = checkNotificationPermission();
        const timeoutPromise = new Promise(resolve => {
          setTimeout(() => {
            console.warn('检查通知权限超时，按未授权处理并继续初始化');
            resolve(false);
          }, 2000); // 2秒超时
        });

        // 使用Promise.race确保不会无限等待
        hasNotificationPermission = await Promise.race([permissionPromise, timeoutPromise]);
        console.log('通知权限状态:', hasNotificationPermission ? '已授权' : '未授权');

        // 即使没有权限也继续初始化，只是可能无法显示通知
      } catch (permissionError) {
        console.warn('检查通知权限失败，但将继续初始化通知服务:', permissionError);
        // 不抛出错误，继续初始化通知服务
        hasNotificationPermission = false;
      }

      // 配置通知
      let notificationConfigured = false;
      try {
        console.log('配置通知服务...');
        PushNotification.configure({
          // 当应用程序打开时收到远程通知时调用
          onNotification: this.onNotification.bind(this),

          // 当用户点击通知时调用
          onAction: this.onAction.bind(this),

          // 当注册令牌时调用
          onRegistrationError: this.onRegistrationError.bind(this),

          // 是否应该在前台显示通知
          popInitialNotification: true,

          // 请求权限处理 - 设为false，我们已经手动处理了权限
          requestPermissions: false,
        });
        console.log('通知服务配置完成');
        notificationConfigured = true;
      } catch (configError) {
        console.error('配置通知服务失败:', configError);
        console.error('错误堆栈:', configError.stack);
        // 不抛出错误，继续初始化
      }

      // 创建通知渠道（仅Android）
      let channelsCreated = false;
      if (Platform.OS === 'android') {
        try {
          console.log('检测到Android平台，开始创建通知渠道...');

          // 设置创建通知渠道的超时
          const channelPromise = this.createChannels();
          const timeoutPromise = new Promise(resolve => {
            setTimeout(() => {
              console.warn('创建通知渠道超时，但应用将继续运行');
              // 即使超时，也认为通知渠道创建成功，避免阻塞应用启动
              resolve(true);
            }, 3000); // 3秒超时，增加等待时间
          });

          // 使用Promise.race确保不会无限等待
          channelsCreated = await Promise.race([channelPromise, timeoutPromise]);

          if (channelsCreated) {
            console.log('通知渠道创建成功或超时但继续运行');
          } else {
            console.warn('通知渠道创建失败，但应用将继续运行');
            // 即使创建失败，也设置为true，避免阻塞应用启动
            channelsCreated = true;
          }
        } catch (channelsError) {
          console.error('创建通知渠道失败:', channelsError);
          console.error('错误堆栈:', channelsError.stack);
          // 不抛出错误，继续初始化
          // 即使出错，也设置为true，避免阻塞应用启动
          channelsCreated = true;
        }
      } else {
        console.log('非Android平台，跳过创建通知渠道');
        channelsCreated = true; // 非Android平台视为成功
      }

      // 汇总初始化结果
      const initResult = {
        firebaseInitialized,
        hasNotificationPermission,
        notificationConfigured,
        channelsCreated,
        overallSuccess: notificationConfigured, // 只要通知服务配置成功，就认为整体初始化成功
      };

      if (initResult.overallSuccess) {
        console.log('提醒通知服务初始化成功');
      } else {
        console.warn('提醒通知服务初始化部分失败，但应用将继续运行');
      }

      this.isInitialized = true;
      analyticsService.trackEvent('notification_service_initialized', initResult);
      return initResult.overallSuccess;
    } catch (error) {
      console.error('初始化通知服务错误:', error);
      console.error('错误堆栈:', error.stack);
      analyticsService.trackError(error, { action: 'init_notification_service' });
      throw error;
    } finally {
      if (!this.isInitialized) {
        this.initPromise = null;
      }
    }
  }

  async requestPermission(timeout = 5000) {
    try {
      return await requestNotificationPermission(timeout);
    } catch (error) {
      console.error('通知服务显式请求权限失败:', error);
      analyticsService.trackError(error, { action: 'request_notification_permission' });
      return false;
    }
  }

  createChannels() {
    return new Promise((resolve) => {
      try {
        console.log('开始创建通知渠道...');
        let channelsCreated = 0;
        let channelsFailed = 0;
        const totalChannels = 3;

        // 检查是否支持通知渠道（Android 8.0及以上）
        if (Platform.OS !== 'android' || Platform.Version < 26) {
          console.log(`当前平台(${Platform.OS})或Android版本(${Platform.Version})不支持通知渠道，跳过创建`);
          resolve(true);
          return;
        }

        // 创建默认通知渠道
        console.log('创建默认通知渠道...');
        this.createSingleChannel(
          {
            channelId: 'default-channel',
            channelName: '默认通知',
            channelDescription: '默认通知渠道',
            importance: 4, // 高重要性
            vibrate: true,
          },
          (success) => {
            if (success) {
              channelsCreated++;
            } else {
              channelsFailed++;
            }
            checkCompletion();
          }
        );

        // 创建提醒通知渠道
        console.log('创建提醒通知渠道...');
        this.createSingleChannel(
          {
            channelId: 'reminder-channel',
            channelName: '提醒通知',
            channelDescription: '提醒和待办事项通知',
            importance: 5, // 最高重要性
            vibrate: true,
            playSound: true,
            soundName: 'default',
          },
          (success) => {
            if (success) {
              channelsCreated++;
            } else {
              channelsFailed++;
            }
            checkCompletion();
          }
        );

        // 创建更新通知渠道
        console.log('创建更新通知渠道...');
        this.createSingleChannel(
          {
            channelId: 'update-channel',
            channelName: '更新通知',
            channelDescription: '应用更新和系统通知',
            importance: 3, // 中等重要性
            vibrate: false,
          },
          (success) => {
            if (success) {
              channelsCreated++;
            } else {
              channelsFailed++;
            }
            checkCompletion();
          }
        );

        // 检查是否所有通知渠道都已创建或失败
        function checkCompletion() {
          if (channelsCreated + channelsFailed >= totalChannels) {
            if (channelsCreated > 0) {
              console.log(`通知渠道创建完成，成功: ${channelsCreated}，失败: ${channelsFailed}`);
              resolve(true);
            } else {
              console.warn('所有通知渠道创建失败，但应用将继续运行');
              resolve(false);
            }
          }
        }

        // 设置超时，避免无限等待
        setTimeout(() => {
          if (channelsCreated + channelsFailed < totalChannels) {
            console.warn(`通知渠道创建超时，已创建 ${channelsCreated}/${totalChannels} 个渠道，失败 ${channelsFailed}/${totalChannels} 个渠道`);
            // 即使超时，也认为通知渠道创建成功，避免阻塞应用启动
            console.log('通知渠道创建部分完成，应用将继续运行');
            resolve(true);
          }
        }, 3000); // 3秒超时，增加等待时间

      } catch (error) {
        console.error('创建通知渠道错误:', error);
        console.error('错误堆栈:', error.stack);
        analyticsService.trackError(error, { action: 'create_notification_channels' });
        resolve(false); // 即使出错也解析Promise，避免阻塞应用启动
      }
    });
  }

  // 创建单个通知渠道的辅助方法
  createSingleChannel(channelConfig, callback) {
    try {
      // 添加重试机制
      let retryCount = 0;
      const maxRetries = 1;

      const attemptCreate = () => {
        try {
          PushNotification.createChannel(
            channelConfig,
            (created) => {
              console.log(`${channelConfig.channelName}通知渠道创建${created ? '成功' : '失败'}`);

              if (!created && retryCount < maxRetries) {
                // 如果创建失败且未达到最大重试次数，则重试
                retryCount++;
                console.log(`重试创建${channelConfig.channelName}通知渠道(${retryCount}/${maxRetries})...`);
                setTimeout(attemptCreate, 500); // 500毫秒后重试
              } else {
                // 创建成功或已达到最大重试次数
                callback(created);
              }
            }
          );
        } catch (error) {
          console.error(`创建${channelConfig.channelName}通知渠道错误:`, error);

          if (retryCount < maxRetries) {
            // 如果未达到最大重试次数，则重试
            retryCount++;
            console.log(`重试创建${channelConfig.channelName}通知渠道(${retryCount}/${maxRetries})...`);
            setTimeout(attemptCreate, 500); // 500毫秒后重试
          } else {
            // 已达到最大重试次数
            callback(false);
          }
        }
      };

      // 开始第一次尝试
      attemptCreate();
    } catch (error) {
      console.error(`创建${channelConfig.channelName}通知渠道过程中发生异常:`, error);
      callback(false);
    }
  }

  onNotification(notification) {
    try {
      console.log('收到通知:', notification);

      // 处理通知
      if (notification.userInteraction) {
        // 用户点击了通知
        analyticsService.trackEvent('notification_clicked', { id: notification.id });
      } else {
        // 收到通知但用户未点击
        analyticsService.trackEvent('notification_received', { id: notification.id });
      }

      // 完成通知处理
      notification.finish(PushNotification.FetchResult.NoData);
    } catch (error) {
      console.error('处理通知错误:', error);
      analyticsService.trackError(error, { action: 'on_notification' });
    }
  }

  onAction(notification) {
    try {
      console.log('通知操作:', notification.action);
      analyticsService.trackEvent('notification_action', {
        id: notification.id,
        action: notification.action,
      });
    } catch (error) {
      console.error('处理通知操作错误:', error);
      analyticsService.trackError(error, { action: 'on_notification_action' });
    }
  }

  onRegistrationError(error) {
    console.error('通知注册错误:', error);
    analyticsService.trackError(error, { action: 'notification_registration' });
  }

  // 显示本地通知
  showNotification(options) {
    try {
      const id = options.id || this.lastId++;

      PushNotification.localNotification({
        id: id.toString(),
        channelId: options.channelId || 'default-channel',
        title: options.title || '零屿笔记',
        message: options.message || '',
        playSound: options.playSound !== false,
        soundName: options.soundName || 'default',
        vibrate: options.vibrate !== false,
        vibration: options.vibration || 300,
        priority: options.priority || 'high',
        visibility: options.visibility || 'private',
        importance: options.importance || 'high',
        autoCancel: options.autoCancel !== false,
        ongoing: options.ongoing || false,
        color: options.color || '#000000',
        largeIcon: options.largeIcon || 'ic_launcher',
        smallIcon: options.smallIcon || 'ic_notification',
        bigText: options.bigText,
        subText: options.subText,
        bigPictureUrl: options.bigPictureUrl,
        actions: options.actions,
        data: options.data || {},
      });

      analyticsService.trackEvent('notification_shown', { id });
      return id;
    } catch (error) {
      console.error('显示通知错误:', error);
      analyticsService.trackError(error, { action: 'show_notification' });
      throw error;
    }
  }

  // 显示定时通知
  scheduleNotification(options) {
    try {
      const id = options.id || this.lastId++;

      PushNotification.localNotificationSchedule({
        id: id.toString(),
        channelId: options.channelId || 'reminder-channel',
        title: options.title || '零屿笔记',
        message: options.message || '',
        date: options.date || new Date(Date.now() + 5 * 1000), // 默认5秒后
        allowWhileIdle: options.allowWhileIdle !== false,
        playSound: options.playSound !== false,
        soundName: options.soundName || 'default',
        vibrate: options.vibrate !== false,
        vibration: options.vibration || 300,
        priority: options.priority || 'high',
        visibility: options.visibility || 'private',
        importance: options.importance || 'high',
        autoCancel: options.autoCancel !== false,
        ongoing: options.ongoing || false,
        color: options.color || '#000000',
        largeIcon: options.largeIcon || 'ic_launcher',
        smallIcon: options.smallIcon || 'ic_notification',
        bigText: options.bigText,
        subText: options.subText,
        bigPictureUrl: options.bigPictureUrl,
        repeatType: options.repeatType, // 'day', 'week', 'month', 'year'
        repeatTime: options.repeatTime,
        actions: options.actions,
        data: options.data || {},
      });

      analyticsService.trackEvent('notification_scheduled', {
        id,
        scheduledTime: options.date.toString(),
      });
      return id;
    } catch (error) {
      console.error('计划通知错误:', error);
      analyticsService.trackError(error, { action: 'schedule_notification' });
      throw error;
    }
  }

  // 取消特定通知
  cancelNotification(id) {
    try {
      PushNotification.cancelLocalNotification(id.toString());
      analyticsService.trackEvent('notification_cancelled', { id });
    } catch (error) {
      console.error('取消通知错误:', error);
      analyticsService.trackError(error, { action: 'cancel_notification' });
      throw error;
    }
  }

  // 取消所有通知
  cancelAllNotifications() {
    try {
      PushNotification.cancelAllLocalNotifications();
      analyticsService.trackEvent('all_notifications_cancelled');
    } catch (error) {
      console.error('取消所有通知错误:', error);
      analyticsService.trackError(error, { action: 'cancel_all_notifications' });
      throw error;
    }
  }

  // 获取已计划的通知
  getScheduledNotifications() {
    return new Promise((resolve, reject) => {
      try {
        PushNotification.getScheduledLocalNotifications((notifications) => {
          resolve(notifications);
        });
      } catch (error) {
        console.error('获取计划通知错误:', error);
        analyticsService.trackError(error, { action: 'get_scheduled_notifications' });
        reject(error);
      }
    });
  }

  // 获取已显示的通知
  getDeliveredNotifications() {
    return new Promise((resolve, reject) => {
      try {
        PushNotification.getDeliveredNotifications((notifications) => {
          resolve(notifications);
        });
      } catch (error) {
        console.error('获取已显示通知错误:', error);
        analyticsService.trackError(error, { action: 'get_delivered_notifications' });
        reject(error);
      }
    });
  }

  // 移除所有已显示的通知
  removeAllDeliveredNotifications() {
    try {
      PushNotification.removeAllDeliveredNotifications();
      analyticsService.trackEvent('all_delivered_notifications_removed');
    } catch (error) {
      console.error('移除所有已显示通知错误:', error);
      analyticsService.trackError(error, { action: 'remove_all_delivered_notifications' });
      throw error;
    }
  }

  // 兼容旧调用方，统一转发到显式申请权限的新入口
  async requestPermissions(timeout = 5000) {
    const granted = await this.requestPermission(timeout);
    analyticsService.trackEvent(
      granted ? 'notification_permissions_granted' : 'notification_permissions_denied'
    );
    return granted;
  }

  // 兼容旧调用方，统一返回布尔状态
  async checkPermissions() {
    try {
      return await checkNotificationPermission();
    } catch (error) {
      console.error('检查通知权限错误:', error);
      analyticsService.trackError(error, { action: 'check_notification_permissions' });
      return false;
    }
  }
}

const notificationService = new NotificationService();

module.exports = notificationService;
module.exports.default = notificationService;
module.exports.notificationService = notificationService;
module.exports.NotificationService = NotificationService;

