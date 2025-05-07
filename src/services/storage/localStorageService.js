/**
 * 本地存储服务
 * 提供离线数据存储和同步功能
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { Platform, ToastAndroid } from 'react-native';

// 存储键前缀
const STORAGE_PREFIX = 'zeroisle_';

// 存储键
export const STORAGE_KEYS = {
  // 用户数据
  USER: `${STORAGE_PREFIX}user`,
  TOKEN: `${STORAGE_PREFIX}token`,
  REFRESH_TOKEN: `${STORAGE_PREFIX}refresh_token`,
  
  // 笔记数据
  NOTES: `${STORAGE_PREFIX}notes`,
  NOTE_DETAIL: (id) => `${STORAGE_PREFIX}note_${id}`,
  CATEGORIES: `${STORAGE_PREFIX}categories`,
  TAGS: `${STORAGE_PREFIX}tags`,
  
  // 提醒数据
  REMINDERS: `${STORAGE_PREFIX}reminders`,
  REMINDER_DETAIL: (id) => `${STORAGE_PREFIX}reminder_${id}`,
  
  // 群组数据
  GROUPS: `${STORAGE_PREFIX}groups`,
  GROUP_DETAIL: (id) => `${STORAGE_PREFIX}group_${id}`,
  GROUP_MEMBERS: (id) => `${STORAGE_PREFIX}group_members_${id}`,
  
  // 设置
  SETTINGS: `${STORAGE_PREFIX}settings`,
  THEME: `${STORAGE_PREFIX}theme`,
  
  // 同步状态
  SYNC_STATUS: `${STORAGE_PREFIX}sync_status`,
  LAST_SYNC: `${STORAGE_PREFIX}last_sync`,
  
  // 离线队列
  OFFLINE_QUEUE: `${STORAGE_PREFIX}offline_queue`,
};

/**
 * 本地存储服务
 */
class LocalStorageService {
  /**
   * 保存数据到本地存储
   * @param {string} key - 存储键
   * @param {any} data - 要存储的数据
   * @returns {Promise<void>}
   */
  async saveData(key, data) {
    try {
      const jsonValue = JSON.stringify(data);
      await AsyncStorage.setItem(key, jsonValue);
      return true;
    } catch (error) {
      console.error(`保存数据失败 (${key}):`, error);
      return false;
    }
  }

  /**
   * 从本地存储获取数据
   * @param {string} key - 存储键
   * @returns {Promise<any>} - 存储的数据
   */
  async getData(key) {
    try {
      const jsonValue = await AsyncStorage.getItem(key);
      return jsonValue != null ? JSON.parse(jsonValue) : null;
    } catch (error) {
      console.error(`获取数据失败 (${key}):`, error);
      return null;
    }
  }

  /**
   * 从本地存储删除数据
   * @param {string} key - 存储键
   * @returns {Promise<boolean>} - 是否成功
   */
  async removeData(key) {
    try {
      await AsyncStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error(`删除数据失败 (${key}):`, error);
      return false;
    }
  }

  /**
   * 清除所有本地存储数据
   * @returns {Promise<boolean>} - 是否成功
   */
  async clearAll() {
    try {
      await AsyncStorage.clear();
      return true;
    } catch (error) {
      console.error('清除所有数据失败:', error);
      return false;
    }
  }

  /**
   * 获取所有存储键
   * @returns {Promise<string[]>} - 存储键列表
   */
  async getAllKeys() {
    try {
      const keys = await AsyncStorage.getAllKeys();
      return keys.filter(key => key.startsWith(STORAGE_PREFIX));
    } catch (error) {
      console.error('获取所有键失败:', error);
      return [];
    }
  }

  /**
   * 检查网络连接状态
   * @returns {Promise<boolean>} - 是否连接
   */
  async isConnected() {
    try {
      const state = await NetInfo.fetch();
      return state.isConnected;
    } catch (error) {
      console.error('检查网络连接失败:', error);
      return false;
    }
  }

  /**
   * 添加离线操作到队列
   * @param {object} operation - 离线操作
   * @returns {Promise<boolean>} - 是否成功
   */
  async addToOfflineQueue(operation) {
    try {
      // 获取当前队列
      const queue = await this.getData(STORAGE_KEYS.OFFLINE_QUEUE) || [];
      
      // 添加操作到队列
      queue.push({
        ...operation,
        timestamp: new Date().toISOString(),
      });
      
      // 保存队列
      await this.saveData(STORAGE_KEYS.OFFLINE_QUEUE, queue);
      
      // 显示提示
      if (Platform.OS === 'android') {
        ToastAndroid.show('操作已保存，将在网络恢复时同步', ToastAndroid.SHORT);
      }
      
      return true;
    } catch (error) {
      console.error('添加到离线队列失败:', error);
      return false;
    }
  }

  /**
   * 获取离线操作队列
   * @returns {Promise<Array>} - 离线操作队列
   */
  async getOfflineQueue() {
    return await this.getData(STORAGE_KEYS.OFFLINE_QUEUE) || [];
  }

  /**
   * 清空离线操作队列
   * @returns {Promise<boolean>} - 是否成功
   */
  async clearOfflineQueue() {
    return await this.saveData(STORAGE_KEYS.OFFLINE_QUEUE, []);
  }

  /**
   * 更新同步状态
   * @param {string} type - 数据类型
   * @param {Date} timestamp - 同步时间戳
   * @returns {Promise<boolean>} - 是否成功
   */
  async updateSyncStatus(type, timestamp = new Date()) {
    try {
      // 获取当前同步状态
      const syncStatus = await this.getData(STORAGE_KEYS.SYNC_STATUS) || {};
      
      // 更新同步状态
      syncStatus[type] = timestamp.toISOString();
      
      // 保存同步状态
      await this.saveData(STORAGE_KEYS.SYNC_STATUS, syncStatus);
      
      // 更新最后同步时间
      await this.saveData(STORAGE_KEYS.LAST_SYNC, timestamp.toISOString());
      
      return true;
    } catch (error) {
      console.error('更新同步状态失败:', error);
      return false;
    }
  }

  /**
   * 获取同步状态
   * @param {string} type - 数据类型
   * @returns {Promise<string>} - 同步时间戳
   */
  async getSyncStatus(type) {
    try {
      const syncStatus = await this.getData(STORAGE_KEYS.SYNC_STATUS) || {};
      return syncStatus[type] || null;
    } catch (error) {
      console.error('获取同步状态失败:', error);
      return null;
    }
  }
}

// 导出单例
export default new LocalStorageService();
