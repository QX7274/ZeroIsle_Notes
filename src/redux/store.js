/**
 * Redux存储配置
 */

import { configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';

// 导入reducers
import authReducer from './slices/authSlice';
import notesReducer from './slices/notesSlice';
import uiReducer from './slices/uiSlice';
import knowledgeGraphReducer from './slices/knowledgeGraphSlice';
import communityReducer from './slices/communitySlice';
import searchReducer from './slices/searchSlice';
import tagsReducer from './slices/tagsSlice';

// 配置Redux存储
const store = configureStore({
  reducer: {
    auth: authReducer,
    notes: notesReducer,
    ui: uiReducer,
    knowledgeGraph: knowledgeGraphReducer,
    community: communityReducer,
    search: searchReducer,
    tags: tagsReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false
    }),
});

// 启用监听器，用于RTK Query
setupListeners(store.dispatch);

export default store;