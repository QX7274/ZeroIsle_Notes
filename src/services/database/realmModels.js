/**
 * Realm 模型定义
 * 定义应用中使用的所有 Realm 模型
 */

import OfflineQueueSchema from '../../schemas/offlineQueueSchema.js';
import SearchIndex from '../../models/SearchIndex.js';

/**
 * 笔记模型
 */
export const NoteSchema = {
  name: 'Note',
  primaryKey: '_id',
  properties: {
    _id: 'string',
    id: 'string?', // 添加id属性作为备用标识符
    title: 'string',
    content: 'string?',
    created_at: 'date',
    updated_at: 'date',
    updatedAt: 'date?',
    deviceId: 'string?',
    clientOpId: 'string?',
    is_deleted: { type: 'bool', default: false },
    is_synced: { type: 'bool', default: false },
    syncStatus: 'string?', // 添加同步状态字段
    deleted_at: 'date?',
    user_id: 'string?',
    category_id: 'string?',
    tags: { type: 'list', objectType: 'string' },
    attachments: { type: 'list', objectType: 'Attachment' },
    color: 'string?',
    is_pinned: { type: 'bool', default: false },
    is_archived: { type: 'bool', default: false },
    is_locked: { type: 'bool', default: false },
    password: 'string?',
    metadata: 'string?', // JSON 字符串
    // 新增文件相关字段
    type: 'string?',
    noteType: 'string?',
    file_type: 'string?',
    file_name: 'string?',
    file_uri: 'string?',
    uri: 'string?',
    path: 'string?',
    file_path: 'string?',
    url: 'string?',
    // 画布相关字段
    canvasStyle: 'string?',
    scale: { type: 'double', default: 1.0 },
    translateX: { type: 'double', default: 0.0 },
    translateY: { type: 'double', default: 0.0 },
    paths: 'string?', // JSON字符串存储绘制路径
    images: 'string?', // JSON字符串存储图片信息
    strokeData: 'string?', // 存储笔迹数据（JSON字符串）- 无限画布
    viewport: 'string?', // 存储视窗状态（JSON字符串）- 无限画布
    // 分页笔记相关字段
    noteStyle: 'string?',
    pageStyle: 'string?', // 页面样式（横线/网格/点阵/Cornell）
    currentPage: { type: 'int', default: 1 },
    totalPages: { type: 'int', default: 1 },
    pages: 'string?', // JSON字符串存储页面数据
    // PDF相关字段
    pdfPath: 'string?', // PDF文件路径
    pdfCurrentPage: 'int?', // PDF当前页码
    pdfTotalPages: 'int?', // PDF总页数
    pdfScale: 'double?', // PDF缩放比例
    pdfAnnotations: 'string?', // PDF注释数据（JSON字符串）
    pdfScrollPosition: 'double?', // PDF滚动位置
    pdfBookmarks: 'string?', // PDF书签（JSON字符串）
  },
};

/**
 * 画布集合（与后端集合名对齐）
 * 注意：数组字段采用字符串(JSON)存储，以避免复杂嵌套导致的循环引用/迁移问题
 */
export const CanvasCollectionSchema = {
  name: 'canvases',
  primaryKey: '_id',
  properties: {
    _id: 'string',
    id: 'string',
    title: 'string',
    description: 'string?',
    elements: { type: 'string', default: '[]' },   // JSON字符串
    layers: { type: 'string', default: '[]' },     // JSON字符串
    activeLayer: { type: 'string', default: 'default' },
    viewState: { type: 'string', default: '{}' },  // JSON字符串
    is_deleted: { type: 'bool', default: false },
    is_synced: { type: 'bool', default: false },
    created_at: 'date',
    updated_at: 'date',
    deleted_at: 'date?',
    user_id: 'string?',
  },
};

/**
 * 附件模型
 */
export const AttachmentSchema = {
  name: 'Attachment',
  primaryKey: '_id',
  properties: {
    _id: 'string',
    name: 'string',
    type: 'string',
    url: 'string?',
    local_path: 'string?',
    size: 'int?',
    created_at: 'date',
    updated_at: 'date',
    updatedAt: 'date?',
    deviceId: 'string?',
    clientOpId: 'string?',
    is_deleted: { type: 'bool', default: false },
    is_synced: { type: 'bool', default: false },
    note_id: 'string?',
    user_id: 'string?',
    metadata: 'string?', // JSON 字符串
  },
};

/**
 * 分类模型
 */
export const CategorySchema = {
  name: 'Category',
  primaryKey: '_id',
  properties: {
    _id: 'string',
    name: 'string',
    color: 'string?',
    icon: 'string?',
    created_at: 'date',
    updated_at: 'date',
    is_deleted: { type: 'bool', default: false },
    is_synced: { type: 'bool', default: false },
    user_id: 'string?',
    parent_id: 'string?',
    order: 'int?',
  },
};

/**
 * 标签模型
 */
export const TagSchema = {
  name: 'Tag',
  primaryKey: '_id',
  properties: {
    _id: 'string',
    name: 'string',
    color: 'string?',
    count: { type: 'int', default: 0 },
    created_at: 'date',
    updated_at: 'date',
    is_deleted: { type: 'bool', default: false },
    is_synced: { type: 'bool', default: false },
    user_id: 'string?',
  },
};

/**
 * 提醒模型
 */
export const ReminderSchema = {
  name: 'Reminder',
  primaryKey: '_id',
  properties: {
    _id: 'string',
    title: 'string',
    description: 'string?',
    due_date: 'date',
    created_at: 'date',
    updated_at: 'date',
    is_completed: { type: 'bool', default: false },
    completed_at: 'date?',
    is_deleted: { type: 'bool', default: false },
    is_synced: { type: 'bool', default: false },
    user_id: 'string?',
    note_id: 'string?',
    priority: 'string?', // low, medium, high
    frequency: 'string?', // once, daily, weekly, monthly, yearly
    repeat_end_date: 'date?',
    notification_id: 'string?',
    color: 'string?',
    is_enabled: { type: 'bool', default: true },
  },
};

/**
 * 思维导图模型
 */
export const MindMapSchema = {
  name: 'MindMap',
  primaryKey: '_id',
  properties: {
    _id: 'string',
    title: 'string',
    description: { type: 'string', default: '' },
    layout_type: { type: 'string', default: 'tree' },
    theme: { type: 'string', default: 'default' },
    root_node_id: 'string?',
    node_count: { type: 'int', default: 0 },
    edge_count: { type: 'int', default: 0 },
    metadata: { type: 'string', default: '{}' },
    created_at: 'date',
    updated_at: 'date',
    deleted_at: 'date?',
    user_id: 'string?',
    is_deleted: { type: 'bool', default: false },
    is_synced: { type: 'bool', default: false },
  },
};

/**
 * 思维导图节点模型
 */
export const MindMapNodeSchema = {
  name: 'MindMapNode',
  primaryKey: '_id',
  properties: {
    _id: 'string',
    mind_map_id: { type: 'string', indexed: true },
    title: { type: 'string', default: '' },
    content: { type: 'string', default: '' },
    type: { type: 'string', default: 'topic' },
    parent_id: 'string?',
    x: { type: 'double', default: 0 },
    y: { type: 'double', default: 0 },
    order: { type: 'int', default: 0 },
    metadata: { type: 'string', default: '{}' },
    created_at: 'date',
    updated_at: 'date',
    deleted_at: 'date?',
    user_id: 'string?',
    is_deleted: { type: 'bool', default: false },
    is_synced: { type: 'bool', default: false },
  },
};

/**
 * 思维导图边模型
 */
export const MindMapEdgeSchema = {
  name: 'MindMapEdge',
  primaryKey: '_id',
  properties: {
    _id: 'string',
    mind_map_id: { type: 'string', indexed: true },
    source: 'string',
    target: 'string',
    type: { type: 'string', default: 'default' },
    style: { type: 'string', default: 'solid' },
    label: 'string?',
    metadata: { type: 'string', default: '{}' },
    created_at: 'date',
    updated_at: 'date',
    deleted_at: 'date?',
    user_id: 'string?',
    is_deleted: { type: 'bool', default: false },
    is_synced: { type: 'bool', default: false },
  },
};

/**
 * AI 聊天模型
 */
export const AIChatSchema = {
  name: 'AIChat',
  primaryKey: '_id',
  properties: {
    _id: 'string',
    title: 'string',
    created_at: 'date',
    updated_at: 'date',
    is_deleted: { type: 'bool', default: false },
    is_synced: { type: 'bool', default: false },
    user_id: 'string?',
    messages: { type: 'string', default: '[]' }, // 存储为JSON字符串
  },
};

/**
 * AI 聊天消息模型
 * 注意：此schema已不再使用，messages现在存储为JSON字符串
 * 保留此定义仅供参考
 */
// export const AIChatMessageSchema = {
//   name: 'AIChatMessage',
//   primaryKey: '_id',
//   properties: {
//     _id: 'string',
//     role: 'string', // user, assistant, system
//     content: 'string',
//     created_at: 'date',
//     is_synced: { type: 'bool', default: false },
//     chat_id: 'string'
//   }
// };

/**
 * 知识图谱模型
 */
export const KnowledgeGraphSchema = {
  name: 'KnowledgeGraph',
  primaryKey: '_id',
  properties: {
    _id: 'string',
    title: 'string',
    description: 'string?',
    created_at: 'date',
    updated_at: 'date',
    is_deleted: { type: 'bool', default: false },
    is_synced: { type: 'bool', default: false },
    user_id: 'string?',
    nodes: { type: 'list', objectType: 'KnowledgeNode' },
    edges: { type: 'list', objectType: 'KnowledgeEdge' },
  },
};

/**
 * 知识节点模型
 */
export const KnowledgeNodeSchema = {
  name: 'KnowledgeNode',
  primaryKey: '_id',
  properties: {
    _id: 'string',
    title: 'string',
    content: 'string?',
    type: 'string?', // concept, fact, question, etc.
    position_x: 'float?',
    position_y: 'float?',
    color: 'string?',
    created_at: 'date',
    updated_at: 'date',
    is_deleted: { type: 'bool', default: false },
    is_synced: { type: 'bool', default: false },
    graph_id: 'string',
  },
};

/**
 * 知识边模型
 */
export const KnowledgeEdgeSchema = {
  name: 'KnowledgeEdge',
  primaryKey: '_id',
  properties: {
    _id: 'string',
    source_id: 'string',
    target_id: 'string',
    label: 'string?',
    type: 'string?', // is-a, has-a, related-to, etc.
    created_at: 'date',
    updated_at: 'date',
    is_deleted: { type: 'bool', default: false },
    is_synced: { type: 'bool', default: false },
    graph_id: 'string',
  },
};

/**
 * 同步信息模型
 */
export const SyncInfoSchema = {
  name: 'SyncInfo',
  primaryKey: '_id',
  properties: {
    _id: 'string',
    entity_id: 'string',
    entity_type: 'string',
    operation: 'string', // create, update, delete
    data: 'string?', // JSON 字符串
    status: 'string', // pending, synced, failed
    error: 'string?',
    created_at: 'date',
    updated_at: 'date',
    updatedAt: 'date?',
    deviceId: 'string?',
    clientOpId: 'string?',
    synced_at: 'date?',
    priority: { type: 'int', default: 0 },
    user_id: 'string?',
    device_id: 'string?',
  },
};

/**
 * 存储项模型
 */
export const StorageItemSchema = {
  name: 'StorageItem',
  primaryKey: 'key',
  properties: {
    key: 'string',
    value: 'string', // JSON 字符串
    created_at: { type: 'date', default: () => new Date() },
    updated_at: { type: 'date', default: () => new Date() },
  },
};

/**
 * 设置模型
 */
export const SettingsSchema = {
  name: 'settings',
  primaryKey: 'key',
  properties: {
    key: 'string',
    value: 'string', // JSON 字符串
    created_at: { type: 'date', default: () => new Date() },
    updated_at: { type: 'date', default: () => new Date() },
  },
};

/**
 * AI工具历史记录模型
 */
export const AIToolHistorySchema = {
  name: 'AIToolHistory',
  primaryKey: '_id',
  properties: {
    _id: 'string',
    tool: 'string', // 工具ID
    input: 'string', // 输入文本
    output: 'string', // 输出结果
    timestamp: 'date', // 使用时间
    created_at: 'date',
    updated_at: 'date',
    is_deleted: { type: 'bool', default: false },
    is_synced: { type: 'bool', default: false },
    user_id: 'string?',
  },
};

/**
 * 文件模型
 */
export const FileSchema = {
  name: 'File',
  primaryKey: '_id',
  properties: {
    _id: 'string',
    name: 'string',
    path: 'string',
    size: 'int?',
    type: 'string?',
    created_at: 'date',
    updated_at: 'date',
    updatedAt: 'date?',
    deviceId: 'string?',
    clientOpId: 'string?',
    is_deleted: { type: 'bool', default: false },
    user_id: 'string?',
    metadata: 'string?', // JSON 字符串
  },
};

/**
 * 笔记备份模型
 */
export const NoteBackupSchema = {
  name: 'NoteBackup',
  primaryKey: '_id',
  properties: {
    _id: 'string',
    note_id: 'string',
    backup_data: 'string', // JSON 字符串存储备份数据
    backup_type: 'string', // 'auto', 'manual', 'export'
    created_at: 'date',
    lastBackupAt: 'date?', // 添加最后备份时间字段
    size: 'int?',
    user_id: 'string?',
    metadata: 'string?', // JSON 字符串
  },
};
/**
 * 上传会话模型
 */
export const UploadSessionSchema = {
  name: 'UploadSession',
  primaryKey: '_id',
  properties: {
    _id: 'string',
    sessionId: 'string',
    fileId: 'string?',
    localPath: 'string',
    fileSize: 'int',
    chunkSize: { type: 'int', default: 1024 * 1024 }, // 1MB chunks by default
    uploadedBytes: { type: 'int', default: 0 },
    status: { type: 'string', default: 'pending' }, // pending, uploading, paused, completed, failed
    error: 'string?',
    retryCount: { type: 'int', default: 0 },
    updatedAt: 'date',
    deviceId: 'string?',
    clientOpId: 'string?',
  },
};
/**
 * 附件缓存索引（LRU）
 */
export const FileCacheIndexSchema = {
  name: 'FileCacheIndex',
  primaryKey: '_id',
  properties: {
    _id: 'string',
    fileId: { type: 'string', indexed: true },
    path: 'string',
    size: { type: 'int', default: 0 },
    mimeType: 'string?',
    lastAccessedAt: 'date',
  },
};

/**
 * 获取所有模型
 * @returns {Array} 所有模型定义
 */
/**
 * 知识库代码段/片段模型
 */
export const KBSnippetSchema = {
  name: 'KBSnippet',
  primaryKey: '_id',
  properties: {
    _id: 'string',
    kbId: { type: 'string', indexed: true },
    text: 'string',
    source: 'string', // JSON string for source object { type, title, anchor, uri }
    createdAt: { type: 'date', default: () => new Date() },
  },
};

export function getAllSchemas() {
  return [
    NoteSchema,
    CanvasCollectionSchema,
    AttachmentSchema,
    CategorySchema,
    TagSchema,
    ReminderSchema,
    MindMapSchema,
    MindMapNodeSchema,
    MindMapEdgeSchema,
    AIChatSchema,
    // AIChatMessageSchema 已不再使用，messages现在存储为JSON字符串
    KnowledgeGraphSchema,
    KnowledgeNodeSchema,
    KnowledgeEdgeSchema,
    SyncInfoSchema,
    StorageItemSchema,
    SettingsSchema,
    AIToolHistorySchema,
    OfflineQueueSchema,
    FileSchema,
    NoteBackupSchema,
    UploadSessionSchema,
    FileCacheIndexSchema,
    KBSnippetSchema,
    SearchIndex.schema,
  ];
}

/**
 * 注册所有模型到 Realm 服务
 * @param {Object} realmService Realm 服务实例
 */
export function registerAllSchemas(realmService) {
  try {
    const schemas = getAllSchemas();
    schemas.forEach(schema => {
      realmService.registerSchema(schema);
    });
    console.info(`已注册 ${schemas.length} 个 Realm 模型`);
  } catch (error) {
    console.error('注册 Realm 模型失败', error);
    throw error;
  }
}

export default {
  getAllSchemas,
  registerAllSchemas,
};
