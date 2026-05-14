/**
 * 提醒MongoDB服务
 * 提供提醒相关的MongoDB存储功能
 */

import realmService from '../database/realmService';
import { logService } from '../../utils/logService';

/**
 * 提醒MongoDB服务类
 * 提供提醒相关的MongoDB存储功能
 */
class ReminderMongoDBService {
  constructor() {
    this.initialized = false;
    this.initializationPromise = null;
  }

  normalizeStoredValueForWrite(value) {
    if (typeof value === 'string') {
      return value;
    }

    return JSON.stringify(value);
  }

  normalizeStoredValueForRead(value) {
    if (typeof value !== 'string') {
      return value;
    }

    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  /**
   * 初始化服务
   */
  async initialize() {
    if (this.initialized) {return Promise.resolve();}

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = new Promise(async (resolve, reject) => {
      try {
        // 初始化Realm存储服务
        // realmService 不需要手动初始化

        this.initialized = true;
        logService.info('提醒MongoDB服务初始化成功');
        resolve();
      } catch (error) {
        logService.error('提醒MongoDB服务初始化失败', error);
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
      return item.length > 0 ? this.normalizeStoredValueForRead(item[0].value) : null;
    } catch (error) {
      logService.error(`获取提醒存储项目失败: ${key}`, error);
      throw error;
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
      const normalizedValue = this.normalizeStoredValueForWrite(value);
      realm.write(() => {
        const existingItem = realm.objects('StorageItem').filtered(`key = "${key}"`);
        if (existingItem.length > 0) {
          existingItem[0].value = normalizedValue;
          existingItem[0].updated_at = new Date();
        } else {
          realm.create('StorageItem', {
            key: key,
            value: normalizedValue,
            createdAt: new Date(),
            updated_at: new Date(),
          });
        }
      });
      return true;
    } catch (error) {
      logService.error(`设置提醒存储项目失败: ${key}`, error);
      throw error;
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
        if (item.length > 0) {realm.delete(item[0]);}
      });
      return true;
    } catch (error) {
      logService.error(`删除提醒存储项目失败: ${key}`, error);
      throw error;
    }
  }

  /**
   * 获取所有提醒
   * @returns {Promise<Array<Object>>} 提醒数组
   */
  async getAllReminders() {
    try {
      await this.initialize();
      const realm = await realmService.getRealm();
      const item = realm.objects('StorageItem').filtered('key = "all_reminders"');
      const reminders = item.length > 0 ? this.normalizeStoredValueForRead(item[0].value) : null;
      return Array.isArray(reminders) ? reminders : [];
    } catch (error) {
      logService.error('获取所有提醒失败', error);
      throw error;
    }
  }

  /**
   * 保存所有提醒
   * @param {Array<Object>} reminders 提醒数组
   * @returns {Promise<boolean>} 是否成功
   */
  async saveAllReminders(reminders) {
    try {
      await this.initialize();
      const realm = await realmService.getRealm();
      realm.write(() => {
        const existingItem = realm.objects('StorageItem').filtered('key = "all_reminders"');
        if (existingItem.length > 0) {
          existingItem[0].value = JSON.stringify(reminders);
          existingItem[0].updated_at = new Date();
        } else {
          realm.create('StorageItem', {
            key: 'all_reminders',
            value: JSON.stringify(reminders),
            createdAt: new Date(),
            updated_at: new Date(),
          });
        }
      });
      return true;
    } catch (error) {
      logService.error('保存所有提醒失败', error);
      throw error;
    }
  }

  /**
   * 获取提醒
   * @param {string} id 提醒ID
   * @returns {Promise<Object|null>} 提醒对象
   */
  async getReminder(id) {
    try {
      await this.initialize();
      const reminders = await this.getAllReminders();
      return reminders.find(reminder => reminder.id === id) || null;
    } catch (error) {
      logService.error(`获取提醒失败: ${id}`, error);
      throw error;
    }
  }

  /**
   * 保存提醒
   * @param {Object} reminder 提醒对象
   * @returns {Promise<boolean>} 是否成功
   */
  async saveReminder(reminder) {
    try {
      await this.initialize();
      const reminders = await this.getAllReminders();
      const index = reminders.findIndex(r => r.id === reminder.id);

      if (index >= 0) {
        // 更新现有提醒
        reminders[index] = reminder;
      } else {
        // 添加新提醒
        reminders.push(reminder);
      }

      return await this.saveAllReminders(reminders);
    } catch (error) {
      logService.error(`保存提醒失败: ${reminder.id}`, error);
      throw error;
    }
  }

  /**
   * 删除提醒
   * @param {string} id 提醒ID
   * @returns {Promise<boolean>} 是否成功
   */
  async deleteReminder(id) {
    try {
      await this.initialize();
      const reminders = await this.getAllReminders();
      const filteredReminders = reminders.filter(reminder => reminder.id !== id);

      if (filteredReminders.length === reminders.length) {
        // 没有找到要删除的提醒
        return true;
      }

      return await this.saveAllReminders(filteredReminders);
    } catch (error) {
      logService.error(`删除提醒失败: ${id}`, error);
      throw error;
    }
  }

  /**
   * 获取离线操作
   * @returns {Promise<Array<Object>>} 离线操作数组
   */
  async getOfflineOperations() {
    try {
      await this.initialize();
      const realm = await realmService.getRealm();
      const item = realm.objects('StorageItem').filtered('key = "offline_operations"');
      const operations = item.length > 0 ? this.normalizeStoredValueForRead(item[0].value) : null;
      return Array.isArray(operations) ? operations : [];
    } catch (error) {
      logService.error('获取离线操作失败', error);
      throw error;
    }
  }

  /**
   * 添加离线操作
   * @param {string} operation 操作类型（create, update, delete）
   * @param {Object} data 操作数据
   * @returns {Promise<boolean>} 是否成功
   */
  async addOfflineOperation(operation, data) {
    try {
      await this.initialize();
      const realm = await realmService.getRealm();
      const operations = await this.getOfflineOperations();

      operations.push({
        operation,
        data,
        timestamp: new Date().toISOString(),
      });

      realm.write(() => {
        const existingItem = realm.objects('StorageItem').filtered('key = "offline_operations"');
        if (existingItem.length > 0) {
          existingItem[0].value = JSON.stringify(operations);
          existingItem[0].updated_at = new Date();
        } else {
          realm.create('StorageItem', {
            key: 'offline_operations',
            value: JSON.stringify(operations),
            createdAt: new Date(),
            updated_at: new Date(),
          });
        }
      });
      return true;
    } catch (error) {
      logService.error(`添加离线操作失败: ${operation}`, error);
      throw error;
    }
  }
}

// 创建单例实例
const reminderMongoDBService = new ReminderMongoDBService();

// 初始化
reminderMongoDBService.initialize().catch(error => {
  console.error('初始化提醒MongoDB服务失败', error);
  if (logService && typeof logService.error === 'function') {
    logService.error('初始化提醒MongoDB服务失败', error);
  }
});

// 确保导出正确
module.exports = reminderMongoDBService;
module.exports.default = reminderMongoDBService;
export default reminderMongoDBService;
