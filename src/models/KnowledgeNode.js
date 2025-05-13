/**
 * 知识节点模型 - Realm版本
 */

import Realm from 'realm';

/**
 * 知识节点模型定义
 */
class KnowledgeNode extends Realm.Object {
  static schema = {
    name: 'KnowledgeNode',
    primaryKey: '_id',
    properties: {
      _id: 'string',
      title: 'string',
      content: { type: 'string', default: '' },
      type: { type: 'string', default: 'concept' }, // 'concept', 'fact', 'question', 'resource', 'note', 'custom'
      position: { type: 'string', default: '{"x":0,"y":0}' }, // 存储为JSON字符串
      size: { type: 'string', default: '{"width":200,"height":100}' }, // 存储为JSON字符串
      color: { type: 'string', default: '#2196F3' },
      icon: { type: 'string', default: '' },
      image: { type: 'string', default: '' },
      note_id: { type: 'string', optional: true },
      user_id: 'string',
      graph_id: 'string',
      tags: { type: 'string[]', default: [] },
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
    const position = this.position ? JSON.parse(this.position) : { x: 0, y: 0 };
    const size = this.size ? JSON.parse(this.size) : { width: 200, height: 100 };
    const metadata = this.metadata ? JSON.parse(this.metadata) : {};

    return {
      _id: this._id,
      id: this._id,
      title: this.title,
      content: this.content,
      type: this.type,
      position: position,
      size: size,
      color: this.color,
      icon: this.icon,
      image: this.image,
      note_id: this.note_id,
      user_id: this.user_id,
      graph_id: this.graph_id,
      tags: this.tags,
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
   * 更新位置
   * @param {Realm} realm Realm实例
   * @param {number} x X坐标
   * @param {number} y Y坐标
   */
  updatePosition(realm, x, y) {
    realm.write(() => {
      this.position = JSON.stringify({ x, y });
      this.updated_at = new Date();
    });

    return this;
  }

  /**
   * 更新大小
   * @param {Realm} realm Realm实例
   * @param {number} width 宽度
   * @param {number} height 高度
   */
  updateSize(realm, width, height) {
    realm.write(() => {
      this.size = JSON.stringify({ width, height });
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
      if (style.color) this.color = style.color;
      if (style.icon) this.icon = style.icon;
      if (style.image) this.image = style.image;
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
   * 静态方法 - 根据ID查找
   * @param {Realm} realm Realm实例
   * @param {string} id ID
   */
  static findById(realm, id) {
    return realm.objectForPrimaryKey('KnowledgeNode', id);
  }

  /**
   * 静态方法 - 查找用户的知识节点
   * @param {Realm} realm Realm实例
   * @param {string} userId 用户ID
   * @param {Object} options 选项
   */
  static findByUser(realm, userId, options = {}) {
    const {
      is_deleted = false,
      type = null,
      graph_id = null,
      search = null,
    } = options;

    let query = `user_id = "${userId}" AND is_deleted = ${is_deleted}`;

    if (type) {
      query += ` AND type = "${type}"`;
    }

    if (graph_id) {
      query += ` AND graph_id = "${graph_id}"`;
    }

    if (search) {
      query += ` AND (title CONTAINS[c] "${search}" OR content CONTAINS[c] "${search}")`;
    }

    let results = realm.objects('KnowledgeNode').filtered(query);

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
      const limit = options.limit || 100;
      results = Array.from(results).slice(skip, skip + limit);
    }

    return results;
  }

  /**
   * 静态方法 - 查找图谱的知识节点
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

    let results = realm.objects('KnowledgeNode').filtered(query);

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
   * 静态方法 - 查找笔记的知识节点
   * @param {Realm} realm Realm实例
   * @param {string} noteId 笔记ID
   */
  static findByNote(realm, noteId) {
    return realm.objects('KnowledgeNode')
      .filtered(`note_id = "${noteId}" AND is_deleted = false`);
  }

  /**
   * 静态方法 - 搜索知识节点
   * @param {Realm} realm Realm实例
   * @param {string} userId 用户ID
   * @param {string} searchText 搜索关键词
   * @param {Object} options 选项
   */
  static search(realm, userId, searchText, options = {}) {
    const {
      is_deleted = false,
      graph_id = null,
    } = options;

    let query = `user_id = "${userId}" AND is_deleted = ${is_deleted} AND (title CONTAINS[c] "${searchText}" OR content CONTAINS[c] "${searchText}")`;

    if (graph_id) {
      query += ` AND graph_id = "${graph_id}"`;
    }

    let results = realm.objects('KnowledgeNode').filtered(query);

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

export default KnowledgeNode;
