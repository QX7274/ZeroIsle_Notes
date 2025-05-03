/**
 * Redux存储配置
 *
 * 注意：这个文件被 src/store/index.js 导入，并在那里添加了持久化功能
 * 不要直接从其他文件导入这个 store，而是从 src/store/index.js 导入
 */

import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';

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

// 配置Redux存储
const store = configureStore({
  reducer: {
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
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false
    }),
});

// 启用监听器，用于RTK Query
setupListeners(store.dispatch);

export default store;