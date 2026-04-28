/**
 * 知识库 API 服务
 * @description 封装所有与知识库后端交互的API请求。
 */
import apiClient from './apiClient';
import networkErrorService from '../networkErrorService';

const KNOWLEDGE_BASE_ENDPOINT = '/knowledge-bases';

/**
 * 获取知识库列表
 * @param {object} params - 查询参数 (e.g., { search, page, limit })
 * @returns {Promise<object>} API响应
 */
const getKnowledgeBases = async (params) => {
  try {
    const response = await apiClient.get(KNOWLEDGE_BASE_ENDPOINT, { params });
    return networkErrorService.handleSuccess(response);
  } catch (error) {
    return networkErrorService.handleError(error, '获取知识库列表失败');
  }
};

/**
 * 创建新知识库
 * @param {object} kbData - 知识库数据 (e.g., { name, description, icon, color })
 * @returns {Promise<object>} API响应
 */
const createKnowledgeBase = async (kbData) => {
  try {
    const response = await apiClient.post(KNOWLEDGE_BASE_ENDPOINT, kbData);
    return networkErrorService.handleSuccess(response);
  } catch (error) {
    return networkErrorService.handleError(error, '创建知识库失败');
  }
};

/**
 * 获取单个知识库详情
 * @param {string} id - 知识库ID
 * @returns {Promise<object>} API响应
 */
const getKnowledgeBaseDetails = async (id) => {
  try {
    const response = await apiClient.get(`${KNOWLEDGE_BASE_ENDPOINT}/${id}`);
    return networkErrorService.handleSuccess(response);
  } catch (error) {
    return networkErrorService.handleError(error, '获取知识库详情失败');
  }
};

/**
 * 更新知识库
 * @param {string} id - 知识库ID
 * @param {object} kbData - 要更新的数据
 * @returns {Promise<object>} API响应
 */
const updateKnowledgeBase = async (id, kbData) => {
  try {
    const response = await apiClient.put(`${KNOWLEDGE_BASE_ENDPOINT}/${id}`, kbData);
    return networkErrorService.handleSuccess(response);
  } catch (error) {
    return networkErrorService.handleError(error, '更新知识库失败');
  }
};

/**
 * 删除知识库
 * @param {string} id - 知识库ID
 * @returns {Promise<object>} API响应
 */
const deleteKnowledgeBase = async (id) => {
  try {
    const response = await apiClient.delete(`${KNOWLEDGE_BASE_ENDPOINT}/${id}`);
    return networkErrorService.handleSuccess(response);
  } catch (error) {
    return networkErrorService.handleError(error, '删除知识库失败');
  }
};

/**
 * 获取知识库内的节点列表
 * @param {string} id - 知识库ID
 * @param {object} params - 查询参数
 * @returns {Promise<object>} API响应
 */
const getKnowledgeBaseNodes = async (id, params) => {
  try {
    const response = await apiClient.get(`${KNOWLEDGE_BASE_ENDPOINT}/${id}/nodes`, { params });
    return networkErrorService.handleSuccess(response);
  } catch (error) {
    return networkErrorService.handleError(error, '获取知识库内容失败');
  }
};

/**
 * 在知识库中进行问答
 * @param {string} id - 知识库ID
 * @param {object} queryData - 查询数据 (e.g., { query, conversation_history })
 * @returns {Promise<object>} API响应
 */
const askKnowledgeBase = async (id, queryData) => {
  try {
    const response = await apiClient.post(`${KNOWLEDGE_BASE_ENDPOINT}/${id}/ask`, queryData);
    return networkErrorService.handleSuccess(response);
  } catch (error) {
    return networkErrorService.handleError(error, '知识库问答失败');
  }
};

/**
 * 获取知识库分析报告
 * @param {string} id - 知识库ID
 * @returns {Promise<object>} API响应
 */
const getKnowledgeBaseAnalysis = async (id) => {
  try {
    const response = await apiClient.get(`${KNOWLEDGE_BASE_ENDPOINT}/${id}/analysis`);
    return networkErrorService.handleSuccess(response);
  } catch (error) {
    return networkErrorService.handleError(error, '获取知识库分析失败');
  }
};


/**
 * 在知识库中创建新节点
 * @param {string} kbId - 知识库ID
 * @param {object} nodeData - 节点数据
 * @returns {Promise<object>} API响应
 */
const createNode = async (kbId, nodeData) => {
  try {
    const response = await apiClient.post(`${KNOWLEDGE_BASE_ENDPOINT}/${kbId}/nodes`, nodeData);
    return networkErrorService.handleSuccess(response);
  } catch (error) {
    return networkErrorService.handleError(error, '创建节点失败');
  }
};

/**
 * 更新知识库中的节点
 * @param {string} kbId - 知识库ID
 * @param {string} nodeId - 节点ID
 * @param {object} nodeData - 要更新的节点数据
 * @returns {Promise<object>} API响应
 */
const updateNode = async (kbId, nodeId, nodeData) => {
  try {
    const response = await apiClient.put(`${KNOWLEDGE_BASE_ENDPOINT}/${kbId}/nodes/${nodeId}`, nodeData);
    return networkErrorService.handleSuccess(response);
  } catch (error) {
    return networkErrorService.handleError(error, '更新节点失败');
  }
};

export default {
  getKnowledgeBases,
  createKnowledgeBase,
  getKnowledgeBaseDetails,
  updateKnowledgeBase,
  deleteKnowledgeBase,
  getKnowledgeBaseNodes,
  createNode, // 导出创建节点函数
  updateNode, // 导出更新节点函数
  askKnowledgeBase,
  getKnowledgeBaseAnalysis,
};

