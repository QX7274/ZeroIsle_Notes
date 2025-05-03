/**
 * 设置状态管理Slice
 * 使用Redux Toolkit重写settingsReducer.js的功能
 */

import { createSlice } from '@reduxjs/toolkit';

// 初始状态
const initialState = {
  theme: 'system', // 主题：light, dark, system
  language: 'zh', // 语言：zh, en
  fontSize: 'medium', // 字体大小：small, medium, large
  notifications: true, // 是否启用通知
  autoSync: true, // 是否自动同步
  syncInterval: 30, // 同步间隔（分钟）
  autoSave: true, // 自动保存
  offlineMode: false, // 离线模式
};

// 创建设置Slice
const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setTheme: (state, action) => {
      state.theme = action.payload;
    },
    setLanguage: (state, action) => {
      state.language = action.payload;
    },
    setFontSize: (state, action) => {
      state.fontSize = action.payload;
    },
    toggleNotifications: (state) => {
      state.notifications = !state.notifications;
    },
    setNotifications: (state, action) => {
      state.notifications = action.payload;
    },
    toggleAutoSync: (state) => {
      state.autoSync = !state.autoSync;
    },
    setAutoSync: (state, action) => {
      state.autoSync = action.payload;
    },
    setSyncInterval: (state, action) => {
      state.syncInterval = action.payload;
    },
    resetSettings: () => initialState,
    updateSettings: (state, action) => {
      return { ...state, ...action.payload };
    },
    setAutoSave: (state, action) => {
      state.autoSave = action.payload;
    },
    setOfflineMode: (state, action) => {
      state.offlineMode = action.payload;
    },
  },
});

// 导出Actions
export const {
  setTheme,
  setLanguage,
  setFontSize,
  toggleNotifications,
  setNotifications,
  toggleAutoSync,
  setAutoSync,
  setSyncInterval,
  resetSettings,
  updateSettings,
  setAutoSave,
  setOfflineMode,
} = settingsSlice.actions;

// 导出Reducer
export default settingsSlice.reducer;
