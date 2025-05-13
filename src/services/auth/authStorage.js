/**
 * 认证存储服务
 * 提供认证相关的存储功能
 */

import { realmStorageService } from '../storage';
import { logService } from '../utils/logService';

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
        await realmStorageService.initialize();

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
      return await realmStorageService.getItem(key);
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
      return await realmStorageService.setItem(key, value);
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
      return await realmStorageService.removeItem(key);
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
      return await realmStorageService.setItem('user', user);
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
      return await realmStorageService.getItem('user');
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
      await realmStorageService.setItem('token', token);
      await realmStorageService.setItem('auth_token', token);
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
      let token = await realmStorageService.getItem('auth_token');
      if (!token) {
        token = await realmStorageService.getItem('token');
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
      await realmStorageService.removeItem('token');
      await realmStorageService.removeItem('auth_token');
      await realmStorageService.removeItem('user');
      await realmStorageService.removeItem('user_info');
      await realmStorageService.removeItem('refresh_token');
      return true;
    } catch (error) {
      logService.error('清除认证信息失败', error);
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
