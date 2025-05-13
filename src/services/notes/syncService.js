/**
 * 笔记同步服务 - 负责在本地存储和MongoDB之间同步笔记数据
 */

import { mongoDBService } from '../database/mongoDBAdapter';
import { offlineStorageService } from '../offline/offlineStorageService';
import { networkService } from '../network/networkService';
import { logService } from '../utils/logService';

class SyncService {
  constructor() {
    this.initialized = false;
    this.initializationPromise = null;
    this.collection = 'notes';
    this.isSyncing = false;
    this.lastSyncTime = null;
  }

  /**
   * 初始化同步服务
   */
  async initialize() {
    if (this.initialized) return Promise.resolve();

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = new Promise(async (resolve, reject) => {
      try {
        // 确保MongoDB服务已初始化
        await mongoDBService.initialize();

        // 设置已初始化标志
        this.initialized = true;
        logService.info('同步服务初始化成功');
        resolve();
      } catch (error) {
        logService.error('同步服务初始化失败', error);
        reject(error);
      }
    });

    return this.initializationPromise;
  }

  /**
   * 同步所有未同步的笔记
   * @returns {Promise<Object>} 同步结果
   */
  async syncNotes() {
    if (this.isSyncing) {
      return { success: false, message: '同步已在进行中' };
    }

    if (!networkService.isOnline()) {
      return { success: false, message: '离线模式无法同步' };
    }

    try {
      await this.initialize();
      this.isSyncing = true;

      // 获取所有未同步的笔记
      const unsyncedNotes = await offlineStorageService.getUnsyncedNotes();

      if (unsyncedNotes.length === 0) {
        this.isSyncing = false;
        this.lastSyncTime = new Date();
        return { success: true, message: '没有需要同步的笔记', syncedCount: 0 };
      }

      // 同步每个笔记
      const syncResults = await Promise.all(
        unsyncedNotes.map(async (note) => {
          try {
            // 检查笔记是否已存在于MongoDB
            const existingNote = await mongoDBService.findOne(
              this.collection,
              { _id: note._id }
            );

            if (existingNote) {
              // 更新现有笔记
              await mongoDBService.updateOne(
                this.collection,
                { _id: note._id },
                { $set: { ...note, is_synced: true } }
              );
            } else {
              // 创建新笔记
              await mongoDBService.insertOne(
                this.collection,
                { ...note, is_synced: true }
              );
            }

            // 更新本地笔记的同步状态
            await offlineStorageService.updateNote(note._id, { is_synced: true });

            return { success: true, noteId: note._id };
          } catch (error) {
            logService.error(`同步笔记(ID: ${note._id})失败`, error);
            return { success: false, noteId: note._id, error };
          }
        })
      );

      // 计算同步结果
      const successCount = syncResults.filter(result => result.success).length;
      const failureCount = syncResults.length - successCount;

      this.isSyncing = false;
      this.lastSyncTime = new Date();

      return {
        success: true,
        message: `同步完成: ${successCount}个成功, ${failureCount}个失败`,
        syncedCount: successCount,
        failedCount: failureCount,
        details: syncResults
      };
    } catch (error) {
      this.isSyncing = false;
      logService.error('同步笔记失败', error);
      return { success: false, message: '同步过程中发生错误', error };
    }
  }

  /**
   * 从服务器拉取最新笔记
   * @returns {Promise<Object>} 拉取结果
   */
  async pullNotes() {
    if (!networkService.isOnline()) {
      return { success: false, message: '离线模式无法拉取' };
    }

    try {
      await this.initialize();

      // 获取本地最后更新时间
      const lastUpdateTime = await offlineStorageService.getLastUpdateTime();

      // 从MongoDB获取最新的笔记
      const latestNotes = await mongoDBService.find(
        this.collection,
        { updated_at: { $gt: lastUpdateTime } }
      );

      if (latestNotes.length === 0) {
        return { success: true, message: '没有新的笔记需要拉取', pulledCount: 0 };
      }

      // 更新本地存储
      await offlineStorageService.saveNotes(latestNotes);

      return {
        success: true,
        message: `成功拉取${latestNotes.length}个笔记`,
        pulledCount: latestNotes.length
      };
    } catch (error) {
      logService.error('拉取笔记失败', error);
      return { success: false, message: '拉取过程中发生错误', error };
    }
  }

  /**
   * 获取同步状态
   * @returns {Object} 同步状态
   */
  getSyncStatus() {
    return {
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime,
      isOnline: networkService.isOnline()
    };
  }
}

export const syncService = new SyncService();
