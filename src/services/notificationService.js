import PushNotification from 'react-native-push-notification';
import { Platform } from 'react-native';
import { analyticsService } from './analytics';

class NotificationService {
  constructor() {
    this.lastId = 0;
    this.initialize();
  }

  initialize() {
    try {
      // 配置通知
      PushNotification.configure({
        // 当应用程序打开时收到远程通知时调用
        onNotification: this.onNotification.bind(this),
        
        // 当用户点击通知时调用
        onAction: this.onAction.bind(this),
        
        // 当注册令牌时调用
        onRegistrationError: this.onRegistrationError.bind(this),
        
        // 是否应该在前台显示通知
        popInitialNotification: true,
        
        // 请求权限处理
        requestPermissions: true,
      });
      
      // 创建通知渠道（仅Android）
      if (Platform.OS === 'android') {
        this.createChannels();
      }
      
      analyticsService.trackEvent('notification_service_initialized');
    } catch (error) {
      console.error('初始化通知服务错误:', error);
      analyticsService.trackError(error, { action: 'init_notification_service' });
    }
  }

  createChannels() {
    try {
      // 创建默认通知渠道
      PushNotification.createChannel(
        {
          channelId: 'default-channel',
          channelName: '默认通知',
          channelDescription: '默认通知渠道',
          importance: 4, // 高重要性
          vibrate: true,
        },
        (created) => console.log(`默认通知渠道创建${created ? '成功' : '失败'}`)
      );
      
      // 创建提醒通知渠道
      PushNotification.createChannel(
        {
          channelId: 'reminder-channel',
          channelName: '提醒通知',
          channelDescription: '提醒和待办事项通知',
          importance: 5, // 最高重要性
          vibrate: true,
          playSound: true,
          soundName: 'default',
        },
        (created) => console.log(`提醒通知渠道创建${created ? '成功' : '失败'}`)
      );
      
      // 创建更新通知渠道
      PushNotification.createChannel(
        {
          channelId: 'update-channel',
          channelName: '更新通知',
          channelDescription: '应用更新和系统通知',
          importance: 3, // 中等重要性
          vibrate: false,
        },
        (created) => console.log(`更新通知渠道创建${created ? '成功' : '失败'}`)
      );
    } catch (error) {
      console.error('创建通知渠道错误:', error);
      analyticsService.trackError(error, { action: 'create_notification_channels' });
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
        action: notification.action 
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
        scheduledTime: options.date.toString() 
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

  // 请求通知权限
  requestPermissions() {
    return new Promise((resolve, reject) => {
      try {
        PushNotification.requestPermissions((permissions) => {
          if (permissions.alert || permissions.badge || permissions.sound) {
            analyticsService.trackEvent('notification_permissions_granted');
            resolve(true);
          } else {
            analyticsService.trackEvent('notification_permissions_denied');
            resolve(false);
          }
        });
      } catch (error) {
        console.error('请求通知权限错误:', error);
        analyticsService.trackError(error, { action: 'request_notification_permissions' });
        reject(error);
      }
    });
  }

  // 检查通知权限
  checkPermissions() {
    return new Promise((resolve, reject) => {
      try {
        PushNotification.checkPermissions((permissions) => {
          resolve(permissions);
        });
      } catch (error) {
        console.error('检查通知权限错误:', error);
        analyticsService.trackError(error, { action: 'check_notification_permissions' });
        reject(error);
      }
    });
  }
}

export const notificationService = new NotificationService();
