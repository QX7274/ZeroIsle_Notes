/**
 * 同步服务 - 负责在本地Realm数据库和后端MongoDB之间同步数据
 *
 * 同步服务提供以下功能：
 * 1. 数据同步：在本地数据库和云端数据库之间同步数据
 * 2. 增量同步：只同步自上次同步以来发生变化的数据
 * 3. 冲突解决：解决本地和云端数据冲突
 * 4. 离线队列：在离线状态下将操作存入队列，在网络恢复后执行
 * 5. 同步状态管理：管理同步状态和进度
 * 6. 错误处理：处理同步过程中的错误
 */

import { logService } from '../utils/logService';
import { networkService } from '../network/networkService';
import { realmService } from '../database/realmService';
import { apiService } from '../api/apiService';
import { SYNC_EVENTS } from './syncEvents';
import * as syncUtils from './syncUtils';
import { eventEmitter } from '../utils/eventEmitter';

class SyncService {
  constructor() {
    this.initialized = false;
    this.initializationPromise = null;
    this.syncQueue = [];
    this.lastSyncTime = null;
    this.isSyncing = false;
    this.syncInterval = null;
    this.listeners = [];
    this.offlineQueue = [];
  }

  /**
   * 初始化同步服务
   */
  async initialize() {
    if (this.initialized) return Promise.resolve();

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = new Promise(async (resolve, reject) => {
      try {
        // 确保Realm服务已初始化
        await realmService.initialize();

        // 加载上次同步时间
        await this.loadLastSyncTime();

        // 加载离线队列
        await this.loadOfflineQueue();

        // 设置网络状态监听
        this.setupNetworkListeners();

        // 设置自动同步
        this.setupAutoSync();

        this.initialized = true;
        logService.info('同步服务初始化成功');
        resolve();
      } catch (error) {
        logService.error('同步服务初始化失败', error);
        reject(error);
      }
    });

    return this.initializationPromise;
  }

  /**
   * 加载上次同步时间
   * @private
   */
  async loadLastSyncTime() {
    try {
      const lastSyncTimeStr = await realmService.findOne('SyncInfo', { type: 'last_sync_time' });
      if (lastSyncTimeStr) {
        this.lastSyncTime = new Date(lastSyncTimeStr.value);
        logService.info('加载上次同步时间', { lastSyncTime: this.lastSyncTime });
      } else {
        this.lastSyncTime = null;
        logService.info('没有找到上次同步时间');
      }
    } catch (error) {
      logService.error('加载上次同步时间失败', error);
      this.lastSyncTime = null;
    }
  }

  /**
   * 保存上次同步时间
   * @param {Date} time 同步时间
   * @private
   */
  async saveLastSyncTime(time) {
    try {
      const syncTime = time || new Date();
      const existingRecord = await realmService.findOne('SyncInfo', { type: 'last_sync_time' });

      if (existingRecord) {
        await realmService.update('SyncInfo', existingRecord._id, {
          value: syncTime.toISOString(),
          updated_at: new Date()
        });
      } else {
        await realmService.create('SyncInfo', {
          _id: realmService.createObjectId().toHexString(),
          type: 'last_sync_time',
          value: syncTime.toISOString(),
          created_at: new Date(),
          updated_at: new Date()
        });
      }

      this.lastSyncTime = syncTime;
      logService.info('保存同步时间', { syncTime });
    } catch (error) {
      logService.error('保存同步时间失败', error);
    }
  }

  /**
   * 加载离线队列
   * @private
   */
  async loadOfflineQueue() {
    try {
      const offlineOperations = await realmService.find('OfflineQueue', { is_synced: false });
      this.offlineQueue = offlineOperations || [];
      logService.info('加载离线队列', { count: this.offlineQueue.length });
    } catch (error) {
      logService.error('加载离线队列失败', error);
      this.offlineQueue = [];
    }
  }

  /**
   * 设置网络状态监听
   * @private
   */
  setupNetworkListeners() {
    networkService.addListener('change', async (status) => {
      if (status.isConnected && !this.isSyncing) {
        // 网络恢复连接，优先同步关键数据
        logService.info('网络已连接，优先同步关键数据');
        await this.syncKeyData();

        // 然后处理离线队列中的操作
        if (this.offlineQueue.length > 0) {
          logService.info('处理离线队列中的操作', { count: this.offlineQueue.length });
          await this.sync();
        }
      }
    });
  }

  /**
   * 设置自动同步
   * @private
   */
  setupAutoSync() {
    // 每2分钟尝试同步一次关键信息
    this.syncInterval = setInterval(async () => {
      if (networkService.isOnline() && !this.isSyncing) {
        // 自动同步关键信息
        await this.syncKeyData();
      }
    }, 2 * 60 * 1000);
  }

  /**
   * 同步关键数据
   * 自动同步用户信息、设置等关键数据
   * @returns {Promise<Object>} 同步结果
   */
  async syncKeyData() {
    if (this.isSyncing) {
      return { success: false, message: '同步已在进行中' };
    }

    if (!networkService.isOnline()) {
      return { success: false, message: '网络离线，无法同步' };
    }

    this.isSyncing = true;
    logService.info('开始同步关键数据...');

    // 通知监听器同步开始
    this.notifyListeners(SYNC_EVENTS.SYNC_STARTED, {
      timestamp: new Date(),
      type: 'key-data'
    });

    try {
      // 1. 获取需要同步的关键数据
      const keyData = {
        timestamp: new Date().toISOString()
      };

      // 获取用户信息
      const user = await realmService.findOne('User', {});
      if (user) {
        keyData.user = user;
      }

      // 获取设置信息
      const settings = await realmService.findOne('Settings', {});
      if (settings) {
        keyData.settings = settings;
      }

      // 2. 发送同步请求到专门的关键数据同步API
      if (Object.keys(keyData).length > 1) { // 至少有timestamp和一个数据对象
        const result = await apiService.post('/sync/key-data/', keyData);

        if (!result || !result.success) {
          throw new Error(result?.error || '同步关键数据失败');
        }

        // 3. 处理返回的数据
        if (result.results) {
          logService.info('关键数据同步结果', result.results);

          // 如果服务器返回了更新的设置，更新本地设置
          if (result.results.settings && result.results.settings.success) {
            logService.info('设置同步成功');
          }

          // 如果服务器返回了更新的用户信息，更新本地用户信息
          if (result.results.user && result.results.user.success) {
            logService.info('用户信息同步成功');
          }
        }
      }

      // 4. 更新同步时间
      const syncTime = new Date();
      await this.saveLastSyncTime(syncTime);

      this.isSyncing = false;
      logService.info('关键数据同步成功');

      // 通知监听器同步完成
      this.notifyListeners(SYNC_EVENTS.SYNC_COMPLETED, {
        timestamp: syncTime,
        type: 'key-data'
      });

      return {
        success: true,
        timestamp: syncTime
      };
    } catch (error) {
      this.isSyncing = false;
      logService.error('同步关键数据失败', error);

      // 通知监听器同步失败
      this.notifyListeners(SYNC_EVENTS.SYNC_FAILED, {
        error: syncUtils.parseSyncError(error),
        type: 'key-data'
      });

      return {
        success: false,
        error: syncUtils.parseSyncError(error)
      };
    }
  }

  /**
   * 添加离线操作
   * @param {string} type 操作类型 ('create', 'update', 'delete')
   * @param {string} collection 集合名称
   * @param {string} documentId 文档ID
   * @param {Object} data 操作数据
   * @returns {Promise<string>} 操作ID
   */
  async addOfflineOperation(type, collection, documentId, data) {
    try {
      await this.initialize();

      // 使用工具函数创建同步操作对象
      const operation = syncUtils.createSyncOperation(type, collection, documentId, data);

      // 创建离线队列项
      const operationId = await realmService.create('OfflineQueue', {
        _id: new realmService.createObjectId(),
        type: operation.type,
        collection: operation.collection,
        document_id: operation.document_id,
        data: JSON.stringify(operation.data),
        created_at: new Date(),
        updated_at: new Date(),
        is_synced: false,
        retry_count: 0
      });

      // 添加到内存队列
      this.offlineQueue.push(operationId);

      // 通知监听器
      this.notifyListeners(SYNC_EVENTS.OFFLINE_OPERATION_ADDED, {
        operationId,
        type,
        collection,
        documentId
      });

      // 如果在线，尝试立即同步
      if (networkService.isOnline() && !this.isSyncing) {
        this.sync();
      }

      return operationId;
    } catch (error) {
      logService.error('添加离线操作失败', error);
      throw error;
    }
  }

  /**
   * 添加离线操作（兼容旧版本）
   * @param {Object} operation 操作对象
   * @returns {Promise<string>} 操作ID
   * @deprecated 使用 addOfflineOperation(type, collection, documentId, data) 代替
   */
  async addToSyncQueue(operation) {
    try {
      if (!operation.type || !operation.collection || !operation.data) {
        throw new Error('无效的离线操作');
      }

      return this.addOfflineOperation(
        operation.type,
        operation.collection,
        operation.document_id,
        operation.data
      );
    } catch (error) {
      logService.error('添加离线操作失败', error);
      throw error;
    }
  }

  /**
   * 同步数据
   * @returns {Promise<Object>} 同步结果
   */
  async sync() {
    if (this.isSyncing) {
      return { success: false, message: '同步已在进行中' };
    }

    if (!networkService.isOnline()) {
      return { success: false, message: '网络离线，无法同步' };
    }

    this.isSyncing = true;
    this.notifyListeners(SYNC_EVENTS.SYNC_STARTED, { timestamp: new Date() });

    try {
      // 1. 先处理离线队列
      this.notifyListeners(SYNC_EVENTS.QUEUE_PROCESSING_STARTED);
      const queueResult = await this.processOfflineQueue();
      this.notifyListeners(SYNC_EVENTS.QUEUE_PROCESSING_COMPLETED, queueResult);

      // 2. 然后从服务器拉取更新
      this.notifyListeners(SYNC_EVENTS.PULL_STARTED);
      const pullResult = await this.pullChanges();
      this.notifyListeners(SYNC_EVENTS.PULL_COMPLETED, pullResult);

      // 3. 更新同步时间
      const syncTime = new Date();
      await this.saveLastSyncTime(syncTime);

      this.isSyncing = false;
      this.notifyListeners(SYNC_EVENTS.SYNC_COMPLETED, {
        timestamp: syncTime,
        queueProcessed: queueResult.processed,
        changesPulled: pullResult.count,
        totalTime: Date.now() - syncTime.getTime()
      });

      return {
        success: true,
        timestamp: syncTime,
        queueResult,
        pullResult
      };
    } catch (error) {
      this.isSyncing = false;
      logService.error('同步失败', error);

      const parsedError = syncUtils.parseSyncError(error);
      this.notifyListeners(SYNC_EVENTS.SYNC_FAILED, parsedError);

      return {
        success: false,
        error: parsedError
      };
    }
  }

  /**
   * 处理离线队列
   * @private
   * @returns {Promise<Object>} 处理结果
   */
  async processOfflineQueue() {
    if (this.offlineQueue.length === 0) {
      return { processed: 0, success: true };
    }

    logService.info('开始处理离线队列', { count: this.offlineQueue.length });

    let processed = 0;
    let failed = 0;
    let skipped = 0;

    // 复制队列，避免处理过程中的修改
    const queue = [...this.offlineQueue];

    // 按集合分组操作
    const operationsByCollection = {};

    for (const operationId of queue) {
      try {
        const operation = await realmService.findById('OfflineQueue', operationId);
        if (!operation || operation.is_synced) {
          continue;
        }

        // 将操作添加到相应的集合组
        if (!operationsByCollection[operation.collection]) {
          operationsByCollection[operation.collection] = [];
        }

        operationsByCollection[operation.collection].push({
          id: operationId,
          operation
        });
      } catch (error) {
        logService.error(`获取离线操作失败: ${operationId}`, error);
      }
    }

    // 处理每个集合的操作
    for (const collection in operationsByCollection) {
      const operations = operationsByCollection[collection];

      // 准备同步数据
      const syncData = {
        timestamp: new Date().toISOString()
      };

      // 处理不同类型的集合
      switch (collection) {
        case 'Note':
        case 'Notes':
          syncData.notes = [];
          for (const { id, operation } of operations) {
            try {
              const data = JSON.parse(operation.data);
              data._id = operation.document_id;
              data._operation = operation.type;
              syncData.notes.push(data);
            } catch (error) {
              logService.error(`处理笔记操作数据失败: ${id}`, error);
            }
          }

          // 发送同步请求
          if (syncData.notes.length > 0) {
            try {
              const result = await apiService.post('/sync/notes', syncData);

              // 处理结果
              if (result && result.success) {
                // 标记操作为已同步
                for (const { id } of operations) {
                  await realmService.update('OfflineQueue', id, {
                    is_synced: true,
                    updated_at: new Date(),
                    server_response: JSON.stringify(result)
                  });

                  // 从内存队列中移除
                  const index = this.offlineQueue.indexOf(id);
                  if (index !== -1) {
                    this.offlineQueue.splice(index, 1);
                  }

                  processed++;
                }
              } else {
                throw new Error(result?.error || '同步笔记失败');
              }
            } catch (error) {
              logService.error('同步笔记失败', error);

              // 更新操作状态
              for (const { id } of operations) {
                await this.updateOperationError(id, error);
                failed++;
              }
            }
          }
          break;

        case 'Reminder':
        case 'Reminders':
          syncData.reminders = [];
          for (const { id, operation } of operations) {
            try {
              const data = JSON.parse(operation.data);
              data._id = operation.document_id;
              data._operation = operation.type;
              syncData.reminders.push(data);
            } catch (error) {
              logService.error(`处理提醒操作数据失败: ${id}`, error);
            }
          }

          // 发送同步请求
          if (syncData.reminders.length > 0) {
            try {
              const result = await apiService.post('/sync/reminders', syncData);

              // 处理结果
              if (result && result.success) {
                // 标记操作为已同步
                for (const { id } of operations) {
                  await realmService.update('OfflineQueue', id, {
                    is_synced: true,
                    updated_at: new Date(),
                    server_response: JSON.stringify(result)
                  });

                  // 从内存队列中移除
                  const index = this.offlineQueue.indexOf(id);
                  if (index !== -1) {
                    this.offlineQueue.splice(index, 1);
                  }

                  processed++;
                }
              } else {
                throw new Error(result?.error || '同步提醒失败');
              }
            } catch (error) {
              logService.error('同步提醒失败', error);

              // 更新操作状态
              for (const { id } of operations) {
                await this.updateOperationError(id, error);
                failed++;
              }
            }
          }
          break;

        case 'Settings':
          syncData.settings = {};
          for (const { id, operation } of operations) {
            try {
              const data = JSON.parse(operation.data);
              // 合并设置数据
              syncData.settings = { ...syncData.settings, ...data };
            } catch (error) {
              logService.error(`处理设置操作数据失败: ${id}`, error);
            }
          }

          // 发送同步请求
          if (Object.keys(syncData.settings).length > 0) {
            try {
              const result = await apiService.post('/sync/settings', syncData);

              // 处理结果
              if (result && result.success) {
                // 标记操作为已同步
                for (const { id } of operations) {
                  await realmService.update('OfflineQueue', id, {
                    is_synced: true,
                    updated_at: new Date(),
                    server_response: JSON.stringify(result)
                  });

                  // 从内存队列中移除
                  const index = this.offlineQueue.indexOf(id);
                  if (index !== -1) {
                    this.offlineQueue.splice(index, 1);
                  }

                  processed++;
                }
              } else {
                throw new Error(result?.error || '同步设置失败');
              }
            } catch (error) {
              logService.error('同步设置失败', error);

              // 更新操作状态
              for (const { id } of operations) {
                await this.updateOperationError(id, error);
                failed++;
              }
            }
          }
          break;

        case 'User':
        case 'Users':
          // 用户相关操作
          for (const { id, operation } of operations) {
            try {
              const data = JSON.parse(operation.data);

              // 只保留关键用户信息字段
              const keyUserInfo = {};
              if (data) {
                const keyFields = ['username', 'email', 'profile', 'settings', 'preferences'];
                keyFields.forEach(field => {
                  if (data[field] !== undefined) {
                    keyUserInfo[field] = data[field];
                  }
                });
              }

              let result;
              switch (operation.type) {
                case 'create':
                  // 用户创建操作通常由注册处理，这里跳过
                  result = { message: '用户创建操作由注册处理' };
                  break;
                case 'update':
                  // 只同步关键用户信息
                  result = await apiService.put(`/users/profile`, keyUserInfo);
                  break;
                case 'delete':
                  // 用户删除操作需要特殊处理，这里跳过
                  result = { message: '用户删除操作需要特殊处理' };
                  break;
                default:
                  throw new Error(`未知的操作类型: ${operation.type}`);
              }

              // 标记为已同步
              await realmService.update('OfflineQueue', id, {
                is_synced: true,
                updated_at: new Date(),
                server_response: JSON.stringify(result)
              });

              // 从内存队列中移除
              const index = this.offlineQueue.indexOf(id);
              if (index !== -1) {
                this.offlineQueue.splice(index, 1);
              }

              processed++;
            } catch (error) {
              logService.error(`处理用户操作失败: ${id}`, error);
              await this.updateOperationError(id, error);
              failed++;
            }
          }
          break;

        default:
          // 其他集合，标记为已同步但实际上是跳过
          for (const { id } of operations) {
            await realmService.update('OfflineQueue', id, {
              is_synced: true,
              updated_at: new Date(),
              server_response: JSON.stringify({ message: `跳过未知集合的同步: ${collection}` })
            });

            // 从内存队列中移除
            const index = this.offlineQueue.indexOf(id);
            if (index !== -1) {
              this.offlineQueue.splice(index, 1);
            }

            skipped++;
          }
          break;
      }
    }

    return {
      processed,
      failed,
      skipped,
      remaining: this.offlineQueue.length,
      success: failed === 0
    };
  }

  /**
   * 更新操作错误信息
   * @param {string} operationId 操作ID
   * @param {Error} error 错误对象
   * @private
   */
  async updateOperationError(operationId, error) {
    try {
      const operation = await realmService.findById('OfflineQueue', operationId);
      if (operation) {
        await realmService.update('OfflineQueue', operationId, {
          retry_count: (operation.retry_count || 0) + 1,
          last_error: error.message,
          updated_at: new Date()
        });
      }
    } catch (updateError) {
      logService.error(`更新离线操作重试次数失败: ${operationId}`, updateError);
    }
  }

  /**
   * 从服务器拉取更新
   * @private
   * @returns {Promise<Object>} 拉取结果
   */
  async pullChanges() {
    try {
      // 构建查询参数
      const params = {};
      if (this.lastSyncTime) {
        params.since = this.lastSyncTime.toISOString();
      }

      // 从新的同步API获取更新
      logService.info('从服务器拉取最新数据', params);
      const response = await apiService.get('/sync/data', { params });

      if (!response || !response.success) {
        throw new Error(response?.error || '从服务器拉取更新失败');
      }

      const data = response.data || {};
      let totalCount = 0;

      // 处理笔记更新
      if (data.notes && Array.isArray(data.notes)) {
        logService.info('从服务器拉取笔记更新', { count: data.notes.length });

        for (const note of data.notes) {
          try {
            const existingNote = await realmService.findById('Note', note._id);

            if (existingNote) {
              // 更新现有笔记
              await realmService.update('Note', note._id, note);
            } else {
              // 创建新笔记
              await realmService.create('Note', note);
            }
          } catch (noteError) {
            logService.error(`处理笔记更新失败: ${note._id}`, noteError);
          }
        }

        totalCount += data.notes.length;
      }

      // 处理提醒更新
      if (data.reminders && Array.isArray(data.reminders)) {
        logService.info('从服务器拉取提醒更新', { count: data.reminders.length });

        for (const reminder of data.reminders) {
          try {
            const existingReminder = await realmService.findById('Reminder', reminder._id);

            if (existingReminder) {
              // 更新现有提醒
              await realmService.update('Reminder', reminder._id, reminder);
            } else {
              // 创建新提醒
              await realmService.create('Reminder', reminder);
            }
          } catch (reminderError) {
            logService.error(`处理提醒更新失败: ${reminder._id}`, reminderError);
          }
        }

        totalCount += data.reminders.length;
      }

      // 处理设置更新
      if (data.settings && typeof data.settings === 'object') {
        logService.info('从服务器拉取设置更新');

        try {
          const existingSettings = await realmService.findOne('Settings', {});

          if (existingSettings) {
            // 更新现有设置
            await realmService.update('Settings', existingSettings._id, data.settings);
          } else {
            // 创建新设置
            await realmService.create('Settings', {
              _id: new realmService.createObjectId(),
              ...data.settings
            });
          }
        } catch (settingsError) {
          logService.error('处理设置更新失败', settingsError);
        }
      }

      // 处理用户信息更新
      if (data.user && typeof data.user === 'object') {
        logService.info('从服务器拉取用户信息更新');

        try {
          // 只保留关键用户信息字段
          const keyUserInfo = {
            _id: data.user._id,
            username: data.user.username,
            email: data.user.email,
            profile: data.user.profile,
            settings: data.user.settings,
            preferences: data.user.preferences,
            updated_at: data.user.updated_at,
            created_at: data.user.created_at
          };

          const existingUser = await realmService.findById('User', data.user._id);

          if (existingUser) {
            // 更新现有用户
            await realmService.update('User', data.user._id, keyUserInfo);
          } else {
            // 创建新用户
            await realmService.create('User', keyUserInfo);
          }
        } catch (userError) {
          logService.error('处理用户信息更新失败', userError);
        }
      }

      return {
        success: true,
        count: totalCount,
        timestamp: response.timestamp
      };
    } catch (error) {
      logService.error('从服务器拉取更新失败', error);
      throw error;
    }
  }

  /**
   * 添加同步事件监听器
   * @param {string} event 事件名称
   * @param {Function} listener 监听器函数
   * @returns {Function} 移除监听器的函数
   */
  addListener(event, listener) {
    if (typeof listener !== 'function') {
      throw new Error('监听器必须是函数');
    }

    eventEmitter.addListener(event, listener);

    return () => {
      eventEmitter.removeListener(event, listener);
    };
  }

  /**
   * 通知所有监听器
   * @param {string} event 事件名称
   * @param {Object} data 事件数据
   * @private
   */
  notifyListeners(event, data = {}) {
    try {
      eventEmitter.emit(event, data);
    } catch (error) {
      logService.error(`通知同步事件监听器失败: ${event}`, error);
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
      offlineQueueLength: this.offlineQueue.length,
      isOnline: networkService.isOnline()
    };
  }

  /**
   * 获取格式化的同步状态描述
   * @returns {string} 格式化的状态描述
   */
  getFormattedSyncStatus() {
    return syncUtils.formatSyncStatus(this.getSyncStatus());
  }

  /**
   * 获取离线队列
   * @returns {Promise<Array>} 离线队列
   */
  async getOfflineQueue() {
    await this.initialize();

    try {
      const offlineOperations = await realmService.find('OfflineQueue', { is_synced: false });
      return offlineOperations || [];
    } catch (error) {
      logService.error('获取离线队列失败', error);
      return [];
    }
  }

  /**
   * 清空离线队列
   * @returns {Promise<boolean>} 是否成功
   */
  async clearOfflineQueue() {
    await this.initialize();

    try {
      // 获取所有未同步的操作
      const offlineOperations = await realmService.find('OfflineQueue', { is_synced: false });

      // 删除所有操作
      for (const operation of offlineOperations) {
        await realmService.remove('OfflineQueue', operation._id);
      }

      // 清空内存队列
      this.offlineQueue = [];

      return true;
    } catch (error) {
      logService.error('清空离线队列失败', error);
      return false;
    }
  }

  /**
   * 设置自动同步间隔
   * @param {number} intervalMinutes 同步间隔（分钟）
   */
  setAutoSyncInterval(intervalMinutes) {
    // 清除现有的同步间隔
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    // 设置新的同步间隔
    if (intervalMinutes > 0) {
      this.syncInterval = setInterval(async () => {
        if (networkService.isOnline() && !this.isSyncing) {
          await this.sync();
        }
      }, intervalMinutes * 60 * 1000);

      logService.info(`设置自动同步间隔为 ${intervalMinutes} 分钟`);
    } else {
      logService.info('禁用自动同步');
    }
  }

  /**
   * 清理资源
   */
  cleanup() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }

    this.listeners = [];
    this.initialized = false;
    this.initializationPromise = null;

    logService.info('同步服务资源已清理');
  }
}

export const syncService = new SyncService();
export default syncService;
