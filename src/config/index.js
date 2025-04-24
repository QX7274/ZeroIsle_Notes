// 根据运行环境选择API地址
export const API_URL = __DEV__ 
  ? 'http://10.0.2.2:8000/api'  // Android模拟器访问本机地址
  : 'http://localhost:8000/api'; // 生产环境地址

export const THEME = {
  LIGHT: 'light',
  DARK: 'dark'
};

export const LANGUAGES = {
  ZH: 'zh',
  EN: 'en'
};

export const NOTIFICATION_CHANNELS = {
  REMINDER: 'reminder_channel',
  NOTE: 'note_channel',
  SHARE: 'share_channel'
};

export const STORAGE_KEYS = {
  TOKEN: 'token',
  USER: 'user',
  SETTINGS: 'settings'
};

export const ERROR_MESSAGES = {
  NETWORK_ERROR: '网络连接错误，请检查网络设置',
  SERVER_ERROR: '服务器错误，请稍后重试',
  UNAUTHORIZED: '未授权，请重新登录',
  FORBIDDEN: '禁止访问',
  NOT_FOUND: '未找到资源',
  VALIDATION_ERROR: '输入数据验证失败'
};