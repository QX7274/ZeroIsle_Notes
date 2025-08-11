import React from 'react';

/**
 * 输入设备检测工具
 * 用于区分手指触摸和触控笔输入
 */

/**
 * 检测触摸事件的输入类型
 * @param {Object} nativeEvent - 原生触摸事件对象
 * @returns {string} 'finger' | 'stylus' | 'unknown'
 */
export const detectInputType = (nativeEvent) => {
  // 检查是否有触控笔相关属性
  if (nativeEvent.touches && nativeEvent.touches.length > 0) {
    const touch = nativeEvent.touches[0];
    
    // 检查触控笔特有属性
    // 1. pressure - 压力值，触控笔通常有更精确的压力检测
    // 2. radiusX/radiusY - 触摸半径，触控笔通常更小
    // 3. force - 力度值（iOS特有）
    // 4. touchType - 触摸类型（部分设备支持）
    
    const hasPressure = typeof touch.pressure !== 'undefined';
    const hasRadius = typeof touch.radiusX !== 'undefined' && typeof touch.radiusY !== 'undefined';
    const hasForce = typeof touch.force !== 'undefined';
    
    // 触控笔检测逻辑
    if (hasPressure && touch.pressure > 0) {
      // 触控笔通常有更精确的压力值
      if (touch.pressure < 0.1 || touch.pressure > 0.8) {
        return 'stylus';
      }
    }
    
    if (hasRadius) {
      // 触控笔的触摸半径通常更小
      const avgRadius = (touch.radiusX + touch.radiusY) / 2;
      if (avgRadius < 5) {
        return 'stylus';
      }
    }
    
    if (hasForce && touch.force > 0.5) {
      // iOS设备上，触控笔通常有更高的力度值
      return 'stylus';
    }
    
    // 检查touchType属性（如果支持）
    if (touch.touchType === 'stylus' || touch.touchType === 'pen') {
      return 'stylus';
    }
    
    // 如果没有明确的触控笔特征，判断为手指
    return 'finger';
  }
  
  return 'unknown';
};

/**
 * 检查是否为触控笔输入
 * @param {Object} nativeEvent - 原生触摸事件对象
 * @returns {boolean}
 */
export const isStylusInput = (nativeEvent) => {
  return detectInputType(nativeEvent) === 'stylus';
};

/**
 * 检查是否为手指输入
 * @param {Object} nativeEvent - 原生触摸事件对象
 * @returns {boolean}
 */
export const isFingerInput = (nativeEvent) => {
  return detectInputType(nativeEvent) === 'finger';
};

/**
 * 输入模式管理器
 * 用于管理当前的输入模式和行为
 */
export class InputModeManager {
  constructor() {
    this.currentMode = 'auto'; // 'auto' | 'finger' | 'stylus'
    this.listeners = [];
  }
  
  /**
   * 设置输入模式
   * @param {string} mode - 'auto' | 'finger' | 'stylus'
   */
  setMode(mode) {
    if (['auto', 'finger', 'stylus'].includes(mode)) {
      this.currentMode = mode;
      this.notifyListeners(mode);
    }
  }
  
  /**
   * 获取当前输入模式
   * @returns {string}
   */
  getMode() {
    return this.currentMode;
  }
  
  /**
   * 根据触摸事件确定操作类型
   * @param {Object} nativeEvent - 原生触摸事件对象
   * @returns {string} 'draw' | 'navigate'
   */
  getOperationType(nativeEvent) {
    if (this.currentMode === 'finger') {
      return 'navigate';
    } else if (this.currentMode === 'stylus') {
      return 'draw';
    } else {
      // 自动模式：根据输入设备类型决定
      const inputType = detectInputType(nativeEvent);
      return inputType === 'stylus' ? 'draw' : 'navigate';
    }
  }
  
  /**
   * 添加模式变化监听器
   * @param {Function} listener - 监听器函数
   */
  addListener(listener) {
    this.listeners.push(listener);
  }
  
  /**
   * 移除模式变化监听器
   * @param {Function} listener - 监听器函数
   */
  removeListener(listener) {
    const index = this.listeners.indexOf(listener);
    if (index > -1) {
      this.listeners.splice(index, 1);
    }
  }
  
  /**
   * 通知所有监听器
   * @param {string} mode - 新的模式
   */
  notifyListeners(mode) {
    this.listeners.forEach(listener => {
      try {
        listener(mode);
      } catch (error) {
        console.error('InputModeManager listener error:', error);
      }
    });
  }
}

// 全局输入模式管理器实例
export const globalInputModeManager = new InputModeManager();

/**
 * React Hook：使用输入模式管理器
 * @returns {Object} { mode, setMode, getOperationType }
 */
export const useInputMode = () => {
  const [mode, setModeState] = React.useState(globalInputModeManager.getMode());
  
  React.useEffect(() => {
    const listener = (newMode) => {
      setModeState(newMode);
    };
    
    globalInputModeManager.addListener(listener);
    
    return () => {
      globalInputModeManager.removeListener(listener);
    };
  }, []);
  
  const setMode = (newMode) => {
    globalInputModeManager.setMode(newMode);
  };
  
  const getOperationType = (nativeEvent) => {
    return globalInputModeManager.getOperationType(nativeEvent);
  };
  
  return {
    mode,
    setMode,
    getOperationType
  };
};

/**
 * 触摸事件增强器
 * 为触摸事件添加输入类型信息
 */
export const enhanceTouchEvent = (nativeEvent) => {
  const inputType = detectInputType(nativeEvent);
  const operationType = globalInputModeManager.getOperationType(nativeEvent);
  
  return {
    ...nativeEvent,
    inputType,
    operationType,
    isStylusInput: inputType === 'stylus',
    isFingerInput: inputType === 'finger'
  };
};
