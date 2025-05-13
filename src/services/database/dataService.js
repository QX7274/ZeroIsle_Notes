/**
 * 数据服务
 * 提供统一的数据访问接口，封装MongoDB和Realm操作
 */

import { mongoDBService } from './mongoDBAdapter';
import { realmService } from './realmService';
import { networkService } from '../network/networkService';
import { offlineSyncService } from '../offline/offlineSyncService';

import { eventEmitter } from '../utils/eventEmitter';

// 数据事件
export const DATA_EVENTS = {
  DATA_CHANGED: 'data:changed',
  DATA_CREATED: 'data:created',
  DATA_UPDATED: 'data:updated',
  DATA_DELETED: 'data:deleted',
  DATA_SYNCED: 'data:synced',
  DATA_SYNC_FAILED: 'data:sync_failed',
};

class DataService {
  constructor() {
    this.initialized = false;
    this.initializationPromise = null;
  }

  /**
   * 初始化数据服务
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

        // 如果在线，初始化MongoDB服务
        if (networkService.isOnline()) {
          await mongoDBService.initialize();
        }

        // 初始化离线同步服务
        await offlineSyncService.initialize();

        this.initialized = true;
        console.info('数据服务初始化成功');
        resolve();
      } catch (error) {
        console.error('数据服务初始化失败', error);
        reject(error);
      }
    });

    return this.initializationPromise;
  }

  /**
   * 创建文档
   * @param {string} collectionName 集合名称
   * @param {Object} data 文档数据
   * @param {Object} options 选项
   * @returns {Promise<Object>} 创建的文档   */
  async create(collectionName, data, options = {}) {
    try {
      await this.initialize();

      // 准备数据
      const now = new Date();
      const documentId = data._id || `${collectionName}_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;

      const document = {
        _id: documentId,
        ...data,
        created_at: data.created_at || now,
        updated_at: now,
      };

      // 保存到本地数据库
      const localDocument = await realmService.create(collectionName, document);

      // 如果在线，保存到云端
      if (networkService.isOnline() && !options.skipSync) {
        try {
          await mongoDBService.insertOne(collectionName, document);

          // 标记为已同步
          await realmService.update(collectionName, documentId, { is_synced: true });

          // 触发同步事件
          eventEmitter.emit(DATA_EVENTS.DATA_SYNCED, {
            collectionName,
            documentId,
            operation: 'create',
          });
        } catch (syncError) {
          console.error(`同步创建文档失败: ${collectionName}/${documentId}`, syncError);

          // 添加到同步队列
          await offlineSyncService.addToSyncQueue({
            entity_id: documentId,
            entity_type: collectionName,
            operation: 'create',
            data: document,
            user_id: document.user_id || 'current_user',
          });

          // 触发同步失败事件
          eventEmitter.emit(DATA_EVENTS.DATA_SYNC_FAILED, {
            collectionName,
            documentId,
            operation: 'create',
            error: syncError.message,
          });
        }
      } else if (!options.skipSync) {
        // 添加到同步队列
        await offlineSyncService.addToSyncQueue({
          entity_id: documentId,
          entity_type: collectionName,
          operation: 'create',
          data: document,
          user_id: document.user_id || 'current_user',
        });
      }

      // 触发创建事件
      eventEmitter.emit(DATA_EVENTS.DATA_CREATED, {
        collectionName,
        document: localDocument,
      });

      // 触发数据变更事件
      eventEmitter.emit(DATA_EVENTS.DATA_CHANGED, {
        collectionName,
        operation: 'create',
        document: localDocument,
      });

      return localDocument;
    } catch (error) {
      console.error(`创建文档失败: ${collectionName}`, error);
      throw error;
    }
  }

  /**
   * 更新文档
   * @param {string} collectionName 集合名称
   * @param {string} id 文档ID
   * @param {Object} data 更新数据
   * @param {Object} options 选项
   * @returns {Promise<Object>} 更新后的文档
   */
  async update(collectionName, id, data, options = {}) {
    try {
      await this.initialize();

      // 准备数据
      const updateData = {
        ...data,
        updated_at: new Date(),
        is_synced: false,
      };

      // 从更新数据中删除不可修改的字段
      delete updateData._id;
      delete updateData.created_at;

      // 更新本地文档
      const updatedDocument = await realmService.update(collectionName, id, updateData);

      // 如果在线，更新云端文档
      if (networkService.isOnline() && !options.skipSync) {
        try {
          await mongoDBService.updateOne(
            collectionName,
            { _id: id },
            { $set: updateData }
          );

          // 标记为已同步
          await realmService.update(collectionName, id, { is_synced: true });

          // 触发同步事件
          eventEmitter.emit(DATA_EVENTS.DATA_SYNCED, {
            collectionName,
            documentId: id,
            operation: 'update',
          });
        } catch (syncError) {
          console.error(`同步更新文档失败: ${collectionName}/${id}`, syncError);

          // 添加到同步队列          
          await offlineSyncService.addToSyncQueue({
            entity_id: id,
            entity_type: collectionName,
            operation: 'update',
            data: updateData,
            user_id: updatedDocument.user_id || 'current_user',
          });

          // 触发同步失败事件
          eventEmitter.emit(DATA_EVENTS.DATA_SYNC_FAILED, {
            collectionName,
            documentId: id,
            operation: 'update',
            error: syncError.message,
          });
        }
      } else if (!options.skipSync) {
        // 添加到同步队列
        await offlineSyncService.addToSyncQueue({
          entity_id: id,
          entity_type: collectionName,
          operation: 'update',
          data: updateData,
          user_id: updatedDocument.user_id || 'current_user',
        });
      }

      // 触发更新事件
      eventEmitter.emit(DATA_EVENTS.DATA_UPDATED, {
        collectionName,
        documentId: id,
        document: updatedDocument,
      });

      // 触发数据变更事件
      eventEmitter.emit(DATA_EVENTS.DATA_CHANGED, {
        collectionName,
        operation: 'update',
        documentId: id,
        document: updatedDocument,
      });

      return updatedDocument;
    } catch (error) {
      console.error(`更新文档失败: ${collectionName}/${id}`, error);
      throw error;
    }
  }

  /**
   * 删除文档
   * @param {string} collectionName 集合名称
   * @param {string} id 文档ID
   * @param {Object} options 选项
   * @returns {Promise<boolean>} 是否成功
   */
  async delete(collectionName, id, options = {}) {
    try {
      await this.initialize();

      // 获取文档
      const document = await realmService.findById(collectionName, id);

      if (!document) {
        return false;
      }

      // 如果是软删除
      if (options.soft !== false) {
        // 更新文档为已删除
        await realmService.update(collectionName, id, {
          is_deleted: true,
          deleted_at: new Date(),
          is_synced: false,
        });

        // 如果在线，更新云端文档
        if (networkService.isOnline() && !options.skipSync) {
          try {
            await mongoDBService.updateOne(
              collectionName,
              { _id: id },
              {
                $set: {
                  is_deleted: true,
                  deleted_at: new Date(),
                },
              }
            );

            // 标记为已同步
            await realmService.update(collectionName, id, { is_synced: true });

            // 触发同步事件
            eventEmitter.emit(DATA_EVENTS.DATA_SYNCED, {
              collectionName,
              documentId: id,
              operation: 'delete',
            });
          } catch (syncError) {
            console.error(`同步删除文档失败: ${collectionName}/${id}`, syncError);

            // 添加到同步队列
            await offlineSyncService.addToSyncQueue({
              entity_id: id,
              entity_type: collectionName,
              operation: 'update',
              data: {
                is_deleted: true,
                deleted_at: new Date(),
              },
              user_id: document.user_id || 'current_user',
            });

            // 触发同步失败事件
            eventEmitter.emit(DATA_EVENTS.DATA_SYNC_FAILED, {
              collectionName,
              documentId: id,
              operation: 'delete',
              error: syncError.message,
            });
          }
        } else if (!options.skipSync) {
          // 添加到同步队列
          await offlineSyncService.addToSyncQueue({
            entity_id: id,
            entity_type: collectionName,
            operation: 'update',
            data: {
              is_deleted: true,
              deleted_at: new Date(),
            },
            user_id: document.user_id || 'current_user',
          });
        }
      } else {
        // 硬删除
        await realmService.delete(collectionName, id);

        // 如果在线，删除云端文档
        if (networkService.isOnline() && !options.skipSync) {
          try {
            await mongoDBService.deleteOne(collectionName, { _id: id });

            // 触发同步事件
            eventEmitter.emit(DATA_EVENTS.DATA_SYNCED, {
              collectionName,
              documentId: id,
              operation: 'delete',
            });
          } catch (syncError) {
            console.error(`同步硬删除文档失败: ${collectionName}/${id}`, syncError);

            // 添加到同步队列
            await offlineSyncService.addToSyncQueue({
              entity_id: id,
              entity_type: collectionName,
              operation: 'delete',
              data: {},
              user_id: document.user_id || 'current_user',
            });

            // 触发同步失败事件
            eventEmitter.emit(DATA_EVENTS.DATA_SYNC_FAILED, {
              collectionName,
              documentId: id,
              operation: 'delete',
              error: syncError.message,
            });
          }
        } else if (!options.skipSync) {
          // 添加到同步队列
          await offlineSyncService.addToSyncQueue({
            entity_id: id,
            entity_type: collectionName,
            operation: 'delete',
            data: {},
            user_id: document.user_id || 'current_user',
          });
        }
      }

      // 触发删除事件
      eventEmitter.emit(DATA_EVENTS.DATA_DELETED, {
        collectionName,
        documentId: id,
      });

      // 触发数据变更事件
      eventEmitter.emit(DATA_EVENTS.DATA_CHANGED, {
        collectionName,
        operation: 'delete',
        documentId: id,
      });

      return true;
    } catch (error) {
      console.error(`删除文档失败: ${collectionName}/${id}`, error);
      throw error;
    }
  }

  /**
   * 查找文档
   * @param {string} collectionName 集合名称
   * @param {Object} query 查询条件
   * @param {Object} options 选项
   * @returns {Promise<Array<Object>>} 文档列表
   */
  async find(collectionName, query = {}, options = {}) {
    try {
      await this.initialize();

      // 默认不包含已删除的文档
      if (query.is_deleted === undefined && !options.includeDeleted) {
        query.is_deleted = { $ne: true };
      }

      // 从本地查询
      const documents = await realmService.find(collectionName, query, options);

      return documents;
    } catch (error) {
      console.error(`查询文档失败: ${collectionName}`, error);
      throw error;
    }
  }

  /**
   * 查找单个文档
   * @param {string} collectionName 集合名称
   * @param {Object} query 查询条件
   * @param {Object} options 选项
   * @returns {Promise<Object|null>} 文档或null
   */
  async findOne(collectionName, query = {}, options = {}) {
    try {
      await this.initialize();

      // 默认不包含已删除的文档
      if (query.is_deleted === undefined && !options.includeDeleted) {
        query.is_deleted = { $ne: true };
      }

      // 从本地查询
      const document = await realmService.findOne(collectionName, query, options);

      return document;
    } catch (error) {
      console.error(`查询单个文档失败: ${collectionName}`, error);
      throw error;
    }
  }

  /**
   * 根据ID查找文档
   * @param {string} collectionName 集合名称
   * @param {string} id 文档ID
   * @param {Object} options 选项
   * @returns {Promise<Object|null>} 文档或null
   */
  async findById(collectionName, id, options = {}) {
    try {
      await this.initialize();

      // 从本地查询
      const document = await realmService.findById(collectionName, id);

      // 如果文档已删除且不包含已删除的文档
      if (document && document.is_deleted && !options.includeDeleted) {
        return null;
      }

      return document;
    } catch (error) {
      console.error(`根据ID查询文档失败: ${collectionName}/${id}`, error);
      throw error;
    }
  }

  /**
   * 同步数据
   * @param {string} collectionName 集合名称
   * @param {Object} options 选项
   * @returns {Promise<Object>} 同步结果
   */
  async sync(collectionName, options = {}) {
    try {
      await this.initialize();

      // 检查网络连接
      if (!networkService.isOnline()) {
        return { success: false, message: '网络离线，无法同步' };
      }

      // 同步队列
      await offlineSyncService.syncQueue();

      // 如果需要拉取最新数据      
      if (options.pull !== false) {
        // 获取最后同步时间        
        const lastSyncTime = await this.getLastSyncTime(collectionName);

        // 从云端获取最新数据        
        const query = lastSyncTime ? { updated_at: { $gt: lastSyncTime } } : {};
        const cloudDocuments = await mongoDBService.find(collectionName, query);

        // 更新本地数据
        for (const document of cloudDocuments) {
          const localDocument = await realmService.findById(collectionName, document._id);

          if (!localDocument) {
            // 如果本地不存在，创建
            await realmService.create(collectionName, {
              ...document,
              is_synced: true,
            });
          } else if (new Date(document.updated_at) > new Date(localDocument.updated_at)) {
            // 如果云端版本更新，更新本地数据
            await realmService.update(collectionName, document._id, {
              ...document,
              is_synced: true,
            });
          }
        }

        // 更新最后同步时间
        await this.setLastSyncTime(collectionName, new Date());
      }

      return { success: true, message: '同步成功' };
    } catch (error) {
      console.error(`同步数据失败: ${collectionName}`, error);
      return { success: false, message: error.message };
    }
  }

  /**
   * 获取最后同步时间
   * @param {string} collectionName 集合名称
   * @returns {Promise<Date|null>} 最后同步时间
   * @private
   */
  async getLastSyncTime(collectionName) {
    try {
      const syncInfo = await realmService.findOne('sync_info', { entity_type: collectionName });
      return syncInfo ? new Date(syncInfo.synced_at) : null;
    } catch (error) {
      console.error(`获取最后同步时间失败 ${collectionName}`, error);
      return null;
    }
  }

  /**
   * 设置最后同步时间
   * @param {string} collectionName 集合名称
   * @param {Date} time 同步时间
   * @returns {Promise<boolean>} 是否成功
   * @private
   */
  async setLastSyncTime(collectionName, time) {
    try {
      const syncInfo = await realmService.findOne('sync_info', { entity_type: collectionName });

      if (syncInfo) {
        await realmService.update('sync_info', syncInfo._id, { synced_at: time });
      } else {
        await realmService.create('sync_info', {
          entity_type: collectionName,
          synced_at: time,
        });
      }

      return true;
    } catch (error) {
      console.error(`设置最后同步时间失败 ${collectionName}`, error);
      return false;
    }
  }

  /**
   * 添加数据事件监听器
   * @param {string} event 事件名称
   * @param {Function} listener 监听器
   * @returns {Function} 移除监听器的函数
   */
  addListener(event, listener) {
    eventEmitter.addListener(event, listener);
    return () => eventEmitter.removeListener(event, listener);
  }

  /**
   * 移除数据事件监听器
   * @param {string} event 事件名称
   * @param {Function} listener 监听器
   */
  removeListener(event, listener) {
    eventEmitter.removeListener(event, listener);
  }
}

export const dataService = new DataService();

export default dataService;

