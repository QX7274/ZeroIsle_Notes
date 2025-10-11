/**
 * 认证存储服务
 * 提供认证相关的存储功能
 */

import realmService from '../database/realmService';
import { logService } from '../../utils/logService';

/**
 * 认证存储服务
 */
class AuthStorage {
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
        logService.info('认证存储服务初始化成功');
        resolve();
      } catch (error) {
        logService.error('认证存储服务初始化失败', error);
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
      logService.error(`获取认证存储项目失败: ${key}`, error);
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
            created_at: new Date(),
            updated_at: new Date(),
          });
        }
      });
      return true;
    } catch (error) {
      logService.error(`设置认证存储项目失败: ${key}`, error);
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
      logService.error(`删除认证存储项目失败: ${key}`, error);
      return false;
    }
  }

  /**
   * 保存用户信息
   * @param {Object} user 用户信息
   * @returns {Promise<boolean>} 是否成功
   */
  async saveUser(user) {
    try {
      await this.initialize();
      return await this.setItem('user', JSON.stringify(user));
    } catch (error) {
      logService.error('保存用户信息失败', error);
      return false;
    }
  }

  /**
   * 获取用户信息
   * @returns {Promise<Object|null>} 用户信息
   */
  async getUser() {
    try {
      await this.initialize();
      const userStr = await this.getItem('user');
      return userStr ? JSON.parse(userStr) : null;
    } catch (error) {
      logService.error('获取用户信息失败', error);
      return null;
    }
  }

  /**
   * 保存认证令牌
   * @param {string} token 认证令牌
   * @returns {Promise<boolean>} 是否成功
   */
  async saveToken(token) {
    try {
      await this.initialize();
      // 保存到多个位置，确保兼容性
      await this.setItem('token', token);
      await this.setItem('auth_token', token);
      return true;
    } catch (error) {
      logService.error('保存认证令牌失败', error);
      return false;
    }
  }

  /**
   * 获取认证令牌
   * @returns {Promise<string|null>} 认证令牌
   */
  async getToken() {
    try {
      await this.initialize();
      // 尝试从多个位置获取
      let token = await this.getItem('auth_token');
      if (!token) {
        token = await this.getItem('token');
      }
      return token;
    } catch (error) {
      logService.error('获取认证令牌失败', error);
      return null;
    }
  }

  /**
   * 清除认证信息
   * @returns {Promise<boolean>} 是否成功
   */
  async clearAuth() {
    try {
      await this.initialize();
      await this.removeItem('token');
      await this.removeItem('auth_token');
      await this.removeItem('user');
      await this.removeItem('user_info');
      await this.removeItem('refresh_token');
      return true;
    } catch (error) {
      logService.error('清除认证信息失败', error);
      return false;
    }
  }

  /**
   * 批量删除项目
   * @param {Array<string>} keys 存储键数组
   * @returns {Promise<boolean>} 是否成功
   */
  async multiRemove(keys) {
    try {
      await this.initialize();
      for (const key of keys) {
        await this.removeItem(key);
      }
      return true;
    } catch (error) {
      logService.error(`批量删除认证存储项目失败: ${keys.join(', ')}`, error);
      return false;
    }
  }
}

// 创建单例实例
const authStorage = new AuthStorage();

// 初始化
authStorage.initialize().catch(error => {
  console.error('初始化认证存储服务失败', error);
  if (logService && typeof logService.error === 'function') {
    logService.error('初始化认证存储服务失败', error);
  }
});

// 确保导出正确
module.exports = authStorage;
module.exports.default = authStorage;
export default authStorage;
