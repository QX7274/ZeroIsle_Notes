/**
 * 日志服务
 * 提供统一的日志记录功能
 */

// 日志级别
const LOG_LEVELS = {
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
};

// 简单的日志服务实现，避免构造函数问题
const logService = {
  enabled: true,
  initialized: true,

  /**
   * 初始化日志服务
   * @returns {Promise<void>}
   */
  async initialize() {
    console.info('日志服务初始化成功');
    return Promise.resolve();
  },

  /**
   * 记录调试日志
   * @param {string} message 日志消息
   * @param {Object} data 附加数据
   */
  debug(message, data = null) {
    if (this.enabled) {
      if (data) {
        console.debug(message, data);
      } else {
        console.debug(message);
      }
    }
  },

  /**
   * 记录信息日志
   * @param {string} message 日志消息
   * @param {Object} data 附加数据
   */
  info(message, data = null) {
    if (this.enabled) {
      if (data) {
        console.info(message, data);
      } else {
        console.info(message);
      }
    }
  },

  /**
   * 记录警告日志
   * @param {string} message 日志消息
   * @param {Object} data 附加数据
   */
  warn(message, data = null) {
    if (this.enabled) {
      if (data) {
        console.warn(message, data);
      } else {
        console.warn(message);
      }
    }
  },

  /**
   * 记录错误日志
   * @param {string} message 日志消息
   * @param {Object} data 附加数据
   */
  error(message, data = null) {
    if (this.enabled) {
      if (data) {
        console.error(message, data);
      } else {
        console.error(message);
      }
    }
  },

  /**
   * 启用日志
   */
  enable() {
    this.enabled = true;
  },

  /**
   * 禁用日志
   */
  disable() {
    this.enabled = false;
  },
};

module.exports = { logService, LOG_LEVELS };
module.exports.default = logService;
module.exports.logService = logService;
