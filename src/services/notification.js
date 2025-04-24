import PushNotification from 'react-native-push-notification';
import { Platform } from 'react-native';
import { analyticsService } from './analytics';
import { apiService } from './api';

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

        // 根据通知类型处理导航
        if (notification.data && notification.data.type === 'review') {
          // 如果有导航对象，则导航到提醒页面
          if (this.navigation) {
            this.navigation.navigate('Reminder', { reminderId: notification.data.reminder_id });
          }
        }
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
      console.log('通知操作:', notification);
      analyticsService.trackEvent('notification_action', {
        id: notification.id,
        action: notification.action
      });
    } catch (error) {
      console.error('处理通知操作错误:', error);
      analyticsService.trackError(error, { action: 'on_action' });
    }
  }

  onRegistrationError(error) {
    console.error('通知注册错误:', error);
    analyticsService.trackError(error, { action: 'notification_registration' });
  }

  async scheduleNotification(title, body, data = {}, trigger = null) {
    try {
      const hasPermission = await this.requestPermissions();
      if (!hasPermission) {
        throw new Error('没有通知权限');
      }

      const id = this.lastId + 1;
      this.lastId = id;

      // 如果有触发器，则使用计划通知
      if (trigger) {
        let date = new Date();
        if (trigger.seconds) {
          date = new Date(Date.now() + trigger.seconds * 1000);
        } else if (trigger.date) {
          date = new Date(trigger.date);
        }

        PushNotification.localNotificationSchedule({
          id: id.toString(),
          channelId: 'reminder-channel',
          title: title,
          message: body,
          date: date,
          allowWhileIdle: true,
          playSound: true,
          soundName: 'default',
          vibrate: true,
          priority: 'high',
          importance: 'high',
          data: data,
        });
      } else {
        // 否则立即显示通知
        PushNotification.localNotification({
          id: id.toString(),
          channelId: 'default-channel',
          title: title,
          message: body,
          playSound: true,
          soundName: 'default',
          vibrate: true,
          priority: 'high',
          importance: 'high',
          data: data,
        });
      }

      analyticsService.trackEvent('notification_scheduled', {
        id,
        title,
        data
      });

      return id;
    } catch (error) {
      console.error('安排通知错误:', error);
      analyticsService.trackError(error, { action: 'schedule_notification' });
      throw error;
    }
  }

  async cancelAllNotifications() {
    try {
      PushNotification.cancelAllLocalNotifications();
      analyticsService.trackEvent('notifications_cancelled_all');
    } catch (error) {
      console.error('取消所有通知错误:', error);
      analyticsService.trackError(error, { action: 'cancel_all_notifications' });
      throw error;
    }
  }

  async cancelNotification(id) {
    try {
      PushNotification.cancelLocalNotification(id.toString());
      analyticsService.trackEvent('notification_cancelled', { id });
    } catch (error) {
      console.error('取消通知错误:', error);
      analyticsService.trackError(error, { action: 'cancel_notification' });
      throw error;
    }
  }

  setupNotificationHandlers(navigation) {
    // 保存导航对象以便在通知处理中使用
    this.navigation = navigation;
  }

  cleanup() {
    // 清除导航对象
    this.navigation = null;
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