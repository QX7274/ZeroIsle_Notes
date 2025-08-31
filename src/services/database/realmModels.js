/**
 * Realm 模型定义
 * 定义应用中使用的所有 Realm 模型
 */

import Realm from 'realm';
import OfflineQueueSchema from '../../schemas/offlineQueueSchema';

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
    is_deleted: { type: 'bool', default: false },
    is_synced: { type: 'bool', default: false },
    deleted_at: 'date?',
    user_id: 'string?',
    category_id: 'string?',
    tags: 'string[]',
    attachments: 'Attachment[]',
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
    // 分页笔记相关字段
    noteStyle: 'string?',
    currentPage: { type: 'int', default: 1 },
    totalPages: { type: 'int', default: 1 },
    pages: 'string?' // JSON字符串存储页面数据
  }
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
    user_id: 'string?'
  }
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
    is_deleted: { type: 'bool', default: false },
    is_synced: { type: 'bool', default: false },
    note_id: 'string?',
    user_id: 'string?',
    metadata: 'string?', // JSON 字符串
  }
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
    order: 'int?'
  }
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
    user_id: 'string?'
  }
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
    is_enabled: { type: 'bool', default: true }
  }
};

/**
 * AI 聊天模型
 */
export const AIChatSchema = {
  name: 'ai_conversations',
  primaryKey: '_id',
  properties: {
    _id: 'string',
    title: 'string',
    created_at: 'date',
    updated_at: 'date',
    is_deleted: { type: 'bool', default: false },
    is_synced: { type: 'bool', default: false },
    user_id: 'string?',
    messages: 'AIChatMessage[]'
  }
};

/**
 * AI 聊天消息模型
 */
export const AIChatMessageSchema = {
  name: 'AIChatMessage',
  primaryKey: '_id',
  properties: {
    _id: 'string',
    role: 'string', // user, assistant, system
    content: 'string',
    created_at: 'date',
    is_synced: { type: 'bool', default: false },
    chat_id: 'string'
  }
};

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
    nodes: 'KnowledgeNode[]',
    edges: 'KnowledgeEdge[]'
  }
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
    graph_id: 'string'
  }
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
    graph_id: 'string'
  }
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
    synced_at: 'date?',
    priority: { type: 'int', default: 0 },
    user_id: 'string?',
    device_id: 'string?'
  }
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
    created_at: 'date',
    updated_at: 'date'
  }
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
    created_at: 'date',
    updated_at: 'date'
  }
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
    user_id: 'string?'
  }
};

/**
 * 获取所有模型
 * @returns {Array} 所有模型定义
 */
export function getAllSchemas() {
  return [
    NoteSchema,
    CanvasCollectionSchema,
    AttachmentSchema,
    CategorySchema,
    TagSchema,
    ReminderSchema,
    AIChatSchema,
    AIChatMessageSchema,
    KnowledgeGraphSchema,
    KnowledgeNodeSchema,
    KnowledgeEdgeSchema,
    SyncInfoSchema,
    StorageItemSchema,
    SettingsSchema,
    AIToolHistorySchema,
    OfflineQueueSchema,
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

