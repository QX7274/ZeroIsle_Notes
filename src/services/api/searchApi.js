/**
 * 搜索API服务
 */
import apiClient from './apiClient';
import { API_ENDPOINTS } from '../../constants/api';
import realmService from '../database/realmService';

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
        ...params,
      },
    });
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    throw error;
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
      params: searchParams,
    });
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    throw error;
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
        ...params,
      },
    });
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    throw error;
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
        ...params,
      },
    });
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    throw error;
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
    // 尝试在线获取搜索建议
    try {
      const response = await apiClient.get(API_ENDPOINTS.SEARCH.SUGGESTIONS, {
        params: {
          q: query,
          limit,
        },
      });
      return {
        success: true,
        data: response.data,
      };
    } catch (onlineError) {
      console.log('在线获取搜索建议失败，尝试离线生成建议:', onlineError.message);

      // 在线获取失败，尝试离线生成建议（性能优化：避免全量扫描 content）
      const realm = await realmService.getRealm();
      const loweredQuery = (query || '').toLowerCase();

      // 仅使用 title 生成建议，避免 10 万条笔记场景下扫描 content
      const notes = realm.objects('Note')
        .filtered('is_deleted == false')
        .sorted('updated_at', true)
        .slice(0, 500);

      const keywords = new Set();
      for (const note of notes) {
        const title = String(note.title || '');
        const titleLower = title.toLowerCase();
        if (!loweredQuery || !titleLower.includes(loweredQuery)) {
          continue;
        }

        // 简单切词：按空白切分，并做去重
        const words = title.split(/\s+/).filter(w => w.length >= 2);
        for (const w of words) {
          if (w.toLowerCase().includes(loweredQuery)) {
            keywords.add(w);
            if (keywords.size >= limit * 5) {
              break;
            }
          }
        }
        if (keywords.size >= limit * 5) {
          break;
        }
      }

      const suggestions = Array.from(keywords)
        .slice(0, limit)
        .map(text => ({ text }));

      return {
        success: true,
        data: {
          suggestions,
          isOfflineSuggestions: true,
        },
      };
    }
  } catch (error) {
    throw error;
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
    // 尝试在线搜索
    try {
      const response = await apiClient.post(API_ENDPOINTS.SEARCH.TEXT, {
        query,
        ...params,
      });
      return {
        success: true,
        data: response.data,
      };
    } catch (onlineError) {
      console.log('在线搜索失败，尝试离线搜索:', onlineError.message);

      // 在线搜索失败，尝试使用 SearchIndex 执行本地搜索 (性能优化：避免全量 Note 扫描)
      const realm = await realmService.getRealm();
      const searchQuery = (query || '').toLowerCase();

      // 使用 SearchIndex 模型执行过滤
      // SearchIndex 表不含 strokeData 等大字段，查询速度远快于 Note 表
      let indexResults = realm.objects('SearchIndex')
        .filtered('is_deleted == false');

      if (searchQuery) {
        indexResults = indexResults.filtered(
          'title CONTAINS[c] $0 OR content CONTAINS[c] $0 OR ANY keywords CONTAINS[c] $0 OR ANY tags CONTAINS[c] $0',
          searchQuery
        );
      }

      // 排序并分页
      const totalResults = indexResults.length;
      const skip = params.skip || 0;
      const limit = params.limit || 20;
      const page = indexResults.sorted('updated_at', true).slice(skip, skip + limit);

      // 转换为输出格式
      const results = Array.from(page).map(idx => ({
        _id: idx.entity_id,
        title: idx.title,
        type: idx.entity_type,
        user_id: idx.user_id,
        updated_at: idx.updated_at,
        // 标记为来自索引
        isFromIndex: true,
      }));

      return {
        success: true,
        data: {
          results,
          isOfflineSearch: true,
          isDegraded: totalResults > 1000, // 提示用户结果较多
          totalResults,
        },
      };
    }
  } catch (error) {
    throw error;
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
    // 尝试在线语音搜索
    try {
      const response = await apiClient.post(API_ENDPOINTS.SEARCH.VOICE, {
        audio: audioBase64,
        ...params,
      });
      return {
        success: true,
        data: response.data,
      };
    } catch (onlineError) {
      console.log('在线语音搜索失败:', onlineError.message);
      throw new Error('离线模式下无法执行语音搜索，请连接网络后重试');
    }
  } catch (error) {
    throw error;
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
    // 尝试在线图像搜索
    try {
      const response = await apiClient.post(API_ENDPOINTS.SEARCH.IMAGE, {
        image: imageBase64,
        ...params,
      });
      return {
        success: true,
        data: response.data,
      };
    } catch (onlineError) {
      console.log('在线图像搜索失败:', onlineError.message);
      throw new Error('离线模式下无法执行图像搜索，请连接网络后重试');
    }
  } catch (error) {
    throw error;
  }
};

/**
 * 获取搜索历史
 * @param {number} limit - 限制数量
 * @param {string} scope - 搜索范围，可选值：'home', 'category', 'community'
 * @returns {Promise} - 搜索历史
 */
export const getSearchHistory = async (limit = 10, scope = 'home') => {
  try {
    // 尝试在线获取搜索历史
    try {
      const response = await apiClient.get(API_ENDPOINTS.SEARCH.HISTORY, {
        params: { limit, scope },
      });
      return {
        success: true,
        data: response.data,
      };
    } catch (onlineError) {
      console.log('在线获取搜索历史失败，尝试从本地获取:', onlineError.message);

      // 从本地存储获取搜索历史
      // 已移除 offlineStorageService 导入，现在直接使用 realmService
      const realm = await realmService.getRealm();
      const item = realm.objects('StorageItem').filtered(`key = "search_history_${scope}"`);
      const history = item.length > 0 ? JSON.parse(item[0].value) : [];

      return {
        success: true,
        data: {
          history: history.slice(0, limit),
          isOfflineHistory: true,
        },
      };
    }
  } catch (error) {
    throw error;
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
      data: response.data,
    };
  } catch (error) {
    throw error;
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
      ...params,
    });
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    throw error;
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
  knowledgeGraphSearch,
};

export default searchApi;
