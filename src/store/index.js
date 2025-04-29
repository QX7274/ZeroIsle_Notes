/**
 * Redux存储配置
 */
import { configureStore } from '@reduxjs/toolkit';
import { persistStore, persistReducer } from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { combineReducers } from 'redux';

// 导入切片
import authReducer from './slices/authSlice';
import notesReducer from './slices/notesSlice';
import aiAssistantReducer from './slices/aiAssistantSlice';

// 导入旧的reducers（保持兼容性）
import userReducer from './reducers/userReducer';
import settingsReducer from './reducers/settingsReducer';
import remindersReducer from './reducers/remindersReducer';

// 导入其他必要的reducers
import communityReducer from '../redux/slices/communitySlice';

// 持久化配置
const persistConfig = {
  key: 'root',
  storage: AsyncStorage,
  whitelist: ['auth', 'user', 'settings', 'reminders', 'aiAssistant', 'community'], // 持久化的状态
};

// 合并所有reducer
const rootReducer = combineReducers({
  // 新的切片
  auth: authReducer,
  notes: notesReducer,
  aiAssistant: aiAssistantReducer,
  community: communityReducer,

  // 旧的reducers（保持兼容性）
  user: userReducer,
  settings: settingsReducer,
  reminders: remindersReducer,
});

// 创建持久化reducer
const persistedReducer = persistReducer(persistConfig, rootReducer);

// 创建存储
export const store = configureStore({
  reducer: persistedReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: {
        // 忽略redux-persist的非序列化操作
        ignoredActions: ['persist/PERSIST', 'persist/REHYDRATE'],
      },
    }),
});

// 创建持久化存储
export const persistor = persistStore(store);

export default { store, persistor };