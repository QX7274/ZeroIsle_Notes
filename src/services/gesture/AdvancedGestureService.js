/**
 * ✅ 高级手势处理服务
 * 提供Skia原生触摸处理、手势预测、压力感应支持
 */

import { Platform } from 'react-native';
import { Skia } from '@shopify/react-native-skia';

/**
 * 手势配置
 */
const GESTURE_CONFIG = {
  // 预测配置
  PREDICTION_SAMPLES: 5, // 预测样本数
  PREDICTION_DISTANCE: 20, // 预测距离（像素）
  SMOOTHING_FACTOR: 0.3, // 平滑因子

  // 压力感应配置
  PRESSURE_ENABLED: Platform.OS === 'ios', // iOS支持压力感应
  PRESSURE_SENSITIVITY: 0.5, // 压力敏感度
  MIN_PRESSURE: 0.1, // 最小压力
  MAX_PRESSURE: 1.0, // 最大压力

  // 手势识别配置
  GESTURE_THRESHOLD: 10, // 手势识别阈值
  VELOCITY_THRESHOLD: 100, // 速度阈值
  ACCELERATION_THRESHOLD: 50, // 加速度阈值
};

/**
 * 手势类型枚举
 */
export const GESTURE_TYPE = {
  TAP: 'tap',
  LONG_PRESS: 'long_press',
  PAN: 'pan',
  PINCH: 'pinch',
  ROTATE: 'rotate',
  DRAW: 'draw',
  ERASE: 'erase',
};

/**
 * 触摸点数据结构
 */
export class TouchPoint {
  constructor(x, y, timestamp, pressure = 1.0, force = 1.0) {
    this.x = x;
    this.y = y;
    this.timestamp = timestamp;
    this.pressure = pressure;
    this.force = force;
    this.velocity = { x: 0, y: 0 };
    this.acceleration = { x: 0, y: 0 };
  }

  /**
   * 计算与另一点的距离
   */
  distanceTo(other) {
    const dx = this.x - other.x;
    const dy = this.y - other.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * 计算与另一点的时间差
   */
  timeDeltaTo(other) {
    return this.timestamp - other.timestamp;
  }

  /**
   * 计算速度
   */
  calculateVelocity(previous) {
    const dt = this.timeDeltaTo(previous);
    if (dt > 0) {
      this.velocity.x = (this.x - previous.x) / dt;
      this.velocity.y = (this.y - previous.y) / dt;
    }
    return this.velocity;
  }

  /**
   * 计算加速度
   */
  calculateAcceleration(previous) {
    const dt = this.timeDeltaTo(previous);
    if (dt > 0 && previous.velocity) {
      this.acceleration.x = (this.velocity.x - previous.velocity.x) / dt;
      this.acceleration.y = (this.velocity.y - previous.velocity.y) / dt;
    }
    return this.acceleration;
  }
}

/**
 * 手势预测器
 */
export class GesturePredictor {
  constructor() {
    this.history = [];
    this.maxHistory = GESTURE_CONFIG.PREDICTION_SAMPLES;
  }

  /**
   * 添加触摸点
   */
  addPoint(point) {
    this.history.push(point);

    // 保持历史记录在限制范围内
    if (this.history.length > this.maxHistory) {
      this.history.shift();
    }
  }

  /**
   * 预测下一个点
   */
  predictNextPoint() {
    if (this.history.length < 2) {
      return null;
    }

    const lastPoint = this.history[this.history.length - 1];
    const secondLastPoint = this.history[this.history.length - 2];

    // 计算平均速度
    const avgVelocity = this.calculateAverageVelocity();

    // 预测下一个点
    const predictedX = lastPoint.x + avgVelocity.x * GESTURE_CONFIG.PREDICTION_DISTANCE;
    const predictedY = lastPoint.y + avgVelocity.y * GESTURE_CONFIG.PREDICTION_DISTANCE;
    const predictedTime = lastPoint.timestamp + (GESTURE_CONFIG.PREDICTION_DISTANCE / this.getAverageSpeed());

    return new TouchPoint(predictedX, predictedY, predictedTime, lastPoint.pressure, lastPoint.force);
  }

  /**
   * 计算平均速度
   */
  calculateAverageVelocity() {
    if (this.history.length < 2) {
      return { x: 0, y: 0 };
    }

    let totalVx = 0;
    let totalVy = 0;
    let count = 0;

    for (let i = 1; i < this.history.length; i++) {
      const current = this.history[i];
      const previous = this.history[i - 1];

      const velocity = current.calculateVelocity(previous);
      totalVx += velocity.x;
      totalVy += velocity.y;
      count++;
    }

    return {
      x: count > 0 ? totalVx / count : 0,
      y: count > 0 ? totalVy / count : 0,
    };
  }

  /**
   * 获取平均速度
   */
  getAverageSpeed() {
    const velocity = this.calculateAverageVelocity();
    return Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
  }

  /**
   * 平滑路径
   */
  smoothPath(points) {
    if (points.length < 3) {
      return points;
    }

    const smoothed = [points[0]]; // 保留第一个点

    for (let i = 1; i < points.length - 1; i++) {
      const prev = points[i - 1];
      const current = points[i];
      const next = points[i + 1];

      // 使用三点平滑算法
      const smoothedX = (prev.x + current.x + next.x) / 3;
      const smoothedY = (prev.y + current.y + next.y) / 3;

      smoothed.push(new TouchPoint(
        smoothedX,
        smoothedY,
        current.timestamp,
        current.pressure,
        current.force
      ));
    }

    smoothed.push(points[points.length - 1]); // 保留最后一个点
    return smoothed;
  }
}

/**
 * 压力感应处理器
 */
export class PressureProcessor {
  constructor() {
    this.enabled = GESTURE_CONFIG.PRESSURE_ENABLED;
    this.sensitivity = GESTURE_CONFIG.PRESSURE_SENSITIVITY;
  }

  /**
   * 处理压力数据
   */
  processPressure(rawPressure, rawForce) {
    if (!this.enabled) {
      return 1.0; // 默认压力
    }

    // 标准化压力值
    let normalizedPressure = Math.max(0, Math.min(1, rawPressure || 0));
    let normalizedForce = Math.max(0, Math.min(1, rawForce || 0));

    // 应用敏感度调整
    normalizedPressure = this.applySensitivity(normalizedPressure);
    normalizedForce = this.applySensitivity(normalizedForce);

    // 组合压力和力度
    const combinedPressure = (normalizedPressure + normalizedForce) / 2;

    return Math.max(GESTURE_CONFIG.MIN_PRESSURE, combinedPressure);
  }

  /**
   * 应用敏感度调整
   */
  applySensitivity(value) {
    // 使用指数函数调整敏感度
    return Math.pow(value, 1 / this.sensitivity);
  }

  /**
   * 根据压力调整笔画宽度
   */
  adjustStrokeWidth(baseWidth, pressure) {
    const pressureMultiplier = 0.5 + (pressure * 1.5); // 0.5x 到 2x
    return baseWidth * pressureMultiplier;
  }
}

/**
 * 手势识别器
 */
export class GestureRecognizer {
  constructor() {
    this.currentGesture = null;
    this.gestureStartTime = 0;
    this.gestureStartPoint = null;
    this.gesturePoints = [];
  }

  /**
   * 识别手势类型
   */
  recognizeGesture(points) {
    if (points.length < 2) {
      return GESTURE_TYPE.TAP;
    }

    const firstPoint = points[0];
    const lastPoint = points[points.length - 1];
    const distance = firstPoint.distanceTo(lastPoint);
    const duration = lastPoint.timestamp - firstPoint.timestamp;

    // 计算平均速度
    const avgVelocity = this.calculateAverageVelocity(points);
    const speed = Math.sqrt(avgVelocity.x * avgVelocity.x + avgVelocity.y * avgVelocity.y);

    // 识别手势类型
    if (distance < GESTURE_CONFIG.GESTURE_THRESHOLD) {
      if (duration > 500) {
        return GESTURE_TYPE.LONG_PRESS;
      } else {
        return GESTURE_TYPE.TAP;
      }
    } else if (speed > GESTURE_CONFIG.VELOCITY_THRESHOLD) {
      return GESTURE_TYPE.DRAW;
    } else {
      return GESTURE_TYPE.PAN;
    }
  }

  /**
   * 计算平均速度
   */
  calculateAverageVelocity(points) {
    if (points.length < 2) {
      return { x: 0, y: 0 };
    }

    let totalVx = 0;
    let totalVy = 0;
    let count = 0;

    for (let i = 1; i < points.length; i++) {
      const current = points[i];
      const previous = points[i - 1];

      const velocity = current.calculateVelocity(previous);
      totalVx += velocity.x;
      totalVy += velocity.y;
      count++;
    }

    return {
      x: count > 0 ? totalVx / count : 0,
      y: count > 0 ? totalVy / count : 0,
    };
  }

  /**
   * 检测手势变化
   */
  detectGestureChange(newPoint) {
    if (!this.gestureStartPoint) {
      this.gestureStartPoint = newPoint;
      this.gestureStartTime = newPoint.timestamp;
      this.gesturePoints = [newPoint];
      return null;
    }

    this.gesturePoints.push(newPoint);

    // 检查手势是否发生变化
    const currentGesture = this.recognizeGesture(this.gesturePoints);

    if (this.currentGesture && this.currentGesture !== currentGesture) {
      const changedGesture = currentGesture;
      this.currentGesture = currentGesture;
      return changedGesture;
    }

    this.currentGesture = currentGesture;
    return null;
  }
}

/**
 * 高级手势处理服务
 */
export class AdvancedGestureService {
  constructor() {
    this.predictor = null;
    this.pressureProcessor = null;
    this.recognizer = null;
    this.callbacks = new Map();
    this.isEnabled = true;
    this.initialized = false;
    this.initializationError = null;
    this.retryCount = 0;
    this.maxRetries = 3;

    // 初始化组件
    this.initializeComponents();
  }

  /**
   * 初始化组件
   */
  initializeComponents() {
    try {
      console.log('🔧 [AdvancedGestureService] 开始初始化组件...');

      // 初始化预测器
      this.predictor = new GesturePredictor();
      console.log('✅ [AdvancedGestureService] 预测器初始化成功');

      // 初始化压力处理器
      this.pressureProcessor = new PressureProcessor();
      console.log('✅ [AdvancedGestureService] 压力处理器初始化成功');

      // 初始化手势识别器
      this.recognizer = new GestureRecognizer();
      console.log('✅ [AdvancedGestureService] 手势识别器初始化成功');

      this.initialized = true;
      this.initializationError = null;
      this.retryCount = 0;

      console.log('✅ [AdvancedGestureService] 所有组件初始化成功');
    } catch (error) {
      console.error('❌ [AdvancedGestureService] 组件初始化失败:', error);
      this.initializationError = error;
      this.initialized = false;

      // 自动重试
      this.retryInitialization();
    }
  }

  /**
   * 自动重试初始化
   */
  retryInitialization() {
    if (this.retryCount < this.maxRetries) {
      this.retryCount++;
      console.log(`🔄 [AdvancedGestureService] 尝试重新初始化 (${this.retryCount}/${this.maxRetries})...`);

      setTimeout(() => {
        this.initializeComponents();
      }, 1000 * this.retryCount); // 递增延迟
    } else {
      console.error('❌ [AdvancedGestureService] 达到最大重试次数，初始化失败');
    }
  }

  /**
   * 检查服务是否已初始化
   */
  isInitialized() {
    return this.initialized &&
           this.predictor !== null &&
           this.pressureProcessor !== null &&
           this.recognizer !== null;
  }

  /**
   * 检查组件健康状态
   */
  checkComponentHealth() {
    const health = {
      predictor: this.predictor !== null,
      pressureProcessor: this.pressureProcessor !== null,
      recognizer: this.recognizer !== null,
      overall: this.isInitialized(),
    };

    if (__DEV__) {
      console.log('🔍 [AdvancedGestureService] 组件健康检查:', health);
    }

    return health;
  }

  /**
   * 获取初始化错误信息
   */
  getInitializationError() {
    return this.initializationError;
  }

  /**
   * 手动重新初始化
   */
  async reinitialize() {
    console.log('🔄 [AdvancedGestureService] 手动重新初始化...');
    this.initialized = false;
    this.initializationError = null;
    this.retryCount = 0;
    this.initializeComponents();
  }

  /**
   * 处理触摸开始
   */
  handleTouchStart(x, y, timestamp, pressure = 1.0, force = 1.0) {
    if (!this.isEnabled) {return;}

    // 检查服务健康状态
    if (!this.isInitialized()) {
      console.warn('⚠️ [AdvancedGestureService] 服务未初始化，跳过触摸处理');
      return;
    }

    try {
      // 处理压力数据
      const processedPressure = this.pressureProcessor.processPressure(pressure, force);

      // 创建触摸点
      const touchPoint = new TouchPoint(x, y, timestamp, processedPressure, force);

      // 添加到预测器
      this.predictor.addPoint(touchPoint);

      // 识别手势
      const gestureType = this.recognizer.detectGestureChange(touchPoint);

      // 调用回调
      this.callCallbacks('touchStart', {
        point: touchPoint,
        gestureType,
        pressure: processedPressure,
      });
    } catch (error) {
      console.error('❌ [AdvancedGestureService] 触摸开始处理失败:', error);
      // 尝试重新初始化
      this.reinitialize();
    }
  }

  /**
   * 处理触摸移动
   */
  handleTouchMove(x, y, timestamp, pressure = 1.0, force = 1.0) {
    if (!this.isEnabled) {return;}

    // 检查服务健康状态
    if (!this.isInitialized()) {
      console.warn('⚠️ [AdvancedGestureService] 服务未初始化，跳过触摸处理');
      return;
    }

    try {
      // 处理压力数据
      const processedPressure = this.pressureProcessor.processPressure(pressure, force);

      // 创建触摸点
      const touchPoint = new TouchPoint(x, y, timestamp, processedPressure, force);

      // 添加到预测器
      this.predictor.addPoint(touchPoint);

      // 预测下一个点
      const predictedPoint = this.predictor.predictNextPoint();

      // 识别手势变化
      const gestureChange = this.recognizer.detectGestureChange(touchPoint);

      // 调用回调
      this.callCallbacks('touchMove', {
        point: touchPoint,
        predictedPoint,
        gestureChange,
        pressure: processedPressure,
      });
    } catch (error) {
      console.error('❌ [AdvancedGestureService] 触摸移动处理失败:', error);
      // 尝试重新初始化
      this.reinitialize();
    }
  }

  /**
   * 处理触摸结束
   */
  handleTouchEnd(x, y, timestamp, pressure = 1.0, force = 1.0) {
    if (!this.isEnabled) {return;}

    // 检查服务健康状态
    if (!this.isInitialized()) {
      console.warn('⚠️ [AdvancedGestureService] 服务未初始化，跳过触摸处理');
      return;
    }

    try {
      // 处理压力数据
      const processedPressure = this.pressureProcessor.processPressure(pressure, force);

      // 创建触摸点
      const touchPoint = new TouchPoint(x, y, timestamp, processedPressure, force);

      // 平滑路径
      const smoothedPoints = this.predictor.smoothPath(this.recognizer.gesturePoints);

      // 识别最终手势
      const finalGesture = this.recognizer.recognizeGesture(smoothedPoints);

      // 调用回调
      this.callCallbacks('touchEnd', {
        point: touchPoint,
        smoothedPoints,
        finalGesture,
        pressure: processedPressure,
      });

      // 重置状态
      this.reset();
    } catch (error) {
      console.error('❌ [AdvancedGestureService] 触摸结束处理失败:', error);
      // 尝试重新初始化
      this.reinitialize();
    }
  }

  /**
   * 注册回调
   */
  registerCallback(event, callback) {
    if (!this.callbacks.has(event)) {
      this.callbacks.set(event, []);
    }
    this.callbacks.get(event).push(callback);
  }

  /**
   * 取消注册回调
   */
  unregisterCallback(event, callback) {
    if (this.callbacks.has(event)) {
      const callbacks = this.callbacks.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }

  /**
   * 调用回调
   */
  callCallbacks(event, data) {
    if (this.callbacks.has(event)) {
      this.callbacks.get(event).forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`手势回调错误 (${event}):`, error);
        }
      });
    }
  }

  /**
   * 重置状态
   */
  reset() {
    this.recognizer.currentGesture = null;
    this.recognizer.gestureStartTime = 0;
    this.recognizer.gestureStartPoint = null;
    this.recognizer.gesturePoints = [];
    this.predictor.history = [];
  }

  /**
   * 启用/禁用服务
   */
  setEnabled(enabled) {
    this.isEnabled = enabled;
  }

  /**
   * 获取当前状态
   */
  getStatus() {
    return {
      enabled: this.isEnabled,
      initialized: this.initialized,
      historyLength: this.predictor ? this.predictor.history.length : 0,
      currentGesture: this.recognizer ? this.recognizer.currentGesture : null,
      pressureEnabled: this.pressureProcessor ? this.pressureProcessor.enabled : false,
      health: this.checkComponentHealth(),
      error: this.initializationError,
      retryCount: this.retryCount,
    };
  }

  /**
   * 销毁服务
   */
  destroy() {
    this.callbacks.clear();
    this.reset();
  }
}

// 创建全局高级手势服务实例
const advancedGestureService = new AdvancedGestureService();

module.exports = advancedGestureService;
module.exports.default = advancedGestureService;
module.exports.advancedGestureService = advancedGestureService;
module.exports.AdvancedGestureService = AdvancedGestureService;

export default AdvancedGestureService;
