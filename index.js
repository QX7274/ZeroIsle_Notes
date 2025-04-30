/**
 * @format
 */

import 'events';  // 添加 events 模块导入
import { AppRegistry } from 'react-native';
import App from './src/App';
import { name as appName } from './app.json';

// 注册应用组件
AppRegistry.registerComponent(appName, () => App);
