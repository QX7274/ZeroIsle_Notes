/**
 * 手写性能监控器
 * 用于监控手写引擎的性能指标
 */
export class HandwritingPerformanceMonitor {
  constructor() {
    this.metrics = {
      strokeCount: 0,
      renderTime: 0,
      averageRenderTime: 0,
      memoryUsage: 0,
      lastUpdate: Date.now()
    };
    
    this.performanceHistory = [];
    this.maxHistorySize = 100;
  }

  /**
   * 开始性能监控
   * @param {string} operation - 操作名称
   * @returns {Function} 结束监控的函数
   */
  startTiming(operation) {
    const startTime = performance.now();
    
    return () => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      this.recordMetric(operation, duration);
      return duration;
    };
  }

  /**
   * 记录性能指标
   * @param {string} operation - 操作名称
   * @param {number} duration - 持续时间
   */
  recordMetric(operation, duration) {
    this.performanceHistory.push({
      operation,
      duration,
      timestamp: Date.now()
    });

    // 限制历史记录大小
    if (this.performanceHistory.length > this.maxHistorySize) {
      this.performanceHistory.shift();
    }

    // 更新平均渲染时间
    if (operation === 'render') {
      this.metrics.renderTime = duration;
      this.updateAverageRenderTime();
    }
  }

  /**
   * 更新平均渲染时间
   */
  updateAverageRenderTime() {
    const renderTimes = this.performanceHistory
      .filter(entry => entry.operation === 'render')
      .map(entry => entry.duration);
    
    if (renderTimes.length > 0) {
      this.metrics.averageRenderTime = renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length;
    }
  }

  /**
   * 增加笔迹计数
   */
  incrementStrokeCount() {
    this.metrics.strokeCount++;
    this.metrics.lastUpdate = Date.now();
  }

  /**
   * 获取性能指标
   * @returns {Object} 性能指标
   */
  getMetrics() {
    return {
      ...this.metrics,
      performanceHistory: this.performanceHistory.slice(-20) // 返回最近20条记录
    };
  }

  /**
   * 重置性能指标
   */
  reset() {
    this.metrics = {
      strokeCount: 0,
      renderTime: 0,
      averageRenderTime: 0,
      memoryUsage: 0,
      lastUpdate: Date.now()
    };
    this.performanceHistory = [];
  }
}