/**
 * 永久存储原生桥接
 * 提供与Android和iOS原生代码的接口
 */

import { NativeModules, NativeEventEmitter, Platform } from 'react-native';
import permanentStorageManager from '../services/notes/permanentStorageManager';
import { logService } from '../utils/logService';

class PermanentStorageBridge {
  constructor() {
    this.initialized = false;
    this.nativeModule = null;
    this.eventEmitter = null;
    this.listeners = new Map();
  }

  /**
   * 初始化原生桥接
   */
  async initialize() {
    if (this.initialized) {return;}

    try {
      // 获取原生模块
      if (Platform.OS === 'android') {
        this.nativeModule = NativeModules.PermanentStorageModule;
      } else if (Platform.OS === 'ios') {
        this.nativeModule = NativeModules.PermanentStorageManager;
      }

      if (this.nativeModule) {
        // 创建事件发射器
        this.eventEmitter = new NativeEventEmitter(this.nativeModule);

        // 设置事件监听器
        this.setupEventListeners();

        // 初始化原生模块
        await this.nativeModule.initialize();

        logService.info('永久存储原生桥接初始化成功');
      } else {
        logService.warn('未找到永久存储原生模块，将使用纯JS实现');
      }

      this.initialized = true;
    } catch (error) {
      logService.error('永久存储原生桥接初始化失败', error);
      throw error;
    }
  }

  /**
   * 设置事件监听器
   */
  setupEventListeners() {
    if (!this.eventEmitter) {return;}

    // 监听存储状态变化
    this.eventEmitter.addListener('StorageStatusChanged', (status) => {
      logService.info('存储状态变化:', status);
      this.notifyListeners('storageStatusChanged', status);
    });

    // 监听备份完成事件
    this.eventEmitter.addListener('BackupCompleted', (result) => {
      logService.info('原生备份完成:', result);
      this.notifyListeners('backupCompleted', result);
    });

    // 监听恢复完成事件
    this.eventEmitter.addListener('RecoveryCompleted', (result) => {
      logService.info('原生恢复完成:', result);
      this.notifyListeners('recoveryCompleted', result);
    });

    // 监听错误事件
    this.eventEmitter.addListener('StorageError', (error) => {
      logService.error('原生存储错误:', error);
      this.notifyListeners('storageError', error);
    });
  }

  /**
   * 通知监听器
   */
  notifyListeners(event, data) {
    const listeners = this.listeners.get(event) || [];
    listeners.forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        logService.error(`事件监听器执行失败: ${event}`, error);
      }
    });
  }

  /**
   * 添加事件监听器
   */
  addEventListener(event, listener) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event).push(listener);
  }

  /**
   * 移除事件监听器
   */
  removeEventListener(event, listener) {
    const listeners = this.listeners.get(event);
    if (listeners) {
      const index = listeners.indexOf(listener);
      if (index > -1) {
        listeners.splice(index, 1);
      }
    }
  }

  /**
   * 创建笔记（原生优化）
   */
  async createNote(noteData) {
    try {
      await this.initialize();

      if (this.nativeModule && this.nativeModule.createNote) {
        // 使用原生方法创建笔记
        const result = await this.nativeModule.createNote(noteData);

        // 同时更新JS端数据
        await permanentStorageManager.createNote(noteData);

        return result;
      } else {
        // 回退到JS实现
        return await permanentStorageManager.createNote(noteData);
      }
    } catch (error) {
      logService.error('创建笔记失败', error);
      throw error;
    }
  }

  /**
   * 更新笔记（原生优化）
   */
  async updateNote(noteId, updateData) {
    try {
      await this.initialize();

      if (this.nativeModule && this.nativeModule.updateNote) {
        // 使用原生方法更新笔记
        const result = await this.nativeModule.updateNote(noteId, updateData);

        // 同时更新JS端数据
        await permanentStorageManager.updateNote(noteId, updateData);

        return result;
      } else {
        // 回退到JS实现
        return await permanentStorageManager.updateNote(noteId, updateData);
      }
    } catch (error) {
      logService.error('更新笔记失败', error);
      throw error;
    }
  }

  /**
   * 获取笔记（原生优化）
   */
  async getNote(noteId) {
    try {
      await this.initialize();

      if (this.nativeModule && this.nativeModule.getNote) {
        // 使用原生方法获取笔记
        const result = await this.nativeModule.getNote(noteId);

        if (result) {
          return result;
        }
      }

      // 回退到JS实现
      return await permanentStorageManager.getNote(noteId);
    } catch (error) {
      logService.error('获取笔记失败', error);
      throw error;
    }
  }

  /**
   * 执行原生备份
   */
  async performNativeBackup() {
    try {
      await this.initialize();

      if (this.nativeModule && this.nativeModule.performBackup) {
        const result = await this.nativeModule.performBackup();
        logService.info('原生备份完成:', result);
        return result;
      } else {
        // 回退到JS实现
        return await permanentStorageManager.performManualBackup();
      }
    } catch (error) {
      logService.error('原生备份失败', error);
      throw error;
    }
  }

  /**
   * 执行原生恢复
   */
  async performNativeRecovery(backupId) {
    try {
      await this.initialize();

      if (this.nativeModule && this.nativeModule.performRecovery) {
        const result = await this.nativeModule.performRecovery(backupId);
        logService.info('原生恢复完成:', result);
        return result;
      } else {
        // 回退到JS实现
        return await permanentStorageManager.performDataRecovery();
      }
    } catch (error) {
      logService.error('原生恢复失败', error);
      throw error;
    }
  }

  /**
   * 获取原生存储统计
   */
  async getNativeStorageStats() {
    try {
      await this.initialize();

      if (this.nativeModule && this.nativeModule.getStorageStats) {
        const stats = await this.nativeModule.getStorageStats();
        return stats;
      } else {
        // 回退到JS实现
        return permanentStorageManager.getStorageStats();
      }
    } catch (error) {
      logService.error('获取原生存储统计失败', error);
      throw error;
    }
  }

  /**
   * 检查原生存储健康状态
   */
  async checkNativeStorageHealth() {
    try {
      await this.initialize();

      if (this.nativeModule && this.nativeModule.checkStorageHealth) {
        const health = await this.nativeModule.checkStorageHealth();
        return health;
      } else {
        // 回退到JS实现
        return await permanentStorageManager.performIntegrityCheck();
      }
    } catch (error) {
      logService.error('检查原生存储健康状态失败', error);
      throw error;
    }
  }

  /**
   * 优化原生存储
   */
  async optimizeNativeStorage() {
    try {
      await this.initialize();

      if (this.nativeModule && this.nativeModule.optimizeStorage) {
        const result = await this.nativeModule.optimizeStorage();
        logService.info('原生存储优化完成:', result);
        return result;
      } else {
        logService.info('原生存储优化不可用，跳过');
        return { success: true, message: '原生优化不可用' };
      }
    } catch (error) {
      logService.error('原生存储优化失败', error);
      throw error;
    }
  }

  /**
   * 清理原生缓存
   */
  async clearNativeCache() {
    try {
      await this.initialize();

      if (this.nativeModule && this.nativeModule.clearCache) {
        const result = await this.nativeModule.clearCache();
        logService.info('原生缓存清理完成:', result);
        return result;
      } else {
        logService.info('原生缓存清理不可用，跳过');
        return { success: true, message: '原生清理不可用' };
      }
    } catch (error) {
      logService.error('原生缓存清理失败', error);
      throw error;
    }
  }

  /**
   * 获取原生模块信息
   */
  getNativeModuleInfo() {
    return {
      available: !!this.nativeModule,
      platform: Platform.OS,
      moduleName: this.nativeModule ?
        (Platform.OS === 'android' ? 'PermanentStorageModule' : 'PermanentStorageManager') :
        null,
      initialized: this.initialized,
    };
  }

  /**
   * 销毁桥接
   */
  destroy() {
    try {
      // 移除所有事件监听器
      this.listeners.clear();

      // 移除原生事件监听器
      if (this.eventEmitter) {
        this.eventEmitter.removeAllListeners('StorageStatusChanged');
        this.eventEmitter.removeAllListeners('BackupCompleted');
        this.eventEmitter.removeAllListeners('RecoveryCompleted');
        this.eventEmitter.removeAllListeners('StorageError');
      }

      this.initialized = false;
      this.nativeModule = null;
      this.eventEmitter = null;

      logService.info('永久存储原生桥接已销毁');
    } catch (error) {
      logService.error('销毁永久存储原生桥接失败', error);
    }
  }
}

// 创建单例实例
const permanentStorageBridge = new PermanentStorageBridge();

export default permanentStorageBridge;
export { PermanentStorageBridge };




