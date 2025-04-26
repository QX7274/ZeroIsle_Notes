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
 */
export function navigate(name, params) {
  if (navigationRef.current) {
    navigationRef.current.navigate(name, params);
  } else {
    // 如果导航引用不可用，将导航操作保存到队列中
    // 这在应用启动时可能会发生
    getNavigationQueue().push({ name, params });
  }
}

/**
 * 返回上一屏幕
 */
export function goBack() {
  if (navigationRef.current) {
    navigationRef.current.goBack();
  }
}

/**
 * 重置导航状态
 * @param {object} state - 新的导航状态
 */
export function reset(state) {
  if (navigationRef.current) {
    navigationRef.current.reset(state);
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
    navigationQueue.forEach(({ name, params }) => {
      navigate(name, params);
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
  getNavigationQueue,
  processNavigationQueue,
  getCurrentRoute,
  getCurrentRouteName,
};
