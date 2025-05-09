/**
 * 零屿笔记应用配置常量
 */

// API基础URL
export const API_BASE_URL = __DEV__
  ? 'http://localhost:8000/api' // 开发环境
  : 'https://api.zeroislenotes.com/api'; // 生产环境

// 应用版本
export const APP_VERSION = '0.0.1';

// 本地存储键
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  USER_INFO: 'user_info',
  SETTINGS: 'app_settings',
  NOTES_CACHE: 'notes_cache',
  OFFLINE_NOTES: 'offline_notes',
  OFFLINE_OPERATIONS: 'offline_operations',
  LAST_SYNC_TIME: 'last_sync_time',
  CANVAS_CACHE: 'canvas_cache',
  KNOWLEDGE_GRAPH_CACHE: 'knowledge_graph_cache',
  COMMUNITY_CACHE: 'community_cache',
  BACKUP_INFO: 'backup_info',
  CATEGORIES: 'categories',
  FILE_PREVIEWS: 'file_previews',
  SEARCH_HISTORY: 'search_history',
};

// 默认设置
export const DEFAULT_SETTINGS = {
  theme: 'light', // light, dark, system
  fontSize: 'medium', // small, medium, large
  handwritingRecognitionMode: 'realtime', // realtime, manual
  autoSave: true,
  offlineMode: false,
  notificationEnabled: true,
};

// 超时设置
export const TIMEOUTS = {
  API_REQUEST: 30000, // 30秒
  DEBOUNCE: 300, // 300毫秒
  AUTO_SAVE: 5000, // 5秒
};

// 分页设置
export const PAGINATION = {
  NOTES_PER_PAGE: 20,
  COMMUNITY_POSTS_PER_PAGE: 15,
};

// 文件上传限制
export const UPLOAD_LIMITS = {
  IMAGE_MAX_SIZE: 5 * 1024 * 1024, // 5MB
  DOCUMENT_MAX_SIZE: 10 * 1024 * 1024, // 10MB
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  ALLOWED_DOCUMENT_TYPES: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
};

// 特性开关
export const FEATURES = {
  KNOWLEDGE_GRAPH: true,
  VOICE_RECOGNITION: true,
  HANDWRITING_RECOGNITION: true,
  COMMUNITY: true,
  OFFLINE_MODE: true,
};

// 通知渠道
export const NOTIFICATION_CHANNELS = {
  REMINDER: 'reminder_channel',
  SYNC: 'sync_channel',
  COMMUNITY: 'community_channel',
  UPDATE: 'update_channel',
};

// 缓存键
export const CACHE_KEYS = [
  'cache_images',
  'cache_notes_preview',
  'cache_search_history',
  'cache_recent_notes',
  'temp_draft_notes',
  'temp_image_uploads',
  'temp_search_results',
];