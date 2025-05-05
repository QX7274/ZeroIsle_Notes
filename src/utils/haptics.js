/**
 * 触感反馈工具
 * 提供触感反馈功能
 */
import { Platform } from 'react-native';
import { Haptics, ImpactFeedbackStyle, NotificationFeedbackType } from './expoCompatibility';

/**
 * 轻触反馈
 * 用于按钮点击、选择项等轻微交互
 */
export const lightFeedback = () => {
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    Haptics.impactAsync(ImpactFeedbackStyle.Light);
  }
};

/**
 * 中等触感反馈
 * 用于确认操作、切换状态等中等强度交互
 */
export const mediumFeedback = () => {
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    Haptics.impactAsync(ImpactFeedbackStyle.Medium);
  }
};

/**
 * 重触感反馈
 * 用于重要操作、完成任务等强烈交互
 */
export const heavyFeedback = () => {
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    Haptics.impactAsync(ImpactFeedbackStyle.Heavy);
  }
};

/**
 * 成功反馈
 * 用于操作成功、任务完成等场景
 */
export const successFeedback = () => {
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    Haptics.notificationAsync(NotificationFeedbackType.Success);
  }
};

/**
 * 警告反馈
 * 用于警告、需要注意的操作等场景
 */
export const warningFeedback = () => {
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    Haptics.notificationAsync(NotificationFeedbackType.Warning);
  }
};

/**
 * 错误反馈
 * 用于操作失败、错误提示等场景
 */
export const errorFeedback = () => {
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    Haptics.notificationAsync(NotificationFeedbackType.Error);
  }
};

/**
 * 选择反馈
 * 用于选择项目、切换选项等场景
 */
export const selectionFeedback = () => {
  if (Platform.OS === 'ios' || Platform.OS === 'android') {
    Haptics.selectionAsync();
  }
};

export default {
  lightFeedback,
  mediumFeedback,
  heavyFeedback,
  successFeedback,
  warningFeedback,
  errorFeedback,
  selectionFeedback,
};
