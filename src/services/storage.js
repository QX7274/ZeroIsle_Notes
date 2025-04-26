import AsyncStorage from '@react-native-async-storage/async-storage';

// 存储键
const KEYS = {
  TOKEN: 'zeroislenotes_token',
  REFRESH_TOKEN: 'zeroislenotes_refresh_token',
  USER: 'zeroislenotes_user',
  THEME: 'zeroislenotes_theme',
  THEME_STYLE: 'zeroislenotes_theme_style',
  LANGUAGE: 'zeroislenotes_language',
  SETTINGS: 'zeroislenotes_settings',
  RECENT_SEARCHES: 'zeroislenotes_recent_searches',
  RECENT_NOTES: 'zeroislenotes_recent_notes',
  ACCESSIBILITY: 'zeroislenotes_accessibility',
};

// Token 相关
export const setToken = async (token) => {
  try {
    await AsyncStorage.setItem(KEYS.TOKEN, token);
    return true;
  } catch (error) {
    console.error('保存令牌失败:', error);
    return false;
  }
};

export const getToken = async () => {
  try {
    return await AsyncStorage.getItem(KEYS.TOKEN);
  } catch (error) {
    console.error('获取令牌失败:', error);
    return null;
  }
};

// 同步获取令牌（用于拦截器）
export const getTokenSync = () => {
  // 从Redux存储中获取令牌
  try {
    // 导入Redux存储
    const { store } = require('../store');

    // 获取当前状态
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
    await AsyncStorage.removeItem(KEYS.TOKEN);
    await AsyncStorage.removeItem(KEYS.REFRESH_TOKEN);
    return true;
  } catch (error) {
    console.error('移除令牌失败:', error);
    return false;
  }
};

// 刷新令牌相关
export const setRefreshToken = async (token) => {
  try {
    await AsyncStorage.setItem(KEYS.REFRESH_TOKEN, token);
    return true;
  } catch (error) {
    console.error('保存刷新令牌失败:', error);
    return false;
  }
};

export const getRefreshToken = async () => {
  try {
    return await AsyncStorage.getItem(KEYS.REFRESH_TOKEN);
  } catch (error) {
    console.error('获取刷新令牌失败:', error);
    return null;
  }
};

// 用户信息相关
export const setUser = async (user) => {
  try {
    await AsyncStorage.setItem(KEYS.USER, JSON.stringify(user));
    return true;
  } catch (error) {
    console.error('保存用户信息失败:', error);
    return false;
  }
};

export const getUser = async () => {
  try {
    const user = await AsyncStorage.getItem(KEYS.USER);
    return user ? JSON.parse(user) : null;
  } catch (error) {
    console.error('获取用户信息失败:', error);
    return null;
  }
};

export const removeUser = async () => {
  try {
    await AsyncStorage.removeItem(KEYS.USER);
    return true;
  } catch (error) {
    console.error('移除用户信息失败:', error);
    return false;
  }
};

// 主题相关
export const setTheme = async (theme) => {
  try {
    await AsyncStorage.setItem(KEYS.THEME, theme);
    return true;
  } catch (error) {
    console.error('保存主题失败:', error);
    return false;
  }
};

export const getTheme = async () => {
  try {
    const theme = await AsyncStorage.getItem(KEYS.THEME);
    return theme || 'system';
  } catch (error) {
    console.error('获取主题失败:', error);
    return 'system';
  }
};

// 主题风格相关
export const setThemeStyle = async (style) => {
  try {
    await AsyncStorage.setItem(KEYS.THEME_STYLE, style);
    return true;
  } catch (error) {
    console.error('保存主题风格失败:', error);
    return false;
  }
};

export const getThemeStyle = async () => {
  try {
    const style = await AsyncStorage.getItem(KEYS.THEME_STYLE);
    return style || 'classic';
  } catch (error) {
    console.error('获取主题风格失败:', error);
    return 'classic';
  }
};

// 语言相关
export const setLanguage = async (language) => {
  try {
    await AsyncStorage.setItem(KEYS.LANGUAGE, language);
    return true;
  } catch (error) {
    console.error('保存语言失败:', error);
    return false;
  }
};

export const getLanguage = async () => {
  try {
    const language = await AsyncStorage.getItem(KEYS.LANGUAGE);
    return language || 'zh-CN';
  } catch (error) {
    console.error('获取语言失败:', error);
    return 'zh-CN';
  }
};

// 设置相关
export const setSettings = async (settings) => {
  try {
    await AsyncStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
    return true;
  } catch (error) {
    console.error('保存设置失败:', error);
    return false;
  }
};

export const getSettings = async () => {
  try {
    const settings = await AsyncStorage.getItem(KEYS.SETTINGS);
    return settings ? JSON.parse(settings) : {};
  } catch (error) {
    console.error('获取设置失败:', error);
    return {};
  }
};

// 最近搜索相关
export const setRecentSearches = async (searches) => {
  try {
    await AsyncStorage.setItem(KEYS.RECENT_SEARCHES, JSON.stringify(searches));
    return true;
  } catch (error) {
    console.error('保存最近搜索失败:', error);
    return false;
  }
};

export const getRecentSearches = async () => {
  try {
    const searches = await AsyncStorage.getItem(KEYS.RECENT_SEARCHES);
    return searches ? JSON.parse(searches) : [];
  } catch (error) {
    console.error('获取最近搜索失败:', error);
    return [];
  }
};

// 最近笔记相关
export const setRecentNotes = async (notes) => {
  try {
    await AsyncStorage.setItem(KEYS.RECENT_NOTES, JSON.stringify(notes));
    return true;
  } catch (error) {
    console.error('保存最近笔记失败:', error);
    return false;
  }
};

export const getRecentNotes = async () => {
  try {
    const notes = await AsyncStorage.getItem(KEYS.RECENT_NOTES);
    return notes ? JSON.parse(notes) : [];
  } catch (error) {
    console.error('获取最近笔记失败:', error);
    return [];
  }
};

// 清除所有存储
export const clearAll = async () => {
  try {
    await AsyncStorage.clear();
    return true;
  } catch (error) {
    console.error('清除存储失败:', error);
    return false;
  }
};

// 清除认证相关存储
export const clearAuth = async () => {
  try {
    await AsyncStorage.multiRemove([KEYS.TOKEN, KEYS.REFRESH_TOKEN, KEYS.USER]);
    return true;
  } catch (error) {
    console.error('清除认证存储失败:', error);
    return false;
  }
};

// 可访问性设置相关
export const setAccessibilitySettings = async (settings) => {
  try {
    await AsyncStorage.setItem(KEYS.ACCESSIBILITY, JSON.stringify(settings));
    return true;
  } catch (error) {
    console.error('保存可访问性设置失败:', error);
    return false;
  }
};

export const getAccessibilitySettings = async () => {
  try {
    const settings = await AsyncStorage.getItem(KEYS.ACCESSIBILITY);
    return settings ? JSON.parse(settings) : {};
  } catch (error) {
    console.error('获取可访问性设置失败:', error);
    return {};
  }
};