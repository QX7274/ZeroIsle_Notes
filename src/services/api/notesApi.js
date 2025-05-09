/**
 * 笔记API服务
 */
import instance from './interceptor';
import { API_ENDPOINTS } from '../../config/api';
import { offlineStorageService } from '../offline/offlineStorage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../../utils/constants/config';
import NetInfo from '@react-native-community/netinfo';
import { dataService } from '../database';

// 使用导入的离线存储服务

/**
 * 创建笔记
 * @param {object} note - 笔记数据
 * @returns {Promise} - 创建结果
 */
export const createNote = async (note) => {
  try {
    console.log('开始创建笔记:', note.title);

    // 生成唯一ID，确保在离线状态下也能使用
    const noteId = note.id || 'temp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);

    // 准备笔记数据，添加必要的元数据
    const now = new Date().toISOString();
    const noteWithMeta = {
      ...note,
      id: noteId,
      created_at: now,
      updated_at: now,
      is_synced: false,
      is_offline: true  // 标记为离线创建
    };

    // 1. 优先保存到本地SQLite数据库
    let createdNote = null;
    try {
      // 确保数据服务已初始化，但设置较短的超时时间
      await dataService.init();

      // 使用数据服务创建笔记
      createdNote = await dataService.createNote(noteWithMeta);
      console.log('SQLite保存笔记成功:', createdNote.id);
    } catch (sqliteError) {
      console.error('SQLite保存笔记失败，尝试使用备用存储:', sqliteError);
      // SQLite失败时，不抛出错误，继续尝试其他存储方式
    }

    // 2. 同时保存到旧的离线存储，以保持兼容性
    try {
      // 使用已创建的笔记或原始笔记数据
      const localNote = createdNote || noteWithMeta;

      await offlineStorageService.saveNote(localNote);
      console.log('离线存储保存笔记成功:', localNote.id);

      // 如果SQLite保存失败，使用离线存储的结果
      if (!createdNote) {
        createdNote = localNote;
      }
    } catch (offlineError) {
      console.error('离线存储保存笔记失败:', offlineError);

      // 如果两种存储都失败，且没有创建笔记，则抛出错误
      if (!createdNote) {
        throw new Error('所有存储方式都失败，无法创建笔记');
      }
    }

    // 3. 在后台尝试同步到服务器，但不阻塞UI
    setTimeout(async () => {
      try {
        // 检查网络状态
        const networkStatus = await NetInfo.fetch();
        const isOnline = networkStatus.isConnected && networkStatus.isInternetReachable;

        if (isOnline) {
          console.log('尝试在后台同步笔记到服务器:', noteId);

          // 设置请求头，标记为离线模式，这样即使请求失败也不会影响用户体验
          const headers = { 'X-Offline-Mode': 'true' };

          // 发送API请求，但不等待结果
          apiClient.post('/notes', createdNote, { headers })
            .then(response => {
              console.log('笔记同步到服务器成功:', response);

              // 更新本地记录为已同步
              dataService.updateNote(noteId, {
                ...createdNote,
                is_synced: true,
                server_id: response.id || response.data?.id || noteId
              }).catch(err => console.warn('更新本地笔记同步状态失败:', err));
            })
            .catch(err => {
              console.warn('后台同步笔记失败，将在下次联网时重试:', err);
            });
        } else {
          console.log('当前离线，笔记将在下次联网时同步');
        }
      } catch (syncError) {
        console.warn('后台同步过程出错:', syncError);
      }
    }, 0);

    // 立即返回创建的结果，不等待同步
    return {
      success: true,
      data: createdNote,
      isOffline: true
    };
  } catch (error) {
    console.error('创建笔记失败:', error);
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
    // 确保数据服务已初始化
    await dataService.init();

    // 使用数据服务更新笔记
    const updatedNote = await dataService.updateNote(id, note);

    // 同时更新旧的离线存储，以保持兼容性
    try {
      const localNote = {
        ...updatedNote,
        is_synced: false
      };
      await offlineStorageService.updateNote(id, localNote);
    } catch (offlineError) {
      console.log('更新旧的离线存储失败，但SQLite更新成功', offlineError);
    }

    return {
      success: true,
      data: updatedNote
    };
  } catch (error) {
    console.error('更新笔记失败:', error);
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
    // 确保数据服务已初始化
    await dataService.init();

    // 使用数据服务删除笔记（软删除）
    await dataService.deleteNote(id);

    // 同时从旧的离线存储中删除，以保持兼容性
    try {
      await offlineStorageService.deleteNote(id);
    } catch (offlineError) {
      console.log('从旧的离线存储删除失败，但SQLite删除成功', offlineError);
    }

    return {
      success: true
    };
  } catch (error) {
    console.error('删除笔记失败:', error);
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
    // 确保数据服务已初始化
    await dataService.init();

    // 检查网络状态
    const networkStatus = await NetInfo.fetch();
    const isOnline = networkStatus.isConnected && networkStatus.isInternetReachable;

    // 获取当前用户信息
    const storageService = require('../storage/storageService');
    const user = await storageService.getUser();

    if (!user || !user.id) {
      console.warn('未找到当前用户信息，尝试从离线存储获取笔记');
      return await getOfflineNotes();
    }

    // 设置当前用户到dataService
    dataService.setCurrentUser(user);

    // 确保params中包含userId
    const paramsWithUserId = {
      ...params,
      userId: user.id
    };

    // 从SQLite获取笔记
    const notes = await dataService.getNotes(paramsWithUserId);
    console.log(`从SQLite获取到${notes.length}条笔记`);

    // 如果在线，尝试从服务器获取最新数据并同步
    if (isOnline) {
      try {
        console.log('在线模式：尝试从服务器获取最新笔记');
        // 异步从服务器获取数据，不等待结果
        instance.get(API_ENDPOINTS.NOTES.BASE, { params }).then(async response => {
          if (response && response.data) {
            console.log(`从服务器获取到${response.data.length}条笔记`);
            // 触发同步服务进行数据同步
            await dataService.syncNotes(response.data);
          }
        }).catch(networkError => {
          console.log('从服务器获取笔记失败，使用本地数据', networkError);
        });
      } catch (networkError) {
        console.log('从服务器获取笔记失败，使用本地数据', networkError);
      }
    } else {
      console.log('离线模式：仅使用本地SQLite数据');
    }

    return {
      success: true,
      data: notes,
      isOffline: !isOnline
    };
  } catch (error) {
    console.error('获取笔记列表失败:', error);

    // 尝试从旧的离线存储获取
    try {
      console.log('SQLite获取失败，尝试从旧的离线存储获取笔记');
      return await getOfflineNotes();
    } catch (offlineError) {
      console.error('从旧的离线存储获取笔记也失败:', offlineError);
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
    console.log(`开始获取笔记详情 (ID: ${id})`);
    const startTime = Date.now();

    // 检查SQLite数据库连接状态
    const sqliteService = dataService.getSqliteService();
    const isConnected = await sqliteService.checkConnection(10000);

    if (!isConnected) {
      console.warn('SQLite数据库连接不可用，尝试使用备用方法获取笔记');
      throw new Error('数据库连接不可用');
    }

    console.log('SQLite数据库连接正常，开始获取笔记数据');

    // 确保数据服务已初始化
    await dataService.init();

    // 从SQLite获取笔记详情 - 使用更长的超时时间
    const note = await dataService.getNote(id, 15000);
    console.log(`从SQLite获取笔记详情成功，耗时: ${Date.now() - startTime}ms`);

    // 检查网络状态
    const networkStatus = await NetInfo.fetch();
    const isOnline = networkStatus.isConnected && networkStatus.isInternetReachable;

    // 如果在线，尝试从服务器获取最新数据
    if (isOnline) {
      try {
        // 异步从服务器获取数据，不等待结果
        instance.get(API_ENDPOINTS.NOTES.DETAIL(id)).then(async response => {
          if (response && response.data) {
            console.log('从服务器获取到最新笔记数据，更新本地数据');
            // 更新本地数据
            await dataService.updateNote(id, response.data);
          }
        }).catch(networkError => {
          console.log('从服务器获取笔记详情失败，使用本地数据', networkError);
        });
      } catch (networkError) {
        console.log('从服务器获取笔记详情失败，使用本地数据', networkError);
      }
    }

    return {
      success: true,
      data: note,
      isOffline: !isOnline
    };
  } catch (error) {
    console.error('获取笔记详情失败:', error);

    // 记录详细的错误信息
    if (error.message) {
      console.error('错误详情:', error.message);
    }
    if (error.stack) {
      console.error('错误堆栈:', error.stack);
    }

    // 尝试从服务器获取
    try {
      console.log('尝试从服务器获取笔记详情');
      const response = await instance.get(API_ENDPOINTS.NOTES.DETAIL(id));
      console.log('从服务器获取笔记详情成功');
      return {
        success: true,
        data: response.data,
        fromServer: true
      };
    } catch (serverError) {
      console.error('从服务器获取笔记详情也失败:', serverError);

      // 提供更详细的错误信息
      let errorMessage = '获取笔记详情失败';

      if (error.message) {
        if (error.message.includes('数据库连接不可用')) {
          errorMessage = '数据库连接不可用，请重启应用后重试';
        } else if (error.message.includes('超时')) {
          errorMessage = '数据库查询超时，请稍后重试';
        } else {
          errorMessage = error.message;
        }
      }

      return {
        success: false,
        message: errorMessage,
        error
      };
    }
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
export const getNoteCategories = async () => {
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
        // 遍历所有parts寻找文件对象
        for (const part of formData._parts) {
          if (Array.isArray(part) && part.length > 1 && part[0] === 'file') {
            fileObj = part[1];
            console.log('从FormData._parts提取文件对象:', fileObj);

            if (fileObj && typeof fileObj === 'object') {
              fileName = fileObj.name || `导入的${fileType}文件_${new Date().toISOString()}`;
              console.log(`设置文件名: ${fileName}`);
              break;
            }
          }
        }
      }

      // 如果仍然没有找到文件对象，创建一个模拟的文件对象
      if (!fileObj && formData._parts && Array.isArray(formData._parts)) {
        console.log('创建模拟文件对象');
        // 尝试从formData中找到任何可能的URI
        let uri = '';
        for (const part of formData._parts) {
          if (Array.isArray(part) && part.length > 1 && typeof part[1] === 'object' && part[1] !== null) {
            if (part[1].uri) {
              uri = part[1].uri;
              console.log('找到URI:', uri);
              fileObj = {
                uri: uri,
                name: part[1].name || `导入的${fileType}文件_${new Date().toISOString()}`,
                type: part[1].type || (fileType === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')
              };
              fileName = fileObj.name;
              console.log('创建的模拟文件对象:', fileObj);
              break;
            }
          }
        }
      }

      // 如果仍然没有找到文件对象，抛出错误
      if (!fileObj) {
        throw new Error('未提供文件或无法识别文件格式');
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
      } else if (fileObj.path) {
        fileUri = fileObj.path;
      }
    }

    console.log('提取的文件URI:', fileUri);

    // 如果仍然没有找到URI，创建一个临时URI
    if (!fileUri) {
      console.warn('文件URI不存在，创建临时URI');
      fileUri = `file://temp/${fileName}`;
      console.log('创建的临时URI:', fileUri);
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
      is_offline: true, // 标记为离线笔记
      // 添加预览图片
      preview_image: fileType === 'pdf' ? 'https://img-blog.csdnimg.cn/20200627111426602.png' : null
    };

    // 保存到离线存储
    const saveResult = await offlineStorageService.saveNote(note);

    if (!saveResult.success) {
      throw new Error(saveResult.error || `离线导入${fileType}失败`);
    }

    // 添加到SQLite数据库
    try {
      // 确保数据服务已初始化
      await dataService.init();

      // 使用数据服务保存笔记
      await dataService.createNote(note);
      console.log('笔记已保存到SQLite数据库');
    } catch (dbError) {
      console.error('保存到SQLite数据库失败，但本地存储成功:', dbError);
      // 不影响整体导入流程
    }

    // 完全跳过在线导入尝试，直接使用本地存储
    console.log('使用本地存储导入文件，不尝试在线导入');

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
    console.error('导入失败:', error);
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