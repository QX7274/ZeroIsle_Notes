/**
 * 原生触感反馈模块
 * 提供不依赖Expo的触感反馈功能
 */
import { Platform, Vibration } from 'react-native';

// 触感类型
export const ImpactFeedbackStyle = {
  Light: 'light',
  Medium: 'medium',
  Heavy: 'heavy',
};

export const NotificationFeedbackType = {
  Success: 'success',
  Warning: 'warning',
  Error: 'error',
};

// 触感反馈函数
const nativeHaptics = {
  // 轻触反馈
  impactAsync: (style = ImpactFeedbackStyle.Light) => {
    try {
      // 根据平台和强度选择不同的振动模式
      if (Platform.OS === 'android') {
        switch (style) {
          case ImpactFeedbackStyle.Light:
            Vibration.vibrate(20);
            break;
          case ImpactFeedbackStyle.Medium:
            Vibration.vibrate(40);
            break;
          case ImpactFeedbackStyle.Heavy:
            Vibration.vibrate(60);
            break;
          default:
            Vibration.vibrate(20);
        }
      } else if (Platform.OS === 'ios') {
        // iOS上的振动模式
        // 注意：iOS上的振动API比较有限，无法精确控制强度
        // 在实际应用中，应该使用原生模块提供更精细的控制
        Vibration.vibrate();
      }
      return true;
    } catch (error) {
      console.error('触感反馈错误:', error);
      return false;
    }
  },

  // 通知反馈
  notificationAsync: (type = NotificationFeedbackType.Success) => {
    try {
      // 根据通知类型选择不同的振动模式
      if (Platform.OS === 'android') {
        switch (type) {
          case NotificationFeedbackType.Success:
            Vibration.vibrate([0, 50, 50, 50]);
            break;
          case NotificationFeedbackType.Warning:
            Vibration.vibrate([0, 50, 100, 50]);
            break;
          case NotificationFeedbackType.Error:
            Vibration.vibrate([0, 50, 50, 50, 50, 50]);
            break;
          default:
            Vibration.vibrate([0, 50, 50, 50]);
        }
      } else if (Platform.OS === 'ios') {
        // iOS上的振动模式
        Vibration.vibrate();
      }
      return true;
    } catch (error) {
      console.error('触感反馈错误:', error);
      return false;
    }
  },

  // 选择反馈
  selectionAsync: () => {
    try {
      // 选择反馈通常是一个轻微的振动
      if (Platform.OS === 'android') {
        Vibration.vibrate(10);
      } else if (Platform.OS === 'ios') {
        Vibration.vibrate();
      }
      return true;
    } catch (error) {
      console.error('触感反馈错误:', error);
      return false;
    }
  },

  // 取消振动
  cancelAsync: () => {
    try {
      Vibration.cancel();
      return true;
    } catch (error) {
      console.error('取消振动错误:', error);
      return false;
    }
  },
};

export default nativeHaptics;
