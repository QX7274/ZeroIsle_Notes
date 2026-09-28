/**
 * 下载与缓存服务 - 处理大附件的持久化缓存与 LRU 清理
 * 对应里程碑 4 要求：500MB 大附件、缓存/LRU、非阻塞
 */

import RNFS from 'react-native-fs';
import CryptoJS from 'crypto-js';
import realmService from '../database/realmService';
import { logService } from '../../utils/logService';
import { selectEvictions, totalSize } from './cacheLruIndex';

const CACHE_INTEGRITY_ERROR = 'CACHE_INTEGRITY_MISMATCH';
const CACHE_INDEX_PREFIX = 'cache_';
const DEFAULT_MAX_CACHE_SIZE = 2 * 1024 * 1024 * 1024; // 默认 2GB
const DEFAULT_RESERVE_RATIO = 0.1; // 默认预留 10% 余量
const DEFAULT_CHUNK_WRITE_THRESHOLD = 8 * 1024 * 1024; // 8MB 以上走分段写入
const DEFAULT_CHUNK_WRITE_SIZE = 1024 * 1024; // 单个分段默认 1MB
const MAX_CHUNK_WRITE_SIZE = 4 * 1024 * 1024; // 单个分段上界 4MB

class DownloadCacheService {
  constructor(options = {}) {
    this.CACHE_DIR = `${RNFS.CachesDirectoryPath}/attachments`;
    this.MAX_CACHE_SIZE = DEFAULT_MAX_CACHE_SIZE;
    this.RESERVE_RATIO = DEFAULT_RESERVE_RATIO;
    this.CHUNK_WRITE_THRESHOLD = DEFAULT_CHUNK_WRITE_THRESHOLD;
    this.CHUNK_WRITE_SIZE = DEFAULT_CHUNK_WRITE_SIZE;
    this.MAX_CHUNK_WRITE_SIZE = MAX_CHUNK_WRITE_SIZE;
    this.initialized = false;
    this.configure(options);
  }

  /**
   * 配置缓存配额与分段写入参数（缺省项保持不变）
   * @param {Object} [options]
   * @param {number} [options.maxCacheSize] 缓存上限（字节）
   * @param {number} [options.reserveRatio] 预留比例，取值 [0, 1)
   * @param {number} [options.chunkWriteThreshold] 走分段写入的阈值（字节）
   * @param {number} [options.chunkWriteSize] 单个分段大小（字节，受上界约束）
   */
  configure(options = {}) {
    if (Number.isFinite(options.maxCacheSize) && options.maxCacheSize > 0) {
      this.MAX_CACHE_SIZE = options.maxCacheSize;
    }
    if (
      Number.isFinite(options.reserveRatio) &&
      options.reserveRatio >= 0 &&
      options.reserveRatio < 1
    ) {
      this.RESERVE_RATIO = options.reserveRatio;
    }
    if (Number.isFinite(options.chunkWriteThreshold) && options.chunkWriteThreshold > 0) {
      this.CHUNK_WRITE_THRESHOLD = options.chunkWriteThreshold;
    }
    if (Number.isFinite(options.chunkWriteSize) && options.chunkWriteSize > 0) {
      // 分段大小必须有上界，避免一次性读入过大的内存块
      this.CHUNK_WRITE_SIZE = Math.min(options.chunkWriteSize, this.MAX_CHUNK_WRITE_SIZE);
    }
    return this;
  }

  /**
   * 需要预留的余量（字节）
   */
  getReservedBytes() {
    return Math.floor(this.MAX_CACHE_SIZE * this.RESERVE_RATIO);
  }

  /**
   * 初始化缓存目录
   */
  async initialize() {
    if (this.initialized) {
      return;
    }
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
    const cacheKey = this._getCacheKey(fileId);
    const realm = await realmService.getRealm();
    const indexedItem = realm.objectForPrimaryKey('FileCacheIndex', `cache_${cacheKey}`);

    if (indexedItem?.path && await RNFS.exists(indexedItem.path)) {
      // 以索引中的真实路径为准，避免 URL、扩展名和缓存文件名不一致。
      this._updateLastAccess(fileId).catch(() => {});
      return indexedItem.path;
    }

    const safeExtension = this._sanitizeExtension(extension);
    const fileName = safeExtension ? `${cacheKey}.${safeExtension}` : cacheKey;
    const path = `${this.CACHE_DIR}/${fileName}`;
    if (await RNFS.exists(path)) {
      this._updateLastAccess(fileId).catch(() => {});
      return path;
    }
    return null;
  }

  /**
   * 将文件保存到缓存并执行 LRU
   * @param {string} fileId 文件唯一标识
   * @param {string} sourcePath 源文件路径
   * @param {Object} [metadata]
   * @param {string} [metadata.extension] 扩展名
   * @param {number} [metadata.size] 文件大小（字节）
   * @param {number} [metadata.expectedSize] 期望大小，用于完整性校验
   * @param {string} [metadata.sha256] 期望的 sha256，用于完整性校验
   * @param {string} [metadata.mimeType] MIME 类型
   */
  async saveToCache(fileId, sourcePath, metadata = {}) {
    await this.initialize();
    const cacheKey = this._getCacheKey(fileId);
    const extension = this._sanitizeExtension(metadata.extension || '');
    const fileName = extension ? `${cacheKey}.${extension}` : cacheKey;
    const destPath = `${this.CACHE_DIR}/${fileName}`;

    try {
      // 1. 解析源文件大小：决定配额计算与快慢路径
      const sourceSize = await this._resolveSourceSize(sourcePath, metadata);

      // 2. 写入前按配额清理并预留 reserveRatio 余量，保护正在写入的 key
      await this._enforceLRU(sourceSize, [cacheKey]);

      // 3. 小文件走 copyFile 快路径，大文件走有界分段写入
      if (sourceSize >= this.CHUNK_WRITE_THRESHOLD) {
        await this._writeChunked(sourcePath, destPath, sourceSize);
      } else {
        await RNFS.copyFile(sourcePath, destPath);
      }

      // 4. 完整性校验（sha256 / 大小），校验不通过则抛错且不写索引
      await this._verifyIntegrity(destPath, metadata);

      // 5. 记录到 Realm 索引
      await this._recordInIndex(fileId, cacheKey, {
        path: destPath,
        size: Number.isFinite(Number(metadata.size)) ? Number(metadata.size) : sourceSize,
        mimeType: metadata.mimeType,
      });

      return destPath;
    } catch (error) {
      if (error && error.code === CACHE_INTEGRITY_ERROR) {
        // 校验失败的半成品不能留在缓存目录
        await this._safeUnlink(destPath);
      }
      logService.error('[DownloadCache] 保存缓存失败', error);
      throw error;
    }
  }

  /**
   * 从缓存中移除单个文件（文件 + 索引）
   * @param {string} fileId 文件唯一标识
   * @returns {Promise<boolean>} 是否命中并移除
   */
  async removeFromCache(fileId) {
    await this.initialize();
    const realm = await realmService.getRealm();
    const cacheKey = this._getCacheKey(fileId);
    const item = realm.objectForPrimaryKey('FileCacheIndex', `${CACHE_INDEX_PREFIX}${cacheKey}`);

    if (!item) {
      return false;
    }

    await this._safeUnlink(item.path);
    realm.write(() => {
      realm.delete(item);
    });
    logService.info(`[DownloadCache] 移除缓存: ${fileId}`);
    return true;
  }

  /**
   * 清空全部缓存（文件 + 索引）
   * @returns {Promise<number>} 清理的条目数
   */
  async clearCache() {
    await this.initialize();
    const realm = await realmService.getRealm();
    const indexItems = realm.objects('FileCacheIndex');
    const { items } = this._collectIndexEntries(indexItems);

    for (const item of items) {
      await this._safeUnlink(item.path);
    }

    if (items.length > 0) {
      realm.write(() => {
        items.forEach((item) => realm.delete(item));
      });
    }

    logService.info(`[DownloadCache] 清空缓存: ${items.length} 项`);
    return items.length;
  }

  /**
   * 缓存统计信息
   */
  async getCacheStats() {
    await this.initialize();
    const realm = await realmService.getRealm();
    const indexItems = realm.objects('FileCacheIndex');
    const { entries } = this._collectIndexEntries(indexItems);
    const usedBytes = totalSize(entries);

    return {
      count: entries.length,
      totalSize: usedBytes,
      maxCacheSize: this.MAX_CACHE_SIZE,
      reserveBytes: this.getReservedBytes(),
      usageRatio: this.MAX_CACHE_SIZE > 0 ? usedBytes / this.MAX_CACHE_SIZE : 0,
    };
  }

  _getCacheKey(fileId) {
    const value = String(fileId || 'unknown');
    if (/^[A-Za-z0-9._-]{1,120}$/.test(value) && value !== '.' && value !== '..') {
      return value;
    }
    return `remote_${CryptoJS.SHA256(value).toString()}`;
  }

  _sanitizeExtension(extension) {
    return String(extension || '')
      .replace(/^\./, '')
      .replace(/[^A-Za-z0-9]/g, '')
      .slice(0, 16);
  }

  /**
   * 解析源文件大小：优先使用声明的 size，否则回退到 RNFS.stat
   * @private
   */
  async _resolveSourceSize(sourcePath, metadata = {}) {
    const declared = Number(metadata.size);
    if (Number.isFinite(declared) && declared > 0) {
      return declared;
    }
    try {
      const info = await RNFS.stat(sourcePath);
      const actual = Number(info && info.size);
      return Number.isFinite(actual) && actual > 0 ? actual : 0;
    } catch (error) {
      logService.warn('[DownloadCache] 无法获取源文件大小，按 0 处理', error);
      return Number.isFinite(declared) && declared > 0 ? declared : 0;
    }
  }

  /**
   * 有界分段写入：避免一次性把大文件读入内存
   * @private
   */
  async _writeChunked(sourcePath, destPath, totalBytes) {
    const chunkSize = Math.max(1, Math.min(this.CHUNK_WRITE_SIZE, this.MAX_CHUNK_WRITE_SIZE));
    let offset = 0;
    let created = false;

    while (offset < totalBytes) {
      const length = Math.min(chunkSize, totalBytes - offset);
      const chunk = await RNFS.read(sourcePath, length, offset, 'base64');
      if (created) {
        await RNFS.appendFile(destPath, chunk, 'base64');
      } else {
        await RNFS.writeFile(destPath, chunk, 'base64');
        created = true;
      }
      offset += length;
    }

    if (!created) {
      // 空文件也要落盘，保持路径可用
      await RNFS.writeFile(destPath, '', 'base64');
    }

    return destPath;
  }

  /**
   * 完整性校验：大小 + sha256
   * RNFS.hash 不存在或不支持时安全降级为仅大小校验，不得让主流程失败
   * @private
   */
  async _verifyIntegrity(destPath, metadata = {}) {
    const { expectedSize, sha256 } = metadata;

    if (expectedSize !== undefined && expectedSize !== null) {
      try {
        const info = await RNFS.stat(destPath);
        const actualSize = Number(info && info.size);
        const wantedSize = Number(expectedSize);
        if (
          Number.isFinite(actualSize) &&
          Number.isFinite(wantedSize) &&
          actualSize !== wantedSize
        ) {
          throw this._integrityError(`大小校验失败: 期望 ${wantedSize}, 实际 ${actualSize}`);
        }
      } catch (error) {
        if (error && error.code === CACHE_INTEGRITY_ERROR) {
          throw error;
        }
        logService.warn('[DownloadCache] 大小校验不可用，降级处理', error);
      }
    }

    if (!sha256) {
      return;
    }

    if (typeof RNFS.hash !== 'function') {
      logService.warn('[DownloadCache] 当前 RNFS 不支持 hash，降级为仅大小校验');
      return;
    }

    let actualHash;
    try {
      actualHash = await RNFS.hash(destPath, 'sha256');
    } catch (error) {
      logService.warn('[DownloadCache] sha256 计算失败，降级为仅大小校验', error);
      return;
    }

    const wantedHash = String(sha256).trim().toLowerCase();
    if (String(actualHash).trim().toLowerCase() !== wantedHash) {
      throw this._integrityError('sha256 校验失败');
    }
  }

  /**
   * 安全删除文件：不存在或删除失败都不影响主流程
   * @private
   */
  async _safeUnlink(path) {
    if (!path) {
      return false;
    }
    try {
      if (await RNFS.exists(path)) {
        await RNFS.unlink(path);
      }
      return true;
    } catch (error) {
      logService.warn(`[DownloadCache] 无法删除缓存文件: ${path}`, error);
      return false;
    }
  }

  /**
   * 从 Realm 索引记录推导缓存 key（_id 形如 cache_<key>）
   * @private
   */
  _resolveCacheKey(item) {
    const id = String((item && item._id) || '');
    if (id.startsWith(CACHE_INDEX_PREFIX)) {
      return id.slice(CACHE_INDEX_PREFIX.length);
    }
    if (item && item.fileId) {
      return this._getCacheKey(item.fileId);
    }
    return id;
  }

  /**
   * 将 Realm Results 归一化为纯索引条目，便于交给纯函数模块
   * @private
   */
  _collectIndexEntries(indexItems) {
    const items = [];
    const entries = [];
    if (!indexItems) {
      return { items, entries };
    }

    const length = Number(indexItems.length) || 0;
    for (let i = 0; i < length; i += 1) {
      const item = indexItems[i];
      if (!item) {
        continue;
      }
      items.push(item);
      entries.push({
        key: this._resolveCacheKey(item),
        size: Number(item.size) || 0,
        lastAccessedAt: item.lastAccessedAt,
      });
    }
    return { items, entries };
  }

  /**
   * 执行 LRU 清理：由 cacheLruIndex.selectEvictions 决定淘汰列表
   * @private
   */
  async _enforceLRU(incomingSize, protectedKeys = []) {
    const realm = await realmService.getRealm();
    const indexItems = realm.objects('FileCacheIndex').sorted('lastAccessedAt', false);
    const { items, entries } = this._collectIndexEntries(indexItems);

    if (entries.length === 0) {
      return [];
    }

    const evictions = selectEvictions(entries, {
      maxBytes: this.MAX_CACHE_SIZE,
      incomingBytes: incomingSize,
      reserveBytes: this.getReservedBytes(),
      protectedKeys,
    });

    const itemsByKey = new Map();
    entries.forEach((entry, index) => {
      itemsByKey.set(entry.key, items[index]);
    });

    const removedKeys = [];
    for (const key of evictions) {
      const item = itemsByKey.get(key);
      if (!item) {
        continue;
      }
      try {
        if (await RNFS.exists(item.path)) {
          await RNFS.unlink(item.path);
        }
        realm.write(() => {
          realm.delete(item);
        });
        removedKeys.push(key);
        logService.info(`[DownloadCache] LRU 清理: ${item.fileId}`);
      } catch (e) {
        logService.warn(`[DownloadCache] 无法删除缓存文件: ${item.path}`, e);
      }
    }
    return removedKeys;
  }

  _integrityError(message) {
    const error = new Error(message);
    error.code = CACHE_INTEGRITY_ERROR;
    return error;
  }

  async _recordInIndex(fileId, cacheKey, data) {
    const realm = await realmService.getRealm();
    realm.write(() => {
      realm.create('FileCacheIndex', {
        _id: `${CACHE_INDEX_PREFIX}${cacheKey}`,
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
    const item = realm.objectForPrimaryKey('FileCacheIndex', `${CACHE_INDEX_PREFIX}${this._getCacheKey(fileId)}`);
    if (item) {
      realm.write(() => {
        item.lastAccessedAt = new Date();
      });
    }
  }
}

export const downloadCacheService = new DownloadCacheService();
export default downloadCacheService;
