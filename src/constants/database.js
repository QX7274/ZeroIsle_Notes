/**
 * 数据库常量定义
 */

// 数据库表名
export const TABLES = {
  // 用户相关表
  USERS: 'users',
  USER_SETTINGS: 'user_settings',
  USER_PREFERENCES: 'user_preferences',

  // 笔记相关表
  NOTES: 'notes',
  NOTE_CONTENTS: 'note_contents',
  NOTE_VERSIONS: 'note_versions',
  NOTE_ATTACHMENTS: 'note_attachments',

  // 分类和标签
  CATEGORIES: 'categories',
  TAGS: 'tags',
  NOTE_TAGS: 'note_tags',

  // 知识图谱相关表
  KNOWLEDGE_NODES: 'knowledge_nodes',
  KNOWLEDGE_EDGES: 'knowledge_edges',

  // 思维导图相关表
  MIND_MAPS: 'mind_maps',
  MIND_MAP_NODES: 'mind_map_nodes',

  // 无限画布相关表
  INFINITE_CANVAS: 'infinite_canvas',
  INFINITE_CANVAS_ELEMENTS: 'infinite_canvas_elements',
  INFINITE_CANVAS_LAYERS: 'infinite_canvas_layers',

  // 同步相关表
  SYNC_INFO: 'sync_info',
  SYNC_QUEUE: 'sync_queue',

  // 社区相关表
  COMMUNITIES: 'communities',
  COMMUNITY_POSTS: 'community_posts',
  COMMUNITY_COMMENTS: 'community_comments',

  // 提醒相关表
  REMINDERS: 'reminders',
};

// 数据库字段类型
export const FIELD_TYPES = {
  TEXT: 'TEXT',
  INTEGER: 'INTEGER',
  REAL: 'REAL',
  BLOB: 'BLOB',
  NULL: 'NULL',
};

// 数据库索引
export const INDEXES = {
  NOTES_USER_ID: 'idx_notes_user_id',
  NOTES_CATEGORY_ID: 'idx_notes_category_id',
  NOTE_TAGS_NOTE_ID: 'idx_note_tags_note_id',
  NOTE_TAGS_TAG_ID: 'idx_note_tags_tag_id',
};

// 数据库版本
export const DATABASE_VERSION = 1;

// 数据库名称
export const DATABASE_NAME = 'zeroislenotes.db';

// 数据库同步状态
export const SYNC_STATUS = {
  PENDING: 0,
  SYNCED: 1,
  CONFLICT: 2,
  ERROR: 3,
};

// 数据库操作类型
export const OPERATION_TYPES = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
};
