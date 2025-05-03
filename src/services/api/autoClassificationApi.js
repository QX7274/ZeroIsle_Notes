/**
 * 自动分类API服务
 * 提供自动分类、标签推荐、知识图谱构建等功能
 */
import instance from './interceptor';
import { API_ENDPOINTS } from '../../config/api';

/**
 * 自动分类笔记
 * @param {string} noteId - 笔记ID
 * @returns {Promise} - 分类结果
 */
export const autoClassifyNote = async (noteId) => {
  try {
    const response = await instance.post(API_ENDPOINTS.KNOWLEDGE_GRAPH.AUTO_CLASSIFY, {
      note_id: noteId
    });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '自动分类笔记失败',
      error
    };
  }
};

/**
 * 推荐标签
 * @param {string} noteId - 笔记ID
 * @param {number} count - 标签数量
 * @returns {Promise} - 推荐的标签
 */
export const suggestTags = async (noteId, count = 10) => {
  try {
    const response = await instance.post(API_ENDPOINTS.KNOWLEDGE_GRAPH.SUGGEST_TAGS, {
      note_id: noteId,
      count
    });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '推荐标签失败',
      error
    };
  }
};

/**
 * 提取关键词
 * @param {string} text - 文本内容
 * @param {string} title - 标题（可选）
 * @param {number} count - 关键词数量
 * @returns {Promise} - 关键词列表
 */
export const extractKeywords = async (text, title = '', count = 10) => {
  try {
    const response = await instance.post(API_ENDPOINTS.KNOWLEDGE_GRAPH.EXTRACT_KEYWORDS, {
      text,
      title,
      count
    });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '提取关键词失败',
      error
    };
  }
};

/**
 * 查找相似笔记
 * @param {string} noteId - 笔记ID
 * @param {number} threshold - 相似度阈值
 * @param {number} limit - 返回结果数量限制
 * @returns {Promise} - 相似笔记列表
 */
export const findSimilarNotes = async (noteId, threshold = 0.3, limit = 10) => {
  try {
    const response = await instance.post(API_ENDPOINTS.KNOWLEDGE_GRAPH.FIND_SIMILAR_NOTES, {
      note_id: noteId,
      threshold,
      limit
    });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '查找相似笔记失败',
      error
    };
  }
};

/**
 * 将新笔记整合到现有笔记体系中
 * @param {string} noteId - 笔记ID
 * @returns {Promise} - 整合建议
 */
export const integrateWithExistingNotes = async (noteId) => {
  try {
    const response = await instance.post(API_ENDPOINTS.KNOWLEDGE_GRAPH.INTEGRATE_NOTES, {
      note_id: noteId
    });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '整合笔记失败',
      error
    };
  }
};

/**
 * 构建知识图谱
 * @param {string} noteId - 笔记ID
 * @param {boolean} extractConcepts - 是否提取概念
 * @returns {Promise} - 构建结果
 */
export const buildKnowledgeGraph = async (noteId, extractConcepts = true) => {
  try {
    const response = await instance.post(API_ENDPOINTS.KNOWLEDGE_GRAPH.BUILD_GRAPH, {
      note_id: noteId,
      extract_concepts: extractConcepts
    });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '构建知识图谱失败',
      error
    };
  }
};

/**
 * 为用户构建完整知识图谱
 * @param {number} limit - 处理的笔记数量限制
 * @param {boolean} extractConcepts - 是否提取概念
 * @returns {Promise} - 构建结果
 */
export const buildKnowledgeGraphForUser = async (limit = 100, extractConcepts = true) => {
  try {
    const response = await instance.post(API_ENDPOINTS.KNOWLEDGE_GRAPH.BUILD_USER_GRAPH, {
      limit,
      extract_concepts: extractConcepts
    });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '为用户构建知识图谱失败',
      error
    };
  }
};

/**
 * 分析笔记的关联
 * @param {string} noteId - 笔记ID
 * @returns {Promise} - 分析结果
 */
export const analyzeNoteConnections = async (noteId) => {
  try {
    const response = await instance.post(API_ENDPOINTS.KNOWLEDGE_GRAPH.ANALYZE_CONNECTIONS, {
      note_id: noteId
    });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '分析笔记关联失败',
      error
    };
  }
};

/**
 * 推荐相关内容
 * @param {string} noteId - 笔记ID
 * @returns {Promise} - 推荐结果
 */
export const suggestRelatedContent = async (noteId) => {
  try {
    const response = await instance.post(API_ENDPOINTS.KNOWLEDGE_GRAPH.SUGGEST_RELATED_CONTENT, {
      note_id: noteId
    });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '推荐相关内容失败',
      error
    };
  }
};

const autoClassificationApi = {
  autoClassifyNote,
  suggestTags,
  extractKeywords,
  findSimilarNotes,
  integrateWithExistingNotes,
  buildKnowledgeGraph,
  buildKnowledgeGraphForUser,
  analyzeNoteConnections,
  suggestRelatedContent
};

export default autoClassificationApi;
