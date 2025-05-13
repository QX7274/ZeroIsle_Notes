/**
 * 画布元素模型 - Realm版本
 */

import Realm from 'realm';

/**
 * 画布元素模型定义
 */
class CanvasElement extends Realm.Object {
  static schema = {
    name: 'CanvasElement',
    primaryKey: '_id',
    properties: {
      _id: 'string',
      type: { type: 'string', default: 'text' }, // 'text', 'image', 'shape', 'line', 'note', 'group', 'embed', 'custom'
      content: { type: 'string', default: '{}' }, // 存储为JSON字符串
      position: { type: 'string', default: '{"x":0,"y":0}' }, // 存储为JSON字符串
      size: { type: 'string', default: '{"width":200,"height":100}' }, // 存储为JSON字符串
      style: { type: 'string', default: '{}' }, // 存储为JSON字符串
      layer: { type: 'int', default: 0 },
      rotation: { type: 'float', default: 0 },
      locked: { type: 'bool', default: false },
      note_id: { type: 'string', optional: true },
      user_id: 'string',
      canvas_id: 'string',
      group_id: { type: 'string', optional: true },
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
    const content = this.content ? JSON.parse(this.content) : {};
    const position = this.position ? JSON.parse(this.position) : { x: 0, y: 0 };
    const size = this.size ? JSON.parse(this.size) : { width: 200, height: 100 };
    const style = this.style ? JSON.parse(this.style) : {};
    const metadata = this.metadata ? JSON.parse(this.metadata) : {};

    return {
      _id: this._id,
      id: this._id,
      type: this.type,
      content: content,
      position: position,
      size: size,
      style: style,
      layer: this.layer,
      rotation: this.rotation,
      locked: this.locked,
      note_id: this.note_id,
      user_id: this.user_id,
      canvas_id: this.canvas_id,
      group_id: this.group_id,
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
   * 更新旋转
   * @param {Realm} realm Realm实例
   * @param {number} rotation 旋转角度
   */
  updateRotation(realm, rotation) {
    realm.write(() => {
      this.rotation = rotation;
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
      const currentStyle = this.style ? JSON.parse(this.style) : {};

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
   * 更新内容
   * @param {Realm} realm Realm实例
   * @param {Object} content 内容对象
   */
  updateContent(realm, content) {
    realm.write(() => {
      // 解析当前内容
      const currentContent = this.content ? JSON.parse(this.content) : {};

      // 合并内容
      const newContent = {
        ...currentContent,
        ...content,
      };

      // 保存为JSON字符串
      this.content = JSON.stringify(newContent);
      this.updated_at = new Date();
    });

    return this;
  }

  /**
   * 更新图层
   * @param {Realm} realm Realm实例
   * @param {number} layer 图层
   */
  updateLayer(realm, layer) {
    realm.write(() => {
      this.layer = layer;
      this.updated_at = new Date();
    });

    return this;
  }

  /**
   * 锁定/解锁
   * @param {Realm} realm Realm实例
   * @param {boolean} locked 是否锁定
   */
  setLocked(realm, locked = true) {
    realm.write(() => {
      this.locked = locked;
      this.updated_at = new Date();
    });

    return this;
  }

  /**
   * 添加到组
   * @param {Realm} realm Realm实例
   * @param {string} groupId 组ID
   */
  addToGroup(realm, groupId) {
    realm.write(() => {
      this.group_id = groupId;
      this.updated_at = new Date();
    });

    return this;
  }

  /**
   * 从组中移除
   * @param {Realm} realm Realm实例
   */
  removeFromGroup(realm) {
    realm.write(() => {
      this.group_id = null;
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
   * 复制元素
   * @param {Realm} realm Realm实例
   * @param {Object} overrides 覆盖属性
   */
  duplicate(realm, overrides = {}) {
    // 解析当前属性
    const position = this.position ? JSON.parse(this.position) : { x: 0, y: 0 };
    const size = this.size ? JSON.parse(this.size) : { width: 200, height: 100 };
    const content = this.content ? JSON.parse(this.content) : {};
    const style = this.style ? JSON.parse(this.style) : {};
    const metadata = this.metadata ? JSON.parse(this.metadata) : {};

    // 创建新位置
    const newPosition = {
      x: position.x + 20,
      y: position.y + 20,
    };

    // 创建新元素
    let newElement;
    realm.write(() => {
      newElement = realm.create('CanvasElement', {
        _id: new Realm.BSON.ObjectId().toHexString(),
        type: this.type,
        content: JSON.stringify(content),
        position: JSON.stringify(newPosition),
        size: JSON.stringify(size),
        style: JSON.stringify(style),
        layer: this.layer + 1,
        rotation: this.rotation,
        locked: this.locked,
        note_id: this.note_id,
        user_id: this.user_id,
        canvas_id: this.canvas_id,
        group_id: this.group_id,
        metadata: JSON.stringify(metadata),
        is_deleted: false,
        is_synced: false,
        created_at: new Date(),
        updated_at: new Date(),
        ...overrides,
      });
    });

    return newElement;
  }

  /**
   * 静态方法 - 根据ID查找
   * @param {Realm} realm Realm实例
   * @param {string} id ID
   */
  static findById(realm, id) {
    return realm.objectForPrimaryKey('CanvasElement', id);
  }

  /**
   * 静态方法 - 查找画布的元素
   * @param {Realm} realm Realm实例
   * @param {string} canvasId 画布ID
   * @param {Object} options 选项
   */
  static findByCanvas(realm, canvasId, options = {}) {
    const {
      is_deleted = false,
      type = null,
      group_id = null,
    } = options;

    let query = `canvas_id = "${canvasId}" AND is_deleted = ${is_deleted}`;

    if (type) {
      query += ` AND type = "${type}"`;
    }

    if (group_id !== undefined) {
      if (group_id === null) {
        query += ` AND group_id = null`;
      } else {
        query += ` AND group_id = "${group_id}"`;
      }
    }

    let results = realm.objects('CanvasElement').filtered(query);

    // 排序
    if (options.sort) {
      const sortField = Object.keys(options.sort)[0];
      const sortOrder = options.sort[sortField] === 1;
      results = results.sorted(sortField, sortOrder);
    } else {
      results = results.sorted('layer', false);
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
   * 静态方法 - 查找组的元素
   * @param {Realm} realm Realm实例
   * @param {string} groupId 组ID
   */
  static findByGroup(realm, groupId) {
    return realm.objects('CanvasElement')
      .filtered(`group_id = "${groupId}" AND is_deleted = false`)
      .sorted('layer', false);
  }

  /**
   * 静态方法 - 查找笔记的元素
   * @param {Realm} realm Realm实例
   * @param {string} noteId 笔记ID
   */
  static findByNote(realm, noteId) {
    return realm.objects('CanvasElement')
      .filtered(`note_id = "${noteId}" AND is_deleted = false`);
  }

  /**
   * 静态方法 - 获取画布的最高图层
   * @param {Realm} realm Realm实例
   * @param {string} canvasId 画布ID
   */
  static getTopLayer(realm, canvasId) {
    const elements = realm.objects('CanvasElement')
      .filtered(`canvas_id = "${canvasId}" AND is_deleted = false`)
      .sorted('layer', true);

    return elements.length > 0 ? elements[0].layer : 0;
  }

  /**
   * 静态方法 - 重新排序图层
   * @param {Realm} realm Realm实例
   * @param {string} canvasId 画布ID
   */
  static reorderLayers(realm, canvasId) {
    const elements = realm.objects('CanvasElement')
      .filtered(`canvas_id = "${canvasId}" AND is_deleted = false`)
      .sorted('layer', false);

    let layer = 0;

    realm.write(() => {
      Array.from(elements).forEach(element => {
        element.layer = layer++;
        element.updated_at = new Date();
      });
    });

    return elements;
  }

  /**
   * 静态方法 - 创建组
   * @param {Realm} realm Realm实例
   * @param {string} canvasId 画布ID
   * @param {string} userId 用户ID
   * @param {Array<string>} elementIds 元素ID数组
   */
  static createGroup(realm, canvasId, userId, elementIds) {
    if (!elementIds || elementIds.length === 0) {
      throw new Error('元素ID数组不能为空');
    }

    // 获取元素
    const elements = elementIds.map(id => realm.objectForPrimaryKey('CanvasElement', id))
      .filter(element => element && element.canvas_id === canvasId && !element.is_deleted);

    if (elements.length === 0) {
      throw new Error('未找到有效元素');
    }

    // 计算组的边界
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;

    elements.forEach(element => {
      const position = JSON.parse(element.position);
      const size = JSON.parse(element.size);

      minX = Math.min(minX, position.x);
      minY = Math.min(minY, position.y);
      maxX = Math.max(maxX, position.x + size.width);
      maxY = Math.max(maxY, position.y + size.height);
    });

    // 创建组元素
    let group;
    realm.write(() => {
      // 获取最高图层
      const topLayer = this.getTopLayer(realm, canvasId);

      // 创建组元素
      group = realm.create('CanvasElement', {
        _id: new Realm.BSON.ObjectId().toHexString(),
        type: 'group',
        position: JSON.stringify({ x: minX, y: minY }),
        size: JSON.stringify({ width: maxX - minX, height: maxY - minY }),
        content: JSON.stringify({}),
        style: JSON.stringify({}),
        layer: topLayer + 1,
        rotation: 0,
        locked: false,
        user_id: userId,
        canvas_id: canvasId,
        metadata: JSON.stringify({}),
        is_deleted: false,
        is_synced: false,
        created_at: new Date(),
        updated_at: new Date(),
      });

      // 将元素添加到组
      elements.forEach(element => {
        element.group_id = group._id;
        element.updated_at = new Date();
      });
    });

    return group;
  }

  /**
   * 静态方法 - 解散组
   * @param {Realm} realm Realm实例
   * @param {string} groupId 组ID
   */
  static ungroup(realm, groupId) {
    // 获取组元素
    const group = this.findById(realm, groupId);

    if (!group || group.type !== 'group') {
      throw new Error('未找到有效的组');
    }

    // 获取组内元素
    const elements = realm.objects('CanvasElement')
      .filtered(`group_id = "${groupId}" AND is_deleted = false`);

    realm.write(() => {
      // 将元素从组中移除
      Array.from(elements).forEach(element => {
        element.group_id = null;
        element.updated_at = new Date();
      });

      // 删除组元素
      group.is_deleted = true;
      group.deleted_at = new Date();
      group.updated_at = new Date();
    });

    return Array.from(elements);
  }
}

export default CanvasElement;
