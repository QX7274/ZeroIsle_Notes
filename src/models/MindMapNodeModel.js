/**
 * 思维导图节点模型类
 */

import BaseModel from './BaseModel';
import { logService } from '../services/utils/logService';

class MindMapNodeModel extends BaseModel {
  constructor(data = {}) {
    super(data, 'MindMapNode');
    
    this.text = data.text || '';
    this.mind_map_id = data.mind_map_id || null;
    this.user_id = data.user_id || null;
    this.is_root = data.is_root || false;
    this.level = data.level || 0;
    this.parent_id = data.parent_id || null;
    this.position = data.position || { x: 0, y: 0 };
    this.color = data.color || null;
    this.background_color = data.background_color || null;
    this.font_size = data.font_size || null;
    this.font_weight = data.font_weight || null;
    this.shape = data.shape || 'rectangle';
    this.is_deleted = data.is_deleted || false;
    this.is_synced = data.is_synced || false;
    this.created_at = data.created_at || null;
    this.updated_at = data.updated_at || null;
    this.deleted_at = data.deleted_at || null;
    this.metadata = data.metadata || {};
    this.note_id = data.note_id || null;
    this.collapsed = data.collapsed || false;
    this.order = data.order || 0;
  }

  /**
   * 更新文本
   * @param {string} text 文本
   * @returns {MindMapNodeModel} 思维导图节点模型
   */
  updateText(text) {
    this.text = text;
    this.isModified = true;
    this.modifiedFields.add('text');
    return this;
  }

  /**
   * 设置位置
   * @param {number} x X坐标
   * @param {number} y Y坐标
   * @returns {MindMapNodeModel} 思维导图节点模型
   */
  setPosition(x, y) {
    this.position = { x, y };
    this.isModified = true;
    this.modifiedFields.add('position');
    return this;
  }

  /**
   * 设置颜色
   * @param {string} color 颜色
   * @returns {MindMapNodeModel} 思维导图节点模型
   */
  setColor(color) {
    this.color = color;
    this.isModified = true;
    this.modifiedFields.add('color');
    return this;
  }

  /**
   * 设置背景颜色
   * @param {string} backgroundColor 背景颜色
   * @returns {MindMapNodeModel} 思维导图节点模型
   */
  setBackgroundColor(backgroundColor) {
    this.background_color = backgroundColor;
    this.isModified = true;
    this.modifiedFields.add('background_color');
    return this;
  }

  /**
   * 设置字体大小
   * @param {number} fontSize 字体大小
   * @returns {MindMapNodeModel} 思维导图节点模型
   */
  setFontSize(fontSize) {
    this.font_size = fontSize;
    this.isModified = true;
    this.modifiedFields.add('font_size');
    return this;
  }

  /**
   * 设置字体粗细
   * @param {string} fontWeight 字体粗细
   * @returns {MindMapNodeModel} 思维导图节点模型
   */
  setFontWeight(fontWeight) {
    this.font_weight = fontWeight;
    this.isModified = true;
    this.modifiedFields.add('font_weight');
    return this;
  }

  /**
   * 设置形状
   * @param {string} shape 形状
   * @returns {MindMapNodeModel} 思维导图节点模型
   */
  setShape(shape) {
    this.shape = shape;
    this.isModified = true;
    this.modifiedFields.add('shape');
    return this;
  }

  /**
   * 更新元数据
   * @param {Object} metadata 元数据
   * @returns {MindMapNodeModel} 思维导图节点模型
   */
  updateMetadata(metadata) {
    this.metadata = {
      ...this.metadata,
      ...metadata,
    };
    this.isModified = true;
    this.modifiedFields.add('metadata');
    return this;
  }

  /**
   * 关联笔记
   * @param {string} noteId 笔记ID
   * @returns {MindMapNodeModel} 思维导图节点模型
   */
  linkNote(noteId) {
    this.note_id = noteId;
    this.isModified = true;
    this.modifiedFields.add('note_id');
    return this;
  }

  /**
   * 设置折叠状态
   * @param {boolean} collapsed 是否折叠
   * @returns {MindMapNodeModel} 思维导图节点模型
   */
  setCollapsed(collapsed) {
    this.collapsed = collapsed;
    this.isModified = true;
    this.modifiedFields.add('collapsed');
    return this;
  }

  /**
   * 设置排序
   * @param {number} order 排序
   * @returns {MindMapNodeModel} 思维导图节点模型
   */
  setOrder(order) {
    this.order = order;
    this.isModified = true;
    this.modifiedFields.add('order');
    return this;
  }

  /**
   * 查找思维导图的节点
   * @param {string} mindMapId 思维导图ID
   * @param {Object} options 选项
   * @returns {Promise<Array<MindMapNodeModel>>} 思维导图节点模型数组
   */
  static async findByMindMap(mindMapId, options = {}) {
    try {
      const {
        limit = 1000,
        skip = 0,
        sort = { level: 1, order: 1 },
        is_deleted = false,
      } = options;
      
      const filter = { mind_map_id: mindMapId, is_deleted };
      
      return this.find(filter, { sort, limit, skip });
    } catch (error) {
      logService.error('查找思维导图节点失败', error);
      throw error;
    }
  }

  /**
   * 查找根节点
   * @param {string} mindMapId 思维导图ID
   * @returns {Promise<MindMapNodeModel|null>} 思维导图节点模型
   */
  static async findRoot(mindMapId) {
    try {
      return this.findOne({
        mind_map_id: mindMapId,
        is_root: true,
        is_deleted: false,
      });
    } catch (error) {
      logService.error('查找根节点失败', error);
      throw error;
    }
  }

  /**
   * 查找子节点
   * @param {string} parentId 父节点ID
   * @param {Object} options 选项
   * @returns {Promise<Array<MindMapNodeModel>>} 思维导图节点模型数组
   */
  static async findChildren(parentId, options = {}) {
    try {
      const {
        sort = { order: 1 },
        is_deleted = false,
      } = options;
      
      return this.find({
        parent_id: parentId,
        is_deleted,
      }, { sort });
    } catch (error) {
      logService.error('查找子节点失败', error);
      throw error;
    }
  }

  /**
   * 查找关联笔记的节点
   * @param {string} noteId 笔记ID
   * @returns {Promise<Array<MindMapNodeModel>>} 思维导图节点模型数组
   */
  static async findByNote(noteId) {
    try {
      return this.find({
        note_id: noteId,
        is_deleted: false,
      });
    } catch (error) {
      logService.error('查找关联笔记的节点失败', error);
      throw error;
    }
  }

  /**
   * 创建子节点
   * @param {string} parentId 父节点ID
   * @param {string} text 文本
   * @param {Object} options 选项
   * @returns {Promise<MindMapNodeModel>} 思维导图节点模型
   */
  static async createChild(parentId, text, options = {}) {
    try {
      // 获取父节点
      const parentNode = await this.findById(parentId);
      
      if (!parentNode) {
        throw new Error(`父节点不存在: ${parentId}`);
      }
      
      // 获取同级子节点数量，用于设置顺序
      const siblings = await this.findChildren(parentId);
      const order = siblings.length;
      
      // 创建子节点
      return this.create({
        text,
        mind_map_id: parentNode.mind_map_id,
        user_id: parentNode.user_id,
        is_root: false,
        level: parentNode.level + 1,
        parent_id: parentId,
        position: options.position || { x: 0, y: 0 },
        color: options.color || parentNode.color,
        background_color: options.backgroundColor || parentNode.background_color,
        font_size: options.fontSize || null,
        font_weight: options.fontWeight || null,
        shape: options.shape || 'rectangle',
        metadata: options.metadata || {},
        note_id: options.noteId || null,
        order,
      });
    } catch (error) {
      logService.error('创建子节点失败', error);
      throw error;
    }
  }

  /**
   * 移动节点
   * @param {string} nodeId 节点ID
   * @param {string} newParentId 新父节点ID
   * @param {number} newOrder 新顺序
   * @returns {Promise<MindMapNodeModel>} 思维导图节点模型
   */
  static async moveNode(nodeId, newParentId, newOrder = null) {
    try {
      // 获取节点
      const node = await this.findById(nodeId);
      
      if (!node) {
        throw new Error(`节点不存在: ${nodeId}`);
      }
      
      // 获取新父节点
      const newParent = await this.findById(newParentId);
      
      if (!newParent) {
        throw new Error(`新父节点不存在: ${newParentId}`);
      }
      
      // 检查是否是同一个思维导图
      if (node.mind_map_id !== newParent.mind_map_id) {
        throw new Error('不能跨思维导图移动节点');
      }
      
      // 检查是否移动到自己的子节点
      let current = newParent;
      while (current) {
        if (current._id === node._id) {
          throw new Error('不能移动到自己的子节点');
        }
        
        if (!current.parent_id) {
          break;
        }
        
        current = await this.findById(current.parent_id);
      }
      
      // 获取旧父节点的子节点
      if (node.parent_id) {
        const oldSiblings = await this.findChildren(node.parent_id);
        
        // 更新旧兄弟节点的顺序
        for (const sibling of oldSiblings) {
          if (sibling._id !== node._id && sibling.order > node.order) {
            sibling.order -= 1;
            await sibling.save();
          }
        }
      }
      
      // 获取新父节点的子节点
      const newSiblings = await this.findChildren(newParentId);
      
      // 确定新顺序
      const order = newOrder !== null ? newOrder : newSiblings.length;
      
      // 更新新兄弟节点的顺序
      for (const sibling of newSiblings) {
        if (sibling.order >= order) {
          sibling.order += 1;
          await sibling.save();
        }
      }
      
      // 更新节点
      node.parent_id = newParentId;
      node.level = newParent.level + 1;
      node.order = order;
      
      await node.save();
      
      // 更新所有子节点的级别
      await this.updateChildrenLevels(node._id, node.level);
      
      return node;
    } catch (error) {
      logService.error('移动节点失败', error);
      throw error;
    }
  }

  /**
   * 更新子节点级别
   * @param {string} parentId 父节点ID
   * @param {number} parentLevel 父节点级别
   * @returns {Promise<void>}
   * @private
   */
  static async updateChildrenLevels(parentId, parentLevel) {
    try {
      // 获取子节点
      const children = await this.findChildren(parentId);
      
      for (const child of children) {
        // 更新子节点级别
        child.level = parentLevel + 1;
        await child.save();
        
        // 递归更新子节点的子节点
        await this.updateChildrenLevels(child._id, child.level);
      }
    } catch (error) {
      logService.error('更新子节点级别失败', error);
      throw error;
    }
  }

  /**
   * 获取节点的子节点
   * @returns {Promise<Array<MindMapNodeModel>>} 子节点数组
   */
  async getChildren() {
    try {
      return this.constructor.findChildren(this._id);
    } catch (error) {
      logService.error('获取子节点失败', error);
      throw error;
    }
  }

  /**
   * 获取节点的父节点
   * @returns {Promise<MindMapNodeModel|null>} 父节点
   */
  async getParent() {
    try {
      if (!this.parent_id) {
        return null;
      }
      
      return this.constructor.findById(this.parent_id);
    } catch (error) {
      logService.error('获取父节点失败', error);
      throw error;
    }
  }

  /**
   * 获取节点的路径
   * @returns {Promise<Array<MindMapNodeModel>>} 节点路径
   */
  async getPath() {
    try {
      const path = [];
      let current = this;
      
      while (current) {
        path.unshift(current);
        
        if (!current.parent_id) {
          break;
        }
        
        current = await current.getParent();
      }
      
      return path;
    } catch (error) {
      logService.error('获取节点路径失败', error);
      throw error;
    }
  }
}

// 设置集合名称
MindMapNodeModel.collectionName = 'MindMapNode';

export default MindMapNodeModel;
