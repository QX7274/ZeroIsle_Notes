/**
 * Reanimated 配置文件
 * 用于配置 Reanimated 库的行为
 */

// 导入 LogBox 用于忽略特定警告
import { LogBox } from 'react-native';

// 忽略 Reanimated 相关的警告
LogBox.ignoreLogs([
  'Reading from `value` during component render',
  'Animated: `useNativeDriver`',
  'Reanimated 2',
]);

// 全局错误处理
try {
  // 尝试设置全局错误处理器
  const ErrorUtils = require('react-native').ErrorUtils;

  if (ErrorUtils) {
    const originalGlobalHandler = ErrorUtils.getGlobalHandler();

    ErrorUtils.setGlobalHandler((error, isFatal) => {
      // 检查是否是 Reanimated 相关错误
      if (error && error.message && (
        error.message.includes('Reanimated') ||
        error.message.includes('strictMode') ||
        error.message.includes('LoggerConfig')
      )) {
        console.warn('已捕获 Reanimated 错误:', error.message);
        // 不向上传递 Reanimated 错误
        return;
      }

      // 对于其他错误，调用原始处理器
      if (originalGlobalHandler) {
        originalGlobalHandler(error, isFatal);
      }
    });

    console.log('Reanimated 错误处理器设置成功');
  }
} catch (error) {
  console.warn('设置 Reanimated 错误处理器失败:', error);
}

console.log('已配置忽略 Reanimated 警告');

// 导出空对象，保持模块结构
export default {};
