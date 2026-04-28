/**
 * 笔记类型识别服务
 * 专门处理各种笔记类型的自动识别和分类
 */

/**
 * 笔记类型常量
 */
export const NOTE_TYPES = {
  CARD: 'card',
  PAGED: 'paged_note',
  CANVAS: 'canvas',
  PDF: 'pdf',
  WORD: 'word',
  MARKDOWN: 'markdown',
};

/**
 * 笔记类型特征
 */
const NOTE_TYPE_FEATURES = {
  [NOTE_TYPES.PAGED]: {
    requiredFields: ['pages'],
    optionalFields: ['noteStyle', 'currentPage', 'totalPages', 'scale'],
    contentPatterns: ['pageNumber', '分页', 'paged'],
    metadataPatterns: ['pagination', 'drawing', 'scaling'],
  },
  [NOTE_TYPES.CANVAS]: {
    requiredFields: ['paths'],
    optionalFields: ['images', 'scale', 'translateX', 'translateY'],
    contentPatterns: ['canvas', 'drawing', 'infinite'],
    metadataPatterns: ['canvas', 'drawing', 'infinite'],
  },
  [NOTE_TYPES.CARD]: {
    requiredFields: [],
    optionalFields: ['content', 'title'],
    contentPatterns: [],
    metadataPatterns: [],
  },
};

/**
 * 笔记类型识别服务类
 */
class NoteTypeDetectionService {
  constructor() {
    this.detectionCache = new Map();
  }

  /**
   * 检测笔记类型
   * @param {Object} note 笔记对象
   * @returns {string} 检测到的笔记类型
   */
  detectNoteType(note) {
    if (!note || typeof note !== 'object') {
      console.warn('NoteTypeDetectionService: 无效的笔记对象');
      throw new Error('笔记类型识别失败：无效的笔记对象');
    }

    // 检查缓存
    const noteId = note._id || note.id;
    if (noteId && this.detectionCache.has(noteId)) {
      return this.detectionCache.get(noteId);
    }

    console.log('🔍 开始检测笔记类型:', {
      id: noteId,
      type: note.type,
      file_type: note.file_type,
      noteType: note.noteType,
    });

    // 1. 优先检查明确的类型字段
    const explicitType = this.checkExplicitType(note);
    if (explicitType) {
      this.cacheResult(noteId, explicitType);
      return explicitType;
    }

    // 2. 检查特殊字段
    const fieldType = this.checkSpecialFields(note);
    if (fieldType) {
      this.cacheResult(noteId, fieldType);
      return fieldType;
    }

    // 3. 检查内容特征
    const contentType = this.checkContentFeatures(note);
    if (contentType) {
      this.cacheResult(noteId, contentType);
      return contentType;
    }

    // 4. 检查元数据特征
    const metadataType = this.checkMetadataFeatures(note);
    if (metadataType) {
      this.cacheResult(noteId, metadataType);
      return metadataType;
    }

    // 5. 无法识别类型，禁止默认返回
    console.warn('NoteTypeDetectionService: 无法识别笔记类型');
    throw new Error('笔记类型识别失败：无法从内容/元数据中识别类型');
  }

  /**
   * 检查明确的类型字段
   */
  checkExplicitType(note) {
    const typeFields = ['type', 'file_type', 'noteType'];

    for (const field of typeFields) {
      if (note[field]) {
        const type = note[field];
        console.log(`🔍 发现明确类型字段 ${field}: ${type}`);

        // 标准化类型名称
        if (type === 'paged' || type === 'paged_note') {
          return NOTE_TYPES.PAGED;
        } else if (type === 'canvas' || type === 'infinite_canvas') {
          return NOTE_TYPES.CANVAS;
        } else if (type === 'card' || type === 'text') {
          return NOTE_TYPES.CARD;
        } else if (type === 'pdf') {
          return NOTE_TYPES.PDF;
        } else if (type === 'word' || type === 'doc' || type === 'docx') {
          return NOTE_TYPES.WORD;
        } else if (type === 'markdown' || type === 'md') {
          return NOTE_TYPES.MARKDOWN;
        }
      }
    }

    return null;
  }

  /**
   * 检查特殊字段
   */
  checkSpecialFields(note) {
    // 检查分页笔记特征
    if (note.pages && Array.isArray(note.pages) && note.pages.length > 0) {
      console.log('🔍 发现pages字段，识别为分页笔记');
      return NOTE_TYPES.PAGED;
    }

    // 检查画布笔记特征
    if (note.paths && (Array.isArray(note.paths) || typeof note.paths === 'string')) {
      console.log('🔍 发现paths字段，识别为画布笔记');
      return NOTE_TYPES.CANVAS;
    }

    // 检查PDF文件特征
    if (note.file_uri && (note.file_uri.includes('.pdf') || note.file_uri.includes('pdf://'))) {
      console.log('🔍 发现PDF文件URI，识别为PDF');
      return NOTE_TYPES.PDF;
    }

    return null;
  }

  /**
   * 检查内容特征
   */
  checkContentFeatures(note) {
    const content = note.content || '';
    const title = note.title || '';

    // 检查分页笔记内容特征
    const pagedFeatures = NOTE_TYPE_FEATURES[NOTE_TYPES.PAGED];
    for (const pattern of pagedFeatures.contentPatterns) {
      if (content.includes(pattern) || title.includes(pattern)) {
        console.log(`🔍 发现分页笔记内容特征: ${pattern}`);
        return NOTE_TYPES.PAGED;
      }
    }

    // 检查画布笔记内容特征
    const canvasFeatures = NOTE_TYPE_FEATURES[NOTE_TYPES.CANVAS];
    for (const pattern of canvasFeatures.contentPatterns) {
      if (content.includes(pattern) || title.includes(pattern)) {
        console.log(`🔍 发现画布笔记内容特征: ${pattern}`);
        return NOTE_TYPES.CANVAS;
      }
    }

    return null;
  }

  /**
   * 检查元数据特征
   */
  checkMetadataFeatures(note) {
    let metadata = note.metadata;

    // 解析元数据
    if (typeof metadata === 'string') {
      try {
        metadata = JSON.parse(metadata);
      } catch (e) {
        console.warn('NoteTypeDetectionService: 解析元数据失败', e);
        return null;
      }
    }

    if (!metadata || typeof metadata !== 'object') {
      return null;
    }

    // 检查分页笔记元数据特征
    const pagedFeatures = NOTE_TYPE_FEATURES[NOTE_TYPES.PAGED];
    for (const pattern of pagedFeatures.metadataPatterns) {
      if (JSON.stringify(metadata).includes(pattern)) {
        console.log(`🔍 发现分页笔记元数据特征: ${pattern}`);
        return NOTE_TYPES.PAGED;
      }
    }

    // 检查画布笔记元数据特征
    const canvasFeatures = NOTE_TYPE_FEATURES[NOTE_TYPES.CANVAS];
    for (const pattern of canvasFeatures.metadataPatterns) {
      if (JSON.stringify(metadata).includes(pattern)) {
        console.log(`🔍 发现画布笔记元数据特征: ${pattern}`);
        return NOTE_TYPES.CANVAS;
      }
    }

    return null;
  }

  /**
   * 缓存检测结果
   */
  cacheResult(noteId, type) {
    if (noteId) {
      this.detectionCache.set(noteId, type);
      console.log(`🔍 缓存检测结果: ${noteId} -> ${type}`);
    }
  }

  /**
   * 清除缓存
   */
  clearCache() {
    this.detectionCache.clear();
    console.log('🔍 清除检测缓存');
  }

  /**
   * 获取检测统计
   */
  getDetectionStats() {
    const stats = {};
    for (const [noteId, type] of this.detectionCache) {
      stats[type] = (stats[type] || 0) + 1;
    }
    return {
      totalCached: this.detectionCache.size,
      typeDistribution: stats,
    };
  }

  /**
   * 批量检测笔记类型
   */
  batchDetectNoteTypes(notes) {
    if (!Array.isArray(notes)) {
      console.warn('NoteTypeDetectionService: 批量检测需要数组参数');
      return [];
    }

    return notes.map(note => ({
      ...note,
      detectedType: this.detectNoteType(note),
    }));
  }

  /**
   * 验证笔记类型
   */
  validateNoteType(note, expectedType) {
    const detectedType = this.detectNoteType(note);
    const isValid = detectedType === expectedType;

    console.log(`🔍 类型验证: 期望=${expectedType}, 检测=${detectedType}, 有效=${isValid}`);

    return {
      isValid,
      detectedType,
      expectedType,
      note: note,
    };
  }

  /**
   * 修复笔记类型
   */
  fixNoteType(note) {
    const detectedType = this.detectNoteType(note);

    const fixedNote = {
      ...note,
      type: detectedType,
      file_type: detectedType,
      noteType: detectedType,
    };

    console.log(`🔍 修复笔记类型: ${note._id || note.id} -> ${detectedType}`);

    return fixedNote;
  }
}

// 创建单例实例
const noteTypeDetectionService = new NoteTypeDetectionService();

export default noteTypeDetectionService;

// 导出便捷方法
export const {
  detectNoteType,
  batchDetectNoteTypes,
  validateNoteType,
  fixNoteType,
  clearCache,
  getDetectionStats,
} = noteTypeDetectionService;

