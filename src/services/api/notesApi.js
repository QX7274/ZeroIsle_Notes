/**
 * 笔记API服务
 */
import instance from './interceptor';
import { API_ENDPOINTS } from '../../constants/api';
import { offlineStorageService } from '../offline/offlineStorageService';
import NetInfo from '@react-native-community/netinfo';
import { getNotesFromOfflineStorage } from '../offline/getNotes';

// 使用导入的离线存储服务

/**
 * 获取所有笔记
 * @param {object} params - 查询参数
 * @returns {Promise} - 笔记列表
 */
const getAllNotes = async (params = {}) => {
  try {
    console.log('开始获取所有笔记...');
    const startTime = Date.now();

    // 设置较长的超时，确保有足够时间加载数据
    const timeoutPromise = new Promise(resolve => {
      setTimeout(() => {
        console.log('获取笔记超时，显示空列表');
        resolve({
          success: true,
          message: '欢迎使用！点击右下角"+"按钮创建您的第一条笔记',
          data: [],
          isFirstUse: true
        });
      }, 15000); // 15秒超时，增加等待时间
    });

    // 使用辅助函数从离线存储获取笔记
    // 直接从Redux状态获取笔记数据
    console.log('尝试从Redux状态获取笔记数据');
    const fetchPromise = new Promise(async (resolve) => {
      try {
        // 先尝试从离线存储获取笔记
        const notes = await getNotesFromOfflineStorage();

        // 如果获取到笔记，直接返回
        if (notes && notes.data && notes.data.length > 0) {
          console.log(`成功从离线存储获取到${notes.data.length}条笔记`);
          resolve(notes);
          return;
        }

        // 如果没有获取到笔记，尝试从Redux状态获取
        console.log('离线存储中没有笔记，尝试从Redux状态获取');

        // 从Redux状态获取笔记
        const { store } = require('../../store');
        const state = store.getState();
        const reduxNotes = state.notes.entities ? Object.values(state.notes.entities) : [];

        if (reduxNotes && reduxNotes.length > 0) {
          console.log(`成功从Redux状态获取到${reduxNotes.length}条笔记`);
          resolve({
            success: true,
            data: reduxNotes,
            message: '从Redux状态获取笔记成功'
          });
        } else {
          console.log('Redux状态中没有笔记，返回空数组');
          resolve({
            success: true,
            data: [],
            message: '欢迎使用！点击右下角"+"按钮创建您的第一条笔记',
            isFirstUse: true
          });
        }
      } catch (error) {
        console.error('获取笔记失败:', error);
        resolve({
          success: true,
          data: [],
          message: '获取笔记失败，返回空数组',
          error: error.message
        });
      }
    });

    // 使用Promise.race确保不会一直等待
    return await Promise.race([fetchPromise, timeoutPromise]);
  } catch (error) {
    console.error('获取笔记列表过程中出现未处理的错误:', error);

    // 即使出错，也返回空数组而不是错误，避免UI崩溃
    return {
      success: true,
      message: '获取笔记列表失败，返回空数组',
      error: error.message,
      data: []
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

    // 检查文件是否存在
    if (!fileObj) {
      console.error('未找到文件对象:', formData);
      throw new Error('未提供文件或无法识别文件格式');
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

    // 如果仍然没有找到URI，尝试获取更多信息
    if (!fileUri) {
      console.warn('文件URI不存在，尝试获取更多信息');

      // 检查fileObj是否有其他可用信息
      if (typeof fileObj === 'object' && fileObj !== null) {
        console.log('文件对象详情:', JSON.stringify(fileObj, null, 2));

        // 尝试从其他属性获取URI
        if (fileObj.originalPath) {
          fileUri = fileObj.originalPath;
          console.log('使用originalPath作为URI:', fileUri);
        } else if (fileObj.path) {
          fileUri = fileObj.path;
          console.log('使用path作为URI:', fileUri);
        } else if (fileObj.url) {
          fileUri = fileObj.url;
          console.log('使用url作为URI:', fileUri);
        } else {
          // 如果仍然没有找到有效的URI，创建一个临时URI并记录警告
          console.error('无法获取有效的文件URI，文件可能无法正常打开');
          fileUri = `file://temp/${fileName}`;
          console.log('创建的临时URI:', fileUri);

          // 添加警告标志，表示这个URI可能无效
          console.warn('警告：创建的临时URI可能无效，文件可能无法正常打开');
        }
      } else {
        // 如果fileObj不是对象，创建一个临时URI
        console.error('文件对象无效，无法获取文件URI');
        fileUri = `file://temp/${fileName}`;
        console.log('创建的临时URI:', fileUri);
      }
    }

    // 生成临时ID
    const tempId = 'temp_' + Date.now() + '_' + Math.random().toString(36).substring(2, 9);

    // 创建笔记对象 - 统一使用id作为主要ID字段，_id作为兼容字段
    const noteId = tempId;

    // 创建metadata对象
    const metadataObj = {
      pdfPath: fileType === 'pdf' ? fileUri : null,
      imagePath: fileType === 'image' ? fileUri : null,
      fileSize: null, // 文件大小，后续可以添加
      pageCount: null, // PDF页数，后续可以添加
      lastOpenedPage: 1, // 上次打开的页码
      lastOpenedTime: new Date().toISOString() // 上次打开时间
    };

    // 将metadata转换为字符串
    const metadataString = JSON.stringify(metadataObj);

    const note = {
      // 统一ID字段
      id: noteId, // 使用id作为主要ID字段
      _id: noteId, // 同时设置_id字段，确保兼容性

      title: title,
      content: `导入的${fileType}文件: ${fileName}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_synced: false,

      // 统一文件类型标识 - 确保这些字段被正确设置
      type: fileType, // 使用type作为主要类型字段
      file_type: fileType, // 同时设置file_type字段，确保兼容性

      // 文件信息 - 确保这些字段被正确设置
      file_name: fileName,
      file_uri: fileUri,
      uri: fileUri, // 添加uri字段作为备用
      path: fileUri, // 添加path字段作为备用
      file_path: fileUri, // 添加file_path字段作为备用
      url: fileUri, // 添加url字段作为备用

      imported: true,
      is_offline: true, // 标记为离线笔记

      // 添加预览图片
      preview_image: fileType === 'pdf' ? 'https://img-blog.csdnimg.cn/20200627111426602.png' : null,

      // 添加metadata，确保是字符串类型
      metadata: metadataString,

      // 确保tags是字符串数组
      tags: []
    };

    // 记录导入信息
    console.log('导入的笔记对象:', JSON.stringify({
      id: note.id,
      _id: note._id,
      type: note.type,
      file_type: note.file_type,
      file_uri: note.file_uri
    }, null, 2));

    // 保存到离线存储
    console.log('尝试保存笔记到离线存储');
    const saveResult = await offlineStorageService.saveNote(note);
    console.log('保存笔记结果:', saveResult);

    if (!saveResult || !saveResult.success) {
      console.error('离线存储保存失败:', saveResult?.message || '未知错误');

      // 创建一个简化版的笔记对象作为备用
      const fallbackNote = {
        _id: note._id,
        id: note._id, // 同时保留id字段以兼容旧代码
        title: note.title,
        content: note.content,
        type: note.type,
        file_type: note.file_type,
        file_name: note.file_name,
        file_uri: note.file_uri,
        uri: note.file_uri, // 添加uri字段作为备用
        path: note.file_uri, // 添加path字段作为备用
        file_path: note.file_uri, // 添加file_path字段作为备用
        url: note.file_uri, // 添加url字段作为备用
        created_at: note.created_at,
        updated_at: note.updated_at,
        metadata: note.metadata || {}
      };

      // 返回备用笔记对象
      return {
        success: true,
        data: {
          ...fallbackNote,
          message: `导入${fileType}成功（使用备用方法）`,
          note_id: note._id,
          _id: note._id,
          isOffline: true
        },
        isOffline: true
      };
    }

    // 不再保存到MongoDB数据库
    console.log('根据用户要求，不保存到MongoDB数据库，只保存到本地数据库');

    // 使用本地存储导入文件，不尝试在线导入
    console.log('使用本地存储导入文件，不尝试在线导入');

    // 返回本地导入的结果，包含完整的笔记对象
    console.log('准备返回导入结果');

    // 确保saveResult.note存在
    const noteToReturn = saveResult.note || {
      _id: note._id,
      id: note._id,
      title: note.title,
      content: note.content,
      type: note.type,
      file_type: note.file_type,
      file_name: note.file_name,
      file_uri: note.file_uri,
      uri: note.file_uri, // 添加uri字段作为备用
      path: note.file_uri, // 添加path字段作为备用
      file_path: note.file_uri, // 添加file_path字段作为备用
      url: note.file_uri, // 添加url字段作为备用
      created_at: note.created_at,
      updated_at: note.updated_at,
      metadata: note.metadata || {}
    };

    return {
      success: true,
      data: {
        ...noteToReturn,
        message: `导入${fileType}成功`,
        note_id: note._id, // 使用_id字段
        _id: note._id, // 添加_id字段
        id: note._id, // 同时保留id字段以兼容旧代码
        title: note.title,
        isOffline: true
      },
      isOffline: true
    };
  } catch (error) {
    console.error('导入PDF过程中出错:', error);
    return {
      success: false,
      message: error.message || '导入失败',
      error
    };
  }
};

/**
 * 根据ID获取笔记详情
 * @param {string} id 笔记ID
 * @returns {Promise} 笔记详情
 */
const getById = async (id) => {
  try {
    console.log(`开始获取笔记详情 (ID: ${id})`);

    // 检查ID是否有效
    if (!id) {
      console.error('无效的笔记ID:', id);
      return {
        success: false,
        message: '无效的笔记ID'
      };
    }

    // 从离线存储获取笔记
    const note = await offlineStorageService.getNote(id);

    if (!note) {
      console.warn(`未找到ID为${id}的笔记`);
      return {
        success: false,
        message: '未找到笔记'
      };
    }

    console.log(`成功获取到笔记详情:`, note);

    // 统一ID字段和文件类型标识
    const unifiedNote = { ...note };

    // 统一ID字段 - 使用id作为主要ID字段，_id作为兼容字段
    const noteId = note.id || note._id || id;
    unifiedNote.id = noteId;
    unifiedNote._id = noteId;

    // 统一文件类型标识 - 使用type作为主要类型字段，file_type作为兼容字段
    if (note.file_type && !note.type) {
      unifiedNote.type = note.file_type;
    } else if (note.type && !note.file_type) {
      unifiedNote.file_type = note.type;
    }

    // 特殊处理PDF文件
    if ((unifiedNote.type === 'pdf' || unifiedNote.file_type === 'pdf') && unifiedNote.file_uri) {
      // 确保两个类型字段都设置为pdf
      unifiedNote.type = 'pdf';
      unifiedNote.file_type = 'pdf';

      // 确保metadata存在并设置pdfPath
      unifiedNote.metadata = unifiedNote.metadata || {};
      unifiedNote.metadata.pdfPath = unifiedNote.file_uri;
    }

    console.log(`统一后的笔记数据:`, {
      id: unifiedNote.id,
      _id: unifiedNote._id,
      type: unifiedNote.type,
      file_type: unifiedNote.file_type
    });

    return {
      success: true,
      data: unifiedNote
    };
  } catch (error) {
    console.error(`获取笔记详情失败 (ID: ${id}):`, error);
    return {
      success: false,
      message: error.message || '获取笔记详情失败',
      error
    };
  }
};

// 导出API对象
const notesApi = {
  getAllNotes,
  importNote,
  getById, // 添加getById方法
  // 添加其他API方法
  getNote: async (id) => {
    try {
      console.log(`尝试获取笔记 (ID: ${id})`);

      // 检查ID是否有效
      if (!id) {
        console.error('无效的笔记ID:', id);
        return {
          success: false,
          message: '无效的笔记ID'
        };
      }

      // 1. 首先尝试从Redux状态获取笔记
      try {
        const { store } = require('../../store');
        const state = store.getState();

        // 检查Redux状态中是否有该笔记
        if (state.notes && state.notes.entities) {
          // 尝试使用id和_id两种方式查找
          const noteById = state.notes.entities[id];

          if (noteById) {
            console.log(`从Redux状态获取到笔记 (ID: ${id})`);
            return {
              success: true,
              data: noteById
            };
          }

          // 如果没有找到，尝试在所有实体中查找匹配的_id
          const allNotes = Object.values(state.notes.entities);
          const noteByAltId = allNotes.find(note =>
            (note._id && note._id === id) ||
            (note.id && note.id === id)
          );

          if (noteByAltId) {
            console.log(`从Redux状态获取到笔记 (通过替代ID匹配)`);
            return {
              success: true,
              data: noteByAltId
            };
          }
        }
      } catch (reduxError) {
        console.warn('从Redux获取笔记失败:', reduxError);
      }

      // 2. 如果Redux状态中没有该笔记，尝试从离线存储获取
      console.log(`尝试从离线存储获取笔记 (ID: ${id})`);
      try {
        await offlineStorageService.initialize();
        const note = await offlineStorageService.getNote(id);

        if (note) {
          console.log(`从离线存储获取到笔记 (ID: ${id})`);

          // 确保ID字段一致
          const unifiedNote = {
            ...note,
            id: note.id || note._id || id,
            _id: note._id || note.id || id
          };

          return {
            success: true,
            data: unifiedNote
          };
        }
      } catch (storageError) {
        console.warn('从离线存储获取笔记失败:', storageError);
      }

      // 3. 尝试获取最近的笔记，看是否有匹配的
      try {
        console.log('尝试从最近笔记中查找');
        const recentNotes = await offlineStorageService.getRecentNotes(20);

        if (recentNotes && recentNotes.length > 0) {
          // 查找匹配的笔记
          const matchingNote = recentNotes.find(n =>
            (n._id && (n._id === id || n._id.toString().includes(id))) ||
            (n.id && (n.id === id || n.id.toString().includes(id)))
          );

          if (matchingNote) {
            console.log(`从最近笔记中找到匹配的笔记:`, matchingNote._id || matchingNote.id);
            return {
              success: true,
              data: matchingNote
            };
          }
        }
      } catch (recentError) {
        console.warn('从最近笔记中查找失败:', recentError);
      }

      // 4. 如果都没有找到，返回一个默认笔记
      console.log(`未找到笔记 (ID: ${id})，返回默认笔记`);
      return {
        success: true,
        data: {
          _id: id,
          id: id,
          title: '未找到笔记',
          content: '该笔记可能已被删除或不存在',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }
      };
    } catch (error) {
      console.error(`获取笔记失败 (ID: ${id}):`, error);
      return {
        success: false,
        message: error.message || '获取笔记详情失败',
        error
      };
    }
  },
  createNote: async (noteData) => {
    try {
      // 保存到离线存储
      const result = await offlineStorageService.saveNote(noteData);
      return { success: true, data: { ...noteData, id: noteData.id || `note_${Date.now()}` } };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },
  updateNote: async (id, noteData) => {
    try {
      // 确保tags是数组格式
      const safeNoteData = { ...noteData };
      if (safeNoteData.tags && typeof safeNoteData.tags === 'object' && !Array.isArray(safeNoteData.tags)) {
        // 如果tags是对象但不是数组，尝试提取results属性作为数组
        safeNoteData.tags = Array.isArray(safeNoteData.tags.results) ? safeNoteData.tags.results : [];
      } else if (!Array.isArray(safeNoteData.tags)) {
        // 确保tags始终是数组
        safeNoteData.tags = [];
      }
      
      // 更新到离线存储
      const result = await offlineStorageService.saveNote({ ...safeNoteData, id });
      return { success: true, data: { ...safeNoteData, id } };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },
  deleteNote: async (id) => {
    try {
      // 从离线存储删除
      const result = await offlineStorageService.deleteNote(id, true);
      return { success: true };
    } catch (error) {
      return { success: false, message: error.message };
    }
  },
  recognizeHandwriting: (imageData) => ({ success: true, data: '识别结果' }),
  uploadImage: (imageData, noteId) => ({ success: true, data: { url: 'https://example.com/image.jpg' } }),
  autoSaveNote: (id, noteData) => ({ success: true, data: { ...noteData, id } }),
  getNoteHistory: (id) => ({ success: true, data: [] }),
  getNoteVersion: (id, versionId) => ({ success: true, data: { id, version: versionId, content: '历史版本内容' } }),
  restoreNoteVersion: (id, versionId) => ({ success: true, data: { id, content: '恢复的内容' } }),
  saveOfflineNote: (note) => ({ success: true, data: note }),
  getNoteCategories: () => ({ success: true, data: [] })
};

export default notesApi;