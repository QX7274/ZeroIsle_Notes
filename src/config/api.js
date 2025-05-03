/**
 * API配置文件
 * 定义API基础URL和各个模块的端点
 */

// 根据环境选择API基础URL
export const API_BASE_URL = __DEV__
  ? 'http://192.168.152.232:8000/api/v1'  // 使用热点网络中的IP地址
  : 'http://localhost:8000/api/v1'; // 生产环境地址

// 调试信息
console.log('API_BASE_URL:', API_BASE_URL);

// API版本
export const API_VERSION = 'v1';

// 请求超时时间（毫秒）
export const REQUEST_TIMEOUT = 15000;

// API端点
export const API_ENDPOINTS = {
  // 认证相关
  AUTH: {
    LOGIN: '/auth/login/',
    REGISTER: '/auth/register/',
    REGISTER_USERNAME: '/auth/register/username/',
    REGISTER_EMAIL: '/auth/register/email/',
    REGISTER_PHONE: '/auth/register/phone/',
    LOGIN_CODE: '/auth/login/code/',
    LOGIN_WECHAT: '/auth/login/wechat/',
    LOGIN_QQ: '/auth/login/qq/',
    REFRESH_TOKEN: '/auth/token/refresh/',
    PROFILE: '/auth/profile/',
    CHANGE_PASSWORD: '/auth/password/change/',
    RESET_PASSWORD: '/auth/password/reset/',
    VERIFY_RESET_CODE: '/auth/password/verify-reset-code/',
    VERIFY_EMAIL: '/auth/email/verify/',
    SEND_VERIFICATION_CODE: '/auth/send-verification-code/',
    BIND_EMAIL: '/auth/bind/email/',
    BIND_PHONE: '/auth/bind/phone/',
    BIND_WECHAT: '/auth/bind/wechat/',
    BIND_QQ: '/auth/bind/qq/',
  },

  // 笔记相关
  NOTES: {
    BASE: '/notes/',
    DETAIL: (id) => `/notes/${id}/`,
    FAVORITE: (id) => `/notes/${id}/toggle_favorite/`,
    STATS: '/notes/stats/',
    TAGS: '/notes/tags/',
    CATEGORIES: '/notes/categories/',
    HISTORY: (id) => `/notes/${id}/history/`,
    EXPORT: '/notes/export/',
    IMPORT: '/notes/import/',
  },

  // 知识图谱相关
  KNOWLEDGE_GRAPH: {
    BASE: '/knowledge-graph/',
    NODES: '/knowledge-graph/nodes/',
    NODE_DETAIL: (id) => `/knowledge-graph/nodes/${id}/`,
    EDGES: '/knowledge-graph/edges/',
    EDGE_DETAIL: (id) => `/knowledge-graph/edges/${id}/`,
    FIND_PATH: '/knowledge-graph/graph/find-path/',
    ANALYZE: '/knowledge-graph/graph/analyze/',
    GENERATE_TAGS: '/knowledge-graph/graph/generate-tags/',
    RELATED_CONCEPTS: (id) => `/knowledge-graph/nodes/${id}/related-concepts/`,
    // 自动分类和知识图谱构建
    AUTO_CLASSIFY: '/knowledge-graph/auto/auto-classify/',
    SUGGEST_TAGS: '/knowledge-graph/auto/suggest-tags/',
    EXTRACT_KEYWORDS: '/knowledge-graph/auto/extract-keywords/',
    FIND_SIMILAR_NOTES: '/knowledge-graph/auto/find-similar-notes/',
    INTEGRATE_NOTES: '/knowledge-graph/auto/integrate-notes/',
    BUILD_GRAPH: '/knowledge-graph/auto/build-graph/',
    BUILD_USER_GRAPH: '/knowledge-graph/auto/build-user-graph/',
    ANALYZE_CONNECTIONS: '/knowledge-graph/auto/analyze-connections/',
    SUGGEST_RELATED_CONTENT: '/knowledge-graph/auto/suggest-related-content/',
  },

  // AI助手相关
  AI_ASSISTANT: {
    BASE: '/ai-assistant/',
    CHAT: '/ai-assistant/chat/',
    CHAT_STREAM: '/ai-assistant/chat/stream/',
    SUMMARIZE: '/ai-assistant/summarize/',
    GENERATE: '/ai-assistant/generate/',
    TRANSLATE: '/ai-assistant/translate/',
    ANALYZE_SENTIMENT: '/ai-assistant/analyze-sentiment/',
    TRANSCRIBE: '/ai-assistant/transcribe/',
    ANALYZE_IMAGE: '/ai-assistant/analyze-image/',
    MODELS: '/ai-assistant/models/',
    RESET_SESSION: '/ai-assistant/reset-session/',
    CONVERSATIONS: '/ai-assistant/conversations/',
    CONVERSATION_DETAIL: (id) => `/ai-assistant/conversations/${id}/`,
    PROMPT_TEMPLATES: '/ai-assistant/prompt-templates/',
    PROMPT_TEMPLATE_DETAIL: (id) => `/ai-assistant/prompt-templates/${id}/`,
    USAGE: '/ai-assistant/usage/',
  },

  // 代码执行相关
  CODE: {
    RUN: '/code/run/',
    DETECT: '/code/detect/',
    COMPLETE: '/code/complete/',
    FORMAT: '/code/format/',
    LINT: '/code/lint/',
    SNIPPETS: '/code/snippets/',
    SNIPPET_DETAIL: (id) => `/code/snippets/${id}/`,
  },

  // 语音识别相关
  VOICE: {
    TRANSCRIBE: '/voice-recognition/transcribe/',
    COMMAND: '/voice-recognition/command/',
    MEETING: '/voice-recognition/meeting/',
    LANGUAGES: '/voice-recognition/languages/',
    HISTORY: '/voice-recognition/history/',
    TRANSCRIPTION: '/voice-recognition/transcriptions/',
    SERVICE_STATUS: '/voice-recognition/service-status/',
    OFFLINE_MODELS: '/voice-recognition/offline-models/',
    DOWNLOAD_MODEL: '/voice-recognition/offline-models/download/',
    DELETE_MODEL: '/voice-recognition/offline-models/delete/',
    CHANGE_MODEL: '/voice-recognition/offline-models/change/',
    TOGGLE_MODE: '/voice-recognition/toggle-mode/',
    MEETING_SUMMARY: '/voice-recognition/meeting-summary/',
  },

  // 搜索相关
  SEARCH: {
    BASE: '/search/',
    ADVANCED: '/search/advanced/',
    SEMANTIC: '/search/semantic/',
    TAGS: '/search/tags/',
    TEXT: '/search/text/',
    VOICE: '/search/voice/',
    IMAGE: '/search/image/',
    HISTORY: '/search/history/',
    CLEAR_HISTORY: '/search/clear-history/',
    SUGGESTIONS: '/search/suggestions/',
    KNOWLEDGE_GRAPH: '/search/knowledge-graph/',
  },

  // 社区相关
  COMMUNITY: {
    POSTS: '/community/posts/',
    POST_DETAIL: (id) => `/community/posts/${id}/`,
    LIKE_POST: (id) => `/community/posts/${id}/like/`,
    COMMENTS: (id) => `/community/posts/${id}/comments/`,
    COMMENT_DETAIL: (id) => `/community/comments/${id}/`,
    LIKE_COMMENT: (id) => `/community/comments/${id}/like/`,
    FOLLOW: (id) => `/community/follows/toggle/`,
    FOLLOWERS: (id) => `/community/follows/followers/`,
    FOLLOWING: (id) => `/community/follows/following/`,
    CATEGORIES: '/community/categories/',
    TAGS: '/community/tags/',
    POPULAR_TAGS: '/community/tags/popular/',
    NOTIFICATIONS: '/community/notifications/',
    NOTIFICATION_DETAIL: (id) => `/community/notifications/${id}/`,
    MARK_NOTIFICATION_READ: (id) => `/community/notifications/${id}/mark_as_read/`,
    ACTIVITY: '/community/activity/',
  },

  // 通知相关
  NOTIFICATION: {
    BASE: '/notifications/',
    DETAIL: (id) => `/notifications/${id}/`,
    MARK_AS_READ: (id) => `/notifications/${id}/mark_as_read/`,
    MARK_ALL_AS_READ: '/notifications/mark_all_as_read/',
    UNREAD_COUNT: '/notifications/unread_count/',
    DELETE_ALL: '/notifications/delete_all/',
  },

  // 提醒相关
  REMINDER: {
    BASE: '/reminder/reminders/',
    DETAIL: (id) => `/reminder/reminders/${id}/`,
    COMPLETE: (id) => `/reminder/reminders/${id}/complete/`,
    REOPEN: (id) => `/reminder/reminders/${id}/reopen/`,
    ENABLE: (id) => `/reminder/reminders/${id}/enable/`,
    DISABLE: (id) => `/reminder/reminders/${id}/disable/`,
    UPCOMING: '/reminder/upcoming/',
    OVERDUE: '/reminder/overdue/',
    TODAY: '/reminder/today/',
    CATEGORIES: '/reminder/categories/',
    TAGS: '/reminder/tags/',
    STATISTICS: '/reminder/statistics/',
    CALENDAR: '/reminder/calendar/',
    DAY: '/reminder/day/',
    EXPORT: '/reminder/export/',
    IMPORT: '/reminder/import/',
    DAILY_SUMMARY: '/reminder/daily-summary/',
    CALENDAR_INTEGRATION: (id) => `/reminder/reminders/${id}/calendar-integration/`,
    SYNC_TO_CALENDAR: (id) => `/reminder/reminders/${id}/sync-to-calendar/`,
    REMOVE_FROM_CALENDAR: (id) => `/reminder/reminders/${id}/remove-from-calendar/`,
    IMPORT_FROM_CALENDAR: '/reminder/import-from-calendar/',
    EXPORT_TO_CALENDAR: '/reminder/export-to-calendar/',
    MONGO: {
      BASE: '/reminder/mongo/reminders/',
      DETAIL: (id) => `/reminder/mongo/reminders/${id}/`,
      COMPLETE: (id) => `/reminder/mongo/reminders/${id}/complete/`,
      REOPEN: (id) => `/reminder/mongo/reminders/${id}/reopen/`,
      ENABLE: (id) => `/reminder/mongo/reminders/${id}/enable/`,
      DISABLE: (id) => `/reminder/mongo/reminders/${id}/disable/`,
      CALENDAR: '/reminder/mongo/calendar/',
      DAY: '/reminder/mongo/day/',
      CALENDAR_INTEGRATION: (id) => `/reminder/mongo/reminders/${id}/calendar-integration/`,
    },
  },

  // 画布相关
  CANVAS: {
    BASE: '/canvas/canvases/',
    DETAIL: (id) => `/canvas/canvases/${id}/`,
    ELEMENTS: '/canvas/elements/',
    ELEMENT_DETAIL: (id) => `/canvas/elements/${id}/`,
    EXPORT: (id) => `/canvas/canvases/${id}/export/`,
    IMPORT: '/canvas/import/',
  },
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

// 错误消息
export const ERROR_MESSAGES = {
  [ERROR_CODES.AUTH_REQUIRED]: '请先登录',
  [ERROR_CODES.INVALID_TOKEN]: '无效的令牌',
  [ERROR_CODES.TOKEN_EXPIRED]: '令牌已过期',
  [ERROR_CODES.INVALID_CREDENTIALS]: '用户名或密码错误',
  [ERROR_CODES.USER_NOT_FOUND]: '用户不存在',
  [ERROR_CODES.USER_ALREADY_EXISTS]: '用户已存在',
  [ERROR_CODES.INVALID_VERIFICATION_CODE]: '验证码错误',
  [ERROR_CODES.VERIFICATION_CODE_EXPIRED]: '验证码已过期',
  [ERROR_CODES.INVALID_PARAMS]: '参数错误',
  [ERROR_CODES.RESOURCE_NOT_FOUND]: '资源不存在',
  [ERROR_CODES.PERMISSION_DENIED]: '权限不足',
  [ERROR_CODES.SERVER_ERROR]: '服务器错误',
};
