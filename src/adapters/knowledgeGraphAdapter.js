/**
 * 知识图谱模型适配器
 * 用于在前端和后端模型之间进行转换
 */

import { KnowledgeGraphModel, KnowledgeNodeModel, KnowledgeEdgeModel } from '../models';
import { logService } from '../services/utils/logService';
import { offlineSyncService } from '../services/offline/offlineSyncService';

/**
 * 将后端知识图谱模型转换为前端知识图谱对象
 * @param {Object} graph 后端知识图谱模型
 * @returns {Object} 前端知识图谱对象
 */
export const toFrontendGraph = (graph) => {
  if (!graph) return null;
  
  try {
    return {
      id: graph._id,
      name: graph.name || '',
      description: graph.description || '',
      isDeleted: graph.is_deleted || false,
      isSynced: graph.is_synced || false,
      userId: graph.user_id,
      createdAt: graph.created_at ? new Date(graph.created_at) : new Date(),
      updatedAt: graph.updated_at ? new Date(graph.updated_at) : new Date(),
      deletedAt: graph.deleted_at ? new Date(graph.deleted_at) : null,
      metadata: { ...(graph.metadata || {}) },
      tags: [...(graph.tags || [])],
      nodes: (graph.nodes || []).map(toFrontendNode),
      edges: (graph.edges || []).map(toFrontendEdge),
    };
  } catch (error) {
    logService.error('转换知识图谱模型失败', error);
    return null;
  }
};

/**
 * 将后端知识节点模型转换为前端知识节点对象
 * @param {Object} node 后端知识节点模型
 * @returns {Object} 前端知识节点对象
 */
export const toFrontendNode = (node) => {
  if (!node) return null;
  
  try {
    return {
      id: node._id,
      graphId: node.graph_id,
      label: node.label || '',
      type: node.type || 'concept',
      content: node.content || '',
      position: node.position || { x: 0, y: 0 },
      size: node.size || { width: 150, height: 50 },
      style: { ...(node.style || {}) },
      isDeleted: node.is_deleted || false,
      isSynced: node.is_synced || false,
      createdAt: node.created_at ? new Date(node.created_at) : new Date(),
      updatedAt: node.updated_at ? new Date(node.updated_at) : new Date(),
      deletedAt: node.deleted_at ? new Date(node.deleted_at) : null,
      metadata: { ...(node.metadata || {}) },
      noteId: node.note_id,
    };
  } catch (error) {
    logService.error('转换知识节点模型失败', error);
    return null;
  }
};

/**
 * 将后端知识边模型转换为前端知识边对象
 * @param {Object} edge 后端知识边模型
 * @returns {Object} 前端知识边对象
 */
export const toFrontendEdge = (edge) => {
  if (!edge) return null;
  
  try {
    return {
      id: edge._id,
      graphId: edge.graph_id,
      source: edge.source,
      target: edge.target,
      label: edge.label || '',
      type: edge.type || 'relation',
      style: { ...(edge.style || {}) },
      isDeleted: edge.is_deleted || false,
      isSynced: edge.is_synced || false,
      createdAt: edge.created_at ? new Date(edge.created_at) : new Date(),
      updatedAt: edge.updated_at ? new Date(edge.updated_at) : new Date(),
      deletedAt: edge.deleted_at ? new Date(edge.deleted_at) : null,
      metadata: { ...(edge.metadata || {}) },
    };
  } catch (error) {
    logService.error('转换知识边模型失败', error);
    return null;
  }
};

/**
 * 将前端知识图谱对象转换为后端知识图谱模型
 * @param {Object} graph 前端知识图谱对象
 * @returns {Object} 后端知识图谱模型
 */
export const toBackendGraph = (graph) => {
  if (!graph) return null;
  
  try {
    return {
      _id: graph.id,
      name: graph.name || '',
      description: graph.description || '',
      is_deleted: graph.isDeleted || false,
      is_synced: graph.isSynced || false,
      user_id: graph.userId,
      created_at: graph.createdAt || new Date(),
      updated_at: graph.updatedAt || new Date(),
      deleted_at: graph.deletedAt || null,
      metadata: { ...(graph.metadata || {}) },
      tags: [...(graph.tags || [])],
      nodes: (graph.nodes || []).map(toBackendNode),
      edges: (graph.edges || []).map(toBackendEdge),
    };
  } catch (error) {
    logService.error('转换知识图谱对象失败', error);
    return null;
  }
};

/**
 * 将前端知识节点对象转换为后端知识节点模型
 * @param {Object} node 前端知识节点对象
 * @returns {Object} 后端知识节点模型
 */
export const toBackendNode = (node) => {
  if (!node) return null;
  
  try {
    return {
      _id: node.id,
      graph_id: node.graphId,
      label: node.label || '',
      type: node.type || 'concept',
      content: node.content || '',
      position: node.position || { x: 0, y: 0 },
      size: node.size || { width: 150, height: 50 },
      style: { ...(node.style || {}) },
      is_deleted: node.isDeleted || false,
      is_synced: node.isSynced || false,
      created_at: node.createdAt || new Date(),
      updated_at: node.updatedAt || new Date(),
      deleted_at: node.deletedAt || null,
      metadata: { ...(node.metadata || {}) },
      note_id: node.noteId,
    };
  } catch (error) {
    logService.error('转换知识节点对象失败', error);
    return null;
  }
};

/**
 * 将前端知识边对象转换为后端知识边模型
 * @param {Object} edge 前端知识边对象
 * @returns {Object} 后端知识边模型
 */
export const toBackendEdge = (edge) => {
  if (!edge) return null;
  
  try {
    return {
      _id: edge.id,
      graph_id: edge.graphId,
      source: edge.source,
      target: edge.target,
      label: edge.label || '',
      type: edge.type || 'relation',
      style: { ...(edge.style || {}) },
      is_deleted: edge.isDeleted || false,
      is_synced: edge.isSynced || false,
      created_at: edge.createdAt || new Date(),
      updated_at: edge.updatedAt || new Date(),
      deleted_at: edge.deletedAt || null,
      metadata: { ...(edge.metadata || {}) },
    };
  } catch (error) {
    logService.error('转换知识边对象失败', error);
    return null;
  }
};

/**
 * 创建知识图谱
 * @param {Object} graphData 图谱数据
 * @param {string} userId 用户ID
 * @returns {Promise<Object>} 创建的图谱
 */
export const createGraph = async (graphData, userId) => {
  try {
    // 准备图谱数据
    const now = new Date();
    const graphId = `graph_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    
    const backendGraph = {
      _id: graphId,
      name: graphData.name || '新知识图谱',
      description: graphData.description || '',
      is_deleted: false,
      is_synced: false,
      user_id: userId,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      metadata: { ...(graphData.metadata || {}) },
      tags: [...(graphData.tags || [])],
      nodes: [],
      edges: [],
    };
    
    // 创建图谱模型
    const graph = await KnowledgeGraphModel.create(backendGraph);
    
    // 添加到同步队列
    await offlineSyncService.addToSyncQueue({
      entity_id: graph._id,
      entity_type: 'knowledge_graph',
      operation: 'create',
      data: graph.toJSON(),
      user_id: userId,
    });
    
    // 返回前端图谱对象
    return toFrontendGraph(graph);
  } catch (error) {
    logService.error('创建知识图谱失败', error);
    throw error;
  }
};

/**
 * 添加知识节点
 * @param {string} graphId 图谱ID
 * @param {Object} nodeData 节点数据
 * @returns {Promise<Object>} 添加的节点
 */
export const addNode = async (graphId, nodeData) => {
  try {
    // 查找图谱
    const graph = await KnowledgeGraphModel.findById(graphId);
    
    if (!graph) {
      throw new Error(`图谱不存在: ${graphId}`);
    }
    
    // 准备节点数据
    const now = new Date();
    const nodeId = `node_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    
    const backendNode = {
      _id: nodeId,
      graph_id: graphId,
      label: nodeData.label || '',
      type: nodeData.type || 'concept',
      content: nodeData.content || '',
      position: nodeData.position || { x: 0, y: 0 },
      size: nodeData.size || { width: 150, height: 50 },
      style: { ...(nodeData.style || {}) },
      is_deleted: false,
      is_synced: false,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      metadata: { ...(nodeData.metadata || {}) },
      note_id: nodeData.noteId,
    };
    
    // 创建节点模型
    const node = await KnowledgeNodeModel.create(backendNode);
    
    // 更新图谱
    graph.nodes.push(node);
    graph.updated_at = now;
    graph.is_synced = false;
    await graph.save();
    
    // 添加到同步队列
    await offlineSyncService.addToSyncQueue({
      entity_id: node._id,
      entity_type: 'knowledge_node',
      operation: 'create',
      data: node.toJSON(),
      user_id: graph.user_id,
    });
    
    // 返回前端节点对象
    return toFrontendNode(node);
  } catch (error) {
    logService.error(`添加知识节点失败: ${graphId}`, error);
    throw error;
  }
};

/**
 * 添加知识边
 * @param {string} graphId 图谱ID
 * @param {Object} edgeData 边数据
 * @returns {Promise<Object>} 添加的边
 */
export const addEdge = async (graphId, edgeData) => {
  try {
    // 查找图谱
    const graph = await KnowledgeGraphModel.findById(graphId);
    
    if (!graph) {
      throw new Error(`图谱不存在: ${graphId}`);
    }
    
    // 准备边数据
    const now = new Date();
    const edgeId = `edge_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    
    const backendEdge = {
      _id: edgeId,
      graph_id: graphId,
      source: edgeData.source,
      target: edgeData.target,
      label: edgeData.label || '',
      type: edgeData.type || 'relation',
      style: { ...(edgeData.style || {}) },
      is_deleted: false,
      is_synced: false,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      metadata: { ...(edgeData.metadata || {}) },
    };
    
    // 创建边模型
    const edge = await KnowledgeEdgeModel.create(backendEdge);
    
    // 更新图谱
    graph.edges.push(edge);
    graph.updated_at = now;
    graph.is_synced = false;
    await graph.save();
    
    // 添加到同步队列
    await offlineSyncService.addToSyncQueue({
      entity_id: edge._id,
      entity_type: 'knowledge_edge',
      operation: 'create',
      data: edge.toJSON(),
      user_id: graph.user_id,
    });
    
    // 返回前端边对象
    return toFrontendEdge(edge);
  } catch (error) {
    logService.error(`添加知识边失败: ${graphId}`, error);
    throw error;
  }
};
