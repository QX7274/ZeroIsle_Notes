/**
 * 搜索历史模型 - Realm版本
 */

import Realm from 'realm';

/**
 * 搜索历史模型定义
 */
class SearchHistory extends Realm.Object {
  static schema = {
    name: 'SearchHistory',
    primaryKey: '_id',
    properties: {
      _id: 'string',
      query: 'string',
      user_id: 'string',
      context: { type: 'string', default: 'all' }, // 'all', 'notes', 'files', 'tags', 'categories', 'knowledge_graph', 'mind_map', 'canvas', 'ai_chat'
      filters: { type: 'string', default: '{}' }, // 存储为JSON字符串
      result_count: { type: 'int', default: 0 },
      created_at: 'date',
      is_favorite: { type: 'bool', default: false },
      is_deleted: { type: 'bool', default: false },
      last_used_at: 'date',
      use_count: { type: 'int', default: 1 },
      device_info: { type: 'string', default: '{}' }, // 存储为JSON字符串
    },
  };

  /**
   * 转换为JSON
   */
  toJSON() {
    // 解析JSON字符串
    const filters = this.filters ? JSON.parse(this.filters) : {};
    const deviceInfo = this.device_info ? JSON.parse(this.device_info) : {};

    return {
      _id: this._id,
      id: this._id,
      query: this.query,
      user_id: this.user_id,
      context: this.context,
      filters: filters,
      result_count: this.result_count,
      created_at: this.created_at,
      is_favorite: this.is_favorite,
      is_deleted: this.is_deleted,
      last_used_at: this.last_used_at,
      use_count: this.use_count,
      device_info: deviceInfo,
    };
  }

  /**
   * 更新使用信息
   * @param {Realm} realm Realm实例
   * @param {number} resultCount 结果数量
   */
  updateUsage(realm, resultCount = null) {
    realm.write(() => {
      this.last_used_at = new Date();
      this.use_count += 1;

      if (resultCount !== null) {
        this.result_count = resultCount;
      }
    });

    return this;
  }

  /**
   * 收藏/取消收藏
   * @param {Realm} realm Realm实例
   * @param {boolean} isFavorite 是否收藏
   */
  setFavorite(realm, isFavorite = true) {
    realm.write(() => {
      this.is_favorite = isFavorite;
    });

    return this;
  }

  /**
   * 软删除
   * @param {Realm} realm Realm实例
   */
  softDelete(realm) {
    realm.write(() => {
      this.is_deleted = true;
    });

    return this;
  }

  /**
   * 恢复
   * @param {Realm} realm Realm实例
   */
  restore(realm) {
    realm.write(() => {
      this.is_deleted = false;
    });

    return this;
  }

  /**
   * 更新过滤器
   * @param {Realm} realm Realm实例
   * @param {Object} filters 过滤器
   */
  updateFilters(realm, filters) {
    realm.write(() => {
      this.filters = JSON.stringify(filters);
    });

    return this;
  }

  /**
   * 静态方法 - 根据ID查找
   * @param {Realm} realm Realm实例
   * @param {string} id ID
   */
  static findById(realm, id) {
    return realm.objectForPrimaryKey('SearchHistory', id);
  }

  /**
   * 静态方法 - 查找用户的搜索历史
   * @param {Realm} realm Realm实例
   * @param {string} userId 用户ID
   * @param {Object} options 选项
   */
  static findByUser(realm, userId, options = {}) {
    const {
      is_deleted = false,
      context = null,
      is_favorite = null,
    } = options;

    let query = `user_id = "${userId}" AND is_deleted = ${is_deleted}`;

    if (context) {
      query += ` AND context = "${context}"`;
    }

    if (is_favorite !== null) {
      query += ` AND is_favorite = ${is_favorite}`;
    }

    let results = realm.objects('SearchHistory').filtered(query);

    // 排序
    if (options.sort) {
      const sortField = Object.keys(options.sort)[0];
      const sortOrder = options.sort[sortField] === -1;
      results = results.sorted(sortField, sortOrder);
    } else {
      results = results.sorted('last_used_at', true);
    }

    // 分页
    if (options.skip !== undefined && options.limit !== undefined) {
      const skip = options.skip || 0;
      const limit = options.limit || 20;
      results = Array.from(results).slice(skip, skip + limit);
    }

    return results;
  }

  /**
   * 静态方法 - 查找最近的搜索历史
   * @param {Realm} realm Realm实例
   * @param {string} userId 用户ID
   * @param {number} limit 限制数量
   */
  static findRecent(realm, userId, limit = 10) {
    const results = realm.objects('SearchHistory')
      .filtered(`user_id = "${userId}" AND is_deleted = false`)
      .sorted('last_used_at', true);

    return Array.from(results).slice(0, limit);
  }

  /**
   * 静态方法 - 查找常用的搜索历史
   * @param {Realm} realm Realm实例
   * @param {string} userId 用户ID
   * @param {number} limit 限制数量
   */
  static findPopular(realm, userId, limit = 10) {
    const results = realm.objects('SearchHistory')
      .filtered(`user_id = "${userId}" AND is_deleted = false AND use_count > 1`)
      .sorted('use_count', true);

    return Array.from(results).slice(0, limit);
  }

  /**
   * 静态方法 - 查找收藏的搜索历史
   * @param {Realm} realm Realm实例
   * @param {string} userId 用户ID
   * @param {number} limit 限制数量
   */
  static findFavorites(realm, userId, limit = 10) {
    const results = realm.objects('SearchHistory')
      .filtered(`user_id = "${userId}" AND is_deleted = false AND is_favorite = true`)
      .sorted('last_used_at', true);

    return Array.from(results).slice(0, limit);
  }

  /**
   * 静态方法 - 查找或创建搜索历史
   * @param {Realm} realm Realm实例
   * @param {Object} data 搜索历史数据
   */
  static findOrCreate(realm, data) {
    const { query, user_id, context = 'all', filters = {}, result_count = 0, device_info = {} } = data;

    if (!query || !user_id) {
      throw new Error('查询和用户ID是必需的');
    }

    // 查找现有记录
    const history = realm.objects('SearchHistory')
      .filtered(`user_id = "${user_id}" AND query = "${query}" AND context = "${context}" AND is_deleted = false`)[0];

    if (history) {
      // 更新现有记录
      realm.write(() => {
        history.last_used_at = new Date();
        history.use_count += 1;
        history.result_count = result_count;
        history.filters = JSON.stringify(filters);

        // 合并设备信息
        const currentDeviceInfo = history.device_info ? JSON.parse(history.device_info) : {};
        history.device_info = JSON.stringify({ ...currentDeviceInfo, ...device_info });
      });

      return history;
    }

    // 创建新记录
    let newHistory;
    realm.write(() => {
      newHistory = realm.create('SearchHistory', {
        _id: new Realm.BSON.ObjectId().toHexString(),
        query,
        user_id,
        context,
        filters: JSON.stringify(filters),
        result_count,
        device_info: JSON.stringify(device_info),
        created_at: new Date(),
        last_used_at: new Date(),
      });
    });

    return newHistory;
  }

  /**
   * 静态方法 - 清除用户的搜索历史
   * @param {Realm} realm Realm实例
   * @param {string} userId 用户ID
   * @param {Object} options 选项
   */
  static clearHistory(realm, userId, options = {}) {
    const { keepFavorites = true, context = null } = options;

    let query = `user_id = "${userId}"`;

    if (keepFavorites) {
      query += ' AND is_favorite = false';
    }

    if (context) {
      query += ` AND context = "${context}"`;
    }

    const historyToUpdate = realm.objects('SearchHistory').filtered(query);

    realm.write(() => {
      for (const history of historyToUpdate) {
        history.is_deleted = true;
      }
    });

    return historyToUpdate.length;
  }

  /**
   * 静态方法 - 获取搜索建议
   * @param {Realm} realm Realm实例
   * @param {string} userId 用户ID
   * @param {string} prefix 前缀
   * @param {number} limit 限制数量
   */
  static getSuggestions(realm, userId, prefix, limit = 5) {
    // 在Realm中，我们不能直接使用正则表达式，但可以使用BEGINSWITH运算符
    const results = realm.objects('SearchHistory')
      .filtered(`user_id = "${userId}" AND is_deleted = false AND query BEGINSWITH[c] "${prefix}"`)
      .sorted([['use_count', true], ['last_used_at', true]]);

    return Array.from(results).slice(0, limit);
  }
}

export default SearchHistory;
