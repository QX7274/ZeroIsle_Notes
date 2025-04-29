/**
 * 简单的事件发射器实现
 * 用于替代 events 模块，避免 "Cannot read property 'EventEmitter' of undefined" 错误
 */
class EventEmitter {
  constructor() {
    this.events = {};
  }

  /**
   * 添加事件监听器
   * @param {string} event - 事件名称
   * @param {function} listener - 监听器函数
   * @returns {EventEmitter} - 返回this以支持链式调用
   */
  on(event, listener) {
    if (!this.events[event]) {
      this.events[event] = [];
    }
    this.events[event].push(listener);
    return this;
  }

  /**
   * 添加一次性事件监听器
   * @param {string} event - 事件名称
   * @param {function} listener - 监听器函数
   * @returns {EventEmitter} - 返回this以支持链式调用
   */
  once(event, listener) {
    const onceWrapper = (...args) => {
      listener(...args);
      this.off(event, onceWrapper);
    };
    return this.on(event, onceWrapper);
  }

  /**
   * 移除事件监听器
   * @param {string} event - 事件名称
   * @param {function} listener - 监听器函数
   * @returns {EventEmitter} - 返回this以支持链式调用
   */
  off(event, listener) {
    if (!this.events[event]) {
      return this;
    }
    this.events[event] = this.events[event].filter(l => l !== listener);
    return this;
  }

  /**
   * 移除所有监听器
   * @param {string} [event] - 事件名称，如果不提供则移除所有事件的所有监听器
   * @returns {EventEmitter} - 返回this以支持链式调用
   */
  removeAllListeners(event) {
    if (event) {
      delete this.events[event];
    } else {
      this.events = {};
    }
    return this;
  }

  /**
   * 触发事件
   * @param {string} event - 事件名称
   * @param {...any} args - 传递给监听器的参数
   * @returns {boolean} - 如果有监听器则返回true，否则返回false
   */
  emit(event, ...args) {
    if (!this.events[event]) {
      return false;
    }
    this.events[event].forEach(listener => {
      listener(...args);
    });
    return true;
  }

  /**
   * 获取监听器数量
   * @param {string} event - 事件名称
   * @returns {number} - 监听器数量
   */
  listenerCount(event) {
    return this.events[event] ? this.events[event].length : 0;
  }

  /**
   * 获取监听器列表
   * @param {string} event - 事件名称
   * @returns {function[]} - 监听器列表
   */
  listeners(event) {
    return this.events[event] ? [...this.events[event]] : [];
  }
}

// 导出EventEmitter类
export default EventEmitter;
