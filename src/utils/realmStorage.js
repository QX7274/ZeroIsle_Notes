/**
 * Realm存储适配器 - 为redux-persist提供基于MongoDB Realm的存储实现
 * 
 * 这个适配器实现了redux-persist所需的存储接口，并使用realmStorageService作为底层存储
 */

import realmService from '../services/database/realmService';
import { logService } from './logService';

// 为redux-persist创建存储适配器
const realmStorage = {
  /**
   * 获取项目
   * @param {string} key 存储键
   * @returns {Promise<any>} 存储值
   */
  async getItem(key) {
    try {
      const realm = await realmService.getRealm();
      const item = realm.objects('StorageItem').filtered(`key = "${key}"`);
      const value = item.length > 0 ? item[0].value : null;
      return value;
    } catch (error) {
      logService.error(`[realmStorage] 获取项目失败: ${key}`, error);
      return null;
    }
  },

  /**
   * 设置项目
   * @param {string} key 存储键
   * @param {any} value 存储值
   * @returns {Promise<void>}
   */
  async setItem(key, value) {
    try {
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
    } catch (error) {
      logService.error(`[realmStorage] 设置项目失败: ${key}`, error);
      throw error;
    }
  },

  /**
   * 删除项目
   * @param {string} key 存储键
   * @returns {Promise<void>}
   */
  async removeItem(key) {
    try {
      const realm = await realmService.getRealm();
      realm.write(() => {
        const item = realm.objects('StorageItem').filtered(`key = "${key}"`);
        if (item.length > 0) {
          realm.delete(item[0]);
        }
      });
    } catch (error) {
      logService.error(`[realmStorage] 删除项目失败: ${key}`, error);
      throw error;
    }
  },

  /**
   * 获取所有键
   * @returns {Promise<Array<string>>} 键数组
   */
  async getAllKeys() {
    try {
      const realm = await realmService.getRealm();
      const items = realm.objects('StorageItem');
      return items.map(item => item.key);
    } catch (error) {
      logService.error('[realmStorage] 获取所有键失败', error);
      return [];
    }
  },

  /**
   * 批量获取项目
   * @param {Array<string>} keys 键数组
   * @returns {Promise<Array<Array<string, any>>>} 键值对数组
   */
  async multiGet(keys) {
    try {
      const realm = await realmService.getRealm();
      const results = [];
      for (const key of keys) {
        const item = realm.objects('StorageItem').filtered(`key = "${key}"`);
        results.push([key, item.length > 0 ? item[0].value : null]);
      }
      return results;
    } catch (error) {
      logService.error('[realmStorage] 批量获取项目失败', error);
      return keys.map(key => [key, null]);
    }
  },

  /**
   * 批量设置项目
   * @param {Array<Array<string, any>>} keyValuePairs 键值对数组
   * @returns {Promise<void>}
   */
  async multiSet(keyValuePairs) {
    try {
      const realm = await realmService.getRealm();
      realm.write(() => {
        for (const [key, value] of keyValuePairs) {
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
        }
      });
    } catch (error) {
      logService.error('[realmStorage] 批量设置项目失败', error);
      throw error;
    }
  },

  /**
   * 批量删除项目
   * @param {Array<string>} keys 键数组
   * @returns {Promise<void>}
   */
  async multiRemove(keys) {
    try {
      const realm = await realmService.getRealm();
      realm.write(() => {
        for (const key of keys) {
          const item = realm.objects('StorageItem').filtered(`key = "${key}"`);
          if (item.length > 0) {
            realm.delete(item[0]);
          }
        }
      });
    } catch (error) {
      logService.error('[realmStorage] 批量删除项目失败', error);
      throw error;
    }
  },
};

export default realmStorage;
