/**
 * 触摸类型检测Hook
 * 提供在React组件中使用触摸类型检测的便捷方法
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import touchTypeDetectionService, { TOUCH_TYPES, EVENTS } from '../services/touch/TouchTypeDetectionService';

/**
 * 触摸类型检测Hook
 * @param {Object} options 配置选项
 * @param {boolean} options.autoStart 是否自动开始监听
 * @param {function} options.onTouchTypeDetected 触摸类型检测回调
 * @param {boolean} options.enableMultiTouch 是否启用多点触摸检测
 */
export const useTouchTypeDetection = (options = {}) => {
  const {
    autoStart = false,
    onTouchTypeDetected = null,
    enableMultiTouch = false
  } = options;

  // 状态
  const [isListening, setIsListening] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [supportedTypes, setSupportedTypes] = useState([]);
  const [lastDetectedTouch, setLastDetectedTouch] = useState(null);
  const [error, setError] = useState(null);

  // 引用
  const listenerRef = useRef(null);
  const mountedRef = useRef(true);

  // 检查服务可用性
  useEffect(() => {
    const checkAvailability = async () => {
      try {
        const available = touchTypeDetectionService.isAvailable();
        setIsAvailable(available);

        if (available) {
          const supportInfo = await touchTypeDetectionService.getSupportedTouchTypes();
          setSupportedTypes(supportInfo.supportedTypes || []);
        }
      } catch (err) {
        console.error('useTouchTypeDetection: 检查可用性失败', err);
        setError(err);
      }
    };

    checkAvailability();
  }, []);

  // 处理触摸类型检测事件
  const handleTouchTypeDetected = useCallback((touchData) => {
    if (!mountedRef.current) return;

    setLastDetectedTouch(touchData);
    
    if (onTouchTypeDetected) {
      onTouchTypeDetected(touchData);
    }
  }, [onTouchTypeDetected]);

  // 开始监听
  const startListening = useCallback(async () => {
    if (!isAvailable || isListening) {
      return false;
    }

    try {
      await touchTypeDetectionService.startListening();
      
      // 添加事件监听器
      listenerRef.current = touchTypeDetectionService.addEventListener(
        EVENTS.TOUCH_TYPE_DETECTED,
        handleTouchTypeDetected
      );

      setIsListening(true);
      setError(null);
      return true;
    } catch (err) {
      console.error('useTouchTypeDetection: 开始监听失败', err);
      setError(err);
      return false;
    }
  }, [isAvailable, isListening, handleTouchTypeDetected]);

  // 停止监听
  const stopListening = useCallback(async () => {
    if (!isListening) {
      return false;
    }

    try {
      await touchTypeDetectionService.stopListening();
      
      // 移除事件监听器
      if (listenerRef.current) {
        touchTypeDetectionService.removeEventListener(EVENTS.TOUCH_TYPE_DETECTED);
        listenerRef.current = null;
      }

      setIsListening(false);
      setError(null);
      return true;
    } catch (err) {
      console.error('useTouchTypeDetection: 停止监听失败', err);
      setError(err);
      return false;
    }
  }, [isListening]);

  // 检测触摸类型
  const detectTouchType = useCallback(async (touchData) => {
    if (!isAvailable) {
      throw new Error('Touch type detection is not available');
    }

    try {
      const result = await touchTypeDetectionService.detectTouchType(touchData);
      setLastDetectedTouch(result);
      setError(null);
      return result;
    } catch (err) {
      console.error('useTouchTypeDetection: 检测触摸类型失败', err);
      setError(err);
      throw err;
    }
  }, [isAvailable]);

  // 从事件检测触摸类型
  const detectTouchTypeFromEvent = useCallback(async (event, touchIndex = 0) => {
    if (!isAvailable) {
      return {
        touchType: TOUCH_TYPES.UNKNOWN,
        timestamp: Date.now()
      };
    }

    try {
      const result = await touchTypeDetectionService.detectTouchTypeFromEvent(event, touchIndex);
      setLastDetectedTouch(result);
      setError(null);
      return result;
    } catch (err) {
      console.error('useTouchTypeDetection: 从事件检测触摸类型失败', err);
      setError(err);
      return {
        touchType: TOUCH_TYPES.UNKNOWN,
        timestamp: Date.now()
      };
    }
  }, [isAvailable]);

  // 批量检测多点触摸
  const detectMultiTouchTypes = useCallback(async (touchPoints) => {
    if (!isAvailable || !enableMultiTouch) {
      throw new Error('Multi-touch detection is not available or not enabled');
    }

    try {
      const results = await touchTypeDetectionService.detectMultiTouchTypes(touchPoints);
      setError(null);
      return results;
    } catch (err) {
      console.error('useTouchTypeDetection: 批量检测触摸类型失败', err);
      setError(err);
      throw err;
    }
  }, [isAvailable, enableMultiTouch]);

  // 自动开始监听
  useEffect(() => {
    if (autoStart && isAvailable && !isListening) {
      startListening();
    }

    return () => {
      mountedRef.current = false;
      if (isListening) {
        stopListening();
      }
    };
  }, [autoStart, isAvailable, isListening, startListening, stopListening]);

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      if (listenerRef.current) {
        touchTypeDetectionService.removeEventListener(EVENTS.TOUCH_TYPE_DETECTED);
      }
    };
  }, []);

  // 便捷方法
  const isStylus = useCallback((touchType) => {
    return touchTypeDetectionService.isStylus(touchType);
  }, []);

  const isFinger = useCallback((touchType) => {
    return touchTypeDetectionService.isFinger(touchType);
  }, []);

  const isLastTouchStylus = useCallback(() => {
    return lastDetectedTouch && isStylus(lastDetectedTouch.touchType);
  }, [lastDetectedTouch, isStylus]);

  const isLastTouchFinger = useCallback(() => {
    return lastDetectedTouch && isFinger(lastDetectedTouch.touchType);
  }, [lastDetectedTouch, isFinger]);

  return {
    // 状态
    isListening,
    isAvailable,
    supportedTypes,
    lastDetectedTouch,
    error,

    // 方法
    startListening,
    stopListening,
    detectTouchType,
    detectTouchTypeFromEvent,
    detectMultiTouchTypes,

    // 便捷方法
    isStylus,
    isFinger,
    isLastTouchStylus,
    isLastTouchFinger,

    // 常量
    TOUCH_TYPES,
    EVENTS
  };
};

/**
 * 简化版触摸类型检测Hook
 * 只提供基本的触摸类型检测功能
 */
export const useSimpleTouchTypeDetection = () => {
  const [lastTouchType, setLastTouchType] = useState(TOUCH_TYPES.UNKNOWN);
  const [isAvailable, setIsAvailable] = useState(false);

  useEffect(() => {
    setIsAvailable(touchTypeDetectionService.isAvailable());
  }, []);

  const detectFromEvent = useCallback(async (event, touchIndex = 0) => {
    if (!isAvailable) {
      return TOUCH_TYPES.UNKNOWN;
    }

    try {
      const result = await touchTypeDetectionService.detectTouchTypeFromEvent(event, touchIndex);
      setLastTouchType(result.touchType);
      return result.touchType;
    } catch (error) {
      console.error('useSimpleTouchTypeDetection: 检测失败', error);
      return TOUCH_TYPES.UNKNOWN;
    }
  }, [isAvailable]);

  return {
    lastTouchType,
    isAvailable,
    detectFromEvent,
    isStylus: lastTouchType === TOUCH_TYPES.STYLUS,
    isFinger: lastTouchType === TOUCH_TYPES.FINGER,
    TOUCH_TYPES
  };
};

export default useTouchTypeDetection;
