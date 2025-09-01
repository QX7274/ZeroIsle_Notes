import { Alert } from 'react-native';

/**
 * 大内存分配器
 * 专门用于分配和管理GB级别的内存
 */
class LargeMemoryAllocator {
  constructor() {
    this.allocatedMemory = new Map();
    this.memoryPools = new Map();
    this.totalAllocated = 0;
    this.maxMemoryGB = 4; // 最大4GB内存
    this.memoryChunks = [];
  }

  /**
   * 初始化大内存池
   */
  async initializeMemoryPool(targetGB = 2) {
    try {
      console.log(`LargeMemoryAllocator: 开始初始化 ${targetGB}GB 内存池...`);
      
      const targetBytes = targetGB * 1024 * 1024 * 1024; // 转换为字节
      const chunkSize = 100 * 1024 * 1024; // 100MB块
      const chunks = Math.ceil(targetBytes / chunkSize);
      
      console.log(`LargeMemoryAllocator: 目标内存: ${targetGB}GB, 块大小: 100MB, 块数量: ${chunks}`);
      
      // 逐步分配内存块
      for (let i = 0; i < chunks; i++) {
        try {
          const chunk = this.allocateMemoryChunk(chunkSize);
          this.memoryChunks.push(chunk);
          this.totalAllocated += chunkSize;
          
          console.log(`LargeMemoryAllocator: 已分配第 ${i + 1}/${chunks} 块 (${(this.totalAllocated / 1024 / 1024 / 1024).toFixed(2)}GB)`);
          
          // 每分配几个块后暂停一下，避免阻塞UI
          if ((i + 1) % 5 === 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (error) {
          console.warn(`LargeMemoryAllocator: 第 ${i + 1} 块分配失败:`, error.message);
          break;
        }
      }
      
      console.log(`LargeMemoryAllocator: 内存池初始化完成，总分配: ${(this.totalAllocated / 1024 / 1024 / 1024).toFixed(2)}GB`);
      
      return {
        success: true,
        allocatedGB: this.totalAllocated / 1024 / 1024 / 1024,
        chunks: this.memoryChunks.length
      };
    } catch (error) {
      console.error('LargeMemoryAllocator: 内存池初始化失败:', error);
      return {
        success: false,
        error: error.message,
        allocatedGB: this.totalAllocated / 1024 / 1024 / 1024
      };
    }
  }

  /**
   * 分配内存块
   */
  allocateMemoryChunk(size) {
    try {
      // 使用Buffer分配内存
      const buffer = Buffer.alloc(size);
      
      // 安全填充数据以确保内存被实际分配
      try {
        for (let i = 0; i < size; i += 1024) {
          if (i < buffer.length) {
            buffer[i] = Math.floor(Math.random() * 255);
          }
        }
      } catch (fillError) {
        console.warn('LargeMemoryAllocator: 内存填充失败，但分配成功:', fillError.message);
      }
      
      return {
        id: Date.now() + Math.random(),
        buffer,
        size,
        allocatedAt: Date.now()
      };
    } catch (error) {
      throw new Error(`内存块分配失败: ${error.message}`);
    }
  }

  /**
   * 分配指定大小的内存
   */
  async allocateMemory(sizeMB, purpose = 'general') {
    try {
      console.log(`LargeMemoryAllocator: 请求分配 ${sizeMB}MB 内存用于 ${purpose}`);
      
      const sizeBytes = sizeMB * 1024 * 1024;
      
      // 检查是否有足够的内存
      if (this.totalAllocated + sizeBytes > this.maxMemoryGB * 1024 * 1024 * 1024) {
        throw new Error(`内存不足: 已分配 ${(this.totalAllocated / 1024 / 1024 / 1024).toFixed(2)}GB，请求 ${sizeMB}MB`);
      }
      
      // 分配内存
      const memoryChunk = this.allocateMemoryChunk(sizeBytes);
      
      // 记录分配
      this.allocatedMemory.set(memoryChunk.id, {
        ...memoryChunk,
        purpose,
        allocatedAt: Date.now()
      });
      
      this.totalAllocated += sizeBytes;
      
      console.log(`LargeMemoryAllocator: 成功分配 ${sizeMB}MB 内存，总分配: ${(this.totalAllocated / 1024 / 1024 / 1024).toFixed(2)}GB`);
      
      return {
        success: true,
        memoryId: memoryChunk.id,
        sizeMB,
        totalAllocatedGB: this.totalAllocated / 1024 / 1024 / 1024
      };
    } catch (error) {
      console.error('LargeMemoryAllocator: 内存分配失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 释放内存
   */
  releaseMemory(memoryId) {
    try {
      const memory = this.allocatedMemory.get(memoryId);
      if (!memory) {
        console.warn(`LargeMemoryAllocator: 内存ID ${memoryId} 不存在`);
        return false;
      }
      
      // 释放Buffer
      if (memory.buffer) {
        memory.buffer = null;
      }
      
      // 从记录中移除
      this.allocatedMemory.delete(memoryId);
      this.totalAllocated -= memory.size;
      
      console.log(`LargeMemoryAllocator: 释放内存 ${memoryId}，剩余: ${(this.totalAllocated / 1024 / 1024 / 1024).toFixed(2)}GB`);
      
      return true;
    } catch (error) {
      console.error('LargeMemoryAllocator: 内存释放失败:', error);
      return false;
    }
  }

  /**
   * 获取内存状态
   */
  getMemoryStatus() {
    return {
      totalAllocatedGB: this.totalAllocated / 1024 / 1024 / 1024,
      maxMemoryGB: this.maxMemoryGB,
      availableGB: this.maxMemoryGB - (this.totalAllocated / 1024 / 1024 / 1024),
      allocatedChunks: this.allocatedMemory.size,
      memoryChunks: this.memoryChunks.length
    };
  }

  /**
   * 清理所有内存
   */
  async cleanupAllMemory() {
    try {
      console.log('LargeMemoryAllocator: 开始清理所有内存...');
      
      // 释放所有分配的内存
      for (const [memoryId, memory] of this.allocatedMemory) {
        this.releaseMemory(memoryId);
      }
      
      // 清理内存块
      this.memoryChunks.forEach(chunk => {
        if (chunk.buffer) {
          chunk.buffer = null;
        }
      });
      this.memoryChunks = [];
      
      this.totalAllocated = 0;
      
      console.log('LargeMemoryAllocator: 所有内存已清理');
      
      return true;
    } catch (error) {
      console.error('LargeMemoryAllocator: 内存清理失败:', error);
      return false;
    }
  }

  /**
   * 为PPT处理分配大内存
   */
  async allocatePPTMemory(fileSizeMB) {
    try {
      console.log(`LargeMemoryAllocator: 为PPT文件分配内存，文件大小: ${fileSizeMB}MB`);
      
      // 计算需要的内存：文件大小的3倍用于处理
      const requiredMemoryMB = Math.min(fileSizeMB * 3, 2048); // 最大2GB
      
      console.log(`LargeMemoryAllocator: 计算所需内存: ${requiredMemoryMB}MB`);
      
      const result = await this.allocateMemory(requiredMemoryMB, 'ppt_processing');
      
      if (result.success) {
        console.log(`LargeMemoryAllocator: PPT内存分配成功: ${requiredMemoryMB}MB`);
        return result;
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('LargeMemoryAllocator: PPT内存分配失败:', error);
      throw error;
    }
  }

  /**
   * 显示内存状态警告
   */
  showMemoryWarning() {
    const status = this.getMemoryStatus();
    
    Alert.alert(
      '大内存分配器状态',
      `已分配内存: ${status.totalAllocatedGB.toFixed(2)}GB\n` +
      `可用内存: ${status.availableGB.toFixed(2)}GB\n` +
      `内存块数量: ${status.allocatedChunks}\n\n` +
      `建议在内存不足时清理不必要的内存。`,
      [
        { text: '清理内存', onPress: () => this.cleanupAllMemory() },
        { text: '确定', style: 'cancel' }
      ]
    );
  }

  /**
   * 检查内存是否充足
   */
  hasEnoughMemory(requiredMB) {
    const status = this.getMemoryStatus();
    const requiredGB = requiredMB / 1024;
    
    return status.availableGB >= requiredGB;
  }

  /**
   * 获取内存使用统计
   */
  getMemoryStats() {
    const status = this.getMemoryStatus();
    const allocations = Array.from(this.allocatedMemory.values());
    
    return {
      ...status,
      allocations: allocations.map(alloc => ({
        id: alloc.id,
        sizeMB: alloc.size / 1024 / 1024,
        purpose: alloc.purpose,
        allocatedAt: alloc.allocatedAt
      })),
      averageAllocationMB: allocations.length > 0 ? 
        allocations.reduce((sum, alloc) => sum + alloc.size / 1024 / 1024, 0) / allocations.length : 0
    };
  }
}

export default new LargeMemoryAllocator();
