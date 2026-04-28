/**
 * 知识图谱模型适配器
 * 用于在前端和后端模型之间进行转换
 */

import { KnowledgeGraph, KnowledgeNode, KnowledgeEdge } from '../models';
import realmService from '../services/database/realmService';
import tokenService from '../services/auth/tokenService';
import { logService } from '../utils/logService';
import { offlineSyncService } from '../services/offline/offlineSyncService';
import { SearchIndex } from '../models';

/**
 * 将后端知识图谱模型转换为前端知识图谱对象
 * @param {Object} graph 后端知识图谱模型
 * @returns {Object} 前端知识图谱对象
 */
export const toFrontendGraph = (graph) => {
  if (!graph) {return null;}

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
  if (!node) {return null;}

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
  if (!edge) {return null;}

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
  if (!graph) {return null;}

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
  if (!node) {return null;}

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
  if (!edge) {return null;}

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
    const graphId = realmService.createObjectId();

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
    const realm = await realmService.getRealm();
    let graph;
    realm.write(() => {
      graph = realm.create('KnowledgeGraph', backendGraph);
    });

    // 异步更新搜索索引（不阻塞主流程）
    upsertSearchIndexForGraph(graph).catch((e) => {
      logService.warn('[SearchIndex] 异步更新知识图谱索引失败', e?.message || e);
    });

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

const upsertSearchIndexForNode = async (node, graph) => {
  try {
    const realm = await realmService.getRealm();
    const title = String(node.title || '');
    const content = String(node.content || '');
    const clippedContent = content.length > 2000 ? content.slice(0, 2000) : content;
    const tags = Array.isArray(node.tags) ? node.tags.map(String) : [];

    SearchIndex.createOrUpdate(realm, {
      entity_id: String(node._id),
      entity_type: 'knowledge_node',
      user_id: String(graph.user_id || ''),
      title,
      content: clippedContent,
      keywords: title.split(/\s+/).filter(w => w.length >= 2).slice(0, 20),
      tags,
      category: graph.category_id ? String(graph.category_id) : null,
      metadata: {
        graph_id: String(graph._id),
        type: node.type,
      },
      relevance_score: 1.0,
      language: 'zh-CN',
    });
  } catch (e) {
    logService.warn('[SearchIndex] 更新知识节点索引失败，将忽略', e?.message || e);
  }
};

const upsertSearchIndexForGraph = async (graph) => {
  try {
    const realm = await realmService.getRealm();
    const title = String(graph.title || '');
    const desc = String(graph.description || '');
    const clipped = desc.length > 2000 ? desc.slice(0, 2000) : desc;
    const tags = Array.isArray(graph.tags) ? graph.tags.map(String) : [];

    SearchIndex.createOrUpdate(realm, {
      entity_id: String(graph._id),
      entity_type: 'knowledge_graph',
      user_id: String(graph.user_id || ''),
      title,
      content: clipped,
      keywords: title.split(/\s+/).filter(w => w.length >= 2).slice(0, 20),
      tags,
      category: graph.category_id ? String(graph.category_id) : null,
      metadata: {
        type: graph.type,
      },
      relevance_score: 1.0,
      language: 'zh-CN',
    });
  } catch (e) {
    logService.warn('[SearchIndex] 更新知识图谱索引失败，将忽略', e?.message || e);
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
    const realm = await realmService.getRealm();
    const graph = realm.objectForPrimaryKey('KnowledgeGraph', graphId);

    if (!graph) {
      throw new Error(`图谱不存在: ${graphId}`);
    }

    // 准备节点数据
    const now = new Date();
    const nodeId = realmService.createObjectId();

    const backendNode = {
      _id: nodeId,
      title: nodeData.title || nodeData.label || '',
      content: nodeData.content || '',
      type: nodeData.type || 'concept',
      position: JSON.stringify(nodeData.position || { x: 0, y: 0 }),
      size: JSON.stringify(nodeData.size || { width: 150, height: 50 }),
      color: nodeData.color || '#2196F3',
      icon: nodeData.icon || '',
      image: nodeData.image || '',
      note_id: nodeData.noteId,
      user_id: graph.user_id,
      graph_id: graphId,
      tags: Array.isArray(nodeData.tags) ? nodeData.tags : [],
      metadata: JSON.stringify(nodeData.metadata || {}),
      is_deleted: false,
      is_synced: false,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };

    // 创建节点模型
    const writeRealm = await realmService.getRealm();
    let node;
    writeRealm.write(() => {
      node = writeRealm.create('KnowledgeNode', backendNode);

      // 更新图谱更新时间与同步状态（KnowledgeGraph schema 不包含 nodes/edges 列表）
      graph.updated_at = now;
      graph.is_synced = false;
    });

    // 异步更新搜索索引（不阻塞主流程）
    upsertSearchIndexForNode(node, graph).catch((e) => {
      logService.warn('[SearchIndex] 异步更新知识节点索引失败', e?.message || e);
    });

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
    const readRealm = await realmService.getRealm();
    const graph = readRealm.objectForPrimaryKey('KnowledgeGraph', graphId);

    if (!graph) {
      throw new Error(`图谱不存在: ${graphId}`);
    }

    // 准备边数据
    const now = new Date();
    const edgeId = realmService.createObjectId();

    const backendEdge = {
      _id: edgeId,
      source_id: String(edgeData.source || edgeData.source_id || ''),
      target_id: String(edgeData.target || edgeData.target_id || ''),
      type: edgeData.type || 'related',
      label: edgeData.label || '',
      description: edgeData.description || '',
      weight: typeof edgeData.weight === 'number' ? edgeData.weight : 1,
      style: JSON.stringify(edgeData.style || { color: '#666666', width: 1, dashed: false, arrow: true, bidirectional: false }),
      user_id: graph.user_id,
      graph_id: graphId,
      metadata: JSON.stringify(edgeData.metadata || {}),
      is_deleted: false,
      is_synced: false,
      created_at: now,
      updated_at: now,
      deleted_at: null,
    };

    // 创建边模型
    const writeRealm = await realmService.getRealm();
    let edge;
    writeRealm.write(() => {
      edge = writeRealm.create('KnowledgeEdge', backendEdge);

      // 更新图谱更新时间与同步状态（KnowledgeGraph schema 不包含 nodes/edges 列表）
      graph.updated_at = now;
      graph.is_synced = false;
    });

    // 异步更新搜索索引（不阻塞主流程）
    // 目前 SearchIndex 仅接入 KnowledgeGraph/KnowledgeNode，KnowledgeEdge 不入索引
    // 以避免索引膨胀与无效匹配
    // 如后续需要按关系类型搜索，可再单独扩展

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

/**
 * 创建构建任务
 */
export const createBuildTask = async (params) => {
  try {
    const response = await fetch('/api/knowledge-graph/task/build/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${(await tokenService.getAccessToken())?.token || ''}`,
      },
      body: JSON.stringify(params),
    });

    if (!response.ok) {throw new Error(`HTTP ${response.status}`);}
    const data = await response.json();
    if (data.error) {throw new Error(data.error.message);}
    return data.data;
  } catch (error) {
    logService.error('创建构建任务失败', error);
    throw error;
  }
};

/**
 * 获取任务状态
 */
export const getTaskStatus = async (taskId) => {
  try {
    const response = await fetch(`/api/knowledge-graph/task/${taskId}/status/`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${(await tokenService.getAccessToken())?.token || ''}`,
      },
    });

    if (!response.ok) {throw new Error(`HTTP ${response.status}`);}
    const data = await response.json();
    if (data.error) {throw new Error(data.error.message);}
    return data.data;
  } catch (error) {
    logService.error('获取任务状态失败', error);
    throw error;
  }
};

/**
 * 列出用户的任务
 */
export const listTasks = async (params = {}) => {
  try {
    const queryString = new URLSearchParams(params).toString();
    const response = await fetch(`/api/knowledge-graph/task/list/?${queryString}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${(await tokenService.getAccessToken())?.token || ''}`,
      },
    });

    if (!response.ok) {throw new Error(`HTTP ${response.status}`);}
    const data = await response.json();
    if (data.error) {throw new Error(data.error.message);}
    return data;
  } catch (error) {
    logService.error('列出任务失败', error);
    throw error;
  }
};


/**
 * 获取（可聚合）节点列表
 * @param {Object} params { node_types: string[] , aggregate?: boolean, threshold?: number, hide_isolated?: boolean }
 */
export const getGraphNodes = async (params = {}) => {
  const query = new URLSearchParams();
  if (Array.isArray(params.node_types)) {
    params.node_types.forEach((t) => query.append('node_types', t));
  }
  if (typeof params.aggregate !== 'undefined') {query.set('aggregate', String(params.aggregate));}
  if (typeof params.threshold !== 'undefined') {query.set('threshold', String(params.threshold));}
  if (typeof params.hide_isolated !== 'undefined') {query.set('hide_isolated', String(params.hide_isolated));}

  const url = `/api/knowledge-graph/graph/nodes/?${query.toString()}`;
  const tokenData = await tokenService.getAccessToken();
  const token = tokenData ? tokenData.token : null;

  const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
  if (!res.ok) {throw new Error(`HTTP ${res.status}`);}
  const data = await res.json();
  if (data.error) {throw new Error(data.error.message);}
  return data.data;
};

/**
 * 获取候选边
 * @param {string} nodeId 目标节点ID
 * @param {number} topK 数量
 */
export const suggestEdges = async (nodeId, topK = 10) => {
  const url = `/api/knowledge-graph/auto/suggest-edges/?node_id=${encodeURIComponent(nodeId)}&top_k=${topK}`;
  const tokenData = await tokenService.getAccessToken();
  const token = tokenData ? tokenData.token : null;

  const res = await fetch(url, { headers: { 'Authorization': `Bearer ${token}` } });
  if (!res.ok) {throw new Error(`HTTP ${res.status}`);}
  const data = await res.json();
  if (data.error) {throw new Error(data.error.message);}
  return data.data; // [{source,target,type,confidence,evidence[]}]
};

/**
 * 批量采纳候选边
 * @param {Array} edges 边数组
 */
export const acceptSuggestions = async (edges) => {
  const res = await fetch('/api/knowledge-graph/auto/accept-suggestions/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${(await tokenService.getAccessToken())?.token || ''}`,
    },
    body: JSON.stringify({ edges }),
  });
  if (!res.ok) {throw new Error(`HTTP ${res.status}`);}
  const data = await res.json();
  if (data.error) {throw new Error(data.error.message);}
  return data.data; // {accepted, errors}
};

/**
 * 批量忽略候选边
 * @param {Array} edges 边数组
 */
export const ignoreSuggestions = async (edges) => {
  const res = await fetch('/api/knowledge-graph/auto/ignore-suggestions/', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${(await tokenService.getAccessToken())?.token || ''}`,
    },
    body: JSON.stringify({ edges }),
  });
  if (!res.ok) {throw new Error(`HTTP ${res.status}`);}
  const data = await res.json();
  if (data.error) {throw new Error(data.error.message);}
  return data.data; // {ignored, errors}
};
