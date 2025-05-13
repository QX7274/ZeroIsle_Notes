/**
 * 事件发射器
 * 提供事件发布订阅功能
 */

import { EventEmitter } from 'events';
import { logService } from './logService';

/**
 * 事件发射器
 * 用于在应用内部进行事件通信
 */
class AppEventEmitter extends EventEmitter {
  constructor() {
    super();
    
    // 设置最大监听器数量
    this.setMaxListeners(100);
    
    // 事件历史记录
    this.eventHistory = {};
    
    // 是否启用调试
    this.debug = false;
  }

  /**
   * 启用调试模式
   * @param {boolean} enabled 是否启用
   */
  setDebug(enabled) {
    this.debug = enabled;
  }

  /**
   * 发射事件
   * @param {string} event 事件名称
   * @param {...any} args 事件参数
   * @returns {boolean} 是否有监听器处理了事件
   */
  emit(event, ...args) {
    if (this.debug) {
      logService.debug(`事件发射: ${event}`, args);
    }
    
    // 记录事件历史
    if (!this.eventHistory[event]) {
      this.eventHistory[event] = [];
    }
    
    this.eventHistory[event].push({
      timestamp: Date.now(),
      args,
    });
    
    // 限制历史记录长度
    if (this.eventHistory[event].length > 10) {
      this.eventHistory[event].shift();
    }
    
    return super.emit(event, ...args);
  }

  /**
   * 添加事件监听器
   * @param {string} event 事件名称
   * @param {Function} listener 监听器函数
   * @returns {EventEmitter} 事件发射器
   */
  addListener(event, listener) {
    if (this.debug) {
      logService.debug(`添加事件监听器: ${event}`);
    }
    
    return super.addListener(event, listener);
  }

  /**
   * 添加一次性事件监听器
   * @param {string} event 事件名称
   * @param {Function} listener 监听器函数
   * @returns {EventEmitter} 事件发射器
   */
  once(event, listener) {
    if (this.debug) {
      logService.debug(`添加一次性事件监听器: ${event}`);
    }
    
    return super.once(event, listener);
  }

  /**
   * 移除事件监听器
   * @param {string} event 事件名称
   * @param {Function} listener 监听器函数
   * @returns {EventEmitter} 事件发射器
   */
  removeListener(event, listener) {
    if (this.debug) {
      logService.debug(`移除事件监听器: ${event}`);
    }
    
    return super.removeListener(event, listener);
  }

  /**
   * 移除所有事件监听器
   * @param {string} event 事件名称
   * @returns {EventEmitter} 事件发射器
   */
  removeAllListeners(event) {
    if (this.debug) {
      logService.debug(`移除所有事件监听器: ${event || '所有事件'}`);
    }
    
    return super.removeAllListeners(event);
  }

  /**
   * 获取事件历史记录
   * @param {string} event 事件名称
   * @returns {Array} 事件历史记录
   */
  getEventHistory(event) {
    return this.eventHistory[event] || [];
  }

  /**
   * 清除事件历史记录
   * @param {string} event 事件名称
   */
  clearEventHistory(event) {
    if (event) {
      this.eventHistory[event] = [];
    } else {
      this.eventHistory = {};
    }
  }
}

// 创建事件发射器实例
export const eventEmitter = new AppEventEmitter();

// 导出事件发射器
export default eventEmitter;
