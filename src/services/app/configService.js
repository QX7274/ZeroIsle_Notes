/**
 * 配置服务 - 提供应用配置管理
 */

import { realmStorageService } from '../storage/realmStorageService';
import { Platform } from 'react-native';

// 默认配置
const DEFAULT_CONFIG = {
  // API配置
  api: {
    baseUrl: 'http://localhost:8000/api/v1',
    timeout: 10000,
    retryCount: 3,
  },

  // MongoDB配置
  mongodb: {
    connectionString: 'mongodb+srv://qianxin7274:zxcvbnm@@081325@cluster0.lo5ybvq.mongodb.net/',
    dbName: 'ZeroIsle_Notes',
  },

  // Realm配置
  realm: {
    appId: 'zeroislenotes-app',
  },

  // AI服务配置
  ai: {
    apiEndpoint: 'https://api.openai.com/v1/chat/completions',
    apiKey: '',
    model: 'gpt-4',
    maxTokens: 2000,
    temperature: 0.7,
  },

  // 主题配置
  theme: {
    mode: 'auto', // 'light', 'dark', 'auto'
    primaryColor: '#2196F3',
  },

  // 存储配置
  storage: {
    maxCacheSize: 100 * 1024 * 1024, // 100MB
    autoBackup: true,
    backupInterval: 24 * 60 * 60 * 1000, // 24小时
  },

  // 同步配置
  sync: {
    autoSync: true,
    syncInterval: 30 * 60 * 1000, // 30分钟
    syncOnAppStart: true,
    syncOnAppBackground: true,
  },

  // 性能配置
  performance: {
    enableAnimations: true,
    enableParallaxEffects: true,
    lowPowerMode: false,
  },

  // 通知配置
  notifications: {
    enabled: true,
    reminderNotifications: true,
    syncNotifications: false,
    updateNotifications: true,
  },

  // 语言配置
  language: {
    current: 'zh-CN',
    fallback: 'en-US',
  },

  // 隐私配置
  privacy: {
    collectAnalytics: true,
    collectCrashReports: true,
    collectUsageData: true,
  },
};

class ConfigService {
  constructor() {
    this.config = { ...DEFAULT_CONFIG };
    this.isLoaded = false;
    this.loadPromise = null;
    this.initialized = false;
    this.initializationPromise = null;
  }

  /**
   * 初始化配置服务
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) return Promise.resolve();

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = new Promise(async (resolve, reject) => {
      try {
        // 加载配置
        await this.load();

        this.initialized = true;
        console.info('配置服务初始化成功');
        resolve();
      } catch (error) {
        console.error('配置服务初始化失败', error);
        reject(error);
      }
    });

    return this.initializationPromise;
  }

  /**
   * 加载配置
   * @returns {Promise<Object>} 配置对象
   */
  async load() {
    if (this.isLoaded) {
      return this.config;
    }

    if (this.loadPromise) {
      return this.loadPromise;
    }

    this.loadPromise = new Promise(async (resolve, reject) => {
      try {
        let storedConfig = null;

        // 尝试从存储服务加载配置
        try {
          if (realmStorageService && typeof realmStorageService.getItem === 'function') {
            // 检查realmStorageService是否已初始化
            if (!realmStorageService.initialized && typeof realmStorageService.initialize === 'function') {
              await realmStorageService.initialize();
            }

            storedConfig = await realmStorageService.getItem('app_config');
          }
        } catch (storageError) {
          console.warn('从存储服务加载配置失败，使用默认配置:', storageError);
        }

        if (storedConfig) {
          try {
            // 合并存储的配置和默认配置
            this.config = {
              ...DEFAULT_CONFIG,
              ...JSON.parse(storedConfig),
            };
          } catch (parseError) {
            console.warn('解析存储的配置失败，使用默认配置:', parseError);
            this.config = { ...DEFAULT_CONFIG };
          }
        }

        // 根据平台调整配置
        this.adjustConfigForPlatform();

        this.isLoaded = true;
        console.log('配置加载成功');
        resolve(this.config);
      } catch (error) {
        console.error('加载配置失败:', error);
        // 出错时使用默认配置
        this.config = { ...DEFAULT_CONFIG };
        this.adjustConfigForPlatform();
        this.isLoaded = true;
        resolve(this.config);
      }
    });

    return this.loadPromise;
  }

  /**
   * 根据平台调整配置
   * @private
   */
  adjustConfigForPlatform() {
    // iOS特定配置
    if (Platform.OS === 'ios') {
      // 调整iOS特定配置
      this.config.performance.enableParallaxEffects = false;
    }

    // Android特定配置
    if (Platform.OS === 'android') {
      // 调整Android特定配置
    }
  }

  /**
   * 获取配置
   * @returns {Promise<Object>} 配置对象
   */
  async getConfig() {
    return await this.load();
  }

  /**
   * 获取特定配置项
   * @param {string} key 配置键
   * @param {*} defaultValue 默认值
   * @returns {Promise<*>} 配置值
   */
  async get(key, defaultValue = null) {
    await this.load();

    const keys = key.split('.');
    let value = this.config;

    for (const k of keys) {
      if (value === undefined || value === null) {
        return defaultValue;
      }
      value = value[k];
    }

    return value !== undefined ? value : defaultValue;
  }

  /**
   * 设置配置项
   * @param {string} key 配置键
   * @param {*} value 配置值
   * @returns {Promise<void>}
   */
  async set(key, value) {
    await this.load();

    const keys = key.split('.');
    let current = this.config;

    // 遍历路径，直到倒数第二个键
    for (let i = 0; i < keys.length - 1; i++) {
      const k = keys[i];
      if (current[k] === undefined || current[k] === null) {
        current[k] = {};
      }
      current = current[k];
    }

    // 设置最后一个键的值
    const lastKey = keys[keys.length - 1];
    current[lastKey] = value;

    // 保存配置
    await this.save();
  }

  /**
   * 保存配置
   * @returns {Promise<void>}
   */
  async save() {
    try {
      // 检查realmStorageService是否可用
      if (realmStorageService && typeof realmStorageService.setItem === 'function') {
        // 检查realmStorageService是否已初始化
        if (!realmStorageService.initialized && typeof realmStorageService.initialize === 'function') {
          await realmStorageService.initialize();
        }

        await realmStorageService.setItem('app_config', JSON.stringify(this.config));
        console.log('配置保存成功');
      } else {
        console.warn('存储服务不可用，配置仅保存在内存中');
      }
    } catch (error) {
      console.error('保存配置失败:', error);
      // 不抛出错误，允许应用继续运行
      console.warn('配置仅保存在内存中');
    }
  }

  /**
   * 重置配置
   * @returns {Promise<void>}
   */
  async reset() {
    try {
      this.config = { ...DEFAULT_CONFIG };
      this.adjustConfigForPlatform();
      await this.save();
      console.log('配置重置成功');
    } catch (error) {
      console.error('重置配置失败:', error);
      // 不抛出错误，允许应用继续运行
      console.warn('配置仅在内存中重置');
    }
  }
}

// 创建单例实例
const configService = new ConfigService();

// 初始化
configService.initialize().catch(error => {
  console.error('初始化配置服务失败', error);
});

export { configService };
export default configService;
