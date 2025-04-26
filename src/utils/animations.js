/**
 * 动画工具类
 * 提供常用的动画效果
 */
import { Animated, Easing } from 'react-native';

/**
 * 淡入动画
 * @param {Animated.Value} value - 动画值
 * @param {number} toValue - 目标值
 * @param {number} duration - 动画持续时间
 * @param {function} callback - 动画完成回调
 * @returns {Animated.CompositeAnimation} - 动画对象
 */
export const fadeIn = (value, toValue = 1, duration = 300, callback) => {
  return Animated.timing(value, {
    toValue,
    duration,
    easing: Easing.ease,
    useNativeDriver: true,
    isInteraction: false,
  }).start(callback);
};

/**
 * 淡出动画
 * @param {Animated.Value} value - 动画值
 * @param {number} toValue - 目标值
 * @param {number} duration - 动画持续时间
 * @param {function} callback - 动画完成回调
 * @returns {Animated.CompositeAnimation} - 动画对象
 */
export const fadeOut = (value, toValue = 0, duration = 300, callback) => {
  return Animated.timing(value, {
    toValue,
    duration,
    easing: Easing.ease,
    useNativeDriver: true,
    isInteraction: false,
  }).start(callback);
};

/**
 * 滑入动画
 * @param {Animated.Value} value - 动画值
 * @param {number} fromValue - 起始值
 * @param {number} toValue - 目标值
 * @param {number} duration - 动画持续时间
 * @param {function} callback - 动画完成回调
 * @returns {Animated.CompositeAnimation} - 动画对象
 */
export const slideIn = (value, fromValue, toValue = 0, duration = 300, callback) => {
  value.setValue(fromValue);
  return Animated.timing(value, {
    toValue,
    duration,
    easing: Easing.out(Easing.cubic),
    useNativeDriver: true,
    isInteraction: false,
  }).start(callback);
};

/**
 * 滑出动画
 * @param {Animated.Value} value - 动画值
 * @param {number} toValue - 目标值
 * @param {number} duration - 动画持续时间
 * @param {function} callback - 动画完成回调
 * @returns {Animated.CompositeAnimation} - 动画对象
 */
export const slideOut = (value, toValue, duration = 300, callback) => {
  return Animated.timing(value, {
    toValue,
    duration,
    easing: Easing.out(Easing.cubic),
    useNativeDriver: true,
    isInteraction: false,
  }).start(callback);
};

/**
 * 缩放动画
 * @param {Animated.Value} value - 动画值
 * @param {number} toValue - 目标值
 * @param {number} duration - 动画持续时间
 * @param {function} callback - 动画完成回调
 * @returns {Animated.CompositeAnimation} - 动画对象
 */
export const scale = (value, toValue, duration = 300, callback) => {
  return Animated.timing(value, {
    toValue,
    duration,
    easing: Easing.elastic(1),
    useNativeDriver: true,
    isInteraction: false,
  }).start(callback);
};

/**
 * 弹跳动画
 * @param {Animated.Value} value - 动画值
 * @param {number} toValue - 目标值
 * @param {number} duration - 动画持续时间
 * @param {function} callback - 动画完成回调
 * @returns {Animated.CompositeAnimation} - 动画对象
 */
export const bounce = (value, toValue = 1, duration = 800, callback) => {
  return Animated.spring(value, {
    toValue,
    friction: 3,
    tension: 40,
    useNativeDriver: true,
    isInteraction: false,
  }).start(callback);
};

/**
 * 脉冲动画
 * @param {Animated.Value} value - 动画值
 * @param {number} minValue - 最小值
 * @param {number} maxValue - 最大值
 * @param {number} duration - 动画持续时间
 * @returns {Animated.CompositeAnimation} - 动画对象
 */
export const pulse = (value, minValue = 0.97, maxValue = 1.03, duration = 1000) => {
  value.setValue(minValue);
  Animated.loop(
    Animated.sequence([
      Animated.timing(value, {
        toValue: maxValue,
        duration: duration / 2,
        easing: Easing.ease,
        useNativeDriver: true,
        isInteraction: false,
      }),
      Animated.timing(value, {
        toValue: minValue,
        duration: duration / 2,
        easing: Easing.ease,
        useNativeDriver: true,
        isInteraction: false,
      }),
    ])
  ).start();
};

/**
 * 摇晃动画
 * @param {Animated.Value} value - 动画值
 * @param {number} intensity - 摇晃强度
 * @param {number} duration - 动画持续时间
 * @param {function} callback - 动画完成回调
 * @returns {Animated.CompositeAnimation} - 动画对象
 */
export const shake = (value, intensity = 10, duration = 500, callback) => {
  value.setValue(0);
  Animated.sequence([
    Animated.timing(value, {
      toValue: intensity,
      duration: duration / 5,
      useNativeDriver: true,
      isInteraction: false,
    }),
    Animated.timing(value, {
      toValue: -intensity,
      duration: duration / 5,
      useNativeDriver: true,
      isInteraction: false,
    }),
    Animated.timing(value, {
      toValue: intensity / 2,
      duration: duration / 5,
      useNativeDriver: true,
      isInteraction: false,
    }),
    Animated.timing(value, {
      toValue: -intensity / 2,
      duration: duration / 5,
      useNativeDriver: true,
      isInteraction: false,
    }),
    Animated.timing(value, {
      toValue: 0,
      duration: duration / 5,
      useNativeDriver: true,
      isInteraction: false,
    }),
  ]).start(callback);
};

/**
 * 顺序动画
 * @param {Array<Animated.Value>} values - 动画值数组
 * @param {number} toValue - 目标值
 * @param {number} duration - 每个动画持续时间
 * @param {number} delay - 每个动画之间的延迟
 * @param {function} callback - 动画完成回调
 * @returns {Animated.CompositeAnimation} - 动画对象
 */
export const stagger = (values, toValue, duration = 300, delay = 100, callback) => {
  return Animated.stagger(
    delay,
    values.map((value) =>
      Animated.timing(value, {
        toValue,
        duration,
        easing: Easing.ease,
        useNativeDriver: true,
        isInteraction: false,
      })
    )
  ).start(callback);
};

/**
 * 创建动画值
 * @param {number} initialValue - 初始值
 * @returns {Animated.Value} - 动画值
 */
export const createAnimatedValue = (initialValue = 0) => {
  return new Animated.Value(initialValue);
};

/**
 * 创建动画值数组
 * @param {number} count - 数组长度
 * @param {number} initialValue - 初始值
 * @returns {Array<Animated.Value>} - 动画值数组
 */
export const createAnimatedValueArray = (count, initialValue = 0) => {
  return Array(count)
    .fill(0)
    .map(() => new Animated.Value(initialValue));
};

/**
 * 创建插值动画
 * @param {Animated.Value} value - 动画值
 * @param {Array<number>} inputRange - 输入范围
 * @param {Array<number|string>} outputRange - 输出范围
 * @returns {Animated.AnimatedInterpolation} - 插值动画
 */
export const interpolate = (value, inputRange, outputRange) => {
  return value.interpolate({
    inputRange,
    outputRange,
    extrapolate: 'clamp',
  });
};

export default {
  fadeIn,
  fadeOut,
  slideIn,
  slideOut,
  scale,
  bounce,
  pulse,
  shake,
  stagger,
  createAnimatedValue,
  createAnimatedValueArray,
  interpolate,
};
