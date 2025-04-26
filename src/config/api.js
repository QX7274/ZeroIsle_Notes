/**
 * API配置文件
 * 定义API基础URL和各个模块的端点
 */

// 根据环境选择API基础URL
export const API_BASE_URL = __DEV__
  ? 'http://10.0.2.2:8000/api/v1'  // Android模拟器访问本机地址
  : 'http://localhost:8000/api/v1'; // 生产环境地址

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
    REFRESH_TOKEN: '/auth/token/refresh/',
    PROFILE: '/auth/profile/',
    CHANGE_PASSWORD: '/auth/password/change/',
    RESET_PASSWORD: '/auth/password/reset/',
    VERIFY_EMAIL: '/auth/email/verify/',
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
  },

  // AI助手相关
  AI_ASSISTANT: {
    CHAT: '/ai-assistant/chat/',
    CHAT_STREAM: '/ai-assistant/chat/stream/',
    SUMMARIZE: '/ai-assistant/summarize/',
    GENERATE: '/ai-assistant/generate/',
    TRANSLATE: '/ai-assistant/translate/',
    ANALYZE_SENTIMENT: '/ai-assistant/analyze-sentiment/',
    TRANSCRIBE: '/ai-assistant/transcribe/',
    MODELS: '/ai-assistant/models/',
    RESET_SESSION: '/ai-assistant/reset-session/',
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
    NOTES: '/community/notes/',
    LIKE: (id) => `/community/notes/${id}/like/`,
    COMMENTS: (id) => `/community/notes/${id}/comments/`,
    COMMENT_DETAIL: (id) => `/community/comments/${id}/`,
    FOLLOW: (id) => `/community/users/${id}/follow/`,
    ACTIVITY: '/community/activity/',
  },

  // 提醒相关
  REMINDER: {
    BASE: '/reminder/reminders/',
    DETAIL: (id) => `/reminder/reminders/${id}/`,
    COMPLETE: (id) => `/reminder/reminders/${id}/complete/`,
    REOPEN: (id) => `/reminder/reminders/${id}/reopen/`,
    UPCOMING: '/reminder/reminders/upcoming/',
    OVERDUE: '/reminder/reminders/overdue/',
    TODAY: '/reminder/reminders/today/',
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
