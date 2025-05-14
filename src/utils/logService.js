/**
 * 日志服务
 * 提供统一的日志记录功能
 */

// 日志级别
export const LOG_LEVELS = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
};

class LogService {
  constructor() {
    this.enabled = true;
    this.initialized = false;
    this.initializationPromise = null;
  }

  /**
   * 初始化日志服务
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) return Promise.resolve();

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = new Promise(async (resolve, reject) => {
      try {
        // 简单的初始化逻辑
        console.info('日志服务初始化成功');
        this.initialized = true;
        resolve();
      } catch (error) {
        console.error('日志服务初始化失败', error);
        reject(error);
      }
    });

    return this.initializationPromise;
  }

  /**
   * 记录调试日志
   * @param {string} message 日志消息
   * @param {Object} data 附加数据
   */
  debug(message, data = null) {
    if (this.enabled) {
      console.debug(message, data);
    }
  }

  /**
   * 记录信息日志
   * @param {string} message 日志消息
   * @param {Object} data 附加数据
   */
  info(message, data = null) {
    if (this.enabled) {
      console.info(message, data);
    }
  }

  /**
   * 记录警告日志
   * @param {string} message 日志消息
   * @param {Object} data 附加数据
   */
  warn(message, data = null) {
    if (this.enabled) {
      console.warn(message, data);
    }
  }

  /**
   * 记录错误日志
   * @param {string} message 日志消息
   * @param {Object} data 附加数据
   */
  error(message, data = null) {
    if (this.enabled) {
      console.error(message, data);
    }
  }

  /**
   * 启用日志
   */
  enable() {
    this.enabled = true;
  }

  /**
   * 禁用日志
   */
  disable() {
    this.enabled = false;
  }
}

// 创建单例实例
const logService = new LogService();

// 初始化
logService.initialize().catch(error => {
  console.error('初始化日志服务失败', error);
});

export { logService };
export default logService;
