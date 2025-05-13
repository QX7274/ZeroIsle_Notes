/**
 * 笔记模型 - Realm版本
 */

import Realm from 'realm';

/**
 * 笔记模型定义
 */
class Note extends Realm.Object {
  static schema = {
    name: 'Note',
    primaryKey: '_id',
    properties: {
      _id: 'string',
      title: 'string',
      content: { type: 'string', default: '' },
      type: { type: 'string', default: 'text' },
      tags: { type: 'string[]', default: [] },
      category_id: { type: 'string', optional: true },
      color: { type: 'string', default: '#4CAF50' },
      is_favorite: { type: 'bool', default: false },
      is_archived: { type: 'bool', default: false },
      is_deleted: { type: 'bool', default: false },
      is_synced: { type: 'bool', default: false },
      created_at: 'date',
      updated_at: 'date',
      deleted_at: { type: 'date', optional: true },
      user_id: 'string',
      metadata: { type: 'string', default: '{}' }, // 存储为JSON字符串
      file_path: { type: 'string', optional: true },
      file_size: { type: 'int', optional: true },
      file_type: { type: 'string', optional: true },
      thumbnail_path: { type: 'string', optional: true },
      shared_with: { type: 'string', default: '[]' }, // 存储为JSON字符串
      version: { type: 'int', default: 1 },
      parent_id: { type: 'string', optional: true },
    },
  };

  /**
   * 转换为JSON
   */
  toJSON() {
    const metadata = this.metadata ? JSON.parse(this.metadata) : {};
    const sharedWith = this.shared_with ? JSON.parse(this.shared_with) : [];

    return {
      _id: this._id,
      id: this._id,
      title: this.title,
      content: this.content,
      type: this.type,
      tags: this.tags,
      category_id: this.category_id,
      color: this.color,
      is_favorite: this.is_favorite,
      is_archived: this.is_archived,
      is_deleted: this.is_deleted,
      is_synced: this.is_synced,
      created_at: this.created_at,
      updated_at: this.updated_at,
      deleted_at: this.deleted_at,
      user_id: this.user_id,
      metadata: metadata,
      file_path: this.file_path,
      file_size: this.file_size,
      file_type: this.file_type,
      thumbnail_path: this.thumbnail_path,
      shared_with: sharedWith,
      version: this.version,
      parent_id: this.parent_id,
    };
  }

  /**
   * 软删除
   * @param {Realm} realm Realm实例
   */
  softDelete(realm) {
    realm.write(() => {
      this.is_deleted = true;
      this.deleted_at = new Date();
      this.updated_at = new Date();
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
      this.deleted_at = null;
      this.updated_at = new Date();
    });
    return this;
  }

  /**
   * 归档
   * @param {Realm} realm Realm实例
   */
  archive(realm) {
    realm.write(() => {
      this.is_archived = true;
      this.updated_at = new Date();
    });
    return this;
  }

  /**
   * 取消归档
   * @param {Realm} realm Realm实例
   */
  unarchive(realm) {
    realm.write(() => {
      this.is_archived = false;
      this.updated_at = new Date();
    });
    return this;
  }

  /**
   * 收藏
   * @param {Realm} realm Realm实例
   */
  favorite(realm) {
    realm.write(() => {
      this.is_favorite = true;
      this.updated_at = new Date();
    });
    return this;
  }

  /**
   * 取消收藏
   * @param {Realm} realm Realm实例
   */
  unfavorite(realm) {
    realm.write(() => {
      this.is_favorite = false;
      this.updated_at = new Date();
    });
    return this;
  }

  /**
   * 添加标签
   * @param {Realm} realm Realm实例
   * @param {string} tag 标签
   */
  addTag(realm, tag) {
    if (!this.tags.includes(tag)) {
      realm.write(() => {
        this.tags.push(tag);
        this.updated_at = new Date();
      });
    }
    return this;
  }

  /**
   * 移除标签
   * @param {Realm} realm Realm实例
   * @param {string} tag 标签
   */
  removeTag(realm, tag) {
    realm.write(() => {
      this.tags = this.tags.filter(t => t !== tag);
      this.updated_at = new Date();
    });
    return this;
  }

  /**
   * 分享给用户
   * @param {Realm} realm Realm实例
   * @param {string} userId 用户ID
   * @param {string} permission 权限
   */
  shareWith(realm, userId, permission = 'read') {
    realm.write(() => {
      const sharedWith = this.shared_with ? JSON.parse(this.shared_with) : [];
      const existingShareIndex = sharedWith.findIndex(s => s.user_id === userId);

      if (existingShareIndex >= 0) {
        sharedWith[existingShareIndex].permission = permission;
      } else {
        sharedWith.push({
          user_id: userId,
          permission,
          shared_at: new Date().toISOString(),
        });
      }

      this.shared_with = JSON.stringify(sharedWith);
      this.updated_at = new Date();
    });

    return this;
  }

  /**
   * 取消分享
   * @param {Realm} realm Realm实例
   * @param {string} userId 用户ID
   */
  unshare(realm, userId) {
    realm.write(() => {
      const sharedWith = this.shared_with ? JSON.parse(this.shared_with) : [];
      this.shared_with = JSON.stringify(sharedWith.filter(s => s.user_id !== userId));
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
    return realm.objectForPrimaryKey('Note', id);
  }

  /**
   * 静态方法 - 查找用户的笔记
   * @param {Realm} realm Realm实例
   * @param {string} userId 用户ID
   * @param {Object} options 选项
   */
  static findByUser(realm, userId, options = {}) {
    const {
      is_deleted = false,
      is_archived = false,
      is_favorite = null,
      category_id = null,
      type = null,
      tags = null,
      search = null,
    } = options;

    let query = `user_id = "${userId}" AND is_deleted = ${is_deleted}`;

    if (is_archived !== null) {
      query += ` AND is_archived = ${is_archived}`;
    }

    if (is_favorite !== null) {
      query += ` AND is_favorite = ${is_favorite}`;
    }

    if (category_id) {
      query += ` AND category_id = "${category_id}"`;
    }

    if (type) {
      query += ` AND type = "${type}"`;
    }

    if (tags) {
      // 在Realm中处理数组包含查询比较复杂，这里简化处理
      const tagArray = Array.isArray(tags) ? tags : [tags];
      const tagQueries = tagArray.map(tag => `tags CONTAINS "${tag}"`).join(' OR ');
      if (tagQueries) {
        query += ` AND (${tagQueries})`;
      }
    }

    // 注意：Realm不支持全文搜索，这里简化为包含查询
    if (search) {
      query += ` AND (title CONTAINS[c] "${search}" OR content CONTAINS[c] "${search}")`;
    }

    let results = realm.objects('Note').filtered(query);

    // 排序
    if (options.sort) {
      const sortField = Object.keys(options.sort)[0];
      const sortOrder = options.sort[sortField] === -1;
      results = results.sorted(sortField, sortOrder);
    } else {
      results = results.sorted('updated_at', true);
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
   * 静态方法 - 查找已删除的笔记
   * @param {Realm} realm Realm实例
   * @param {string} userId 用户ID
   * @param {Object} options 选项
   */
  static findDeleted(realm, userId, options = {}) {
    let results = realm.objects('Note')
      .filtered(`user_id = "${userId}" AND is_deleted = true`)
      .sorted('deleted_at', true);

    // 分页
    if (options.skip !== undefined && options.limit !== undefined) {
      const skip = options.skip || 0;
      const limit = options.limit || 20;
      results = Array.from(results).slice(skip, skip + limit);
    }

    return results;
  }

  /**
   * 静态方法 - 查找已归档的笔记
   * @param {Realm} realm Realm实例
   * @param {string} userId 用户ID
   * @param {Object} options 选项
   */
  static findArchived(realm, userId, options = {}) {
    let results = realm.objects('Note')
      .filtered(`user_id = "${userId}" AND is_archived = true AND is_deleted = false`)
      .sorted('updated_at', true);

    // 分页
    if (options.skip !== undefined && options.limit !== undefined) {
      const skip = options.skip || 0;
      const limit = options.limit || 20;
      results = Array.from(results).slice(skip, skip + limit);
    }

    return results;
  }

  /**
   * 静态方法 - 查找收藏的笔记
   * @param {Realm} realm Realm实例
   * @param {string} userId 用户ID
   * @param {Object} options 选项
   */
  static findFavorites(realm, userId, options = {}) {
    let results = realm.objects('Note')
      .filtered(`user_id = "${userId}" AND is_favorite = true AND is_deleted = false`)
      .sorted('updated_at', true);

    // 分页
    if (options.skip !== undefined && options.limit !== undefined) {
      const skip = options.skip || 0;
      const limit = options.limit || 20;
      results = Array.from(results).slice(skip, skip + limit);
    }

    return results;
  }

  /**
   * 静态方法 - 搜索笔记
   * @param {Realm} realm Realm实例
   * @param {string} userId 用户ID
   * @param {string} searchText 搜索关键词
   * @param {Object} options 选项
   */
  static search(realm, userId, searchText, options = {}) {
    const {
      is_deleted = false,
      is_archived = false,
    } = options;

    // 注意：Realm不支持全文搜索，这里简化为包含查询
    let query = `user_id = "${userId}" AND is_deleted = ${is_deleted} AND is_archived = ${is_archived}`;
    query += ` AND (title CONTAINS[c] "${searchText}" OR content CONTAINS[c] "${searchText}")`;

    let results = realm.objects('Note').filtered(query).sorted('updated_at', true);

    // 分页
    if (options.skip !== undefined && options.limit !== undefined) {
      const skip = options.skip || 0;
      const limit = options.limit || 20;
      results = Array.from(results).slice(skip, skip + limit);
    }

    return results;
  }
}

export default Note;
