/**
 * API缓存服务
 * 提供API响应缓存功能
 */

import realmService from '../database/realmService';
import { logService } from '../../utils/logService';

/**
 * API缓存服务
 */
class ApiCache {
  constructor() {
    this.initialized = false;
    this.initializationPromise = null;
  }

  /**
   * 初始化服务
   */
  async initialize() {
    if (this.initialized) return Promise.resolve();

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = new Promise(async (resolve, reject) => {
      try {
        // 初始化Realm存储服务
        // realmService 不需要手动初始化

        this.initialized = true;
        logService.info('API缓存服务初始化成功');
        resolve();
      } catch (error) {
        logService.error('API缓存服务初始化失败', error);
        reject(error);
      }
    });

    return this.initializationPromise;
  }

  /**
   * 获取项目
   * @param {string} key 存储键
   * @returns {Promise<any|null>} 存储值
   */
  async getItem(key) {
    try {
      await this.initialize();
      const realm = await realmService.getRealm();
      const item = realm.objects('StorageItem').filtered(`key = "${key}"`);
      return item.length > 0 ? item[0].value : null;
    } catch (error) {
      logService.error(`获取API缓存项目失败: ${key}`, error);
      return null;
    }
  }

  /**
   * 设置项目
   * @param {string} key 存储键
   * @param {any} value 存储值
   * @returns {Promise<boolean>} 是否成功
   */
  async setItem(key, value) {
    try {
      await this.initialize();
      const realm = await realmService.getRealm();
      realm.write(() => {
        const existingItem = realm.objects('StorageItem').filtered(`key = "${key}"`);
        if (existingItem.length > 0) {
          existingItem[0].value = value;
          existingItem[0].updated_at = new Date();
        } else {
          realm.create('StorageItem', {
            key: key,
            value: value,
            createdAt: new Date(),
            updated_at: new Date(),
          });
        }
      });
      return true;
    } catch (error) {
      logService.error(`设置API缓存项目失败: ${key}`, error);
      return false;
    }
  }

  /**
   * 删除项目
   * @param {string} key 存储键
   * @returns {Promise<boolean>} 是否成功
   */
  async removeItem(key) {
    try {
      await this.initialize();
      const realm = await realmService.getRealm();
      realm.write(() => {
        const item = realm.objects('StorageItem').filtered(`key = "${key}"`);
        if (item.length > 0) realm.delete(item[0]);
      });
      return true;
    } catch (error) {
      logService.error(`删除API缓存项目失败: ${key}`, error);
      return false;
    }
  }

  /**
   * 获取所有键
   * @returns {Promise<Array<string>>} 键数组
   */
  async getAllKeys() {
    try {
      await this.initialize();
      const realm = await realmService.getRealm();
      const items = realm.objects('StorageItem');
      return items.map(item => item.key);
    } catch (error) {
      logService.error('获取所有API缓存键失败', error);
      return [];
    }
  }

  /**
   * 批量删除
   * @param {Array<string>} keys 键数组
   * @returns {Promise<boolean>} 是否成功
   */
  async multiRemove(keys) {
    try {
      await this.initialize();
      const realm = await realmService.getRealm();
      realm.write(() => {
        for (const key of keys) {
          const item = realm.objects('StorageItem').filtered(`key = "${key}"`);
          if (item.length > 0) realm.delete(item[0]);
        }
      });
      return true;
    } catch (error) {
      logService.error('批量删除API缓存项目失败', error);
      return false;
    }
  }

  /**
   * 缓存API响应
   * @param {string} url API URL
   * @param {Object} data 响应数据
   * @param {number} expirationMinutes 过期时间（分钟）
   * @returns {Promise<boolean>} 是否成功
   */
  async cacheApiResponse(url, data, expirationMinutes = 60) {
    try {
      await this.initialize();
      const cacheKey = `cache_${url}`;
      const cacheData = {
        data,
        timestamp: Date.now(),
        expiration: Date.now() + expirationMinutes * 60 * 1000
      };
      const realm = await realmService.getRealm();
      realm.write(() => {
        const existingItem = realm.objects('StorageItem').filtered(`key = "${cacheKey}"`);
        if (existingItem.length > 0) {
          existingItem[0].value = JSON.stringify(cacheData);
          existingItem[0].updated_at = new Date();
        } else {
          realm.create('StorageItem', {
            key: cacheKey,
            value: JSON.stringify(cacheData),
            createdAt: new Date(),
            updated_at: new Date(),
          });
        }
      });
      return true;
    } catch (error) {
      logService.error(`缓存API响应失败: ${url}`, error);
      return false;
    }
  }

  /**
   * 获取缓存的API响应
   * @param {string} url API URL
   * @returns {Promise<Object|null>} 缓存的响应数据
   */
  async getCachedApiResponse(url) {
    try {
      await this.initialize();
      const cacheKey = `cache_${url}`;
      const realm = await realmService.getRealm();
      const item = realm.objects('StorageItem').filtered(`key = "${cacheKey}"`);
      const cacheData = item.length > 0 ? item[0].value : null;

      if (!cacheData) {
        return null;
      }

      // 检查是否过期
      if (cacheData.expiration && cacheData.expiration < Date.now()) {
        // 缓存已过期，删除并返回null
        realm.write(() => {
          const item = realm.objects('StorageItem').filtered(`key = "${cacheKey}"`);
          if (item.length > 0) realm.delete(item[0]);
        });
        return null;
      }

      return cacheData.data;
    } catch (error) {
      logService.error(`获取缓存的API响应失败: ${url}`, error);
      return null;
    }
  }

  /**
   * 清除所有API缓存
   * @returns {Promise<boolean>} 是否成功
   */
  async clearAllCache() {
    try {
      await this.initialize();
      const realm = await realmService.getRealm();
      const items = realm.objects('StorageItem');
      const keys = items.map(item => item.key);
      const cacheKeys = keys.filter(key => key.startsWith('cache_'));

      if (cacheKeys.length > 0) {
        realm.write(() => {
          for (const key of cacheKeys) {
            const item = realm.objects('StorageItem').filtered(`key = "${key}"`);
            if (item.length > 0) realm.delete(item[0]);
          }
        });
      }

      return true;
    } catch (error) {
      logService.error('清除所有API缓存失败', error);
      return false;
    }
  }

  /**
   * 清除特定URL的缓存
   * @param {string} url API URL
   * @returns {Promise<boolean>} 是否成功
   */
  async clearCache(url) {
    try {
      await this.initialize();
      const cacheKey = `cache_${url}`;
      const realm = await realmService.getRealm();
      realm.write(() => {
        const item = realm.objects('StorageItem').filtered(`key = "${cacheKey}"`);
        if (item.length > 0) realm.delete(item[0]);
      });
      return true;
    } catch (error) {
      logService.error(`清除API缓存失败: ${url}`, error);
      return false;
    }
  }
}

// 创建单例实例
const apiCache = new ApiCache();

// 初始化
apiCache.initialize().catch(error => {
  console.error('初始化API缓存服务失败', error);
  if (logService && typeof logService.error === 'function') {
    logService.error('初始化API缓存服务失败', error);
  }
});

// 确保导出正确
module.exports = apiCache;
module.exports.default = apiCache;
export default apiCache;
