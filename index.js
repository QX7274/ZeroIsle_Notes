/**
 * @format
 */

import {AppRegistry} from 'react-native';
import App from './src/App';
import {name as appName} from './app.json';

// 导入BVLinearGradient修复补丁
import './src/patches/BVLinearGradientFix';

AppRegistry.registerComponent(appName, () => App);
