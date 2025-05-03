/**
 * UI状态管理Slice
 */

import { createSlice } from '@reduxjs/toolkit';
import { DEFAULT_SETTINGS } from '../../config/index';

// 初始状态
const initialState = {
  theme: DEFAULT_SETTINGS.theme, // light, dark, system
  fontSize: DEFAULT_SETTINGS.fontSize, // small, medium, large
  isDrawerOpen: false, // 侧边抽屉状态
  isLoading: false, // 全局加载状态
  toast: {
    visible: false,
    message: '',
    type: 'info', // info, success, error, warning
  },
  modal: {
    visible: false,
    type: null, // 模态框类型
    data: null, // 模态框数据
  },
  currentScreen: null, // 当前屏幕
  previousScreen: null, // 上一个屏幕
  networkStatus: {
    isConnected: true,
    type: null, // wifi, cellular, none
  },
};

// 创建Slice
const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    // 设置主题
    setTheme: (state, action) => {
      state.theme = action.payload;
    },
    // 设置字体大小
    setFontSize: (state, action) => {
      state.fontSize = action.payload;
    },
    // 切换侧边抽屉状态
    toggleDrawer: (state) => {
      state.isDrawerOpen = !state.isDrawerOpen;
    },
    // 设置侧边抽屉状态
    setDrawerOpen: (state, action) => {
      state.isDrawerOpen = action.payload;
    },
    // 设置全局加载状态
    setLoading: (state, action) => {
      state.isLoading = action.payload;
    },
    // 显示Toast
    showToast: (state, action) => {
      state.toast = {
        visible: true,
        message: action.payload.message,
        type: action.payload.type || 'info',
      };
    },
    // 隐藏Toast
    hideToast: (state) => {
      state.toast.visible = false;
    },
    // 显示模态框
    showModal: (state, action) => {
      state.modal = {
        visible: true,
        type: action.payload.type,
        data: action.payload.data || null,
      };
    },
    // 隐藏模态框
    hideModal: (state) => {
      state.modal.visible = false;
    },
    // 设置当前屏幕
    setCurrentScreen: (state, action) => {
      state.previousScreen = state.currentScreen;
      state.currentScreen = action.payload;
    },
    // 设置网络状态
    setNetworkStatus: (state, action) => {
      state.networkStatus = action.payload;
    },
    // 重置UI状态
    resetUI: () => initialState,
  },
});

// 导出Actions
export const {
  setTheme,
  setFontSize,
  toggleDrawer,
  setDrawerOpen,
  setLoading,
  showToast,
  hideToast,
  showModal,
  hideModal,
  setCurrentScreen,
  setNetworkStatus,
  resetUI,
} = uiSlice.actions;

// 导出Selectors
export const selectTheme = (state) => state.ui.theme;
export const selectFontSize = (state) => state.ui.fontSize;
export const selectIsDrawerOpen = (state) => state.ui.isDrawerOpen;
export const selectIsLoading = (state) => state.ui.isLoading;
export const selectToast = (state) => state.ui.toast;
export const selectModal = (state) => state.ui.modal;
export const selectCurrentScreen = (state) => state.ui.currentScreen;
export const selectPreviousScreen = (state) => state.ui.previousScreen;
export const selectNetworkStatus = (state) => state.ui.networkStatus;

// 导出Reducer
export default uiSlice.reducer;