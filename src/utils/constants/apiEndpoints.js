/**
 * 零屿笔记应用API端点常量
 */

import { API_BASE_URL } from './config';

// 认证相关
export const AUTH_ENDPOINTS = {
  LOGIN: `${API_BASE_URL}/auth/login`,
  REGISTER: `${API_BASE_URL}/auth/register`,
  VERIFY: `${API_BASE_URL}/auth/verify`,
  REFRESH_TOKEN: `${API_BASE_URL}/auth/refresh`,
  LOGOUT: `${API_BASE_URL}/auth/logout`,
  RESET_PASSWORD: `${API_BASE_URL}/auth/reset-password`,
  THIRD_PARTY_AUTH: `${API_BASE_URL}/auth/third-party`,
  USER_INFO: `${API_BASE_URL}/auth/me`,
};

// 笔记相关
export const NOTES_ENDPOINTS = {
  GET_NOTES: `${API_BASE_URL}/notes`,
  GET_NOTE: (id) => `${API_BASE_URL}/notes/${id}`,
  CREATE_NOTE: `${API_BASE_URL}/notes`,
  UPDATE_NOTE: (id) => `${API_BASE_URL}/notes/${id}`,
  DELETE_NOTE: (id) => `${API_BASE_URL}/notes/${id}`,
  HANDWRITING_RECOGNITION: `${API_BASE_URL}/notes/handwriting`,
  VOICE_TRANSCRIPTION: `${API_BASE_URL}/voice/voice-transcription`,
  MEETING_SUMMARY: `${API_BASE_URL}/voice/meeting-summary`,
  UPLOAD_IMAGE: `${API_BASE_URL}/notes/upload-image`,
  AUTO_SAVE: (id) => `${API_BASE_URL}/notes/${id}/auto-save`,
  GET_HISTORY: (id) => `${API_BASE_URL}/notes/${id}/history`,
  GET_VERSION: (id, versionId) => `${API_BASE_URL}/notes/${id}/history/${versionId}`,
  RESTORE_VERSION: (id, versionId) => `${API_BASE_URL}/notes/${id}/history/${versionId}/restore`,
  SYNC_OFFLINE: `${API_BASE_URL}/notes/sync-offline`,
  // 注释相关
  ANNOTATIONS: `${API_BASE_URL}/annotations`,
  // 绘图路径相关
  DRAWING_PATHS: `${API_BASE_URL}/drawing-paths`,
};

// 分类相关
export const CATEGORIES_ENDPOINTS = {
  GET_CATEGORIES: `${API_BASE_URL}/categories`,
  CREATE_CATEGORY: `${API_BASE_URL}/categories`,
  UPDATE_CATEGORY: (id) => `${API_BASE_URL}/categories/${id}`,
  DELETE_CATEGORY: (id) => `${API_BASE_URL}/categories/${id}`,
};

// 标签相关
export const TAGS_ENDPOINTS = {
  GET_TAGS: `${API_BASE_URL}/tags`,
  CREATE_TAG: `${API_BASE_URL}/tags`,
  UPDATE_TAG: (id) => `${API_BASE_URL}/tags/${id}`,
  DELETE_TAG: (id) => `${API_BASE_URL}/tags/${id}`,
};

// 知识图谱相关
export const KNOWLEDGE_GRAPH_ENDPOINTS = {
  GET_GRAPH: `${API_BASE_URL}/knowledge-graph`,
  GET_NODE: (id) => `${API_BASE_URL}/knowledge-graph/nodes/${id}`,
  GET_RELATED_NODES: (id) => `${API_BASE_URL}/knowledge-graph/nodes/${id}/related`,
  GET_RELATED_CONCEPTS: (id) => `${API_BASE_URL}/knowledge-graph/nodes/${id}/related_concepts`,
  CREATE_NODE: `${API_BASE_URL}/knowledge-graph/nodes`,
  UPDATE_NODE: (id) => `${API_BASE_URL}/knowledge-graph/nodes/${id}`,
  DELETE_NODE: (id) => `${API_BASE_URL}/knowledge-graph/nodes/${id}`,
  CREATE_LINK: `${API_BASE_URL}/knowledge-graph/links`,
  UPDATE_LINK: (id) => `${API_BASE_URL}/knowledge-graph/links/${id}`,
  DELETE_LINK: (id) => `${API_BASE_URL}/knowledge-graph/links/${id}`,
  ANALYZE: `${API_BASE_URL}/knowledge-graph/analyze`,
  FIND_PATH: `${API_BASE_URL}/knowledge-graph/find_path`,
};

// 社区相关
export const COMMUNITY_ENDPOINTS = {
  GET_PUBLIC_NOTES: `${API_BASE_URL}/community/notes`,
  LIKE_NOTE: (id) => `${API_BASE_URL}/community/notes/${id}/like`,
  FAVORITE_NOTE: (id) => `${API_BASE_URL}/community/notes/${id}/favorite`,
  COMMENT_NOTE: (id) => `${API_BASE_URL}/community/notes/${id}/comment`,
  GET_COMMENTS: (id) => `${API_BASE_URL}/community/notes/${id}/comments`,
  FOLLOW_USER: (id) => `${API_BASE_URL}/community/users/${id}/follow`,
  GET_FOLLOWERS: (id) => `${API_BASE_URL}/community/users/${id}/followers`,
  GET_FOLLOWING: (id) => `${API_BASE_URL}/community/users/${id}/following`,
};

// 语音功能相关
export const VOICE_ENDPOINTS = {
  VOICE_SEARCH: `${API_BASE_URL}/voice/search`,
  VOICE_TRANSCRIBE: `${API_BASE_URL}/voice/transcribe`,
  VOICE_COMMAND: `${API_BASE_URL}/voice/command`,
};

// 提醒相关
export const REMINDER_ENDPOINTS = {
  GET_REMINDERS: `${API_BASE_URL}/reminders`,
  CREATE_REMINDER: `${API_BASE_URL}/reminders`,
  UPDATE_REMINDER: (id) => `${API_BASE_URL}/reminders/${id}`,
  DELETE_REMINDER: (id) => `${API_BASE_URL}/reminders/${id}`,
};

// 用户设置相关
export const SETTINGS_ENDPOINTS = {
  GET_SETTINGS: `${API_BASE_URL}/settings`,
  UPDATE_SETTINGS: `${API_BASE_URL}/settings`,
  SYNC_DATA: `${API_BASE_URL}/settings/sync`,
};

// AI功能相关
export const AI_ENDPOINTS = {
  TEXT_ANALYSIS: `${API_BASE_URL}/ai/text-analysis`,
  AUTO_CATEGORIZE: `${API_BASE_URL}/ai/auto-categorize`,
  GENERATE_MIND_MAP: `${API_BASE_URL}/ai/generate-mind-map`,
  MEETING_SUMMARY: `${API_BASE_URL}/ai/meeting-summary`,
};

// 群组相关
export const GROUPS_ENDPOINTS = {
  BASE: `${API_BASE_URL}/groups`,
  DETAIL: (id) => `${API_BASE_URL}/groups/${id}`,
  GENERATE_JOIN_CODE: (id) => `${API_BASE_URL}/groups/${id}/generate_join_code`,
  JOIN_BY_CODE: `${API_BASE_URL}/groups/join_by_code`,
  INVITE: (id) => `${API_BASE_URL}/groups/${id}/invite`,
  MEMBERS: (id) => `${API_BASE_URL}/groups/${id}/members`,
  LEAVE: (id) => `${API_BASE_URL}/groups/${id}/leave`,
  INVITATIONS: `${API_BASE_URL}/invitations`,
  ACCEPT_INVITATION: (id) => `${API_BASE_URL}/invitations/${id}/accept`,
  REJECT_INVITATION: (id) => `${API_BASE_URL}/invitations/${id}/reject`,
  SHARED_SCREENS: `${API_BASE_URL}/shared-screens`,
  JOIN_SCREEN_SHARE: (id) => `${API_BASE_URL}/shared-screens/${id}/join`,
  END_SCREEN_SHARE: (id) => `${API_BASE_URL}/shared-screens/${id}/end`,
};