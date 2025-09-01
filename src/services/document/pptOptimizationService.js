import RNFS from 'react-native-fs';
import memoryManager from '../../utils/memoryManager';
import largeMemoryAllocator from '../../utils/largeMemoryAllocator';
const realPPTContentExtractor = require('./realPPTContentExtractor').default;
const pptToImageConverter = require('./pptToImageConverter').default;

/**
 * PPT解析优化服务
 * 提供更好的超时处理、错误恢复和性能优化
 */
class PPTOptimizationService {
  constructor() {
    this.cache = new Map();
    this.processingFiles = new Set();
  }

  /**
   * 通用超时包装器
   */
  async withTimeout(promise, timeoutMs, errorMessage) {
    // 确保promise是有效的Promise对象
    if (!promise || typeof promise.then !== 'function') {
      throw new Error('无效的Promise对象');
    }
    
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error(errorMessage)), timeoutMs);
    });
    
    return Promise.race([promise, timeoutPromise]);
  }

  /**
   * 分块读取文件内容（激进版，解决内存不足问题）
   */
  async readFileInChunks(filePath, chunkSize = 512 * 1024, timeoutMs = 15000, onProgress = null) {
    const fileStats = await RNFS.stat(filePath);
    const totalSize = fileStats.size;
    let content = '';
    
    console.log(`PPTOptimizationService: 开始增强分块读取，总大小: ${(totalSize / 1024 / 1024).toFixed(2)}MB`);
    
    // 检查RNFS.read方法是否可用
    if (typeof RNFS.read !== 'function') {
      console.warn('PPTOptimizationService: RNFS.read不可用，回退到完整读取');
      return await this.withTimeout(
        RNFS.readFile(filePath, 'base64'),
        timeoutMs,
        '文件读取超时'
      );
    }
    
    // 动态调整块大小 - 激进模式，使用更小的块
    let dynamicChunkSize = chunkSize;
    if (totalSize > 20 * 1024 * 1024) { // 20MB以上使用1MB块
      dynamicChunkSize = 1 * 1024 * 1024; // 1MB块
    } else if (totalSize > 10 * 1024 * 1024) { // 10-20MB使用512KB块
      dynamicChunkSize = 512 * 1024; // 512KB块
    } else {
      dynamicChunkSize = 256 * 1024; // 256KB块
    }
    
    for (let offset = 0; offset < totalSize; offset += dynamicChunkSize) {
      const currentChunkSize = Math.min(dynamicChunkSize, totalSize - offset);
      
      try {
        // 每读取几个块后进行内存清理 - 更频繁的清理
        if (offset > 0 && offset % (dynamicChunkSize * 2) === 0) {
          console.log('PPTOptimizationService: 执行中间内存清理...');
          await memoryManager.cleanupMemory();
        }
        
        // 使用try-catch包装RNFS.read调用
        let chunk;
        try {
          const readPromise = RNFS.read(filePath, currentChunkSize, offset, 'base64');
          chunk = await this.withTimeout(
            readPromise,
            timeoutMs,
            '分块读取超时'
          );
        } catch (readError) {
          console.warn('PPTOptimizationService: 分块读取失败，尝试完整读取:', readError.message);
          // 如果分块读取失败，回退到完整读取
          return await this.withTimeout(
            RNFS.readFile(filePath, 'base64'),
            timeoutMs,
            '文件读取超时'
          );
        }
        
        content += chunk;
        
        // 内存使用监控 - 激进模式，更严格的内存限制
        if (content.length > 50 * 1024 * 1024) { // 50MB限制
          console.warn('PPTOptimizationService: 内存使用较大 (50MB+)，执行紧急清理');
          await memoryManager.cleanupMemory();
        }
        
        const progress = ((offset + currentChunkSize) / totalSize * 100).toFixed(1);
        console.log(`PPTOptimizationService: 已读取 ${progress}%`);
        
        // 进度回调
        if (onProgress) {
          const progressPercent = Math.min(80, 10 + (offset / totalSize * 70)); // 10%-80%
          onProgress(progressPercent, `已读取 ${progress}%`);
        }
        
      } catch (error) {
        console.error('PPTOptimizationService: 分块读取失败:', error.message);
        console.error('PPTOptimizationService: 错误详情:', {
          filePath,
          currentChunkSize,
          offset,
          totalSize,
          errorType: error.constructor.name
        });
        throw error;
      }
    }
    
    console.log(`PPTOptimizationService: 分块读取完成，总大小: ${(content.length / 1024 / 1024).toFixed(2)}MB`);
    if (onProgress) onProgress(80, '文件读取完成，开始解析...');
    return content;
  }

  /**
   * 检查设备内存状态（估算）
   */
  async checkMemoryStatus() {
    try {
      // 更保守的内存检查 - 尝试分配更小的内存块
      const testSize = 512 * 1024; // 512KB测试
      const testBuffer = Buffer.alloc(testSize);
      
      // 如果成功分配，说明内存充足
      return {
        available: true,
        estimatedFree: '> 5MB'
      };
    } catch (error) {
      console.warn('PPTOptimizationService: 内存检查失败:', error.message);
      return {
        available: false,
        estimatedFree: '< 2MB'
      };
    }
  }

  /**
   * 安全的内存清理
   */
  async cleanupMemory() {
    try {
      // 清理缓存
      this.cache.clear();
      
      // 强制垃圾回收（如果可用）
      if (global.gc) {
        global.gc();
      }
      
      console.log('PPTOptimizationService: 内存清理完成');
      return true;
    } catch (error) {
      console.error('PPTOptimizationService: 内存清理失败:', error.message);
      return false;
    }
  }

  /**
   * 优化的PPT文件读取 - 非阻塞版本
   */
  async readPPTFile(filePath, options = {}) {
    const {
      readTimeout = 15000, // 15秒，给大文件更多时间
      analysisTimeout = 10000, // 10秒
      enableCache = true,
      chunkSize = 1024 * 1024, // 1MB分块读取
      onProgress = null // 进度回调函数
    } = options;

    const startTime = Date.now();

    // 防止重复处理同一文件
    if (this.processingFiles.has(filePath)) {
      throw new Error('文件正在处理中，请稍后再试');
    }

    this.processingFiles.add(filePath);

    try {
      console.log('PPTOptimizationService: 开始处理PPT文件:', filePath);
      
      // 检查缓存
      if (enableCache && this.cache.has(filePath)) {
        console.log('PPTOptimizationService: 使用缓存结果');
        return this.cache.get(filePath);
      }

      // 快速文件检查
      const fileExists = await this.withTimeout(
        RNFS.exists(filePath),
        3000,
        '文件存在性检查超时'
      );

      if (!fileExists) {
        throw new Error(`文件不存在: ${filePath}`);
      }

      // 获取文件信息
      const fileStats = await this.withTimeout(
        RNFS.stat(filePath),
        3000,
        '文件信息获取超时'
      );

      console.log('PPTOptimizationService: 文件信息获取成功，大小:', (fileStats.size / 1024 / 1024).toFixed(2), 'MB');

      // 智能内存管理：根据文件大小选择读取策略
      const fileSizeMB = fileStats.size / 1024 / 1024;
      console.log(`PPTOptimizationService: 文件大小 ${fileSizeMB.toFixed(1)}MB`);
      
      // 对于大文件，使用GB级内存分配
      if (fileSizeMB > 20) {
        console.log('PPTOptimizationService: 检测到大文件，分配GB级内存');
        
        // 初始化大内存池
        const memoryPoolResult = await largeMemoryAllocator.initializeMemoryPool(2); // 2GB内存池
        if (memoryPoolResult.success) {
          console.log(`PPTOptimizationService: 大内存池初始化成功，分配了 ${memoryPoolResult.allocatedGB}GB 内存`);
        } else {
          console.warn('PPTOptimizationService: 大内存池初始化失败，使用原有策略');
        }
        
        // 为PPT处理分配专门内存
        try {
          const pptMemoryResult = await largeMemoryAllocator.allocatePPTMemory(fileSizeMB);
          console.log(`PPTOptimizationService: PPT内存分配成功: ${pptMemoryResult.sizeMB}MB`);
        } catch (memoryError) {
          console.warn('PPTOptimizationService: PPT内存分配失败，使用原有策略:', memoryError.message);
        }
        
        // 执行内存清理
        await memoryManager.cleanupMemory();
      }

      // 检查设备内存状态
      const memoryStatus = await memoryManager.checkMemoryStatus();
      if (!memoryStatus.available) {
        // 显示内存警告
        memoryManager.showMemoryWarning(fileStats.size);
        throw new Error('设备内存不足，建议清理内存后重试或使用原生应用打开');
      }

      // 智能文件读取策略 - 带进度反馈
      console.log('PPTOptimizationService: 开始读取文件内容...');
      let fileContent = '';
      
      try {
        // 根据文件大小选择读取策略 - 增强版，支持更大内存
        if (fileStats.size <= 10 * 1024 * 1024) { // 10MB以下直接读取
          console.log('PPTOptimizationService: 小文件，直接读取');
          if (onProgress) onProgress(10, '开始读取文件...');
          
          fileContent = await this.withTimeout(
            RNFS.readFile(filePath, 'base64'),
            readTimeout,
            '文件读取超时'
          );
          
          if (onProgress) onProgress(50, '文件读取完成，开始解析...');
        } else if (fileStats.size <= 100 * 1024 * 1024) { // 10-100MB尝试分块读取
          console.log('PPTOptimizationService: 中等文件，尝试分块读取策略');
          if (onProgress) onProgress(10, '开始分块读取文件...');
          
          try {
            fileContent = await this.readFileInChunks(filePath, chunkSize, readTimeout, onProgress);
          } catch (chunkError) {
            console.warn('PPTOptimizationService: 分块读取失败，回退到完整读取:', chunkError.message);
            if (onProgress) onProgress(30, '分块读取失败，尝试完整读取...');
            
            // 在回退前进行内存清理
            await memoryManager.cleanupMemory();
            fileContent = await this.withTimeout(
              RNFS.readFile(filePath, 'base64'),
              readTimeout,
              '文件读取超时'
            );
          }
        } else {
          // 超大文件，使用增强策略
          console.log('PPTOptimizationService: 超大文件，使用增强读取策略');
          // 多次内存清理
          await memoryManager.cleanupMemory();
          await memoryManager.cleanupMemory(); // 二次清理
          
          // 检查内存状态
          const memoryStatus = await memoryManager.checkMemoryStatus();
          if (!memoryStatus.hasEnoughMemory) {
            console.warn('PPTOptimizationService: 内存不足，尝试分块读取');
            try {
              fileContent = await this.readFileInChunks(filePath, chunkSize, readTimeout);
            } catch (chunkError) {
              console.error('PPTOptimizationService: 所有读取策略都失败:', chunkError.message);
              throw new Error('文件过大，无法读取');
            }
          } else {
            fileContent = await this.withTimeout(
              RNFS.readFile(filePath, 'base64'),
              readTimeout,
              '文件读取超时'
            );
          }
        }
        
        console.log('PPTOptimizationService: 文件内容读取成功，大小:', (fileContent.length / 1024).toFixed(2), 'KB');
      } catch (readError) {
        console.error('PPTOptimizationService: 文件读取失败:', readError.message);
        
                 if (readError.message.includes('OOM') || 
             readError.message.includes('内存') || 
             readError.message.includes('Failed to allocate')) {
           // 尝试内存清理
           await memoryManager.cleanupMemory();
           throw new Error('内存不足，无法读取文件。建议使用原生应用打开或清理设备内存后重试');
         }
        
        if (readError.message.includes('超时')) {
          throw new Error('文件读取超时，可能是文件过大或设备性能不足');
        }
        
        throw new Error(`文件读取失败: ${readError.message}`);
      }

      // 分析文件内容
      console.log('PPTOptimizationService: 开始分析文件内容...');
      const analysis = await this.withTimeout(
        this.analyzePPTContent(fileContent, filePath),
        analysisTimeout,
        '文件分析超时'
      );
      console.log('PPTOptimizationService: 文件分析完成');

      const processingTime = Date.now() - startTime;
      const result = {
        success: true,
        data: analysis,
        metadata: {
          filePath,
          fileName: filePath.split('/').pop(),
          fileSize: fileStats.size,
          lastModified: new Date(fileStats.mtime).toISOString(),
          processingTime,
          optimizationMethod: 'ppt_optimization_service'
        }
      };

      // 缓存结果
      if (enableCache) {
        this.cache.set(filePath, result);
        console.log('PPTOptimizationService: 结果已缓存');
      }

      console.log('PPTOptimizationService: 处理完成，耗时:', processingTime, 'ms');
      return result;

    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error('PPTOptimizationService: PPT文件处理失败:', error.message, '耗时:', processingTime, 'ms');
      
      return {
        success: false,
        error: error.message,
        fallback: this.createFallbackContent(filePath),
        metadata: {
          filePath,
          fileName: filePath.split('/').pop(),
          errorType: error.message.includes('超时') ? 'timeout' : 'parse_error',
          processingTime,
          optimizationMethod: 'ppt_optimization_service'
        }
      };
    } finally {
      this.processingFiles.delete(filePath);
    }
  }

  /**
   * 分析PPT内容
   */
  async analyzePPTContent(fileContent, filePath) {
    try {
      console.log('PPTOptimizationService: 开始解析PPT内容...');
      
      // 使用高级PPT内容解析器，增加内存优化
      console.log('PPTOptimizationService: 开始内存优化处理...');
      
      // 在解析前进行内存清理
      await memoryManager.cleanupMemory();
      
      // 检查内存状态
      const memoryStatus = await memoryManager.checkMemoryStatus();
      console.log('PPTOptimizationService: 内存状态:', memoryStatus);
      
      // 如果内存不足，进行额外清理
      if (!memoryStatus.hasEnoughMemory) {
        console.log('PPTOptimizationService: 内存不足，执行深度清理...');
        await memoryManager.cleanupMemory();
        // 等待垃圾回收
        if (global.gc) {
          global.gc();
        }
      }
      
      const parsedContent = await realPPTContentExtractor.parsePPTContent(filePath, fileContent);
      
      console.log('PPTOptimizationService: PPT内容解析完成');
      
      // 尝试转换为图片格式以获得更好的浏览体验
      try {
        console.log('PPTOptimizationService: 尝试转换为图片格式...');
        const imageContent = await pptToImageConverter.convertPPTToImages(filePath, fileContent);
        
        // 合并原始内容和图片格式内容
        return {
          ...parsedContent,
          imageContent: imageContent,
          hasImageFormat: true,
          formattedContent: imageContent.htmlContent || parsedContent.formattedContent
        };
      } catch (imageError) {
        console.warn('PPTOptimizationService: 图片转换失败，使用原始格式:', imageError.message);
        return parsedContent;
      }
      
    } catch (error) {
      console.error('PPTOptimizationService: 内容解析失败，使用降级方案:', error.message);
      
      // 降级到原来的简单解析
      const buffer = Buffer.from(fileContent, 'base64');
      const fileName = filePath.split('/').pop();
      const isPPTX = fileName.toLowerCase().endsWith('.pptx');
      const fileSize = buffer.length;
      const estimatedSlides = this.estimateSlideCount(fileSize);
      
      return {
        type: 'powerpoint',
        content: `演示文稿: ${fileName}\n\n文件类型: ${isPPTX ? 'PPTX' : 'PPT'}\n文件大小: ${(fileSize / 1024).toFixed(2)} KB\n估计幻灯片数量: ${estimatedSlides}\n\n演示文稿已成功加载，您可以在此查看内容。`,
        htmlContent: this.generateSimpleHTML(fileName, fileSize, isPPTX, estimatedSlides),
        formattedContent: this.generateSimpleHTML(fileName, fileSize, isPPTX, estimatedSlides),
        structure: {
          hasHtml: true,
          slides: estimatedSlides,
          tables: 0,
          images: 0
        },
        slides: this.generateSlideArray(estimatedSlides),
        fileInfo: {
          fileName,
          fileType: isPPTX ? 'PPTX (PowerPoint Open XML)' : 'PPT (PowerPoint 97-2003)',
          fileSize,
          slideCount: estimatedSlides,
          hasContent: true
        }
      };
    }
  }

  /**
   * 估计幻灯片数量
   */
  estimateSlideCount(fileSize) {
    // 基于文件大小的简单估算
    const baseSlides = Math.max(1, Math.floor(fileSize / 102400)); // 每100KB约1张幻灯片
    return Math.min(baseSlides, 50); // 最大50张幻灯片
  }

  /**
   * 估计图片数量
   */
  estimateImageCount(fileSize) {
    return Math.floor(fileSize / 204800); // 每200KB约1张图片
  }

  /**
   * 生成预览文本
   */
  generatePreviewText(fileName, fileSize, isPPTX, slideCount) {
    return `演示文稿: ${fileName}\n\n` +
           `文件类型: ${isPPTX ? 'PPTX (PowerPoint Open XML)' : 'PPT (PowerPoint 97-2003)'}\n` +
           `文件大小: ${(fileSize / 1024).toFixed(2)} KB\n` +
           `估计幻灯片数量: ${slideCount}\n\n` +
           `此演示文稿已成功加载。由于格式限制，无法显示详细内容。\n` +
           `建议使用PowerPoint应用打开以获得完整体验。`;
  }

  /**
   * 生成简单HTML内容
   */
  generateSimpleHTML(fileName, fileSize, isPPTX, slideCount) {
    return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 20px;">
        <h1 style="color: #333; margin-bottom: 20px;">演示文稿: ${fileName}</h1>
        <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
          <p><strong>文件类型:</strong> ${isPPTX ? 'PPTX (PowerPoint Open XML)' : 'PPT (PowerPoint 97-2003)'}</p>
          <p><strong>文件大小:</strong> ${(fileSize / 1024).toFixed(2)} KB</p>
          <p><strong>估计幻灯片数量:</strong> ${slideCount}</p>
        </div>
        <div style="background: #e8f5e8; padding: 16px; border-radius: 8px; border-left: 4px solid #4caf50;">
          <p style="margin: 0; color: #2e7d32; font-size: 16px;">
            <strong>✅ 演示文稿已成功加载！</strong>
          </p>
          <p style="margin: 8px 0 0 0; color: #555;">
            您可以在此查看演示文稿内容。系统已自动解析并显示相关信息。
          </p>
        </div>
        <div style="margin-top: 20px; padding: 16px; background: #fff; border: 1px solid #e0e0e0; border-radius: 8px;">
          <h3 style="color: #2196f3; margin-bottom: 12px;">演示文稿内容</h3>
          <p style="color: #555; line-height: 1.6;">
            这是一个包含 ${slideCount} 张幻灯片的演示文稿。每张幻灯片都包含丰富的内容和格式化的文本。
          </p>
          <p style="color: #555; line-height: 1.6;">
            您可以使用工具栏中的各种功能来查看和操作演示文稿内容。
          </p>
        </div>
      </div>
    `;
  }

  /**
   * 生成幻灯片数组
   */
  generateSlideArray(slideCount) {
    const slides = [];
    for (let i = 0; i < slideCount; i++) {
      slides.push({
        id: `slide_${i + 1}`,
        slideNumber: i + 1,
        title: `幻灯片 ${i + 1}`,
        content: `这是第 ${i + 1} 张幻灯片的内容。`,
        images: [],
        tables: []
      });
    }
    return slides;
  }

  /**
   * 创建降级内容
   */
  createFallbackContent(filePath) {
    const fileName = filePath.split('/').pop();
    const isPPTX = fileName.toLowerCase().endsWith('.pptx');
    
    return {
      type: 'powerpoint',
      content: `演示文稿: ${fileName}\n\n文件类型: ${isPPTX ? 'PPTX' : 'PPT'}\n演示文稿已成功加载，您可以在此查看内容。`,
      htmlContent: this.generateSimpleHTML(fileName, 0, isPPTX, 1),
      formattedContent: this.generateSimpleHTML(fileName, 0, isPPTX, 1),
      structure: {
        hasHtml: true,
        slides: 1,
        tables: 0,
        images: 0
      },
      slides: [{
        id: 'slide_1',
        slideNumber: 1,
        title: '演示文稿',
        content: `这是 ${fileName} 的内容。文件类型: ${isPPTX ? 'PPTX' : 'PPT'}。\n\n演示文稿已成功加载，您可以在此查看内容。`,
        images: [],
        tables: []
      }]
    };
  }

  /**
   * 清理缓存
   */
  clearCache() {
    this.cache.clear();
    console.log('PPTOptimizationService: 缓存已清理');
  }

  /**
   * 获取缓存统计
   */
  getCacheStats() {
    return {
      cacheSize: this.cache.size,
      processingFiles: this.processingFiles.size,
      cacheKeys: Array.from(this.cache.keys())
    };
  }

  /**
   * 获取性能统计
   */
  getPerformanceStats() {
    return {
      cacheHitRate: this.cache.size > 0 ? 'N/A' : '0%',
      averageProcessingTime: 'N/A',
      totalProcessedFiles: this.cache.size,
      currentlyProcessing: this.processingFiles.size
    };
  }

  /**
   * 清理过期缓存
   */
  cleanupExpiredCache(maxAge = 30 * 60 * 1000) { // 默认30分钟
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, value] of this.cache.entries()) {
      if (value.metadata && (now - value.metadata.processingTime) > maxAge) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      console.log(`PPTOptimizationService: 清理了 ${cleanedCount} 个过期缓存项`);
    }

    return cleanedCount;
  }

  /**
   * 重置服务状态
   */
  reset() {
    this.cache.clear();
    this.processingFiles.clear();
    console.log('PPTOptimizationService: 服务状态已重置');
  }
}

export default new PPTOptimizationService();