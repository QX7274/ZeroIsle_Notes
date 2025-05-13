/**
 * 知识节点模型类
 */

import BaseModel from './BaseModel';
import { logService } from '../services/utils/logService';

class KnowledgeNodeModel extends BaseModel {
  constructor(data = {}) {
    super(data, 'KnowledgeNode');
    
    this.title = data.title || '';
    this.content = data.content || '';
    this.graph_id = data.graph_id || null;
    this.user_id = data.user_id || null;
    this.position = data.position || { x: 0, y: 0 };
    this.color = data.color || null;
    this.size = data.size || 'medium';
    this.shape = data.shape || 'circle';
    this.is_deleted = data.is_deleted || false;
    this.is_synced = data.is_synced || false;
    this.created_at = data.created_at || null;
    this.updated_at = data.updated_at || null;
    this.deleted_at = data.deleted_at || null;
    this.metadata = data.metadata || {};
    this.tags = data.tags || [];
    this.note_id = data.note_id || null;
    this.file_id = data.file_id || null;
    this.url = data.url || null;
  }

  /**
   * 更新标题
   * @param {string} title 标题
   * @returns {KnowledgeNodeModel} 知识节点模型
   */
  updateTitle(title) {
    this.title = title;
    this.isModified = true;
    this.modifiedFields.add('title');
    return this;
  }

  /**
   * 更新内容
   * @param {string} content 内容
   * @returns {KnowledgeNodeModel} 知识节点模型
   */
  updateContent(content) {
    this.content = content;
    this.isModified = true;
    this.modifiedFields.add('content');
    return this;
  }

  /**
   * 设置位置
   * @param {number} x X坐标
   * @param {number} y Y坐标
   * @returns {KnowledgeNodeModel} 知识节点模型
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
   * @returns {KnowledgeNodeModel} 知识节点模型
   */
  setColor(color) {
    this.color = color;
    this.isModified = true;
    this.modifiedFields.add('color');
    return this;
  }

  /**
   * 设置大小
   * @param {string} size 大小
   * @returns {KnowledgeNodeModel} 知识节点模型
   */
  setSize(size) {
    this.size = size;
    this.isModified = true;
    this.modifiedFields.add('size');
    return this;
  }

  /**
   * 设置形状
   * @param {string} shape 形状
   * @returns {KnowledgeNodeModel} 知识节点模型
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
   * @returns {KnowledgeNodeModel} 知识节点模型
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
   * 添加标签
   * @param {string} tag 标签
   * @returns {KnowledgeNodeModel} 知识节点模型
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
   * @returns {KnowledgeNodeModel} 知识节点模型
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
   * 关联笔记
   * @param {string} noteId 笔记ID
   * @returns {KnowledgeNodeModel} 知识节点模型
   */
  linkNote(noteId) {
    this.note_id = noteId;
    this.isModified = true;
    this.modifiedFields.add('note_id');
    return this;
  }

  /**
   * 关联文件
   * @param {string} fileId 文件ID
   * @returns {KnowledgeNodeModel} 知识节点模型
   */
  linkFile(fileId) {
    this.file_id = fileId;
    this.isModified = true;
    this.modifiedFields.add('file_id');
    return this;
  }

  /**
   * 设置URL
   * @param {string} url URL
   * @returns {KnowledgeNodeModel} 知识节点模型
   */
  setUrl(url) {
    this.url = url;
    this.isModified = true;
    this.modifiedFields.add('url');
    return this;
  }

  /**
   * 查找图谱的节点
   * @param {string} graphId 图谱ID
   * @param {Object} options 选项
   * @returns {Promise<Array<KnowledgeNodeModel>>} 知识节点模型数组
   */
  static async findByGraph(graphId, options = {}) {
    try {
      const {
        limit = 1000,
        skip = 0,
        sort = { created_at: 1 },
        is_deleted = false,
      } = options;
      
      const filter = { graph_id: graphId, is_deleted };
      
      return this.find(filter, { sort, limit, skip });
    } catch (error) {
      logService.error('查找图谱节点失败', error);
      throw error;
    }
  }

  /**
   * 查找用户的节点
   * @param {string} userId 用户ID
   * @param {Object} options 选项
   * @returns {Promise<Array<KnowledgeNodeModel>>} 知识节点模型数组
   */
  static async findByUser(userId, options = {}) {
    try {
      const {
        limit = 50,
        skip = 0,
        sort = { updated_at: -1 },
        is_deleted = false,
        graph_id = null,
        search = null,
      } = options;
      
      const filter = { user_id: userId, is_deleted };
      
      if (graph_id) {
        filter.graph_id = graph_id;
      }
      
      // 简单的搜索实现
      if (search) {
        const searchLower = search.toLowerCase();
        const nodes = await this.find(filter);
        
        const filteredNodes = nodes.filter(node => 
          node.title.toLowerCase().includes(searchLower) || 
          node.content.toLowerCase().includes(searchLower) ||
          node.tags.some(tag => tag.toLowerCase().includes(searchLower))
        );
        
        // 排序
        const sortField = Object.keys(sort)[0];
        const sortDirection = sort[sortField];
        
        filteredNodes.sort((a, b) => {
          if (sortDirection === 1) {
            return a[sortField] > b[sortField] ? 1 : -1;
          } else {
            return a[sortField] < b[sortField] ? 1 : -1;
          }
        });
        
        // 分页
        return filteredNodes.slice(skip, skip + limit);
      }
      
      return this.find(filter, { sort, limit, skip });
    } catch (error) {
      logService.error('查找用户节点失败', error);
      throw error;
    }
  }

  /**
   * 查找关联笔记的节点
   * @param {string} noteId 笔记ID
   * @returns {Promise<Array<KnowledgeNodeModel>>} 知识节点模型数组
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
   * 查找关联文件的节点
   * @param {string} fileId 文件ID
   * @returns {Promise<Array<KnowledgeNodeModel>>} 知识节点模型数组
   */
  static async findByFile(fileId) {
    try {
      return this.find({
        file_id: fileId,
        is_deleted: false,
      });
    } catch (error) {
      logService.error('查找关联文件的节点失败', error);
      throw error;
    }
  }

  /**
   * 搜索节点
   * @param {string} query 搜索关键词
   * @param {string} graphId 图谱ID
   * @param {Object} options 选项
   * @returns {Promise<Array<KnowledgeNodeModel>>} 知识节点模型数组
   */
  static async search(query, graphId, options = {}) {
    try {
      const {
        limit = 20,
        skip = 0,
      } = options;
      
      const filter = {
        graph_id: graphId,
        is_deleted: false,
      };
      
      const nodes = await this.find(filter);
      
      const searchLower = query.toLowerCase();
      const results = nodes.filter(node => 
        node.title.toLowerCase().includes(searchLower) || 
        node.content.toLowerCase().includes(searchLower) ||
        node.tags.some(tag => tag.toLowerCase().includes(searchLower))
      );
      
      // 计算相关性分数
      const scoredResults = results.map(node => {
        let score = 0;
        
        // 标题匹配得分高
        if (node.title.toLowerCase().includes(searchLower)) {
          score += 3;
        }
        
        // 内容匹配
        if (node.content.toLowerCase().includes(searchLower)) {
          score += 1;
        }
        
        // 标签匹配
        if (node.tags.some(tag => tag.toLowerCase().includes(searchLower))) {
          score += 2;
        }
        
        return { node, score };
      });
      
      // 按相关性排序
      scoredResults.sort((a, b) => b.score - a.score);
      
      // 分页
      return scoredResults
        .slice(skip, skip + limit)
        .map(item => item.node);
    } catch (error) {
      logService.error('搜索节点失败', error);
      throw error;
    }
  }

  /**
   * 获取节点的连接节点
   * @returns {Promise<Object>} 连接节点
   */
  async getConnectedNodes() {
    try {
      const { KnowledgeEdgeModel } = require('./index');
      
      // 获取以该节点为源的边
      const outgoingEdges = await KnowledgeEdgeModel.find({
        source_id: this._id,
        is_deleted: false,
      });
      
      // 获取以该节点为目标的边
      const incomingEdges = await KnowledgeEdgeModel.find({
        target_id: this._id,
        is_deleted: false,
      });
      
      // 获取连接的节点ID
      const connectedNodeIds = new Set();
      
      outgoingEdges.forEach(edge => connectedNodeIds.add(edge.target_id));
      incomingEdges.forEach(edge => connectedNodeIds.add(edge.source_id));
      
      // 获取连接的节点
      const connectedNodes = await Promise.all(
        Array.from(connectedNodeIds).map(id => this.constructor.findById(id))
      );
      
      return {
        outgoingEdges,
        incomingEdges,
        connectedNodes: connectedNodes.filter(Boolean),
      };
    } catch (error) {
      logService.error('获取连接节点失败', error);
      throw error;
    }
  }
}

// 设置集合名称
KnowledgeNodeModel.collectionName = 'KnowledgeNode';

export default KnowledgeNodeModel;
