import { Alert } from 'react-native';

/**
 * 通用GB级内存分配器
 * 支持所有文件类型的大内存分配和管理
 */
class UniversalMemoryAllocator {
  constructor() {
    this.allocatedMemory = new Map();
    this.memoryPools = new Map();
    this.totalAllocated = 0;
    this.maxMemoryGB = 4; // 最大4GB内存
    this.memoryChunks = [];
    this.fileTypeMemoryRequirements = {
      // 文档类型
      'pdf': { multiplier: 2, maxMB: 1024 }, // PDF文件：2倍文件大小，最大1GB
      'doc': { multiplier: 3, maxMB: 2048 }, // Word文档：3倍文件大小，最大2GB
      'docx': { multiplier: 3, maxMB: 2048 },
      'ppt': { multiplier: 3, maxMB: 2048 }, // PPT文件：3倍文件大小，最大2GB
      'pptx': { multiplier: 3, maxMB: 2048 },
      'xls': { multiplier: 2, maxMB: 1024 }, // Excel文件：2倍文件大小，最大1GB
      'xlsx': { multiplier: 2, maxMB: 1024 },
      
      // 图片类型
      'jpg': { multiplier: 1.5, maxMB: 512 }, // 图片文件：1.5倍文件大小，最大512MB
      'jpeg': { multiplier: 1.5, maxMB: 512 },
      'png': { multiplier: 1.5, maxMB: 512 },
      'gif': { multiplier: 1.5, maxMB: 512 },
      'bmp': { multiplier: 1.5, maxMB: 512 },
      'webp': { multiplier: 1.5, maxMB: 512 },
      
      // 视频类型
      'mp4': { multiplier: 1.2, maxMB: 2048 }, // 视频文件：1.2倍文件大小，最大2GB
      'avi': { multiplier: 1.2, maxMB: 2048 },
      'mov': { multiplier: 1.2, maxMB: 2048 },
      'mkv': { multiplier: 1.2, maxMB: 2048 },
      
      // 音频类型
      'mp3': { multiplier: 1.1, maxMB: 256 }, // 音频文件：1.1倍文件大小，最大256MB
      'wav': { multiplier: 1.1, maxMB: 256 },
      'm4a': { multiplier: 1.1, maxMB: 256 },
      'ogg': { multiplier: 1.1, maxMB: 256 },
      
      // 文本类型
      'txt': { multiplier: 1.5, maxMB: 128 }, // 文本文件：1.5倍文件大小，最大128MB
      'md': { multiplier: 1.5, maxMB: 128 },
      'json': { multiplier: 1.5, maxMB: 128 },
      'xml': { multiplier: 1.5, maxMB: 128 },
      
      // 代码类型
      'js': { multiplier: 1.2, maxMB: 64 }, // 代码文件：1.2倍文件大小，最大64MB
      'ts': { multiplier: 1.2, maxMB: 64 },
      'py': { multiplier: 1.2, maxMB: 64 },
      'java': { multiplier: 1.2, maxMB: 64 },
      'cpp': { multiplier: 1.2, maxMB: 64 },
      'c': { multiplier: 1.2, maxMB: 64 },
      'html': { multiplier: 1.2, maxMB: 64 },
      'css': { multiplier: 1.2, maxMB: 64 },
      
      // 默认类型
      'default': { multiplier: 2, maxMB: 512 } // 默认：2倍文件大小，最大512MB
    };
  }

  /**
   * 初始化通用内存池
   */
  async initializeMemoryPool(targetGB = 2) {
    try {
      console.log(`UniversalMemoryAllocator: 开始初始化 ${targetGB}GB 通用内存池...`);
      
      const targetBytes = targetGB * 1024 * 1024 * 1024;
      const chunkSize = 100 * 1024 * 1024; // 100MB块
      const chunks = Math.ceil(targetBytes / chunkSize);
      
      console.log(`UniversalMemoryAllocator: 目标内存: ${targetGB}GB, 块大小: 100MB, 块数量: ${chunks}`);
      
      // 逐步分配内存块
      for (let i = 0; i < chunks; i++) {
        try {
          const chunk = this.allocateMemoryChunk(chunkSize);
          this.memoryChunks.push(chunk);
          this.totalAllocated += chunkSize;
          
          console.log(`UniversalMemoryAllocator: 已分配第 ${i + 1}/${chunks} 块 (${(this.totalAllocated / 1024 / 1024 / 1024).toFixed(2)}GB)`);
          
          // 每分配几个块后暂停一下，避免阻塞UI
          if ((i + 1) % 5 === 0) {
            await new Promise(resolve => setTimeout(resolve, 100));
          }
        } catch (error) {
          console.warn(`UniversalMemoryAllocator: 第 ${i + 1} 块分配失败:`, error.message);
          break;
        }
      }
      
      console.log(`UniversalMemoryAllocator: 通用内存池初始化完成，总分配: ${(this.totalAllocated / 1024 / 1024 / 1024).toFixed(2)}GB`);
      
      return {
        success: true,
        allocatedGB: this.totalAllocated / 1024 / 1024 / 1024,
        chunks: this.memoryChunks.length
      };
    } catch (error) {
      console.error('UniversalMemoryAllocator: 通用内存池初始化失败:', error);
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
        console.warn('UniversalMemoryAllocator: 内存填充失败，但分配成功:', fillError.message);
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
   * 根据文件类型分配内存
   */
  async allocateMemoryForFile(filePath, fileSizeMB) {
    try {
      console.log(`UniversalMemoryAllocator: 为文件分配内存，路径: ${filePath}, 大小: ${fileSizeMB}MB`);
      
      // 获取文件扩展名
      const fileExtension = this.getFileExtension(filePath);
      console.log(`UniversalMemoryAllocator: 检测到文件类型: ${fileExtension}`);
      
      // 获取内存需求配置
      const memoryConfig = this.fileTypeMemoryRequirements[fileExtension] || this.fileTypeMemoryRequirements.default;
      
      // 计算需要的内存
      const requiredMemoryMB = Math.min(fileSizeMB * memoryConfig.multiplier, memoryConfig.maxMB);
      
      console.log(`UniversalMemoryAllocator: 文件类型: ${fileExtension}, 内存倍数: ${memoryConfig.multiplier}, 最大内存: ${memoryConfig.maxMB}MB, 计算所需内存: ${requiredMemoryMB}MB`);
      
      const result = await this.allocateMemory(requiredMemoryMB, `file_processing_${fileExtension}`);
      
      if (result.success) {
        console.log(`UniversalMemoryAllocator: 文件内存分配成功: ${requiredMemoryMB}MB`);
        return {
          ...result,
          fileType: fileExtension,
          memoryConfig
        };
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      console.error('UniversalMemoryAllocator: 文件内存分配失败:', error);
      throw error;
    }
  }

  /**
   * 分配指定大小的内存
   */
  async allocateMemory(sizeMB, purpose = 'general') {
    try {
      console.log(`UniversalMemoryAllocator: 请求分配 ${sizeMB}MB 内存用于 ${purpose}`);
      
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
      
      console.log(`UniversalMemoryAllocator: 成功分配 ${sizeMB}MB 内存，总分配: ${(this.totalAllocated / 1024 / 1024 / 1024).toFixed(2)}GB`);
      
      return {
        success: true,
        memoryId: memoryChunk.id,
        sizeMB,
        totalAllocatedGB: this.totalAllocated / 1024 / 1024 / 1024
      };
    } catch (error) {
      console.error('UniversalMemoryAllocator: 内存分配失败:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 获取文件扩展名
   */
  getFileExtension(filePath) {
    try {
      const fileName = filePath.split('/').pop() || filePath.split('\\').pop() || '';
      const extension = fileName.split('.').pop()?.toLowerCase() || '';
      return extension;
    } catch (error) {
      console.warn('UniversalMemoryAllocator: 获取文件扩展名失败:', error.message);
      return 'default';
    }
  }

  /**
   * 释放内存
   */
  releaseMemory(memoryId) {
    try {
      const memory = this.allocatedMemory.get(memoryId);
      if (!memory) {
        console.warn(`UniversalMemoryAllocator: 内存ID ${memoryId} 不存在`);
        return false;
      }
      
      // 释放Buffer
      if (memory.buffer) {
        memory.buffer = null;
      }
      
      // 从记录中移除
      this.allocatedMemory.delete(memoryId);
      this.totalAllocated -= memory.size;
      
      console.log(`UniversalMemoryAllocator: 释放内存 ${memoryId}，剩余: ${(this.totalAllocated / 1024 / 1024 / 1024).toFixed(2)}GB`);
      
      return true;
    } catch (error) {
      console.error('UniversalMemoryAllocator: 内存释放失败:', error);
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
      console.log('UniversalMemoryAllocator: 开始清理所有内存...');
      
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
      
      console.log('UniversalMemoryAllocator: 所有内存已清理');
      
      return true;
    } catch (error) {
      console.error('UniversalMemoryAllocator: 内存清理失败:', error);
      return false;
    }
  }

  /**
   * 显示内存状态警告
   */
  showMemoryWarning() {
    try {
      const status = this.getMemoryStatus();
      
      const safeCleanupCallback = () => {
        try {
          this.cleanupAllMemory().catch(error => {
            console.warn('UniversalMemoryAllocator: 清理回调失败:', error.message);
          });
        } catch (callbackError) {
          console.warn('UniversalMemoryAllocator: 清理回调执行失败:', callbackError.message);
        }
      };
      
      Alert.alert(
        '通用内存分配器状态',
        `已分配内存: ${status.totalAllocatedGB.toFixed(2)}GB\n` +
        `可用内存: ${status.availableGB.toFixed(2)}GB\n` +
        `内存块数量: ${status.allocatedChunks}\n\n` +
        `建议在内存不足时清理不必要的内存。`,
        [
          { text: '清理内存', onPress: safeCleanupCallback },
          { text: '确定', style: 'cancel' }
        ]
      );
    } catch (error) {
      console.error('UniversalMemoryAllocator: 显示内存警告失败:', error);
    }
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

  /**
   * 获取支持的文件类型列表
   */
  getSupportedFileTypes() {
    return Object.keys(this.fileTypeMemoryRequirements).filter(type => type !== 'default');
  }

  /**
   * 添加新的文件类型配置
   */
  addFileTypeConfig(extension, config) {
    try {
      this.fileTypeMemoryRequirements[extension.toLowerCase()] = {
        multiplier: config.multiplier || 2,
        maxMB: config.maxMB || 512
      };
      console.log(`UniversalMemoryAllocator: 添加文件类型配置: ${extension}`, config);
    } catch (error) {
      console.error('UniversalMemoryAllocator: 添加文件类型配置失败:', error);
    }
  }
}

export default new UniversalMemoryAllocator();


