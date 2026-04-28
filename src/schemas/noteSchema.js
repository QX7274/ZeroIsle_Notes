/**
 * 笔记模式定义 - 统一完整版本
 * 确保所有笔记类型都能永久存储内容
 */


/**
 * 笔记模式 - 支持所有笔记类型的完整字段定义
 */
const NoteSchema = {
  name: 'Note',
  primaryKey: '_id',
  properties: {
    // 基础字段
    _id: { type: 'string' },
    title: { type: 'string', default: '' },
    content: { type: 'string', default: '' },
    type: { type: 'string', default: 'text' }, // text, canvas, pdf, word, image, audio, video, paged
    tags: { type: 'list', objectType: 'string', default: [] },
    category_id: { type: 'string', optional: true },
    color: { type: 'string', optional: true },
    is_favorite: { type: 'bool', default: false },
    is_archived: { type: 'bool', default: false },
    is_deleted: { type: 'bool', default: false },
    is_synced: { type: 'bool', default: false },
    created_at: { type: 'date', default: () => new Date() },
    updated_at: { type: 'date', default: () => new Date() },
    deleted_at: { type: 'date', optional: true },
    user_id: { type: 'string', optional: true },
    parent_id: { type: 'string', optional: true },
    metadata: { type: 'dictionary', default: {} },
    _partition: { type: 'string', default: 'notes' },

    // 文件相关字段（通用）
    file_path: { type: 'string', optional: true },
    file_uri: { type: 'string', optional: true },
    file_name: { type: 'string', optional: true },
    file_size: { type: 'int', optional: true },
    file_type: { type: 'string', optional: true },
    file_hash: { type: 'string', optional: true }, // 文件完整性校验
    thumbnail_path: { type: 'string', optional: true },

    // 画布/笔迹相关字段（无限画布）
    strokeData: { type: 'string', optional: true }, // 存储笔迹数据（JSON字符串）
    viewport: { type: 'string', optional: true }, // 存储视窗状态（JSON字符串）
    canvasStyle: { type: 'string', optional: true }, // 画布样式
    paths: { type: 'string', optional: true }, // 绘图路径（JSON字符串）
    images: { type: 'string', optional: true }, // 画布图片（JSON字符串）
    canvasVersion: { type: 'int', default: 1 }, // 画布版本号，用于冲突解决

    // 分页笔记相关字段
    currentPage: { type: 'int', optional: true }, // 当前页码
    totalPages: { type: 'int', optional: true }, // 总页数
    pageStyle: { type: 'string', optional: true }, // 页面样式（横线/网格/点阵/Cornell）
    pages: { type: 'string', optional: true }, // 页面数据（JSON字符串）
    scale: { type: 'float', optional: true },

    // PDF相关字段
    pdfPath: { type: 'string', optional: true }, // PDF文件路径
    pdfCurrentPage: { type: 'int', optional: true }, // PDF当前页码
    pdfTotalPages: { type: 'int', optional: true }, // PDF总页数
    pdfScale: { type: 'float', optional: true }, // PDF缩放比例
    pdfAnnotations: { type: 'string', optional: true }, // PDF注释数据（JSON字符串）
    pdfScrollPosition: { type: 'float', optional: true }, // PDF滚动位置
    pdfBookmarks: { type: 'string', optional: true }, // PDF书签（JSON字符串）

    // 音频/视频相关字段
    audioPath: { type: 'string', optional: true }, // 音频文件路径
    videoPath: { type: 'string', optional: true }, // 视频文件路径
    duration: { type: 'float', optional: true }, // 时长（秒）
    audioTranscription: { type: 'string', optional: true }, // 音频转文字结果
    videoThumbnails: { type: 'string', optional: true }, // 视频缩略图（JSON字符串）

    // 图片相关字段
    imagePath: { type: 'string', optional: true }, // 图片文件路径
    imageWidth: { type: 'int', optional: true }, // 图片宽度
    imageHeight: { type: 'int', optional: true }, // 图片高度
    imageFormat: { type: 'string', optional: true }, // 图片格式

    // Word文档相关字段
    wordPath: { type: 'string', optional: true }, // Word文档路径
    wordContent: { type: 'string', optional: true }, // Word文档内容
    wordMetadata: { type: 'string', optional: true }, // Word文档元数据（JSON字符串）

    // 卡片笔记相关字段
    cardStyle: { type: 'string', optional: true }, // 卡片样式：default, xiaohongshu, douyin, zhihu
    cardData: { type: 'string', optional: true }, // 卡片数据（JSON字符串）

    // 数据完整性保护字段
    dataHash: { type: 'string', optional: true }, // 数据完整性校验哈希
    backupCount: { type: 'int', default: 0 }, // 备份次数
    lastBackupAt: { type: 'date', optional: true }, // 最后备份时间
    syncStatus: { type: 'string', default: 'pending' }, // pending, syncing, synced, failed
    syncError: { type: 'string', optional: true }, // 同步错误信息
    retryCount: { type: 'int', default: 0 }, // 重试次数
    lastRetryAt: { type: 'date', optional: true }, // 最后重试时间
  },
};

export default NoteSchema;
