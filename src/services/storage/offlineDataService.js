/**
 * 离线数据服务
 * 提供基于MongoDB Realm的离线数据存储和同步功能
 */

import realmService from '../database/realmService';
import STORAGE_KEYS from '../../constants/storageKeys';
import NetInfo from '@react-native-community/netinfo';
import axios from 'axios';
import { API_ENDPOINTS } from '../../constants/api';

/**
 * 离线数据服务类
 */
class OfflineDataService {
  constructor() {
    this.isInitialized = false;
    this.syncQueue = [];
    this.isOnline = false;
    this.lastSyncTime = null;
    this.syncInProgress = false;
    this.apiClient = null;
  }

  /**
   * 初始化服务
   * @param {Object} apiClient - API客户端
   */
  async initialize(apiClient = null) {
    if (this.isInitialized) {
      console.log('OfflineDataService: 已经初始化');
      return;
    }

    try {
      this.apiClient = apiClient || axios.create({
        baseURL: API_ENDPOINTS.BASE_URL,
        timeout: 10000,
      });

      // 加载同步队列
      await this.loadSyncQueue();

      // 检查网络状态
      const netInfo = await NetInfo.fetch();
      this.isOnline = netInfo.isConnected && netInfo.isInternetReachable;

      // 添加网络状态监听器
      this.unsubscribeNetInfo = NetInfo.addEventListener(state => {
        const wasOnline = this.isOnline;
        this.isOnline = state.isConnected && state.isInternetReachable;

        // 如果从离线变为在线，尝试同步数据
        if (!wasOnline && this.isOnline) {
          console.log('OfflineDataService: 网络已恢复，尝试同步数据');
          this.syncData();
        }
      });

      // 初始化Realm服务
      await realmService.initialize();

      this.isInitialized = true;
      console.log('OfflineDataService: 初始化完成');
    } catch (error) {
      console.error('OfflineDataService: 初始化失败', error);
      // 即使初始化失败，也标记为已初始化，以避免重复尝试
      this.isInitialized = true;
    }
  }

  /**
   * 加载同步队列
   */
  async loadSyncQueue() {
    try {
      const realm = await realmService.getRealm();
      const item = realm.objects('StorageItem').filtered(`key = "${STORAGE_KEYS.SYNC_QUEUE}"`);
      const queueJson = item.length > 0 ? item[0].value : null;
      if (queueJson) {
        this.syncQueue = JSON.parse(queueJson);
        console.log(`OfflineDataService: 从本地存储加载了 ${this.syncQueue.length} 个同步队列项`);
      } else {
        this.syncQueue = [];
      }

      // 加载上次同步时间
      const timeItem = realm.objects('StorageItem').filtered(`key = "${STORAGE_KEYS.LAST_SYNC_TIME}"`);
      const lastSyncTimeStr = timeItem.length > 0 ? timeItem[0].value : null;
      if (lastSyncTimeStr) {
        this.lastSyncTime = new Date(lastSyncTimeStr);
        console.log(`OfflineDataService: 上次同步时间: ${this.lastSyncTime}`);
      }
    } catch (error) {
      console.error('OfflineDataService: 加载同步队列失败', error);
      this.syncQueue = [];
    }
  }

  /**
   * 保存同步队列
   */
  async saveSyncQueue() {
    try {
      realm.write(() => {
        const existingItem = realm.objects('StorageItem').filtered(`key = "${STORAGE_KEYS.SYNC_QUEUE}"`);
        if (existingItem.length > 0) {
          existingItem[0].value = JSON.stringify(this.syncQueue);
          existingItem[0].updated_at = new Date();
        } else {
          realm.create('StorageItem', {
            key: STORAGE_KEYS.SYNC_QUEUE,
            value: JSON.stringify(this.syncQueue),
            createdAt: new Date(),
            updated_at: new Date(),
          });
        }
      });
      console.log(`OfflineDataService: 已保存 ${this.syncQueue.length} 个同步队列项`);
    } catch (error) {
      console.error('OfflineDataService: 保存同步队列失败', error);
    }
  }

  /**
   * 添加操作到同步队列
   * @param {string} operation - 操作类型 (create, update, delete)
   * @param {string} collection - 集合名称
   * @param {string} id - 记录ID
   * @param {Object} data - 记录数据
   */
  async addToSyncQueue(operation, collection, id, data = null) {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // 创建队列项
    const queueItem = {
      id: Date.now().toString(),
      operation,
      collection,
      recordId: id,
      data,
      timestamp: new Date().toISOString(),
      retryCount: 0
    };

    // 添加到队列
    this.syncQueue.push(queueItem);
    await this.saveSyncQueue();

    // 如果在线，尝试立即同步
    if (this.isOnline && !this.syncInProgress) {
      this.syncData();
    }
  }

  /**
   * 同步数据到后端API
   */
  async syncData() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (!this.isOnline || this.syncInProgress || this.syncQueue.length === 0) {
      if (!this.isOnline) {
        console.log('OfflineDataService: 离线状态，跳过同步');
      } else if (this.syncInProgress) {
        console.log('OfflineDataService: 同步已在进行中，跳过');
      } else if (this.syncQueue.length === 0) {
        console.log('OfflineDataService: 同步队列为空，跳过同步');
      }
      return;
    }

    try {
      this.syncInProgress = true;
      console.log(`OfflineDataService: 开始同步 ${this.syncQueue.length} 个队列项`);

      const newQueue = [];
      const maxRetries = 3;

      for (const item of this.syncQueue) {
        try {
          const { operation, collection, recordId, data } = item;
          let endpoint = '';
          let method = '';
          let payload = null;

          // 根据操作类型和集合确定API端点和方法
          switch (operation) {
            case 'create':
              endpoint = `/${collection}/`;
              method = 'post';
              payload = data;
              break;
            case 'update':
              endpoint = `/${collection}/${recordId}/`;
              method = 'put';
              payload = data;
              break;
            case 'delete':
              endpoint = `/${collection}/${recordId}/`;
              method = 'delete';
              break;
            default:
              console.warn(`OfflineDataService: 未知操作 ${operation}，跳过同步`);
              continue;
          }

          // 发送API请求
          const response = await this.apiClient({
            method,
            url: endpoint,
            data: payload,
          });

          console.log(`OfflineDataService: 已${operation === 'create' ? '创建' : operation === 'update' ? '更新' : '删除'} ${collection} 记录 ${recordId}`);

          // 如果是创建操作，更新本地对象的ID
          if (operation === 'create' && response.data && response.data.id) {
            const realm = realmService.getRealm();
            const localObject = realm.objectForPrimaryKey(collection, recordId);
            if (localObject) {
              realm.write(() => {
                localObject.id = response.data.id;
                localObject.syncStatus = 'synced';
                localObject.lastSyncedAt = new Date();
              });
            }
          }
        } catch (itemError) {
          console.error(`OfflineDataService: 同步队列项 ${item.id} 失败`, itemError);

          // 如果重试次数超过最大值，放弃此项
          if (item.retryCount >= maxRetries) {
            console.warn(`OfflineDataService: 队列项 ${item.id} 重试次数已达上限，放弃同步`);
            continue;
          }

          // 增加重试计数并保留在队列中
          item.retryCount++;
          newQueue.push(item);
        }
      }

      // 更新同步队列
      this.syncQueue = newQueue;
      await this.saveSyncQueue();

      // 更新最后同步时间
      this.lastSyncTime = new Date();
      realm.write(() => {
        const existingItem = realm.objects('StorageItem').filtered(`key = "${STORAGE_KEYS.LAST_SYNC_TIME}"`);
        if (existingItem.length > 0) {
          existingItem[0].value = this.lastSyncTime.toISOString();
          existingItem[0].updated_at = new Date();
        } else {
          realm.create('StorageItem', {
            key: STORAGE_KEYS.LAST_SYNC_TIME,
            value: this.lastSyncTime.toISOString(),
            createdAt: new Date(),
            updated_at: new Date(),
          });
        }
      });

      console.log(`OfflineDataService: 同步完成，剩余 ${newQueue.length} 个队列项`);
    } catch (error) {
      console.error('OfflineDataService: 同步数据失败', error);
    } finally {
      this.syncInProgress = false;
    }
  }

  /**
   * 清除同步队列
   */
  async clearSyncQueue() {
    this.syncQueue = [];
    await this.saveSyncQueue();
    console.log('OfflineDataService: 已清除同步队列');
  }

  /**
   * 销毁服务实例
   * 清理资源，移除监听器等
   */
  async destroy() {
    try {
      console.log('OfflineDataService: 正在销毁服务...');
      
      // 清理同步队列
      this.syncQueue = [];
      
      // 清理状态
      this.syncInProgress = false;
      this.lastSyncTime = null;
      
      // 清理网络监听器
      if (this.unsubscribeNetInfo) {
        this.unsubscribeNetInfo();
        this.unsubscribeNetInfo = null;
      }
      
      console.log('OfflineDataService: 服务销毁完成');
    } catch (error) {
      console.error('OfflineDataService: 销毁服务失败:', error);
    }
  }
}

// 创建单例实例
const offlineDataService = new OfflineDataService();

export default offlineDataService;
