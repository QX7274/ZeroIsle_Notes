/**
 * 非阻塞PPT处理服务
 * 专门处理PPT文件导入，避免UI阻塞
 */

import { Alert, InteractionManager } from 'react-native';
import notesApi from '../api/notesApi';
import RNFS from 'react-native-fs';
import uiSafeProcessor from './uiSafeProcessor';

class NonBlockingPPTProcessor {
  constructor() {
    this.isProcessing = false;
    this.currentTask = null;
  }

  /**
   * 非阻塞方式处理PPT导入
   * @param {Object} documentInfo - 文档信息
   * @param {Function} onProgress - 进度回调
   * @param {Function} onComplete - 完成回调
   * @param {Function} onError - 错误回调
   */
  async processPPTImport(documentInfo, onProgress, onComplete, onError) {
    if (this.isProcessing) {
      console.warn('NonBlockingPPTProcessor: 已有PPT处理任务在进行中');
      return;
    }

    this.isProcessing = true;
    this.currentTask = {
      documentInfo,
      startTime: Date.now()
    };

    // 使用InteractionManager确保在交互完成后执行
    InteractionManager.runAfterInteractions(async () => {
      try {
        console.log('NonBlockingPPTProcessor: 开始处理PPT导入:', documentInfo);

        // 阶段1: 准备阶段
        if (onProgress) {
          onProgress({ stage: 'preparing', progress: 10, message: '准备处理PPT文件...' });
        }

        // 使用requestIdleCallback风格的处理
        await this.runWhenIdle(async () => {
          // 阶段2: 文件验证
          if (onProgress) {
            onProgress({ stage: 'validating', progress: 20, message: '验证文件完整性...' });
          }

          const isValid = await this.validatePPTFile(documentInfo);
          if (!isValid) {
            throw new Error('PPT文件格式无效或已损坏');
          }
        });

        await this.runWhenIdle(async () => {
          // 阶段3: 创建FormData
          if (onProgress) {
            onProgress({ stage: 'formatting', progress: 40, message: '准备上传数据...' });
          }

          const formData = await this.createFormDataNonBlocking(documentInfo);
          this.currentTask.formData = formData;
        });

        await this.runWhenIdle(async () => {
          // 阶段4: 导入处理
          if (onProgress) {
            onProgress({ stage: 'importing', progress: 60, message: '正在导入PPT文件...' });
          }

          const result = await this.importPPTNonBlocking(this.currentTask.formData, onProgress);
          this.currentTask.result = result;
        });

        await this.runWhenIdle(async () => {
          // 阶段5: 完成
          if (onProgress) {
            onProgress({ stage: 'completed', progress: 100, message: 'PPT导入完成' });
          }

          console.log('NonBlockingPPTProcessor: PPT处理完成:', this.currentTask.result);

          if (onComplete) {
            onComplete(this.currentTask.result);
          }
        });

      } catch (error) {
        console.error('NonBlockingPPTProcessor: PPT处理失败:', error);

        if (onError) {
          onError(error);
        }
      } finally {
        this.isProcessing = false;
        this.currentTask = null;
      }
    });
  }

  /**
   * 验证PPT文件
   * @param {Object} documentInfo - 文档信息
   * @returns {Promise<boolean>} 是否有效
   */
  async validatePPTFile(documentInfo) {
    try {
      
      // 检查文件是否存在
      const filePath = documentInfo.localPath || documentInfo.uri.replace('file://', '');
      const exists = await RNFS.exists(filePath);
      
      if (!exists) {
        console.error('NonBlockingPPTProcessor: PPT文件不存在:', filePath);
        return false;
      }

      // 检查文件大小
      const stats = await RNFS.stat(filePath);
      if (stats.size === 0) {
        console.error('NonBlockingPPTProcessor: PPT文件为空');
        return false;
      }

      // 检查文件扩展名
      const fileName = documentInfo.name || '';
      const isValidExtension = /\.(ppt|pptx)$/i.test(fileName);
      
      if (!isValidExtension) {
        console.warn('NonBlockingPPTProcessor: PPT文件扩展名可能不正确:', fileName);
      }

      console.log('NonBlockingPPTProcessor: PPT文件验证通过:', {
        path: filePath,
        size: stats.size,
        name: fileName
      });

      return true;
    } catch (error) {
      console.error('NonBlockingPPTProcessor: PPT文件验证失败:', error);
      return false;
    }
  }

  /**
   * 非阻塞方式创建FormData
   * @param {Object} documentInfo - 文档信息
   * @returns {Promise<FormData>} FormData对象
   */
  async createFormDataNonBlocking(documentInfo) {
    // 让出控制权
    await this.yieldControl(10);

    const formData = new FormData();
    formData.append('type', 'ppt');
    formData.append('file', {
      uri: documentInfo.localPath || documentInfo.uri,
      name: documentInfo.name,
      type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    });

    console.log('NonBlockingPPTProcessor: FormData创建完成');
    return formData;
  }

  /**
   * 非阻塞方式导入PPT
   * @param {FormData} formData - 表单数据
   * @param {Function} onProgress - 进度回调
   * @returns {Promise<Object>} 导入结果
   */
  async importPPTNonBlocking(formData, onProgress) {
    try {
      console.log('NonBlockingPPTProcessor: 开始UI安全的PPT导入');

      // 使用UI安全处理器执行导入操作
      const result = await uiSafeProcessor.runSafely(async () => {
        // 步骤1: 提取FormData信息
        if (onProgress) {
          onProgress({ stage: 'processing', progress: 75, message: '解析文件信息...' });
        }

        const fileInfo = await this.extractFormDataInfo(formData);

        // 步骤2: 创建笔记对象
        if (onProgress) {
          onProgress({ stage: 'processing', progress: 80, message: '创建笔记对象...' });
        }

        const noteData = await this.createNoteData(fileInfo);

        // 步骤3: 保存到离线存储
        if (onProgress) {
          onProgress({ stage: 'processing', progress: 85, message: '保存到本地存储...' });
        }

        const savedNote = await this.saveNoteNonBlocking(noteData, onProgress);

        // 步骤4: 准备返回结果
        if (onProgress) {
          onProgress({ stage: 'processing', progress: 95, message: '准备返回结果...' });
        }

        return {
          success: true,
          data: {
            ...savedNote,
            message: `导入${fileInfo.fileType}成功`,
            note_id: savedNote._id,
            _id: savedNote._id,
            id: savedNote._id,
            isOffline: true
          },
          isOffline: true
        };

      }, {
        priority: 'high',
        maxChunkTime: 16,
        yieldInterval: 10,
        onProgress: (info) => {
          console.log('UISafeProcessor进度:', info);
        }
      });

      console.log('NonBlockingPPTProcessor: PPT导入完成:', result);
      return result;

    } catch (error) {
      console.error('NonBlockingPPTProcessor: PPT导入失败:', error);
      throw error;
    }
  }

  /**
   * 提取FormData信息
   * @param {FormData} formData - 表单数据
   * @returns {Promise<Object>} 文件信息
   */
  async extractFormDataInfo(formData) {
    await this.yieldControl(10);

    let fileType = 'ppt';
    let fileObj = null;
    let fileName = '';

    // 从FormData中提取信息
    if (formData._parts) {
      for (const [key, value] of formData._parts) {
        if (key === 'type') {
          fileType = value;
        } else if (key === 'file') {
          fileObj = value;
          fileName = value.name || 'PPT文档';
        }
      }
    }

    return {
      fileType,
      fileObj,
      fileName,
      fileUri: fileObj?.uri || ''
    };
  }

  /**
   * 创建笔记数据
   * @param {Object} fileInfo - 文件信息
   * @returns {Promise<Object>} 笔记数据
   */
  async createNoteData(fileInfo) {
    await this.yieldControl(10);

    const noteId = `temp_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    const now = new Date().toISOString();

    // 从文件名中提取标题
    const title = fileInfo.fileName ?
      fileInfo.fileName.replace(/\.(ppt|pptx)$/i, '') :
      'PPT演示文稿';

    const noteData = {
      _id: noteId,
      id: noteId,
      title: title,
      content: `导入的${fileInfo.fileType}文件: ${fileInfo.fileName}`,
      created_at: now,
      updated_at: now,
      is_synced: false,
      type: fileInfo.fileType,
      file_type: fileInfo.fileType,
      file_name: fileInfo.fileName,
      file_uri: fileInfo.fileUri,
      uri: fileInfo.fileUri,
      path: fileInfo.fileUri,
      file_path: fileInfo.fileUri,
      url: fileInfo.fileUri,
      imported: true,
      is_offline: true,
      metadata: JSON.stringify({
        pdfPath: null,
        imagePath: null,
        fileSize: null,
        pageCount: null,
        lastOpenedPage: 1,
        lastOpenedTime: now
      })
    };

    return noteData;
  }

  /**
   * 非阻塞方式保存笔记
   * @param {Object} noteData - 笔记数据
   * @param {Function} onProgress - 进度回调
   * @returns {Promise<Object>} 保存的笔记
   */
  async saveNoteNonBlocking(noteData, onProgress) {
    try {
      // 使用UI安全处理器执行保存操作
      const savedNote = await uiSafeProcessor.safeFileOperation(async () => {
        // 动态导入离线存储服务，避免循环依赖
        const { offlineStorageService } = await import('../offline/offlineStorageService');

        if (onProgress) {
          onProgress({ stage: 'processing', progress: 87, message: '初始化存储服务...' });
        }

        await offlineStorageService.initialize();

        if (onProgress) {
          onProgress({ stage: 'processing', progress: 90, message: '写入数据库...' });
        }

        const result = await offlineStorageService.saveNote(noteData);
        return result.note || noteData;

      }, {
        timeout: 15000, // 15秒超时
        retries: 2,
        onProgress: (info) => {
          if (info.stage === 'attempting' && onProgress) {
            onProgress({
              stage: 'processing',
              progress: 88,
              message: `保存尝试 ${info.attempt}/${info.maxAttempts}...`
            });
          }
        }
      });

      return savedNote;
    } catch (error) {
      console.error('NonBlockingPPTProcessor: 保存笔记失败:', error);
      // 返回原始数据作为备用
      return noteData;
    }
  }

  /**
   * 在空闲时运行任务
   * @param {Function} task - 要执行的任务
   */
  async runWhenIdle(task) {
    return new Promise((resolve, reject) => {
      // 使用requestIdleCallback的概念，在主线程空闲时执行
      const runTask = async () => {
        try {
          await task();
          resolve();
        } catch (error) {
          reject(error);
        }
      };

      // 使用MessageChannel来模拟requestIdleCallback
      if (typeof MessageChannel !== 'undefined') {
        const channel = new MessageChannel();
        channel.port2.onmessage = () => runTask();
        channel.port1.postMessage(null);
      } else {
        // 回退到setTimeout
        setTimeout(runTask, 0);
      }
    });
  }

  /**
   * 让出控制权，避免阻塞UI
   * @param {number} delay - 延迟时间（毫秒）
   */
  async yieldControl(delay = 16) {
    return new Promise(resolve => {
      setTimeout(resolve, delay);
    });
  }

  /**
   * 取消当前处理任务
   */
  cancelCurrentTask() {
    if (this.isProcessing && this.currentTask) {
      console.log('NonBlockingPPTProcessor: 取消当前PPT处理任务');
      this.isProcessing = false;
      this.currentTask = null;
    }
  }

  /**
   * 获取当前处理状态
   * @returns {Object} 处理状态信息
   */
  getCurrentStatus() {
    return {
      isProcessing: this.isProcessing,
      currentTask: this.currentTask,
      processingTime: this.currentTask ? Date.now() - this.currentTask.startTime : 0
    };
  }
}

// 创建单例实例
const nonBlockingPPTProcessor = new NonBlockingPPTProcessor();

export default nonBlockingPPTProcessor;
