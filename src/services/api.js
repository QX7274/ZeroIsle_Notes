/**
 * API服务
 * 处理与服务器的通信，包括文档上传、下载、删除等操作
 */
import axios from 'axios';
import NetInfo from '@react-native-community/netinfo';
import { Alert } from 'react-native';
import { offlineStorageService } from './offline';
import { authService } from './auth';
import { storageService } from './storage';
import * as apiService from './api/apiService';

// 创建axios实例
const apiInstance = axios.create({
  baseURL: 'https://api.zeroislenotes.com',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json'
  }
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
        authService.logout();
        Alert.alert('认证失败', '您的登录已过期，请重新登录');
      }
    }

    // 处理网络错误
    if (!response) {
      const networkState = await NetInfo.fetch();
      if (!networkState.isConnected) {
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
  delete: (url) => apiInstance.delete(url)
};

const notesApi = {
  apiWrapper,

  /**
   * 检查网络连接状态
   * @returns {Promise<Object>} 网络状态对象
   */
  checkNetwork: async () => {
    const networkState = await NetInfo.fetch();
    return {
      isConnected: networkState.isConnected,
      isInternetReachable: networkState.isInternetReachable
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
      if (!networkState.isConnected) {
        // 尝试从本地获取缓存数据
        const cachedData = await offlineStorageService.getApiCache(url);
        if (cachedData) {
          return cachedData;
        }
        throw new Error('网络连接已断开，无法获取数据');
      }

      // 发起网络请求
      const response = await apiInstance.get(url, { params });

      // 缓存GET请求结果
      await offlineStorageService.cacheApiResponse(url, response);

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
      if (!networkState.isConnected) {
        // 离线状态下，将请求加入待同步队列
        await offlineStorageService.addPendingRequest({
          method: 'post',
          url,
          data,
          config
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
      if (!networkState.isConnected) {
        // 离线状态下，将请求加入待同步队列
        await offlineStorageService.addPendingRequest({
          method: 'put',
          url,
          data
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
      if (!networkState.isConnected) {
        // 离线状态下，将请求加入待同步队列
        await offlineStorageService.addPendingRequest({
          method: 'delete',
          url
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
      if (!networkState.isConnected) {
        throw new Error('无网络连接，无法同步数据');
      }

      const pendingRequests = await storageService.getPendingRequests();
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
          await offlineStorageService.removePendingRequest(request.id);
          syncResults.push({
            id: request.id,
            url: request.url,
            method: request.method,
            status: 'success'
          });
        } catch (error) {
          syncResults.push({
            id: request.id,
            url: request.url,
            method: request.method,
            status: 'failed',
            error: error.message
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
          'Content-Type': 'multipart/form-data'
        }
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
        responseType: 'blob'
      });
    }
  }
};


// 监听网络状态变化，自动同步数据
NetInfo.addEventListener(state => {
  if (state.isConnected && state.isInternetReachable) {
    console.log('网络已连接，开始同步数据...');
    // 延迟执行，避免网络刚恢复时连接不稳定
    setTimeout(() => {
      notesApi.syncPendingRequests().catch(err => {
        console.error('自动同步请求失败:', err);
      });
    }, 3000);
  }
});

export default notesApi;