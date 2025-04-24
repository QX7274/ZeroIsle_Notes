/**
 * 知识图谱API服务
 * 提供知识图谱相关的API调用
 */

import axios from './axios';

/**
 * 获取用户的知识图谱
 * @param {Object} params - 查询参数
 * @param {number} params.limit - 结果数量限制
 * @param {Object} params.filters - 过滤条件
 * @returns {Promise} - 返回图谱数据
 */
export const getUserGraph = (params = {}) => {
  return axios.get('/api/knowledge-graph/user-graph', { params });
};

/**
 * 获取节点的图谱
 * @param {string} nodeId - 节点ID
 * @param {number} depth - 图谱深度
 * @returns {Promise} - 返回节点图谱数据
 */
export const getNodeGraph = (nodeId, depth = 2) => {
  return axios.get(`/api/knowledge-graph/nodes/${nodeId}/graph`, {
    params: { depth },
  });
};

/**
 * 获取节点详情
 * @param {string} nodeId - 节点ID
 * @returns {Promise} - 返回节点详情
 */
export const getNodeDetail = (nodeId) => {
  return axios.get(`/api/knowledge-graph/nodes/${nodeId}`);
};

/**
 * 创建节点
 * @param {Object} nodeData - 节点数据
 * @param {string} nodeData.title - 节点标题
 * @param {string} nodeData.content - 节点内容
 * @param {string} nodeData.node_type - 节点类型
 * @param {string} nodeData.note_id - 关联笔记ID（可选）
 * @returns {Promise} - 返回创建的节点
 */
export const createNode = (nodeData) => {
  return axios.post('/api/knowledge-graph/nodes', nodeData);
};

/**
 * 更新节点
 * @param {string} nodeId - 节点ID
 * @param {Object} nodeData - 节点数据
 * @returns {Promise} - 返回更新后的节点
 */
export const updateNode = (nodeId, nodeData) => {
  return axios.patch(`/api/knowledge-graph/nodes/${nodeId}`, nodeData);
};

/**
 * 删除节点
 * @param {string} nodeId - 节点ID
 * @returns {Promise} - 返回删除结果
 */
export const deleteNode = (nodeId) => {
  return axios.delete(`/api/knowledge-graph/nodes/${nodeId}`);
};

/**
 * 创建关系
 * @param {Object} relationData - 关系数据
 * @param {string} relationData.source_id - 源节点ID
 * @param {string} relationData.target_id - 目标节点ID
 * @param {string} relationData.relation_type - 关系类型
 * @param {number} relationData.weight - 关系权重
 * @returns {Promise} - 返回创建的关系
 */
export const createRelation = (relationData) => {
  return axios.post('/api/knowledge-graph/relations', relationData);
};

/**
 * 删除关系
 * @param {string} relationId - 关系ID
 * @returns {Promise} - 返回删除结果
 */
export const deleteRelation = (relationId) => {
  return axios.delete(`/api/knowledge-graph/relations/${relationId}`);
};

/**
 * 生成标签
 * @param {string} text - 文本内容
 * @param {string} title - 标题（可选）
 * @param {number} count - 标签数量
 * @returns {Promise} - 返回生成的标签
 */
export const generateTags = (text, title, count = 5) => {
  return axios.post('/api/knowledge-graph/generate-tags', {
    text,
    title,
    count,
  });
};

/**
 * 获取图谱分析
 * @returns {Promise} - 返回图谱分析数据
 */
export const getGraphAnalytics = () => {
  return axios.get('/api/knowledge-graph/analytics');
};
