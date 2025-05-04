/**
 * 网络服务
 * 提供网络连接状态检测和管理
 */
import NetInfo from '@react-native-community/netinfo';
import { Platform } from 'react-native';
import analyticsService from '../analytics/analyticsService';

// 网络状态监听器
let networkListener = null;

// 网络状态变化回调函数列表
const networkCallbacks = [];

/**
 * 检查网络连接状态
 * @returns {Promise<boolean>} 是否连接到网络
 */
export const isNetworkConnected = async () => {
  try {
    const state = await NetInfo.fetch();
    return state.isConnected && state.isInternetReachable;
  } catch (error) {
    console.error('检查网络连接失败:', error);
    analyticsService.trackError(error, { action: 'check_network_connection' });
    return false;
  }
};

/**
 * 获取网络连接类型
 * @returns {Promise<string>} 网络连接类型
 */
export const getNetworkType = async () => {
  try {
    const state = await NetInfo.fetch();
    return state.type;
  } catch (error) {
    console.error('获取网络类型失败:', error);
    analyticsService.trackError(error, { action: 'get_network_type' });
    return 'unknown';
  }
};

/**
 * 监听网络状态变化
 * @param {Function} callback 回调函数
 * @returns {Function} 取消监听的函数
 */
export const addNetworkListener = (callback) => {
  if (typeof callback !== 'function') {
    console.error('网络监听回调必须是函数');
    return () => {};
  }

  // 添加到回调列表
  networkCallbacks.push(callback);

  // 如果还没有监听器，创建一个
  if (!networkListener) {
    networkListener = NetInfo.addEventListener(state => {
      const isConnected = state.isConnected && state.isInternetReachable;
      
      // 调用所有回调
      networkCallbacks.forEach(cb => {
        try {
          cb({
            isConnected,
            type: state.type,
            details: Platform.select({
              ios: state.details,
              android: {
                isConnectionExpensive: state.details.isConnectionExpensive,
                cellularGeneration: state.details.cellularGeneration,
              },
              default: {},
            }),
          });
        } catch (error) {
          console.error('执行网络状态回调失败:', error);
        }
      });
      
      analyticsService.trackEvent('network_status_changed', {
        isConnected,
        type: state.type,
      });
    });
  }

  // 返回取消监听的函数
  return () => {
    const index = networkCallbacks.indexOf(callback);
    if (index !== -1) {
      networkCallbacks.splice(index, 1);
    }

    // 如果没有回调了，移除监听器
    if (networkCallbacks.length === 0 && networkListener) {
      networkListener();
      networkListener = null;
    }
  };
};

/**
 * 移除网络状态监听
 * @param {Function} callback 回调函数
 */
export const removeNetworkListener = (callback) => {
  const index = networkCallbacks.indexOf(callback);
  if (index !== -1) {
    networkCallbacks.splice(index, 1);
  }

  // 如果没有回调了，移除监听器
  if (networkCallbacks.length === 0 && networkListener) {
    networkListener();
    networkListener = null;
  }
};

/**
 * 网络服务
 */
const networkService = {
  isNetworkConnected,
  getNetworkType,
  addNetworkListener,
  removeNetworkListener,
};

export default networkService;
