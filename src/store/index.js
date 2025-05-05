/**
 * Redux存储配置
 * 集成了Redux Persist进行状态持久化
 *
 * 注意：这个文件导入了 src/redux/store.js 中的 store 并添加了持久化功能
 * App.js 导入了这个文件中的 store 和 persistor
 */
import { persistStore } from 'redux-persist';

// 直接导入redux/store.js中的store
import store from '../redux/store';

// 添加调试信息
console.log('store/index.js: store导入状态:', store ? '成功' : '失败');
if (store) {
  console.log('store/index.js: store类型:', typeof store);
  console.log('store/index.js: store包含dispatch:', typeof store.dispatch === 'function' ? '是' : '否');
}

// 创建持久化存储，添加超时和调试信息
const persistor = persistStore(store, {
  // 添加超时配置，避免无限等待
  timeout: 10000, // 10秒超时
  // 添加回调函数，用于调试
  manualPersist: false,
}, () => {
  console.log('store/index.js: 持久化数据恢复完成');
});

// 立即启动持久化恢复过程
persistor.persist();

console.log('store/index.js: persistor创建状态:', persistor ? '成功' : '失败');

// 导出store和persistor
export { store, persistor };
