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

    // 详细调试信息
    console.log('InputDetection: 触摸事件详情:', {
      touchType: touch.touchType,
      pressure: touch.pressure,
      radiusX: touch.radiusX,
      radiusY: touch.radiusY,
      force: touch.force,
      toolType: touch.toolType,
      type: touch.type,
      identifier: touch.identifier
    });

    // 优先检查明确的touchType属性（最可靠）
    if (touch.touchType === 'stylus' || touch.touchType === 'pen') {
      console.log('InputDetection: 检测到触控笔 (touchType)');
      return 'stylus';
    }

    // Android特有的toolType检测
    if (touch.toolType === 2 || touch.type === 'stylus') {
      console.log('InputDetection: 检测到触控笔 (Android toolType)');
      return 'stylus';
    }

    // 检查触控笔特有属性
    const hasPressure = typeof touch.pressure !== 'undefined' && touch.pressure !== null;
    const hasRadius = typeof touch.radiusX !== 'undefined' && typeof touch.radiusY !== 'undefined';
    const hasForce = typeof touch.force !== 'undefined' && touch.force !== null;

    let stylusScore = 0;

    // 压力检测 - 触控笔通常有压力感应
    if (hasPressure) {
      // 更宽松的压力检测
      if (touch.pressure > 0 && touch.pressure !== 1) {
        stylusScore += 3; // 有压力值是强指标
        console.log('InputDetection: 检测到压力值:', touch.pressure);
      } else if (touch.pressure === 0) {
        // 有些触控笔在轻触时压力为0
        stylusScore += 1;
        console.log('InputDetection: 检测到零压力值（可能是触控笔）');
      }
    }

    // 触摸半径检测 - 触控笔通常更小更精确
    if (hasRadius) {
      const avgRadius = (touch.radiusX + touch.radiusY) / 2;
      if (avgRadius < 12) { // 进一步放宽条件
        stylusScore += 2;
        console.log('InputDetection: 检测到小半径:', avgRadius);
      } else if (avgRadius < 20) {
        stylusScore += 1;
        console.log('InputDetection: 检测到中等半径:', avgRadius);
      }
    }

    // 力度检测（iOS）
    if (hasForce) {
      if (touch.force > 0.1) { // 大幅降低阈值
        stylusScore += 2;
        console.log('InputDetection: 检测到力度值:', touch.force);
      }
    }

    // 更宽松的判断条件
    if (stylusScore >= 1) {
      console.log('InputDetection: 检测到触控笔 (综合评分):', stylusScore);
      return 'stylus';
    }

    // 备用检测：基于触摸点位置精度
    // 如果触摸点坐标是整数，可能是触控笔（更精确）
    const hasIntegerCoords = (touch.pageX % 1 === 0) && (touch.pageY % 1 === 0);
    if (hasIntegerCoords && (touch.pageX !== 0 && touch.pageY !== 0)) {
      console.log('InputDetection: 基于坐标精度检测到可能的触控笔');
      return 'stylus';
    }

    // 默认判断为手指
    console.log('InputDetection: 检测到手指输入');
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
      const operationType = inputType === 'stylus' ? 'draw' : 'navigate';
      console.log('InputModeManager: 操作类型:', operationType, '输入类型:', inputType);
      return operationType;
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
