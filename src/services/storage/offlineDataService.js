/**
 * 离线数据服务
 * 提供离线数据管理和同步功能
 */
import NetInfo from '@react-native-community/netinfo';
import { Platform, ToastAndroid } from 'react-native';
import localStorageService, { STORAGE_KEYS } from './localStorageService';
import api from '../api';
import { API_ENDPOINTS } from '../../config/api';

/**
 * 离线数据服务
 */
class OfflineDataService {
  constructor() {
    // 初始化网络监听
    this.unsubscribe = null;
    this.isInitialized = false;
    this.syncInProgress = false;
  }

  /**
   * 初始化离线数据服务
   */
  initialize() {
    if (this.isInitialized) return;

    // 监听网络状态变化
    this.unsubscribe = NetInfo.addEventListener(state => {
      // 当网络连接恢复时，尝试同步离线数据
      if (state.isConnected && !this.syncInProgress) {
        this.syncOfflineData();
      }
    });

    this.isInitialized = true;
    console.log('离线数据服务已初始化');
  }

  /**
   * 销毁离线数据服务
   */
  destroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.isInitialized = false;
  }

  /**
   * 同步离线数据
   * @returns {Promise<boolean>} - 是否成功
   */
  async syncOfflineData() {
    if (this.syncInProgress) return false;

    try {
      this.syncInProgress = true;

      // 检查网络连接
      const isConnected = await localStorageService.isConnected();
      if (!isConnected) {
        console.log('无网络连接，无法同步离线数据');
        this.syncInProgress = false;
        return false;
      }

      // 获取离线操作队列
      const offlineQueue = await localStorageService.getOfflineQueue();
      if (!offlineQueue || offlineQueue.length === 0) {
        console.log('没有离线数据需要同步');
        this.syncInProgress = false;
        return true;
      }

      console.log(`开始同步 ${offlineQueue.length} 个离线操作`);

      // 显示同步开始提示
      if (Platform.OS === 'android') {
        ToastAndroid.show(`正在同步 ${offlineQueue.length} 个离线操作...`, ToastAndroid.SHORT);
      }

      // 处理每个离线操作
      const results = [];
      for (const operation of offlineQueue) {
        try {
          const result = await this.processOfflineOperation(operation);
          results.push({
            operation,
            success: result.success,
            data: result.data,
            error: result.error
          });
        } catch (error) {
          console.error('处理离线操作失败:', error);
          results.push({
            operation,
            success: false,
            error: error.message || '未知错误'
          });
        }
      }

      // 过滤出失败的操作
      const failedOperations = results.filter(result => !result.success).map(result => result.operation);

      // 更新离线队列，只保留失败的操作
      await localStorageService.saveData(STORAGE_KEYS.OFFLINE_QUEUE, failedOperations);

      // 显示同步结果提示
      const successCount = results.length - failedOperations.length;
      if (Platform.OS === 'android') {
        ToastAndroid.show(
          `同步完成: ${successCount}/${results.length} 个操作成功`,
          ToastAndroid.SHORT
        );
      }

      console.log(`同步完成: ${successCount}/${results.length} 个操作成功`);
      
      // 更新同步状态
      await localStorageService.updateSyncStatus('all');

      return true;
    } catch (error) {
      console.error('同步离线数据失败:', error);
      
      // 显示同步失败提示
      if (Platform.OS === 'android') {
        ToastAndroid.show('同步失败: ' + (error.message || '未知错误'), ToastAndroid.SHORT);
      }
      
      return false;
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * 处理单个离线操作
   * @param {object} operation - 离线操作
   * @returns {Promise<object>} - 处理结果
   */
  async processOfflineOperation(operation) {
    const { type, endpoint, method, data, id } = operation;

    try {
      let response;

      switch (method.toUpperCase()) {
        case 'GET':
          response = await api.get(endpoint);
          break;
        case 'POST':
          response = await api.post(endpoint, data);
          break;
        case 'PUT':
          response = await api.put(endpoint, data);
          break;
        case 'PATCH':
          response = await api.patch(endpoint, data);
          break;
        case 'DELETE':
          response = await api.delete(endpoint);
          break;
        default:
          throw new Error(`不支持的方法: ${method}`);
      }

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error(`处理离线操作失败 (${type}):`, error);
      return {
        success: false,
        error: error.message || '未知错误'
      };
    }
  }

  /**
   * 添加离线操作
   * @param {string} type - 操作类型
   * @param {string} endpoint - API端点
   * @param {string} method - HTTP方法
   * @param {object} data - 请求数据
   * @param {string} id - 资源ID
   * @returns {Promise<boolean>} - 是否成功
   */
  async addOfflineOperation(type, endpoint, method, data = null, id = null) {
    return await localStorageService.addToOfflineQueue({
      type,
      endpoint,
      method,
      data,
      id,
      createdAt: new Date().toISOString()
    });
  }
}

// 导出单例
export default new OfflineDataService();
