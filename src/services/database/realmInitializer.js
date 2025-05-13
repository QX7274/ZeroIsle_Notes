/**
 * Realm数据库初始化�? * 用于在应用启动时初始化Realm数据�? */

import { realmService } from './realmService';

import { realmModels } from '../../models';
import { networkService } from '../network/networkService';
import { configService } from '../app/configService';

class RealmInitializer {
  constructor() {
    this.initialized = false;
    this.initializationPromise = null;
  }

  /**
   * 初始化Realm数据�?   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) {
      return Promise.resolve();
    }

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = new Promise(async (resolve, reject) => {
      try {
        console.info('开始初始化Realm数据库');

        // 初始化Realm服务
        await realmService.initialize();

        // 注册所有模型
        this.registerModels();

        // 打开Realm数据库
        await realmService.openRealm();

        this.initialized = true;
        console.info('Realm数据库初始化成功');
        resolve();
      } catch (error) {
        console.error('Realm数据库初始化失败', error);
        reject(error);
      }
    });

    return this.initializationPromise;
  }

  /**
   * 注册所有模型
   * @private
   */
  registerModels() {
    // 注册所有模型
    for (const model of realmModels) {
      if (model && model.schema) {
        realmService.registerSchema(model.schema);
      }
    }

    console.info(`已注册${realmModels.length}个模型`);
  }

  /**
   * 检查网络连接
   * @returns {Promise<boolean>} 是否在线
   */
  async checkNetworkAndSync() {
    try {
      const isOnline = networkService.isOnline();

      if (isOnline) {
        console.info('网络在线，但不会连接MongoDB Atlas');
        // 这里可以添加与后端API的连接检查
      } else {
        console.info('网络离线，使用本地模式');
      }

      return isOnline;
    } catch (error) {
      console.error('检查网络连接失败', error);
      return false;
    }
  }

  /**
   * 关闭Realm数据库
   * @returns {Promise<void>}
   */
  async close() {
    try {
      realmService.closeRealm();
      this.initialized = false;
      console.info('Realm数据库已关闭');
    } catch (error) {
      console.error('关闭Realm数据库失败', error);
      throw error;
    }
  }
}

export const realmInitializer = new RealmInitializer();

