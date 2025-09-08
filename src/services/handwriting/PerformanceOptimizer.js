/**
 * 性能优化器
 * 用于优化手写引擎的性能
 */
export class PerformanceOptimizer {
  constructor() {
    this.optimizationSettings = {
      maxStrokesInMemory: 500,
      enableStrokeOptimization: true,
      enableRealTimeRendering: true,
      renderBatchSize: 50,
      memoryCleanupInterval: 30000 // 30秒
    };
    
    this.performanceMetrics = {
      renderTime: 0,
      memoryUsage: 0,
      strokeCount: 0,
      lastCleanup: Date.now()
    };
  }

  /**
   * 优化笔迹数组
   * @param {Array} strokes - 原始笔迹数组
   * @returns {Array} 优化后的笔迹数组
   */
  optimizeStrokes(strokes) {
    if (!this.optimizationSettings.enableStrokeOptimization) {
      return strokes;
    }

    // 限制内存中的笔迹数量
    if (strokes.length > this.optimizationSettings.maxStrokesInMemory) {
      const excessCount = strokes.length - this.optimizationSettings.maxStrokesInMemory;
      strokes = strokes.slice(excessCount);
    }

    // 优化每个笔迹的点数
    return strokes.map(stroke => this.optimizeStroke(stroke));
  }

  /**
   * 优化单个笔迹
   * @param {Object} stroke - 笔迹对象
   * @returns {Object} 优化后的笔迹对象
   */
  optimizeStroke(stroke) {
    if (!stroke.points || stroke.points.length <= 2) {
      return stroke;
    }

    // 简化笔迹点（Douglas-Peucker算法简化版）
    const optimizedPoints = this.simplifyPoints(stroke.points);
    
    return {
      ...stroke,
      points: optimizedPoints
    };
  }

  /**
   * 简化点数组
   * @param {Array} points - 点数组
   * @returns {Array} 简化后的点数组
   */
  simplifyPoints(points) {
    if (points.length <= 2) {
      return points;
    }

    const simplified = [points[0]]; // 保留第一个点
    
    for (let i = 1; i < points.length - 1; i++) {
      const prev = points[i - 1];
      const current = points[i];
      const next = points[i + 1];
      
      // 计算角度变化
      const angle1 = Math.atan2(current.y - prev.y, current.x - prev.x);
      const angle2 = Math.atan2(next.y - current.y, next.x - current.x);
      const angleDiff = Math.abs(angle1 - angle2);
      
      // 如果角度变化大于阈值，保留这个点
      if (angleDiff > 0.1) {
        simplified.push(current);
      }
    }
    
    simplified.push(points[points.length - 1]); // 保留最后一个点
    return simplified;
  }

  /**
   * 批量渲染优化
   * @param {Array} strokes - 笔迹数组
   * @param {Function} renderFunction - 渲染函数
   * @returns {Promise} 渲染结果
   */
  async batchRender(strokes, renderFunction) {
    const batchSize = this.optimizationSettings.renderBatchSize;
    const results = [];
    
    for (let i = 0; i < strokes.length; i += batchSize) {
      const batch = strokes.slice(i, i + batchSize);
      const result = await renderFunction(batch);
      results.push(result);
      
      // 让出控制权，避免阻塞UI
      await new Promise(resolve => setTimeout(resolve, 0));
    }
    
    return results;
  }

  /**
   * 内存清理
   * @param {Object} context - 上下文对象
   */
  performMemoryCleanup(context) {
    const now = Date.now();
    
    if (now - this.performanceMetrics.lastCleanup > this.optimizationSettings.memoryCleanupInterval) {
      // 清理旧的性能数据
      this.performanceMetrics.lastCleanup = now;
      
      // 触发垃圾回收（如果可用）
      if (typeof global !== 'undefined' && global.gc) {
        global.gc();
      }
      
      console.log('性能优化器: 执行内存清理');
    }
  }

  /**
   * 更新性能指标
   * @param {Object} metrics - 性能指标
   */
  updateMetrics(metrics) {
    this.performanceMetrics = {
      ...this.performanceMetrics,
      ...metrics,
      lastUpdate: Date.now()
    };
  }

  /**
   * 获取性能指标
   * @returns {Object} 性能指标
   */
  getMetrics() {
    return { ...this.performanceMetrics };
  }

  /**
   * 检查是否需要优化
   * @returns {boolean} 是否需要优化
   */
  shouldOptimize() {
    return this.performanceMetrics.strokeCount > this.optimizationSettings.maxStrokesInMemory ||
           this.performanceMetrics.renderTime > 16; // 超过16ms（60fps）
  }

  /**
   * 重置优化器
   */
  reset() {
    this.performanceMetrics = {
      renderTime: 0,
      memoryUsage: 0,
      strokeCount: 0,
      lastCleanup: Date.now()
    };
  }
}