/**
 * ZeroIsle Notes 应用入口
 * @format
 */

// 首先初始化 Reanimated（必须在最开始）
import 'react-native-reanimated';
import 'react-native-get-random-values';

import { AppRegistry } from 'react-native';
import App from './src/App';


// 设置全局错误处理器（仅用于日志，不忽略致命错误）
if (global.ErrorUtils) {
  const originalHandler = global.ErrorUtils.getGlobalHandler();

  global.ErrorUtils.setGlobalHandler((error, isFatal) => {
    // 记录错误但不阻止其传播
    if (error && error.message) {
      const msg = error.message;
      console.warn('捕获到错误:', msg, '是否致命:', isFatal);
    }

    // 所有错误都调用原始处理器
    if (originalHandler) {
      originalHandler(error, isFatal);
    }
  });
}

// 注册应用组件
AppRegistry.registerComponent('ZeroIsle_Notes', () => App);

console.log('ZeroIsle_Notes 应用已成功注册');
