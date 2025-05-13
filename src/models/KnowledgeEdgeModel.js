/**
 * 知识边模型类
 */

import BaseModel from './BaseModel';
import { logService } from '../services/utils/logService';

class KnowledgeEdgeModel extends BaseModel {
  constructor(data = {}) {
    super(data, 'KnowledgeEdge');
    
    this.source_id = data.source_id || null;
    this.target_id = data.target_id || null;
    this.graph_id = data.graph_id || null;
    this.user_id = data.user_id || null;
    this.label = data.label || '';
    this.type = data.type || 'default';
    this.color = data.color || null;
    this.width = data.width || 1;
    this.is_deleted = data.is_deleted || false;
    this.is_synced = data.is_synced || false;
    this.created_at = data.created_at || null;
    this.updated_at = data.updated_at || null;
    this.deleted_at = data.deleted_at || null;
    this.metadata = data.metadata || {};
    this.weight = data.weight || 1;
    this.bidirectional = data.bidirectional || false;
  }

  /**
   * 更新标签
   * @param {string} label 标签
   * @returns {KnowledgeEdgeModel} 知识边模型
   */
  updateLabel(label) {
    this.label = label;
    this.isModified = true;
    this.modifiedFields.add('label');
    return this;
  }

  /**
   * 设置类型
   * @param {string} type 类型
   * @returns {KnowledgeEdgeModel} 知识边模型
   */
  setType(type) {
    this.type = type;
    this.isModified = true;
    this.modifiedFields.add('type');
    return this;
  }

  /**
   * 设置颜色
   * @param {string} color 颜色
   * @returns {KnowledgeEdgeModel} 知识边模型
   */
  setColor(color) {
    this.color = color;
    this.isModified = true;
    this.modifiedFields.add('color');
    return this;
  }

  /**
   * 设置宽度
   * @param {number} width 宽度
   * @returns {KnowledgeEdgeModel} 知识边模型
   */
  setWidth(width) {
    this.width = width;
    this.isModified = true;
    this.modifiedFields.add('width');
    return this;
  }

  /**
   * 更新元数据
   * @param {Object} metadata 元数据
   * @returns {KnowledgeEdgeModel} 知识边模型
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
   * 设置权重
   * @param {number} weight 权重
   * @returns {KnowledgeEdgeModel} 知识边模型
   */
  setWeight(weight) {
    this.weight = weight;
    this.isModified = true;
    this.modifiedFields.add('weight');
    return this;
  }

  /**
   * 设置双向
   * @param {boolean} bidirectional 是否双向
   * @returns {KnowledgeEdgeModel} 知识边模型
   */
  setBidirectional(bidirectional) {
    this.bidirectional = bidirectional;
    this.isModified = true;
    this.modifiedFields.add('bidirectional');
    return this;
  }

  /**
   * 查找图谱的边
   * @param {string} graphId 图谱ID
   * @param {Object} options 选项
   * @returns {Promise<Array<KnowledgeEdgeModel>>} 知识边模型数组
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
      logService.error('查找图谱边失败', error);
      throw error;
    }
  }

  /**
   * 查找节点的边
   * @param {string} nodeId 节点ID
   * @param {Object} options 选项
   * @returns {Promise<Object>} 边对象
   */
  static async findByNode(nodeId, options = {}) {
    try {
      const {
        is_deleted = false,
      } = options;
      
      // 查找以该节点为源的边
      const outgoing = await this.find({
        source_id: nodeId,
        is_deleted,
      });
      
      // 查找以该节点为目标的边
      const incoming = await this.find({
        target_id: nodeId,
        is_deleted,
      });
      
      return { outgoing, incoming };
    } catch (error) {
      logService.error('查找节点边失败', error);
      throw error;
    }
  }

  /**
   * 查找两个节点之间的边
   * @param {string} sourceId 源节点ID
   * @param {string} targetId 目标节点ID
   * @param {Object} options 选项
   * @returns {Promise<Array<KnowledgeEdgeModel>>} 知识边模型数组
   */
  static async findBetweenNodes(sourceId, targetId, options = {}) {
    try {
      const {
        is_deleted = false,
        bidirectional = true,
      } = options;
      
      const filter = { is_deleted };
      
      if (bidirectional) {
        // 查找两个节点之间的所有边（双向）
        return this.find({
          $or: [
            { source_id: sourceId, target_id: targetId },
            { source_id: targetId, target_id: sourceId },
          ],
          ...filter,
        });
      } else {
        // 只查找从源节点到目标节点的边
        return this.find({
          source_id: sourceId,
          target_id: targetId,
          ...filter,
        });
      }
    } catch (error) {
      logService.error('查找节点间边失败', error);
      throw error;
    }
  }

  /**
   * 创建边
   * @param {string} sourceId 源节点ID
   * @param {string} targetId 目标节点ID
   * @param {string} graphId 图谱ID
   * @param {string} userId 用户ID
   * @param {Object} options 选项
   * @returns {Promise<KnowledgeEdgeModel>} 知识边模型
   */
  static async createEdge(sourceId, targetId, graphId, userId, options = {}) {
    try {
      const {
        label = '',
        type = 'default',
        color = null,
        width = 1,
        metadata = {},
        weight = 1,
        bidirectional = false,
      } = options;
      
      // 检查是否已存在相同的边
      const existingEdge = await this.findOne({
        source_id: sourceId,
        target_id: targetId,
        graph_id: graphId,
        is_deleted: false,
      });
      
      if (existingEdge) {
        // 更新现有边
        existingEdge.label = label || existingEdge.label;
        existingEdge.type = type || existingEdge.type;
        existingEdge.color = color || existingEdge.color;
        existingEdge.width = width || existingEdge.width;
        existingEdge.metadata = { ...existingEdge.metadata, ...metadata };
        existingEdge.weight = weight || existingEdge.weight;
        existingEdge.bidirectional = bidirectional;
        
        await existingEdge.save();
        return existingEdge;
      }
      
      // 创建新边
      return this.create({
        source_id: sourceId,
        target_id: targetId,
        graph_id: graphId,
        user_id: userId,
        label,
        type,
        color,
        width,
        metadata,
        weight,
        bidirectional,
      });
    } catch (error) {
      logService.error('创建边失败', error);
      throw error;
    }
  }

  /**
   * 创建双向边
   * @param {string} nodeId1 节点1 ID
   * @param {string} nodeId2 节点2 ID
   * @param {string} graphId 图谱ID
   * @param {string} userId 用户ID
   * @param {Object} options 选项
   * @returns {Promise<Array<KnowledgeEdgeModel>>} 知识边模型数组
   */
  static async createBidirectionalEdges(nodeId1, nodeId2, graphId, userId, options = {}) {
    try {
      // 创建第一个方向的边
      const edge1 = await this.createEdge(nodeId1, nodeId2, graphId, userId, {
        ...options,
        bidirectional: true,
      });
      
      // 创建第二个方向的边
      const edge2 = await this.createEdge(nodeId2, nodeId1, graphId, userId, {
        ...options,
        bidirectional: true,
      });
      
      return [edge1, edge2];
    } catch (error) {
      logService.error('创建双向边失败', error);
      throw error;
    }
  }

  /**
   * 获取边的源节点和目标节点
   * @returns {Promise<Object>} 源节点和目标节点
   */
  async getNodes() {
    try {
      const { KnowledgeNodeModel } = require('./index');
      
      // 获取源节点
      const sourceNode = await KnowledgeNodeModel.findById(this.source_id);
      
      // 获取目标节点
      const targetNode = await KnowledgeNodeModel.findById(this.target_id);
      
      return { sourceNode, targetNode };
    } catch (error) {
      logService.error('获取边节点失败', error);
      throw error;
    }
  }
}

// 设置集合名称
KnowledgeEdgeModel.collectionName = 'KnowledgeEdge';

export default KnowledgeEdgeModel;
