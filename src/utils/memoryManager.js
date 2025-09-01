import { Alert } from 'react-native';

/**
 * 内存管理工具
 * 用于检测和处理内存不足问题
 */
class MemoryManager {
  constructor() {
    this.memoryWarnings = [];
    this.lastCleanupTime = 0;
  }

  /**
   * 检查内存状态 - 增强版，支持大内存
   */
  async checkMemoryStatus() {
    try {
      // 使用更大的测试大小来评估内存容量
      const testSizes = [1024 * 1024, 5 * 1024 * 1024, 10 * 1024 * 1024, 20 * 1024 * 1024]; // 1MB, 5MB, 10MB, 20MB
      let maxAllocatable = 0;
      let estimatedFree = 0;
      
      for (const testSize of testSizes) {
        try {
          // 尝试分配测试大小的内存
          const testBuffer = Buffer.alloc(testSize);
          testBuffer.fill(0);
          maxAllocatable = testSize;
          estimatedFree = testSize * 4; // 如果能分配，估计有4倍可用
          console.log(`MemoryManager: 成功分配 ${testSize / 1024 / 1024}MB 内存`);
        } catch (error) {
          console.log(`MemoryManager: 无法分配 ${testSize / 1024 / 1024}MB 内存: ${error.message}`);
          break;
        }
      }
      
      // 如果没有成功分配任何内存，使用保守估计
      if (maxAllocatable === 0) {
        estimatedFree = 512 * 1024; // 512KB
      }
      
      // 更宽松的内存充足判断，支持大文件
      const hasEnoughMemory = estimatedFree > 10 * 1024 * 1024; // 需要至少10MB
      
      console.log(`MemoryManager: 内存状态 - 最大可分配: ${maxAllocatable / 1024 / 1024}MB, 估计可用: ${estimatedFree / 1024 / 1024}MB, 充足: ${hasEnoughMemory}`);
      
      return {
        hasEnoughMemory,
        available: hasEnoughMemory,
        estimatedFree,
        maxAllocatable,
        warning: hasEnoughMemory ? null : `可用内存不足 ${(estimatedFree / 1024 / 1024).toFixed(2)}MB`,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('MemoryManager: 内存状态检查失败:', error);
      return {
        hasEnoughMemory: false,
        available: false,
        estimatedFree: 0,
        maxAllocatable: 0,
        warning: '无法检测内存状态',
        timestamp: Date.now()
      };
    }
  }

  /**
   * 内存清理 - 超安全模式（完全避免func.apply错误）
   */
  async cleanupMemory() {
    try {
      console.log('MemoryManager: 开始超安全内存清理...');
      
      // 1. 清理React Native相关缓存
      try {
        if (global.__REACT_DEVTOOLS_GLOBAL_HOOK__) {
          delete global.__REACT_DEVTOOLS_GLOBAL_HOOK__;
        }
      } catch (hookError) {
        console.warn('MemoryManager: React DevTools清理失败:', hookError.message);
      }
      
      // 2. 超安全垃圾回收
      try {
        if (global.gc && typeof global.gc === 'function') {
          global.gc();
          // 使用setTimeout而不是Promise.race来避免可能的异步问题
          setTimeout(() => {}, 50);
        }
      } catch (gcError) {
        console.warn('MemoryManager: 垃圾回收失败:', gcError.message);
      }
      
      // 3. 清理内存警告记录
      try {
        this.memoryWarnings = [];
      } catch (warningError) {
        console.warn('MemoryManager: 警告记录清理失败:', warningError.message);
      }
      
      // 4. 超安全清理Buffer缓存
      try {
        if (global.Buffer && typeof global.Buffer.poolSize !== 'undefined') {
          global.Buffer.poolSize = 0;
        }
      } catch (bufferError) {
        console.warn('MemoryManager: Buffer缓存清理失败:', bufferError.message);
      }
      
      this.lastCleanupTime = Date.now();
      console.log('MemoryManager: 超安全内存清理完成');
      
      return true;
    } catch (error) {
      console.error('MemoryManager: 内存清理失败:', error);
      return false;
    }
  }

  /**
   * 显示内存不足警告
   */
  showMemoryWarning(fileSize) {
    try {
      const warning = {
        id: Date.now(),
        message: `文件过大 (${(fileSize / 1024 / 1024).toFixed(1)}MB)，可能导致内存不足`,
        timestamp: Date.now()
      };
      
      this.memoryWarnings.push(warning);
      
      // 使用安全的回调函数，避免func.apply错误
      const safeCleanupCallback = () => {
        try {
          this.cleanupMemory().catch(error => {
            console.warn('MemoryManager: 清理回调失败:', error.message);
          });
        } catch (callbackError) {
          console.warn('MemoryManager: 清理回调执行失败:', callbackError.message);
        }
      };
      
      Alert.alert(
        '内存不足警告',
        `当前文件较大，可能导致应用内存不足。建议：\n\n1. 使用原生应用打开\n2. 清理设备内存后重试\n3. 选择较小的文件`,
        [
          { text: '取消', style: 'cancel' },
          { text: '继续尝试', onPress: safeCleanupCallback }
        ]
      );
    } catch (error) {
      console.error('MemoryManager: 显示内存警告失败:', error);
    }
  }

  /**
   * 检查是否需要内存清理
   */
  shouldCleanupMemory() {
    const now = Date.now();
    const timeSinceLastCleanup = now - this.lastCleanupTime;
    const memoryWarningCount = this.memoryWarnings.length;
    
    // 如果距离上次清理超过5分钟，或者有多个内存警告，建议清理
    return timeSinceLastCleanup > 5 * 60 * 1000 || memoryWarningCount > 2;
  }

  /**
   * 获取内存使用统计
   */
  getMemoryStats() {
    return {
      warnings: this.memoryWarnings.length,
      lastCleanup: this.lastCleanupTime,
      shouldCleanup: this.shouldCleanupMemory()
    };
  }

  /**
   * 重置内存管理器状态
   */
  reset() {
    this.memoryWarnings = [];
    this.lastCleanupTime = 0;
    console.log('MemoryManager: 状态已重置');
  }
}

export default new MemoryManager();

