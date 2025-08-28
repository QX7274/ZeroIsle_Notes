/**
 * Realm存储服务 - 提供基于MongoDB Realm的本地存储功能
 * 替代AsyncStorage，提供类似的API
 */

import { realmService } from '../database/realmService';

// 直接使用控制台日志

class RealmStorageService {
  constructor() {
    this.initialized = false;
    this.initializationPromise = null;
  }

  /**
   * 初始化存储服务
   */
  async initialize() {
    if (this.initialized) return Promise.resolve();

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = new Promise(async (resolve, reject) => {
      try {
        // 初始化Realm服务
        await realmService.initialize();

        this.initialized = true;
        console.info('[RealmStorage] Realm存储服务初始化成功');
        resolve();
      } catch (error) {
        console.error('[RealmStorage] Realm存储服务初始化失败', error);
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

      // 获取Realm实例
      const realm = await realmService.getRealm();

      // 检查Realm实例是否有效
      if (!realm || realm.isClosed) {
        console.error('[RealmStorage] Realm实例无效或已关闭');
        return null;
      }

      // 查询存储项目
      const item = realm.objectForPrimaryKey('StorageItem', key);

      if (!item) {
        return null;
      }

      // 解析JSON值
      try {
        return JSON.parse(item.value);
      } catch (parseError) {
        // 如果不是JSON，返回原始值
        return item.value;
      }
    } catch (error) {
      console.error(`[RealmStorage] 获取存储项目失败: ${key}`, error);
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
      // 检查key是否有效
      if (key === undefined || key === null) {
        console.warn('[RealmStorage] 尝试设置无效的键:', key);
        return false;
      }

      // 检查value是否有效
      if (value === undefined) {
        console.warn(`[RealmStorage] 尝试设置undefined值到键: ${key}`);
        return false;
      }

      await this.initialize();

      // 获取Realm实例
      const realm = await realmService.getRealm();

      // 检查Realm实例是否有效
      if (!realm || realm.isClosed) {
        console.error('[RealmStorage] Realm实例无效或已关闭');
        return false;
      }

      // 准备存储值
      let stringValue;
      if (value === null) {
        stringValue = 'null';
      } else if (typeof value === 'string') {
        stringValue = value;
      } else {
        try {
          const getCircularReplacer = () => {
            const seen = new WeakSet();
            return (key, value) => {
              if (typeof value === 'object' && value !== null) {
                if (seen.has(value)) return;
                seen.add(value);
              }
              return value;
            };
          };
          stringValue = JSON.stringify(value, getCircularReplacer());
        } catch (jsonError) {
          console.error(`[RealmStorage] 无法序列化值: ${key}`, jsonError);
          return false;
        }
      }

      // 当前时间
      const now = new Date();

      // 写入或更新存储项目
      realm.write(() => {
        realm.create('StorageItem', {
          key,
          value: stringValue,
          created_at: now,
          updated_at: now,
        }, 'modified');
      });

      console.log(`[RealmStorage] 成功设置存储项目: ${key}`);
      return true;
    } catch (error) {
      console.error(`[RealmStorage] 设置存储项目失败: ${key}`, error);
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
      // 检查key是否有效
      if (key === undefined || key === null) {
        console.warn('[RealmStorage] 尝试删除无效的键:', key);
        return false;
      }

      await this.initialize();

      // 获取Realm实例
      const realm = await realmService.getRealm();

      // 查询存储项目
      const item = realm.objectForPrimaryKey('StorageItem', key);

      if (!item) {
        console.log(`[RealmStorage] 项目不存在，无需删除: ${key}`);
        return true; // 项目不存在，视为删除成功
      }

      // 删除存储项目
      realm.write(() => {
        realm.delete(item);
      });

      console.log(`[RealmStorage] 成功删除存储项目: ${key}`);
      return true;
    } catch (error) {
      console.error(`[RealmStorage] 删除存储项目失败: ${key}`, error);
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

      // 获取Realm实例
      const realm = await realmService.getRealm();

      // 查询所有存储项目
      const items = realm.objects('StorageItem');

      // 提取键
      return Array.from(items).map(item => item.key);
    } catch (error) {
      console.error('[RealmStorage] 获取所有存储键失败', error);
      return [];
    }
  }

  /**
   * 批量获取项目
   * @param {Array<string>} keys 键数组
   * @returns {Promise<Array<Array<string, any>>>} 键值对数组
   */
  async multiGet(keys) {
    try {
      await this.initialize();

      // 获取Realm实例
      const realm = await realmService.getRealm();

      // 结果数组
      const result = [];

      // 查询每个键
      for (const key of keys) {
        const item = realm.objectForPrimaryKey('StorageItem', key);
        let value = null;

        if (item) {
          try {
            value = JSON.parse(item.value);
          } catch (parseError) {
            value = item.value;
          }
        }

        result.push([key, value]);
      }

      return result;
    } catch (error) {
      console.error('[RealmStorage] 批量获取存储项目失败', error);
      return keys.map(key => [key, null]);
    }
  }

  /**
   * 批量设置项目
   * @param {Array<Array<string, any>>} keyValuePairs 键值对数组
   * @returns {Promise<boolean>} 是否成功
   */
  async multiSet(keyValuePairs) {
    try {
      await this.initialize();

      // 获取Realm实例
      const realm = await realmService.getRealm();

      // 当前时间
      const now = new Date();

      // 批量写入
      realm.write(() => {
        for (const [key, value] of keyValuePairs) {
          const stringValue = typeof value === 'string' ? value : JSON.stringify(value);

          realm.create('StorageItem', {
            key,
            value: stringValue,
            created_at: now,
            updated_at: now,
          }, 'modified');
        }
      });

      return true;
    } catch (error) {
      console.error('[RealmStorage] 批量设置存储项目失败', error);
      return false;
    }
  }

  /**
   * 批量删除项目
   * @param {Array<string>} keys 键数组
   * @returns {Promise<boolean>} 是否成功
   */
  async multiRemove(keys) {
    try {
      await this.initialize();

      // 获取Realm实例
      const realm = await realmService.getRealm();

      // 批量删除
      realm.write(() => {
        for (const key of keys) {
          const item = realm.objectForPrimaryKey('StorageItem', key);
          if (item) {
            realm.delete(item);
          }
        }
      });

      return true;
    } catch (error) {
      console.error('[RealmStorage] 批量删除存储项目失败', error);
      return false;
    }
  }

  /**
   * 清除所有存储
   * @returns {Promise<boolean>} 是否成功
   */
  async clear() {
    try {
      await this.initialize();

      // 获取Realm实例
      const realm = await realmService.getRealm();

      // 查询所有存储项目
      const items = realm.objects('StorageItem');

      // 删除所有项目
      realm.write(() => {
        realm.delete(items);
      });

      return true;
    } catch (error) {
      console.error('[RealmStorage] 清除所有存储失败', error);
      return false;
    }
  }
}

// 创建单例实例
const realmStorageService = new RealmStorageService();

// 初始化
realmStorageService.initialize().catch(error => {
  console.error('[RealmStorage] 初始化Realm存储服务失败', error);
});

export { realmStorageService };
export default realmStorageService;
