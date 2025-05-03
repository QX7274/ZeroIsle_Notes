/**
 * Redux存储配置
 * 集成了Redux Persist进行状态持久化
 *
 * 注意：这个文件导入了 src/redux/store.js 中的 store 并添加了持久化功能
 * App.js 导入了这个文件中的 store 和 persistor
 */
import { persistStore, persistReducer } from 'redux-persist';
import AsyncStorage from '@react-native-async-storage/async-storage';
import store from '../redux/store';

// Redux Persist配置
const persistConfig = {
  key: 'root',
  storage: AsyncStorage,
  whitelist: ['auth', 'settings', 'notes', 'user', 'aiAssistant'], // 需要持久化的状态
  blacklist: ['ui'], // 不需要持久化的状态
};

// 创建持久化存储
const persistor = persistStore(store);

export { store, persistor };
