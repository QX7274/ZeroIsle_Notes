/**
 * 知识图谱模型类
 */

import BaseModel from './BaseModel';
import { logService } from '../services/utils/logService';

class KnowledgeGraphModel extends BaseModel {
  constructor(data = {}) {
    super(data, 'KnowledgeGraph');
    
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
    this.layout = data.layout || 'force';
    this.settings = data.settings || {};
    this.category_id = data.category_id || null;
    this.thumbnail_path = data.thumbnail_path || null;
  }

  /**
   * 更新标题
   * @param {string} title 标题
   * @returns {KnowledgeGraphModel} 知识图谱模型
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
   * @returns {KnowledgeGraphModel} 知识图谱模型
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
   * @returns {KnowledgeGraphModel} 知识图谱模型
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
   * @returns {KnowledgeGraphModel} 知识图谱模型
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
   * @returns {KnowledgeGraphModel} 知识图谱模型
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
   * @returns {KnowledgeGraphModel} 知识图谱模型
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
   * @returns {KnowledgeGraphModel} 知识图谱模型
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
   * @returns {KnowledgeGraphModel} 知识图谱模型
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
   * @returns {KnowledgeGraphModel} 知识图谱模型
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
   * @returns {KnowledgeGraphModel} 知识图谱模型
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
   * @returns {KnowledgeGraphModel} 知识图谱模型
   */
  setThumbnailPath(thumbnailPath) {
    this.thumbnail_path = thumbnailPath;
    this.isModified = true;
    this.modifiedFields.add('thumbnail_path');
    return this;
  }

  /**
   * 查找用户的知识图谱
   * @param {string} userId 用户ID
   * @param {Object} options 选项
   * @returns {Promise<Array<KnowledgeGraphModel>>} 知识图谱模型数组
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
        const graphs = await this.find(filter);
        
        const filteredGraphs = graphs.filter(graph => 
          graph.title.toLowerCase().includes(searchLower) || 
          graph.description.toLowerCase().includes(searchLower) ||
          graph.tags.some(tag => tag.toLowerCase().includes(searchLower))
        );
        
        // 排序
        const sortField = Object.keys(sort)[0];
        const sortDirection = sort[sortField];
        
        filteredGraphs.sort((a, b) => {
          if (sortDirection === 1) {
            return a[sortField] > b[sortField] ? 1 : -1;
          } else {
            return a[sortField] < b[sortField] ? 1 : -1;
          }
        });
        
        // 分页
        return filteredGraphs.slice(skip, skip + limit);
      }
      
      return this.find(filter, { sort, limit, skip });
    } catch (error) {
      logService.error('查找用户知识图谱失败', error);
      throw error;
    }
  }

  /**
   * 查找收藏的知识图谱
   * @param {string} userId 用户ID
   * @param {Object} options 选项
   * @returns {Promise<Array<KnowledgeGraphModel>>} 知识图谱模型数组
   */
  static async findFavorites(userId, options = {}) {
    try {
      return this.findByUser(userId, {
        ...options,
        is_favorite: true,
      });
    } catch (error) {
      logService.error('查找收藏知识图谱失败', error);
      throw error;
    }
  }

  /**
   * 查找最近的知识图谱
   * @param {string} userId 用户ID
   * @param {number} limit 限制数量
   * @returns {Promise<Array<KnowledgeGraphModel>>} 知识图谱模型数组
   */
  static async findRecent(userId, limit = 10) {
    try {
      return this.findByUser(userId, {
        limit,
        sort: { updated_at: -1 },
      });
    } catch (error) {
      logService.error('查找最近知识图谱失败', error);
      throw error;
    }
  }

  /**
   * 搜索知识图谱
   * @param {string} query 搜索关键词
   * @param {string} userId 用户ID
   * @param {Object} options 选项
   * @returns {Promise<Array<KnowledgeGraphModel>>} 知识图谱模型数组
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
      logService.error('搜索知识图谱失败', error);
      throw error;
    }
  }

  /**
   * 创建新的知识图谱
   * @param {string} title 标题
   * @param {string} userId 用户ID
   * @param {Object} options 选项
   * @returns {Promise<KnowledgeGraphModel>} 知识图谱模型
   */
  static async createNew(title, userId, options = {}) {
    try {
      const { description = '', categoryId = null } = options;
      
      return this.create({
        title,
        description,
        user_id: userId,
        category_id: categoryId,
      });
    } catch (error) {
      logService.error('创建知识图谱失败', error);
      throw error;
    }
  }

  /**
   * 获取知识图谱的节点和边
   * @returns {Promise<Object>} 节点和边
   */
  async getNodesAndEdges() {
    try {
      const { KnowledgeNodeModel, KnowledgeEdgeModel } = require('./index');
      
      // 获取节点
      const nodes = await KnowledgeNodeModel.findByGraph(this._id);
      
      // 获取边
      const edges = await KnowledgeEdgeModel.findByGraph(this._id);
      
      return { nodes, edges };
    } catch (error) {
      logService.error('获取知识图谱节点和边失败', error);
      throw error;
    }
  }

  /**
   * 复制知识图谱
   * @param {string} newTitle 新标题
   * @returns {Promise<KnowledgeGraphModel>} 新知识图谱模型
   */
  async duplicate(newTitle) {
    try {
      const { KnowledgeNodeModel, KnowledgeEdgeModel } = require('./index');
      
      // 创建新的知识图谱
      const newGraph = await KnowledgeGraphModel.create({
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
      
      // 获取原图谱的节点和边
      const { nodes, edges } = await this.getNodesAndEdges();
      
      // 节点ID映射
      const nodeIdMap = {};
      
      // 复制节点
      for (const node of nodes) {
        const newNode = await KnowledgeNodeModel.create({
          title: node.title,
          content: node.content,
          graph_id: newGraph._id,
          user_id: this.user_id,
          position: { ...node.position },
          color: node.color,
          size: node.size,
          shape: node.shape,
          metadata: { ...node.metadata },
          tags: [...node.tags],
        });
        
        // 记录节点ID映射
        nodeIdMap[node._id] = newNode._id;
      }
      
      // 复制边
      for (const edge of edges) {
        // 检查源节点和目标节点是否存在
        if (nodeIdMap[edge.source_id] && nodeIdMap[edge.target_id]) {
          await KnowledgeEdgeModel.create({
            source_id: nodeIdMap[edge.source_id],
            target_id: nodeIdMap[edge.target_id],
            graph_id: newGraph._id,
            user_id: this.user_id,
            label: edge.label,
            type: edge.type,
            color: edge.color,
            width: edge.width,
            metadata: { ...edge.metadata },
          });
        }
      }
      
      return newGraph;
    } catch (error) {
      logService.error('复制知识图谱失败', error);
      throw error;
    }
  }
}

// 设置集合名称
KnowledgeGraphModel.collectionName = 'KnowledgeGraph';

export default KnowledgeGraphModel;
