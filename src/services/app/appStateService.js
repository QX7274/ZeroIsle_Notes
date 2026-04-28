/**
 * 应用状态服务 - 管理应用的全局状态
 */

import { AppState } from 'react-native';
import realmService from '../database/realmService';
import networkService from '../network/networkService';

class AppStateService {
  constructor() {
    this.appState = {
      currentState: AppState.currentState,
      lastActive: Date.now(),
      isOnline: true,
      isInitialized: false,
      isLoading: false,
      error: null,
      lastSyncTime: null,
      deviceInfo: {},
      sessionStartTime: Date.now(),
    };

    this.listeners = [];
    this.appStateSubscription = null;
    this.netInfoSubscription = null;
  }

  /**
   * 初始化应用状态服务
   */
  initialize() {
    if (this.appState.isInitialized) {
      return;
    }

    // 监听应用状态变化
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);

    // 监听网络状态变化
    this.netInfoSubscription = networkService.addNetworkListener(this.handleNetworkChange);

    networkService.checkConnection().then(isOnline => {
      this.appState.isOnline = Boolean(isOnline);
      this.notifyListeners();
    }).catch(error => {
      console.error('初始化网络状态失败:', error);
    });

    // 加载上次会话信息
    this.loadLastSession();

    this.appState.isInitialized = true;
    this.notifyListeners();

    console.log('应用状态服务初始化成功');
  }

  /**
   * 加载上次会话信息
   * @private
   */
  async loadLastSession() {
    try {
      const realm = await realmService.getRealm();
      const item = realm.objects('StorageItem').filtered('key = "app_last_session"');
      const lastSessionData = item.length > 0 ? item[0].value : null;

      if (lastSessionData) {
        const lastSession = JSON.parse(lastSessionData);

        this.appState.lastActive = lastSession.lastActive || Date.now();
        this.appState.lastSyncTime = lastSession.lastSyncTime || null;
      }
    } catch (error) {
      console.error('加载上次会话信息失败:', error);
    }
  }

  /**
   * 保存当前会话信息
   * @private
   */
  async saveCurrentSession() {
    try {
      const sessionData = {
        lastActive: this.appState.lastActive,
        lastSyncTime: this.appState.lastSyncTime,
      };

      const realm = await realmService.getRealm();
      realm.write(() => {
        const existingItem = realm.objects('StorageItem').filtered('key = "app_last_session"');
        if (existingItem.length > 0) {
          existingItem[0].value = JSON.stringify(sessionData);
          existingItem[0].updated_at = new Date();
        } else {
          realm.create('StorageItem', {
            key: 'app_last_session',
            value: JSON.stringify(sessionData),
            createdAt: new Date(),
            updated_at: new Date(),
          });
        }
      });
    } catch (error) {
      console.error('保存当前会话信息失败:', error);
    }
  }

  /**
   * 处理应用状态变化
   * @param {string} nextAppState 下一个应用状态
   * @private
   */
  handleAppStateChange = (nextAppState) => {
    const prevState = this.appState.currentState;
    this.appState.currentState = nextAppState;

    // 应用进入前台
    if (prevState.match(/inactive|background/) && nextAppState === 'active') {
      this.appState.lastActive = Date.now();
      console.log('应用进入前台');
    }

    // 应用进入后台
    if (nextAppState.match(/inactive|background/) && prevState === 'active') {
      console.log('应用进入后台');
      this.saveCurrentSession();
    }

    this.notifyListeners();
  };

  /**
   * 处理网络状态变化
   * @param {Object} state 网络状态
   * @private
   */
  handleNetworkChange = (state) => {
    const wasOnline = this.appState.isOnline;
    this.appState.isOnline = Boolean(state?.isOnline);

    // 网络状态变化
    if (wasOnline !== this.appState.isOnline) {
      console.log(`网络状态变化: ${this.appState.isOnline ? '在线' : '离线'}`);
      this.notifyListeners();
    }
  };

  /**
   * 设置加载状态
   * @param {boolean} isLoading 是否加载中
   */
  setLoading(isLoading) {
    this.appState.isLoading = isLoading;
    this.notifyListeners();
  }

  /**
   * 设置错误状态
   * @param {Error|null} error 错误对象
   */
  setError(error) {
    this.appState.error = error;
    this.notifyListeners();
  }

  /**
   * 设置同步时间
   * @param {Date} time 同步时间
   */
  setSyncTime(time) {
    this.appState.lastSyncTime = time || new Date();
    this.notifyListeners();
  }

  /**
   * 设置设备信息
   * @param {Object} info 设备信息
   */
  setDeviceInfo(info) {
    this.appState.deviceInfo = { ...info };
    this.notifyListeners();
  }

  /**
   * 获取应用状态
   * @returns {Object} 应用状态
   */
  getState() {
    return { ...this.appState };
  }

  /**
   * 添加状态变化监听器
   * @param {Function} listener 监听器函数
   * @returns {Function} 移除监听器的函数
   */
  addListener(listener) {
    if (typeof listener !== 'function') {
      return () => {};
    }

    this.listeners.push(listener);

    // 立即通知新监听器当前状态
    listener(this.getState());

    // 返回移除监听器的函数
    return () => {
      this.removeListener(listener);
    };
  }

  /**
   * 移除状态变化监听器
   * @param {Function} listener 监听器函数
   */
  removeListener(listener) {
    const index = this.listeners.indexOf(listener);
    if (index !== -1) {
      this.listeners.splice(index, 1);
    }
  }

  /**
   * 通知所有监听器
   * @private
   */
  notifyListeners() {
    const state = this.getState();
    this.listeners.forEach(listener => {
      try {
        listener(state);
      } catch (error) {
        console.error('通知监听器失败:', error);
      }
    });
  }

  /**
   * 清理资源
   */
  cleanup() {
    // 移除应用状态监听
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }

    // 移除网络状态监听
    if (this.netInfoSubscription) {
      this.netInfoSubscription();
      this.netInfoSubscription = null;
    }

    // 保存会话信息
    this.saveCurrentSession();

    // 清空监听器
    this.listeners = [];

    console.log('应用状态服务已清理');
  }
}

const appStateService = new AppStateService();

module.exports = appStateService;
module.exports.default = appStateService;
module.exports.appStateService = appStateService;
module.exports.AppStateService = AppStateService;
