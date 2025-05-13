/**
 * 离线队列模型 - Realm版本
 * 用于存储离线操作队列
 */

import Realm from 'realm';

/**
 * 离线队列模型定义
 */
class OfflineQueue extends Realm.Object {
  static schema = {
    name: 'OfflineQueue',
    primaryKey: '_id',
    properties: {
      _id: 'string',
      entity_id: 'string',
      entity_type: 'string',
      operation: 'string', // 'create', 'update', 'delete'
      data: { type: 'string', default: '{}' }, // 存储为JSON字符串
      user_id: 'string',
      status: { type: 'string', default: 'pending' }, // 'pending', 'syncing', 'synced', 'failed'
      retry_count: { type: 'int', default: 0 },
      error: { type: 'string', optional: true },
      created_at: 'date',
      updated_at: 'date',
      synced_at: { type: 'date', optional: true },
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
      operation: this.operation,
      data: data,
      user_id: this.user_id,
      status: this.status,
      retry_count: this.retry_count,
      error: this.error,
      created_at: this.created_at,
      updated_at: this.updated_at,
      synced_at: this.synced_at,
    };
  }

  /**
   * 标记为已同步
   * @param {Realm} realm Realm实例
   * @returns {OfflineQueue} 更新后的队列项
   */
  markAsSynced(realm) {
    realm.write(() => {
      this.status = 'synced';
      this.synced_at = new Date();
      this.updated_at = new Date();
    });

    return this;
  }

  /**
   * 标记为失败
   * @param {Realm} realm Realm实例
   * @param {string} error 错误信息
   * @returns {OfflineQueue} 更新后的队列项
   */
  markAsFailed(realm, error) {
    realm.write(() => {
      this.status = 'failed';
      this.error = error;
      this.retry_count += 1;
      this.updated_at = new Date();
    });

    return this;
  }

  /**
   * 标记为同步中
   * @param {Realm} realm Realm实例
   * @returns {OfflineQueue} 更新后的队列项
   */
  markAsSyncing(realm) {
    realm.write(() => {
      this.status = 'syncing';
      this.updated_at = new Date();
    });

    return this;
  }

  /**
   * 重置为待同步
   * @param {Realm} realm Realm实例
   * @returns {OfflineQueue} 更新后的队列项
   */
  resetToPending(realm) {
    realm.write(() => {
      this.status = 'pending';
      this.updated_at = new Date();
    });

    return this;
  }

  /**
   * 静态方法 - 查找待同步的队列项
   * @param {Realm} realm Realm实例
   * @param {Object} query 查询条件
   * @param {Object} options 选项
   * @returns {Array} 队列项列表
   */
  static findPending(realm, query = {}, options = {}) {
    let queryStr = 'status = "pending"';

    if (query.user_id) {
      queryStr += ` AND user_id = "${query.user_id}"`;
    }

    if (query.entity_type) {
      queryStr += ` AND entity_type = "${query.entity_type}"`;
    }

    let results = realm.objects('OfflineQueue').filtered(queryStr);

    // 排序
    results = results.sorted('created_at', false);

    // 分页
    if (options.limit) {
      results = Array.from(results).slice(0, options.limit);
    }

    return results;
  }

  /**
   * 静态方法 - 查找失败的队列项
   * @param {Realm} realm Realm实例
   * @param {Object} query 查询条件
   * @param {Object} options 选项
   * @returns {Array} 队列项列表
   */
  static findFailed(realm, query = {}, options = {}) {
    let queryStr = 'status = "failed"';

    if (query.user_id) {
      queryStr += ` AND user_id = "${query.user_id}"`;
    }

    if (query.entity_type) {
      queryStr += ` AND entity_type = "${query.entity_type}"`;
    }

    let results = realm.objects('OfflineQueue').filtered(queryStr);

    // 排序
    results = results.sorted('updated_at', true);

    // 分页
    if (options.limit) {
      results = Array.from(results).slice(0, options.limit);
    }

    return results;
  }

  /**
   * 静态方法 - 查找已同步的队列项
   * @param {Realm} realm Realm实例
   * @param {Object} query 查询条件
   * @param {Object} options 选项
   * @returns {Array} 队列项列表
   */
  static findSynced(realm, query = {}, options = {}) {
    let queryStr = 'status = "synced"';

    if (query.user_id) {
      queryStr += ` AND user_id = "${query.user_id}"`;
    }

    if (query.entity_type) {
      queryStr += ` AND entity_type = "${query.entity_type}"`;
    }

    let results = realm.objects('OfflineQueue').filtered(queryStr);

    // 排序
    results = results.sorted('synced_at', true);

    // 分页
    if (options.limit) {
      results = Array.from(results).slice(0, options.limit);
    }

    return results;
  }

  /**
   * 静态方法 - 清理已同步的队列项
   * @param {Realm} realm Realm实例
   * @param {Object} query 查询条件
   * @param {number} days 天数
   * @returns {number} 删除的数量
   */
  static cleanupSynced(realm, query = {}, days = 7) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    let queryStr = `status = "synced" AND synced_at < $0`;

    if (query.user_id) {
      queryStr += ` AND user_id = "${query.user_id}"`;
    }

    if (query.entity_type) {
      queryStr += ` AND entity_type = "${query.entity_type}"`;
    }

    const itemsToDelete = realm.objects('OfflineQueue').filtered(queryStr, cutoffDate);
    const count = itemsToDelete.length;

    realm.write(() => {
      realm.delete(itemsToDelete);
    });

    return count;
  }
}

export default OfflineQueue;
