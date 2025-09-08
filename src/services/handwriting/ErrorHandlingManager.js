/**
 * 错误处理管理器
 * 用于统一处理手写引擎中的错误
 */
export class ErrorHandlingManager {
  constructor() {
    this.errorCount = 0;
    this.maxErrors = 100;
    this.errorHistory = [];
  }

  /**
   * 处理错误
   * @param {Error} error - 错误对象
   * @param {Object} options - 选项
   * @param {string} options.context - 错误上下文
   * @param {Array} options.args - 错误参数
   * @returns {any} 错误处理结果
   */
  handleError(error, options = {}) {
    this.errorCount++;
    
    const errorInfo = {
      message: error.message,
      stack: error.stack,
      context: options.context || 'unknown',
      timestamp: Date.now(),
      args: options.includeArgs ? options.args : undefined
    };

    // 记录错误历史
    this.errorHistory.push(errorInfo);
    
    // 限制错误历史长度
    if (this.errorHistory.length > this.maxErrors) {
      this.errorHistory.shift();
    }

    // 输出错误信息
    console.error(`[ErrorHandlingManager] ${options.context || 'Unknown'}:`, error.message);
    
    // 返回默认值或重新抛出错误
    if (options.returnDefault !== undefined) {
      return options.returnDefault;
    }
    
    // 对于非关键错误，返回 null 而不是抛出
    if (options.silent) {
      return null;
    }
    
    throw error;
  }

  /**
   * 获取错误统计
   * @returns {Object} 错误统计信息
   */
  getErrorStats() {
    return {
      totalErrors: this.errorCount,
      recentErrors: this.errorHistory.slice(-10),
      errorRate: this.errorCount > 0 ? (this.errorHistory.length / this.errorCount) : 0
    };
  }

  /**
   * 清除错误历史
   */
  clearErrorHistory() {
    this.errorHistory = [];
    this.errorCount = 0;
  }

  /**
   * 检查是否应该继续处理
   * @returns {boolean} 是否应该继续
   */
  shouldContinue() {
    return this.errorCount < this.maxErrors;
  }
}