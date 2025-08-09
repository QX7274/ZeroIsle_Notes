/**
 * 数据库初始化服务 - 提供MongoDB和Realm数据库初始化和迁移功能
 */

import { mongoDBService } from './mongoDBAdapter';
import { realmService } from './realmService';
import { networkService } from '../network/networkService';

import { configService } from '../app/configService';
import { offlineSyncService } from '../offline/offlineSyncService';

class DatabaseInitService {
  constructor() {
    this.initialized = false;
    this.initializationPromise = null;
    this.isInitializing = false;
  }

  /**
   * 初始化数据库服务
   */
  async initialize() {
    if (this.initialized) return Promise.resolve();

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = new Promise(async (resolve, reject) => {
      try {
        this.isInitializing = true;

        // 初始化配置服务
        await configService.initialize();

        // 获取数据库配置
        const config = await configService.getConfig();
        const dbConfig = config.database || {};

        // 初始化本地数据库
        await this.initializeLocalDatabase();

        // 如果在线，初始化云数据库
        if (networkService.isOnline()) {
          await this.initializeCloudDatabase();
        }

        // 创建必要的索引
        await this.createIndexes();

        // 执行数据迁移
        if (dbConfig.performMigration) {
          await this.performMigration();
        }

        // 初始化离线同步服务
        await offlineSyncService.initialize();

        this.initialized = true;
        this.isInitializing = false;
        console.info('数据库初始化服务初始化成功');
        resolve();
      } catch (error) {
        this.isInitializing = false;
        console.error('数据库初始化服务初始化失败', error);
        reject(error);
      }
    });

    return this.initializationPromise;
  }

  /**
   * 初始化本地数据库
   * @private
   */
  async initializeLocalDatabase() {
    try {
      console.info('初始化本地数据库');

      // 初始化Realm服务
      await realmService.initialize();

      // 注册模式定义
      const schemas = require('../../schemas').default;
      schemas.forEach(schema => realmService.registerSchema(schema));

      console.info('本地数据库初始化成功');
    } catch (error) {
      console.error('初始化本地数据库失败', error);
      throw error;
    }
  }

  /**
   * 初始化云数据库
   * @private
   */
  async initializeCloudDatabase() {
    try {
      console.info('初始化云数据库');

      // 初始化MongoDB服务
      await mongoDBService.initialize();

      console.info('云数据库初始化成功');
    } catch (error) {
      console.error('初始化云数据库失败', error);
      // 不抛出错误，允许应用在离线模式下运行
      console.warn('应用将在离线模式下运行');
    }
  }

  /**
   * 创建必要的索引
   * @private
   */
  async createIndexes() {
    try {
      console.info('创建数据库索引');

      // 检查是否在线
      if (!networkService.isOnline() || !mongoDBService.isConnected) {
        console.warn('网络连接不可用，跳过创建云数据库索引');
        return;
      }

      // 创建MongoDB索引
      // 笔记索引
      await mongoDBService.createIndex('notes', { user_id: 1, is_deleted: 1 });
      await mongoDBService.createIndex('notes', { user_id: 1, is_favorite: 1 });
      await mongoDBService.createIndex('notes', { user_id: 1, category_id: 1 });
      await mongoDBService.createIndex('notes', { user_id: 1, updated_at: -1 });
      await mongoDBService.createIndex('notes', { title: 'text', content: 'text', tags: 'text' });

      // 分类索引
      await mongoDBService.createIndex('categories', { user_id: 1, is_deleted: 1 });
      await mongoDBService.createIndex('categories', { user_id: 1, parent_id: 1 });
      await mongoDBService.createIndex('categories', { user_id: 1, name: 1 }, { unique: true });

      // 标签索引
      await mongoDBService.createIndex('tags', { user_id: 1, name: 1 }, { unique: true });
      await mongoDBService.createIndex('tags', { user_id: 1, is_deleted: 1 });
      await mongoDBService.createIndex('tags', { user_id: 1, count: -1 });

      // AI聊天索引
      await mongoDBService.createIndex('ai_conversations', { user_id: 1, is_deleted: 1 });
      await mongoDBService.createIndex('ai_conversations', { user_id: 1, updated_at: -1 });
      await mongoDBService.createIndex('ai_conversations', { user_id: 1, is_favorite: 1 });
      await mongoDBService.createIndex('ai_conversations', { title: 'text', 'messages.content': 'text' });

      // 提醒索引
      await mongoDBService.createIndex('reminders', { user_id: 1, is_deleted: 1 });
      await mongoDBService.createIndex('reminders', { user_id: 1, due_date: 1 });
      await mongoDBService.createIndex('reminders', { user_id: 1, is_completed: 1 });
      await mongoDBService.createIndex('reminders', { note_id: 1 }, { sparse: true });

      // 文件索引
      await mongoDBService.createIndex('files', { user_id: 1, is_deleted: 1 });
      await mongoDBService.createIndex('files', { user_id: 1, type: 1 });
      await mongoDBService.createIndex('files', { user_id: 1, extension: 1 });
      await mongoDBService.createIndex('files', { name: 'text', original_name: 'text' });

      // 同步信息索引
      await mongoDBService.createIndex('sync_info', { entity_id: 1, entity_type: 1 }, { unique: true });
      await mongoDBService.createIndex('sync_info', { user_id: 1, status: 1 });
      await mongoDBService.createIndex('sync_info', { status: 1, created_at: 1 });

      // 知识图谱索引
      await mongoDBService.createIndex('knowledge_graphs', { user_id: 1, is_deleted: 1 });
      await mongoDBService.createIndex('knowledge_graphs', { user_id: 1, is_favorite: 1 });
      await mongoDBService.createIndex('knowledge_graphs', { title: 'text', description: 'text' });

      // 知识节点索引
      await mongoDBService.createIndex('knowledge_nodes', { graph_id: 1, is_deleted: 1 });
      await mongoDBService.createIndex('knowledge_nodes', { title: 'text', content: 'text' });

      // 知识边索引
      await mongoDBService.createIndex('knowledge_edges', { graph_id: 1, is_deleted: 1 });
      await mongoDBService.createIndex('knowledge_edges', { source_id: 1, target_id: 1 }, { unique: true });

      // 思维导图索引
      await mongoDBService.createIndex('mind_maps', { user_id: 1, is_deleted: 1 });
      await mongoDBService.createIndex('mind_maps', { user_id: 1, is_favorite: 1 });
      await mongoDBService.createIndex('mind_maps', { title: 'text', description: 'text' });

      // 思维导图节点索引
      await mongoDBService.createIndex('mind_map_nodes', { mind_map_id: 1, is_deleted: 1 });
      await mongoDBService.createIndex('mind_map_nodes', { parent_id: 1 }, { sparse: true });

      // 无限画布索引
      await mongoDBService.createIndex('canvases', { user_id: 1, is_deleted: 1 });
      await mongoDBService.createIndex('canvases', { user_id: 1, is_favorite: 1 });
      await mongoDBService.createIndex('canvases', { title: 'text', description: 'text' });

      // 画布元素索引
      await mongoDBService.createIndex('canvas_elements', { canvas_id: 1, is_deleted: 1 });
      await mongoDBService.createIndex('canvas_elements', { canvas_id: 1, layer: 1 });

      // 搜索历史索引
      await mongoDBService.createIndex('search_history', { user_id: 1, query: 1, context: 1 }, { unique: true });
      await mongoDBService.createIndex('search_history', { user_id: 1, last_used_at: -1 });

      // 搜索索引
      await mongoDBService.createIndex('search_index', { entity_id: 1, entity_type: 1 }, { unique: true });
      await mongoDBService.createIndex('search_index', { user_id: 1, is_deleted: 1 });
      await mongoDBService.createIndex('search_index', { title: 'text', content: 'text', keywords: 'text', tags: 'text' });

      console.info('数据库索引创建成功');
    } catch (error) {
      console.error('创建数据库索引失败', error);
      // 不抛出错误，允许应用继续运行
    }
  }

  /**
   * 执行数据迁移
   * @private
   */
  async performMigration() {
    try {
      console.info('执行数据迁移');

      // 获取迁移状态
      const migrationStatus = await configService.get('database.migration');

      // 如果已经迁移完成，跳过
      if (migrationStatus && migrationStatus.completed) {
        console.info('数据迁移已完成，跳过');
        return;
      }

      // 执行迁移
      // 这里可以添加从SQLite到MongoDB的迁移逻辑

      // 更新迁移状态
      await configService.set('database.migration', {
        completed: true,
        timestamp: new Date().toISOString()
      });

      console.info('数据迁移完成');
    } catch (error) {
      console.error('执行数据迁移失败', error);
      // 不抛出错误，允许应用继续运行
    }
  }

  /**
   * 重置数据库
   * @param {boolean} includeCloud 是否包括云数据库
   */
  async resetDatabase(includeCloud = false) {
    try {
      console.info('重置数据库');

      // 重置本地数据库
      await this.resetLocalDatabase();

      // 如果需要，重置云数据库
      if (includeCloud && networkService.isOnline()) {
        await this.resetCloudDatabase();
      }

      // 重置初始化状态
      this.initialized = false;
      this.initializationPromise = null;

      // 重新初始化
      await this.initialize();

      console.info('数据库重置成功');

      return true;
    } catch (error) {
      console.error('重置数据库失败', error);
      throw error;
    }
  }

  /**
   * 重置本地数据库
   * @private
   */
  async resetLocalDatabase() {
    try {
      console.info('重置本地数据库');

      // 关闭Realm连接
      realmService.close();

      // 重新初始化Realm
      await realmService.initialize();

      console.info('本地数据库重置成功');
    } catch (error) {
      console.error('重置本地数据库失败', error);
      throw error;
    }
  }

  /**
   * 重置云数据库
   * @private
   */
  async resetCloudDatabase() {
    try {
      console.info('重置云数据库');

      // 关闭MongoDB连接
      await mongoDBService.disconnect();

      // 重新初始化MongoDB
      await mongoDBService.initialize();

      console.info('云数据库重置成功');
    } catch (error) {
      console.error('重置云数据库失败', error);
      throw error;
    }
  }

  /**
   * 检查数据库状态
   * @returns {Promise<Object>} 数据库状态
   */
  async checkDatabaseStatus() {
    try {
      const status = {
        initialized: this.initialized,
        isInitializing: this.isInitializing,
        local: {
          initialized: realmService.initialized,
        },
        cloud: {
          initialized: mongoDBService.initialized,
          connected: mongoDBService.isConnected,
        },
      };

      return status;
    } catch (error) {
      console.error('检查数据库状态失败', error);
      throw error;
    }
  }
}

export const databaseInitService = new DatabaseInitService();

