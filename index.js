/**
 * @format
 */

// 首先导入bcrypt初始化文件，确保在应用启动时尽早设置随机回退函数
import './src/utils/bcryptInit';

// 添加全局错误处理
const setupErrorHandling = () => {
  try {
    console.log('设置全局错误处理...');
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

        console.error('全局错误:', error);
        console.error('是否致命:', isFatal);

        // 调用原始处理器
        if (originalGlobalHandler) {
          originalGlobalHandler(error, isFatal);
        }
      });

      console.log('全局错误处理设置成功');
    }
  } catch (error) {
    console.error('设置全局错误处理失败:', error);
  }
};

// 执行错误处理设置
setupErrorHandling();

// 添加必要的模块导入
import 'events';
import { AppRegistry, LogBox } from 'react-native';
// 首先导入Reanimated配置，确保在其他组件之前加载
import './src/config/reanimatedConfig';
import App from './src/App';
import { COLORS } from './src/utils/constants/colors';

// 确保颜色常量已初始化
console.log('初始化颜色常量...');
console.log('背景色:', COLORS.BACKGROUND);

// 忽略特定警告
LogBox.ignoreLogs([
  'EventEmitter.removeListener',
  'Require cycle:',
  'ViewPropTypes will be removed',
  'AsyncStorage has been extracted',
  'new NativeEventEmitter',
  'RCTBridge required dispatch_sync',
  // Reanimated相关警告
  'Reading from `value` during component render',
  'Animated: `useNativeDriver`',
  'Reanimated 2',
  // NativeEventEmitter相关警告
  '`new NativeEventEmitter()` was called with a non-null argument without the required `addListener` method',
  '`new NativeEventEmitter()` was called with a non-null argument without the required `removeListeners` method',
  // 其他常见警告
  'Using Math.random is not cryptographically secure',
  'componentWillReceiveProps has been renamed',
  'componentWillMount has been renamed',
  'componentWillUpdate has been renamed',
]);

// 预加载关键模块
const preloadModules = () => {
  try {
    console.log('预加载关键模块...');

    // 预加载React相关模块
    require('react');
    require('react-native');

    // 预加载Redux相关模块
    require('redux');
    require('react-redux');
    require('@reduxjs/toolkit');

    console.log('关键模块预加载成功');
  } catch (error) {
    console.error('关键模块预加载失败:', error);
  }
};

// 执行模块预加载
preloadModules();

// 注册应用组件
const appName = 'ZeroIsle_Notes';
console.log('应用名称:', appName);

// 简单的应用注册
AppRegistry.registerComponent(appName, () => App);
console.log('应用已注册:', appName);
