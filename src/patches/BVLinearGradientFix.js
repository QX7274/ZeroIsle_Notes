/**
 * BVLinearGradient组件修复
 *
 * 这个文件用于修复BVLinearGradient组件的视图配置注册问题
 * 在应用启动时，我们需要确保BVLinearGradient组件的视图配置正确注册
 */

import { NativeModules, UIManager } from 'react-native';
import { fixAllViewConfigs, checkNativeModule } from '../utils/nativeModuleFix';

// 检查BVLinearGradient模块是否存在
const hasBVLinearGradient = checkNativeModule('BVLinearGradient');

// 修复所有视图配置问题
fixAllViewConfigs();

// 输出诊断信息
console.log('原生模块诊断:');
console.log('- BVLinearGradient模块存在:', hasBVLinearGradient);
console.log('- BVLinearGradient视图配置存在:', !!UIManager?.BVLinearGradient);
console.log('- BVLinearGradient.bubblingEventTypes存在:', !!UIManager?.BVLinearGradient?.bubblingEventTypes);

export default {
  hasBVLinearGradient,
};
