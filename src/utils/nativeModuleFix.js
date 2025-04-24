/**
 * 原生模块修复工具
 * 
 * 这个文件用于修复React Native原生模块的常见问题
 */

import { NativeModules, UIManager } from 'react-native';

/**
 * 修复视图配置中的bubblingEventTypes问题
 * @param {string} viewName - 视图名称
 */
export const fixBubblingEventTypes = (viewName) => {
  if (UIManager && UIManager[viewName]) {
    if (!UIManager[viewName].bubblingEventTypes) {
      UIManager[viewName].bubblingEventTypes = {};
      console.log(`已修复 ${viewName} 的 bubblingEventTypes`);
    }
    
    if (!UIManager[viewName].directEventTypes) {
      UIManager[viewName].directEventTypes = {};
      console.log(`已修复 ${viewName} 的 directEventTypes`);
    }
  }
};

/**
 * 修复所有已知的视图配置问题
 */
export const fixAllViewConfigs = () => {
  // 修复BVLinearGradient
  fixBubblingEventTypes('BVLinearGradient');
  
  // 修复其他可能有问题的视图
  const viewManagerNames = Object.keys(UIManager || {});
  viewManagerNames.forEach(viewName => {
    if (UIManager[viewName] && !UIManager[viewName].bubblingEventTypes) {
      fixBubblingEventTypes(viewName);
    }
  });
};

/**
 * 检查原生模块是否存在
 * @param {string} moduleName - 模块名称
 * @returns {boolean} - 模块是否存在
 */
export const checkNativeModule = (moduleName) => {
  return !!NativeModules[moduleName];
};

export default {
  fixBubblingEventTypes,
  fixAllViewConfigs,
  checkNativeModule,
};
