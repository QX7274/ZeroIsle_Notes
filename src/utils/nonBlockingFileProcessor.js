/**
 * 非阻塞文件处理器
 * 专门解决大文件导入时的UI阻塞问题
 */

import RNFS from 'react-native-fs';
import { Platform } from 'react-native';

class NonBlockingFileProcessor {
  constructor() {
    this.processingFiles = new Map();
    this.chunkSize = 1024 * 1024; // 1MB块大小
    this.yieldInterval = 16; // 16ms，约60fps
    this.maxProcessingTime = 50; // 50ms最大处理时间
  }

  /**
   * 非阻塞文件上传
   */
  async uploadFileNonBlocking(filePath, options = {}) {
    const {
      onProgress,
      onSuccess,
      onError,
      signal,
      chunkSize = this.chunkSize,
      yieldInterval = this.yieldInterval
    } = options;

    const fileId = Date.now().toString();
    this.processingFiles.set(fileId, { status: 'processing', startTime: Date.now() });

    try {
      // 获取文件信息
      const fileStats = await this.getFileStats(filePath);
      const totalChunks = Math.ceil(fileStats.size / chunkSize);
      
      console.log(`NonBlockingFileProcessor: 开始处理文件 ${filePath}, 大小: ${Math.round(fileStats.size / 1024 / 1024)}MB, 分块数: ${totalChunks}`);

      if (onProgress) {
        onProgress({
          stage: 'preparing',
          progress: 0,
          message: '正在准备文件...',
          totalChunks,
          processedChunks: 0
        });
      }

      // 分块读取文件
      const chunks = await this.readFileInChunksNonBlocking(
        filePath, 
        chunkSize, 
        totalChunks,
        (chunkIndex, totalChunks) => {
          if (onProgress) {
            const progress = Math.round((chunkIndex / totalChunks) * 40); // 读取占40%
            onProgress({
              stage: 'reading',
              progress,
              message: `正在读取文件... ${chunkIndex}/${totalChunks}`,
              totalChunks,
              processedChunks: chunkIndex
            });
          }
        },
        yieldInterval
      );

      if (signal && signal.aborted) {
        throw new Error('文件处理已取消');
      }

      if (onProgress) {
        onProgress({
          stage: 'processing',
          progress: 40,
          message: '正在处理文件内容...',
          totalChunks,
          processedChunks: totalChunks
        });
      }

      // 模拟处理时间，但保持非阻塞
      await this.processChunksNonBlocking(chunks, totalChunks, onProgress, yieldInterval);

      if (signal && signal.aborted) {
        throw new Error('文件处理已取消');
      }

      if (onProgress) {
        onProgress({
          stage: 'complete',
          progress: 100,
          message: '文件处理完成！',
          totalChunks,
          processedChunks: totalChunks
        });
      }

      const result = {
        success: true,
        filePath,
        fileSize: fileStats.size,
        totalChunks,
        message: '文件处理完成'
      };

      this.processingFiles.set(fileId, { status: 'completed', endTime: Date.now() });
      
      if (onSuccess) {
        onSuccess(result);
      }

      return result;

    } catch (error) {
      console.error('NonBlockingFileProcessor: 文件处理失败:', error);
      
      this.processingFiles.set(fileId, { status: 'failed', error: error.message, endTime: Date.now() });
      
      if (onError) {
        onError(error);
      }
      
      throw error;
    }
  }

  /**
   * 非阻塞分块读取文件
   */
  async readFileInChunksNonBlocking(filePath, chunkSize, totalChunks, onChunkRead, yieldInterval) {
    const chunks = [];
    let startTime = Date.now(); // Initialize startTime here

    for (let i = 0; i < totalChunks; i++) {
      const start = i * chunkSize;
      const end = Math.min(start + chunkSize, (await this.getFileStats(filePath)).size);
      
      try {
        // 读取当前块
        const chunk = await RNFS.read(filePath, end - start, start, 'base64');
        chunks.push(chunk);

        if (onChunkRead) {
          onChunkRead(i + 1, totalChunks);
        }

        // 检查是否需要让出控制权
        const currentTime = Date.now();
        if (currentTime - startTime > this.maxProcessingTime) {
          await this.yieldControl(yieldInterval);
          // 重置计时器
          startTime = currentTime;
        }

      } catch (error) {
        console.error(`NonBlockingFileProcessor: 读取第${i + 1}块失败:`, error);
        throw new Error(`读取文件块失败: ${error.message}`);
      }
    }

    return chunks;
  }

  /**
   * 非阻塞处理文件块
   */
  async processChunksNonBlocking(chunks, totalChunks, onProgress, yieldInterval) {
    const startTime = Date.now();
    let processedChunks = 0;

    for (let i = 0; i < chunks.length; i++) {
      // 模拟处理每个块
      await this.processSingleChunk(chunks[i], i);
      processedChunks++;

      // 更新进度
      if (onProgress) {
        const progress = 40 + Math.round((processedChunks / totalChunks) * 50); // 处理占50%
        onProgress({
          stage: 'processing',
          progress,
          message: `正在处理内容... ${processedChunks}/${totalChunks}`,
          totalChunks,
          processedChunks
        });
      }

      // 检查是否需要让出控制权
      const currentTime = Date.now();
      if (currentTime - startTime > this.maxProcessingTime) {
        await this.yieldControl(yieldInterval);
        // 重置计时器
        startTime = currentTime;
      }
    }
  }

  /**
   * 处理单个文件块
   */
  async processSingleChunk(chunk, index) {
    // 模拟处理时间，实际应用中这里可能是内容解析、格式转换等
    const processingTime = Math.random() * 10 + 5; // 5-15ms
    await this.sleep(processingTime);
    
    // 可以在这里添加实际的处理逻辑
    // 例如：解析PPT内容、提取文本、分析结构等
  }

  /**
   * 让出控制权，避免阻塞UI
   */
  async yieldControl(interval = this.yieldInterval) {
    return new Promise(resolve => {
      setTimeout(resolve, interval);
    });
  }

  /**
   * 获取文件统计信息
   */
  async getFileStats(filePath) {
    try {
      const stats = await RNFS.stat(filePath);
      return {
        size: stats.size,
        exists: true,
        path: filePath
      };
    } catch (error) {
      throw new Error(`无法获取文件信息: ${error.message}`);
    }
  }

  /**
   * 睡眠函数
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * 获取处理状态
   */
  getProcessingStatus(fileId) {
    return this.processingFiles.get(fileId) || { status: 'not_found' };
  }

  /**
   * 取消文件处理
   */
  cancelFileProcessing(fileId) {
    const fileInfo = this.processingFiles.get(fileId);
    if (fileInfo && fileInfo.status === 'processing') {
      fileInfo.status = 'cancelled';
      fileInfo.endTime = Date.now();
      this.processingFiles.set(fileId, fileInfo);
      return true;
    }
    return false;
  }

  /**
   * 清理完成的处理记录
   */
  cleanupCompletedFiles() {
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5分钟

    for (const [fileId, fileInfo] of this.processingFiles.entries()) {
      if (fileInfo.endTime && (now - fileInfo.endTime) > maxAge) {
        this.processingFiles.delete(fileId);
      }
    }
  }

  /**
   * 获取统计信息
   */
  getStats() {
    const stats = {
      total: this.processingFiles.size,
      processing: 0,
      completed: 0,
      failed: 0,
      cancelled: 0
    };

    for (const fileInfo of this.processingFiles.values()) {
      stats[fileInfo.status]++;
    }

    return stats;
  }
}

// 创建单例实例
const nonBlockingFileProcessor = new NonBlockingFileProcessor();

export default nonBlockingFileProcessor;







