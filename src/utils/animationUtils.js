/**
 * 动画工具函数
 * 用于在React Native中创建各种动画效果
 */

import { Animated, Easing } from 'react-native';

/**
 * 创建淡入动画
 * @param {Animated.Value} value - 动画值
 * @param {number} duration - 动画持续时间，默认300ms
 * @param {function} callback - 动画完成回调
 * @returns {Animated.CompositeAnimation} - 动画对象
 */
export const fadeIn = (value, duration = 300, callback) => {
  return Animated.timing(value, {
    toValue: 1,
    duration,
    useNativeDriver: true,
    easing: Easing.ease,
    onComplete: callback,
  });
};

/**
 * 创建淡出动画
 * @param {Animated.Value} value - 动画值
 * @param {number} duration - 动画持续时间，默认300ms
 * @param {function} callback - 动画完成回调
 * @returns {Animated.CompositeAnimation} - 动画对象
 */
export const fadeOut = (value, duration = 300, callback) => {
  return Animated.timing(value, {
    toValue: 0,
    duration,
    useNativeDriver: true,
    easing: Easing.ease,
    onComplete: callback,
  });
};

/**
 * 创建缩放动画
 * @param {Animated.Value} value - 动画值
 * @param {number} toValue - 目标值
 * @param {number} duration - 动画持续时间，默认300ms
 * @param {function} callback - 动画完成回调
 * @returns {Animated.CompositeAnimation} - 动画对象
 */
export const scale = (value, toValue, duration = 300, callback) => {
  return Animated.timing(value, {
    toValue,
    duration,
    useNativeDriver: true,
    easing: Easing.ease,
    onComplete: callback,
  });
};

/**
 * 创建弹性缩放动画
 * @param {Animated.Value} value - 动画值
 * @param {number} toValue - 目标值
 * @param {number} friction - 摩擦力，默认7
 * @param {number} tension - 张力，默认40
 * @param {function} callback - 动画完成回调
 * @returns {Animated.CompositeAnimation} - 动画对象
 */
export const springScale = (value, toValue, friction = 7, tension = 40, callback) => {
  return Animated.spring(value, {
    toValue,
    friction,
    tension,
    useNativeDriver: true,
    onComplete: callback,
  });
};

/**
 * 创建平移动画
 * @param {Animated.Value} value - 动画值
 * @param {number} toValue - 目标值
 * @param {number} duration - 动画持续时间，默认300ms
 * @param {function} callback - 动画完成回调
 * @returns {Animated.CompositeAnimation} - 动画对象
 */
export const translate = (value, toValue, duration = 300, callback) => {
  return Animated.timing(value, {
    toValue,
    duration,
    useNativeDriver: true,
    easing: Easing.ease,
    onComplete: callback,
  });
};

/**
 * 创建弹性平移动画
 * @param {Animated.Value} value - 动画值
 * @param {number} toValue - 目标值
 * @param {number} friction - 摩擦力，默认7
 * @param {number} tension - 张力，默认40
 * @param {function} callback - 动画完成回调
 * @returns {Animated.CompositeAnimation} - 动画对象
 */
export const springTranslate = (value, toValue, friction = 7, tension = 40, callback) => {
  return Animated.spring(value, {
    toValue,
    friction,
    tension,
    useNativeDriver: true,
    onComplete: callback,
  });
};

/**
 * 创建旋转动画
 * @param {Animated.Value} value - 动画值
 * @param {number} toValue - 目标值
 * @param {number} duration - 动画持续时间，默认300ms
 * @param {function} callback - 动画完成回调
 * @returns {Animated.CompositeAnimation} - 动画对象
 */
export const rotate = (value, toValue, duration = 300, callback) => {
  return Animated.timing(value, {
    toValue,
    duration,
    useNativeDriver: true,
    easing: Easing.ease,
    onComplete: callback,
  });
};

/**
 * 创建循环动画
 * @param {Animated.Value} value - 动画值
 * @param {Object} config - 动画配置
 * @returns {Animated.CompositeAnimation} - 动画对象
 */
export const loop = (value, config = {}) => {
  const { 
    toValue = 1, 
    duration = 1000, 
    easing = Easing.linear,
    iterations = -1 
  } = config;
  
  return Animated.loop(
    Animated.timing(value, {
      toValue,
      duration,
      easing,
      useNativeDriver: true,
    }),
    { iterations }
  );
};

/**
 * 创建序列动画
 * @param {Array} animations - 动画数组
 * @returns {Animated.CompositeAnimation} - 动画对象
 */
export const sequence = (animations) => {
  return Animated.sequence(animations);
};

/**
 * 创建并行动画
 * @param {Array} animations - 动画数组
 * @returns {Animated.CompositeAnimation} - 动画对象
 */
export const parallel = (animations) => {
  return Animated.parallel(animations);
};

/**
 * 创建交错动画
 * @param {Array} animations - 动画数组
 * @param {number} delay - 动画间隔时间，默认100ms
 * @returns {Animated.CompositeAnimation} - 动画对象
 */
export const stagger = (animations, delay = 100) => {
  return Animated.stagger(delay, animations);
};

/**
 * 创建弹跳动画
 * @param {Animated.Value} value - 动画值
 * @param {Object} config - 动画配置
 * @returns {Animated.CompositeAnimation} - 动画对象
 */
export const bounce = (value, config = {}) => {
  const { 
    fromValue = 0,
    toValue = 1,
    duration = 300,
    iterations = 1
  } = config;
  
  value.setValue(fromValue);
  
  const animation = Animated.sequence([
    Animated.spring(value, {
      toValue: toValue * 1.2,
      friction: 5,
      tension: 40,
      useNativeDriver: true,
    }),
    Animated.spring(value, {
      toValue,
      friction: 5,
      tension: 40,
      useNativeDriver: true,
    }),
  ]);
  
  if (iterations === -1) {
    return Animated.loop(animation);
  } else if (iterations > 1) {
    return Animated.sequence(Array(iterations).fill(animation));
  }
  
  return animation;
};

/**
 * 创建脉动动画
 * @param {Animated.Value} value - 动画值
 * @param {Object} config - 动画配置
 * @returns {Animated.CompositeAnimation} - 动画对象
 */
export const pulse = (value, config = {}) => {
  const { 
    minValue = 0.8,
    maxValue = 1.2,
    duration = 1000,
    iterations = -1
  } = config;
  
  value.setValue(1);
  
  const animation = Animated.sequence([
    Animated.timing(value, {
      toValue: maxValue,
      duration: duration / 2,
      useNativeDriver: true,
      easing: Easing.ease,
    }),
    Animated.timing(value, {
      toValue: minValue,
      duration: duration / 2,
      useNativeDriver: true,
      easing: Easing.ease,
    }),
  ]);
  
  if (iterations === -1) {
    return Animated.loop(animation);
  } else if (iterations > 1) {
    return Animated.sequence(Array(iterations).fill(animation));
  }
  
  return animation;
};

export default {
  fadeIn,
  fadeOut,
  scale,
  springScale,
  translate,
  springTranslate,
  rotate,
  loop,
  sequence,
  parallel,
  stagger,
  bounce,
  pulse,
};
