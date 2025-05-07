/**
 * 笔记API服务
 */
import instance from './interceptor';
import { API_ENDPOINTS } from '../../config/api';
import { offlineStorageService } from '../offline/offlineStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../../utils/constants/config';
import NetInfo from '@react-native-community/netinfo';

// 使用导入的离线存储服务

/**
 * 创建笔记
 * @param {object} note - 笔记数据
 * @returns {Promise} - 创建结果
 */
export const createNote = async (note) => {
  try {
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

    // 优先保存到本地存储
    const saveResult = await offlineStorageService.saveNote(localNote);

    if (!saveResult.success) {
      throw new Error(saveResult.error || '保存本地笔记失败');
    }

    // 检查网络状态
    const status = offlineStorageService.getStatus();

    // 如果在线，尝试联网创建笔记（但不影响本地创建的结果）
    if (status.isOnline) {
      try {
        // 异步发送到服务器，不等待结果
        instance.post(API_ENDPOINTS.NOTES.BASE, note).then(response => {
          console.log('网络创建笔记成功:', response.data);
          // 更新本地笔记的同步状态
          offlineStorageService.updateNoteSync(tempId, true);
        }).catch(networkError => {
          console.log('网络创建笔记失败，但本地保存成功', networkError);
        });
      } catch (networkError) {
        console.log('网络创建笔记失败，但本地保存成功', networkError);
      }
    }

    // 返回本地创建的结果
    return {
      success: true,
      data: saveResult.note,
      isOffline: true
    };
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
    // 检查网络状态
    const networkStatus = await NetInfo.fetch();
    const isOffline = !networkStatus.isConnected;

    if (isOffline) {
      console.log('离线模式：从本地存储获取笔记');
      // 离线模式：从本地存储获取笔记
      return await getOfflineNotes();
    }

    // 确保 API_ENDPOINTS 已正确导入
    if (!API_ENDPOINTS || !API_ENDPOINTS.NOTES || !API_ENDPOINTS.NOTES.BASE) {
      console.error('API_ENDPOINTS.NOTES.BASE 未定义');
      throw new Error('API配置错误');
    }

    // 在线模式：从服务器获取笔记
    console.log('在线模式：从服务器获取笔记');
    const response = await instance.get(API_ENDPOINTS.NOTES.BASE, { params });

    // 将在线笔记保存到本地存储
    if (response && response.data) {
      try {
        // 获取当前离线笔记
        const offlineNotes = await offlineStorageService.getNotes();

        // 合并在线笔记和离线笔记
        const mergedNotes = [...response.data];

        // 保存合并后的笔记到本地存储
        for (const note of mergedNotes) {
          if (!offlineNotes.find(n => n.id === note.id)) {
            await offlineStorageService.saveNote({
              ...note,
              synced: true
            });
          }
        }
      } catch (err) {
        console.error('保存在线笔记到本地存储失败:', err);
      }
    }

    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('获取笔记列表失败:', error);

    // 网络错误时尝试从本地存储获取
    try {
      console.log('网络错误，尝试从本地存储获取笔记');
      return await getOfflineNotes();
    } catch (offlineError) {
      console.error('从本地存储获取笔记失败:', offlineError);
      return {
        success: false,
        message: error.message || '获取笔记列表失败',
        error
      };
    }
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
    console.log('开始导入笔记，FormData:', formData);

    // 直接从FormData中提取文件和类型信息
    let fileType = 'generic';
    let fileObj = null;
    let fileName = '';

    // 直接从FormData的_parts属性获取文件对象
    if (formData._parts && Array.isArray(formData._parts)) {
      console.log('直接从FormData._parts获取数据');

      // 遍历FormData中的所有部分
      for (const part of formData._parts) {
        if (Array.isArray(part) && part.length === 2) {
          const [key, value] = part;
          console.log(`处理FormData部分: key=${key}, value=`, value);

          if (key === 'type' && typeof value === 'string') {
            fileType = value;
            console.log(`设置文件类型: ${fileType}`);
          } else if (key === 'file') {
            fileObj = value;
            console.log('找到文件对象:', fileObj);

            if (typeof fileObj === 'object' && fileObj !== null) {
              fileName = fileObj.name || `导入的${fileType}文件_${new Date().toISOString()}`;
              console.log(`设置文件名: ${fileName}`);
            }
          }
        }
      }
    }
    // 如果上面的方法没有找到文件，尝试使用getParts方法
    else if (formData.getParts && typeof formData.getParts === 'function') {
      const parts = formData.getParts();
      console.log('FormData parts:', parts);

      // 获取文件类型
      const typePart = parts.find(part => part.string === 'pdf' || part.string === 'word');
      if (typePart && typePart.string) {
        fileType = typePart.string;
        console.log(`从parts中设置文件类型: ${fileType}`);
      }

      // 获取文件对象
      const filePart = parts.find(part => part.uri && part.type);
      if (filePart) {
        fileObj = filePart;
        fileName = filePart.name || `导入的${fileType}文件_${new Date().toISOString()}`;
        console.log(`从parts中设置文件名: ${fileName}`);
      }
    } else {
      console.log('无法从FormData中提取文件信息');
    }

    // 检查文件是否存在
    if (!fileObj) {
      console.error('未找到文件对象:', formData);

      // 尝试直接从FormData._parts中提取第一个元素作为文件对象
      if (formData._parts && Array.isArray(formData._parts) && formData._parts.length > 0) {
        const firstPart = formData._parts[0];
        if (Array.isArray(firstPart) && firstPart.length > 1 && firstPart[0] === 'file') {
          fileObj = firstPart[1];
          console.log('从第一个元素提取文件对象:', fileObj);

          if (fileObj && typeof fileObj === 'object') {
            fileName = fileObj.name || `导入的${fileType}文件_${new Date().toISOString()}`;
            console.log(`从第一个元素设置文件名: ${fileName}`);
          }
        }
      }

      // 如果仍然没有找到文件对象，抛出错误
      if (!fileObj) {
        throw new Error('未提供文件');
      }
    }

    console.log('文件信息:', { fileType, fileName, fileObj });

    // 提取文件名和URI
    const title = fileName.split('.')[0]; // 使用文件名作为标题
    let fileUri = '';

    // 尝试多种方式获取文件URI
    if (typeof fileObj === 'object' && fileObj !== null) {
      if (fileObj.uri) {
        fileUri = fileObj.uri;
      } else if (fileObj.fileCopyUri) {
        fileUri = fileObj.fileCopyUri;
      }
    }

    console.log('提取的文件URI:', fileUri);

    if (!fileUri) {
      console.error('文件URI不存在:', fileObj);
      throw new Error('文件URI不存在');
    }

    // 生成临时ID
    const tempId = 'temp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

    // 创建笔记对象
    const note = {
      id: tempId,
      title: title,
      content: `导入的${fileType}文件: ${fileName}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_synced: false,
      file_type: fileType,
      file_name: fileName,
      file_uri: fileUri,
      imported: true,
      is_offline: true // 标记为离线笔记
    };

    // 保存到离线存储
    const saveResult = await offlineStorageService.saveNote(note);

    if (!saveResult.success) {
      throw new Error(saveResult.error || `离线导入${fileType}失败`);
    }

    // 检查网络状态
    const networkStatus = await NetInfo.fetch();
    const isOffline = !networkStatus.isConnected || offlineStorageService.offlineMode;

    // 如果在线，尝试使用API导入（但不影响本地导入的结果）
    if (!isOffline) {
      try {
        // 根据文件类型选择不同的API端点
        let endpoint = API_ENDPOINTS.NOTES.IMPORT;

        if (fileType === 'pdf') {
          endpoint = API_ENDPOINTS.NOTES.IMPORT_PDF;
        } else if (fileType === 'word') {
          endpoint = API_ENDPOINTS.NOTES.IMPORT_WORD;
        } else if (fileType === 'image') {
          endpoint = API_ENDPOINTS.NOTES.IMPORT_IMAGE;
        } else if (fileType === 'text') {
          endpoint = API_ENDPOINTS.NOTES.IMPORT_TEXT;
        }

        console.log(`使用导入端点: ${endpoint} 导入 ${fileType} 文件`);

        // 尝试同步到服务器，但不等待结果
        instance.post(endpoint, formData, {
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }).then(response => {
          console.log(`在线导入${fileType}成功:`, response.data);
          // 更新本地笔记的同步状态
          offlineStorageService.updateNoteSync(tempId, true);
        }).catch(error => {
          console.error(`在线导入${fileType}失败:`, error);
          // 失败不影响本地导入结果
        });
      } catch (error) {
        console.error(`在线导入${fileType}失败:`, error);
        // 在线导入失败不影响本地导入结果
      }
    }

    // 返回本地导入的结果，包含完整的笔记对象
    return {
      success: true,
      data: {
        ...saveResult.note,
        message: `导入${fileType}成功`,
        note_id: note.id,
        title: note.title,
        isOffline: true
      },
      isOffline: true
    };
  } catch (error) {
    console.error(`导入${formData.getParts().find(part => part.name === 'type')?.value || ''}失败:`, error);
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

    // 处理笔记日期格式，确保前端可以正确显示
    const processedNotes = notes.map(note => {
      // 确保每个笔记都有必要的字段
      return {
        ...note,
        // 确保有id字段
        id: note.id || note.note_id || `temp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        // 确保有title字段
        title: note.title || (note.file_name ? note.file_name.split('.')[0] : '未命名笔记'),
        // 确保有content字段
        content: note.content || '',
        // 确保有updatedAt字段，用于排序和显示
        updatedAt: note.updated_at || note.updatedAt || new Date().toISOString(),
        // 确保有createdAt字段
        createdAt: note.created_at || note.createdAt || new Date().toISOString(),
        // 添加文件类型信息
        type: note.file_type || note.type || 'text',
        // 添加导入标志
        imported: note.imported || false,
        // 添加文件信息
        file_name: note.file_name || '',
        file_uri: note.file_uri || '',
      };
    });

    console.log('处理后的离线笔记:', processedNotes.length, '条');

    return {
      success: true,
      data: processedNotes
    };
  } catch (error) {
    console.error('获取离线笔记失败:', error);
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

/**
 * 获取笔记（别名方法，与 getNoteById 相同）
 * @param {string} id - 笔记ID
 * @returns {Promise} - 笔记详情
 */
export const getNote = async (id) => {
  return getNoteById(id);
};

const notesApi = {
  createNote,
  updateNote,
  deleteNote,
  getAllNotes,
  getNoteById,
  getNote, // 添加别名方法
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