/**
 * 同步信息模型 - Realm版本
 */

import Realm from 'realm';

/**
 * 同步信息模型定义
 */
class SyncInfo extends Realm.Object {
  static schema = {
    name: 'SyncInfo',
    primaryKey: '_id',
    properties: {
      _id: 'string',
      entity_id: 'string',
      entity_type: 'string', // 'note', 'category', 'tag', 'reminder', 'knowledge_node', 'knowledge_edge', 'knowledge_graph', 'infinite_canvas', 'canvas_element', 'mind_map', 'mind_map_node', 'ai_chat', 'user', 'file'
      user_id: 'string',
      status: { type: 'string', default: 'pending' }, // 'pending', 'synced', 'failed', 'conflict'
      operation: 'string', // 'create', 'update', 'delete'
      data: { type: 'string', default: '{}' }, // 存储为JSON字符串
      error: { type: 'string', optional: true },
      retry_count: { type: 'int', default: 0 },
      last_sync_attempt: { type: 'date', optional: true },
      created_at: 'date',
      updated_at: 'date',
      device_id: { type: 'string', optional: true },
      version: { type: 'int', default: 1 },
      conflict_resolution: { type: 'string', optional: true }, // 'local', 'remote', 'manual', 'merged'
      priority: { type: 'int', default: 0 },
    },
  };

  /**
   * 转换为JSON
   */
  toJSON() {
    // 解析JSON字符串
    const data = this.data ? JSON.parse(this.data) : {};

    return {
      _id: this._id,
      id: this._id,
      entity_id: this.entity_id,
      entity_type: this.entity_type,
      user_id: this.user_id,
      status: this.status,
      operation: this.operation,
      data: data,
      error: this.error,
      retry_count: this.retry_count,
      last_sync_attempt: this.last_sync_attempt,
      created_at: this.created_at,
      updated_at: this.updated_at,
      device_id: this.device_id,
      version: this.version,
      conflict_resolution: this.conflict_resolution,
      priority: this.priority,
    };
  }

  /**
   * 更新状态
   * @param {Realm} realm Realm实例
   * @param {string} status 状态
   * @param {string} error 错误信息
   */
  updateStatus(realm, status, error = null) {
    realm.write(() => {
      this.status = status;
      this.error = error;
      this.updated_at = new Date();

      if (status === 'failed') {
        this.retry_count += 1;
      }

      this.last_sync_attempt = new Date();
    });

    return this;
  }

  /**
   * 标记为已同步
   * @param {Realm} realm Realm实例
   */
  markAsSynced(realm) {
    return this.updateStatus(realm, 'synced');
  }

  /**
   * 标记为失败
   * @param {Realm} realm Realm实例
   * @param {string} error 错误信息
   */
  markAsFailed(realm, error) {
    return this.updateStatus(realm, 'failed', error);
  }

  /**
   * 标记为冲突
   * @param {Realm} realm Realm实例
   */
  markAsConflict(realm) {
    return this.updateStatus(realm, 'conflict');
  }

  /**
   * 解决冲突
   * @param {Realm} realm Realm实例
   * @param {string} resolution 解决方式
   * @param {Object} data 解决后的数据
   */
  resolveConflict(realm, resolution, data = null) {
    realm.write(() => {
      this.conflict_resolution = resolution;

      if (data) {
        this.data = JSON.stringify(data);
      }

      this.status = 'pending';
      this.updated_at = new Date();
    });

    return this;
  }

  /**
   * 更新数据
   * @param {Realm} realm Realm实例
   * @param {Object} data 数据
   */
  updateData(realm, data) {
    realm.write(() => {
      this.data = JSON.stringify(data);
      this.updated_at = new Date();
    });

    return this;
  }

  /**
   * 更新操作
   * @param {Realm} realm Realm实例
   * @param {string} operation 操作
   */
  updateOperation(realm, operation) {
    realm.write(() => {
      this.operation = operation;
      this.updated_at = new Date();
    });

    return this;
  }

  /**
   * 更新优先级
   * @param {Realm} realm Realm实例
   * @param {number} priority 优先级
   */
  updatePriority(realm, priority) {
    realm.write(() => {
      this.priority = priority;
      this.updated_at = new Date();
    });

    return this;
  }

  /**
   * 静态方法 - 根据ID查找
   * @param {Realm} realm Realm实例
   * @param {string} id ID
   */
  static findById(realm, id) {
    return realm.objectForPrimaryKey('SyncInfo', id);
  }

  /**
   * 静态方法 - 根据实体查找
   * @param {Realm} realm Realm实例
   * @param {string} entityId 实体ID
   * @param {string} entityType 实体类型
   */
  static findByEntity(realm, entityId, entityType) {
    return realm.objects('SyncInfo')
      .filtered(`entity_id = "${entityId}" AND entity_type = "${entityType}"`)[0];
  }

  /**
   * 静态方法 - 查找用户的同步信息
   * @param {Realm} realm Realm实例
   * @param {string} userId 用户ID
   * @param {Object} options 选项
   */
  static findByUser(realm, userId, options = {}) {
    const {
      status = null,
      entity_type = null,
    } = options;

    let query = `user_id = "${userId}"`;

    if (status) {
      query += ` AND status = "${status}"`;
    }

    if (entity_type) {
      query += ` AND entity_type = "${entity_type}"`;
    }

    let results = realm.objects('SyncInfo').filtered(query);

    // 排序
    if (options.sort) {
      const sortField = Object.keys(options.sort)[0];
      const sortOrder = options.sort[sortField] === -1;
      results = results.sorted(sortField, sortOrder);
    } else {
      results = results.sorted('created_at', true);
    }

    // 分页
    if (options.skip !== undefined && options.limit !== undefined) {
      const skip = options.skip || 0;
      const limit = options.limit || 100;
      results = Array.from(results).slice(skip, skip + limit);
    }

    return results;
  }

  /**
   * 静态方法 - 查找待同步的信息
   * @param {Realm} realm Realm实例
   * @param {string} userId 用户ID
   * @param {Object} options 选项
   */
  static findPending(realm, userId, options = {}) {
    const { entity_type = null } = options;

    let query = `user_id = "${userId}" AND status = "pending"`;

    if (entity_type) {
      query += ` AND entity_type = "${entity_type}"`;
    }

    let results = realm.objects('SyncInfo').filtered(query);

    // 排序 - 优先级高的先同步，然后按创建时间排序
    results = results.sorted([['priority', true], ['created_at', false]]);

    // 分页
    if (options.skip !== undefined && options.limit !== undefined) {
      const skip = options.skip || 0;
      const limit = options.limit || 100;
      results = Array.from(results).slice(skip, skip + limit);
    }

    return results;
  }

  /**
   * 静态方法 - 查找失败的同步信息
   * @param {Realm} realm Realm实例
   * @param {string} userId 用户ID
   * @param {Object} options 选项
   */
  static findFailed(realm, userId, options = {}) {
    const { entity_type = null } = options;

    let query = `user_id = "${userId}" AND status = "failed"`;

    if (entity_type) {
      query += ` AND entity_type = "${entity_type}"`;
    }

    let results = realm.objects('SyncInfo').filtered(query);

    // 排序 - 按最后同步尝试时间排序
    results = results.sorted('last_sync_attempt', true);

    // 分页
    if (options.skip !== undefined && options.limit !== undefined) {
      const skip = options.skip || 0;
      const limit = options.limit || 100;
      results = Array.from(results).slice(skip, skip + limit);
    }

    return results;
  }

  /**
   * 静态方法 - 查找冲突的同步信息
   * @param {Realm} realm Realm实例
   * @param {string} userId 用户ID
   * @param {Object} options 选项
   */
  static findConflicts(realm, userId, options = {}) {
    const { entity_type = null } = options;

    let query = `user_id = "${userId}" AND status = "conflict"`;

    if (entity_type) {
      query += ` AND entity_type = "${entity_type}"`;
    }

    let results = realm.objects('SyncInfo').filtered(query);

    // 排序 - 按创建时间排序
    results = results.sorted('created_at', true);

    // 分页
    if (options.skip !== undefined && options.limit !== undefined) {
      const skip = options.skip || 0;
      const limit = options.limit || 100;
      results = Array.from(results).slice(skip, skip + limit);
    }

    return results;
  }

  /**
   * 静态方法 - 创建或更新同步信息
   * @param {Realm} realm Realm实例
   * @param {Object} data 同步信息数据
   */
  static createOrUpdate(realm, data) {
    const { entity_id, entity_type, user_id, operation, syncData } = data;

    if (!entity_id || !entity_type || !user_id || !operation) {
      throw new Error('缺少必要的同步信息');
    }

    // 查找现有同步信息
    const existingInfo = this.findByEntity(realm, entity_id, entity_type);

    if (existingInfo) {
      // 更新现有同步信息
      realm.write(() => {
        existingInfo.operation = operation;
        existingInfo.data = syncData ? JSON.stringify(syncData) : existingInfo.data;
        existingInfo.status = 'pending';
        existingInfo.updated_at = new Date();

        if (data.priority !== undefined) {
          existingInfo.priority = data.priority;
        }

        if (data.device_id) {
          existingInfo.device_id = data.device_id;
        }
      });

      return existingInfo;
    }

    // 创建新同步信息
    let newInfo;
    realm.write(() => {
      newInfo = realm.create('SyncInfo', {
        _id: new Realm.BSON.ObjectId().toHexString(),
        entity_id,
        entity_type,
        user_id,
        operation,
        data: JSON.stringify(syncData || {}),
        status: 'pending',
        device_id: data.device_id || null,
        priority: data.priority || 0,
        created_at: new Date(),
        updated_at: new Date(),
      });
    });

    return newInfo;
  }

  /**
   * 静态方法 - 批量更新状态
   * @param {Realm} realm Realm实例
   * @param {Array<string>} ids ID数组
   * @param {string} status 状态
   */
  static updateStatusBatch(realm, ids, status) {
    realm.write(() => {
      ids.forEach(id => {
        const syncInfo = realm.objectForPrimaryKey('SyncInfo', id);
        if (syncInfo) {
          syncInfo.status = status;
          syncInfo.updated_at = new Date();
          syncInfo.last_sync_attempt = new Date();

          if (status === 'failed') {
            syncInfo.retry_count += 1;
          }
        }
      });
    });

    return ids.length;
  }

  /**
   * 静态方法 - 删除已同步的信息
   * @param {Realm} realm Realm实例
   * @param {string} userId 用户ID
   * @param {number} olderThan 早于多少天（默认7天）
   */
  static cleanupSynced(realm, userId, olderThan = 7) {
    const date = new Date();
    date.setDate(date.getDate() - olderThan);

    const syncInfoToDelete = realm.objects('SyncInfo')
      .filtered(`user_id = "${userId}" AND status = "synced" AND updated_at < $0`, date);

    const count = syncInfoToDelete.length;

    realm.write(() => {
      realm.delete(syncInfoToDelete);
    });

    return count;
  }
}

export default SyncInfo;
