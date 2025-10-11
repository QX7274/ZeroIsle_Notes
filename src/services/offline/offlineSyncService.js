/**
 * 离线同步服务 - 提供离线数据同步功能
 */

import { mongoDBService } from '../database/mongoDBAdapter';
import realmService from '../database/realmService';
import { networkService } from '../network/networkService';
import { configService } from '../app/configService';
// offlineStorageService 已删除，使用 realmService
import { SyncInfo } from '../../models';

class OfflineSyncService {
  constructor() {
    this.initialized = false;
    this.initializationPromise = null;
    this.isSyncing = false;
    this.syncInterval = null;
    this.lastSyncTime = null;
    this.syncQueue = [];
    this.networkListener = null;
    this.syncInProgress = {};
  }

  /**
   * 初始化离线同步服务
   */
  async initialize() {
    if (this.initialized) return Promise.resolve();

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = new Promise(async (resolve, reject) => {
      try {
        // 初始化配置服务
        await configService.initialize();

        // 获取同步配置
        const config = await configService.getConfig();
        const syncConfig = config.sync || {};

        // 设置同步间隔
        this.syncIntervalTime = syncConfig.interval || 5 * 60 * 1000; // 默认5分钟

        // 加载上次同步时间
        this.lastSyncTime = await this.getLastSyncTime();

        // 加载同步队列
        await this.loadSyncQueue();

        // 添加网络状态监听
        this.setupNetworkListener();

        // 启动自动同步
        if (syncConfig.autoSync !== false) {
          this.startAutoSync();
        }

        this.initialized = true;
        console.info('离线同步服务初始化成功');
        resolve();
      } catch (error) {
        console.error('离线同步服务初始化失败', error);
        reject(error);
      }
    });

    return this.initializationPromise;
  }

  /**
   * 设置网络状态监听
   * @private
   */
  setupNetworkListener() {
    // 移除旧的监听器
    if (this.networkListener) {
      networkService.removeListener('network:change', this.networkListener);
    }

    // 添加新的监听器
    this.networkListener = networkService.addListener('network:change', async (state) => {
      // 当网络恢复在线时，尝试同步
      if (state.isOnline && !this.isSyncing && this.syncQueue.length > 0) {
        await this.syncWithServer();
      }
    });
  }

  /**
   * 启动自动同步
   */
  startAutoSync() {
    // 清除旧的定时器
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
    }

    // 设置新的定时器
    this.syncInterval = setInterval(async () => {
      if (networkService.isOnline() && !this.isSyncing && this.syncQueue.length > 0) {
        await this.syncWithServer();
      }
    }, this.syncIntervalTime);

    console.info(`自动同步已启动，间隔: ${this.syncIntervalTime / 1000}秒`);
  }

  /**
   * 停止自动同步
   */
  stopAutoSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;

      console.info('自动同步已停止');
    }
  }

  /**
   * 获取上次同步时间
   * @returns {Promise<Date|null>} 上次同步时间
   * @private
   */
  async getLastSyncTime() {
    try {
      const timeString = await configService.get('sync.lastSyncTime');
      return timeString ? new Date(timeString) : null;
    } catch (error) {
      console.error('获取上次同步时间失败', error);
      return null;
    }
  }

  /**
   * 设置上次同步时间
   * @param {Date} time 同步时间
   * @private
   */
  async setLastSyncTime(time = new Date()) {
    try {
      this.lastSyncTime = time;
      await configService.set('sync.lastSyncTime', time.toISOString());
    } catch (error) {
      console.error('设置上次同步时间失败', error);
    }
  }

  /**
   * 加载同步队列
   * @private
   */
  async loadSyncQueue() {
    try {
      // 初始化空队列
      this.syncQueue = [];

      // 确保Realm服务已初始化
      if (!realmService || !realmService.initialized) {
        console.warn('Realm服务未初始化，无法加载同步队列');
        return;
      }

      try {
        // 获取Realm实例
        const realm = await realmService.getRealm();

        if (!realm) {
          console.warn('无法获取Realm实例，无法加载同步队列');
          return;
        }

        // 查询待同步的项
        const pendingSyncItems = realm.objects('SyncInfo').filtered('status = "pending"').sorted('priority', true);

        if (pendingSyncItems && pendingSyncItems.length > 0) {
          // 转换为普通对象
          this.syncQueue = Array.from(pendingSyncItems).map(item => ({
            id: item._id,
            entity_id: item.entity_id,
            entity_type: item.entity_type,
            operation: item.operation,
            data: item.data ? JSON.parse(item.data) : {},
            priority: item.priority || 0,
          }));
        }
      } catch (realmError) {
        console.error('从Realm加载同步队列失败', realmError);

        // 尝试从离线存储加载
        try {
          const realm = await realmService.getRealm();
          const item = realm.objects('StorageItem').filtered('key = "sync_queue"');
          const queueData = item.length > 0 ? item[0].value : null;
          if (queueData) {
            this.syncQueue = JSON.parse(queueData);
          }
        } catch (storageError) {
          console.error('从离线存储加载同步队列失败', storageError);
        }
      }

      console.info(`同步队列加载完成，共${this.syncQueue.length}项`);
    } catch (error) {
      console.error('加载同步队列失败', error);
      this.syncQueue = [];
    }
  }

  /**
   * 添加到同步队列
   * @param {Object} item 同步项
   * @returns {Promise<string>} 同步项ID
   */
  async addToSyncQueue(item) {
    try {
      await this.initialize();

      const { entity_id, entity_type, operation, data, priority = 0 } = item;

      if (!entity_id || !entity_type || !operation) {
        throw new Error('缺少必要的同步信息');
      }

      // 创建或更新同步信息
      let syncInfo;
      try {
        // 尝试使用Realm直接创建
        if (realmService && realmService.initialized) {
          const realm = await realmService.getRealm();

          if (realm) {
            let syncInfoId;
            realm.write(() => {
              const newSyncInfo = realm.create('SyncInfo', {
                _id: new Date().getTime().toString(),
                entity_id,
                entity_type,
                user_id: data?.user_id || null,
                operation,
                data: JSON.stringify(data || {}),
                priority,
                status: 'pending',
                created_at: new Date(),
                updated_at: new Date(),
                device_id: configService.get('device.id') || 'unknown',
              });
              syncInfoId = newSyncInfo._id;
            });

            syncInfo = { _id: syncInfoId, entity_id, entity_type, operation, data, priority };
            console.log(`同步信息已保存到Realm: ${entity_type} ${entity_id}`);
          }
        } else {
          // 如果Realm不可用，创建内存中的对象
          syncInfo = {
            _id: new Date().getTime().toString(),
            entity_id,
            entity_type,
            operation,
            data,
            priority
          };
        }
      } catch (error) {
        console.warn('创建同步信息失败，使用内存对象', error);
        // 创建内存中的对象
        syncInfo = {
          _id: new Date().getTime().toString(),
          entity_id,
          entity_type,
          operation,
          data,
          priority
        };
      }

      // 添加到内存中的同步队列
      this.syncQueue.push({
        id: syncInfo._id,
        entity_id,
        entity_type,
        operation,
        data,
        priority,
      });

      // 按优先级排序
      this.syncQueue.sort((a, b) => b.priority - a.priority);

      // 如果在线且未在同步中，尝试同步
      if (networkService.isOnline() && !this.isSyncing) {
        this.syncWithServer();
      }

      return syncInfo._id;
    } catch (error) {
      console.error('添加到同步队列失败', error);
      throw error;
    }
  }

  /**
   * 与服务器同步
   * @returns {Promise<Object>} 同步结果
   */
  async syncWithServer() {
    if (this.isSyncing) {
      return { success: false, message: '同步已在进行中' };
    }

    if (!networkService.isOnline()) {
      return { success: false, message: '网络连接不可用' };
    }

    try {
      this.isSyncing = true;

      // 确保MongoDB服务已初始化
      await mongoDBService.initialize();

      // 处理同步队列
      const queueCopy = [...this.syncQueue];
      const successItems = [];
      const failedItems = [];

      for (const item of queueCopy) {
        try {
          // 检查是否已经在处理此项
          if (this.syncInProgress[item.id]) {
            continue;
          }

          this.syncInProgress[item.id] = true;

          await this.processSyncItem(item);
          successItems.push(item);

          delete this.syncInProgress[item.id];
        } catch (error) {
          delete this.syncInProgress[item.id];

          console.error(`处理同步项失败: ${JSON.stringify(item)}`, error);
          failedItems.push({
            ...item,
            error: error.message,
          });

          // 更新同步信息状态
          await SyncInfo.findById(item.id).then(syncInfo => {
            if (syncInfo) {
              return syncInfo.markAsFailed(error.message);
            }
          }).catch(err => {
            console.error(`更新同步信息状态失败: ${item.id}`, err);
          });
        }
      }

      // 从队列中移除成功的项
      this.syncQueue = this.syncQueue.filter(item =>
        !successItems.some(successItem => successItem.id === item.id)
      );

      // 更新同步时间
      await this.setLastSyncTime();

      console.info(`同步完成，成功: ${successItems.length}，失败: ${failedItems.length}，剩余: ${this.syncQueue.length}`);

      return {
        success: true,
        successCount: successItems.length,
        failedCount: failedItems.length,
        remainingCount: this.syncQueue.length,
      };
    } catch (error) {
      console.error('同步失败', error);

      return {
        success: false,
        message: error.message,
      };
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * 处理同步项
   * @param {Object} item 同步项
   * @private
   */
  async processSyncItem(item) {
    const { entity_type, operation, entity_id, data } = item;

    // 获取集合名称
    const collection = this.getCollectionForType(entity_type);

    switch (operation) {
      case 'create':
        await this.syncCreate(collection, data);
        break;
      case 'update':
        await this.syncUpdate(collection, entity_id, data);
        break;
      case 'delete':
        await this.syncDelete(collection, entity_id, entity_type);
        break;
      default:
        throw new Error(`未知的同步操作: ${operation}`);
    }

    // 更新同步信息状态
    await SyncInfo.findById(item.id).then(syncInfo => {
      if (syncInfo) {
        return syncInfo.markAsSynced();
      }
    }).catch(err => {
      console.error(`更新同步信息状态失败: ${item.id}`, err);
    });
  }

  /**
   * 同步创建操作
   * @param {string} collection 集合名称
   * @param {Object} data 数据
   * @private
   */
  async syncCreate(collection, data) {
    // 确保数据有_id字段
    if (!data._id) {
      throw new Error('数据缺少_id字段');
    }

    // 检查是否已存在
    const existing = await mongoDBService.findOne(collection, { _id: data._id });

    if (existing) {
      // 如果已存在，执行更新
      return this.syncUpdate(collection, data._id, data);
    }

    // 创建新文档
    await mongoDBService.insertOne(collection, {
      ...data,
      is_synced: true,
    });
  }

  /**
   * 同步更新操作
   * @param {string} collection 集合名称
   * @param {string} id ID
   * @param {Object} data 数据
   * @private
   */
  async syncUpdate(collection, id, data) {
    // 移除_id字段，避免更新主键
    const updateData = { ...data };
    delete updateData._id;

    // 更新文档
    await mongoDBService.updateOne(
      collection,
      { _id: id },
      {
        $set: {
          ...updateData,
          is_synced: true,
          updated_at: new Date(),
        }
      }
    );
  }

  /**
   * 同步删除操作
   * @param {string} collection 集合名称
   * @param {string} id ID
   * @param {string} entityType 实体类型
   * @private
   */
  async syncDelete(collection, id, entityType) {
    // 对某些类型使用软删除
    if (['note', 'category', 'tag', 'knowledge_graph', 'mind_map', 'canvas'].includes(entityType)) {
      await mongoDBService.updateOne(
        collection,
        { _id: id },
        {
          $set: {
            is_deleted: true,
            is_synced: true,
            deleted_at: new Date(),
            updated_at: new Date(),
          }
        }
      );
    } else {
      // 硬删除
      await mongoDBService.deleteOne(collection, { _id: id });
    }
  }

  /**
   * 获取类型对应的集合名称
   * @param {string} type 数据类型
   * @returns {string} 集合名称
   * @private
   */
  getCollectionForType(type) {
    switch (type) {
      case 'note':
        return 'notes';
      case 'category':
        return 'categories';
      case 'tag':
        return 'tags';
      case 'reminder':
        return 'reminders';
      case 'ai_chat':
        return 'ai_chats';
      case 'file':
        return 'files';
      case 'knowledge_graph':
        return 'knowledge_graphs';
      case 'knowledge_node':
        return 'knowledge_nodes';
      case 'knowledge_edge':
        return 'knowledge_edges';
      case 'mind_map':
        return 'mind_maps';
      case 'mind_map_node':
        return 'mind_map_nodes';
      case 'canvas':
        return 'canvases';
      case 'canvas_element':
        return 'canvas_elements';
      default:
        return type;
    }
  }

  /**
   * 获取同步状态
   * @returns {Object} 同步状态
   */
  getSyncStatus() {
    return {
      initialized: this.initialized,
      isSyncing: this.isSyncing,
      lastSyncTime: this.lastSyncTime,
      queueLength: this.syncQueue.length,
      isOnline: networkService.isOnline(),
      autoSyncEnabled: !!this.syncInterval,
    };
  }

  /**
   * 清理同步队列
   * @returns {Promise<number>} 清理的项数量
   */
  async cleanSyncQueue() {
    try {
      let cleanedCount = 0;

      // 尝试使用Realm清理
      try {
        if (realmService && realmService.initialized) {
          const realm = await realmService.getRealm();

          if (realm) {
            // 获取7天前的日期
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

            // 查找已同步且创建时间在7天前的项
            const oldSyncedItems = realm.objects('SyncInfo').filtered('status = "synced" AND created_at < $0', sevenDaysAgo);

            if (oldSyncedItems && oldSyncedItems.length > 0) {
              cleanedCount = oldSyncedItems.length;

              realm.write(() => {
                realm.delete(oldSyncedItems);
              });

              console.log(`已从Realm清理${cleanedCount}个已同步项`);
            }
          }
        }
      } catch (realmError) {
        console.warn('使用Realm清理同步队列失败', realmError);
      }

      // 清理内存中的队列
      const initialLength = this.syncQueue.length;
      this.syncQueue = this.syncQueue.filter(item => item.status !== 'synced');
      const memoryCleanedCount = initialLength - this.syncQueue.length;

      if (memoryCleanedCount > 0) {
        console.log(`已从内存清理${memoryCleanedCount}个已同步项`);
        cleanedCount += memoryCleanedCount;
      }

      // 重新加载同步队列
      await this.loadSyncQueue();

      return cleanedCount;
    } catch (error) {
      console.error('清理同步队列失败', error);
      throw error;
    }
  }
}

export const offlineSyncService = new OfflineSyncService();