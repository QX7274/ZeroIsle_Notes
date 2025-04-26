/**
 * 通知服务
 */
import { Platform } from 'react-native';
import PushNotification from 'react-native-push-notification';
import PushNotificationIOS from '@react-native-community/push-notification-ios';
import { NOTIFICATION_CHANNELS } from '../utils/constants/config';
import { analyticsService } from './analytics';

// 初始化通知
export const initNotifications = () => {
  // 配置通知
  PushNotification.configure({
    // 当注册远程通知时调用
    onRegister: function (token) {
      console.log('TOKEN:', token);
    },
    
    // 当收到远程或本地通知时调用
    onNotification: function (notification) {
      console.log('NOTIFICATION:', notification);
      
      // 处理通知点击
      if (notification.userInteraction) {
        handleNotificationOpen(notification);
      }
      
      // 在iOS上需要调用此方法完成通知处理
      notification.finish(PushNotificationIOS.FetchResult.NoData);
    },
    
    // 当权限发生变化时调用
    onRegistrationError: function(err) {
      console.error(err.message, err);
      analyticsService.trackError(err, { operation: 'notification_registration' });
    },
    
    // 是否应该在前台显示通知
    popInitialNotification: true,
    
    // 请求权限
    requestPermissions: false,
  });
  
  // 创建通知渠道（仅Android）
  if (Platform.OS === 'android') {
    createNotificationChannels();
  }
};

// 创建通知渠道（仅Android）
const createNotificationChannels = () => {
  // 提醒通知渠道
  PushNotification.createChannel(
    {
      channelId: NOTIFICATION_CHANNELS.REMINDER,
      channelName: '提醒通知',
      channelDescription: '笔记提醒和待办事项通知',
      playSound: true,
      soundName: 'default',
      importance: 4, // HIGH
      vibrate: true,
    },
    (created) => console.log(`创建渠道 ${NOTIFICATION_CHANNELS.REMINDER}: ${created}`)
  );
  
  // 同步通知渠道
  PushNotification.createChannel(
    {
      channelId: NOTIFICATION_CHANNELS.SYNC,
      channelName: '同步通知',
      channelDescription: '数据同步状态通知',
      playSound: false,
      importance: 3, // DEFAULT
      vibrate: false,
    },
    (created) => console.log(`创建渠道 ${NOTIFICATION_CHANNELS.SYNC}: ${created}`)
  );
  
  // 社区通知渠道
  PushNotification.createChannel(
    {
      channelId: NOTIFICATION_CHANNELS.COMMUNITY,
      channelName: '社区通知',
      channelDescription: '评论、回复和点赞通知',
      playSound: true,
      soundName: 'default',
      importance: 3, // DEFAULT
      vibrate: true,
    },
    (created) => console.log(`创建渠道 ${NOTIFICATION_CHANNELS.COMMUNITY}: ${created}`)
  );
  
  // 更新通知渠道
  PushNotification.createChannel(
    {
      channelId: NOTIFICATION_CHANNELS.UPDATE,
      channelName: '更新通知',
      channelDescription: '应用更新和新功能通知',
      playSound: true,
      soundName: 'default',
      importance: 3, // DEFAULT
      vibrate: false,
    },
    (created) => console.log(`创建渠道 ${NOTIFICATION_CHANNELS.UPDATE}: ${created}`)
  );
};

// 请求通知权限
export const requestNotificationPermission = async (request = true) => {
  try {
    if (Platform.OS === 'ios') {
      // iOS权限请求
      if (request) {
        const permission = await PushNotificationIOS.requestPermissions({
          alert: true,
          badge: true,
          sound: true,
        });
        return permission.alert;
      } else {
        const settings = await PushNotificationIOS.checkPermissions();
        return settings.alert;
      }
    } else {
      // Android权限检查
      return true; // Android默认授予通知权限
    }
  } catch (error) {
    console.error('请求通知权限失败:', error);
    analyticsService.trackError(error, { operation: 'request_notification_permission' });
    return false;
  }
};

// 处理通知点击
const handleNotificationOpen = (notification) => {
  try {
    const { data } = notification;
    
    // 记录分析事件
    analyticsService.trackEvent('notification_opened', {
      type: data?.type || 'unknown',
      id: data?.id,
    });
    
    // 根据通知类型处理
    switch (data?.type) {
      case 'reminder':
        // 处理提醒通知
        // 例如：navigation.navigate('NoteDetail', { id: data.noteId });
        break;
      case 'sync':
        // 处理同步通知
        // 例如：navigation.navigate('OfflineData');
        break;
      case 'community':
        // 处理社区通知
        // 例如：navigation.navigate('PostDetail', { id: data.postId });
        break;
      case 'update':
        // 处理更新通知
        // 例如：navigation.navigate('About');
        break;
      default:
        // 默认处理
        break;
    }
  } catch (error) {
    console.error('处理通知点击失败:', error);
    analyticsService.trackError(error, { operation: 'handle_notification_open' });
  }
};

// 发送本地通知
export const sendLocalNotification = ({
  id,
  title,
  message,
  channelId,
  data = {},
  playSound = true,
  vibrate = true,
  ongoing = false,
  autoCancel = true,
}) => {
  try {
    PushNotification.localNotification({
      id: id.toString(),
      title,
      message,
      channelId,
      data,
      playSound,
      vibrate,
      ongoing,
      autoCancel,
      smallIcon: 'ic_notification',
      largeIcon: '',
    });
    
    // 记录分析事件
    analyticsService.trackEvent('notification_sent', {
      id,
      title,
      channel_id: channelId,
      type: data.type,
    });
    
    return true;
  } catch (error) {
    console.error('发送本地通知失败:', error);
    analyticsService.trackError(error, { operation: 'send_local_notification' });
    return false;
  }
};

// 发送定时通知
export const scheduleNotification = ({
  id,
  title,
  message,
  channelId,
  date,
  data = {},
  playSound = true,
  vibrate = true,
  ongoing = false,
  autoCancel = true,
  repeatType = null, // null, 'minute', 'hour', 'day', 'week', 'month', 'year'
}) => {
  try {
    PushNotification.localNotificationSchedule({
      id: id.toString(),
      title,
      message,
      channelId,
      date: new Date(date),
      data,
      playSound,
      vibrate,
      ongoing,
      autoCancel,
      smallIcon: 'ic_notification',
      largeIcon: '',
      repeatType,
      allowWhileIdle: true, // 允许在低电量模式下显示通知
    });
    
    // 记录分析事件
    analyticsService.trackEvent('notification_scheduled', {
      id,
      title,
      channel_id: channelId,
      type: data.type,
      scheduled_time: date,
      repeat_type: repeatType,
    });
    
    return true;
  } catch (error) {
    console.error('发送定时通知失败:', error);
    analyticsService.trackError(error, { operation: 'schedule_notification' });
    return false;
  }
};

// 取消通知
export const cancelNotification = (id) => {
  try {
    PushNotification.cancelLocalNotification(id.toString());
    return true;
  } catch (error) {
    console.error('取消通知失败:', error);
    analyticsService.trackError(error, { operation: 'cancel_notification' });
    return false;
  }
};

// 取消所有通知
export const cancelAllNotifications = () => {
  try {
    PushNotification.cancelAllLocalNotifications();
    return true;
  } catch (error) {
    console.error('取消所有通知失败:', error);
    analyticsService.trackError(error, { operation: 'cancel_all_notifications' });
    return false;
  }
};

// 获取已发送的通知
export const getScheduledNotifications = async () => {
  return new Promise((resolve, reject) => {
    try {
      PushNotification.getScheduledLocalNotifications(notifications => {
        resolve(notifications);
      });
    } catch (error) {
      console.error('获取已发送的通知失败:', error);
      analyticsService.trackError(error, { operation: 'get_scheduled_notifications' });
      reject(error);
    }
  });
};

// 清除通知徽章（仅iOS）
export const clearBadge = () => {
  if (Platform.OS === 'ios') {
    PushNotificationIOS.setApplicationIconBadgeNumber(0);
  }
};

// 发送提醒通知
export const sendReminderNotification = ({ id, title, message, date, noteId }) => {
  return scheduleNotification({
    id,
    title,
    message,
    channelId: NOTIFICATION_CHANNELS.REMINDER,
    date,
    data: {
      type: 'reminder',
      noteId,
    },
  });
};

// 发送同步通知
export const sendSyncNotification = ({ id, title, message, syncResult }) => {
  return sendLocalNotification({
    id,
    title,
    message,
    channelId: NOTIFICATION_CHANNELS.SYNC,
    data: {
      type: 'sync',
      syncResult,
    },
    playSound: false,
    vibrate: false,
  });
};

// 发送社区通知
export const sendCommunityNotification = ({ id, title, message, postId, commentId, userId }) => {
  return sendLocalNotification({
    id,
    title,
    message,
    channelId: NOTIFICATION_CHANNELS.COMMUNITY,
    data: {
      type: 'community',
      postId,
      commentId,
      userId,
    },
  });
};

// 发送更新通知
export const sendUpdateNotification = ({ id, title, message, version }) => {
  return sendLocalNotification({
    id,
    title,
    message,
    channelId: NOTIFICATION_CHANNELS.UPDATE,
    data: {
      type: 'update',
      version,
    },
  });
};
