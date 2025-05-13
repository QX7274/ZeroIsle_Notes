/**
 * 文件模型 - Realm版本
 */

import Realm from 'realm';

/**
 * 文件模型定义
 */
class File extends Realm.Object {
  static schema = {
    name: 'File',
    primaryKey: '_id',
    properties: {
      _id: 'string',
      name: 'string',
      original_name: 'string',
      path: 'string',
      size: 'int',
      mime_type: 'string',
      extension: 'string',
      type: 'string', // 'image', 'document', 'audio', 'video', 'archive', 'other'
      hash: { type: 'string', optional: true },
      thumbnail_path: { type: 'string', optional: true },
      metadata: { type: 'string', default: '{}' }, // 存储为JSON字符串
      storage_location: { type: 'string', default: 'local' }, // 'local', 'cloud', 'both'
      cloud_path: { type: 'string', optional: true },
      cloud_provider: { type: 'string', optional: true }, // 'aws', 'gcp', 'azure', 'mongodb', 'other'
      user_id: 'string',
      note_id: { type: 'string', optional: true },
      is_deleted: { type: 'bool', default: false },
      is_synced: { type: 'bool', default: false },
      created_at: 'date',
      updated_at: 'date',
      deleted_at: { type: 'date', optional: true },
      last_accessed_at: { type: 'date', optional: true },
      is_public: { type: 'bool', default: false },
      public_url: { type: 'string', optional: true },
      expiry_date: { type: 'date', optional: true },
      tags: { type: 'string[]', default: [] },
    },
  };

  /**
   * 转换为JSON
   */
  toJSON() {
    // 解析JSON字符串
    const metadata = this.metadata ? JSON.parse(this.metadata) : {};

    return {
      _id: this._id,
      id: this._id,
      name: this.name,
      original_name: this.original_name,
      path: this.path,
      size: this.size,
      mime_type: this.mime_type,
      extension: this.extension,
      type: this.type,
      hash: this.hash,
      thumbnail_path: this.thumbnail_path,
      metadata: metadata,
      storage_location: this.storage_location,
      cloud_path: this.cloud_path,
      cloud_provider: this.cloud_provider,
      user_id: this.user_id,
      note_id: this.note_id,
      is_deleted: this.is_deleted,
      is_synced: this.is_synced,
      created_at: this.created_at,
      updated_at: this.updated_at,
      deleted_at: this.deleted_at,
      last_accessed_at: this.last_accessed_at,
      is_public: this.is_public,
      public_url: this.public_url,
      expiry_date: this.expiry_date,
      tags: this.tags,
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
   * 更新访问时间
   * @param {Realm} realm Realm实例
   */
  updateAccessTime(realm) {
    realm.write(() => {
      this.last_accessed_at = new Date();
    });

    return this;
  }

  /**
   * 更新元数据
   * @param {Realm} realm Realm实例
   * @param {Object} metadata 元数据
   */
  updateMetadata(realm, metadata) {
    realm.write(() => {
      // 解析当前元数据
      const currentMetadata = this.metadata ? JSON.parse(this.metadata) : {};

      // 合并元数据
      const newMetadata = {
        ...currentMetadata,
        ...metadata,
      };

      // 保存为JSON字符串
      this.metadata = JSON.stringify(newMetadata);
      this.updated_at = new Date();
    });

    return this;
  }

  /**
   * 更新云存储信息
   * @param {Realm} realm Realm实例
   * @param {string} cloudPath 云存储路径
   * @param {string} cloudProvider 云存储提供商
   */
  updateCloudStorage(realm, cloudPath, cloudProvider) {
    realm.write(() => {
      this.cloud_path = cloudPath;
      this.cloud_provider = cloudProvider;
      this.storage_location = this.path ? 'both' : 'cloud';
      this.updated_at = new Date();
    });

    return this;
  }

  /**
   * 更新本地存储信息
   * @param {Realm} realm Realm实例
   * @param {string} path 本地路径
   */
  updateLocalStorage(realm, path) {
    realm.write(() => {
      this.path = path;
      this.storage_location = this.cloud_path ? 'both' : 'local';
      this.updated_at = new Date();
    });

    return this;
  }

  /**
   * 设置公开访问
   * @param {Realm} realm Realm实例
   * @param {boolean} isPublic 是否公开
   * @param {string} publicUrl 公开URL
   * @param {Date} expiryDate 过期日期
   */
  setPublicAccess(realm, isPublic, publicUrl = null, expiryDate = null) {
    realm.write(() => {
      this.is_public = isPublic;

      if (isPublic) {
        this.public_url = publicUrl;
        this.expiry_date = expiryDate;
      } else {
        this.public_url = null;
        this.expiry_date = null;
      }

      this.updated_at = new Date();
    });

    return this;
  }

  /**
   * 关联笔记
   * @param {Realm} realm Realm实例
   * @param {string} noteId 笔记ID
   */
  linkNote(realm, noteId) {
    realm.write(() => {
      this.note_id = noteId;
      this.updated_at = new Date();
    });

    return this;
  }

  /**
   * 取消关联笔记
   * @param {Realm} realm Realm实例
   */
  unlinkNote(realm) {
    realm.write(() => {
      this.note_id = null;
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
   * 更新缩略图
   * @param {Realm} realm Realm实例
   * @param {string} thumbnailPath 缩略图路径
   */
  updateThumbnail(realm, thumbnailPath) {
    realm.write(() => {
      this.thumbnail_path = thumbnailPath;
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
    return realm.objectForPrimaryKey('File', id);
  }

  /**
   * 静态方法 - 查找用户的文件
   * @param {Realm} realm Realm实例
   * @param {string} userId 用户ID
   * @param {Object} options 选项
   */
  static findByUser(realm, userId, options = {}) {
    const {
      is_deleted = false,
      type = null,
      extension = null,
      tags = null,
      search = null,
    } = options;

    let query = `user_id = "${userId}" AND is_deleted = ${is_deleted}`;

    if (type) {
      query += ` AND type = "${type}"`;
    }

    if (extension) {
      query += ` AND extension = "${extension}"`;
    }

    if (tags) {
      // 在Realm中处理数组包含查询比较复杂，这里简化处理
      const tagArray = Array.isArray(tags) ? tags : [tags];
      const tagQueries = tagArray.map(tag => `tags CONTAINS "${tag}"`).join(' OR ');
      if (tagQueries) {
        query += ` AND (${tagQueries})`;
      }
    }

    if (search) {
      query += ` AND (name CONTAINS[c] "${search}" OR original_name CONTAINS[c] "${search}")`;
    }

    let results = realm.objects('File').filtered(query);

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
      const limit = options.limit || 50;
      results = Array.from(results).slice(skip, skip + limit);
    }

    return results;
  }

  /**
   * 静态方法 - 查找笔记的文件
   * @param {Realm} realm Realm实例
   * @param {string} noteId 笔记ID
   */
  static findByNote(realm, noteId) {
    return realm.objects('File')
      .filtered(`note_id = "${noteId}" AND is_deleted = false`)
      .sorted('created_at', true);
  }

  /**
   * 静态方法 - 根据哈希查找文件
   * @param {Realm} realm Realm实例
   * @param {string} hash 文件哈希
   * @param {string} userId 用户ID
   */
  static findByHash(realm, hash, userId = null) {
    let query = `hash = "${hash}" AND is_deleted = false`;

    if (userId) {
      query += ` AND user_id = "${userId}"`;
    }

    return realm.objects('File').filtered(query)[0];
  }

  /**
   * 静态方法 - 查找最近访问的文件
   * @param {Realm} realm Realm实例
   * @param {string} userId 用户ID
   * @param {number} limit 限制数量
   */
  static findRecentlyAccessed(realm, userId, limit = 10) {
    const results = realm.objects('File')
      .filtered(`user_id = "${userId}" AND is_deleted = false AND last_accessed_at != null`)
      .sorted('last_accessed_at', true);

    return Array.from(results).slice(0, limit);
  }

  /**
   * 静态方法 - 查找大文件
   * @param {Realm} realm Realm实例
   * @param {string} userId 用户ID
   * @param {number} minSize 最小大小（字节）
   * @param {number} limit 限制数量
   */
  static findLargeFiles(realm, userId, minSize = 1024 * 1024, limit = 10) {
    const results = realm.objects('File')
      .filtered(`user_id = "${userId}" AND is_deleted = false AND size >= ${minSize}`)
      .sorted('size', true);

    return Array.from(results).slice(0, limit);
  }

  /**
   * 静态方法 - 计算用户的存储使用量
   * @param {Realm} realm Realm实例
   * @param {string} userId 用户ID
   */
  static calculateStorageUsage(realm, userId) {
    const files = realm.objects('File')
      .filtered(`user_id = "${userId}" AND is_deleted = false`);

    let totalSize = 0;
    const count = files.length;

    Array.from(files).forEach(file => {
      totalSize += file.size;
    });

    return { totalSize, count };
  }

  /**
   * 静态方法 - 搜索文件
   * @param {Realm} realm Realm实例
   * @param {string} userId 用户ID
   * @param {string} searchText 搜索关键词
   * @param {Object} options 选项
   */
  static search(realm, userId, searchText, options = {}) {
    const { is_deleted = false } = options;

    const query = `user_id = "${userId}" AND is_deleted = ${is_deleted} AND (name CONTAINS[c] "${searchText}" OR original_name CONTAINS[c] "${searchText}")`;

    let results = realm.objects('File').filtered(query);

    // 排序 - 由于Realm不支持文本搜索评分，我们使用更新时间排序
    results = results.sorted('updated_at', true);

    // 分页
    if (options.skip !== undefined && options.limit !== undefined) {
      const skip = options.skip || 0;
      const limit = options.limit || 20;
      results = Array.from(results).slice(skip, skip + limit);
    }

    return results;
  }
}

export default File;
