/**
 * 搜索API服务
 */
import apiClient from './apiClient';
import { API_ENDPOINTS } from '../../config/api';

/**
 * 基础搜索
 * @param {string} query - 搜索关键�?
 * @param {object} params - 搜索参数
 * @returns {Promise} - 搜索结果
 */
export const search = async (query, params = {}) => {
  try {
    const response = await apiClient.get(API_ENDPOINTS.SEARCH.BASE, {
      params: {
        q: query,
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
      message: error.message || '搜索失败',
      error
    };
  }
};

/**
 * 高级搜索
 * @param {object} searchParams - 高级搜索参数
 * @returns {Promise} - 搜索结果
 */
export const advancedSearch = async (searchParams) => {
  try {
    const response = await apiClient.get(API_ENDPOINTS.SEARCH.ADVANCED, {
      params: searchParams
    });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '高级搜索失败',
      error
    };
  }
};

/**
 * 语义搜索
 * @param {string} query - 搜索关键�?
 * @param {object} params - 搜索参数
 * @returns {Promise} - 搜索结果
 */
export const semanticSearch = async (query, params = {}) => {
  try {
    const response = await apiClient.get(API_ENDPOINTS.SEARCH.SEMANTIC, {
      params: {
        q: query,
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
      message: error.message || '语义搜索失败',
      error
    };
  }
};

/**
 * 标签搜索
 * @param {Array<string>} tags - 标签列表
 * @param {object} params - 搜索参数
 * @returns {Promise} - 搜索结果
 */
export const searchByTags = async (tags, params = {}) => {
  try {
    const response = await apiClient.get(API_ENDPOINTS.SEARCH.TAGS, {
      params: {
        tags: tags.join(','),
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
      message: error.message || '标签搜索失败',
      error
    };
  }
};

/**
 * 获取搜索建议
 * @param {string} query - 搜索关键�?
 * @param {number} limit - 限制数量
 * @returns {Promise} - 搜索建议
 */
export const getSearchSuggestions = async (query, limit = 5) => {
  try {
    const response = await apiClient.get(API_ENDPOINTS.SEARCH.SUGGESTIONS, {
      params: {
        q: query,
        limit
      }
    });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '获取搜索建议失败',
      error
    };
  }
};

/**
 * 文本搜索
 * @param {string} query - 搜索文本
 * @param {object} params - 搜索参数
 * @returns {Promise} - 搜索结果
 */
export const textSearch = async (query, params = {}) => {
  try {
    const response = await apiClient.post(API_ENDPOINTS.SEARCH.TEXT, {
      query,
      ...params
    });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '文本搜索失败',
      error
    };
  }
};

/**
 * 语音搜索
 * @param {string} audioBase64 - 音频Base64数据
 * @param {object} params - 搜索参数
 * @returns {Promise} - 搜索结果
 */
export const voiceSearch = async (audioBase64, params = {}) => {
  try {
    const response = await apiClient.post(API_ENDPOINTS.SEARCH.VOICE, {
      audio: audioBase64,
      ...params
    });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '语音搜索失败',
      error
    };
  }
};

/**
 * 图像搜索
 * @param {string} imageBase64 - 图像Base64数据
 * @param {object} params - 搜索参数
 * @returns {Promise} - 搜索结果
 */
export const imageSearch = async (imageBase64, params = {}) => {
  try {
    const response = await apiClient.post(API_ENDPOINTS.SEARCH.IMAGE, {
      image: imageBase64,
      ...params
    });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '图像搜索失败',
      error
    };
  }
};

/**
 * 获取搜索历史
 * @param {number} limit - 限制数量
 * @returns {Promise} - 搜索历史
 */
export const getSearchHistory = async (limit = 10) => {
  try {
    const response = await apiClient.get(API_ENDPOINTS.SEARCH.HISTORY, {
      params: { limit }
    });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '获取搜索历史失败',
      error
    };
  }
};

/**
 * 清除搜索历史
 * @returns {Promise} - 操作结果
 */
export const clearSearchHistory = async () => {
  try {
    const response = await apiClient.delete(API_ENDPOINTS.SEARCH.CLEAR_HISTORY);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '清除搜索历史失败',
      error
    };
  }
};

/**
 * 知识图谱搜索
 * @param {string} query - 搜索关键�?
 * @param {object} params - 搜索参数
 * @returns {Promise} - 搜索结果
 */
export const knowledgeGraphSearch = async (query, params = {}) => {
  try {
    const response = await apiClient.post(API_ENDPOINTS.SEARCH.KNOWLEDGE_GRAPH, {
      query,
      ...params
    });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '知识图谱搜索失败',
      error
    };
  }
};

const searchApi = {
  search,
  advancedSearch,
  semanticSearch,
  searchByTags,
  getSearchSuggestions,
  textSearch,
  voiceSearch,
  imageSearch,
  getSearchHistory,
  clearSearchHistory,
  knowledgeGraphSearch
};

export default searchApi;
