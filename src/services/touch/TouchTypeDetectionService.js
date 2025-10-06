/**
 * 触摸类型检测服务
 * 提供手指和手写笔触摸类型识别功能
 */

import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const { TouchTypeDetection } = NativeModules;

// 触摸类型常量
export const TOUCH_TYPES = {
  FINGER: 'finger',
  STYLUS: 'stylus',
  UNKNOWN: 'unknown'
};

// 事件名称
export const EVENTS = {
  TOUCH_TYPE_DETECTED: 'TouchTypeDetected'
};

class TouchTypeDetectionService {
  constructor() {
    this.eventEmitter = null;
    this.listeners = new Map();
    this.isListening = false;
    
    if (TouchTypeDetection) {
      this.eventEmitter = new NativeEventEmitter(TouchTypeDetection);
      this.constants = TouchTypeDetection.getConstants ? TouchTypeDetection.getConstants() : {};
    }
  }

  /**
   * 检查服务是否可用
   */
  isAvailable() {
    return TouchTypeDetection !== null && TouchTypeDetection !== undefined;
  }

  /**
   * 开始监听触摸类型检测事件
   */
  async startListening() {
    if (!this.isAvailable()) {
      throw new Error('TouchTypeDetection module is not available');
    }

    try {
      await TouchTypeDetection.startListening();
      this.isListening = true;
      console.log('TouchTypeDetectionService: 开始监听触摸类型');
      return true;
    } catch (error) {
      console.error('TouchTypeDetectionService: 启动监听失败', error);
      throw error;
    }
  }

  /**
   * 停止监听触摸类型检测事件
   */
  async stopListening() {
    if (!this.isAvailable()) {
      return false;
    }

    try {
      await TouchTypeDetection.stopListening();
      this.isListening = false;
      
      // 移除所有事件监听器
      this.listeners.forEach((listener, eventName) => {
        if (this.eventEmitter) {
          listener.remove();
        }
      });
      this.listeners.clear();
      
      console.log('TouchTypeDetectionService: 停止监听触摸类型');
      return true;
    } catch (error) {
      console.error('TouchTypeDetectionService: 停止监听失败', error);
      throw error;
    }
  }

  /**
   * 添加触摸类型检测事件监听器
   */
  addEventListener(eventName, callback) {
    if (!this.isAvailable() || !this.eventEmitter) {
      console.warn('TouchTypeDetectionService: 事件监听器不可用');
      return null;
    }

    const listener = this.eventEmitter.addListener(eventName, callback);
    this.listeners.set(eventName, listener);
    
    console.log(`TouchTypeDetectionService: 添加事件监听器 ${eventName}`);
    return listener;
  }

  /**
   * 移除触摸类型检测事件监听器
   */
  removeEventListener(eventName) {
    const listener = this.listeners.get(eventName);
    if (listener) {
      listener.remove();
      this.listeners.delete(eventName);
      console.log(`TouchTypeDetectionService: 移除事件监听器 ${eventName}`);
    }
  }

  /**
   * 检测单个触摸点的类型
   */
  async detectTouchType(touchData) {
    if (!this.isAvailable()) {
      throw new Error('TouchTypeDetection module is not available');
    }

    try {
      const { x, y, pressure, size, toolType } = touchData;
      
      if (Platform.OS === 'android') {
        return await TouchTypeDetection.detectTouchType(x, y, pressure, size, toolType);
      } else if (Platform.OS === 'ios') {
        const { force, radius, touchType } = touchData;
        return await TouchTypeDetection.detectTouchType(x, y, force, radius, touchType);
      }
      
      throw new Error('Unsupported platform');
    } catch (error) {
      console.error('TouchTypeDetectionService: 检测触摸类型失败', error);
      throw error;
    }
  }

  /**
   * 批量检测多个触摸点的类型
   */
  async detectMultiTouchTypes(touchPoints) {
    if (!this.isAvailable()) {
      throw new Error('TouchTypeDetection module is not available');
    }

    try {
      return await TouchTypeDetection.detectMultiTouchTypes(touchPoints);
    } catch (error) {
      console.error('TouchTypeDetectionService: 批量检测触摸类型失败', error);
      throw error;
    }
  }

  /**
   * 获取设备支持的触摸类型
   */
  async getSupportedTouchTypes() {
    if (!this.isAvailable()) {
      return {
        supportedTypes: [TOUCH_TYPES.FINGER],
        hasStylus: false,
        hasPressure: false,
        hasSize: false
      };
    }

    try {
      return await TouchTypeDetection.getSupportedTouchTypes();
    } catch (error) {
      console.error('TouchTypeDetectionService: 获取支持的触摸类型失败', error);
      return {
        supportedTypes: [TOUCH_TYPES.FINGER],
        hasStylus: false,
        hasPressure: false,
        hasSize: false
      };
    }
  }

  /**
   * 从React Native触摸事件中提取触摸数据
   */
  extractTouchDataFromEvent(event, touchIndex = 0) {
    const touch = event.nativeEvent.touches[touchIndex] || event.nativeEvent;
    
    if (Platform.OS === 'android') {
      return {
        x: touch.pageX || touch.locationX || 0,
        y: touch.pageY || touch.locationY || 0,
        pressure: touch.force || 0,
        size: touch.majorRadius || 0,
        toolType: touch.toolType || 0
      };
    } else if (Platform.OS === 'ios') {
      return {
        x: touch.pageX || touch.locationX || 0,
        y: touch.pageY || touch.locationY || 0,
        force: touch.force || 0,
        radius: touch.majorRadius || 0,
        touchType: touch.touchType || 0
      };
    }
    
    return {
      x: touch.pageX || touch.locationX || 0,
      y: touch.pageY || touch.locationY || 0,
      pressure: 0,
      size: 0,
      toolType: 0
    };
  }

  /**
   * 简化的触摸类型检测（从React Native事件）
   */
  async detectTouchTypeFromEvent(event, touchIndex = 0) {
    try {
      const touchData = this.extractTouchDataFromEvent(event, touchIndex);
      return await this.detectTouchType(touchData);
    } catch (error) {
      console.error('TouchTypeDetectionService: 从事件检测触摸类型失败', error);
      return {
        touchType: TOUCH_TYPES.UNKNOWN,
        ...this.extractTouchDataFromEvent(event, touchIndex),
        timestamp: Date.now()
      };
    }
  }

  /**
   * 直接检测触摸类型（调用原生方法）
   */
  async detectTouchTypeDirect(x, y, pressure, size, toolType) {
    if (!this.isAvailable()) {
      throw new Error('TouchTypeDetection module is not available');
    }

    try {
      if (Platform.OS === 'android') {
        return await TouchTypeDetection.detectTouchTypeDirect(x, y, pressure, size, toolType);
      } else if (Platform.OS === 'ios') {
        return await TouchTypeDetection.detectTouchType(x, y, pressure, size, toolType);
      }
      
      throw new Error('Unsupported platform');
    } catch (error) {
      console.error('TouchTypeDetectionService: 直接检测触摸类型失败', error);
      throw error;
    }
  }

  /**
   * 获取当前监听状态
   */
  getListeningStatus() {
    return {
      isListening: this.isListening,
      isAvailable: this.isAvailable(),
      activeListeners: this.listeners.size
    };
  }

  /**
   * 获取触摸类型常量
   */
  getTouchTypes() {
    return TOUCH_TYPES;
  }

  /**
   * 获取事件名称常量
   */
  getEvents() {
    return EVENTS;
  }

  /**
   * 判断是否为手写笔触摸
   */
  isStylus(touchType) {
    return touchType === TOUCH_TYPES.STYLUS;
  }

  /**
   * 判断是否为手指触摸
   */
  isFinger(touchType) {
    return touchType === TOUCH_TYPES.FINGER;
  }

  /**
   * 创建触摸类型检测钩子（用于React组件）
   */
  createTouchTypeHook() {
    return {
      startListening: this.startListening.bind(this),
      stopListening: this.stopListening.bind(this),
      addEventListener: this.addEventListener.bind(this),
      removeEventListener: this.removeEventListener.bind(this),
      detectTouchType: this.detectTouchType.bind(this),
      detectTouchTypeFromEvent: this.detectTouchTypeFromEvent.bind(this),
      detectTouchTypeDirect: this.detectTouchTypeDirect.bind(this),
      getSupportedTouchTypes: this.getSupportedTouchTypes.bind(this),
      getListeningStatus: this.getListeningStatus.bind(this),
      isStylus: this.isStylus.bind(this),
      isFinger: this.isFinger.bind(this),
      TOUCH_TYPES,
      EVENTS
    };
  }
}

// 创建单例实例
const touchTypeDetectionService = new TouchTypeDetectionService();

export default touchTypeDetectionService;

// 导出服务类以便创建多个实例
export { TouchTypeDetectionService };

// 常量已在文件开头导出

// 导出便捷方法
export const {
  startListening,
  stopListening,
  addEventListener,
  removeEventListener,
  detectTouchType,
  detectTouchTypeFromEvent,
  detectTouchTypeDirect,
  getSupportedTouchTypes,
  getListeningStatus,
  isStylus,
  isFinger
} = touchTypeDetectionService.createTouchTypeHook();
