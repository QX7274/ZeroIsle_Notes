/**
 * Expo入口文件
 */
import 'expo-asset';
import 'expo-file-system';
import { registerRootComponent } from 'expo';
import App from './src/App';

// 注册根组件
registerRootComponent(App);
