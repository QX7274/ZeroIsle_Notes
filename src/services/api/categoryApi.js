/**
 * 分类API服务
 * 提供分类相关的API调用功能
 */
import instance from './apiClient';
import { API_ENDPOINTS } from '../../config/api';

/**
 * 获取分类列表
 * @param {object} params - 查询参数
 * @returns {Promise} - 分类列表
 */
export const getCategories = async (params = {}) => {
  try {
    console.log('分类API: 开始获取分类列表');
    const response = await instance.get(API_ENDPOINTS.NOTES.CATEGORIES, { params });
    console.log('分类API: 获取分类列表成功', response.data);
    
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('分类API: 获取分类列表失败:', error);
    return {
      success: false,
      message: error.response?.data?.message || error.message || '获取分类列表失败',
      error
    };
  }
};

/**
 * 获取分类树形结构
 * @returns {Promise} - 分类树
 */
export const getCategoryTree = async () => {
  try {
    console.log('分类API: 开始获取分类树');
    const response = await instance.get(`${API_ENDPOINTS.NOTES.CATEGORIES}tree/`);
    console.log('分类API: 获取分类树成功', response.data);
    
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('分类API: 获取分类树失败:', error);
    return {
      success: false,
      message: error.response?.data?.message || error.message || '获取分类树失败',
      error
    };
  }
};

/**
 * 获取单个分类详情
 * @param {string} id - 分类ID
 * @returns {Promise} - 分类详情
 */
export const getCategoryDetail = async (id) => {
  try {
    console.log('分类API: 开始获取分类详情', id);
    const response = await instance.get(`${API_ENDPOINTS.NOTES.CATEGORIES}${id}/`);
    console.log('分类API: 获取分类详情成功', response.data);
    
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('分类API: 获取分类详情失败:', error);
    return {
      success: false,
      message: error.response?.data?.message || error.message || '获取分类详情失败',
      error
    };
  }
};

/**
 * 创建分类
 * @param {object} data - 分类数据
 * @param {string} data.name - 分类名称
 * @param {string} [data.description] - 分类描述
 * @param {string} [data.color] - 分类颜色
 * @param {string} [data.icon] - 分类图标
 * @param {string} [data.parent] - 父分类ID
 * @returns {Promise} - 创建的分类
 */
export const createCategory = async (data) => {
  try {
    console.log('分类API: 开始创建分类', data);
    const response = await instance.post(API_ENDPOINTS.NOTES.CATEGORIES, data);
    console.log('分类API: 创建分类成功', response.data);
    
    return {
      success: true,
      data: response.data,
      message: '分类创建成功'
    };
  } catch (error) {
    console.error('分类API: 创建分类失败:', error);
    return {
      success: false,
      message: error.response?.data?.message || error.message || '创建分类失败',
      error
    };
  }
};

/**
 * 更新分类
 * @param {string} id - 分类ID
 * @param {object} data - 更新的分类数据
 * @returns {Promise} - 更新后的分类
 */
export const updateCategory = async (id, data) => {
  try {
    console.log('分类API: 开始更新分类', id, data);
    const response = await instance.put(`${API_ENDPOINTS.NOTES.CATEGORIES}${id}/`, data);
    console.log('分类API: 更新分类成功', response.data);
    
    return {
      success: true,
      data: response.data,
      message: '分类更新成功'
    };
  } catch (error) {
    console.error('分类API: 更新分类失败:', error);
    return {
      success: false,
      message: error.response?.data?.message || error.message || '更新分类失败',
      error
    };
  }
};

/**
 * 删除分类
 * @param {string} id - 分类ID
 * @returns {Promise} - 删除结果
 */
export const deleteCategory = async (id) => {
  try {
    console.log('分类API: 开始删除分类', id);
    const response = await instance.delete(`${API_ENDPOINTS.NOTES.CATEGORIES}${id}/`);
    console.log('分类API: 删除分类成功');
    
    return {
      success: true,
      data: response.data,
      message: '分类删除成功'
    };
  } catch (error) {
    console.error('分类API: 删除分类失败:', error);
    return {
      success: false,
      message: error.response?.data?.message || error.message || '删除分类失败',
      error
    };
  }
};

/**
 * 获取分类下的笔记列表
 * @param {string} id - 分类ID
 * @param {object} params - 查询参数
 * @returns {Promise} - 笔记列表
 */
export const getCategoryNotes = async (id, params = {}) => {
  try {
    console.log('分类API: 开始获取分类下的笔记', id);
    const response = await instance.get(`${API_ENDPOINTS.NOTES.CATEGORIES}${id}/notes/`, { params });
    console.log('分类API: 获取分类下的笔记成功', response.data);
    
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('分类API: 获取分类下的笔记失败:', error);
    return {
      success: false,
      message: error.response?.data?.message || error.message || '获取分类笔记失败',
      error
    };
  }
};

/**
 * 获取分类统计信息
 * @param {string} id - 分类ID
 * @returns {Promise} - 统计信息
 */
export const getCategoryStatistics = async (id) => {
  try {
    console.log('分类API: 开始获取分类统计', id);
    const response = await instance.get(`${API_ENDPOINTS.NOTES.CATEGORIES}${id}/statistics/`);
    console.log('分类API: 获取分类统计成功', response.data);
    
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('分类API: 获取分类统计失败:', error);
    // 如果统计端点不存在，返回默认值
    if (error.response?.status === 404) {
      return {
        success: true,
        data: {
          note_count: 0,
          total_words: 0,
          total_chars: 0
        }
      };
    }
    return {
      success: false,
      message: error.response?.data?.message || error.message || '获取分类统计失败',
      error
    };
  }
};

/**
 * 批量删除分类
 * @param {Array<string>} ids - 分类ID数组
 * @returns {Promise} - 删除结果
 */
export const batchDeleteCategories = async (ids) => {
  try {
    console.log('分类API: 开始批量删除分类', ids);
    const response = await instance.post(`${API_ENDPOINTS.NOTES.CATEGORIES}batch_delete/`, { ids });
    console.log('分类API: 批量删除分类成功');
    
    return {
      success: true,
      data: response.data,
      message: '批量删除成功'
    };
  } catch (error) {
    console.error('分类API: 批量删除分类失败:', error);
    return {
      success: false,
      message: error.response?.data?.message || error.message || '批量删除失败',
      error
    };
  }
};

/**
 * 移动笔记到分类
 * @param {string} categoryId - 目标分类ID
 * @param {Array<string>} noteIds - 笔记ID数组
 * @returns {Promise} - 移动结果
 */
export const moveNotesToCategory = async (categoryId, noteIds) => {
  try {
    console.log('分类API: 开始移动笔记到分类', categoryId, noteIds);
    const response = await instance.post(
      `${API_ENDPOINTS.NOTES.CATEGORIES}${categoryId}/move_notes/`,
      { note_ids: noteIds }
    );
    console.log('分类API: 移动笔记成功');
    
    return {
      success: true,
      data: response.data,
      message: '笔记移动成功'
    };
  } catch (error) {
    console.error('分类API: 移动笔记失败:', error);
    return {
      success: false,
      message: error.response?.data?.message || error.message || '移动笔记失败',
      error
    };
  }
};

/**
 * 合并分类
 * @param {string} sourceId - 源分类ID
 * @param {string} targetId - 目标分类ID
 * @returns {Promise} - 合并结果
 */
export const mergeCategories = async (sourceId, targetId) => {
  try {
    console.log('分类API: 开始合并分类', sourceId, targetId);
    const response = await instance.post(
      `${API_ENDPOINTS.NOTES.CATEGORIES}merge/`,
      { source_id: sourceId, target_id: targetId }
    );
    console.log('分类API: 合并分类成功');
    
    return {
      success: true,
      data: response.data,
      message: '分类合并成功'
    };
  } catch (error) {
    console.error('分类API: 合并分类失败:', error);
    return {
      success: false,
      message: error.response?.data?.message || error.message || '合并分类失败',
      error
    };
  }
};

export default {
  getCategories,
  getCategoryTree,
  getCategoryDetail,
  createCategory,
  updateCategory,
  deleteCategory,
  getCategoryNotes,
  getCategoryStatistics,
  batchDeleteCategories,
  moveNotesToCategory,
  mergeCategories
};
