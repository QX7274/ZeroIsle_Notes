/**
 * 思维导图模型 - Realm版本
 */

import Realm from 'realm';

/**
 * 思维导图模型定义
 */
class MindMap extends Realm.Object {
  static schema = {
    name: 'MindMap',
    primaryKey: '_id',
    properties: {
      _id: 'string',
      title: 'string',
      description: { type: 'string', default: '' },
      type: { type: 'string', default: 'personal' }, // 'personal', 'shared', 'template', 'system'
      thumbnail: { type: 'string', default: '' },
      settings: { type: 'string', default: '{}' }, // 存储为JSON字符串
      note_id: { type: 'string', optional: true },
      user_id: 'string',
      category_id: { type: 'string', optional: true },
      tags: { type: 'string[]', default: [] },
      shared_with: { type: 'string', default: '[]' }, // 存储为JSON字符串
      is_favorite: { type: 'bool', default: false },
      is_deleted: { type: 'bool', default: false },
      is_synced: { type: 'bool', default: false },
      created_at: 'date',
      updated_at: 'date',
      deleted_at: { type: 'date', optional: true },
      last_opened_at: { type: 'date', optional: true },
      metadata: { type: 'string', default: '{}' }, // 存储为JSON字符串
    },
  };

  /**
   * 转换为JSON
   */
  toJSON() {
    // 解析JSON字符串
    const settings = this.settings ? JSON.parse(this.settings) : {};
    const sharedWith = this.shared_with ? JSON.parse(this.shared_with) : [];
    const metadata = this.metadata ? JSON.parse(this.metadata) : {};

    return {
      _id: this._id,
      id: this._id,
      title: this.title,
      description: this.description,
      type: this.type,
      thumbnail: this.thumbnail,
      settings: settings,
      note_id: this.note_id,
      user_id: this.user_id,
      category_id: this.category_id,
      tags: this.tags,
      shared_with: sharedWith,
      is_favorite: this.is_favorite,
      is_deleted: this.is_deleted,
      is_synced: this.is_synced,
      created_at: this.created_at,
      updated_at: this.updated_at,
      deleted_at: this.deleted_at,
      last_opened_at: this.last_opened_at,
      metadata: metadata,
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
   * 更新设置
   * @param {Realm} realm Realm实例
   * @param {Object} settings 设置对象
   */
  updateSettings(realm, settings) {
    realm.write(() => {
      // 解析当前设置
      const currentSettings = this.settings ? JSON.parse(this.settings) : {};

      // 合并设置
      const newSettings = {
        ...currentSettings,
        ...settings,
      };

      // 保存为JSON字符串
      this.settings = JSON.stringify(newSettings);
      this.updated_at = new Date();
    });

    return this;
  }

  /**
   * 更新视口
   * @param {Realm} realm Realm实例
   * @param {number} x X坐标
   * @param {number} y Y坐标
   * @param {number} zoom 缩放比例
   */
  updateViewport(realm, x, y, zoom) {
    realm.write(() => {
      // 解析当前设置
      const currentSettings = this.settings ? JSON.parse(this.settings) : {};

      // 更新视口
      currentSettings.viewport = {
        ...(currentSettings.viewport || {}),
        x,
        y,
        zoom,
      };

      // 保存为JSON字符串
      this.settings = JSON.stringify(currentSettings);
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
      // 解析当前分享列表
      const sharedWith = this.shared_with ? JSON.parse(this.shared_with) : [];

      // 查找现有分享
      const existingShareIndex = sharedWith.findIndex(s => s.user_id === userId);

      if (existingShareIndex >= 0) {
        // 更新权限
        sharedWith[existingShareIndex].permission = permission;
      } else {
        // 添加新分享
        sharedWith.push({
          user_id: userId,
          permission,
          shared_at: new Date().toISOString(),
        });
      }

      // 保存为JSON字符串
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
      // 解析当前分享列表
      const sharedWith = this.shared_with ? JSON.parse(this.shared_with) : [];

      // 过滤掉指定用户
      const newSharedWith = sharedWith.filter(s => s.user_id !== userId);

      // 保存为JSON字符串
      this.shared_with = JSON.stringify(newSharedWith);
      this.updated_at = new Date();
    });

    return this;
  }

  /**
   * 更新最后打开时间
   * @param {Realm} realm Realm实例
   */
  updateLastOpenedAt(realm) {
    realm.write(() => {
      this.last_opened_at = new Date();
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
   * 获取节点数量
   * @param {Realm} realm Realm实例
   */
  getNodeCount(realm) {
    return realm.objects('MindMapNode')
      .filtered(`mind_map_id = "${this._id}" AND is_deleted = false`)
      .length;
  }

  /**
   * 静态方法 - 根据ID查找
   * @param {Realm} realm Realm实例
   * @param {string} id ID
   */
  static findById(realm, id) {
    return realm.objectForPrimaryKey('MindMap', id);
  }

  /**
   * 静态方法 - 查找用户的思维导图
   * @param {Realm} realm Realm实例
   * @param {string} userId 用户ID
   * @param {Object} options 选项
   */
  static findByUser(realm, userId, options = {}) {
    const {
      is_deleted = false,
      is_favorite = null,
      type = null,
      category_id = null,
      tags = null,
      search = null,
    } = options;

    let query = `user_id = "${userId}" AND is_deleted = ${is_deleted}`;

    if (is_favorite !== null) {
      query += ` AND is_favorite = ${is_favorite}`;
    }

    if (type) {
      query += ` AND type = "${type}"`;
    }

    if (category_id) {
      query += ` AND category_id = "${category_id}"`;
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
      query += ` AND (title CONTAINS[c] "${search}" OR description CONTAINS[c] "${search}")`;
    }

    let results = realm.objects('MindMap').filtered(query);

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
   * 静态方法 - 查找笔记的思维导图
   * @param {Realm} realm Realm实例
   * @param {string} noteId 笔记ID
   */
  static findByNote(realm, noteId) {
    return realm.objects('MindMap')
      .filtered(`note_id = "${noteId}" AND is_deleted = false`);
  }

  /**
   * 静态方法 - 查找分享给用户的思维导图
   * @param {Realm} realm Realm实例
   * @param {string} userId 用户ID
   * @param {Object} options 选项
   */
  static findSharedWithUser(realm, userId, options = {}) {
    const { permission = null } = options;

    // 获取所有未删除的思维导图
    let results = realm.objects('MindMap').filtered('is_deleted = false');

    // 过滤分享给指定用户的思维导图
    results = Array.from(results).filter(mindMap => {
      try {
        const sharedWith = JSON.parse(mindMap.shared_with || '[]');
        const share = sharedWith.find(s => s.user_id === userId);

        if (!share) return false;

        // 如果指定了权限，检查权限
        if (permission && share.permission !== permission) {
          return false;
        }

        return true;
      } catch (e) {
        return false;
      }
    });

    // 排序
    if (options.sort) {
      const sortField = Object.keys(options.sort)[0];
      const sortDirection = options.sort[sortField] === -1;
      results.sort((a, b) => {
        if (sortDirection) {
          return b[sortField] > a[sortField] ? 1 : -1;
        } else {
          return a[sortField] > b[sortField] ? 1 : -1;
        }
      });
    } else {
      results.sort((a, b) => b.updated_at - a.updated_at);
    }

    // 分页
    if (options.skip !== undefined && options.limit !== undefined) {
      const skip = options.skip || 0;
      const limit = options.limit || 20;
      results = results.slice(skip, skip + limit);
    }

    return results;
  }

  /**
   * 静态方法 - 查找最近使用的思维导图
   * @param {Realm} realm Realm实例
   * @param {string} userId 用户ID
   * @param {number} limit 限制数量
   */
  static findRecent(realm, userId, limit = 5) {
    const results = realm.objects('MindMap')
      .filtered(`user_id = "${userId}" AND is_deleted = false AND last_opened_at != null`)
      .sorted('last_opened_at', true);

    return Array.from(results).slice(0, limit);
  }

  /**
   * 静态方法 - 搜索思维导图
   * @param {Realm} realm Realm实例
   * @param {string} userId 用户ID
   * @param {string} searchText 搜索关键词
   * @param {Object} options 选项
   */
  static search(realm, userId, searchText, options = {}) {
    const { is_deleted = false } = options;

    const query = `user_id = "${userId}" AND is_deleted = ${is_deleted} AND (title CONTAINS[c] "${searchText}" OR description CONTAINS[c] "${searchText}")`;

    let results = realm.objects('MindMap').filtered(query);

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

  /**
   * 静态方法 - 创建思维导图副本
   * @param {Realm} realm Realm实例
   * @param {string} mindMapId 思维导图ID
   * @param {string} userId 用户ID
   * @param {Object} overrides 覆盖属性
   */
  static createCopy(realm, mindMapId, userId, overrides = {}) {
    // 查找原思维导图
    const mindMap = this.findById(realm, mindMapId);

    if (!mindMap) {
      throw new Error(`未找到ID为${mindMapId}的思维导图`);
    }

    // 解析设置和元数据
    const settings = mindMap.settings ? JSON.parse(mindMap.settings) : {};
    const metadata = mindMap.metadata ? JSON.parse(mindMap.metadata) : {};

    // 创建思维导图副本
    let newMindMap;
    realm.write(() => {
      newMindMap = realm.create('MindMap', {
        _id: new Realm.BSON.ObjectId().toHexString(),
        title: `${mindMap.title} - 副本`,
        description: mindMap.description,
        type: 'personal',
        settings: JSON.stringify(settings),
        user_id: userId,
        category_id: mindMap.category_id,
        tags: [...mindMap.tags],
        shared_with: '[]',
        is_favorite: false,
        is_deleted: false,
        is_synced: false,
        created_at: new Date(),
        updated_at: new Date(),
        metadata: JSON.stringify(metadata),
        ...overrides,
      });
    });

    // 复制节点
    const nodes = realm.objects('MindMapNode')
      .filtered(`mind_map_id = "${mindMapId}" AND is_deleted = false`);

    // 节点ID映射
    const nodeIdMap = {};

    // 创建新节点
    realm.write(() => {
      Array.from(nodes).forEach(node => {
        const nodeMetadata = node.metadata ? JSON.parse(node.metadata) : {};

        const newNode = realm.create('MindMapNode', {
          _id: new Realm.BSON.ObjectId().toHexString(),
          mind_map_id: newMindMap._id,
          text: node.text,
          note: node.note,
          style: node.style,
          position: node.position,
          expanded: node.expanded,
          user_id: userId,
          metadata: JSON.stringify(nodeMetadata),
          created_at: new Date(),
          updated_at: new Date(),
          is_deleted: false,
          is_synced: false,
        });

        // 记录节点ID映射
        nodeIdMap[node._id] = newNode._id;
      });
    });

    // 更新父子关系
    realm.write(() => {
      Array.from(nodes).forEach(node => {
        if (node.parent_id) {
          const newNodeId = nodeIdMap[node._id];
          const newParentId = nodeIdMap[node.parent_id];

          if (newNodeId && newParentId) {
            const newNode = realm.objectForPrimaryKey('MindMapNode', newNodeId);
            if (newNode) {
              newNode.parent_id = newParentId;
            }
          }
        }
      });
    });

    return newMindMap;
  }
}

export default MindMap;
