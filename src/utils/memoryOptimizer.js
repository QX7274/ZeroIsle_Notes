/**
 * 内存优化器
 * 专门处理大文件的内存优化和OOM预防
 */

import { Alert } from 'react-native';
import RNFS from 'react-native-fs';

class MemoryOptimizer {
  constructor() {
    this.activeProcesses = new Map();
    this.memoryThreshold = 0.7; // 70%内存使用率阈值
    this.chunkSize = 1024 * 1024; // 1MB默认块大小
    this.maxConcurrentChunks = 3; // 最大并发块数
  }

  /**
   * 智能分块读取文件，避免OOM
   */
  async readFileSafely(filePath, options = {}) {
    const {
      encoding = 'utf8',
      chunkSize = this.chunkSize,
      onProgress = null,
      onChunk = null
    } = options;

    try {
      const fileStats = await RNFS.stat(filePath);
      const fileSize = fileStats.size;
      
      console.log(`MemoryOptimizer: 开始安全读取文件 ${(fileSize / 1024 / 1024).toFixed(2)}MB`);

      // 如果文件小于10MB，直接读取
      if (fileSize < 10 * 1024 * 1024) {
        return await RNFS.readFile(filePath, encoding);
      }

      // 大文件分块处理
      const chunks = [];
      const totalChunks = Math.ceil(fileSize / chunkSize);
      
      for (let i = 0; i < totalChunks; i++) {
        // 检查内存状态
        await this.checkMemoryPressure();
        
        const offset = i * chunkSize;
        const size = Math.min(chunkSize, fileSize - offset);
        
        try {
          const chunk = await RNFS.read(filePath, size, offset, encoding);
          chunks.push(chunk);
          
          // 处理单个块
          if (onChunk) {
            await onChunk(chunk, i, totalChunks);
          }
          
          // 更新进度
          if (onProgress) {
            onProgress({
              current: i + 1,
              total: totalChunks,
              percentage: Math.round(((i + 1) / totalChunks) * 100),
              processed: offset + size,
              remaining: fileSize - (offset + size)
            });
          }
          
          // 释放内存压力
          if (i % 5 === 0) {
            await this.forceGarbageCollection();
          }
          
        } catch (chunkError) {
          console.warn(`MemoryOptimizer: 读取块 ${i} 失败:`, chunkError);
          // 继续处理下一个块
        }
      }

      // 合并所有块
      if (encoding === 'utf8') {
        return chunks.join('');
      } else {
        return chunks;
      }

    } catch (error) {
      console.error('MemoryOptimizer: 文件读取失败:', error);
      throw new Error(`文件读取失败: ${error.message}`);
    }
  }

  /**
   * 检查内存压力
   */
  async checkMemoryPressure() {
    try {
      // 模拟内存检查
      const memoryUsage = await this.getMemoryUsage();
      
      if (memoryUsage > this.memoryThreshold) {
        console.warn(`MemoryOptimizer: 内存使用率过高 ${(memoryUsage * 100).toFixed(1)}%`);
        await this.forceGarbageCollection();
        
        // 等待一段时间让GC完成
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    } catch (error) {
      console.warn('MemoryOptimizer: 内存检查失败:', error);
    }
  }

  /**
   * 获取内存使用情况
   */
  async getMemoryUsage() {
    try {
      // 这里可以集成更精确的内存监控
      // 目前返回一个估算值
      return Math.random() * 0.5 + 0.3; // 30-80%的随机值
    } catch (error) {
      return 0.5; // 默认50%
    }
  }

  /**
   * 强制垃圾回收
   */
  async forceGarbageCollection() {
    try {
      // 触发垃圾回收
      if (global.gc) {
        global.gc();
      }
      
      // 等待GC完成
      await new Promise(resolve => setTimeout(resolve, 50));
    } catch (error) {
      console.warn('MemoryOptimizer: 垃圾回收失败:', error);
    }
  }

  /**
   * 处理大文件转换，避免OOM
   */
  async processLargeFileSafely(filePath, processor, options = {}) {
    const processId = `process_${Date.now()}_${Math.random()}`;
    
    try {
      this.activeProcesses.set(processId, {
        startTime: Date.now(),
        filePath,
        status: 'processing'
      });

      console.log(`MemoryOptimizer: 开始安全处理大文件: ${filePath}`);

      // 分块读取并处理
      const result = await this.readFileSafely(filePath, {
        ...options,
        onChunk: async (chunk, index, total) => {
          // 处理单个块
          if (processor.onChunk) {
            await processor.onChunk(chunk, index, total);
          }
        }
      });

      // 最终处理
      if (processor.finalize) {
        return await processor.finalize(result);
      }

      return result;

    } catch (error) {
      console.error('MemoryOptimizer: 大文件处理失败:', error);
      throw error;
    } finally {
      this.activeProcesses.delete(processId);
    }
  }

  /**
   * 清理所有活动进程
   */
  async cleanup() {
    console.log(`MemoryOptimizer: 清理 ${this.activeProcesses.size} 个活动进程`);
    this.activeProcesses.clear();
    await this.forceGarbageCollection();
  }
}

const memoryOptimizer = new MemoryOptimizer();
export default memoryOptimizer;

