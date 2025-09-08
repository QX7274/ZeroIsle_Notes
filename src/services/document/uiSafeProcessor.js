/**
 * UI安全处理器
 * 专门解决长时间操作导致的UI阻塞问题
 */

import { InteractionManager } from 'react-native';

class UISafeProcessor {
  constructor() {
    this.isProcessing = false;
    this.processingQueue = [];
  }

  /**
   * UI安全的异步操作执行器
   * @param {Function} operation - 要执行的操作
   * @param {Object} options - 选项
   * @returns {Promise} 操作结果
   */
  async runSafely(operation, options = {}) {
    const {
      maxChunkTime = 16, // 每个时间片最大执行时间（毫秒）
      yieldInterval = 5,  // 让出控制权的间隔（毫秒）
      onProgress = null,  // 进度回调
      priority = 'normal' // 优先级：'high', 'normal', 'low'
    } = options;

    return new Promise((resolve, reject) => {
      const task = {
        operation,
        resolve,
        reject,
        options: { maxChunkTime, yieldInterval, onProgress },
        priority,
        createdAt: Date.now()
      };

      // 根据优先级插入队列
      if (priority === 'high') {
        this.processingQueue.unshift(task);
      } else {
        this.processingQueue.push(task);
      }

      // 开始处理队列
      this.processQueue();
    });
  }

  /**
   * 处理任务队列
   */
  async processQueue() {
    if (this.isProcessing || this.processingQueue.length === 0) {
      return;
    }

    this.isProcessing = true;

    try {
      while (this.processingQueue.length > 0) {
        const task = this.processingQueue.shift();
        
        try {
          // 等待交互完成后执行
          await new Promise(resolve => {
            InteractionManager.runAfterInteractions(resolve);
          });

          // 执行任务
          const result = await this.executeTaskSafely(task);
          task.resolve(result);

        } catch (error) {
          task.reject(error);
        }

        // 让出控制权
        await this.yieldToUI(task.options.yieldInterval);
      }
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * 安全执行任务
   * @param {Object} task - 任务对象
   */
  async executeTaskSafely(task) {
    const { operation, options } = task;
    const { maxChunkTime, onProgress } = options;

    // 如果操作是异步生成器，分块执行
    if (typeof operation === 'function') {
      const startTime = Date.now();
      
      try {
        // 包装操作，添加超时控制
        const result = await Promise.race([
          operation(),
          new Promise((_, reject) => {
            setTimeout(() => {
              reject(new Error('操作超时'));
            }, 30000); // 30秒超时
          })
        ]);

        const executionTime = Date.now() - startTime;
        console.log(`UISafeProcessor: 操作完成，耗时: ${executionTime}ms`);

        return result;
      } catch (error) {
        console.error('UISafeProcessor: 操作执行失败:', error);
        throw error;
      }
    }

    throw new Error('不支持的操作类型');
  }

  /**
   * 让出控制权给UI线程
   * @param {number} interval - 间隔时间
   */
  async yieldToUI(interval = 5) {
    return new Promise(resolve => {
      if (typeof setImmediate !== 'undefined') {
        setImmediate(resolve);
      } else {
        setTimeout(resolve, interval);
      }
    });
  }

  /**
   * 分块处理大型操作
   * @param {Array} items - 要处理的项目数组
   * @param {Function} processor - 处理函数
   * @param {Object} options - 选项
   */
  async processInChunks(items, processor, options = {}) {
    const {
      chunkSize = 10,
      onProgress = null,
      onChunkComplete = null
    } = options;

    const results = [];
    const totalItems = items.length;
    
    for (let i = 0; i < totalItems; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);
      
      // 处理当前块
      const chunkResults = await this.runSafely(async () => {
        const chunkResults = [];
        for (const item of chunk) {
          const result = await processor(item);
          chunkResults.push(result);
        }
        return chunkResults;
      }, { priority: 'normal' });

      results.push(...chunkResults);

      // 报告进度
      if (onProgress) {
        const progress = Math.round(((i + chunk.length) / totalItems) * 100);
        onProgress({ progress, completed: i + chunk.length, total: totalItems });
      }

      // 块完成回调
      if (onChunkComplete) {
        onChunkComplete(chunk, chunkResults);
      }

      // 让出控制权
      await this.yieldToUI();
    }

    return results;
  }

  /**
   * 安全的文件操作
   * @param {Function} fileOperation - 文件操作函数
   * @param {Object} options - 选项
   */
  async safeFileOperation(fileOperation, options = {}) {
    const {
      timeout = 30000,
      retries = 3,
      onProgress = null
    } = options;

    let lastError = null;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        if (onProgress) {
          onProgress({ stage: 'attempting', attempt, maxAttempts: retries });
        }

        const result = await this.runSafely(async () => {
          return await Promise.race([
            fileOperation(),
            new Promise((_, reject) => {
              setTimeout(() => reject(new Error('文件操作超时')), timeout);
            })
          ]);
        }, { priority: 'high' });

        if (onProgress) {
          onProgress({ stage: 'completed', attempt });
        }

        return result;

      } catch (error) {
        lastError = error;
        console.warn(`UISafeProcessor: 文件操作失败 (尝试 ${attempt}/${retries}):`, error.message);

        if (attempt < retries) {
          // 等待后重试
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      }
    }

    throw lastError;
  }

  /**
   * 获取处理器状态
   */
  getStatus() {
    return {
      isProcessing: this.isProcessing,
      queueLength: this.processingQueue.length,
      currentTime: Date.now()
    };
  }

  /**
   * 清空队列
   */
  clearQueue() {
    this.processingQueue.forEach(task => {
      task.reject(new Error('任务被取消'));
    });
    this.processingQueue = [];
  }
}

// 创建单例实例
const uiSafeProcessor = new UISafeProcessor();

export default uiSafeProcessor;
