/**
 * 知识图谱API服务
 */
import instance from './interceptor';
import { API_ENDPOINTS } from '../../config/api';

/**
 * 获取知识图谱
 * @param {object} params - 查询参数
 * @returns {Promise} - 知识图谱数据
 */
export const getKnowledgeGraph = async (params = {}) => {
  try {
    const response = await instance.get(API_ENDPOINTS.KNOWLEDGE_GRAPH.BASE, { params });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '获取知识图谱失败',
      error
    };
  }
};

/**
 * 获取所有节点
 * @param {object} params - 查询参数
 * @returns {Promise} - 节点列表
 */
export const getAllNodes = async (params = {}) => {
  try {
    const response = await instance.get(API_ENDPOINTS.KNOWLEDGE_GRAPH.NODES, { params });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '获取节点列表失败',
      error
    };
  }
};

/**
 * 获取节点详情
 * @param {string} id - 节点ID
 * @returns {Promise} - 节点详情
 */
export const getNodeById = async (id) => {
  try {
    const response = await instance.get(API_ENDPOINTS.KNOWLEDGE_GRAPH.NODE_DETAIL(id));
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '获取节点详情失败',
      error
    };
  }
};

/**
 * 创建节点
 * @param {object} nodeData - 节点数据
 * @returns {Promise} - 创建结果
 */
export const createNode = async (nodeData) => {
  try {
    const response = await instance.post(API_ENDPOINTS.KNOWLEDGE_GRAPH.NODES, nodeData);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '创建节点失败',
      error
    };
  }
};

/**
 * 更新节点
 * @param {string} id - 节点ID
 * @param {object} nodeData - 节点数据
 * @returns {Promise} - 更新结果
 */
export const updateNode = async (id, nodeData) => {
  try {
    const response = await instance.put(API_ENDPOINTS.KNOWLEDGE_GRAPH.NODE_DETAIL(id), nodeData);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '更新节点失败',
      error
    };
  }
};

/**
 * 删除节点
 * @param {string} id - 节点ID
 * @returns {Promise} - 删除结果
 */
export const deleteNode = async (id) => {
  try {
    await instance.delete(API_ENDPOINTS.KNOWLEDGE_GRAPH.NODE_DETAIL(id));
    return {
      success: true
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '删除节点失败',
      error
    };
  }
};

/**
 * 获取所有边
 * @param {object} params - 查询参数
 * @returns {Promise} - 边列表
 */
export const getAllEdges = async (params = {}) => {
  try {
    const response = await instance.get(API_ENDPOINTS.KNOWLEDGE_GRAPH.EDGES, { params });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '获取边列表失败',
      error
    };
  }
};

/**
 * 获取边详情
 * @param {string} id - 边ID
 * @returns {Promise} - 边详情
 */
export const getEdgeById = async (id) => {
  try {
    const response = await instance.get(API_ENDPOINTS.KNOWLEDGE_GRAPH.EDGE_DETAIL(id));
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '获取边详情失败',
      error
    };
  }
};

/**
 * 创建边
 * @param {object} edgeData - 边数据
 * @returns {Promise} - 创建结果
 */
export const createEdge = async (edgeData) => {
  try {
    const response = await instance.post(API_ENDPOINTS.KNOWLEDGE_GRAPH.EDGES, edgeData);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '创建边失败',
      error
    };
  }
};

/**
 * 更新边
 * @param {string} id - 边ID
 * @param {object} edgeData - 边数据
 * @returns {Promise} - 更新结果
 */
export const updateEdge = async (id, edgeData) => {
  try {
    const response = await instance.put(API_ENDPOINTS.KNOWLEDGE_GRAPH.EDGE_DETAIL(id), edgeData);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '更新边失败',
      error
    };
  }
};

/**
 * 删除边
 * @param {string} id - 边ID
 * @returns {Promise} - 删除结果
 */
export const deleteEdge = async (id) => {
  try {
    await instance.delete(API_ENDPOINTS.KNOWLEDGE_GRAPH.EDGE_DETAIL(id));
    return {
      success: true
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '删除边失败',
      error
    };
  }
};

/**
 * 查找路径
 * @param {string} sourceId - 源节点ID
 * @param {string} targetId - 目标节点ID
 * @param {object} params - 查询参数
 * @returns {Promise} - 路径结果
 */
export const findPath = async (sourceId, targetId, params = {}) => {
  try {
    const response = await instance.get(API_ENDPOINTS.KNOWLEDGE_GRAPH.FIND_PATH, {
      params: {
        source_id: sourceId,
        target_id: targetId,
        ...params
      }
    });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '查找路径失败',
      error
    };
  }
};

/**
 * 分析图谱
 * @param {object} params - 分析参数
 * @returns {Promise} - 分析结果
 */
export const analyzeGraph = async (params = {}) => {
  try {
    const response = await instance.get(API_ENDPOINTS.KNOWLEDGE_GRAPH.ANALYZE, { params });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '分析图谱失败',
      error
    };
  }
};

/**
 * 生成标签
 * @param {object} params - 生成参数
 * @returns {Promise} - 生成结果
 */
export const generateTags = async (params = {}) => {
  try {
    const response = await instance.get(API_ENDPOINTS.KNOWLEDGE_GRAPH.GENERATE_TAGS, { params });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '生成标签失败',
      error
    };
  }
};

/**
 * 获取相关概念
 * @param {string} id - 节点ID
 * @param {object} params - 查询参数
 * @returns {Promise} - 相关概念列表
 */
export const getRelatedConcepts = async (id, params = {}) => {
  try {
    const response = await instance.get(API_ENDPOINTS.KNOWLEDGE_GRAPH.RELATED_CONCEPTS(id), { params });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '获取相关概念失败',
      error
    };
  }
};

const knowledgeGraphApi = {
  getKnowledgeGraph,
  getAllNodes,
  getNodeById,
  createNode,
  updateNode,
  deleteNode,
  getAllEdges,
  getEdgeById,
  createEdge,
  updateEdge,
  deleteEdge,
  findPath,
  analyzeGraph,
  generateTags,
  getRelatedConcepts
};

export default knowledgeGraphApi;