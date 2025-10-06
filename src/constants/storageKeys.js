/**
 * 存储键常量
 * 定义应用中使用的所有存储键
 */

// 存储键前缀
const STORAGE_PREFIX = 'zeroisle_';

// 存储键
export const STORAGE_KEYS = {
  // 认证相关
  AUTH_TOKEN: `${STORAGE_PREFIX}auth_token`,
  REFRESH_TOKEN: `${STORAGE_PREFIX}refresh_token`,
  USER_INFO: `${STORAGE_PREFIX}user_info`,
  TOKEN: `${STORAGE_PREFIX}token`,
  USER: `${STORAGE_PREFIX}user`,

  // 笔记相关
  NOTES_CACHE: `${STORAGE_PREFIX}notes_cache`,
  OFFLINE_NOTES: `${STORAGE_PREFIX}offline_notes`,
  NOTE_DETAIL: (id) => `${STORAGE_PREFIX}note_${id}`,
  RECENT_NOTES: `${STORAGE_PREFIX}recent_notes`,

  // 分类和标签
  CATEGORIES: `${STORAGE_PREFIX}categories`,
  TAGS: `${STORAGE_PREFIX}tags`,

  // 提醒相关
  REMINDERS: `${STORAGE_PREFIX}reminders`,
  REMINDER_DETAIL: (id) => `${STORAGE_PREFIX}reminder_${id}`,

  // 群组相关
  GROUPS: `${STORAGE_PREFIX}groups`,
  GROUP_DETAIL: (id) => `${STORAGE_PREFIX}group_${id}`,
  GROUP_MEMBERS: (id) => `${STORAGE_PREFIX}group_members_${id}`,

  // 设置相关
  SETTINGS: `${STORAGE_PREFIX}settings`,
  THEME: `${STORAGE_PREFIX}theme`,
  THEME_STYLE: `${STORAGE_PREFIX}theme_style`,
  CUSTOM_THEME: `${STORAGE_PREFIX}custom_theme`,
  LANGUAGE: `${STORAGE_PREFIX}language`,
  ACCESSIBILITY: `${STORAGE_PREFIX}accessibility`,

  // 离线同步相关
  OFFLINE_OPERATIONS: `${STORAGE_PREFIX}offline_operations`,
  LAST_SYNC_TIME: `${STORAGE_PREFIX}last_sync_time`,
  PENDING_REMINDERS: `${STORAGE_PREFIX}pending_reminders`,
  OFFLINE_REMINDERS: `${STORAGE_PREFIX}offline_reminders`,
  ALL_REMINDERS: `${STORAGE_PREFIX}all_reminders`,

  // 画布相关
  CANVAS_CACHE: `${STORAGE_PREFIX}canvas_cache`,
  INFINITE_CANVASES: `${STORAGE_PREFIX}infinite_canvases`,
  SYNC_QUEUE: `${STORAGE_PREFIX}sync_queue`,

  // 知识图谱相关
  KNOWLEDGE_GRAPH_CACHE: `${STORAGE_PREFIX}knowledge_graph_cache`,

  // 社区相关
  COMMUNITY_CACHE: `${STORAGE_PREFIX}community_cache`,

  // 备份相关
  BACKUP_INFO: `${STORAGE_PREFIX}backup_info`,

  // 搜索相关
  SEARCH_HISTORY: `${STORAGE_PREFIX}search_history`,
  RECENT_SEARCHES: `${STORAGE_PREFIX}recent_searches`,

  // 文件相关
  FILE_PREVIEWS: `${STORAGE_PREFIX}file_previews`,

  // AI助手相关
  AI_ENGINE: `${STORAGE_PREFIX}ai_engine`,
  AI_MODEL: `${STORAGE_PREFIX}ai_model`,
  CHAT_HISTORY: `${STORAGE_PREFIX}ai_chat_history`,
  STREAM_RESPONSE: `${STORAGE_PREFIX}stream_response`,
  VOICE_ENABLED: `${STORAGE_PREFIX}voice_enabled`,
  MARKDOWN_ENABLED: `${STORAGE_PREFIX}markdown_enabled`,
  BAIDU_API_KEY: `${STORAGE_PREFIX}baidu_api_key`,
  BAIDU_SECRET_KEY: `${STORAGE_PREFIX}baidu_secret_key`,

  // 加密相关
  ENCRYPTION_KEY: `${STORAGE_PREFIX}encryption_key`,

  // 上传相关
  UPLOAD_QUEUE: `${STORAGE_PREFIX}upload_queue`,
  UPLOAD_HISTORY: `${STORAGE_PREFIX}upload_history`,
  LAST_UPLOAD_TIME: `${STORAGE_PREFIX}last_upload_time`,
};

export default STORAGE_KEYS;
