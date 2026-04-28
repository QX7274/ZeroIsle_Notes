/**
 * 知识图谱模型 - Realm版本
 */

import Realm from 'realm';

/**
 * 知识图谱模型定义
 */
class KnowledgeGraph extends Realm.Object {
  static schema = {
    name: 'KnowledgeGraph',
    primaryKey: '_id',
    properties: {
      _id: 'string',
      title: 'string',
      description: { type: 'string', default: '' },
      type: { type: 'string', default: 'personal' }, // 'personal', 'shared', 'template', 'system'
      thumbnail: { type: 'string', default: '' },
      settings: { type: 'string', default: '{}' }, // 存储为JSON字符串
      user_id: 'string',
      category_id: { type: 'string', optional: true },
      tags: { type: 'list', objectType: 'string', default: [] },
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
   * 获取节点数量
   * @param {Realm} realm Realm实例
   */
  getNodeCount(realm) {
    return realm.objects('KnowledgeNode')
      .filtered(`graph_id = "${this._id}" AND is_deleted = false`)
      .length;
  }

  /**
   * 获取边数量
   * @param {Realm} realm Realm实例
   */
  getEdgeCount(realm) {
    return realm.objects('KnowledgeEdge')
      .filtered(`graph_id = "${this._id}" AND is_deleted = false`)
      .length;
  }

  /**
   * 获取统计信息
   * @param {Realm} realm Realm实例
   */
  getStats(realm) {
    const nodeCount = this.getNodeCount(realm);
    const edgeCount = this.getEdgeCount(realm);

    return {
      nodeCount,
      edgeCount,
      density: nodeCount > 1 ? (2 * edgeCount) / (nodeCount * (nodeCount - 1)) : 0,
    };
  }

  /**
   * 静态方法 - 根据ID查找
   * @param {Realm} realm Realm实例
   * @param {string} id ID
   */
  static findById(realm, id) {
    return realm.objectForPrimaryKey('KnowledgeGraph', id);
  }

  /**
   * 静态方法 - 查找用户的知识图谱
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

    let results = realm.objects('KnowledgeGraph').filtered(query);

    // 排序
    if (options.sort) {
      const sortField = Object.keys(options.sort)[0];
      const sortOrder = options.sort[sortField] === -1;
      results = results.sorted(sortField, sortOrder);
    } else {
      results = results.sorted('updated_at', true);
    }

    // 分页 (性能优化：先 slice 再 materialize)
    if (options.skip !== undefined || options.limit !== undefined) {
      const skip = options.skip || 0;
      const limit = options.limit || 20;
      results = results.slice(skip, skip + limit);
    }

    return results;
  }

  /**
   * 静态方法 - 查找分享给用户的知识图谱
   * @param {Realm} realm Realm实例
   * @param {string} userId 用户ID
   * @param {Object} options 选项
   */
  static findSharedWithUser(realm, userId, options = {}) {
    const { permission = null } = options;

    // 获取所有未删除的知识图谱
    let results = realm.objects('KnowledgeGraph').filtered('is_deleted = false');

    // 过滤分享给指定用户的知识图谱
    results = Array.from(results).filter(graph => {
      try {
        const sharedWith = JSON.parse(graph.shared_with || '[]');
        const share = sharedWith.find(s => s.user_id === userId);

        if (!share) {return false;}

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
   * 静态方法 - 查找最近使用的知识图谱
   * @param {Realm} realm Realm实例
   * @param {string} userId 用户ID
   * @param {number} limit 限制数量
   */
  static findRecent(realm, userId, limit = 5) {
    const results = realm.objects('KnowledgeGraph')
      .filtered(`user_id = "${userId}" AND is_deleted = false AND last_opened_at != null`)
      .sorted('last_opened_at', true);

    return Array.from(results).slice(0, limit);
  }

  /**
   * 静态方法 - 搜索知识图谱
   * @param {Realm} realm Realm实例
   * @param {string} userId 用户ID
   * @param {string} searchText 搜索关键词
   * @param {Object} options 选项
   */
  static search(realm, userId, searchText, options = {}) {
    const { is_deleted = false } = options;

    const query = `user_id = "${userId}" AND is_deleted = ${is_deleted} AND (title CONTAINS[c] "${searchText}" OR description CONTAINS[c] "${searchText}")`;

    let results = realm.objects('KnowledgeGraph').filtered(query);

    // 排序 - 由于Realm不支持文本搜索评分，我们使用更新时间排序
    results = results.sorted('updated_at', true);

    // 分页 (性能优化：先 slice 再 materialize)
    if (options.skip !== undefined || options.limit !== undefined) {
      const skip = options.skip || 0;
      const limit = options.limit || 20;
      results = results.slice(skip, skip + limit);
    }

    return results;
  }

  /**
   * 静态方法 - 创建知识图谱副本
   * @param {Realm} realm Realm实例
   * @param {string} graphId 图谱ID
   * @param {string} userId 用户ID
   * @param {Object} overrides 覆盖属性
   */
  static createCopy(realm, graphId, userId, overrides = {}) {
    // 查找原图谱
    const graph = this.findById(realm, graphId);

    if (!graph) {
      throw new Error(`未找到ID为${graphId}的知识图谱`);
    }

    // 解析设置和元数据
    const settings = graph.settings ? JSON.parse(graph.settings) : {};
    const metadata = graph.metadata ? JSON.parse(graph.metadata) : {};

    // 创建图谱副本
    let newGraph;
    realm.write(() => {
      newGraph = realm.create('KnowledgeGraph', {
        _id: new Realm.BSON.ObjectId().toHexString(),
        title: `${graph.title} - 副本`,
        description: graph.description,
        type: 'personal',
        settings: JSON.stringify(settings),
        user_id: userId,
        category_id: graph.category_id,
        tags: [...graph.tags],
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

    // 复制节点和边
    const nodes = realm.objects('KnowledgeNode')
      .filtered(`graph_id = "${graphId}" AND is_deleted = false`);

    // 节点ID映射
    const nodeIdMap = {};

    // 创建新节点
    realm.write(() => {
      Array.from(nodes).forEach(node => {
        const nodeMetadata = node.metadata ? JSON.parse(node.metadata) : {};

        const newNode = realm.create('KnowledgeNode', {
          _id: new Realm.BSON.ObjectId().toHexString(),
          graph_id: newGraph._id,
          title: node.title,
          content: node.content,
          type: node.type,
          position: node.position,
          size: node.size,
          color: node.color,
          icon: node.icon,
          image: node.image,
          note_id: node.note_id,
          metadata: JSON.stringify(nodeMetadata),
          user_id: userId,
          created_at: new Date(),
          updated_at: new Date(),
          is_deleted: false,
          is_synced: false,
        });

        // 记录节点ID映射
        nodeIdMap[node._id] = newNode._id;
      });
    });

    // 获取原图谱的边
    const edges = realm.objects('KnowledgeEdge')
      .filtered(`graph_id = "${graphId}" AND is_deleted = false`);

    // 创建新边
    realm.write(() => {
      Array.from(edges).forEach(edge => {
        // 检查源节点和目标节点是否存在
        const sourceId = nodeIdMap[edge.source_id];
        const targetId = nodeIdMap[edge.target_id];

        if (sourceId && targetId) {
          const edgeMetadata = edge.metadata ? JSON.parse(edge.metadata) : {};

          realm.create('KnowledgeEdge', {
            _id: new Realm.BSON.ObjectId().toHexString(),
            graph_id: newGraph._id,
            source_id: sourceId,
            target_id: targetId,
            label: edge.label,
            type: edge.type,
            description: edge.description,
            weight: edge.weight,
            style: edge.style,
            metadata: JSON.stringify(edgeMetadata),
            user_id: userId,
            created_at: new Date(),
            updated_at: new Date(),
            is_deleted: false,
            is_synced: false,
          });
        }
      });
    });

    return newGraph;
  }
}

export default KnowledgeGraph;
