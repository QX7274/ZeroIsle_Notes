/**
 * 代码API服务
 */
import instance from './apiClient';
import { API_ENDPOINTS } from '../../config/api';

/**
 * 运行代码
 * @param {object} codeData - 代码数据
 * @returns {Promise} - 运行结果
 */
export const runCode = async (codeData) => {
  try {
    const response = await instance.post(API_ENDPOINTS.CODE.RUN, codeData);
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    throw error;
  }
};

/**
 * 检测代码语言
 * @param {object} codeData - 代码数据
 * @returns {Promise} - 检测结果
 */
export const detectCodeLanguage = async (codeData) => {
  try {
    const response = await instance.post(API_ENDPOINTS.CODE.DETECT, codeData);
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    throw error;
  }
};

/**
 * 代码补全
 * @param {object} codeData - 代码数据
 * @returns {Promise} - 补全结果
 */
export const completeCode = async (codeData) => {
  try {
    const response = await instance.post(API_ENDPOINTS.CODE.COMPLETE, codeData);
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    throw error;
  }
};

/**
 * 格式化代码
 * @param {object} codeData - 代码数据
 * @returns {Promise} - 格式化结果
 */
export const formatCode = async (codeData) => {
  try {
    const response = await instance.post(API_ENDPOINTS.CODE.FORMAT, codeData);
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    throw error;
  }
};

/**
 * 代码检查
 * @param {object} codeData - 代码数据
 * @returns {Promise} - 检查结果
 */
export const lintCode = async (codeData) => {
  try {
    const response = await instance.post(API_ENDPOINTS.CODE.LINT, codeData);
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    throw error;
  }
};

/**
 * 获取所有代码片段
 * @param {object} params - 查询参数
 * @returns {Promise} - 代码片段列表
 */
export const getAllSnippets = async (params = {}) => {
  try {
    const response = await instance.get(API_ENDPOINTS.CODE.SNIPPETS, { params });
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    throw error;
  }
};

/**
 * 获取代码片段详情
 * @param {string} id - 代码片段ID
 * @returns {Promise} - 代码片段详情
 */
export const getSnippetById = async (id) => {
  try {
    const response = await instance.get(API_ENDPOINTS.CODE.SNIPPET_DETAIL(id));
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    throw error;
  }
};

/**
 * 创建代码片段
 * @param {object} snippetData - 代码片段数据
 * @returns {Promise} - 创建结果
 */
export const createSnippet = async (snippetData) => {
  try {
    const response = await instance.post(API_ENDPOINTS.CODE.SNIPPETS, snippetData);
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    throw error;
  }
};

/**
 * 更新代码片段
 * @param {string} id - 代码片段ID
 * @param {object} snippetData - 代码片段数据
 * @returns {Promise} - 更新结果
 */
export const updateSnippet = async (id, snippetData) => {
  try {
    const response = await instance.put(API_ENDPOINTS.CODE.SNIPPET_DETAIL(id), snippetData);
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    throw error;
  }
};

/**
 * 删除代码片段
 * @param {string} id - 代码片段ID
 * @returns {Promise} - 删除结果
 */
export const deleteSnippet = async (id) => {
  try {
    await instance.delete(API_ENDPOINTS.CODE.SNIPPET_DETAIL(id));
    return {
      success: true,
    };
  } catch (error) {
    throw error;
  }
};

/**
 * 获取支持的编程语言
 * @returns {Promise} - 语言列表
 */
export const getSupportedLanguages = async () => {
  try {
    const response = await instance.get('/code/languages/');
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    throw error;
  }
};

/**
 * 从笔记创建代码片段
 * @param {string} noteId - 笔记ID
 * @param {object} snippetData - 代码片段数据
 * @returns {Promise} - 创建结果
 */
export const createSnippetFromNote = async (noteId, snippetData) => {
  try {
    const response = await instance.post(`/code/snippets/from-note/${noteId}/`, snippetData);
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    throw error;
  }
};

const codeApi = {
  runCode,
  detectCodeLanguage,
  completeCode,
  formatCode,
  lintCode,
  getAllSnippets,
  getSnippetById,
  createSnippet,
  updateSnippet,
  deleteSnippet,
  getSupportedLanguages,
  createSnippetFromNote,
};

export default codeApi;
