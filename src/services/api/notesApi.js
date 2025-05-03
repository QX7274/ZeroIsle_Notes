/**
 * 笔记API服务
 */
import instance from './interceptor';
import { API_ENDPOINTS } from '../../config/api';
import { offlineStorageService } from '../offlineStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../../utils/constants/config';

/**
 * 创建笔记
 * @param {object} note - 笔记数据
 * @returns {Promise} - 创建结果
 */
export const createNote = async (note) => {
  try {
    // 检查网络状态
    const status = offlineStorageService.getStatus();

    // 如果在线，尝试联网创建笔记
    if (status.isOnline) {
      try {
        const response = await instance.post(API_ENDPOINTS.NOTES.BASE, note);
        return {
          success: true,
          data: response.data
        };
      } catch (networkError) {
        console.log('网络创建笔记失败，使用本地模式', networkError);
        // 网络请求失败，转为离线模式
      }
    }

    // 离线模式：保存到本地存储
    // 生成临时ID
    const tempId = 'temp_' + Date.now();

    // 创建本地笔记对象
    const localNote = {
      ...note,
      id: tempId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_synced: false
    };

    // 使用离线存储服务保存笔记
    const saveResult = await offlineStorageService.saveNote(localNote);

    if (saveResult.success) {
      return {
        success: true,
        data: saveResult.note,
        isOffline: true
      };
    } else {
      throw new Error(saveResult.error || '保存离线笔记失败');
    }
  } catch (error) {
    return {
      success: false,
      message: error.message || '创建笔记失败',
      error
    };
  }
};

/**
 * 更新笔记
 * @param {string} id - 笔记ID
 * @param {object} note - 笔记数据
 * @returns {Promise} - 更新结果
 */
export const updateNote = async (id, note) => {
  try {
    const response = await instance.put(API_ENDPOINTS.NOTES.DETAIL(id), note);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '更新笔记失败',
      error
    };
  }
};

/**
 * 删除笔记
 * @param {string} id - 笔记ID
 * @returns {Promise} - 删除结果
 */
export const deleteNote = async (id) => {
  try {
    await instance.delete(API_ENDPOINTS.NOTES.DETAIL(id));
    return {
      success: true
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '删除笔记失败',
      error
    };
  }
};

/**
 * 获取所有笔记
 * @param {object} params - 查询参数
 * @returns {Promise} - 笔记列表
 */
export const getAllNotes = async (params = {}) => {
  try {
    const response = await instance.get(API_ENDPOINTS.NOTES.BASE, { params });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '获取笔记列表失败',
      error
    };
  }
};

/**
 * 获取笔记详情
 * @param {string} id - 笔记ID
 * @returns {Promise} - 笔记详情
 */
export const getNoteById = async (id) => {
  try {
    const response = await instance.get(API_ENDPOINTS.NOTES.DETAIL(id));
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '获取笔记详情失败',
      error
    };
  }
};

/**
 * 收藏/取消收藏笔记
 * @param {string} id - 笔记ID
 * @returns {Promise} - 操作结果
 */
export const toggleFavorite = async (id) => {
  try {
    const response = await instance.post(API_ENDPOINTS.NOTES.FAVORITE(id));
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '操作失败',
      error
    };
  }
};

/**
 * 获取笔记统计信息
 * @returns {Promise} - 统计信息
 */
export const getNoteStats = async () => {
  try {
    const response = await instance.get(API_ENDPOINTS.NOTES.STATS);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '获取统计信息失败',
      error
    };
  }
};

/**
 * 获取笔记标签
 * @returns {Promise} - 标签列表
 */
const getNoteTags = async () => {
  try {
    const response = await instance.get(API_ENDPOINTS.NOTES.TAGS);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '获取标签失败',
      error
    };
  }
};

/**
 * 获取笔记分类
 * @returns {Promise} - 分类列表
 */
const getNoteCategories = async () => {
  try {
    const response = await instance.get(API_ENDPOINTS.NOTES.CATEGORIES);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '获取分类失败',
      error
    };
  }
};

/**
 * 获取笔记历史版本
 * @param {string} id - 笔记ID
 * @returns {Promise} - 历史版本列表
 */
const getNoteHistory = async (id) => {
  try {
    const response = await instance.get(API_ENDPOINTS.NOTES.HISTORY(id));
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '获取历史版本失败',
      error
    };
  }
};

/**
 * 导出笔记
 * @param {string} id - 笔记ID
 * @param {string} format - 导出格式（如 'pdf', 'markdown', 'html'）
 * @returns {Promise} - 导出结果
 */
const exportNote = async (id, format) => {
  try {
    const response = await instance.get(`${API_ENDPOINTS.NOTES.EXPORT}?id=${id}&format=${format}`, {
      responseType: 'blob'
    });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '导出笔记失败',
      error
    };
  }
};

/**
 * 导入笔记
 * @param {FormData} formData - 包含文件的表单数据
 * @returns {Promise} - 导入结果
 */
const importNote = async (formData) => {
  try {
    const response = await instance.post(API_ENDPOINTS.NOTES.IMPORT, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '导入笔记失败',
      error
    };
  }
};

/**
 * 保存离线笔记
 * @param {object} note - 笔记数据
 * @returns {Promise} - 保存结果
 */
export const saveOfflineNote = async (note) => {
  try {
    const saveResult = await offlineStorageService.saveNote(note);
    return saveResult;
  } catch (error) {
    return {
      success: false,
      message: error.message || '保存离线笔记失败',
      error
    };
  }
};

/**
 * 同步离线笔记
 * @returns {Promise} - 同步结果
 */
export const syncOfflineNotes = async () => {
  try {
    const result = await offlineStorageService.manualSync();
    return result;
  } catch (error) {
    return {
      success: false,
      message: error.message || '同步离线笔记失败',
      error
    };
  }
};

/**
 * 获取离线笔记
 * @returns {Promise} - 离线笔记列表
 */
export const getOfflineNotes = async () => {
  try {
    const notes = await offlineStorageService.getNotes();
    return {
      success: true,
      data: notes
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '获取离线笔记失败',
      error
    };
  }
};

/**
 * 根据关键词搜索笔记
 * @param {object} params - 搜索参数
 * @param {string} params.text - 要搜索的文本
 * @param {Array<string>} params.keywords - 关键词数组
 * @returns {Promise} - 搜索结果
 */
export const searchByKeywords = async (params) => {
  try {
    const response = await instance.post(`${API_ENDPOINTS.NOTES.BASE}search/`, params);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '搜索笔记失败',
      error
    };
  }
};

const notesApi = {
  createNote,
  updateNote,
  deleteNote,
  getAllNotes,
  getNoteById,
  toggleFavorite,
  getNoteStats,
  getNoteTags,
  getNoteCategories,
  getNoteHistory,
  exportNote,
  importNote,
  saveOfflineNote,
  syncOfflineNotes,
  getOfflineNotes,
  searchByKeywords
};

export default notesApi;