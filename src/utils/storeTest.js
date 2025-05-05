/**
 * 测试store是否正确导出
 * 这个文件仅用于测试，不会在生产环境中使用
 */

import { store, persistor } from '../store/index';

// 检查store是否正确导出
console.log('Store测试：', store ? '成功' : '失败');
console.log('Persistor测试：', persistor ? '成功' : '失败');

// 检查store的状态
console.log('Store状态：', store.getState());

export default { store, persistor };
