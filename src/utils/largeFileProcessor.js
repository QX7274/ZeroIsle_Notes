import RNFS from 'react-native-fs';
import enhancedMemoryManager from './enhancedMemoryManager';

/**
 * 大文件处理器
 * 支持100MB文件的智能分块处理和内存优化
 */
class LargeFileProcessor {
  constructor() {
    this.maxChunkSize = 5 * 1024 * 1024; // 5MB块大小
    this.processingFiles = new Map();
    this.chunkCache = new Map();
  }

  /**
   * 处理大文件转换
   */
  async processLargeFile(filePath, options = {}) {
    const {
      onProgress = null,
      maxFileSize = 100 * 1024 * 1024, // 100MB
      chunkSize = this.maxChunkSize,
      signal = null
    } = options;

    try {
      // 检查文件是否可以处理
      const fileStats = await RNFS.stat(filePath);
      const processCheck = await enhancedMemoryManager.canProcessFile(filePath, fileStats.size);
      
      if (!processCheck.canProcess) {
        throw new Error(`${processCheck.reason}。${processCheck.suggestion}`);
      }

      // 标记文件开始处理
      enhancedMemoryManager.markFileProcessing(filePath);
      this.processingFiles.set(filePath, {
        startTime: Date.now(),
        fileSize: fileStats.size,
        status: 'processing'
      });

      console.log(`LargeFileProcessor: 开始处理大文件: ${(fileStats.size / 1024 / 1024).toFixed(2)}MB`);

      // 分块读取文件
      const chunks = await this.readFileInChunks(filePath, chunkSize, onProgress, signal);
      
      if (onProgress) {
        onProgress({
          stage: 'chunks_ready',
          progress: 30,
          message: `文件分块完成，共${chunks.length}块`
        });
      }

      // 处理文件块
      const result = await this.processChunks(chunks, filePath, onProgress, signal);

      // 标记文件处理完成
      enhancedMemoryManager.markFileCompleted(filePath);
      this.processingFiles.delete(filePath);

      console.log(`LargeFileProcessor: 大文件处理完成: ${filePath}`);
      return result;

    } catch (error) {
      // 清理处理状态
      enhancedMemoryManager.markFileCompleted(filePath);
      this.processingFiles.delete(filePath);
      
      console.error('LargeFileProcessor: 大文件处理失败:', error);
      throw error;
    }
  }

  /**
   * 分块读取文件
   */
  async readFileInChunks(filePath, chunkSize, onProgress, signal) {
    try {
      const fileStats = await RNFS.stat(filePath);
      const fileSize = fileStats.size;
      const totalChunks = Math.ceil(fileSize / chunkSize);
      const chunks = [];

      console.log(`LargeFileProcessor: 开始分块读取，文件大小: ${(fileSize / 1024 / 1024).toFixed(2)}MB，块大小: ${(chunkSize / 1024 / 1024).toFixed(2)}MB，总块数: ${totalChunks}`);

      for (let i = 0; i < totalChunks; i++) {
        // 检查是否被取消
        if (signal && signal.aborted) {
          throw new Error('文件处理已取消');
        }

        const offset = i * chunkSize;
        const size = Math.min(chunkSize, fileSize - offset);

        // 读取当前块
        const chunk = await RNFS.read(filePath, size, offset, 'base64');
        chunks.push({
          index: i,
          data: chunk,
          size: size,
          offset: offset,
          progress: (i / totalChunks) * 100
        });

        // 更新进度
        if (onProgress) {
          const progress = Math.round((i / totalChunks) * 30); // 前30%用于读取
          onProgress({
            stage: 'reading',
            progress: progress,
            message: `正在读取第${i + 1}/${totalChunks}块...`
          });
        }

        // 每读取几块就让出控制权，避免阻塞UI
        if ((i + 1) % 3 === 0) {
          await this.yieldControl();
        }

        // 检查内存状态
        if ((i + 1) % 5 === 0) {
          await this.checkMemoryStatus();
        }
      }

      console.log(`LargeFileProcessor: 文件分块读取完成，共 ${chunks.length} 块`);
      return chunks;

    } catch (error) {
      console.error('LargeFileProcessor: 文件分块读取失败:', error);
      throw new Error(`文件读取失败: ${error.message}`);
    }
  }

  /**
   * 处理文件块
   */
  async processChunks(chunks, filePath, onProgress, signal) {
    try {
      const totalChunks = chunks.length;
      let processedChunks = 0;

      console.log(`LargeFileProcessor: 开始处理文件块，共 ${totalChunks} 块`);

      for (let i = 0; i < totalChunks; i++) {
        // 检查是否被取消
        if (signal && signal.aborted) {
          throw new Error('文件处理已取消');
        }

        const chunk = chunks[i];
        
        // 处理当前块（这里可以根据需要实现具体的处理逻辑）
        await this.processSingleChunk(chunk, i, totalChunks);
        
        processedChunks++;
        
        // 更新进度
        if (onProgress) {
          const progress = 30 + Math.round((processedChunks / totalChunks) * 60); // 30%-90%
          onProgress({
            stage: 'processing',
            progress: progress,
            message: `正在处理第${processedChunks}/${totalChunks}块...`
          });
        }

        // 每处理几块就让出控制权
        if ((i + 1) % 2 === 0) {
          await this.yieldControl();
        }

        // 定期检查内存状态
        if ((i + 1) % 5 === 0) {
          await this.checkMemoryStatus();
        }

        // 清理已处理的块数据，释放内存
        if (i > 0) {
          chunks[i - 1].data = null;
        }
      }

      // 最终清理
      chunks.forEach(chunk => chunk.data = null);
      
      console.log(`LargeFileProcessor: 文件块处理完成`);
      
      return {
        success: true,
        processedChunks: totalChunks,
        filePath: filePath,
        message: '大文件处理完成'
      };

    } catch (error) {
      console.error('LargeFileProcessor: 文件块处理失败:', error);
      throw error;
    }
  }

  /**
   * 处理单个文件块
   */
  async processSingleChunk(chunk, index, totalChunks) {
    try {
      // 模拟处理时间（实际应用中这里会进行具体的文件处理）
      const processingTime = Math.min(100, chunk.size / (1024 * 1024) * 50); // 根据块大小计算处理时间
      
      await new Promise(resolve => setTimeout(resolve, processingTime));
      
      console.log(`LargeFileProcessor: 处理第${index + 1}/${totalChunks}块完成，大小: ${(chunk.size / 1024 / 1024).toFixed(2)}MB`);
      
    } catch (error) {
      console.error(`LargeFileProcessor: 处理第${index + 1}块失败:`, error);
      throw error;
    }
  }

  /**
   * 检查内存状态
   */
  async checkMemoryStatus() {
    try {
      const memoryStatus = await enhancedMemoryManager.checkMemoryStatus();
      
      if (memoryStatus.usage > 0.8) {
        console.warn('LargeFileProcessor: 内存使用率较高，开始清理...');
        await enhancedMemoryManager.cleanupMemory();
      }
      
    } catch (error) {
      console.warn('LargeFileProcessor: 内存状态检查失败:', error);
    }
  }

  /**
   * 让出控制权
   */
  async yieldControl() {
    return new Promise(resolve => {
      setTimeout(resolve, 10); // 10ms延迟
    });
  }

  /**
   * 获取处理状态
   */
  getProcessingStatus(filePath) {
    return this.processingFiles.get(filePath) || null;
  }

  /**
   * 取消文件处理
   */
  cancelFileProcessing(filePath) {
    const fileInfo = this.processingFiles.get(filePath);
    if (fileInfo) {
      fileInfo.status = 'cancelled';
      console.log(`LargeFileProcessor: 文件处理已取消: ${filePath}`);
    }
  }

  /**
   * 清理缓存
   */
  clearCache() {
    this.chunkCache.clear();
    console.log('LargeFileProcessor: 缓存已清理');
  }

  /**
   * 获取统计信息
   */
  getStats() {
    return {
      processingFiles: this.processingFiles.size,
      chunkCacheSize: this.chunkCache.size,
      maxChunkSize: this.maxChunkSize / 1024 / 1024 // MB
    };
  }
}

// 创建单例实例
const largeFileProcessor = new LargeFileProcessor();

export default largeFileProcessor;







