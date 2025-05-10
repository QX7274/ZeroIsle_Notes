import SafeAsyncStorage from '../../utils/safeAsyncStorage';

// 存储�?
const KEYS = {
  TOKEN: 'zeroislenotes_token',
  REFRESH_TOKEN: 'zeroislenotes_refresh_token',
  USER: 'zeroislenotes_user',
  THEME: 'zeroislenotes_theme',
  THEME_STYLE: 'zeroislenotes_theme_style',
  CUSTOM_THEME: 'zeroislenotes_custom_theme',
  LANGUAGE: 'zeroislenotes_language',
  SETTINGS: 'zeroislenotes_settings',
  RECENT_SEARCHES: 'zeroislenotes_recent_searches',
  RECENT_NOTES: 'zeroislenotes_recent_notes',
  ACCESSIBILITY: 'zeroislenotes_accessibility',
};

// 通用存储方法
const setItem = async (key, value) => {
  // 防御性检查：确保key不为undefined
  if (key === undefined || key === null) {
    console.error('存储错误: 键不能为undefined或null');
    return false;
  }

  // 确保key是字符串
  const safeKey = String(key);

  try {
    await SafeAsyncStorage.setItem(safeKey, value);
    return true;
  } catch (error) {
    console.error(`保存数据失败 [${safeKey}]:`, error);
    return false;
  }
};

const getItem = async (key) => {
  // 防御性检查：确保key不为undefined
  if (key === undefined || key === null) {
    console.error('读取错误: 键不能为undefined或null');
    return null;
  }

  // 确保key是字符串
  const safeKey = String(key);

  try {
    return await SafeAsyncStorage.getItem(safeKey);
  } catch (error) {
    console.error(`获取数据失败 [${safeKey}]:`, error);
    return null;
  }
};

const removeItem = async (key) => {
  // 防御性检查：确保key不为undefined
  if (key === undefined || key === null) {
    console.error('删除错误: 键不能为undefined或null');
    return false;
  }

  // 确保key是字符串
  const safeKey = String(key);

  try {
    await SafeAsyncStorage.removeItem(safeKey);
    return true;
  } catch (error) {
    console.error(`删除数据失败 [${safeKey}]:`, error);
    return false;
  }
};

// 导出通用方法
const storageService = {
  setItem,
  getItem,
  removeItem,

  // 以下是为了兼容性保留的方法
  getSettings: async () => {
    try {
      const settings = await getItem(KEYS.SETTINGS);
      return settings ? JSON.parse(settings) : {};
    } catch (error) {
      console.error('获取设置失败:', error);
      return {};
    }
  },

  setSettings: async (settings) => {
    try {
      await setItem(KEYS.SETTINGS, JSON.stringify(settings));
      return true;
    } catch (error) {
      console.error('保存设置失败:', error);
      return false;
    }
  }
};

// Token 相关
export const setToken = async (token) => {
  try {
    await SafeAsyncStorage.setItem(KEYS.TOKEN, token);
    return true;
  } catch (error) {
    console.error('保存令牌失败:', error);
    return false;
  }
};

export const getToken = async () => {
  try {
    return await SafeAsyncStorage.getItem(KEYS.TOKEN);
  } catch (error) {
    console.error('获取令牌失败:', error);
    return null;
  }
};

// 同步获取令牌（用于拦截器�?
export const getTokenSync = () => {
  // 从Redux存储中获取令�?
  try {
    // 导入Redux存储
    const { store } = require('../store');

    // 获取当前状�?
    const state = store.getState();

    // 兼容新旧Redux结构
    if (state.auth && state.auth.token) {
      return state.auth.token;
    }

    if (state.user && state.user.token) {
      return state.user.token;
    }

    return null;
  } catch (error) {
    console.error('同步获取令牌失败:', error);
    return null;
  }
};

export const removeToken = async () => {
  try {
    await SafeAsyncStorage.removeItem(KEYS.TOKEN);
    await SafeAsyncStorage.removeItem(KEYS.REFRESH_TOKEN);
    return true;
  } catch (error) {
    console.error('移除令牌失败:', error);
    return false;
  }
};

// 刷新令牌相关
export const setRefreshToken = async (token) => {
  try {
    await SafeAsyncStorage.setItem(KEYS.REFRESH_TOKEN, token);
    return true;
  } catch (error) {
    console.error('保存刷新令牌失败:', error);
    return false;
  }
};

export const getRefreshToken = async () => {
  try {
    return await SafeAsyncStorage.getItem(KEYS.REFRESH_TOKEN);
  } catch (error) {
    console.error('获取刷新令牌失败:', error);
    return null;
  }
};

// 用户信息相关
export const setUser = async (user) => {
  try {
    await SafeAsyncStorage.setItem(KEYS.USER, JSON.stringify(user));
    return true;
  } catch (error) {
    console.error('保存用户信息失败:', error);
    return false;
  }
};

export const getUser = async () => {
  try {
    const user = await SafeAsyncStorage.getItem(KEYS.USER);
    return user ? JSON.parse(user) : null;
  } catch (error) {
    console.error('获取用户信息失败:', error);
    return null;
  }
};

export const removeUser = async () => {
  try {
    await SafeAsyncStorage.removeItem(KEYS.USER);
    return true;
  } catch (error) {
    console.error('移除用户信息失败:', error);
    return false;
  }
};

// 主题相关
export const setTheme = async (theme) => {
  try {
    await SafeAsyncStorage.setItem(KEYS.THEME, theme);
    return true;
  } catch (error) {
    console.error('保存主题失败:', error);
    return false;
  }
};

export const getTheme = async () => {
  try {
    const theme = await SafeAsyncStorage.getItem(KEYS.THEME);
    return theme || 'system';
  } catch (error) {
    console.error('获取主题失败:', error);
    return 'system';
  }
};

// 主题风格相关
export const setThemeStyle = async (style) => {
  try {
    await SafeAsyncStorage.setItem(KEYS.THEME_STYLE, style);
    return true;
  } catch (error) {
    console.error('保存主题风格失败:', error);
    return false;
  }
};

export const getThemeStyle = async () => {
  try {
    const style = await SafeAsyncStorage.getItem(KEYS.THEME_STYLE);
    return style || 'classic';
  } catch (error) {
    console.error('获取主题风格失败:', error);
    return 'classic';
  }
};

// 自定义主题相�?
export const setCustomTheme = async (customTheme) => {
  try {
    await SafeAsyncStorage.setItem(KEYS.CUSTOM_THEME, JSON.stringify(customTheme));
    return true;
  } catch (error) {
    console.error('保存自定义主题失�?', error);
    return false;
  }
};

export const getCustomTheme = async () => {
  try {
    const customTheme = await SafeAsyncStorage.getItem(KEYS.CUSTOM_THEME);
    return customTheme ? JSON.parse(customTheme) : { light: {}, dark: {} };
  } catch (error) {
    console.error('获取自定义主题失�?', error);
    return { light: {}, dark: {} };
  }
};

// 语言相关
export const setLanguage = async (language) => {
  try {
    await SafeAsyncStorage.setItem(KEYS.LANGUAGE, language);
    return true;
  } catch (error) {
    console.error('保存语言失败:', error);
    return false;
  }
};

export const getLanguage = async () => {
  try {
    const language = await SafeAsyncStorage.getItem(KEYS.LANGUAGE);
    return language || 'zh-CN';
  } catch (error) {
    console.error('获取语言失败:', error);
    return 'zh-CN';
  }
};

// 设置相关
export const setSettings = async (settings) => {
  try {
    await SafeAsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
    return true;
  } catch (error) {
    console.error('保存设置失败:', error);
    return false;
  }
};

export const getSettings = async () => {
  try {
    const settings = await SafeAsyncStorage.getItem(KEYS.SETTINGS);
    return settings ? JSON.parse(settings) : {};
  } catch (error) {
    console.error('获取设置失败:', error);
    return {};
  }
};

// 最近搜索相�?
export const setRecentSearches = async (searches) => {
  try {
    await SafeAsyncStorage.setItem(KEYS.RECENT_SEARCHES, JSON.stringify(searches));
    return true;
  } catch (error) {
    console.error('保存最近搜索失�?', error);
    return false;
  }
};

export const getRecentSearches = async () => {
  try {
    const searches = await SafeAsyncStorage.getItem(KEYS.RECENT_SEARCHES);
    return searches ? JSON.parse(searches) : [];
  } catch (error) {
    console.error('获取最近搜索失�?', error);
    return [];
  }
};

// 最近笔记相�?
export const setRecentNotes = async (notes) => {
  try {
    await SafeAsyncStorage.setItem(KEYS.RECENT_NOTES, JSON.stringify(notes));
    return true;
  } catch (error) {
    console.error('保存最近笔记失�?', error);
    return false;
  }
};

export const getRecentNotes = async () => {
  try {
    const notes = await SafeAsyncStorage.getItem(KEYS.RECENT_NOTES);
    return notes ? JSON.parse(notes) : [];
  } catch (error) {
    console.error('获取最近笔记失�?', error);
    return [];
  }
};

// 清除所有存�?
export const clearAll = async () => {
  try {
    await SafeAsyncStorage.clear();
    return true;
  } catch (error) {
    console.error('清除存储失败:', error);
    return false;
  }
};

// 清除认证相关存储
export const clearAuth = async () => {
  try {
    await SafeAsyncStorage.multiRemove([KEYS.TOKEN, KEYS.REFRESH_TOKEN, KEYS.USER]);
    return true;
  } catch (error) {
    console.error('清除认证存储失败:', error);
    return false;
  }
};

// 可访问性设置相�?
export const setAccessibilitySettings = async (settings) => {
  try {
    await SafeAsyncStorage.setItem(KEYS.ACCESSIBILITY, JSON.stringify(settings));
    return true;
  } catch (error) {
    console.error('保存可访问性设置失�?', error);
    return false;
  }
};

export const getAccessibilitySettings = async () => {
  try {
    const settings = await SafeAsyncStorage.getItem(KEYS.ACCESSIBILITY);
    return settings ? JSON.parse(settings) : {};
  } catch (error) {
    console.error('获取可访问性设置失�?', error);
    return {};
  }
};

// 将所有方法添加到storageService对象
Object.assign(storageService, {
  setToken,
  getToken,
  getTokenSync,
  removeToken,
  setRefreshToken,
  getRefreshToken,
  setUser,
  getUser,
  removeUser,
  setTheme,
  getTheme,
  setThemeStyle,
  getThemeStyle,
  setCustomTheme,
  getCustomTheme,
  setLanguage,
  getLanguage,
  setSettings,
  getSettings,
  setRecentSearches,
  getRecentSearches,
  setRecentNotes,
  getRecentNotes,
  clearAll,
  clearAuth,
  setAccessibilitySettings,
  getAccessibilitySettings
});

// 导出storageService对象
export default storageService;
