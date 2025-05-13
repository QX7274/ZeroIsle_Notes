/**
 * 知识边模型 - Realm版本
 */

import Realm from 'realm';

/**
 * 知识边模型定义
 */
class KnowledgeEdge extends Realm.Object {
  static schema = {
    name: 'KnowledgeEdge',
    primaryKey: '_id',
    properties: {
      _id: 'string',
      source_id: 'string',
      target_id: 'string',
      type: { type: 'string', default: 'related' }, // 'related', 'causes', 'supports', 'contradicts', 'includes', 'precedes', 'follows', 'references', 'custom'
      label: { type: 'string', default: '' },
      description: { type: 'string', default: '' },
      weight: { type: 'float', default: 1 },
      style: { type: 'string', default: '{"color":"#666666","width":1,"dashed":false,"arrow":true,"bidirectional":false}' }, // 存储为JSON字符串
      user_id: 'string',
      graph_id: 'string',
      metadata: { type: 'string', default: '{}' }, // 存储为JSON字符串
      is_deleted: { type: 'bool', default: false },
      is_synced: { type: 'bool', default: false },
      created_at: 'date',
      updated_at: 'date',
      deleted_at: { type: 'date', optional: true },
    },
  };

  /**
   * 转换为JSON
   */
  toJSON() {
    // 解析JSON字符串
    const style = this.style ? JSON.parse(this.style) : { color: '#666666', width: 1, dashed: false, arrow: true, bidirectional: false };
    const metadata = this.metadata ? JSON.parse(this.metadata) : {};

    return {
      _id: this._id,
      id: this._id,
      source_id: this.source_id,
      target_id: this.target_id,
      type: this.type,
      label: this.label,
      description: this.description,
      weight: this.weight,
      style: style,
      user_id: this.user_id,
      graph_id: this.graph_id,
      metadata: metadata,
      is_deleted: this.is_deleted,
      is_synced: this.is_synced,
      created_at: this.created_at,
      updated_at: this.updated_at,
      deleted_at: this.deleted_at,
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
   * 更新标签
   * @param {Realm} realm Realm实例
   * @param {string} label 标签
   */
  updateLabel(realm, label) {
    realm.write(() => {
      this.label = label;
      this.updated_at = new Date();
    });

    return this;
  }

  /**
   * 更新描述
   * @param {Realm} realm Realm实例
   * @param {string} description 描述
   */
  updateDescription(realm, description) {
    realm.write(() => {
      this.description = description;
      this.updated_at = new Date();
    });

    return this;
  }

  /**
   * 更新权重
   * @param {Realm} realm Realm实例
   * @param {number} weight 权重
   */
  updateWeight(realm, weight) {
    realm.write(() => {
      this.weight = Math.min(10, Math.max(0, weight));
      this.updated_at = new Date();
    });

    return this;
  }

  /**
   * 更新样式
   * @param {Realm} realm Realm实例
   * @param {Object} style 样式对象
   */
  updateStyle(realm, style) {
    realm.write(() => {
      // 解析当前样式
      const currentStyle = this.style ? JSON.parse(this.style) : { color: '#666666', width: 1, dashed: false, arrow: true, bidirectional: false };

      // 合并样式
      const newStyle = {
        ...currentStyle,
        ...style,
      };

      // 保存为JSON字符串
      this.style = JSON.stringify(newStyle);
      this.updated_at = new Date();
    });

    return this;
  }

  /**
   * 更新类型
   * @param {Realm} realm Realm实例
   * @param {string} type 类型
   */
  updateType(realm, type) {
    realm.write(() => {
      this.type = type;
      this.updated_at = new Date();
    });

    return this;
  }

  /**
   * 反转方向
   * @param {Realm} realm Realm实例
   */
  reverse(realm) {
    realm.write(() => {
      const temp = this.source_id;
      this.source_id = this.target_id;
      this.target_id = temp;
      this.updated_at = new Date();
    });

    return this;
  }

  /**
   * 设置双向
   * @param {Realm} realm Realm实例
   * @param {boolean} bidirectional 是否双向
   */
  setBidirectional(realm, bidirectional = true) {
    realm.write(() => {
      // 解析当前样式
      const currentStyle = this.style ? JSON.parse(this.style) : { color: '#666666', width: 1, dashed: false, arrow: true, bidirectional: false };

      // 更新双向属性
      currentStyle.bidirectional = bidirectional;

      // 保存为JSON字符串
      this.style = JSON.stringify(currentStyle);
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
    return realm.objectForPrimaryKey('KnowledgeEdge', id);
  }

  /**
   * 静态方法 - 查找用户的知识边
   * @param {Realm} realm Realm实例
   * @param {string} userId 用户ID
   * @param {Object} options 选项
   */
  static findByUser(realm, userId, options = {}) {
    const {
      is_deleted = false,
      type = null,
      graph_id = null,
    } = options;

    let query = `user_id = "${userId}" AND is_deleted = ${is_deleted}`;

    if (type) {
      query += ` AND type = "${type}"`;
    }

    if (graph_id) {
      query += ` AND graph_id = "${graph_id}"`;
    }

    let results = realm.objects('KnowledgeEdge').filtered(query);

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
      const limit = options.limit || 1000;
      results = Array.from(results).slice(skip, skip + limit);
    }

    return results;
  }

  /**
   * 静态方法 - 查找图谱的知识边
   * @param {Realm} realm Realm实例
   * @param {string} graphId 图谱ID
   * @param {Object} options 选项
   */
  static findByGraph(realm, graphId, options = {}) {
    const {
      is_deleted = false,
      type = null,
    } = options;

    let query = `graph_id = "${graphId}" AND is_deleted = ${is_deleted}`;

    if (type) {
      query += ` AND type = "${type}"`;
    }

    let results = realm.objects('KnowledgeEdge').filtered(query);

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
      const limit = options.limit || 5000;
      results = Array.from(results).slice(skip, skip + limit);
    }

    return results;
  }

  /**
   * 静态方法 - 查找节点的知识边
   * @param {Realm} realm Realm实例
   * @param {string} nodeId 节点ID
   * @param {boolean} asSource 作为源节点
   * @param {boolean} asTarget 作为目标节点
   */
  static findByNode(realm, nodeId, asSource = true, asTarget = true) {
    let query = 'is_deleted = false';

    if (asSource && asTarget) {
      query += ` AND (source_id = "${nodeId}" OR target_id = "${nodeId}")`;
    } else if (asSource) {
      query += ` AND source_id = "${nodeId}"`;
    } else if (asTarget) {
      query += ` AND target_id = "${nodeId}"`;
    }

    return realm.objects('KnowledgeEdge').filtered(query);
  }

  /**
   * 静态方法 - 查找两个节点之间的知识边
   * @param {Realm} realm Realm实例
   * @param {string} sourceId 源节点ID
   * @param {string} targetId 目标节点ID
   * @param {boolean} bidirectional 是否考虑双向
   */
  static findBetweenNodes(realm, sourceId, targetId, bidirectional = true) {
    let query = 'is_deleted = false';

    if (bidirectional) {
      query += ` AND ((source_id = "${sourceId}" AND target_id = "${targetId}") OR (source_id = "${targetId}" AND target_id = "${sourceId}"))`;
    } else {
      query += ` AND source_id = "${sourceId}" AND target_id = "${targetId}"`;
    }

    return realm.objects('KnowledgeEdge').filtered(query);
  }

  /**
   * 静态方法 - 检查两个节点之间是否存在知识边
   * @param {Realm} realm Realm实例
   * @param {string} sourceId 源节点ID
   * @param {string} targetId 目标节点ID
   * @param {boolean} bidirectional 是否考虑双向
   */
  static existsBetweenNodes(realm, sourceId, targetId, bidirectional = true) {
    const edges = this.findBetweenNodes(realm, sourceId, targetId, bidirectional);
    return edges.length > 0;
  }

  /**
   * 静态方法 - 获取节点的相邻节点
   * @param {Realm} realm Realm实例
   * @param {string} nodeId 节点ID
   * @param {boolean} outgoing 是否考虑出边
   * @param {boolean} incoming 是否考虑入边
   */
  static getNeighborNodeIds(realm, nodeId, outgoing = true, incoming = true) {
    const edges = this.findByNode(realm, nodeId, outgoing, incoming);

    const neighborIds = new Set();

    Array.from(edges).forEach(edge => {
      if (outgoing && edge.source_id === nodeId) {
        neighborIds.add(edge.target_id);
      }

      if (incoming && edge.target_id === nodeId) {
        neighborIds.add(edge.source_id);
      }
    });

    return Array.from(neighborIds);
  }
}

export default KnowledgeEdge;
