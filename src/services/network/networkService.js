/**
 * 网络服务
 * 提供网络状态监控和管理功能
 */

import NetInfo from '@react-native-community/netinfo';
import { Platform } from 'react-native';

import { eventEmitter } from '../utils/eventEmitter';

// 网络事件
export const NETWORK_EVENTS = {
  ONLINE: 'online',
  OFFLINE: 'offline',
  NETWORK_CHANGE: 'network:change',
};

// 连接类型
export const CONNECTION_TYPES = {
  NONE: 'none',
  UNKNOWN: 'unknown',
  CELLULAR: 'cellular',
  WIFI: 'wifi',
  ETHERNET: 'ethernet',
  BLUETOOTH: 'bluetooth',
  VPN: 'vpn',
  OTHER: 'other',
};

// 连接质量
export const CONNECTION_QUALITY = {
  UNKNOWN: 'unknown',
  POOR: 'poor',
  MODERATE: 'moderate',
  GOOD: 'good',
  EXCELLENT: 'excellent',
};

class NetworkService {
  constructor() {
    this.initialized = false;
    this.initializationPromise = null;
    this.isOnlineValue = false;
    this.connectionType = CONNECTION_TYPES.UNKNOWN;
    this.connectionQuality = CONNECTION_QUALITY.UNKNOWN;
    this.unsubscribe = null;
  }

  /**
   * 初始化网络服务
   */
  async initialize() {
    if (this.initialized) return Promise.resolve();

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = new Promise(async (resolve, reject) => {
      try {
        // 获取当前网络状态
        const netInfo = await NetInfo.fetch();
        this.updateNetworkState(netInfo);

        // 添加网络状态变化监听器
        this.unsubscribe = NetInfo.addEventListener(this.handleNetworkChange);

        this.initialized = true;
        console.info('网络服务初始化成功');
        resolve();
      } catch (error) {
        console.error('网络服务初始化失败', error);
        reject(error);
      }
    });

    return this.initializationPromise;
  }

  /**
   * 处理网络状态变化
   * @param {Object} netInfo 网络信息
   * @private
   */
  handleNetworkChange = (netInfo) => {
    const wasOnline = this.isOnlineValue;

    // 更新网络状态
    this.updateNetworkState(netInfo);

    // 触发网络状态变化事件
    eventEmitter.emit(NETWORK_EVENTS.NETWORK_CHANGE, {
      isOnline: this.isOnlineValue,
      connectionType: this.connectionType,
      connectionQuality: this.connectionQuality,
      details: netInfo,
    });

    // 触发上线/离线事件
    if (wasOnline !== this.isOnlineValue) {
      if (this.isOnlineValue) {
        eventEmitter.emit(NETWORK_EVENTS.ONLINE);
        console.info('网络已连接');

        // 网络恢复时，触发认证状态同步
        this.handleNetworkRestore();
      } else {
        eventEmitter.emit(NETWORK_EVENTS.OFFLINE);
        console.info('网络已断开');
      }
    }
  };

  /**
   * 更新网络状态
   * @param {Object} netInfo 网络信息
   * @private
   */
  updateNetworkState(netInfo) {
    this.isOnlineValue = netInfo.isConnected && netInfo.isInternetReachable;
    this.connectionType = netInfo.type || CONNECTION_TYPES.UNKNOWN;

    // 根据连接类型和强度估计连接质量
    if (!netInfo.isConnected) {
      this.connectionQuality = CONNECTION_QUALITY.UNKNOWN;
    } else if (netInfo.type === CONNECTION_TYPES.WIFI) {
      this.connectionQuality = CONNECTION_QUALITY.EXCELLENT;
    } else if (netInfo.type === CONNECTION_TYPES.ETHERNET) {
      this.connectionQuality = CONNECTION_QUALITY.EXCELLENT;
    } else if (netInfo.type === CONNECTION_TYPES.CELLULAR) {
      // 根据信号强度估计连接质量
      const strength = netInfo.details?.cellularGeneration;
      if (strength === '4g' || strength === '5g') {
        this.connectionQuality = CONNECTION_QUALITY.GOOD;
      } else if (strength === '3g') {
        this.connectionQuality = CONNECTION_QUALITY.MODERATE;
      } else {
        this.connectionQuality = CONNECTION_QUALITY.POOR;
      }
    } else {
      this.connectionQuality = CONNECTION_QUALITY.MODERATE;
    }
  }

  /**
   * 是否在线
   * @returns {boolean} 是否在线
   */
  isOnline() {
    return this.isOnlineValue;
  }

  /**
   * 获取连接类型
   * @returns {string} 连接类型
   */
  getConnectionType() {
    return this.connectionType;
  }

  /**
   * 获取连接质量
   * @returns {string} 连接质量
   */
  getConnectionQuality() {
    return this.connectionQuality;
  }

  /**
   * 处理网络恢复
   * @private
   */
  async handleNetworkRestore() {
    try {
      console.log('网络恢复，开始处理认证状态同步');

      // 动态导入authService以避免循环依赖
      const { default: authService } = await import('../auth/authService');

      // 同步认证状态
      await authService.syncAuthStateOnNetworkRestore();

      console.log('网络恢复处理完成');
    } catch (error) {
      console.error('网络恢复处理失败:', error);
    }
  }

  /**
   * 检查网络连接
   * @returns {Promise<boolean>} 是否在线
   */
  async checkConnection() {
    try {
      const netInfo = await NetInfo.fetch();
      this.updateNetworkState(netInfo);
      return this.isOnlineValue;
    } catch (error) {
      console.error('检查网络连接失败', error);
      return false;
    }
  }

  /**
   * 添加网络事件监听器
   * @param {string} event 事件名称
   * @param {Function} listener 监听器
   * @returns {Function} 移除监听器的函数
   */
  addListener(event, listener) {
    eventEmitter.addListener(event, listener);
    return () => eventEmitter.removeListener(event, listener);
  }

  /**
   * 移除网络事件监听器
   * @param {string} event 事件名称
   * @param {Function} listener 监听器
   */
  removeListener(event, listener) {
    eventEmitter.removeListener(event, listener);
  }

  /**
   * 销毁网络服务
   */
  destroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    this.initialized = false;
    this.initializationPromise = null;
    console.info('网络服务已销毁');
  }
}

export const networkService = new NetworkService();

export default networkService;
