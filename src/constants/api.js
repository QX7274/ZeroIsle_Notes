/**
 * API端点常量
 */

import { API_URL } from '../config';

export const API_ENDPOINTS = {
  // 基础URL
  BASE_URL: `${API_URL}`,

  // 认证相关
  AUTH: {
    LOGIN: '/api/v1/auth/login',
    REGISTER: '/api/v1/auth/register',
    LOGOUT: '/api/v1/auth/logout',
    REFRESH_TOKEN: '/api/v1/auth/refresh-token',
    VERIFY_EMAIL: '/api/v1/auth/verify-email',
    RESET_PASSWORD: '/api/v1/auth/reset-password',
    CHANGE_PASSWORD: '/api/v1/auth/change-password',
  },

  // 用户相关
  USER: {
    PROFILE: '/api/v1/users/profile',
    SETTINGS: '/api/v1/users/settings',
    AVATAR: '/api/v1/users/avatar',
  },

  // 笔记相关
  NOTES: {
    BASE: '/api/v1/notes',
    CATEGORIES: '/api/v1/notes/categories',
    TAGS: '/api/v1/notes/tags',
    ATTACHMENTS: '/api/v1/notes/attachments',
    REMINDERS: '/api/v1/notes/reminders',
    SEARCH: '/api/v1/notes/search',
    EXPORT: '/api/v1/notes/export',
    IMPORT: '/api/v1/notes/import',
    SHARE: '/api/v1/notes/share',
  },

  // 知识图谱相关
  KNOWLEDGE_GRAPH: {
    BASE: '/api/v1/knowledge-graph',
    NODES: '/api/v1/knowledge-graph/nodes',
    EDGES: '/api/v1/knowledge-graph/edges',
    SEARCH: '/api/v1/knowledge-graph/search',
    EXPORT: '/api/v1/knowledge-graph/export',
    IMPORT: '/api/v1/knowledge-graph/import',
  },

  // 思维导图相关
  MIND_MAP: {
    BASE: '/api/v1/mind-map',
    NODES: '/api/v1/mind-map/nodes',
    SEARCH: '/api/v1/mind-map/search',
    EXPORT: '/api/v1/mind-map/export',
    IMPORT: '/api/v1/mind-map/import',
  },

  // AI助手相关
  AI_ASSISTANT: {
    BASE: '/api/v1/ai-assistant',
    CHAT: '/api/v1/ai-assistant/chat',
    HISTORY: '/api/v1/ai-assistant/history',
    MODELS: '/api/v1/ai-assistant/models',
  },

  // 提醒相关
  REMINDERS: {
    BASE: '/api/v1/reminders',
    UPCOMING: '/api/v1/reminders/upcoming',
    COMPLETED: '/api/v1/reminders/completed',
  },

  // 社区相关
  COMMUNITY: {
    BASE: '/api/v1/community',
    POSTS: '/api/v1/community/posts',
    COMMENTS: '/api/v1/community/comments',
    CATEGORIES: '/api/v1/community/categories',
    TAGS: '/api/v1/community/tags',
  },

  // 数据库相关
  DATABASE: {
    BASE: '/api/v1/database',
    PING: '/api/v1/database/ping',
    BACKUP: '/api/v1/database/backup',
    RESTORE: '/api/v1/database/restore',
  },

  // 文件相关
  FILES: {
    UPLOAD: '/api/v1/files/upload',
    DOWNLOAD: '/api/v1/files/download',
    LIST: '/api/v1/files/list',
    DELETE: '/api/v1/files/delete',
  },

  // 设置相关
  SETTINGS: {
    BASE: '/api/v1/settings',
    SYNC: '/api/v1/settings/sync',
    THEME: '/api/v1/settings/theme',
    LANGUAGE: '/api/v1/settings/language',
  },
};

export default API_ENDPOINTS;
