/**
 * 搜索API服务
 * 提供多模态搜索功能
 */

import { axiosInstance } from './config';

/**
 * 文本搜索
 * @param {string} query - 搜索查询文本
 * @param {Object} options - 搜索选项
 * @param {Array} options.types - 搜索类型数组，如 ['note', 'tag', 'knowledge']
 * @param {boolean} options.useKnowledgeGraph - 是否使用知识图谱增强搜索
 * @param {number} options.limit - 结果数量限制
 * @returns {Promise} - 返回搜索结果
 */
export const textSearch = (query, options = {}) => {
  return axiosInstance.post('/api/search/text', {
    query,
    ...options,
  });
};

/**
 * 语音搜索
 * @param {string} audioUri - 音频文件URI
 * @param {Object} options - 搜索选项
 * @param {Array} options.types - 搜索类型数组，如 ['note', 'tag', 'knowledge']
 * @param {boolean} options.useKnowledgeGraph - 是否使用知识图谱增强搜索
 * @param {number} options.limit - 结果数量限制
 * @returns {Promise} - 返回搜索结果
 */
export const voiceSearch = async (audioUri, options = {}) => {
  // 创建FormData对象
  const formData = new FormData();

  // 添加音频文件
  formData.append('audio', {
    uri: audioUri,
    type: 'audio/m4a',
    name: 'voice_search.m4a',
  });

  // 添加选项
  Object.keys(options).forEach(key => {
    formData.append(key, JSON.stringify(options[key]));
  });

  return axiosInstance.post('/api/search/voice', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};

/**
 * 图像搜索
 * @param {string} imageUri - 图像文件URI
 * @param {Object} options - 搜索选项
 * @param {Array} options.types - 搜索类型数组，如 ['note', 'tag', 'knowledge']
 * @param {boolean} options.useKnowledgeGraph - 是否使用知识图谱增强搜索
 * @param {number} options.limit - 结果数量限制
 * @returns {Promise} - 返回搜索结果
 */
export const imageSearch = async (imageUri, options = {}) => {
  // 创建FormData对象
  const formData = new FormData();

  // 添加图像文件
  formData.append('image', {
    uri: imageUri,
    type: 'image/jpeg',
    name: 'image_search.jpg',
  });

  // 添加选项
  Object.keys(options).forEach(key => {
    formData.append(key, JSON.stringify(options[key]));
  });

  return axiosInstance.post('/api/search/image', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};

/**
 * 知识图谱搜索
 * @param {string} query - 搜索查询文本
 * @param {Object} options - 搜索选项
 * @param {number} options.limit - 结果数量限制
 * @returns {Promise} - 返回搜索结果
 */
export const knowledgeGraphSearch = (query, options = {}) => {
  return axiosInstance.post('/api/search/knowledge-graph', {
    query,
    ...options,
  });
};
