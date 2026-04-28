/**
 * 思维导图节点模型 - Realm版本
 */

import Realm from 'realm';

/**
 * 思维导图节点模型定义
 */
class MindMapNode extends Realm.Object {
  static schema = {
    name: 'MindMapNode',
    primaryKey: '_id',
    properties: {
      _id: 'string',
      text: 'string',
      note: { type: 'string', default: '' },
      style: { type: 'string', default: '{"backgroundColor":"","textColor":"","borderColor":"","fontSize":null,"fontWeight":"","shape":"","image":"","icon":""}' }, // 存储为JSON字符串
      position: { type: 'string', default: '{"x":0,"y":0}' }, // 存储为JSON字符串
      expanded: { type: 'bool', default: true },
      parent_id: { type: 'string', optional: true },
      user_id: 'string',
      mind_map_id: 'string',
      note_id: { type: 'string', optional: true },
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
    const style = this.style ? JSON.parse(this.style) : { backgroundColor: '', textColor: '', borderColor: '', fontSize: null, fontWeight: '', shape: '', image: '', icon: '' };
    const position = this.position ? JSON.parse(this.position) : { x: 0, y: 0 };
    const metadata = this.metadata ? JSON.parse(this.metadata) : {};

    return {
      _id: this._id,
      id: this._id,
      text: this.text,
      note: this.note,
      style: style,
      position: position,
      expanded: this.expanded,
      parent_id: this.parent_id,
      user_id: this.user_id,
      mind_map_id: this.mind_map_id,
      note_id: this.note_id,
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
   * 更新文本
   * @param {Realm} realm Realm实例
   * @param {string} text 文本
   */
  updateText(realm, text) {
    realm.write(() => {
      this.text = text;
      this.updated_at = new Date();
    });

    return this;
  }

  /**
   * 更新备注
   * @param {Realm} realm Realm实例
   * @param {string} note 备注
   */
  updateNote(realm, note) {
    realm.write(() => {
      this.note = note;
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
      const currentStyle = this.style ? JSON.parse(this.style) : { backgroundColor: '', textColor: '', borderColor: '', fontSize: null, fontWeight: '', shape: '', image: '', icon: '' };

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
   * 展开/折叠
   * @param {Realm} realm Realm实例
   * @param {boolean} expanded 是否展开
   */
  setExpanded(realm, expanded = true) {
    realm.write(() => {
      this.expanded = expanded;
      this.updated_at = new Date();
    });

    return this;
  }

  /**
   * 设置父节点
   * @param {Realm} realm Realm实例
   * @param {string} parentId 父节点ID
   */
  setParent(realm, parentId) {
    // 检查是否会形成循环
    if (parentId) {
      const wouldFormCycle = MindMapNode.wouldFormCycle(realm, this._id, parentId);
      if (wouldFormCycle) {
        throw new Error('设置此父节点会形成循环');
      }
    }

    realm.write(() => {
      this.parent_id = parentId;
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
   * 获取子节点
   * @param {Realm} realm Realm实例
   */
  getChildren(realm) {
    return realm.objects('MindMapNode')
      .filtered(`parent_id = "${this._id}" AND is_deleted = false`);
  }

  /**
   * 获取子孙节点
   * @param {Realm} realm Realm实例
   */
  getDescendants(realm) {
    const descendants = [];
    const queue = [this._id];

    while (queue.length > 0) {
      const nodeId = queue.shift();

      const children = realm.objects('MindMapNode')
        .filtered(`parent_id = "${nodeId}" AND is_deleted = false`);

      const childrenArray = Array.from(children);
      descendants.push(...childrenArray);

      for (const child of childrenArray) {
        queue.push(child._id);
      }
    }

    return descendants;
  }

  /**
   * 添加子节点
   * @param {Realm} realm Realm实例
   * @param {Object} nodeData 节点数据
   */
  addChild(realm, nodeData) {
    let child;

    realm.write(() => {
      child = realm.create('MindMapNode', {
        _id: new Realm.BSON.ObjectId().toHexString(),
        text: nodeData.text || '新节点',
        note: nodeData.note || '',
        style: JSON.stringify(nodeData.style || {}),
        position: JSON.stringify(nodeData.position || { x: 0, y: 0 }),
        expanded: nodeData.expanded !== undefined ? nodeData.expanded : true,
        parent_id: this._id,
        user_id: this.user_id,
        mind_map_id: this.mind_map_id,
        metadata: JSON.stringify(nodeData.metadata || {}),
        is_deleted: false,
        is_synced: false,
        created_at: new Date(),
        updated_at: new Date(),
      });
    });

    return child;
  }

  /**
   * 移动到新位置
   * @param {Realm} realm Realm实例
   * @param {string} newParentId 新父节点ID
   */
  moveTo(realm, newParentId) {
    return this.setParent(realm, newParentId);
  }

  /**
   * 静态方法 - 根据ID查找
   * @param {Realm} realm Realm实例
   * @param {string} id ID
   */
  static findById(realm, id) {
    return realm.objectForPrimaryKey('MindMapNode', id);
  }

  /**
   * 静态方法 - 查找思维导图的节点
   * @param {Realm} realm Realm实例
   * @param {string} mindMapId 思维导图ID
   * @param {Object} options 选项
   */
  static findByMindMap(realm, mindMapId, options = {}) {
    const {
      is_deleted = false,
      parent_id = undefined,
    } = options;

    let query = `mind_map_id = "${mindMapId}" AND is_deleted = ${is_deleted}`;

    if (parent_id !== undefined) {
      if (parent_id === null) {
        query += ' AND parent_id = null';
      } else {
        query += ` AND parent_id = "${parent_id}"`;
      }
    }

    return realm.objects('MindMapNode').filtered(query);
  }

  /**
   * 静态方法 - 查找思维导图的根节点
   * @param {Realm} realm Realm实例
   * @param {string} mindMapId 思维导图ID
   */
  static findRoot(realm, mindMapId) {
    return realm.objects('MindMapNode')
      .filtered(`mind_map_id = "${mindMapId}" AND parent_id = null AND is_deleted = false`)
      .slice(0, 1)[0];
  }

  /**
   * 静态方法 - 查找节点的子节点
   * @param {Realm} realm Realm实例
   * @param {string} nodeId 节点ID
   */
  static findChildren(realm, nodeId) {
    return realm.objects('MindMapNode')
      .filtered(`parent_id = "${nodeId}" AND is_deleted = false`);
  }

  /**
   * 静态方法 - 查找笔记的节点
   * @param {Realm} realm Realm实例
   * @param {string} noteId 笔记ID
   */
  static findByNote(realm, noteId) {
    return realm.objects('MindMapNode')
      .filtered(`note_id = "${noteId}" AND is_deleted = false`);
  }

  /**
   * 静态方法 - 搜索节点
   * @param {Realm} realm Realm实例
   * @param {string} mindMapId 思维导图ID
   * @param {string} searchText 搜索关键词
   */
  static search(realm, mindMapId, searchText) {
    return realm.objects('MindMapNode')
      .filtered(`mind_map_id = "${mindMapId}" AND is_deleted = false AND (text CONTAINS[c] "${searchText}" OR note CONTAINS[c] "${searchText}")`)
      .sorted('updated_at', true);
  }

  /**
   * 静态方法 - 创建思维导图的根节点
   * @param {Realm} realm Realm实例
   * @param {string} mindMapId 思维导图ID
   * @param {string} userId 用户ID
   * @param {string} text 文本
   */
  static createRoot(realm, mindMapId, userId, text = '中心主题') {
    const existingRoot = this.findRoot(realm, mindMapId);

    if (existingRoot) {
      return existingRoot;
    }

    let root;
    realm.write(() => {
      root = realm.create('MindMapNode', {
        _id: new Realm.BSON.ObjectId().toHexString(),
        text,
        note: '',
        style: JSON.stringify({}),
        position: JSON.stringify({ x: 0, y: 0 }),
        expanded: true,
        parent_id: null,
        user_id: userId,
        mind_map_id: mindMapId,
        metadata: JSON.stringify({}),
        is_deleted: false,
        is_synced: false,
        created_at: new Date(),
        updated_at: new Date(),
      });
    });

    return root;
  }

  /**
   * 静态方法 - 检查是否会形成循环
   * @param {Realm} realm Realm实例
   * @param {string} nodeId 节点ID
   * @param {string} newParentId 新父节点ID
   */
  static wouldFormCycle(realm, nodeId, newParentId) {
    // 如果新父节点是自己，会形成循环
    if (nodeId === newParentId) {
      return true;
    }

    // 检查新父节点是否是当前节点的子孙节点
    let currentParentId = newParentId;

    while (currentParentId) {
      const parent = this.findById(realm, currentParentId);

      if (!parent) {
        break;
      }

      if (parent._id === nodeId) {
        return true;
      }

      currentParentId = parent.parent_id;
    }

    return false;
  }

  /**
   * 静态方法 - 获取思维导图的完整树
   * @param {Realm} realm Realm实例
   * @param {string} mindMapId 思维导图ID
   */
  static getTree(realm, mindMapId) {
    const nodes = realm.objects('MindMapNode')
      .filtered(`mind_map_id = "${mindMapId}" AND is_deleted = false`);

    const nodeMap = {};
    let root = null;

    // 构建节点映射
    Array.from(nodes).forEach(node => {
      const nodeJson = node.toJSON();
      nodeMap[node._id] = {
        ...nodeJson,
        children: [],
      };

      if (!node.parent_id) {
        root = nodeMap[node._id];
      }
    });

    // 构建树结构
    Array.from(nodes).forEach(node => {
      if (node.parent_id) {
        const parentId = node.parent_id;

        if (nodeMap[parentId]) {
          nodeMap[parentId].children.push(nodeMap[node._id]);
        }
      }
    });

    return root;
  }
}

export default MindMapNode;
