/**
 * API配置文件
 * 定义API基础URL和各个模块的端点
 */

// 根据环境选择API基础URL
export const API_BASE_URL = __DEV__
  ? 'http://10.0.2.2:8000/api'  // Android模拟器访问本机地址
  : 'http://localhost:8000/api'; // 生产环境地址

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
    LOGIN: '/users/login/',
    REGISTER: '/users/register/',
    REGISTER_USERNAME: '/users/register/username/',
    REGISTER_EMAIL: '/users/register/email/',
    REGISTER_PHONE: '/users/register/phone/',
    LOGIN_CODE: '/users/login/code/',
    LOGIN_WECHAT: '/users/login/wechat/',
    LOGIN_QQ: '/users/login/qq/',
    REFRESH_TOKEN: '/users/token/refresh/',
    PROFILE: '/users/profile/',
    CHANGE_PASSWORD: '/users/password/change/',
    RESET_PASSWORD: '/users/password/reset/',
    VERIFY_EMAIL: '/users/email/verify/',
    SEND_VERIFICATION_CODE: '/users/send-verification-code/',
    BIND_EMAIL: '/users/bind/email/',
    BIND_PHONE: '/users/bind/phone/',
    BIND_WECHAT: '/users/bind/wechat/',
    BIND_QQ: '/users/bind/qq/',
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
    COMPLETE: (id) => `/reminder/complete/${id}/`,
    REOPEN: (id) => `/reminder/reopen/${id}/`,
    UPCOMING: '/reminder/upcoming/',
    OVERDUE: '/reminder/overdue/',
    TODAY: '/reminder/today/',
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
