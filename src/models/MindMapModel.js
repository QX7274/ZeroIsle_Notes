/**
 * 思维导图模型类
 */

import BaseModel from './BaseModel';
import { logService } from '../services/utils/logService';

class MindMapModel extends BaseModel {
  constructor(data = {}) {
    super(data, 'MindMap');
    
    this.title = data.title || '';
    this.description = data.description || '';
    this.user_id = data.user_id || null;
    this.is_favorite = data.is_favorite || false;
    this.is_deleted = data.is_deleted || false;
    this.is_synced = data.is_synced || false;
    this.created_at = data.created_at || null;
    this.updated_at = data.updated_at || null;
    this.deleted_at = data.deleted_at || null;
    this.tags = data.tags || [];
    this.color = data.color || null;
    this.metadata = data.metadata || {};
    this.layout = data.layout || 'mindmap';
    this.settings = data.settings || {};
    this.category_id = data.category_id || null;
    this.thumbnail_path = data.thumbnail_path || null;
    this.note_id = data.note_id || null;
    this.root_node_id = data.root_node_id || null;
  }

  /**
   * 更新标题
   * @param {string} title 标题
   * @returns {MindMapModel} 思维导图模型
   */
  updateTitle(title) {
    this.title = title;
    this.isModified = true;
    this.modifiedFields.add('title');
    return this;
  }

  /**
   * 更新描述
   * @param {string} description 描述
   * @returns {MindMapModel} 思维导图模型
   */
  updateDescription(description) {
    this.description = description;
    this.isModified = true;
    this.modifiedFields.add('description');
    return this;
  }

  /**
   * 设置收藏状态
   * @param {boolean} isFavorite 是否收藏
   * @returns {MindMapModel} 思维导图模型
   */
  setFavorite(isFavorite) {
    this.is_favorite = isFavorite;
    this.isModified = true;
    this.modifiedFields.add('is_favorite');
    return this;
  }

  /**
   * 添加标签
   * @param {string} tag 标签
   * @returns {MindMapModel} 思维导图模型
   */
  addTag(tag) {
    if (!this.tags.includes(tag)) {
      this.tags.push(tag);
      this.isModified = true;
      this.modifiedFields.add('tags');
    }
    return this;
  }

  /**
   * 移除标签
   * @param {string} tag 标签
   * @returns {MindMapModel} 思维导图模型
   */
  removeTag(tag) {
    const index = this.tags.indexOf(tag);
    if (index !== -1) {
      this.tags.splice(index, 1);
      this.isModified = true;
      this.modifiedFields.add('tags');
    }
    return this;
  }

  /**
   * 设置颜色
   * @param {string} color 颜色
   * @returns {MindMapModel} 思维导图模型
   */
  setColor(color) {
    this.color = color;
    this.isModified = true;
    this.modifiedFields.add('color');
    return this;
  }

  /**
   * 更新元数据
   * @param {Object} metadata 元数据
   * @returns {MindMapModel} 思维导图模型
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
   * 设置布局
   * @param {string} layout 布局
   * @returns {MindMapModel} 思维导图模型
   */
  setLayout(layout) {
    this.layout = layout;
    this.isModified = true;
    this.modifiedFields.add('layout');
    return this;
  }

  /**
   * 更新设置
   * @param {Object} settings 设置
   * @returns {MindMapModel} 思维导图模型
   */
  updateSettings(settings) {
    this.settings = {
      ...this.settings,
      ...settings,
    };
    this.isModified = true;
    this.modifiedFields.add('settings');
    return this;
  }

  /**
   * 设置分类
   * @param {string} categoryId 分类ID
   * @returns {MindMapModel} 思维导图模型
   */
  setCategory(categoryId) {
    this.category_id = categoryId;
    this.isModified = true;
    this.modifiedFields.add('category_id');
    return this;
  }

  /**
   * 设置缩略图路径
   * @param {string} thumbnailPath 缩略图路径
   * @returns {MindMapModel} 思维导图模型
   */
  setThumbnailPath(thumbnailPath) {
    this.thumbnail_path = thumbnailPath;
    this.isModified = true;
    this.modifiedFields.add('thumbnail_path');
    return this;
  }

  /**
   * 关联笔记
   * @param {string} noteId 笔记ID
   * @returns {MindMapModel} 思维导图模型
   */
  linkNote(noteId) {
    this.note_id = noteId;
    this.isModified = true;
    this.modifiedFields.add('note_id');
    return this;
  }

  /**
   * 设置根节点
   * @param {string} rootNodeId 根节点ID
   * @returns {MindMapModel} 思维导图模型
   */
  setRootNode(rootNodeId) {
    this.root_node_id = rootNodeId;
    this.isModified = true;
    this.modifiedFields.add('root_node_id');
    return this;
  }

  /**
   * 查找用户的思维导图
   * @param {string} userId 用户ID
   * @param {Object} options 选项
   * @returns {Promise<Array<MindMapModel>>} 思维导图模型数组
   */
  static async findByUser(userId, options = {}) {
    try {
      const {
        limit = 50,
        skip = 0,
        sort = { updated_at: -1 },
        is_deleted = false,
        is_favorite = null,
        category_id = null,
        tags = null,
        search = null,
      } = options;
      
      const filter = { user_id: userId, is_deleted };
      
      if (is_favorite !== null) {
        filter.is_favorite = is_favorite;
      }
      
      if (category_id) {
        filter.category_id = category_id;
      }
      
      if (tags) {
        filter.tags = { $in: Array.isArray(tags) ? tags : [tags] };
      }
      
      // 简单的搜索实现
      if (search) {
        const searchLower = search.toLowerCase();
        const mindmaps = await this.find(filter);
        
        const filteredMindmaps = mindmaps.filter(mindmap => 
          mindmap.title.toLowerCase().includes(searchLower) || 
          mindmap.description.toLowerCase().includes(searchLower) ||
          mindmap.tags.some(tag => tag.toLowerCase().includes(searchLower))
        );
        
        // 排序
        const sortField = Object.keys(sort)[0];
        const sortDirection = sort[sortField];
        
        filteredMindmaps.sort((a, b) => {
          if (sortDirection === 1) {
            return a[sortField] > b[sortField] ? 1 : -1;
          } else {
            return a[sortField] < b[sortField] ? 1 : -1;
          }
        });
        
        // 分页
        return filteredMindmaps.slice(skip, skip + limit);
      }
      
      return this.find(filter, { sort, limit, skip });
    } catch (error) {
      logService.error('查找用户思维导图失败', error);
      throw error;
    }
  }

  /**
   * 查找收藏的思维导图
   * @param {string} userId 用户ID
   * @param {Object} options 选项
   * @returns {Promise<Array<MindMapModel>>} 思维导图模型数组
   */
  static async findFavorites(userId, options = {}) {
    try {
      return this.findByUser(userId, {
        ...options,
        is_favorite: true,
      });
    } catch (error) {
      logService.error('查找收藏思维导图失败', error);
      throw error;
    }
  }

  /**
   * 查找最近的思维导图
   * @param {string} userId 用户ID
   * @param {number} limit 限制数量
   * @returns {Promise<Array<MindMapModel>>} 思维导图模型数组
   */
  static async findRecent(userId, limit = 10) {
    try {
      return this.findByUser(userId, {
        limit,
        sort: { updated_at: -1 },
      });
    } catch (error) {
      logService.error('查找最近思维导图失败', error);
      throw error;
    }
  }

  /**
   * 查找笔记的思维导图
   * @param {string} noteId 笔记ID
   * @returns {Promise<Array<MindMapModel>>} 思维导图模型数组
   */
  static async findByNote(noteId) {
    try {
      return this.find({
        note_id: noteId,
        is_deleted: false,
      });
    } catch (error) {
      logService.error('查找笔记思维导图失败', error);
      throw error;
    }
  }

  /**
   * 搜索思维导图
   * @param {string} query 搜索关键词
   * @param {string} userId 用户ID
   * @param {Object} options 选项
   * @returns {Promise<Array<MindMapModel>>} 思维导图模型数组
   */
  static async search(query, userId, options = {}) {
    try {
      const {
        limit = 20,
        skip = 0,
      } = options;
      
      return this.findByUser(userId, {
        search: query,
        limit,
        skip,
      });
    } catch (error) {
      logService.error('搜索思维导图失败', error);
      throw error;
    }
  }

  /**
   * 创建新的思维导图
   * @param {string} title 标题
   * @param {string} userId 用户ID
   * @param {Object} options 选项
   * @returns {Promise<MindMapModel>} 思维导图模型
   */
  static async createNew(title, userId, options = {}) {
    try {
      const { description = '', categoryId = null, noteId = null } = options;
      
      // 创建思维导图
      const mindmap = await this.create({
        title,
        description,
        user_id: userId,
        category_id: categoryId,
        note_id: noteId,
      });
      
      // 创建根节点
      if (mindmap._id) {
        const { MindMapNodeModel } = require('./index');
        
        const rootNode = await MindMapNodeModel.create({
          text: title,
          mind_map_id: mindmap._id,
          user_id: userId,
          is_root: true,
          level: 0,
        });
        
        // 设置根节点ID
        mindmap.root_node_id = rootNode._id;
        await mindmap.save();
      }
      
      return mindmap;
    } catch (error) {
      logService.error('创建思维导图失败', error);
      throw error;
    }
  }

  /**
   * 获取思维导图的节点
   * @returns {Promise<Array<Object>>} 节点数组
   */
  async getNodes() {
    try {
      const { MindMapNodeModel } = require('./index');
      
      // 获取所有节点
      const nodes = await MindMapNodeModel.findByMindMap(this._id);
      
      return nodes;
    } catch (error) {
      logService.error('获取思维导图节点失败', error);
      throw error;
    }
  }

  /**
   * 获取思维导图的树形结构
   * @returns {Promise<Object>} 树形结构
   */
  async getTree() {
    try {
      // 获取所有节点
      const nodes = await this.getNodes();
      
      // 查找根节点
      let rootNode = nodes.find(node => node.is_root);
      
      // 如果没有根节点但有root_node_id，则查找对应节点
      if (!rootNode && this.root_node_id) {
        rootNode = nodes.find(node => node._id === this.root_node_id);
      }
      
      // 如果仍然没有根节点，则使用第一个节点
      if (!rootNode && nodes.length > 0) {
        rootNode = nodes[0];
      }
      
      // 如果没有节点，返回空树
      if (!rootNode) {
        return { root: null, nodes: [] };
      }
      
      // 构建树形结构
      const buildTree = (node) => {
        const children = nodes.filter(n => n.parent_id === node._id);
        
        return {
          ...node.toJSON(),
          children: children.map(child => buildTree(child)),
        };
      };
      
      return {
        root: buildTree(rootNode),
        nodes,
      };
    } catch (error) {
      logService.error('获取思维导图树形结构失败', error);
      throw error;
    }
  }

  /**
   * 复制思维导图
   * @param {string} newTitle 新标题
   * @returns {Promise<MindMapModel>} 新思维导图模型
   */
  async duplicate(newTitle) {
    try {
      const { MindMapNodeModel } = require('./index');
      
      // 创建新的思维导图
      const newMindMap = await MindMapModel.create({
        title: newTitle || `${this.title} (复制)`,
        description: this.description,
        user_id: this.user_id,
        tags: [...this.tags],
        color: this.color,
        metadata: { ...this.metadata },
        layout: this.layout,
        settings: { ...this.settings },
        category_id: this.category_id,
      });
      
      // 获取原思维导图的节点
      const nodes = await this.getNodes();
      
      // 节点ID映射
      const nodeIdMap = {};
      
      // 复制节点
      for (const node of nodes) {
        const newNode = await MindMapNodeModel.create({
          text: node.text,
          mind_map_id: newMindMap._id,
          user_id: this.user_id,
          is_root: node.is_root,
          level: node.level,
          parent_id: null, // 暂时设为null，稍后更新
          position: { ...node.position },
          color: node.color,
          background_color: node.background_color,
          font_size: node.font_size,
          font_weight: node.font_weight,
          shape: node.shape,
          metadata: { ...node.metadata },
        });
        
        // 记录节点ID映射
        nodeIdMap[node._id] = newNode._id;
        
        // 如果是根节点，更新思维导图的根节点ID
        if (node.is_root) {
          newMindMap.root_node_id = newNode._id;
          await newMindMap.save();
        }
      }
      
      // 更新节点的父节点ID
      for (const node of nodes) {
        if (node.parent_id && nodeIdMap[node.parent_id]) {
          const newNode = await MindMapNodeModel.findById(nodeIdMap[node._id]);
          if (newNode) {
            newNode.parent_id = nodeIdMap[node.parent_id];
            await newNode.save();
          }
        }
      }
      
      return newMindMap;
    } catch (error) {
      logService.error('复制思维导图失败', error);
      throw error;
    }
  }
}

// 设置集合名称
MindMapModel.collectionName = 'MindMap';

export default MindMapModel;
