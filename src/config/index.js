/**
 * 零屿笔记应用配置文件
 * 统一管理应用的配置项
 */

import { Platform } from 'react-native';

// API配置 - 开发环境优先指向本机后端
// 统一走 localhost，并通过 adb reverse tcp:8001 tcp:8001 打通 Android 真机/模拟器到宿主机后端
const DEV_API_HOST = '127.0.0.1';
const DEV_API_PORT = '8001';

export const API_URL = __DEV__
  ? `http://${DEV_API_HOST}:${DEV_API_PORT}`
  : 'https://api.zeroislenotes.com';

// 调试信息
console.log('当前API_URL:', API_URL);
console.log('开发模式:', __DEV__);
console.log('平台:', Platform.OS);
console.log('如无法连接，请检查后端服务是否运行于:', API_URL);

export const API_VERSION = 'v1';
export const API_TIMEOUT = 15000;

// 主题配置
export const THEME = {
  LIGHT: 'light',
  DARK: 'dark',
  SYSTEM: 'system',
};
export const THEME_KEY = 'app_theme';
export const DEFAULT_THEME = 'light';

// 语言配置（仅支持中文）
export const LANGUAGES = {
  ZH: 'zh',
};
export const DEFAULT_LANGUAGE = 'zh';

// 应用信息
export const APP_NAME = 'ZeroIsle Notes';
export const APP_VERSION = '1.0.0';

// 认证配置
export const AUTH_TOKEN_KEY = 'auth_token';
export const REFRESH_TOKEN_KEY = 'refresh_token';
export const TOKEN_EXPIRY_KEY = 'token_expiry';

// 令牌配置 - 统一管理令牌有效期
export const TOKEN_CONFIG = {
  // 访问令牌有效期（分钟）
  ACCESS_TOKEN_LIFETIME: 60,
  // 刷新令牌有效期（天）
  REFRESH_TOKEN_LIFETIME: 7,
  // 提前刷新时间（分钟）- 令牌过期前多少分钟开始刷新
  REFRESH_THRESHOLD_MINUTES: 5,
};

// 开发者模式配置 - 仅用于开发调试，不影响生产环境
export const DEV_MODE_CONFIG = {
  // 是否启用开发者模式
  ENABLED: __DEV__ && true,
  // 开发者账户信息
  DEV_ACCOUNT: {
    id: 'dev-account-001',
    username: 'developer',
    email: 'dev@zeroislenotes.com',
    nickname: '开发者',
    avatar: null,
    isAnonymous: false,
    isDeveloper: true,
    createdAt: new Date().toISOString(),
    permissions: ['read', 'write', 'admin'], // 开发者权限
  },
  // 开发者模式特性
  FEATURES: {
    // 是否跳过登录界面
    SKIP_LOGIN_SCREEN: false,
    // 是否自动填充测试数据
    AUTO_FILL_TEST_DATA: false,
    // 是否显示调试信息
    SHOW_DEBUG_INFO: true,
    // 是否启用性能监控
    ENAABLE_PERFORMANCE_MONITOR: true,
  },
  // 开发者模式安全设置
  SECURITY: {
    // 是否允许在生产环境启用
    ALLOW_IN_PRODUCTION: false,
    // 是否记录开发者操作日志
    LOG_DEV_ACTIONS: true,
    // 开发者模式过期时间（小时）
    EXPIRE_AFTER_HOURS: 24,
  },
};

// 存储键
export const STORAGE_KEYS = {
  // 认证相关
  AUTH_TOKEN: 'auth_token',
  REFRESH_TOKEN: 'refresh_token',
  TOKEN_EXPIRY: 'token_expiry',
  USER_INFO: 'user_info',
  USER: 'user',

  // 开发者模式相关
  DEV_MODE_STATE: 'dev_mode_state',
  DEV_ACTION_LOGS: 'dev_action_logs',

  // 其他存储键...
  THEME: 'theme',
  LANGUAGE: 'language',
  SETTINGS: 'settings',
  CACHE: 'cache',
  LOGS: 'logs',
};

// 通知渠道
export const NOTIFICATION_CHANNELS = {
  REMINDER: 'reminder_channel',
  NOTE: 'note_channel',
  SHARE: 'share_channel',
  SYNC: 'sync_channel',
  COMMUNITY: 'community_channel',
  UPDATE: 'update_channel',
};

// 错误消息
export const ERROR_MESSAGES = {
  NETWORK_ERROR: '网络连接错误，请检查网络设置',
  SERVER_ERROR: '服务器错误，请稍后重试',
  UNAUTHORIZED: '未授权，请重新登录',
  FORBIDDEN: '禁止访问',
  NOT_FOUND: '未找到资源',
  VALIDATION_ERROR: '输入数据验证失败',
};

// 错误码
export const ERROR_CODES = {
  // 认证相关
  AUTH_REQUIRED: 401,
  INVALID_TOKEN: 401,
  TOKEN_EXPIRED: 401,
  INVALID_CREDENTIALS: 401,
  USER_NOT_FOUND: 404,
  USER_ALREADY_EXISTS: 400,
  INVALID_VERIFICATION_CODE: 400,
  VERIFICATION_CODE_EXPIRED: 400,

  // 业务相关
  INVALID_PARAMS: 400,
  RESOURCE_NOT_FOUND: 404,
  PERMISSION_DENIED: 403,
  SERVER_ERROR: 500,
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

// 文件上传限制 - 移除大小限制，支持大文件处理
export const UPLOAD_LIMITS = {
  IMAGE_MAX_SIZE: 1000 * 1024 * 1024, // 1000MB - 大幅提升图片限制
  DOCUMENT_MAX_SIZE: 5000 * 1024 * 1024, // 5000MB - 大幅提升文档限制
  ALLOWED_IMAGE_TYPES: ['image/jpeg', 'image/png', 'image/gif', 'image/webp'],
  ALLOWED_DOCUMENT_TYPES: ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation'],
};

// 特性开关
export const FEATURES = {
  KNOWLEDGE_GRAPH: true,
  VOICE_RECOGNITION: true,
  HANDWRITING_RECOGNITION: true,
  COMMUNITY: true,
  OFFLINE_MODE: true,
};

// 分析事件类型
export const ANALYTICS_EVENTS = {
  NOTE_CREATED: 'note_created',
  NOTE_UPDATED: 'note_updated',
  NOTE_DELETED: 'note_deleted',
  NOTE_SHARED: 'note_shared',
  SEARCH_PERFORMED: 'search_performed',
  AI_TOOL_USED: 'ai_tool_used',
  HANDWRITING_RECOGNIZED: 'handwriting_recognized',
  VOICE_RECOGNIZED: 'voice_recognized',
  KNOWLEDGE_GRAPH_VIEWED: 'knowledge_graph_viewed',
  COMMUNITY_POST_CREATED: 'community_post_created',
  REMINDER_CREATED: 'reminder_created',
  REMINDER_COMPLETED: 'reminder_completed',
  USER_LOGGED_IN: 'user_logged_in',
  USER_REGISTERED: 'user_registered',
  ERROR_OCCURRED: 'error_occurred',
};

// 导出默认配置
export default {
  API_URL,
  API_VERSION,
  API_TIMEOUT,
  THEME,
  THEME_KEY,
  DEFAULT_THEME,
  LANGUAGES,
  DEFAULT_LANGUAGE,
  APP_NAME,
  APP_VERSION,
  AUTH_TOKEN_KEY,
  REFRESH_TOKEN_KEY,
  TOKEN_EXPIRY_KEY,
  TOKEN_CONFIG,
  DEV_MODE_CONFIG,
  STORAGE_KEYS,
  NOTIFICATION_CHANNELS,
  ERROR_MESSAGES,
  ERROR_CODES,
  AI_CONFIG,
  FILE_TYPES,
  NOTE_TYPES,
  REMINDER_TYPES,
  TIMEOUTS,
  PAGINATION,
  UPLOAD_LIMITS,
  FEATURES,
  ANALYTICS_EVENTS,
};
