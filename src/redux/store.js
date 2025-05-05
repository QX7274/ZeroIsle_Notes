/**
 * Redux存储配置
 *
 * 注意：这个文件被 src/store/index.js 导入，并在那里添加了持久化功能
 * 不要直接从其他文件导入这个 store，而是从 src/store/index.js 导入
 */

import { configureStore, combineReducers } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import { persistReducer } from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 导入reducers
import authReducer from './slices/authSlice';
import notesReducer from './slices/notesSlice';
import noteReducer from './slices/noteSlice';
import uiReducer from './slices/uiSlice';
import knowledgeGraphReducer from './slices/knowledgeGraphSlice';
import mindMapReducer from './slices/mindMapSlice';
import communityReducer from './slices/communitySlice';
import searchReducer from './slices/searchSlice';
import tagsReducer from './slices/tagsSlice';
import groupsReducer from './slices/groupsSlice';
import aiAssistantReducer from './slices/aiAssistantSlice';
import reminderReducer from './slices/reminderSlice';
import settingsReducer from './slices/settingsSlice';

// 导入传统reducers
import userReducer from './reducers/userReducer';

// 添加调试信息
console.log('redux/store.js: 开始创建store...');

// 创建一个函数来配置store
const configureAppStore = () => {
  try {
    console.log('redux/store.js: reducers导入成功');

    // 配置Redux Persist
    const persistConfig = {
      key: 'root',
      storage: AsyncStorage,
      // 只持久化这些reducer
      whitelist: ['auth', 'settings', 'user'],
      // 调试模式
      debug: __DEV__,
      // 添加超时设置，避免无限等待
      timeout: 10000,
    };

    // 合并所有reducers
    const rootReducer = combineReducers({
      auth: authReducer,
      notes: notesReducer,
      note: noteReducer,
      ui: uiReducer,
      knowledgeGraph: knowledgeGraphReducer,
      mindMap: mindMapReducer,
      community: communityReducer,
      search: searchReducer,
      tags: tagsReducer,
      groups: groupsReducer,
      aiAssistant: aiAssistantReducer,
      reminders: reminderReducer,
      settings: settingsReducer,
      user: userReducer,
    });

    // 创建持久化reducer
    const persistedReducer = persistReducer(persistConfig, rootReducer);

    // 配置Redux存储
    const store = configureStore({
      reducer: persistedReducer,
      middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
          serializableCheck: false,
          // 添加额外的中间件选项
          immutableCheck: false,
        }),
      // 启用开发工具
      devTools: __DEV__,
    });

    console.log('redux/store.js: store创建成功');

    // 启用监听器，用于RTK Query
    setupListeners(store.dispatch);

    console.log('redux/store.js: 监听器设置成功');

    return store;
  } catch (error) {
    console.error('redux/store.js: 创建store失败:', error);
    console.error('错误详情:', error.message);
    console.error('错误堆栈:', error.stack);

    // 创建一个简单的store作为备选
    const fallbackStore = configureStore({
      reducer: {
        fallback: (state = { initialized: true }, action) => state
      }
    });

    console.log('redux/store.js: 创建备选store成功');

    return fallbackStore;
  }
};

// 创建并导出store
const store = configureAppStore();
export default store;