/**
 * 下载与缓存服务 - 处理大附件的持久化缓存与 LRU 清理
 * 对应里程碑 4 要求：500MB 大附件、缓存/LRU、非阻塞
 */

import RNFS from 'react-native-fs';
import realmService from '../database/realmService';
import { logService } from '../../utils/logService';

class DownloadCacheService {
  constructor() {
    this.CACHE_DIR = `${RNFS.CachesDirectoryPath}/attachments`;
    this.MAX_CACHE_SIZE = 2 * 1024 * 1024 * 1024; // 默认 2GB
    this.initialized = false;
  }

  /**
   * 初始化缓存目录
   */
  async initialize() {
    if (this.initialized) return;
    try {
      const exists = await RNFS.exists(this.CACHE_DIR);
      if (!exists) {
        await RNFS.mkdir(this.CACHE_DIR);
      }
      this.initialized = true;
    } catch (error) {
      logService.error('[DownloadCache] 初始化失败', error);
    }
  }

  /**
   * 获取缓存的文件路径
   * @param {string} fileId 文件唯一标识
   * @param {string} extension 文件扩展名
   */
  async getCachePath(fileId, extension = '') {
    await this.initialize();
    const fileName = extension ? `${fileId}.${extension}` : fileId;
    const path = `${this.CACHE_DIR}/${fileName}`;
    
    if (await RNFS.exists(path)) {
      // 更新最后访问时间（用于 LRU）
      this._updateLastAccess(fileId).catch(() => {});
      return path;
    }
    return null;
  }

  /**
   * 将文件保存到缓存并执行 LRU
   */
  async saveToCache(fileId, sourcePath, metadata = {}) {
    await this.initialize();
    const extension = metadata.extension || '';
    const fileName = extension ? `${fileId}.${extension}` : fileId;
    const destPath = `${this.CACHE_DIR}/${fileName}`;

    try {
      // 1. 检查空间并执行 LRU 清理
      await this._enforceLRU(metadata.size || 0);

      // 2. 复制/移动到缓存目录
      await RNFS.copyFile(sourcePath, destPath);

      // 3. 记录到 Realm 索引
      await this._recordInIndex(fileId, {
        path: destPath,
        size: metadata.size || 0,
        mimeType: metadata.mimeType,
      });

      return destPath;
    } catch (error) {
      logService.error('[DownloadCache] 保存缓存失败', error);
      throw error;
    }
  }

  /**
   * 执行 LRU 清理
   * @private
   */
  async _enforceLRU(incomingSize) {
    const realm = await realmService.getRealm();
    const cacheItems = realm.objects('FileCacheIndex').sorted('lastAccessedAt', false);
    
    let currentTotalSize = cacheItems.sum('size');
    
    // 如果加上新文件超过上限，开始删除最旧的
    while (currentTotalSize + incomingSize > this.MAX_CACHE_SIZE && cacheItems.length > 0) {
      const oldest = cacheItems[0];
      try {
        if (await RNFS.exists(oldest.path)) {
          await RNFS.unlink(oldest.path);
        }
        currentTotalSize -= oldest.size;
        realm.write(() => {
          realm.delete(oldest);
        });
        logService.info(`[DownloadCache] LRU 清理: ${oldest.fileId}`);
      } catch (e) {
        logService.warn(`[DownloadCache] 无法删除缓存文件: ${oldest.path}`, e);
        break;
      }
    }
  }

  async _recordInIndex(fileId, data) {
    const realm = await realmService.getRealm();
    realm.write(() => {
      realm.create('FileCacheIndex', {
        _id: `cache_${fileId}`,
        fileId,
        path: data.path,
        size: data.size,
        lastAccessedAt: new Date(),
        mimeType: data.mimeType,
      }, 'modified');
    });
  }

  async _updateLastAccess(fileId) {
    const realm = await realmService.getRealm();
    const item = realm.objectForPrimaryKey('FileCacheIndex', `cache_${fileId}`);
    if (item) {
      realm.write(() => {
        item.lastAccessedAt = new Date();
      });
    }
  }
}

export const downloadCacheService = new DownloadCacheService();
export default downloadCacheService;

