/**
 * 离线同步服务 - 提供离线数据同步功能
 */

import { mongoDBService } from '../database/mongoDBAdapter';
import realmService from '../database/realmService';
import { networkService } from '../network/networkService';
import { configService } from '../app/configService';
// offlineStorageService 已删除，使用 realmService

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
    this.MAX_OFFLINE_RETRIES = 3;
    this.BASE_RETRY_DELAY_MS = 800;

    this.SYNC_STATUS = {
      PENDING: 'pending',
      SYNCING: 'syncing',
      SYNCED: 'synced',
      FAILED: 'failed',
    };
  }

  /**
   * 初始化离线同步服务
   */
  async initialize() {
    if (this.initialized) {return Promise.resolve();}

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
      throw error;
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
      throw error;
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
        throw new Error('Realm服务未初始化，无法加载同步队列');
      }

      try {
        // 获取Realm实例
        const realm = await realmService.getRealm();

        if (!realm) {
          console.warn('无法获取Realm实例，无法加载同步队列');
          throw new Error('无法获取Realm实例，无法加载同步队列');
        }

        // 查询待同步的项
        const pendingSyncItems = realm.objects('SyncInfo').filtered(`status = "${this.SYNC_STATUS.PENDING}"`).sorted('priority', true);

        if (pendingSyncItems && pendingSyncItems.length > 0) {
          // 转换为普通对象
          this.syncQueue = Array.from(pendingSyncItems).map(item => ({
            id: item._id,
            entity_id: item.entity_id,
            entity_type: item.entity_type,
            operation: item.operation,
            data: item.data ? JSON.parse(item.data) : {},
            priority: item.priority || 0,
            clientOpId: item.clientOpId || null,
            deviceId: item.deviceId || item.device_id || null,
          }));
        }
      } catch (realmError) {
        console.error('从Realm加载同步队列失败', realmError);
        throw realmError;
      }

      console.info(`同步队列加载完成，共${this.syncQueue.length}项`);
    } catch (error) {
      console.error('加载同步队列失败', error);
      this.syncQueue = [];
      throw error;
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
      const deviceId = (await configService.get('device.id')) || data?.deviceId || data?.device_id || 'unknown';
      const clientOpId = item?.clientOpId || data?.clientOpId || `sync_${realmService.createObjectId()}`;

      if (!entity_id || !entity_type || !operation) {
        throw new Error('缺少必要的同步信息');
      }

      if (!realmService || !realmService.initialized) {
        throw new Error('Realm服务未初始化，无法持久化同步队列');
      }

      const realm = await realmService.getRealm();
      if (!realm) {
        throw new Error('无法获取Realm实例，无法持久化同步队列');
      }

      let syncInfoId;
      realm.write(() => {
        const newSyncInfo = realm.create('SyncInfo', {
          _id: realmService.createObjectId(),
          entity_id,
          entity_type,
          user_id: data?.user_id || null,
          operation,
          data: JSON.stringify(data || {}),
          priority,
          status: this.SYNC_STATUS.PENDING,
          created_at: new Date(),
          updated_at: new Date(),
          device_id: deviceId,
          deviceId,
          clientOpId,
        });
        syncInfoId = newSyncInfo._id;
      });

      this.syncQueue.push({
        id: syncInfoId,
        entity_id,
        entity_type,
        operation,
        data,
        priority,
        clientOpId,
        deviceId,
      });

      this.syncQueue.sort((a, b) => b.priority - a.priority);

      if (networkService.isOnline() && !this.isSyncing) {
        this.syncWithServer();
      }

      return syncInfoId;
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
      throw new Error('同步已在进行中');
    }

    if (!networkService.isOnline()) {
      throw new Error('网络连接不可用');
    }

    try {
      this.isSyncing = true;

      // 1. 优先重放 OfflineQueue (来自各业务模块的离线操作)
      const offlineQueueResult = await this.processOfflineQueue();

      // 2. 处理 SyncInfo 队列 (旧有的同步审计/补齐)
      await mongoDBService.initialize();
      const queueCopy = [...this.syncQueue];
      const successItems = [];
      const failedItems = [];
      const skippedItems = [];

      for (const item of queueCopy) {
        try {
          if (this.syncInProgress[item.id]) {
            skippedItems.push(item.id);
            continue;
          }

          this.syncInProgress[item.id] = true;
          await this.processSyncItem(item);
          successItems.push(item);

          delete this.syncInProgress[item.id];
        } catch (error) {
          delete this.syncInProgress[item.id];
          console.error(`处理同步项失败: ${item.id}`, error);
          failedItems.push({ ...item, error: error.message });
          await this._markSyncInfoFailed(item.id, error.message);
        }
      }

      // 从队列中移除成功的项
      this.syncQueue = this.syncQueue.filter(item =>
        !successItems.some(successItem => successItem.id === item.id)
      );

      const hasSyncInfoFailures = failedItems.length > 0;
      const hasOfflineFailures = (offlineQueueResult?.failed || 0) > 0;
      const hasFailures = hasSyncInfoFailures || hasOfflineFailures;
      const hasSuccesses = successItems.length > 0 || (offlineQueueResult?.processed || 0) > 0;

      // 更新同步时间：有成功处理时才更新
      if (hasSuccesses) {
        await this.setLastSyncTime();
      }

      if (hasFailures) {
        throw new Error(
          `同步未完成：SyncInfo失败${failedItems.length}项，OfflineQueue失败${offlineQueueResult?.failed || 0}项`
        );
      }

      return {
        success: true,
        partialSuccess: false,
        successCount: successItems.length,
        failedCount: 0,
        skippedCount: skippedItems.length,
        remainingCount: this.syncQueue.length,
        offlineQueue: offlineQueueResult,
        failedItems: [],
      };
    } catch (error) {
      console.error('同步失败', error);
      throw error;
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * 处理 OfflineQueue 离线队列重放
   * @private
   */
  async processOfflineQueue() {
    try {
      const realm = await realmService.getRealm();
      const pendingItems = realm.objects('OfflineQueue')
        .filtered(
          `status == "${this.SYNC_STATUS.PENDING}" OR (status == "${this.SYNC_STATUS.FAILED}" AND retry_count < $0)`,
          this.MAX_OFFLINE_RETRIES
        )
        .sorted('created_at', false);

      if (pendingItems.length === 0) {
        return { success: true, processed: 0, failed: 0, skipped: 0, total: 0 };
      }

      console.info(`[OfflineSync] 开始处理 OfflineQueue, 共 ${pendingItems.length} 项`);

      let processed = 0;
      let failed = 0;
      let skipped = 0;

      for (const item of pendingItems) {
        const lockKey = this._buildOfflineDedupKey(item);

        try {
          // 幂等与锁检查
          if (this.syncInProgress[lockKey]) {
            skipped += 1;
            continue;
          }
          this.syncInProgress[lockKey] = true;

          // 标记同步中
          realm.write(() => {
            item.status = this.SYNC_STATUS.SYNCING;
            item.updated_at = new Date();
          });

          // 执行同步
          const data = JSON.parse(item.data || '{}');
          const entityType = String(item.entity_type || '').toLowerCase();
          const collection = this.getCollectionForType(entityType);

          if (item.operation === 'delete') {
            await this.syncDelete(collection, item.entity_id, entityType);
          } else {
            // update/create 统一走 upsert 逻辑
            await this.syncUpdate(collection, item.entity_id, data);
          }

          // 标记完成 + 去重收敛（同 clientOpId 或同实体同操作）
          realm.write(() => {
            item.status = this.SYNC_STATUS.SYNCED;
            item.synced_at = new Date();
            item.completed_at = new Date();
            item.updated_at = new Date();
            item.error = null;
          });
          const dedupedCount = this._markDuplicatesAsSynced(realm, item);
          if (dedupedCount > 0) {
            console.info(`[OfflineSync] 幂等去重完成: ${dedupedCount} 项`);
          }

          processed += 1;
          delete this.syncInProgress[lockKey];
        } catch (error) {
          delete this.syncInProgress[lockKey];
          console.error(`[OfflineSync] 处理离线队列项失败: ${item.clientOpId || item._id}`, error);

          const nextRetry = this._toPositiveInt(item.retry_count, 0) + 1;
          const nextStatus = nextRetry >= this.MAX_OFFLINE_RETRIES ? this.SYNC_STATUS.FAILED : this.SYNC_STATUS.PENDING;

          realm.write(() => {
            item.retry_count = nextRetry;
            item.error = error.message;
            item.status = nextStatus;
            item.updated_at = new Date();
          });

          failed += 1;
          if (nextStatus === this.SYNC_STATUS.PENDING) {
            await this._backoffByRetryCount(nextRetry);
          }
        }
      }

      return {
        success: failed === 0,
        partialSuccess: failed > 0 && processed > 0,
        processed,
        failed,
        skipped,
        total: pendingItems.length,
      };
    } catch (err) {
      console.error('[OfflineSync] processOfflineQueue 异常', err);
      throw err;
    }
  }

  _toPositiveInt(value, fallback = 0) {
    const parsed = Number(value);
    if (Number.isNaN(parsed) || parsed < 0) return fallback;
    return Math.floor(parsed);
  }

  async _backoffByRetryCount(retryCount) {
    const bounded = Math.min(this._toPositiveInt(retryCount, 0), 6);
    const delay = this.BASE_RETRY_DELAY_MS * Math.pow(2, bounded);
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  _buildOfflineDedupKey(item) {
    const opId = item?.clientOpId ? String(item.clientOpId) : '';
    const entityType = item?.entity_type ? String(item.entity_type) : '';
    const entityId = item?.entity_id ? String(item.entity_id) : '';
    const operation = item?.operation ? String(item.operation) : '';

    if (opId) return `op:${opId}`;
    return `fallback:${entityType}:${entityId}:${operation}`;
  }

  _getPendingDuplicateItems(realm, item) {
    const key = this._buildOfflineDedupKey(item);

    if (key.startsWith('op:')) {
      const opId = key.slice(3);
      return realm.objects('OfflineQueue').filtered(
        `clientOpId == $0 AND _id != $1 AND status != "${this.SYNC_STATUS.SYNCED}"`,
        opId,
        item._id
      );
    }

    const [_, entityType, entityId, operation] = key.split(':');
    return realm.objects('OfflineQueue').filtered(
      `entity_type == $0 AND entity_id == $1 AND operation == $2 AND _id != $3 AND status != "${this.SYNC_STATUS.SYNCED}"`,
      entityType,
      entityId,
      operation,
      item._id
    );
  }

  _markDuplicatesAsSynced(realm, item) {
    const duplicates = this._getPendingDuplicateItems(realm, item);
    if (!duplicates || duplicates.length === 0) return 0;

    const now = new Date();
    let count = 0;
    realm.write(() => {
      for (const dup of duplicates) {
        dup.status = this.SYNC_STATUS.SYNCED;
        dup.error = 'deduplicated';
        dup.completed_at = now;
        dup.updated_at = now;
        count += 1;
      }
    });

    return count;
  }

  /**
   * 更新SyncInfo失败状态
   * @private
   */
  async _markSyncInfoFailed(id, errorMessage) {
    try {
      if (!realmService || !realmService.initialized) {
        console.warn(`Realm未初始化，无法更新SyncInfo失败状态: ${id}`);
        throw new Error(`Realm未初始化，无法更新SyncInfo失败状态: ${id}`);
      }

      const realm = await realmService.getRealm();
      if (!realm) {
        console.warn(`无法获取Realm实例，无法更新SyncInfo失败状态: ${id}`);
        throw new Error(`无法获取Realm实例，无法更新SyncInfo失败状态: ${id}`);
      }

      const target = realm.objectForPrimaryKey('SyncInfo', id);
      if (!target) {
        throw new Error(`未找到SyncInfo记录，无法更新失败状态: ${id}`);
      }

      realm.write(() => {
        target.status = this.SYNC_STATUS.FAILED;
        target.error = errorMessage || '同步失败';
        target.updated_at = new Date();
      });
    } catch (err) {
      console.error(`更新同步信息失败状态异常: ${id}`, err);
      throw err;
    }
  }

  /**
   * 更新SyncInfo成功状态
   * @private
   */
  async _markSyncInfoSynced(id) {
    try {
      if (!realmService || !realmService.initialized) {
        console.warn(`Realm未初始化，无法更新SyncInfo成功状态: ${id}`);
        throw new Error(`Realm未初始化，无法更新SyncInfo成功状态: ${id}`);
      }

      const realm = await realmService.getRealm();
      if (!realm) {
        console.warn(`无法获取Realm实例，无法更新SyncInfo成功状态: ${id}`);
        throw new Error(`无法获取Realm实例，无法更新SyncInfo成功状态: ${id}`);
      }

      const target = realm.objectForPrimaryKey('SyncInfo', id);
      if (!target) {
        throw new Error(`未找到SyncInfo记录，无法更新成功状态: ${id}`);
      }

      realm.write(() => {
        target.status = this.SYNC_STATUS.SYNCED;
        target.error = null;
        target.synced_at = new Date();
        target.completed_at = new Date();
        target.updated_at = new Date();
      });
    } catch (err) {
      console.error(`更新同步信息成功状态异常: ${id}`, err);
      throw err;
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
    await this._markSyncInfoSynced(item.id);
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
        },
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
          },
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
            const oldSyncedItems = realm.objects('SyncInfo').filtered(`status = "${this.SYNC_STATUS.SYNCED}" AND created_at < $0`, sevenDaysAgo);

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
        throw realmError;
      }

      // 清理内存中的队列
      const initialLength = this.syncQueue.length;
      this.syncQueue = this.syncQueue.filter(item => item.status !== this.SYNC_STATUS.SYNCED);
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

const offlineSyncService = new OfflineSyncService();

module.exports = offlineSyncService;
module.exports.default = offlineSyncService;
module.exports.offlineSyncService = offlineSyncService;
module.exports.OfflineSyncService = OfflineSyncService;
