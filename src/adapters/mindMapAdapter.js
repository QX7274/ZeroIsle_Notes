/**
 * 思维导图模型适配器
 * 用于在前端和后端模型之间进行转换
 */

import { MindMapModel, MindMapNodeModel } from '../models';
import { logService } from '../services/utils/logService';
import { offlineSyncService } from '../services/offline/offlineSyncService';

/**
 * 将后端思维导图模型转换为前端思维导图对象
 * @param {Object} mindMap 后端思维导图模型
 * @returns {Object} 前端思维导图对象
 */
export const toFrontendMindMap = (mindMap) => {
  if (!mindMap) return null;
  
  try {
    return {
      id: mindMap._id,
      name: mindMap.name || '',
      description: mindMap.description || '',
      isDeleted: mindMap.is_deleted || false,
      isSynced: mindMap.is_synced || false,
      userId: mindMap.user_id,
      createdAt: mindMap.created_at ? new Date(mindMap.created_at) : new Date(),
      updatedAt: mindMap.updated_at ? new Date(mindMap.updated_at) : new Date(),
      deletedAt: mindMap.deleted_at ? new Date(mindMap.deleted_at) : null,
      metadata: { ...(mindMap.metadata || {}) },
      tags: [...(mindMap.tags || [])],
      rootNodeId: mindMap.root_node_id,
      nodes: (mindMap.nodes || []).map(toFrontendNode),
      noteId: mindMap.note_id,
    };
  } catch (error) {
    logService.error('转换思维导图模型失败', error);
    return null;
  }
};

/**
 * 将后端思维导图节点模型转换为前端思维导图节点对象
 * @param {Object} node 后端思维导图节点模型
 * @returns {Object} 前端思维导图节点对象
 */
export const toFrontendNode = (node) => {
  if (!node) return null;
  
  try {
    return {
      id: node._id,
      mindMapId: node.mind_map_id,
      parentId: node.parent_id,
      content: node.content || '',
      note: node.note || '',
      position: node.position || { x: 0, y: 0 },
      size: node.size || { width: 150, height: 50 },
      style: { ...(node.style || {}) },
      isDeleted: node.is_deleted || false,
      isSynced: node.is_synced || false,
      createdAt: node.created_at ? new Date(node.created_at) : new Date(),
      updatedAt: node.updated_at ? new Date(node.updated_at) : new Date(),
      deletedAt: node.deleted_at ? new Date(node.deleted_at) : null,
      metadata: { ...(node.metadata || {}) },
      children: [...(node.children || [])],
      isExpanded: node.is_expanded || true,
      isRoot: node.is_root || false,
      level: node.level || 0,
      order: node.order || 0,
    };
  } catch (error) {
    logService.error('转换思维导图节点模型失败', error);
    return null;
  }
};

/**
 * 将前端思维导图对象转换为后端思维导图模型
 * @param {Object} mindMap 前端思维导图对象
 * @returns {Object} 后端思维导图模型
 */
export const toBackendMindMap = (mindMap) => {
  if (!mindMap) return null;
  
  try {
    return {
      _id: mindMap.id,
      name: mindMap.name || '',
      description: mindMap.description || '',
      is_deleted: mindMap.isDeleted || false,
      is_synced: mindMap.isSynced || false,
      user_id: mindMap.userId,
      created_at: mindMap.createdAt || new Date(),
      updated_at: mindMap.updatedAt || new Date(),
      deleted_at: mindMap.deletedAt || null,
      metadata: { ...(mindMap.metadata || {}) },
      tags: [...(mindMap.tags || [])],
      root_node_id: mindMap.rootNodeId,
      nodes: (mindMap.nodes || []).map(toBackendNode),
      note_id: mindMap.noteId,
    };
  } catch (error) {
    logService.error('转换思维导图对象失败', error);
    return null;
  }
};

/**
 * 将前端思维导图节点对象转换为后端思维导图节点模型
 * @param {Object} node 前端思维导图节点对象
 * @returns {Object} 后端思维导图节点模型
 */
export const toBackendNode = (node) => {
  if (!node) return null;
  
  try {
    return {
      _id: node.id,
      mind_map_id: node.mindMapId,
      parent_id: node.parentId,
      content: node.content || '',
      note: node.note || '',
      position: node.position || { x: 0, y: 0 },
      size: node.size || { width: 150, height: 50 },
      style: { ...(node.style || {}) },
      is_deleted: node.isDeleted || false,
      is_synced: node.isSynced || false,
      created_at: node.createdAt || new Date(),
      updated_at: node.updatedAt || new Date(),
      deleted_at: node.deletedAt || null,
      metadata: { ...(node.metadata || {}) },
      children: [...(node.children || [])],
      is_expanded: node.isExpanded || true,
      is_root: node.isRoot || false,
      level: node.level || 0,
      order: node.order || 0,
    };
  } catch (error) {
    logService.error('转换思维导图节点对象失败', error);
    return null;
  }
};

/**
 * 创建思维导图
 * @param {Object} mindMapData 思维导图数据
 * @param {string} userId 用户ID
 * @returns {Promise<Object>} 创建的思维导图
 */
export const createMindMap = async (mindMapData, userId) => {
  try {
    // 准备思维导图数据
    const now = new Date();
    const mindMapId = `mindmap_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    
    // 创建根节点
    const rootNodeId = `node_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;
    
    const rootNode = {
      _id: rootNodeId,
      mind_map_id: mindMapId,
      parent_id: null,
      content: mindMapData.rootContent || '中心主题',
      note: '',
      position: { x: 0, y: 0 },
      size: { width: 200, height: 60 },
      style: { backgroundColor: '#4CAF50', color: '#FFFFFF', borderRadius: '10px' },
      is_deleted: false,
      is_synced: false,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      metadata: {},
      children: [],
      is_expanded: true,
      is_root: true,
      level: 0,
      order: 0,
    };
    
    const backendMindMap = {
      _id: mindMapId,
      name: mindMapData.name || '新思维导图',
      description: mindMapData.description || '',
      is_deleted: false,
      is_synced: false,
      user_id: userId,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      metadata: { ...(mindMapData.metadata || {}) },
      tags: [...(mindMapData.tags || [])],
      root_node_id: rootNodeId,
      nodes: [rootNode],
      note_id: mindMapData.noteId,
    };
    
    // 创建思维导图模型
    const mindMap = await MindMapModel.create(backendMindMap);
    
    // 添加到同步队列
    await offlineSyncService.addToSyncQueue({
      entity_id: mindMap._id,
      entity_type: 'mind_map',
      operation: 'create',
      data: mindMap.toJSON(),
      user_id: userId,
    });
    
    // 返回前端思维导图对象
    return toFrontendMindMap(mindMap);
  } catch (error) {
    logService.error('创建思维导图失败', error);
    throw error;
  }
};

/**
 * 添加思维导图节点
 * @param {string} mindMapId 思维导图ID
 * @param {string} parentId 父节点ID
 * @param {Object} nodeData 节点数据
 * @returns {Promise<Object>} 添加的节点
 */
export const addNode = async (mindMapId, parentId, nodeData) => {
  try {
    // 查找思维导图
    const mindMap = await MindMapModel.findById(mindMapId);
    
    if (!mindMap) {
      throw new Error(`思维导图不存在: ${mindMapId}`);
    }
    
    // 查找父节点
    const parentNode = mindMap.nodes.find(node => node._id === parentId);
    
    if (!parentNode) {
      throw new Error(`父节点不存在: ${parentId}`);
    }
    
    // 准备节点数据
    const now = new Date();
    const nodeId = `node_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    
    const backendNode = {
      _id: nodeId,
      mind_map_id: mindMapId,
      parent_id: parentId,
      content: nodeData.content || '新节点',
      note: nodeData.note || '',
      position: nodeData.position || { x: 0, y: 0 },
      size: nodeData.size || { width: 150, height: 50 },
      style: { ...(nodeData.style || {}) },
      is_deleted: false,
      is_synced: false,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      metadata: { ...(nodeData.metadata || {}) },
      children: [],
      is_expanded: true,
      is_root: false,
      level: parentNode.level + 1,
      order: parentNode.children.length,
    };
    
    // 创建节点模型
    const node = await MindMapNodeModel.create(backendNode);
    
    // 更新父节点
    parentNode.children.push(nodeId);
    
    // 更新思维导图
    mindMap.nodes.push(node);
    mindMap.updated_at = now;
    mindMap.is_synced = false;
    await mindMap.save();
    
    // 添加到同步队列
    await offlineSyncService.addToSyncQueue({
      entity_id: node._id,
      entity_type: 'mind_map_node',
      operation: 'create',
      data: node.toJSON(),
      user_id: mindMap.user_id,
    });
    
    // 返回前端节点对象
    return toFrontendNode(node);
  } catch (error) {
    logService.error(`添加思维导图节点失败: ${mindMapId}`, error);
    throw error;
  }
};

/**
 * 更新思维导图节点
 * @param {string} mindMapId 思维导图ID
 * @param {string} nodeId 节点ID
 * @param {Object} nodeData 节点数据
 * @returns {Promise<Object>} 更新后的节点
 */
export const updateNode = async (mindMapId, nodeId, nodeData) => {
  try {
    // 查找思维导图
    const mindMap = await MindMapModel.findById(mindMapId);
    
    if (!mindMap) {
      throw new Error(`思维导图不存在: ${mindMapId}`);
    }
    
    // 查找节点
    const nodeIndex = mindMap.nodes.findIndex(node => node._id === nodeId);
    
    if (nodeIndex === -1) {
      throw new Error(`节点不存在: ${nodeId}`);
    }
    
    const node = mindMap.nodes[nodeIndex];
    
    // 更新节点属性
    if (nodeData.content !== undefined) node.content = nodeData.content;
    if (nodeData.note !== undefined) node.note = nodeData.note;
    if (nodeData.position !== undefined) node.position = nodeData.position;
    if (nodeData.size !== undefined) node.size = nodeData.size;
    if (nodeData.style !== undefined) node.style = { ...node.style, ...nodeData.style };
    if (nodeData.isExpanded !== undefined) node.is_expanded = nodeData.isExpanded;
    if (nodeData.metadata !== undefined) node.metadata = { ...node.metadata, ...nodeData.metadata };
    
    // 更新时间
    node.updated_at = new Date();
    node.is_synced = false;
    
    // 更新思维导图
    mindMap.nodes[nodeIndex] = node;
    mindMap.updated_at = new Date();
    mindMap.is_synced = false;
    await mindMap.save();
    
    // 添加到同步队列
    await offlineSyncService.addToSyncQueue({
      entity_id: node._id,
      entity_type: 'mind_map_node',
      operation: 'update',
      data: node,
      user_id: mindMap.user_id,
    });
    
    // 返回前端节点对象
    return toFrontendNode(node);
  } catch (error) {
    logService.error(`更新思维导图节点失败: ${nodeId}`, error);
    throw error;
  }
};
