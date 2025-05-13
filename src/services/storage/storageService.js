/**
 * 存储服务
 * 提供完全本地存储功能，只同步关键用户信息
 */

import { realmService } from '../database/realmService';
import { logService } from '../utils/logService';
import { networkService } from '../network/networkService';
import NetInfo from '@react-native-community/netinfo';
import { API_ENDPOINTS } from '../../config/api';
import axios from 'axios';
import STORAGE_KEYS from '../../constants/storageKeys';

// 需要同步的关键用户信息字段
const KEY_USER_INFO_FIELDS = [
  'username',
  'email',
  'id',
  'profile',
  'settings',
  'preferences',
];

// 需要同步的集合
const SYNC_COLLECTIONS = [
  'users',
];

class StorageService {
  constructor() {
    this.initialized = false;
    this.initializationPromise = null;
    this.isOnline = false;
    this.apiClient = null;
    this.syncInProgress = false;
    this.networkListener = null;
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

        // 检查网络状态
        const netInfo = await NetInfo.fetch();
        this.isOnline = netInfo.isConnected && netInfo.isInternetReachable;

        // 添加网络状态监听器
        this.networkListener = NetInfo.addEventListener(state => {
          const wasOnline = this.isOnline;
          this.isOnline = state.isConnected && state.isInternetReachable;

          // 如果从离线变为在线，尝试同步关键数据
          if (!wasOnline && this.isOnline) {
            this.syncKeyUserInfo();
          }
        });

        // 创建API客户端
        this.apiClient = axios.create({
          baseURL: API_ENDPOINTS.BASE_URL,
          timeout: 10000,
        });

        this.initialized = true;
        logService.info('存储服务初始化成功');
        resolve();
      } catch (error) {
        logService.error('存储服务初始化失败', error);
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
      logService.error(`获取存储项目失败: ${key}`, error);
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

      // 获取Realm实例
      const realm = await realmService.getRealm();

      // 准备存储值
      const stringValue = typeof value === 'string' ? value : JSON.stringify(value);

      // 当前时间
      const now = new Date();

      // 写入或更新存储项目
      realm.write(() => {
        realm.create('StorageItem', {
          key,
          value: stringValue,
          createdAt: now,
          updatedAt: now,
        }, 'modified');
      });

      // 如果是用户信息且在线，尝试同步关键用户信息
      if (key === STORAGE_KEYS.USER_INFO && this.isOnline) {
        this.syncKeyUserInfo();
      }

      return true;
    } catch (error) {
      logService.error(`设置存储项目失败: ${key}`, error);
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

      // 获取Realm实例
      const realm = await realmService.getRealm();

      // 查询存储项目
      const item = realm.objectForPrimaryKey('StorageItem', key);

      if (!item) {
        return true; // 项目不存在，视为删除成功
      }

      // 删除项目
      realm.write(() => {
        realm.delete(item);
      });

      return true;
    } catch (error) {
      logService.error(`删除存储项目失败: ${key}`, error);
      return false;
    }
  }

  /**
   * 同步关键用户信息到服务器
   * @returns {Promise<boolean>} 是否成功
   */
  async syncKeyUserInfo() {
    if (!this.isOnline || this.syncInProgress) {
      return false;
    }

    try {
      this.syncInProgress = true;

      // 获取用户信息
      const userInfo = await this.getItem(STORAGE_KEYS.USER_INFO);

      if (!userInfo) {
        this.syncInProgress = false;
        return false;
      }

      // 只提取关键字段
      const keyUserInfo = {};
      KEY_USER_INFO_FIELDS.forEach(field => {
        if (userInfo[field] !== undefined) {
          keyUserInfo[field] = userInfo[field];
        }
      });

      // 同步到服务器
      const token = await this.getItem(STORAGE_KEYS.AUTH_TOKEN);
      
      if (token) {
        await this.apiClient.put('/users/profile', keyUserInfo, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        });
      }

      this.syncInProgress = false;
      return true;
    } catch (error) {
      logService.error('同步关键用户信息失败', error);
      this.syncInProgress = false;
      return false;
    }
  }

  /**
   * 手动上传数据到服务器
   * @param {string} collection 集合名称
   * @param {string} id 记录ID
   * @param {Object} data 数据
   * @returns {Promise<Object>} 上传结果
   */
  async uploadData(collection, id, data) {
    if (!this.isOnline) {
      return { success: false, message: '离线状态无法上传数据' };
    }

    try {
      await this.initialize();

      // 获取认证令牌
      const token = await this.getItem(STORAGE_KEYS.AUTH_TOKEN);
      
      if (!token) {
        return { success: false, message: '未登录，无法上传数据' };
      }

      // 上传数据
      const response = await this.apiClient.post(`/${collection}/${id}/upload`, data, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      return { success: true, data: response.data };
    } catch (error) {
      logService.error(`上传数据失败: ${collection}/${id}`, error);
      return { 
        success: false, 
        message: error.response?.data?.message || '上传数据失败',
        error
      };
    }
  }

  /**
   * 设置认证令牌
   * @param {string} token 认证令牌
   * @returns {Promise<boolean>} 是否成功
   */
  async setToken(token) {
    return this.setItem(STORAGE_KEYS.AUTH_TOKEN, token);
  }

  /**
   * 设置刷新令牌
   * @param {string} token 刷新令牌
   * @returns {Promise<boolean>} 是否成功
   */
  async setRefreshToken(token) {
    return this.setItem(STORAGE_KEYS.REFRESH_TOKEN, token);
  }

  /**
   * 设置用户信息
   * @param {Object} user 用户信息
   * @returns {Promise<boolean>} 是否成功
   */
  async setUser(user) {
    return this.setItem(STORAGE_KEYS.USER_INFO, user);
  }
}

// 创建单例实例
const storageService = new StorageService();

// 初始化
storageService.initialize().catch(error => {
  logService.error('初始化存储服务失败', error);
});

export default storageService;
