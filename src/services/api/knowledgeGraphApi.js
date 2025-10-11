/**
 * 知识图谱API服务
 */
import instance from './apiClient';
import { API_ENDPOINTS } from '../../config/api';
import NetInfo from '@react-native-community/netinfo';
import authService from '../auth/authService';

/**
 * 获取知识图谱
 * @param {object} params - 查询参数
 * @returns {Promise} - 知识图谱数据
 */
export const getKnowledgeGraph = async (params = {}) => {
  try {
    // 确保authService已初始化
    try {
      if (!authService) {
        console.error('知识图谱API: authService未导入');
        throw new Error('authService未导入');
      }

      // 确保authService已初始化
      if (!authService.initialized) {
        console.log('知识图谱API: 正在初始化authService...');
        await authService.initialize();
        console.log('知识图谱API: authService初始化完成');
      }

      const token = await authService.getAuthToken();
      console.log('知识图谱API: 获取到认证令牌:', token ? '有效' : '无效');
    } catch (authError) {
      console.error('知识图谱API: authService初始化失败:', authError);
      // 不抛出错误，继续执行，让API客户端处理认证
    }

    // 检查网络连接
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      console.log('知识图谱API: 网络未连接');
      return {
        success: false,
        message: '网络未连接，请检查网络设置',
        error: new Error('网络未连接'),
        isNetworkError: true
      };
    }

    console.log('知识图谱API: 开始获取知识图谱数据');
    const response = await instance.get(API_ENDPOINTS.KNOWLEDGE_GRAPH.BASE, { params });

    console.log('知识图谱API: 获取知识图谱数据成功');

    // 检查响应数据格式
    if (response.data && (response.data.nodes !== undefined || response.data.edges !== undefined)) {
      // 如果响应已经包含nodes和edges，直接返回
      return {
        success: true,
        data: response.data
      };
    } else {
      // 如果响应不包含nodes和edges，但响应本身就是数据
      console.log('知识图谱API: 响应数据格式不包含nodes和edges，使用响应本身作为数据');
      return {
        success: true,
        data: {
          nodes: [],
          edges: []
        }
      };
    }
  } catch (error) {
    console.error('知识图谱API: 获取知识图谱失败:', error);
    console.log('知识图谱API: 错误详情:', error.message);
    console.log('知识图谱API: 错误状态码:', error.response?.status);

    // 根据错误类型返回不同的错误信息
    let errorMessage = '获取知识图谱失败';
    let isNetworkError = false;

    if (error.message === 'Network Error') {
      errorMessage = '网络连接失败，请检查网络设置';
      isNetworkError = true;
    } else if (error.response) {
      // 服务器返回了错误状态码
      switch (error.response.status) {
        case 401:
          // 对于401错误，返回空数据而不是错误，避免影响用户体验
          console.log('知识图谱API: 401认证错误，返回空数据');
          return {
            success: true,
            data: {
              nodes: [],
              edges: [],
              message: '认证过期，显示空知识图谱'
            },
            isAuthError: true
          };
        case 403:
          errorMessage = '没有权限访问知识图谱';
          break;
        case 404:
          errorMessage = '知识图谱不存在';
          break;
        case 500:
          errorMessage = '服务器错误，请稍后重试';
          break;
        default:
          errorMessage = `服务器返回错误(${error.response.status}): ${error.response.data?.message || '未知错误'}`;
      }
    }

    return {
      success: false,
      message: errorMessage,
      error,
      isNetworkError,
      statusCode: error.response?.status
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
    // 特殊处理401错误
    if (error.response && error.response.status === 401) {
      console.log('知识图谱API: getAllNodes 401认证错误，返回空数据');
      return {
        success: true,
        data: [],
        isAuthError: true
      };
    }

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