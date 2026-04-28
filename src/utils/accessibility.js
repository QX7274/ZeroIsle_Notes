/**
 * 可访问性工具
 * 提供可访问性相关的工具函数
 */
import { AccessibilityInfo, Platform } from 'react-native';

/**
 * 检查屏幕阅读器是否启用
 * @returns {Promise<boolean>} - 屏幕阅读器是否启用
 */
export const isScreenReaderEnabled = async () => {
  return await AccessibilityInfo.isScreenReaderEnabled();
};

/**
 * 添加屏幕阅读器状态变化监听器
 * @param {function} listener - 监听器函数
 * @returns {function} - 移除监听器的函数
 */
export const addScreenReaderListener = (listener) => {
  const subscription = AccessibilityInfo.addEventListener(
    'screenReaderChanged',
    listener
  );

  return () => {
    subscription.remove();
  };
};

/**
 * 检查减少动画是否启用
 * @returns {Promise<boolean>} - 减少动画是否启用
 */
export const isReduceMotionEnabled = async () => {
  return await AccessibilityInfo.isReduceMotionEnabled();
};

/**
 * 添加减少动画状态变化监听器
 * @param {function} listener - 监听器函数
 * @returns {function} - 移除监听器的函数
 */
export const addReduceMotionListener = (listener) => {
  const subscription = AccessibilityInfo.addEventListener(
    'reduceMotionChanged',
    listener
  );

  return () => {
    subscription.remove();
  };
};

/**
 * 检查是否启用了高对比度
 * @returns {Promise<boolean>} - 高对比度是否启用
 */
export const isHighContrastEnabled = async () => {
  if (Platform.OS === 'ios') {
    return await AccessibilityInfo.isHighContrastEnabled();
  }
  return false;
};

/**
 * 添加高对比度状态变化监听器
 * @param {function} listener - 监听器函数
 * @returns {function} - 移除监听器的函数
 */
export const addHighContrastListener = (listener) => {
  if (Platform.OS === 'ios') {
    const subscription = AccessibilityInfo.addEventListener(
      'highContrastChanged',
      listener
    );

    return () => {
      subscription.remove();
    };
  }

  return () => {};
};

/**
 * 检查是否启用了放大功能
 * @returns {Promise<boolean>} - 放大功能是否启用
 */
export const isBoldTextEnabled = async () => {
  if (Platform.OS === 'ios') {
    return await AccessibilityInfo.isBoldTextEnabled();
  }
  return false;
};

/**
 * 添加放大功能状态变化监听器
 * @param {function} listener - 监听器函数
 * @returns {function} - 移除监听器的函数
 */
export const addBoldTextListener = (listener) => {
  if (Platform.OS === 'ios') {
    const subscription = AccessibilityInfo.addEventListener(
      'boldTextChanged',
      listener
    );

    return () => {
      subscription.remove();
    };
  }

  return () => {};
};

/**
 * 检查是否启用了灰度模式
 * @returns {Promise<boolean>} - 灰度模式是否启用
 */
export const isGrayscaleEnabled = async () => {
  if (Platform.OS === 'ios') {
    return await AccessibilityInfo.isGrayscaleEnabled();
  }
  return false;
};

/**
 * 添加灰度模式状态变化监听器
 * @param {function} listener - 监听器函数
 * @returns {function} - 移除监听器的函数
 */
export const addGrayscaleListener = (listener) => {
  if (Platform.OS === 'ios') {
    const subscription = AccessibilityInfo.addEventListener(
      'grayscaleChanged',
      listener
    );

    return () => {
      subscription.remove();
    };
  }

  return () => {};
};

/**
 * 检查是否启用了反转颜色
 * @returns {Promise<boolean>} - 反转颜色是否启用
 */
export const isInvertColorsEnabled = async () => {
  if (Platform.OS === 'ios') {
    return await AccessibilityInfo.isInvertColorsEnabled();
  }
  return false;
};

/**
 * 添加反转颜色状态变化监听器
 * @param {function} listener - 监听器函数
 * @returns {function} - 移除监听器的函数
 */
export const addInvertColorsListener = (listener) => {
  if (Platform.OS === 'ios') {
    const subscription = AccessibilityInfo.addEventListener(
      'invertColorsChanged',
      listener
    );

    return () => {
      subscription.remove();
    };
  }

  return () => {};
};

/**
 * 获取可访问性标签属性
 * @param {string} label - 可访问性标签
 * @param {string} hint - 可访问性提示
 * @param {boolean} isButton - 是否为按钮
 * @param {boolean} isSelected - 是否被选中
 * @param {boolean} isDisabled - 是否被禁用
 * @returns {object} - 可访问性属性
 */
export const getAccessibilityProps = (
  label,
  hint = '',
  isButton = false,
  isSelected = false,
  isDisabled = false
) => {
  if (Platform.OS === 'ios') {
    return {
      accessible: true,
      accessibilityLabel: label,
      accessibilityHint: hint,
      accessibilityRole: isButton ? 'button' : undefined,
      accessibilityState: {
        selected: isSelected,
        disabled: isDisabled,
      },
    };
  }

  return {
    accessible: true,
    accessibilityLabel: label,
    accessibilityHint: hint,
    accessibilityRole: isButton ? 'button' : undefined,
    accessibilityState: {
      selected: isSelected,
      disabled: isDisabled,
    },
  };
};

/**
 * 宣告屏幕阅读器消息
 * @param {string} message - 消息内容
 */
export const announceForAccessibility = (message) => {
  AccessibilityInfo.announceForAccessibility(message);
};

export default {
  isScreenReaderEnabled,
  addScreenReaderListener,
  isReduceMotionEnabled,
  addReduceMotionListener,
  isHighContrastEnabled,
  addHighContrastListener,
  isBoldTextEnabled,
  addBoldTextListener,
  isGrayscaleEnabled,
  addGrayscaleListener,
  isInvertColorsEnabled,
  addInvertColorsListener,
  getAccessibilityProps,
  announceForAccessibility,
};
