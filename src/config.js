/**
 * 应用配置文件
 */

// API配置
export const API_URL = 'http://localhost:8000/api';
export const API_TIMEOUT = 10000;

// 认证配置
export const AUTH_TOKEN_KEY = 'auth_token';
export const REFRESH_TOKEN_KEY = 'refresh_token';
export const TOKEN_EXPIRY_KEY = 'token_expiry';

// 应用配置
export const APP_NAME = 'ZeroIsle Notes';
export const APP_VERSION = '1.0.0';

// 主题配置
export const THEME_KEY = 'app_theme';
export const DEFAULT_THEME = 'light';

// 语言配置
export const LANGUAGE_KEY = 'app_language';
export const DEFAULT_LANGUAGE = 'zh_CN';

// 存储键
export const STORAGE_KEYS = {
  USER_PROFILE: 'user_profile',
  SETTINGS: 'app_settings',
  RECENT_NOTES: 'recent_notes',
  OFFLINE_NOTES: 'offline_notes',
  REMINDERS: 'reminders',
  LAST_SYNC: 'last_sync_time',
};

// AI助手配置
export const AI_CONFIG = {
  DEFAULT_MODEL: 'gpt-3.5-turbo',
  MAX_HISTORY: 10,
  MAX_TOKENS: 2000,
};

// 文件类型
export const FILE_TYPES = {
  NOTE: 'note',
  PDF: 'pdf',
  IMAGE: 'image',
  AUDIO: 'audio',
  VIDEO: 'video',
  DOCUMENT: 'document',
};

// 笔记类型
export const NOTE_TYPES = {
  TEXT: 'text',
  RICH_TEXT: 'rich_text',
  MARKDOWN: 'markdown',
  CANVAS: 'canvas',
  CHECKLIST: 'checklist',
};

// 提醒类型
export const REMINDER_TYPES = {
  ONCE: 'once',
  DAILY: 'daily',
  WEEKLY: 'weekly',
  MONTHLY: 'monthly',
  YEARLY: 'yearly',
};

// 错误代码
export const ERROR_CODES = {
  NETWORK_ERROR: 'NETWORK_ERROR',
  AUTH_ERROR: 'AUTH_ERROR',
  SERVER_ERROR: 'SERVER_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNKNOWN_ERROR: 'UNKNOWN_ERROR',
};

// 分析事件
export const ANALYTICS_EVENTS = {
  APP_OPEN: 'app_open',
  USER_LOGIN: 'user_login',
  USER_REGISTER: 'user_register',
  NOTE_CREATE: 'note_create',
  NOTE_UPDATE: 'note_update',
  NOTE_DELETE: 'note_delete',
  NOTE_SHARE: 'note_share',
  REMINDER_CREATE: 'reminder_create',
  REMINDER_COMPLETE: 'reminder_complete',
  AI_ASSISTANT_USE: 'ai_assistant_use',
  SEARCH_PERFORM: 'search_perform',
};

// 导出默认配置
export default {
  API_URL,
  API_TIMEOUT,
  AUTH_TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  TOKEN_EXPIRY_KEY,
  APP_NAME,
  APP_VERSION,
  THEME_KEY,
  DEFAULT_THEME,
  LANGUAGE_KEY,
  DEFAULT_LANGUAGE,
  STORAGE_KEYS,
  AI_CONFIG,
  FILE_TYPES,
  NOTE_TYPES,
  REMINDER_TYPES,
  ERROR_CODES,
  ANALYTICS_EVENTS,
};
