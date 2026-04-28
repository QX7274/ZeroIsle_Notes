/**
 * 文档转换服务
 * 提供PPT/Word转PDF的前后端结合功能
 * 优化版本：避免阻塞主线程
 */

import RNFS from 'react-native-fs';
import { Platform } from 'react-native';
import networkErrorService from '../networkErrorService';
import { API_URL } from '../../config';

// 导入非阻塞文件处理器
import nonBlockingFileProcessor from '../../utils/nonBlockingFileProcessor';

// 添加非阻塞转换支持
class NonBlockingConverter {
  constructor() {
    this.isProcessing = false;
    this.currentTask = null;
    this.progressCallbacks = new Map();
  }

  /**
   * 非阻塞转换入口
   */
  async convertNonBlocking(filePath, options = {}) {
    if (this.isProcessing) {
      throw new Error('已有转换任务正在进行中');
    }

    this.isProcessing = true;
    this.currentTask = { filePath, options, startTime: Date.now() };

    try {
      // 使用非阻塞文件处理器进行预处理
      const preprocessResult = await nonBlockingFileProcessor.uploadFileNonBlocking(filePath, {
        onProgress: options.onProgress,
        signal: options.signal,
        chunkSize: 1024 * 1024, // 1MB块大小
        yieldInterval: 16, // 16ms让出控制权
      });

      // 使用setTimeout确保不阻塞主线程
      return await new Promise((resolve, reject) => {
        setTimeout(async () => {
          try {
            const result = await this.performConversion(filePath, options, preprocessResult);
            resolve(result);
          } catch (error) {
            reject(error);
          } finally {
            this.isProcessing = false;
            this.currentTask = null;
          }
        }, 0);
      });
    } catch (error) {
      this.isProcessing = false;
      this.currentTask = null;
      throw error;
    }
  }

  /**
   * 执行实际转换（在非阻塞上下文中）
   */
  async performConversion(filePath, options, preprocessResult) {
    const { onProgress, method = 'upload', signal } = options;

    // 使用预处理结果
    if (preprocessResult && preprocessResult.success) {
      console.log('NonBlockingConverter: 使用预处理结果:', preprocessResult);

      if (onProgress) {
        onProgress({
          stage: 'preparing',
          progress: 50, // 预处理已完成，从50%开始
          message: '文件预处理完成，准备转换...',
        });
      }

      // 预处理已完成，直接返回成功，跳过chunks处理
      return {
        success: true,
        method,
        preprocessed: true,
        totalChunks: preprocessResult.totalChunks || 0,
        message: '文件预处理完成，准备执行转换',
      };
    } else {
      // 如果没有预处理结果，使用传统方法
      const chunks = await this.splitFileIntoChunks(filePath);

      if (onProgress) {
        onProgress({
          stage: 'preparing',
          progress: 5,
          message: '正在准备文件...',
        });
      }

      // 分块处理，每块之间让出控制权
      for (let i = 0; i < chunks.length; i++) {
        if (signal && signal.aborted) {
          throw new Error('转换已取消');
        }

        // 让出控制权，避免阻塞UI
        await this.yieldControl();

        if (onProgress) {
          const progress = 5 + (i / chunks.length) * 15;
          onProgress({
            stage: 'processing',
            progress: Math.round(progress),
            message: `正在处理第${i + 1}/${chunks.length}块...`,
          });
        }
      }

      // 注意：这里需要调用外部服务的方法，所以返回一个标记
      // 实际的转换将在外部服务中执行
      return {
        success: true,
        method,
        chunks: chunks.length,
        message: '分块处理完成，准备执行转换',
      };
    }
  }

  /**
   * 将文件分割成块（虚拟分块，用于进度控制）
   */
  async splitFileIntoChunks(filePath) {
    try {
      const stats = await RNFS.stat(filePath);
      const fileSize = stats.size;
      const chunkSize = Math.max(1024 * 1024, Math.floor(fileSize / 10)); // 1MB或文件大小的1/10
      const chunks = [];

      for (let offset = 0; offset < fileSize; offset += chunkSize) {
        chunks.push({
          offset,
          size: Math.min(chunkSize, fileSize - offset),
        });
      }

      return chunks;
    } catch (error) {
      console.error('文件分块失败，无法继续处理:', error);
      throw error;
    }
  }

  /**
   * 让出控制权，避免阻塞主线程
   */
  async yieldControl() {
    return new Promise(resolve => {
      // 使用多种方式让出控制权
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(resolve, { timeout: 10 });
      } else if (typeof requestAnimationFrame !== 'undefined') {
        requestAnimationFrame(resolve);
      } else {
        setTimeout(resolve, 0);
      }
    });
  }

  /**
   * 获取当前任务状态
   */
  getCurrentTaskStatus() {
    if (!this.currentTask) {return null;}

    const elapsed = Date.now() - this.currentTask.startTime;
    return {
      isProcessing: this.isProcessing,
      filePath: this.currentTask.filePath,
      elapsed,
      options: this.currentTask.options,
    };
  }

  /**
   * 取消当前任务
   */
  cancelCurrentTask() {
    if (this.currentTask && this.currentTask.options.signal) {
      this.currentTask.options.signal.abort();
    }
    this.isProcessing = false;
    this.currentTask = null;
  }
}

class DocumentConversionService {
  constructor() {
    // 后端API地址配置
    this.baseURL = this.getBaseURL();
    this.timeout = 120000; // 120秒超时（增加以支持大文件）

    // WebSocket支持
    this.wsBaseURL = this.getWebSocketURL();
    this.activeConnections = new Map(); // 存储活跃的WebSocket连接

    // 非阻塞转换器
    this.nonBlockingConverter = new NonBlockingConverter();

    console.log('DocumentConversionService: 初始化完成');
    console.log('DocumentConversionService: API地址:', this.baseURL);
    console.log('DocumentConversionService: WebSocket地址:', this.wsBaseURL);
    console.log('DocumentConversionService: 超时设置:', this.timeout + 'ms');
  }

  /**
   * 获取WebSocket地址
   */
  getWebSocketURL() {
    const baseURL = this.getBaseURL();
    return baseURL.replace('http://', 'ws://').replace('https://', 'wss://');
  }

  /**
   * 获取后端API地址
   * 使用配置文件中的统一API_URL，确保所有服务使用相同的网络配置
   */
  getBaseURL() {
    // 从配置文件获取基础URL，添加文档转换API路径
    const baseURL = `${API_URL}/api/v1/document-converter`;

    console.log('DocumentConversionService: 使用配置的API地址:', baseURL);
    console.log('DocumentConversionService: 平台:', Platform.OS);

    return baseURL;
  }

  /**
   * 检查后端服务状态
   */
  async checkServiceHealth() {
    try {
      console.log('DocumentConversionService: 检查服务健康状态...');

      const response = await fetch(`${this.baseURL}/health/`, {
        method: 'GET',
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`服务不可用: ${response.status}`);
      }

      const result = await response.json();
      console.log('DocumentConversionService: 服务状态正常:', result);

      return {
        success: true,
        status: result.status,
        supportedFormats: result.supported_formats,
        timestamp: result.timestamp,
      };

    } catch (error) {
      console.error('DocumentConversionService: 服务健康检查失败:', error);
      return {
        success: false,
        error: error.message,
        message: '后端转换服务不可用',
      };
    }
  }

  /**
   * 转换文档为PDF（非阻塞版本）
   * @param {string} filePath - 文件路径
   * @param {Object} options - 转换选项
   * @returns {Promise<Object>} 转换结果
   */
  async convertToPDF(filePath, options = {}) {
    const { useNonBlocking = true, ...otherOptions } = options;

    // 优先使用非阻塞转换
    if (useNonBlocking) {
      return this.convertToPDFNonBlocking(filePath, otherOptions);
    }

    // 回退到传统方法
    return this.convertToPDFTraditional(filePath, otherOptions);
  }

  /**
   * 非阻塞转换方法
   */
  async convertToPDFNonBlocking(filePath, options = {}) {
    try {
      console.log('DocumentConversionService: 使用非阻塞方式转换文档:', filePath);

      const {
        onProgress = null,
        timeout = this.timeout,
        method = 'upload',
        signal = null,
      } = options;

      // 检查文件是否存在
      const fileExists = await RNFS.exists(filePath);
      if (!fileExists) {
        throw new Error(`文件不存在: ${filePath}`);
      }

      // 获取文件信息
      const fileStats = await RNFS.stat(filePath);
      const fileName = filePath.split('/').pop();
      const fileExtension = fileName.split('.').pop().toLowerCase();

      console.log('DocumentConversionService: 文件信息:', {
        fileName,
        fileExtension,
        size: fileStats.size,
      });

      // 检查文件类型
      const supportedFormats = ['ppt', 'pptx', 'doc', 'docx'];
      if (!supportedFormats.includes(fileExtension)) {
        throw new Error(`不支持的文件格式: ${fileExtension}`);
      }

      // 使用非阻塞转换器进行分块处理
      const chunkResult = await this.nonBlockingConverter.convertNonBlocking(filePath, {
        onProgress,
        timeout,
        method,
        signal,
        fileName,
        fileExtension,
      });

      // 分块处理完成后，执行实际转换
      if (chunkResult.success) {
        if (onProgress) {
          onProgress({
            stage: 'converting',
            progress: 60,
            message: '分块处理完成，开始转换...',
          });
        }

        // 根据方法选择转换方式
        let result;
        if (method === 'websocket') {
          result = await this.convertViaWebSocket(filePath, fileName, fileExtension, onProgress);
        } else if (method === 'base64') {
          result = await this.convertViaBase64(filePath, fileName, fileExtension, onProgress, signal);
        } else {
          result = await this.convertViaUpload(filePath, fileName, fileExtension, onProgress, signal);
        }

        // 格式化返回结果（统一格式）
        if (result.success) {
          return {
            success: true,
            pdfBase64: result.pdf_base64,
            fileInfo: result.file_info || {
              original_name: fileName,
              file_type: fileExtension,
              pages: 1,
              conversion_method: 'unknown',
              output_size: 0,
            },
            originalFile: filePath,
            convertedSize: result.file_info?.output_size || 0,
            conversionMethod: result.file_info?.conversion_method || 'unknown',
            timestamp: result.timestamp || new Date().toISOString(),
          };
        } else {
          throw new Error(result.error || '转换失败，未返回PDF数据');
        }
      } else {
        throw new Error(chunkResult.error || '分块处理失败');
      }

    } catch (error) {
      console.error('DocumentConversionService: 非阻塞转换失败:', error);
      throw error;
    }
  }

  /**
   * 传统转换方法（保持向后兼容）
   */
  async convertToPDFTraditional(filePath, options = {}) {
    try {
      console.log('DocumentConversionService: 开始转换文档:', filePath);

      const {
        onProgress = null,
        timeout = this.timeout,
        method = 'upload', // 'upload' 或 'base64'
        signal = null, // AbortController signal
      } = options;

      // 检查文件是否存在
      const fileExists = await RNFS.exists(filePath);
      if (!fileExists) {
        throw new Error(`文件不存在: ${filePath}`);
      }

      // 获取文件信息
      const fileStats = await RNFS.stat(filePath);
      const fileName = filePath.split('/').pop();
      const fileExtension = fileName.split('.').pop().toLowerCase();

      console.log('DocumentConversionService: 文件信息:', {
        fileName,
        fileExtension,
        size: fileStats.size,
      });

      // 检查文件类型
      const supportedFormats = ['ppt', 'pptx', 'doc', 'docx'];
      if (!supportedFormats.includes(fileExtension)) {
        throw new Error(`不支持的文件格式: ${fileExtension}`);
      }

      // 进度回调
      if (onProgress) {
        onProgress({
          stage: 'preparing',
          progress: 10,
          message: '正在准备文件...',
        });
      }

      let result;

      if (method === 'websocket') {
        // 使用WebSocket方法（实时进度）
        result = await this.convertViaWebSocket(filePath, fileName, fileExtension, onProgress);
      } else if (method === 'base64') {
        // 使用Base64方法
        result = await this.convertViaBase64(filePath, fileName, fileExtension, onProgress, signal);
      } else {
        // 使用文件上传方法
        result = await this.convertViaUpload(filePath, fileName, fileExtension, onProgress, signal);
      }

      if (result.success) {
        console.log('DocumentConversionService: 转换成功');

        if (onProgress) {
          onProgress({
            stage: 'complete',
            progress: 100,
            message: '转换完成！',
          });
        }

        return {
          success: true,
          pdfBase64: result.pdf_base64,
          fileInfo: result.file_info || {
            original_name: fileName,
            file_type: fileExtension,
            pages: 1,
            conversion_method: 'unknown',
            output_size: 0,
          },
          originalFile: filePath,
          convertedSize: result.file_info?.output_size || 0,
          conversionMethod: result.file_info?.conversion_method || 'unknown',
          timestamp: result.timestamp || new Date().toISOString(),
        };
      } else {
        throw new Error(result.error || '转换失败');
      }

    } catch (error) {
      // 使用统一的网络错误处理器
      networkErrorService.handleDocumentConversionError(error, {
        context: '文档转换',
        onRetry: () => {
          // 可以在这里实现重试逻辑
          console.log('用户选择重试文档转换');
        },
      });

      throw error;
    }
  }

  /**
   * 非阻塞转换主方法的旧名称（向后兼容）
   */
  async convertDocumentNonBlocking(filePath, options = {}) {
    return this.convertToPDFNonBlocking(filePath, options);
  }

  /**
   * 传统转换方法（保持向后兼容）
   */
  async convertToPDFTraditional(filePath, options = {}) {
    try {
      console.log('DocumentConversionService: 开始转换文档:', filePath);

      const {
        onProgress = null,
        timeout = this.timeout,
        method = 'upload', // 'upload' 或 'base64'
        signal = null, // AbortController signal
      } = options;

      // 检查文件是否存在
      const fileExists = await RNFS.exists(filePath);
      if (!fileExists) {
        throw new Error(`文件不存在: ${filePath}`);
      }

      // 获取文件信息
      const fileStats = await RNFS.stat(filePath);
      const fileName = filePath.split('/').pop();
      const fileExtension = fileName.split('.').pop().toLowerCase();

      console.log('DocumentConversionService: 文件信息:', {
        fileName,
        fileExtension,
        size: fileStats.size,
      });

      // 检查文件类型
      const supportedFormats = ['ppt', 'pptx', 'doc', 'docx'];
      if (!supportedFormats.includes(fileExtension)) {
        throw new Error(`不支持的文件格式: ${fileExtension}`);
      }

      // 进度回调
      if (onProgress) {
        onProgress({
          stage: 'preparing',
          progress: 10,
          message: '正在准备文件...',
        });
      }

      let result;

      if (method === 'websocket') {
        // 使用WebSocket方法（实时进度）
        result = await this.convertViaWebSocket(filePath, fileName, fileExtension, onProgress);
      } else if (method === 'base64') {
        // 使用Base64方法
        result = await this.convertViaBase64(filePath, fileName, fileExtension, onProgress, signal);
      } else {
        // 使用文件上传方法
        result = await this.convertViaUpload(filePath, fileName, fileExtension, onProgress, signal);
      }

      if (result.success) {
        console.log('DocumentConversionService: 转换成功');

        if (onProgress) {
          onProgress({
            stage: 'complete',
            progress: 100,
            message: '转换完成！',
          });
        }

        return {
          success: true,
          pdfBase64: result.pdf_base64,
          fileInfo: result.file_info || {
            original_name: fileName,
            file_type: fileExtension,
            pages: 1,
            conversion_method: 'unknown',
            output_size: 0,
          },
          originalFile: filePath,
          convertedSize: result.file_info?.output_size || 0,
          conversionMethod: result.file_info?.conversion_method || 'unknown',
          timestamp: result.timestamp || new Date().toISOString(),
        };
      } else {
        throw new Error(result.error || '转换失败');
      }

    } catch (error) {
      // 使用统一的网络错误处理器
      networkErrorService.handleDocumentConversionError(error, {
        context: `文档转换: ${fileName}`,
        onRetry: () => {
          // 可以在这里实现重试逻辑
          console.log('用户选择重试文档转换');
        },
      });

      if (onProgress) {
        onProgress({
          stage: 'error',
          progress: 0,
          message: `转换失败: ${error.message || '未知错误'}`,
        });
      }

      return {
        success: false,
        error: error.message || '转换失败',
        errorType: 'conversion_error',
        originalFile: filePath,
        timestamp: new Date().toISOString(),
      };
    }
  }

  /**
   * 通过WebSocket方式转换（实时进度）
   */
  async convertViaWebSocket(filePath, fileName, fileExtension, onProgress) {
    return new Promise((resolve, reject) => {
      try {
        console.log('DocumentConversionService: 使用WebSocket方式转换');

        // 生成转换ID
        const conversionId = Date.now().toString();

        // 创建WebSocket连接
        const wsUrl = `${this.wsBaseURL}/ws/conversion/${conversionId}/`;
        const ws = new WebSocket(wsUrl);

        // 存储连接
        this.activeConnections.set(conversionId, ws);

        // 设置超时
        const timeoutId = setTimeout(() => {
          ws.close();
          this.activeConnections.delete(conversionId);
          reject(new Error('WebSocket连接超时'));
        }, this.timeout);

        ws.onopen = () => {
          console.log('DocumentConversionService: WebSocket连接已建立');

          // 发送转换请求
          ws.send(JSON.stringify({
            type: 'start_conversion',
            file_path: filePath,
            file_type: fileExtension,
            file_name: fileName,
          }));
        };

        ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);

            switch (data.type) {
              case 'progress_update':
                if (onProgress) {
                  onProgress({
                    stage: data.stage,
                    progress: data.progress,
                    message: data.message,
                  });
                }
                break;

              case 'conversion_complete':
                clearTimeout(timeoutId);
                ws.close();
                this.activeConnections.delete(conversionId);

                if (data.success) {
                  resolve({
                    success: true,
                    pdf_base64: data.pdf_base64,
                    file_info: data.file_info,
                  });
                } else {
                  reject(new Error(data.error || '转换失败'));
                }
                break;

              case 'error':
                clearTimeout(timeoutId);
                ws.close();
                this.activeConnections.delete(conversionId);
                reject(new Error(data.message));
                break;
            }
          } catch (e) {
            console.error('DocumentConversionService: WebSocket消息解析失败:', e);
          }
        };

        ws.onerror = (error) => {
          console.error('DocumentConversionService: WebSocket错误:', error);
          clearTimeout(timeoutId);
          this.activeConnections.delete(conversionId);
          reject(new Error('WebSocket连接错误'));
        };

        ws.onclose = () => {
          console.log('DocumentConversionService: WebSocket连接已关闭');
          clearTimeout(timeoutId);
          this.activeConnections.delete(conversionId);
        };

      } catch (error) {
        console.error('DocumentConversionService: WebSocket转换失败:', error);
        reject(error);
      }
    });
  }

  /**
   * 通过文件上传方式转换（优化内存管理和错误处理）
   */
  async convertViaUpload(filePath, fileName, fileExtension, onProgress, signal) {
    let abortController = null;

    try {
      console.log('DocumentConversionService: 使用文件上传方式转换');

      // 使用传入的signal或创建新的AbortController
      if (signal) {
        abortController = { signal };
      } else {
        abortController = new AbortController();
      }

      if (onProgress) {
        onProgress({
          stage: 'uploading',
          progress: 10,
          message: '正在准备上传...',
        });
      }

      // 首先检查后端服务是否可访问
      try {
        console.log('DocumentConversionService: 检查后端服务连接...');
        const healthCheck = await Promise.race([
          fetch(`${this.baseURL}/health/`, {
            method: 'GET',
            timeout: 5000,
          }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('健康检查超时')), 5000)
          ),
        ]);

        if (healthCheck && healthCheck.ok) {
          console.log('DocumentConversionService: 后端服务连接正常');
        }
      } catch (healthError) {
        console.warn('DocumentConversionService: 无法连接到后端服务:', healthError.message);
        console.warn('DocumentConversionService: 将继续尝试上传，但可能会失败');
      }

      // 检查文件大小和可用内存
      const fileStats = await this.getFileStats(filePath);

      // 导入增强内存管理器
      const enhancedMemoryManager = require('../../utils/enhancedMemoryManager').default;

      // 检查文件是否可以安全处理（支持100MB）
      const processCheck = await enhancedMemoryManager.canProcessFile(filePath, fileStats.size);
      if (!processCheck.canProcess) {
        throw new Error(`${processCheck.reason}。${processCheck.suggestion}`);
      }

      // 标记文件开始处理
      enhancedMemoryManager.markFileProcessing(filePath);

      console.log('DocumentConversionService: 文件处理检查通过:', {
        fileSize: Math.round(fileStats.size / 1024 / 1024) + 'MB',
        requiredMemory: Math.round(processCheck.requiredMemory / 1024 / 1024) + 'MB',
        availableMemory: Math.round(processCheck.availableMemory / 1024 / 1024) + 'MB',
      });

      // 对于大文件（超过10MB），使用内存优化器
      if (fileStats.size > 10 * 1024 * 1024) {
        console.log('DocumentConversionService: 检测到大文件，使用内存优化器');
        const memoryOptimizer = require('../../utils/memoryOptimizer').default;

        // 使用内存优化器进行安全处理
        await memoryOptimizer.processLargeFileSafely(filePath, {
          onChunk: async (chunk, index, total) => {
            if (onProgress) {
              const progress = Math.round(((index + 1) / total) * 40); // 前40%进度
              onProgress({
                progress,
                message: `处理文件块 ${index + 1}/${total}`,
                stage: 'chunk_processing',
              });
            }
          },
          finalize: async (data) => {
            // 文件处理完成
            if (onProgress) {
              onProgress({
                progress: 40,
                message: '大文件预处理完成',
                stage: 'preprocessing_complete',
              });
            }
            return data;
          },
        }, {
          encoding: 'base64', // 使用base64编码读取二进制文件
          chunkSize: 1024 * 1024, // 1MB块大小
          onProgress: (progressInfo) => {
            if (onProgress) {
              // 调整进度范围：大文件处理占前40%
              const adjustedProgress = Math.round(progressInfo.percentage * 0.4);
              onProgress({
                progress: adjustedProgress,
                message: `大文件预处理: ${progressInfo.percentage}%`,
                stage: 'large_file_processing',
              });
            }
          },
          signal: signal,
        });
      }

      // 计算合适的超时时间（基于文件大小）
      // 基础超时 + 每MB额外10秒
      const fileSizeMB = fileStats.size / (1024 * 1024);
      const calculatedTimeout = Math.max(this.timeout, 60000 + (fileSizeMB * 10000));
      console.log('DocumentConversionService: 计算的超时时间:', calculatedTimeout + 'ms', '文件大小:', fileSizeMB.toFixed(2) + 'MB');

      // 设置超时定时器
      const timeoutId = setTimeout(() => {
        if (abortController) {
          abortController.abort();
        }
      }, calculatedTimeout);

      if (onProgress) {
        onProgress({
          stage: 'uploading',
          progress: 20,
          message: '正在上传文件...',
        });
      }

      // 创建FormData
      const formData = new FormData();
      const fileUri = Platform.OS === 'android' ?
        (filePath.startsWith('file://') ? filePath : `file://${filePath}`) :
        filePath;

      console.log('DocumentConversionService: 准备上传文件:', {
        filePath,
        fileUri,
        fileName,
        fileExtension,
        mimeType: this.getMimeType(fileExtension),
      });

      formData.append('file', {
        uri: fileUri,
        type: this.getMimeType(fileExtension),
        name: fileName,
      });

      // 发送请求
      // 注意：使用FormData时不要手动设置Content-Type，让fetch自动设置
      const response = await fetch(`${this.baseURL}/convert/`, {
        method: 'POST',
        body: formData,
        signal: abortController.signal,
      });

      if (onProgress) {
        onProgress({
          stage: 'processing',
          progress: 60,
          message: '服务器正在处理...',
        });
      }

      if (!response.ok) {
        let errorMessage = `HTTP ${response.status}`;
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorData.message || errorMessage;
        } catch (e) {
          // 如果无法解析错误响应，使用默认错误消息
          console.warn('无法解析错误响应:', e);
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();

      // 检查结果是否成功
      if (!result.success) {
        throw new Error(result.error || '转换失败');
      }

      if (onProgress) {
        onProgress({
          stage: 'complete',
          progress: 100,
          message: '转换完成！',
        });
      }

      // 清除超时定时器
      clearTimeout(timeoutId);

      return result;

    } catch (error) {
      // 清除超时定时器
      if (typeof timeoutId !== 'undefined') {
        clearTimeout(timeoutId);
      }

      if (error.name === 'AbortError') {
        console.log('DocumentConversionService: 转换已取消或超时');
        throw new Error('转换已取消或超时，请检查网络连接和后端服务状态');
      }

      console.error('DocumentConversionService: 文件上传转换失败:', error);
      console.error('DocumentConversionService: 错误详情:', {
        message: error.message,
        name: error.name,
        stack: error.stack,
        baseURL: this.baseURL,
        fileName,
        fileExtension,
      });

      // 提供更详细的错误信息
      let errorMessage = error.message || '文件上传失败';
      if (error.message === 'Network request failed') {
        errorMessage = '网络请求失败，请检查：\n1. 后端服务是否运行在 ' + this.baseURL + '\n2. 网络连接是否正常\n3. 文件是否过大导致超时';
      }

      throw new Error(errorMessage);
    } finally {
      // 清理资源
      if (abortController && !signal) {
        abortController = null;
      }

      // 标记文件处理完成
      try {
        const enhancedMemoryManager = require('../../utils/enhancedMemoryManager').default;
        enhancedMemoryManager.markFileCompleted(filePath);
      } catch (cleanupError) {
        console.warn('DocumentConversionService: 清理文件处理状态失败:', cleanupError);
      }
    }
  }

  /**
   * 获取文件统计信息
   */
  async getFileStats(filePath) {
    try {
      const stats = await RNFS.stat(filePath);
      return {
        size: stats.size,
        isFile: stats.isFile(),
        modificationTime: stats.mtime,
      };
    } catch (error) {
      console.warn('获取文件统计信息失败:', error);
      return { size: 0, isFile: true };
    }
  }

  /**
   * 通过Base64方式转换
   */
  async convertViaBase64(filePath, fileName, fileExtension, onProgress) {
    try {
      console.log('DocumentConversionService: 使用Base64方式转换');

      if (onProgress) {
        onProgress({
          stage: 'reading',
          progress: 20,
          message: '正在读取文件...',
        });
      }

      // 读取文件为Base64
      const fileData = await RNFS.readFile(filePath, 'base64');

      if (onProgress) {
        onProgress({
          stage: 'uploading',
          progress: 40,
          message: '正在发送数据...',
        });
      }

      // 发送请求
      const response = await fetch(`${this.baseURL}/convert/base64/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          file_data: fileData,
          file_extension: fileExtension,
          filename: fileName,
        }),
        timeout: this.timeout,
      });

      if (onProgress) {
        onProgress({
          stage: 'converting',
          progress: 70,
          message: '正在转换文档...',
        });
      }

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const result = await response.json();

      if (onProgress) {
        onProgress({
          stage: 'processing',
          progress: 90,
          message: '正在处理结果...',
        });
      }

      return result;

    } catch (error) {
      console.error('DocumentConversionService: Base64转换失败:', error);
      throw error;
    }
  }

  /**
   * 获取MIME类型
   */
  getMimeType(extension) {
    const mimeTypes = {
      'ppt': 'application/vnd.ms-powerpoint',
      'pptx': 'application/vnd.openxmlformats-presentationml.presentation',
      'doc': 'application/msword',
      'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
    return mimeTypes[extension] || 'application/octet-stream';
  }

  /**
   * 保存PDF到本地
   */
  async savePDFToLocal(pdfBase64, originalFileName) {
    try {
      const fileName = originalFileName.replace(/\.(ppt|pptx|doc|docx)$/i, '.pdf');
      const outputPath = `${RNFS.DocumentDirectoryPath}/${fileName}`;

      await RNFS.writeFile(outputPath, pdfBase64, 'base64');

      console.log('DocumentConversionService: PDF已保存到:', outputPath);
      return outputPath;

    } catch (error) {
      console.error('DocumentConversionService: 保存PDF失败:', error);
      throw error;
    }
  }

  /**
   * 获取支持的文件格式
   */
  getSupportedFormats() {
    return ['ppt', 'pptx', 'doc', 'docx'];
  }

  /**
   * 检查文件是否支持转换
   */
  isFileSupported(fileName) {
    const extension = fileName.split('.').pop().toLowerCase();
    return this.getSupportedFormats().includes(extension);
  }
}

// 创建单例实例
const documentConversionService = new DocumentConversionService();

export default documentConversionService;
