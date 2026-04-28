/**
 * 类型自动识别工具
 *
 * 用途：根据参数、URI、扩展名、元信息自动识别文件类型
 * 支持：pdf、paged_note、canvas
 */

// 已移除 offlineStorageService 导入，现在直接使用 realmService
import realmService from '../services/database/realmService';

/**
 * 文件类型枚举
 */
export const FileType = {
  PDF: 'pdf',
  PAGED_NOTE: 'paged_note',
  CANVAS: 'canvas',
  UNKNOWN: 'unknown',
};

/**
 * 从 URI scheme 判断类型
 */
function detectFromScheme(uri) {
  if (!uri || typeof uri !== 'string') {return null;}

  if (uri.startsWith('pdf://')) {return FileType.PDF;}
  if (uri.startsWith('paged_note://')) {return FileType.PAGED_NOTE;}
  if (uri.startsWith('canvas://')) {return FileType.CANVAS;}

  return null;
}

/**
 * 从文件扩展名判断类型
 */
function detectFromExtension(uri) {
  if (!uri || typeof uri !== 'string') {return null;}

  const lowerUri = uri.toLowerCase();

  // PDF 及可转换为 PDF 的格式
  if (lowerUri.endsWith('.pdf')) {return FileType.PDF;}
  if (lowerUri.endsWith('.ppt') || lowerUri.endsWith('.pptx')) {return FileType.PDF;}
  if (lowerUri.endsWith('.doc') || lowerUri.endsWith('.docx')) {return FileType.PDF;}

  return null;
}

/**
 * 从笔记元信息判断类型
 */
async function detectFromMetadata(noteId) {
  if (!noteId) {return null;}

  try {
    const realm = await realmService.getRealm();
    const note = realm.objectForPrimaryKey('Note', noteId);
    if (!note) {return null;}

    // 优先检查 noteType
    if (note.noteType === 'paged_note' || note.type === 'paged_note') {
      return FileType.PAGED_NOTE;
    }
    if (note.noteType === 'canvas' || note.type === 'canvas') {
      return FileType.CANVAS;
    }
    if (note.noteType === 'pdf' || note.type === 'pdf' || note.file_type === 'pdf') {
      return FileType.PDF;
    }

    // 检查 file_type
    if (note.file_type === 'ppt' || note.file_type === 'word') {
      return FileType.PDF; // PPT/Word 需转换为 PDF
    }

    return null;
  } catch (error) {
    console.warn('[TypeDetection] 从元信息检测失败:', error);
    return null;
  }
}

/**
 * 主检测函数：自动识别文件类型
 *
 * @param {Object} params - 路由参数
 * @returns {Promise<string>} - 文件类型 (pdf / paged_note / canvas / unknown)
 */
export async function detectFileType(params = {}) {
  const { uri, noteId, noteType, fileType, type } = params;

  // 1. 优先从显式 noteType/fileType 判断
  if (noteType === 'paged_note' || type === 'paged_note') {return FileType.PAGED_NOTE;}
  if (noteType === 'canvas' || type === 'canvas') {return FileType.CANVAS;}
  if (noteType === 'pdf' || fileType === 'pdf' || type === 'pdf') {return FileType.PDF;}
  if (fileType === 'ppt' || fileType === 'word') {return FileType.PDF;}

  // 2. 从 URI scheme 判断
  const schemeType = detectFromScheme(uri);
  if (schemeType) {return schemeType;}

  // 3. 从扩展名判断
  const extType = detectFromExtension(uri);
  if (extType) {return extType;}

  // 4. 从笔记元信息判断
  if (noteId) {
    const metaType = await detectFromMetadata(noteId);
    if (metaType) {return metaType;}
  }

  // 5. 默认回退
  console.warn('[TypeDetection] 无法识别类型，使用 UNKNOWN:', params);
  return FileType.UNKNOWN;
}

/**
 * 获取类型对应的事件映射
 */
export function getEventMapping(fileType) {
  const mappings = {
    [FileType.PDF]: {
      onPageChange: true,
      onLinkPress: true,
      onAnnotationAdd: true,
      onExport: true,
      onShare: true,
      onSearch: true,
    },
    [FileType.PAGED_NOTE]: {
      onStrokeCommitted: true,
      onPageAdd: true,
      onStyleChange: true,
      onExportSnapshot: true,
    },
    [FileType.CANVAS]: {
      onStrokeCommitted: true,
      onViewportChange: true,
      onExportSnapshot: true,
      onImport: true,
    },
  };

  return mappings[fileType] || {};
}



