/**
 * API服务
 * 处理与服务器的通信，包括文档上传、下载、删除等操作
 */
import axios from 'axios';

import { Alert } from 'react-native';
// 已移除 offlineStorageService 导入，现在直接使用 realmService
import { authService } from './auth';
import realmService from './database/realmService';
import * as apiService from './api/apiClient';
import networkService from './network/networkService';
import networkErrorService from './networkErrorService';
import { API_URL, API_VERSION } from '../config';

// 创建axios实例
const apiInstance = axios.create({
  baseURL: `${API_URL}/api/${API_VERSION}`,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器 - 添加认证信息
apiInstance.interceptors.request.use(
  async (config) => {
    const token = await authService.getAuthToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// 响应拦截器 - 处理常见错误
apiInstance.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const { response } = error;

    // 处理401未授权错误
    if (response && response.status === 401) {
      const isRefreshed = await authService.refreshToken();
      if (isRefreshed) {
        // 刷新令牌后重试原请求
        const originalRequest = error.config;
        originalRequest.headers.Authorization = `Bearer ${await authService.getAuthToken()}`;
        return apiInstance(originalRequest);
      } else {
        // 令牌刷新失败，需要重新登录
        authService.forceLogout(); // 强制登出并触发导航
        networkErrorService.handleApiError(new Error('认证失败'), {
          context: '认证失败',
          customMessage: '您的登录已过期，请重新登录',
        });
      }
    }

    // 处理网络错误
    if (!response) {
      const isOnline = await networkService.checkConnection();
      if (!isOnline) {
        return Promise.reject(new Error('网络连接已断开，请检查您的网络设置'));
      }
    }

    // 处理其他错误
    const errorMessage = response?.data?.message || '服务器请求失败';
    return Promise.reject(new Error(errorMessage));
  }
);

// API封装器，提供统一的请求方法
const apiWrapper = {
  get: (url, params = {}) => apiInstance.get(url, { params }),
  post: (url, data = {}) => apiInstance.post(url, data),
  put: (url, data = {}) => apiInstance.put(url, data),
  patch: (url, data = {}) => apiInstance.patch(url, data),
  delete: (url) => apiInstance.delete(url),
};

// 统一构建离线队列对象，避免 Realm 字段类型不匹配
const buildOfflineQueueItem = (operation, url, payload = {}) => {
  const now = new Date();
  const safeData = (() => {
    if (payload === undefined || payload === null) return '{}';
    if (typeof FormData !== 'undefined' && payload instanceof FormData) {
      // FormData 无法可靠序列化到离线队列
      return '{}';
    }
    try {
      return JSON.stringify(payload);
    } catch (e) {
      return '{}';
    }
  })();

  return {
    _id: `offline_${now.getTime()}_${Math.random().toString(36).slice(2, 8)}`,
    entity_id: '',
    entity_type: 'api_request',
    operation,
    data: safeData,
    status: 'pending',
    retry_count: 0,
    created_at: now,
    updated_at: now,
    _partition: 'offline_queue',
  };
};

const notesApi = {
  apiWrapper,

  /**
   * 检查网络连接状态
   * @returns {Promise<Object>} 网络状态对象
   */
  checkNetwork: async () => {
    const networkState = await networkService.checkConnectionState();
    return {
      isConnected: Boolean(networkState?.isOnline),
      isInternetReachable: networkState?.details?.isInternetReachable,
      isOnline: Boolean(networkState?.isOnline),
    };
  },

  /**
   * 通用GET请求
   * @param {string} url - 请求URL
   * @param {Object} params - 查询参数
   * @returns {Promise<Object>} 请求结果
   */
  get: async (url, params = {}) => {
    try {
      // 检查网络连接
      const networkState = await notesApi.checkNetwork();
      if (!networkState.isOnline) {
        // 尝试从本地获取缓存数据
        const realm = await realmService.getRealm();
        const item = realm.objects('StorageItem').filtered(`key = "api_cache_${url}"`);
        const cachedData = item.length > 0 ? item[0].value : null;
        if (cachedData) {
          return cachedData;
        }
        throw new Error('网络连接已断开，无法获取数据');
      }

      // 发起网络请求
      const response = await apiInstance.get(url, { params });

      // 缓存GET请求结果
      const realm = await realmService.getRealm();
      realm.write(() => {
        const existingItem = realm.objects('StorageItem').filtered(`key = "api_cache_${url}"`);
        if (existingItem.length > 0) {
          existingItem[0].value = JSON.stringify(response);
          existingItem[0].updated_at = new Date();
        } else {
          realm.create('StorageItem', {
            key: `api_cache_${url}`,
            value: JSON.stringify(response),
            createdAt: new Date(),
            updated_at: new Date(),
          });
        }
      });

      return response;
    } catch (error) {
      console.error(`GET ${url} 失败:`, error);
      throw error;
    }
  },

  /**
   * 通用POST请求
   * @param {string} url - 请求URL
   * @param {Object} data - 请求数据
   * @param {Object} config - 请求配置
   * @returns {Promise<Object>} 请求结果
   */
  post: async (url, data = {}, config = {}) => {
    try {
      const networkState = await notesApi.checkNetwork();
      if (!networkState.isOnline) {
        // 离线状态下，将请求加入待同步队列
        const realm = await realmService.getRealm();
        realm.write(() => {
          realm.create('OfflineQueue', buildOfflineQueueItem('post', url, {
            url,
            data,
            config,
          }));
        });
        throw new Error('网络连接已断开，操作将在网络恢复后自动同步');
      }

      return await apiInstance.post(url, data, config);
    } catch (error) {
      console.error(`POST ${url} 失败:`, error);
      throw error;
    }
  },

  /**
   * 通用PUT请求
   * @param {string} url - 请求URL
   * @param {Object} data - 请求数据
   * @returns {Promise<Object>} 请求结果
   */
  put: async (url, data = {}) => {
    try {
      const networkState = await notesApi.checkNetwork();
      if (!networkState.isOnline) {
        // 离线状态下，将请求加入待同步队列
        const realm = await realmService.getRealm();
        realm.write(() => {
          realm.create('OfflineQueue', {
            method: 'put',
            url,
            data,
          });
        });
        throw new Error('网络连接已断开，操作将在网络恢复后自动同步');
      }

      return await apiInstance.put(url, data);
    } catch (error) {
      console.error(`PUT ${url} 失败:`, error);
      throw error;
    }
  },

  /**
   * 通用DELETE请求
   * @param {string} url - 请求URL
   * @returns {Promise<Object>} 请求结果
   */
  delete: async (url) => {
    try {
      const networkState = await notesApi.checkNetwork();
      if (!networkState.isOnline) {
        // 离线状态下，将请求加入待同步队列
        const realm = await realmService.getRealm();
        realm.write(() => {
          realm.create('OfflineQueue', {
            method: 'delete',
            url,
          });
        });
        throw new Error('网络连接已断开，操作将在网络恢复后自动同步');
      }

      return await apiInstance.delete(url);
    } catch (error) {
      console.error(`DELETE ${url} 失败:`, error);
      throw error;
    }
  },

  /**
   * 同步所有待同步的请求
   * @returns {Promise<Array>} 同步结果
   */
  syncPendingRequests: async () => {
    try {
      const networkState = await notesApi.checkNetwork();
      if (!networkState.isOnline) {
        throw new Error('无网络连接，无法同步数据');
      }

      const realm = await realmService.getRealm();
      const pendingRequests = realm.objects('OfflineQueue').filtered('status = "pending"');
      const syncResults = [];

      for (const request of pendingRequests) {
        try {
          let response;
          switch (request.method) {
            case 'post':
              response = await apiInstance.post(request.url, request.data, request.config);
              break;
            case 'put':
              response = await apiInstance.put(request.url, request.data);
              break;
            case 'delete':
              response = await apiInstance.delete(request.url);
              break;
            default:
              throw new Error(`不支持的请求方法: ${request.method}`);
          }

          // 同步成功，从队列中移除
          const realm = await realmService.getRealm();
          realm.write(() => {
            const item = realm.objects('OfflineQueue').filtered(`entity_id = "${request.id}"`);
            if (item.length > 0) {realm.delete(item[0]);}
          });
          syncResults.push({
            id: request.id,
            url: request.url,
            method: request.method,
            status: 'success',
          });
        } catch (error) {
          syncResults.push({
            id: request.id,
            url: request.url,
            method: request.method,
            status: 'failed',
            error: error.message,
          });
        }
      }

      return syncResults;
    } catch (error) {
      console.error('同步待处理请求失败:', error);
      throw error;
    }
  },

  /**
   * 文档相关API
   */
  documents: {
    /**
     * 获取文档列表
     * @param {Object} params - 查询参数
     * @returns {Promise<Object>} 文档列表
     */
    getDocuments: async (params = {}) => {
      return apiWrapper.get('/documents', params);
    },

    /**
     * 获取单个文档详情
     * @param {string} id - 文档ID
     * @returns {Promise<Object>} 文档详情
     */
    getDocument: async (id) => {
      return apiWrapper.get(`/documents/${id}`);
    },

    /**
     * 上传文档
     * @param {FormData} formData - 包含文件的FormData
     * @returns {Promise<Object>} 上传结果
     */
    uploadDocument: async (formData) => {
      return apiWrapper.post('/documents/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
    },

    /**
     * 更新文档信息
     * @param {string} id - 文档ID
     * @param {Object} data - 更新数据
     * @returns {Promise<Object>} 更新结果
     */
    updateDocument: async (id, data) => {
      return apiWrapper.put(`/documents/${id}`, data);
    },

    /**
     * 删除文档
     * @param {string} id - 文档ID
     * @returns {Promise<Object>} 删除结果
     */
    deleteDocument: async (id) => {
      return apiWrapper.delete(`/documents/${id}`);
    },

    /**
     * 下载文档
     * @param {string} id - 文档ID
     * @returns {Promise<Object>} 下载结果
     */
    downloadDocument: async (id) => {
      return apiWrapper.get(`/documents/${id}/download`, {
        responseType: 'blob',
      });
    },
  },
};


// 监听网络状态变化，自动同步数据
networkService.addNetworkListener(state => {
  if (state?.isOnline) {
    console.log('网络已连接，开始同步数据...');
    // 延迟执行，避免网络刚恢复时连接不稳定
    setTimeout(() => {
      notesApi.syncPendingRequests().catch(err => {
        console.error('自动同步请求失败:', err);
      });
    }, 3000);
  }
});

export { apiWrapper };
export default notesApi;
