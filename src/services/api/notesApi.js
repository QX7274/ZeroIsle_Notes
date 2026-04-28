/**
 * 笔记API服务
 */
import instance from './apiClient';
import { API_ENDPOINTS } from '../../constants/api';
import realmService from '../database/realmService';
import { getNotesFromOfflineStorage } from '../offline/getNotes';
import networkErrorService from '../networkErrorService';
import RNFS from 'react-native-fs';
import RNBlobUtil from 'react-native-blob-util';
import { Platform } from 'react-native';

// Helpers for metadata computation
const normalizeFilePath = (uri) => {
  if (!uri) {return null;}
  return uri.startsWith('file://') ? uri.replace('file://', '') : uri;
};

const base64SizeInBytes = (b64) => {
  if (!b64) {return null;}
  const len = b64.length;
  const padding = (b64.endsWith('==') ? 2 : (b64.endsWith('=') ? 1 : 0));
  return Math.floor(len * 3 / 4) - padding;
};

const estimatePdfPageCount = (text) => {
  if (!text || typeof text !== 'string') {return null;}
  // Count '/Type /Page' occurrences but ignore '/Pages'
  const matches = text.match(/\/Type\s*\/Page(?!s)/g);
  return matches ? matches.length : null;
};

const readPdfText = async (uri) => {
  // Try RNFS first (file paths), then BlobUtil for content:// on Android
  try {
    const path = normalizeFilePath(uri);
    if (path) {
      return await RNFS.readFile(path, 'ascii');
    }
  } catch (_) {}
  try {
    return await RNBlobUtil.fs.readFile(uri, 'ascii');
  } catch (_) {
    return null;
  }
};

const getFileSizeBytes = async (uri) => {
  // Prefer RNFS.stat for file paths
  try {
    const path = normalizeFilePath(uri);
    if (path) {
      const stat = await RNFS.stat(path);
      if (stat && stat.size != null) {return Number(stat.size);}
    }
  } catch (_) {}
  // Fallback: read as base64 and compute length (works with content:// on Android)
  try {
    const b64 = await RNBlobUtil.fs.readFile(uri, 'base64');
    return base64SizeInBytes(b64);
  } catch (_) {
    return null;
  }
};

// 使用导入的离线存储服务

/**
 * 获取所有笔记
 * @param {object} params - 查询参数
 * @returns {Promise} - 笔记列表
 */
const getAllNotes = async (params = {}) => {
  try {
    console.log('开始获取所有笔记...');

    const notes = await getNotesFromOfflineStorage();
    if (notes?.data && notes.data.length > 0) {
      return notes;
    }

    const { store } = require('../../store');
    const state = store.getState();
    const reduxNotes = state?.notes?.entities ? Object.values(state.notes.entities) : [];

    if (reduxNotes.length > 0) {
      return {
        success: true,
        data: reduxNotes,
        message: '从本地状态获取笔记成功',
      };
    }

    return {
      success: true,
      data: [],
      message: '首次使用或尚未创建笔记',
      isFirstUse: true,
    };
  } catch (error) {
    console.error('获取笔记列表失败:', error);
    throw error;
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
    const originalFileName = fileName; // 保存原始文件名（用于样式显示）
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
        }
      }

      if (!fileUri) {
        console.error('无法获取有效的文件URI，禁止创建临时URI');
        throw new Error('无法获取有效的文件URI');
      }
    }

    // 声明转换相关的变量（确保在整个函数作用域内可用）
    let isConvertedDocument = false;
    let originalFileTypeForWord = null;
    let originalFileNameForWord = null;
    let originalFileTypeForPPT = null;
    let originalFileNameForPPT = null;

    // ✅ 处理Word文档：上传到后端转换为PDF
    if (fileType === 'word' || fileType === 'doc' || fileType === 'docx') {
      console.log('📄 检测到Word文档，上传到后端转换为PDF...');

      try {
        const { API_URL } = require('../../config');
        const RNFS = require('react-native-fs');
        const { Platform } = require('react-native');

        console.log('🔄 上传Word文档到后端转换服务...');
        console.log('📁 原始文件URI:', fileUri);

        // 确保Android平台使用正确的文件URI格式
        let uploadUri = fileUri;
        if (Platform.OS === 'android') {
          // Android平台需要使用file://协议
          if (!uploadUri.startsWith('file://') && !uploadUri.startsWith('content://')) {
            uploadUri = `file://${uploadUri}`;
          }
        }
        console.log('📤 上传URI:', uploadUri);

        // 创建FormData上传到后端
        const uploadFormData = new FormData();
        uploadFormData.append('file', {
          uri: uploadUri,
          type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          name: fileName,
        });

        // 调用后端转换API
        const apiEndpoint = `${API_URL}/api/v1/document-converter/convert/`;
        console.log('📡 Word API端点:', apiEndpoint);
        console.log('📦 上传文件信息:', {
          name: fileName,
          uri: uploadUri,
          type: 'docx',
        });

        // 注意：不要手动设置Content-Type，让fetch自动处理multipart boundary
        const response = await fetch(apiEndpoint, {
          method: 'POST',
          body: uploadFormData,
          // 移除Content-Type header，让fetch自动设置boundary
        });

        console.log('📬 Word响应状态:', response.status, response.statusText);

        if (!response.ok) {
          let errorText = '';
          try {
            errorText = await response.text();
          } catch (e) {
            errorText = '无法读取错误信息';
          }
          console.error('❌ 后端返回错误:', errorText);
          throw new Error(`后端转换失败 (${response.status}): ${errorText}`);
        }

        const conversionResult = await response.json();

        if (!conversionResult.success) {
          throw new Error(conversionResult.error || 'Word转PDF失败');
        }

        console.log('✅ Word文档转换成功，页数:', conversionResult.file_info?.pages);

        // 保存转换后的PDF到本地
        const pdfFileName = fileName.replace(/\.(doc|docx)$/i, '.pdf');
        const pdfPath = `${RNFS.DocumentDirectoryPath}/${pdfFileName}`;

        // 将base64保存为文件
        await RNFS.writeFile(pdfPath, conversionResult.pdf_base64, 'base64');

        console.log('💾 PDF已保存到:', pdfPath);

        // 保存原始文件类型（用于样式显示）
        originalFileTypeForWord = fileType; // 保存'word'
        originalFileNameForWord = originalFileName; // 使用最开始保存的原始文件名

        // 更新fileUri为PDF路径（用于PDF查看器）
        fileUri = pdfPath;
        fileType = 'pdf'; // 内部使用PDF查看器
        fileName = pdfFileName;

        // 标记这是一个转换后的文档，保留原始类型信息
        isConvertedDocument = true;

        console.log('🔄 文件信息已更新为PDF:', {
          fileUri,
          fileType,
          fileName,
          originalType: originalFileTypeForWord,
          originalName: originalFileNameForWord,
        });

      } catch (conversionError) {
        console.error('❌ Word转PDF失败:', conversionError);
        console.error('❌ 错误堆栈:', conversionError.stack);

        // 检查是否是网络连接问题
        if (conversionError.message.includes('Network request failed') ||
            conversionError.message.includes('Failed to fetch')) {

          // 提供更详细的诊断信息
          console.error('🔍 网络诊断:');
          console.error('  - API_URL:', API_URL);
          console.error('  - 文件URI:', fileUri);
          console.error('  - 文件名:', fileName);
          console.error('  - 文件大小:', fileObj?.size || '未知');

          throw new Error(
            '无法连接到后端服务，请检查：\n\n' +
            `1. 后端是否运行在: ${API_URL}\n` +
            '2. 手机/平板是否与电脑在同一网络\n' +
            '3. 防火墙是否阻止了连接\n' +
            '4. 文件是否可以正常访问'
          );
        }

        throw new Error(`Word文档转换失败: ${conversionError.message}`);
      }
    }

    // ✅ 处理PPT文档：上传到后端转换为PDF
    if (fileType === 'ppt' || fileType === 'pptx') {
      console.log('📊 检测到PPT文档，上传到后端转换为PDF...');

      try {
        const { API_URL } = require('../../config');
        const RNFS = require('react-native-fs');
        const { Platform } = require('react-native');

        console.log('🔄 上传PPT文档到后端转换服务...');
        console.log('📁 原始文件URI:', fileUri);

        // 确保Android平台使用正确的文件URI格式
        let uploadUri = fileUri;
        if (Platform.OS === 'android') {
          // Android平台需要使用file://协议
          if (!uploadUri.startsWith('file://') && !uploadUri.startsWith('content://')) {
            uploadUri = `file://${uploadUri}`;
          }
        }
        console.log('📤 上传URI:', uploadUri);

        // 创建FormData上传到后端
        const uploadFormData = new FormData();
        uploadFormData.append('file', {
          uri: uploadUri,
          type: fileType === 'pptx'
            ? 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
            : 'application/vnd.ms-powerpoint',
          name: fileName,
        });

        // 调用后端转换API
        const apiEndpoint = `${API_URL}/api/v1/document-converter/convert/`;
        console.log('📡 PPT API端点:', apiEndpoint);
        console.log('📦 上传文件信息:', {
          name: fileName,
          uri: uploadUri,
          type: fileType,
        });

        // 注意：不要手动设置Content-Type，让fetch自动处理multipart boundary
        const response = await fetch(apiEndpoint, {
          method: 'POST',
          body: uploadFormData,
          // 移除Content-Type header，让fetch自动设置boundary
        });

        console.log('📬 PPT响应状态:', response.status, response.statusText);

        if (!response.ok) {
          let errorText = '';
          try {
            errorText = await response.text();
          } catch (e) {
            errorText = '无法读取错误信息';
          }
          console.error('❌ 后端返回错误:', errorText);
          throw new Error(`后端转换失败 (${response.status}): ${errorText}`);
        }

        const conversionResult = await response.json();

        if (!conversionResult.success) {
          throw new Error(conversionResult.error || 'PPT转PDF失败');
        }

        console.log('✅ PPT文档转换成功，页数:', conversionResult.file_info?.pages);

        // 保存转换后的PDF到本地
        const pdfFileName = fileName.replace(/\.(ppt|pptx)$/i, '.pdf');
        const pdfPath = `${RNFS.DocumentDirectoryPath}/${pdfFileName}`;

        // 将base64保存为文件
        await RNFS.writeFile(pdfPath, conversionResult.pdf_base64, 'base64');

        console.log('💾 PDF已保存到:', pdfPath);

        // 保存原始文件类型（用于样式显示）
        originalFileTypeForPPT = fileType; // 保存'ppt'或'pptx'
        originalFileNameForPPT = originalFileName; // 使用最开始保存的原始文件名

        // 更新fileUri为PDF路径（用于PDF查看器）
        fileUri = pdfPath;
        fileType = 'pdf'; // 内部使用PDF查看器
        fileName = pdfFileName;

        // 标记这是一个转换后的文档，保留原始类型信息
        isConvertedDocument = true;

        console.log('🔄 文件信息已更新为PDF:', {
          fileUri,
          fileType,
          fileName,
          originalType: originalFileTypeForPPT,
          originalName: originalFileNameForPPT,
        });

      } catch (conversionError) {
        console.error('❌ PPT转PDF失败:', conversionError);
        console.error('❌ 错误堆栈:', conversionError.stack);

        // 检查是否是网络连接问题
        if (conversionError.message.includes('Network request failed') ||
            conversionError.message.includes('Failed to fetch')) {

          // 提供更详细的诊断信息
          console.error('🔍 网络诊断:');
          console.error('  - API_URL:', API_URL);
          console.error('  - 文件URI:', fileUri);
          console.error('  - 文件名:', fileName);
          console.error('  - 文件大小:', fileObj?.size || '未知');

          throw new Error(
            '无法连接到后端服务，请检查：\n\n' +
            `1. 后端是否运行在: ${API_URL}\n` +
            '2. 手机/平板是否与电脑在同一网络\n' +
            '3. 防火墙是否阻止了连接\n' +
            '4. 文件是否可以正常访问'
          );
        }

        throw new Error(`PPT文档转换失败: ${conversionError.message}`);
      }
    }

    // ✅ 立即在数据库中创建或查找 Note 记录，获取永久 ID
    console.log('📌 [notesApi] 开始创建/查找永久 Note 记录，文件URI:', fileUri);

    let noteId;
    try {
      const realmService = require('../database/realmService').default;
      const realm = await realmService.getRealm();

      // 使用文件路径作为唯一标识查找已存在的 Note（包括已删除的）
      const existingNote = realm.objects('Note').filtered('pdfPath == $0 OR file_uri == $0 OR file_path == $0', fileUri)[0];

      if (existingNote) {
        // 找到已存在的 Note，使用其 ID
        noteId = existingNote._id;
        console.log('✅ [notesApi] 找到已存在的 Note:', noteId);

        // 如果笔记被标记为删除，恢复它
        if (existingNote.is_deleted) {
          console.log('🔄 [notesApi] 检测到笔记已被删除，正在恢复...');
          realm.write(() => {
            existingNote.is_deleted = false;
            existingNote.deleted_at = null;
            existingNote.updated_at = new Date();
          });
          console.log('✅ [notesApi] 笔记已恢复');
        }
      } else {
        // 创建新的 Note 记录
        noteId = realmService.createObjectId();

        realm.write(() => {
          realm.create('Note', {
            _id: noteId,
            title: formData.title || fileName || '未命名文件',
            type: fileType,
            file_type: fileType,
            file_uri: fileUri,
            file_path: fileUri,
            file_name: fileName,
            pdfPath: fileType === 'pdf' ? fileUri : null,
            created_at: new Date(),
            updated_at: new Date(),
          }, 'modified');
        });

        console.log('✅ [notesApi] 创建新的永久 Note 记录:', noteId, '文件:', fileName);
      }
    } catch (error) {
      console.error('❌ [notesApi] 创建/查找 Note 失败，禁止生成临时ID:', error);
      throw error;
    }

    // 创建metadata对象（填充文件大小与PDF页数）
    let fileSizeBytes = null;
    let pageCount = null;
    try {
      fileSizeBytes = await getFileSizeBytes(fileUri);
      if (fileType === 'pdf') {
        const pdfText = await readPdfText(fileUri);
        pageCount = estimatePdfPageCount(pdfText);
      }
    } catch (metaErr) {
      console.warn('计算文件 metadata 失败:', metaErr);
    }

    const metadataObj = {
      pdfPath: fileType === 'pdf' ? fileUri : null,
      imagePath: fileType === 'image' ? fileUri : null,
      fileSize: fileSizeBytes,
      pageCount: pageCount,
      lastOpenedPage: 1,
      lastOpenedTime: new Date().toISOString(),
    };

    // 将metadata转换为字符串
    const metadataString = JSON.stringify(metadataObj);

    // 检查是否是转换后的文档（Word或PPT转PDF）
    const isConvertedFromWord = isConvertedDocument && originalFileTypeForWord !== null;
    const isConvertedFromPPT = isConvertedDocument && originalFileTypeForPPT !== null;

    // 确定显示类型：如果是转换的文档，使用原始类型；否则使用实际类型
    const displayType = isConvertedFromWord ? 'word' :
                       isConvertedFromPPT ? 'ppt' :
                       fileType;

    // 确定显示用的文件名（带原始后缀）
    const displayFileName = isConvertedFromWord ? originalFileNameForWord :
                           isConvertedFromPPT ? originalFileNameForPPT :
                           fileName;

    const note = {
      // 统一ID字段
      id: noteId, // 使用id作为主要ID字段
      _id: noteId, // 同时设置_id字段，确保兼容性

      title: title,
      content: `导入的${displayType}文件: ${displayFileName}`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      is_synced: false,
      is_deleted: false, // 确保笔记未被删除

      // 统一文件类型标识 - 保留原始类型用于显示
      type: displayType, // 显示类型（word/ppt/pdf）
      file_type: displayType, // 同时设置file_type字段

      // 内部使用的实际文件类型（用于查看器选择）
      viewer_type: fileType, // 实际查看器类型（pdf）
      original_type: isConvertedFromWord ? originalFileTypeForWord :
                     isConvertedFromPPT ? originalFileTypeForPPT :
                     fileType, // 原始文件类型

      // 文件信息 - 使用原始文件名用于样式显示
      file_name: displayFileName, // 显示用文件名（带原始后缀.docx/.pptx）
      pdf_file_name: fileName, // PDF文件名（.pdf后缀）
      original_file_name: displayFileName, // 原始文件名
      file_uri: fileUri,
      uri: fileUri, // 添加uri字段作为备用
      path: fileUri, // 添加path字段作为备用
      file_path: fileUri, // 添加file_path字段作为备用
      url: fileUri, // 添加url字段作为备用

      imported: true,
      is_offline: true, // 标记为离线笔记
      is_converted: isConvertedFromWord || isConvertedFromPPT, // 标记是否是转换的文档

      // 添加预览图片 - 根据显示类型设置，保持原始文档的样式
      preview_image: displayType === 'pdf' ? 'https://img-blog.csdnimg.cn/20200627111426602.png' : null,

      // 添加metadata，确保是字符串类型
      metadata: metadataString,

      // 确保tags是字符串数组
      tags: [],
    };

    // 记录导入信息
    console.log('导入的笔记对象:', JSON.stringify({
      id: note.id,
      _id: note._id,
      type: note.type,
      file_type: note.file_type,
      file_uri: note.file_uri,
    }, null, 2));

    // 保存到离线存储
    console.log('尝试保存笔记到离线存储');
    const realm = await realmService.getRealm();
    let savedNote;
    realm.write(() => {
      // 使用'modified'模式：如果Note已存在则更新，不存在则创建
      savedNote = realm.create('Note', note, 'modified');
    });
    console.log('✅ 笔记保存成功:', {
      id: savedNote._id,
      title: savedNote.title,
      is_deleted: savedNote.is_deleted,
    });

    // 不再保存到MongoDB数据库
    console.log('根据用户要求，不保存到MongoDB数据库，只保存到本地数据库');

    // 使用本地存储导入文件，不尝试在线导入
    console.log('使用本地存储导入文件，不尝试在线导入');

    // 返回本地导入的结果，包含完整的笔记对象
    console.log('准备返回导入结果');

    // 将Realm对象转换为普通对象
    const noteToReturn = {
      _id: savedNote._id,
      id: savedNote._id,
      title: savedNote.title,
      content: savedNote.content,
      type: savedNote.type, // 显示类型（word/ppt）
      file_type: savedNote.file_type, // 显示类型（word/ppt）
      viewer_type: savedNote.viewer_type || savedNote.type, // 查看器类型（pdf）
      original_type: savedNote.original_type || savedNote.type, // 原始类型
      file_name: savedNote.file_name,
      original_file_name: savedNote.original_file_name || savedNote.file_name, // 原始文件名
      file_uri: savedNote.file_uri,
      uri: savedNote.file_uri,
      path: savedNote.file_uri,
      file_path: savedNote.file_uri,
      url: savedNote.file_uri,
      pdfPath: savedNote.pdfPath,
      created_at: savedNote.created_at,
      updated_at: savedNote.updated_at,
      is_deleted: savedNote.is_deleted,
      is_synced: savedNote.is_synced,
      imported: savedNote.imported,
      is_converted: savedNote.is_converted || false, // 是否是转换的文档
      preview_image: savedNote.preview_image,
      metadata: savedNote.metadata,
      tags: savedNote.tags || [],
    };

    return {
      success: true,
      data: {
        ...noteToReturn,
        message: `导入${fileType}成功`,
        note_id: savedNote._id,
        isOffline: true,
      },
      isOffline: true,
    };
  } catch (error) {
    console.error('导入PDF过程中出错:', error);
    if (networkErrorService.isNetworkError(error)) {
      networkErrorService.handleApiError(error, {
        context: '导入PDF笔记',
        customMessage: '网络连接失败，无法导入PDF笔记',
      });
    }
    throw error;
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
      throw new Error('无效的笔记ID');
    }

    // 从离线存储获取笔记
    const realm = await realmService.getRealm();
    const note = realm.objectForPrimaryKey('Note', id);

    if (!note) {
      console.warn(`未找到ID为${id}的笔记`);
      throw new Error('未找到笔记');
    }

    console.log('成功获取到笔记详情:', note);

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

    console.log('统一后的笔记数据:', {
      id: unifiedNote.id,
      _id: unifiedNote._id,
      type: unifiedNote.type,
      file_type: unifiedNote.file_type,
    });

    return {
      success: true,
      data: unifiedNote,
    };
  } catch (error) {
    console.error(`获取笔记详情失败 (ID: ${id}):`, error);
    if (networkErrorService.isNetworkError(error)) {
      networkErrorService.handleApiError(error, {
        context: '获取笔记详情',
        customMessage: '网络连接失败，无法获取笔记详情',
      });
    }
    throw error;
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
        throw new Error('无效的笔记ID');
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
              data: noteById,
            };
          }

          // 如果没有找到，尝试在所有实体中查找匹配的_id
          const allNotes = Object.values(state.notes.entities);
          const noteByAltId = allNotes.find(note =>
            (note._id && note._id === id) ||
            (note.id && note.id === id)
          );

          if (noteByAltId) {
            console.log('从Redux状态获取到笔记 (通过替代ID匹配)');
            return {
              success: true,
              data: noteByAltId,
            };
          }
        }
      } catch (reduxError) {
        console.warn('从Redux获取笔记失败:', reduxError);
      }

      // 2. 如果Redux状态中没有该笔记，尝试从离线存储获取
      console.log(`尝试从离线存储获取笔记 (ID: ${id})`);
      try {
        const realm = await realmService.getRealm();
        const note = realm.objectForPrimaryKey('Note', id);

        if (note) {
          console.log(`从离线存储获取到笔记 (ID: ${id})`);

          // 确保ID字段一致
          const unifiedNote = {
            ...note,
            id: note.id || note._id || id,
            _id: note._id || note.id || id,
          };

          return {
            success: true,
            data: unifiedNote,
          };
        }
      } catch (storageError) {
        console.warn('从离线存储获取笔记失败:', storageError);
      }

      // 3. 尝试获取最近的笔记，看是否有匹配的
      try {
        console.log('尝试从最近笔记中查找');
        const realm = await realmService.getRealm();
        const recentNotes = realm.objects('Note')
          .filtered('is_deleted = false')
          .sorted('updated_at', true)
          .slice(0, 20);

        if (recentNotes && recentNotes.length > 0) {
          // 查找匹配的笔记
          const matchingNote = recentNotes.find(n =>
            (n._id && (n._id === id || n._id.toString().includes(id))) ||
            (n.id && (n.id === id || n.id.toString().includes(id)))
          );

          if (matchingNote) {
            console.log('从最近笔记中找到匹配的笔记:', matchingNote._id || matchingNote.id);
            return {
              success: true,
              data: matchingNote,
            };
          }
        }
      } catch (recentError) {
        console.warn('从最近笔记中查找失败:', recentError);
      }

      // 4. 所有来源均未命中，显式失败
      console.log(`未找到笔记 (ID: ${id})`);
      throw new Error('未找到笔记');
    } catch (error) {
      console.error(`获取笔记失败 (ID: ${id}):`, error);
      throw error;
    }
  },
  createNote: async (noteData) => {
    try {
      // 保存到离线存储
      const realm = await realmService.getRealm();
      let persistedNote;
      realm.write(() => {
        const payload = { ...noteData };
        if (!payload._id && !payload.id) {
          const createdId = realmService.createObjectId();
          payload._id = createdId;
          payload.id = createdId;
        } else {
          payload._id = payload._id || payload.id;
          payload.id = payload.id || payload._id;
        }
        // 使用'modified'模式：如果Note已存在则更新，不存在则创建
        persistedNote = realm.create('Note', payload, 'modified');
      });
      return { success: true, data: { ...persistedNote, id: persistedNote.id || persistedNote._id, _id: persistedNote._id || persistedNote.id } };
    } catch (error) {
      throw error;
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
      const realm = await realmService.getRealm();
      let result;
      realm.write(() => {
        // 使用'modified'模式：如果Note已存在则更新，不存在则创建
        result = realm.create('Note', { ...safeNoteData, _id: id }, 'modified');
      });
      return { success: true, data: { ...safeNoteData, id } };
    } catch (error) {
      throw error;
    }
  },
  deleteNote: async (id) => {
    try {
      // 从离线存储删除
      const realm = await realmService.getRealm();
      realm.write(() => {
        const note = realm.objectForPrimaryKey('Note', id);
        if (!note) {
          throw new Error('Note not found');
        }
        note.is_deleted = true;
        note.deleted_at = new Date();
      });
      return { success: true };
    } catch (error) {
      throw error;
    }
  },
  recognizeHandwriting: async () => {
    throw new Error('recognizeHandwriting 尚未实现，禁止返回占位成功结果');
  },
  uploadImage: async () => {
    throw new Error('uploadImage 尚未实现，禁止返回占位成功结果');
  },
  autoSaveNote: async () => {
    throw new Error('autoSaveNote 尚未实现，禁止返回占位成功结果');
  },
  getNoteHistory: async () => {
    throw new Error('getNoteHistory 尚未实现，禁止返回占位成功结果');
  },
  getNoteVersion: async () => {
    throw new Error('getNoteVersion 尚未实现，禁止返回占位成功结果');
  },
  restoreNoteVersion: async () => {
    throw new Error('restoreNoteVersion 尚未实现，禁止返回占位成功结果');
  },
  saveOfflineNote: async () => {
    throw new Error('saveOfflineNote 尚未实现，禁止返回占位成功结果');
  },
  getNoteCategories: async () => {
    throw new Error('getNoteCategories 尚未实现，禁止返回占位成功结果');
  },
};

export default notesApi;
