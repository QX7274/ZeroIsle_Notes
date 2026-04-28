import { Alert } from 'react-native';
import RNFS from 'react-native-fs';

/**
 * 增强内存管理器
 * 支持GB级大文件处理，智能内存分配和分块处理
 * 默认可用内存：3GB，支持处理数百MB甚至GB级文件
 */
class EnhancedMemoryManager {
  constructor() {
    this.memoryWarnings = [];
    this.lastCleanupTime = 0;
    this.maxFileSize = 10 * 1024 * 1024 * 1024; // 10GB限制
    this.memoryChunks = new Map();
    this.processingFiles = new Set();
  }

  /**
   * 智能内存状态检查
   */
  async checkMemoryStatus() {
    try {
      // 使用多种方法检测内存状态
      const memoryInfo = await this.getComprehensiveMemoryInfo();

      console.log('EnhancedMemoryManager: 内存状态检查完成:', {
        available: Math.round(memoryInfo.available / 1024 / 1024) + 'MB',
        total: Math.round(memoryInfo.total / 1024 / 1024) + 'MB',
        used: Math.round(memoryInfo.used / 1024 / 1024) + 'MB',
        usage: Math.round(memoryInfo.usage * 100) + '%',
      });

      return {
        hasEnoughMemory: memoryInfo.available > 200 * 1024 * 1024, // 至少200MB可用
        available: memoryInfo.available,
        total: memoryInfo.total,
        used: memoryInfo.used,
        usage: memoryInfo.usage,
        warning: memoryInfo.usage > 0.8 ? '内存使用率较高' : null,
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('EnhancedMemoryManager: 内存状态检查失败:', error);
      return {
        hasEnoughMemory: false,
        available: 0,
        total: 0,
        used: 0,
        usage: 1,
        warning: '无法检测内存状态',
        timestamp: Date.now(),
      };
    }
  }

  /**
   * 获取综合内存信息
   */
  async getComprehensiveMemoryInfo() {
    let available = 0;
    let total = 0;
    let used = 0;

    // 方法1: 使用performance.memory (Chrome/React Native)
    if (global.performance && global.performance.memory) {
      const memInfo = global.performance.memory;
      total = memInfo.jsHeapSizeLimit;
      used = memInfo.usedJSHeapSize;
      available = total - used;
    }

    // 方法2: 使用process.memoryUsage (Node.js环境)
    if (global.process && global.process.memoryUsage) {
      const memUsage = global.process.memoryUsage();
      if (memUsage.heapTotal > 0) {
        total = Math.max(total, memUsage.heapTotal);
        used = Math.max(used, memUsage.heapUsed);
        available = Math.max(available, total - used);
      }
    }

    // 方法3: 使用Buffer测试分配能力
    if (available === 0) {
      available = await this.testBufferAllocation();
    }

    // 如果没有获取到有效信息，使用保守估计
    if (available === 0) {
      available = 3 * 1024 * 1024 * 1024; // 3GB保守估计
      total = 6 * 1024 * 1024 * 1024;     // 6GB总内存
      used = 3 * 1024 * 1024 * 1024;      // 3GB已使用
    }

    return {
      available,
      total,
      used,
      usage: used / total,
    };
  }

  /**
   * 测试Buffer分配能力
   */
  async testBufferAllocation() {
    const testSizes = [
      1024 * 1024,          // 1MB
      10 * 1024 * 1024,     // 10MB
      50 * 1024 * 1024,     // 50MB
      100 * 1024 * 1024,    // 100MB
      500 * 1024 * 1024,    // 500MB
      1024 * 1024 * 1024,    // 1GB
    ];

    let maxAllocatable = 0;

    for (const size of testSizes) {
      try {
        let testBuffer = Buffer.alloc(size);
        testBuffer.fill(0);
        maxAllocatable = size;

        // 立即释放测试内存
        testBuffer = null;

        console.log(`EnhancedMemoryManager: 成功分配 ${size / 1024 / 1024}MB 测试内存`);
      } catch (error) {
        console.log(`EnhancedMemoryManager: 无法分配 ${size / 1024 / 1024}MB 测试内存: ${error.message}`);
        break;
      }
    }

    // 如果能分配成功，估计有3倍可用内存
    return maxAllocatable * 3;
  }

  /**
   * 检查文件是否可以安全处理
   */
  async canProcessFile(filePath, fileSize) {
    try {
      // 检查内存状态
      const memoryStatus = await this.checkMemoryStatus();

      // 计算所需内存（PPT需要3倍，PDF需要2倍）
      const fileExtension = this.getFileExtension(filePath);
      const multiplier = this.getMemoryMultiplier(fileExtension);
      const requiredMemory = fileSize * multiplier;

      if (memoryStatus.available < requiredMemory) {
        return {
          canProcess: false,
          reason: `内存不足，需要${Math.round(requiredMemory / 1024 / 1024)}MB，可用${Math.round(memoryStatus.available / 1024 / 1024)}MB`,
          suggestion: '请关闭其他应用释放内存，或选择较小的文件',
        };
      }

      // 检查是否已有文件在处理
      if (this.processingFiles.has(filePath)) {
        return {
          canProcess: false,
          reason: '文件正在处理中，请等待完成',
          suggestion: '请稍后重试',
        };
      }

      return {
        canProcess: true,
        requiredMemory,
        availableMemory: memoryStatus.available,
        memoryUsage: memoryStatus.usage,
      };
    } catch (error) {
      console.error('EnhancedMemoryManager: 文件处理检查失败:', error);
      return {
        canProcess: false,
        reason: '内存检查失败',
        suggestion: '请重试或重启应用',
      };
    }
  }

  /**
   * 获取文件扩展名
   */
  getFileExtension(filePath) {
    if (!filePath) { return ''; }
    const parts = filePath.split('.');
    return parts.length > 1 ? parts.pop().toLowerCase() : '';
  }

  /**
   * 获取内存倍数
   */
  getMemoryMultiplier(fileExtension) {
    const multipliers = {
      'ppt': 3,   // PPT需要3倍内存
      'pptx': 3,
      'doc': 3,   // Word需要3倍内存
      'docx': 3,
      'pdf': 2,   // PDF需要2倍内存
      'xls': 2,   // Excel需要2倍内存
      'xlsx': 2,
      'default': 2, // 默认2倍
    };

    return multipliers[fileExtension] || multipliers.default;
  }

  /**
   * 分块读取文件
   */
  async readFileInChunks(filePath, chunkSize = 1024 * 1024) {
    try {
      const fileStats = await RNFS.stat(filePath);
      const fileSize = fileStats.size;
      const chunks = [];

      console.log(`EnhancedMemoryManager: 开始分块读取文件，大小: ${(fileSize / 1024 / 1024).toFixed(2)}MB，块大小: ${(chunkSize / 1024 / 1024).toFixed(2)}MB`);

      // 计算块数
      const totalChunks = Math.ceil(fileSize / chunkSize);

      for (let i = 0; i < totalChunks; i++) {
        const offset = i * chunkSize;
        const size = Math.min(chunkSize, fileSize - offset);

        // 读取当前块
        const chunk = await RNFS.read(filePath, size, offset, 'base64');
        chunks.push({
          index: i,
          data: chunk,
          size: size,
          offset: offset,
        });

        // 每读取几块就让出控制权
        if ((i + 1) % 5 === 0) {
          await this.yieldControl();
          console.log(`EnhancedMemoryManager: 已读取 ${i + 1}/${totalChunks} 块`);
        }
      }

      console.log(`EnhancedMemoryManager: 文件分块读取完成，共 ${chunks.length} 块`);
      return chunks;
    } catch (error) {
      console.error('EnhancedMemoryManager: 文件分块读取失败:', error);
      throw new Error(`文件读取失败: ${error.message}`);
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
   * 标记文件开始处理
   */
  markFileProcessing(filePath) {
    this.processingFiles.add(filePath);
    console.log(`EnhancedMemoryManager: 标记文件开始处理: ${filePath}`);
  }

  /**
   * 标记文件处理完成
   */
  markFileCompleted(filePath) {
    this.processingFiles.delete(filePath);
    console.log(`EnhancedMemoryManager: 标记文件处理完成: ${filePath}`);
  }

  /**
   * 智能内存清理
   */
  async cleanupMemory() {
    try {
      console.log('EnhancedMemoryManager: 开始智能内存清理...');

      // 清理内存块
      this.memoryChunks.clear();

      // 强制垃圾回收
      if (global.gc && typeof global.gc === 'function') {
        global.gc();
        console.log('EnhancedMemoryManager: 垃圾回收完成');
      }

      // 清理Buffer缓存
      if (global.Buffer && typeof global.Buffer.poolSize !== 'undefined') {
        global.Buffer.poolSize = 0;
        console.log('EnhancedMemoryManager: Buffer缓存清理完成');
      }

      this.lastCleanupTime = Date.now();
      console.log('EnhancedMemoryManager: 智能内存清理完成');

      return true;
    } catch (error) {
      console.error('EnhancedMemoryManager: 内存清理失败:', error);
      return false;
    }
  }

  /**
   * 显示内存警告
   */
  showMemoryWarning(message, suggestions = []) {
    const defaultSuggestions = [
      '关闭其他应用释放内存',
      '选择较小的文件',
      '重启应用清理内存',
    ];

    Alert.alert(
      '内存不足',
      message,
      [
        { text: '清理内存', onPress: () => this.cleanupMemory() },
        { text: '取消', style: 'cancel' },
      ]
    );
  }

  /**
   * 获取内存使用统计
   */
  getMemoryStats() {
    return {
      maxFileSize: this.maxFileSize / 1024 / 1024, // MB
      processingFiles: this.processingFiles.size,
      memoryChunks: this.memoryChunks.size,
      lastCleanup: this.lastCleanupTime,
    };
  }
}

// 创建单例实例
const enhancedMemoryManager = new EnhancedMemoryManager();

module.exports = enhancedMemoryManager;
module.exports.default = enhancedMemoryManager;
module.exports.EnhancedMemoryManager = EnhancedMemoryManager;








