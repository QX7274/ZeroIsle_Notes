/**
 * 导航引用
 * 允许在组件外部使用导航功能
 */

import { createRef } from 'react';

// 创建导航引用
export const navigationRef = createRef();

/**
 * 导航到指定屏幕
 * @param {string} name - 路由名称
 * @param {object} params - 路由参数
 * @param {object} options - 导航选项，如 reset
 */
export function navigate(name, params, options = {}) {
  if (navigationRef.current) {
    try {
      if (options.reset) {
        // 如果需要重置导航堆栈
        console.log(`尝试重置导航到: ${name}`);
        navigationRef.current.reset({
          index: 0,
          routes: [{ name, params }],
        });
      } else {
        // 正常导航
        console.log(`尝试导航到: ${name}`);
        navigationRef.current.navigate(name, params);
      }
    } catch (error) {
      console.error(`导航到 ${name} 失败:`, error);

      // 尝试备选方法
      try {
        console.log(`尝试备选导航方法到: ${name}`);
        if (options.reset) {
          // 如果reset失败，尝试使用dispatch
          navigationRef.current.dispatch({
            type: 'RESET',
            payload: {
              index: 0,
              routes: [{ name, params }],
            },
          });
        } else {
          // 如果navigate失败，尝试使用dispatch
          navigationRef.current.dispatch({
            type: 'NAVIGATE',
            payload: {
              name,
              params,
            },
          });
        }
      } catch (backupError) {
        console.error(`备选导航方法到 ${name} 也失败:`, backupError);
      }
    }
  } else {
    // 如果导航引用不可用，将导航操作保存到队列中
    // 这在应用启动时可能会发生
    console.log(`导航引用不可用，将导航到 ${name} 添加到队列`);
    getNavigationQueue().push({ name, params, options });
  }
}

/**
 * 返回上一屏幕
 */
export function goBack() {
  if (navigationRef.current) {
    try {
      // 尝试获取当前路由状态
      const state = navigationRef.current.getState();

      // 检查是否有可返回的路由
      if (state && state.routes && state.routes.length > 1) {
        navigationRef.current.goBack();
      } else {
        console.warn('没有可返回的屏幕，导航栈为空');
        // 备选方案：导航到首页
        navigationRef.current.navigate('Home');
      }
    } catch (error) {
      console.error('执行goBack失败:', error);
      // 备选方案：导航到首页
      navigationRef.current.navigate('Home');
    }
  } else {
    console.warn('navigationRef.current不存在，无法执行goBack');
  }
}

/**
 * 重置导航状态
 * @param {object} state - 新的导航状态
 */
export function reset(state) {
  if (navigationRef.current) {
    try {
      console.log('尝试重置导航状态');
      navigationRef.current.reset(state);
    } catch (error) {
      console.error('重置导航状态失败:', error);

      // 尝试备选方法
      try {
        console.log('尝试使用dispatch重置导航状态');
        navigationRef.current.dispatch({
          type: 'RESET',
          payload: state,
        });
      } catch (backupError) {
        console.error('备选重置导航状态方法也失败:', backupError);
      }
    }
  } else {
    console.warn('navigationRef.current不存在，无法重置导航状态');
  }
}

/**
 * 重置导航根状态
 * @param {object} state - 新的导航状态
 */
export function resetRoot(state) {
  if (navigationRef.current) {
    try {
      console.log('尝试重置导航根状态');
      // 尝试使用reset方法代替resetRoot
      navigationRef.current.reset(state);
    } catch (error) {
      console.error('重置导航根状态失败:', error);

      // 尝试备选方法
      try {
        console.log('尝试使用dispatch重置导航根状态');
        navigationRef.current.dispatch({
          type: 'RESET',
          payload: state,
        });
      } catch (backupError) {
        console.error('备选重置导航根状态方法也失败:', backupError);
      }
    }
  } else {
    console.warn('navigationRef.current不存在，无法重置导航根状态');
  }
}

// 导航队列，用于存储应用启动前的导航操作
let navigationQueue = [];

/**
 * 获取导航队列
 * @returns {Array} 导航队列
 */
export function getNavigationQueue() {
  return navigationQueue;
}

/**
 * 处理导航队列中的所有导航操作
 */
export function processNavigationQueue() {
  if (navigationRef.current && navigationQueue.length > 0) {
    navigationQueue.forEach(({ name, params, options }) => {
      navigate(name, params, options);
    });
    navigationQueue = [];
  }
}

/**
 * 获取当前路由
 * @returns {object} 当前路由
 */
export function getCurrentRoute() {
  if (navigationRef.current) {
    return navigationRef.current.getCurrentRoute();
  }
  return null;
}

/**
 * 获取当前路由名称
 * @returns {string} 当前路由名称
 */
export function getCurrentRouteName() {
  const currentRoute = getCurrentRoute();
  return currentRoute ? currentRoute.name : null;
}

export default {
  navigationRef,
  navigate,
  goBack,
  reset,
  resetRoot,
  getNavigationQueue,
  processNavigationQueue,
  getCurrentRoute,
  getCurrentRouteName,
};
