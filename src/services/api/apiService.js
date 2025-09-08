/**
 * API服务
 * 处理API请求和错误
 */
import axios from 'axios';
import { realmStorageService } from '../storage/realmStorageService';
import { API_URL, API_VERSION, API_TIMEOUT, STORAGE_KEYS } from '../../config';
import { handleUnauthorizedError } from '../auth/authUtils';
import { handleNetworkError } from '../../utils/networkErrorHandler';

// 创建axios实例
const api = axios.create({
  baseURL: `${API_URL}/api/${API_VERSION}`,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// 调试信息
console.log('API服务baseURL:', `${API_URL}/api/${API_VERSION}`);

// 请求拦截器
api.interceptors.request.use(
  async (config) => {
    // 从存储服务获取token
    const token = await realmStorageService.getItem(STORAGE_KEYS.AUTH_TOKEN) ||
                  await realmStorageService.getItem(STORAGE_KEYS.TOKEN);

    // 如果有token，添加到请求头
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    return config;
  },
  (error) => {
    console.error('API请求拦截器错误:', error);
    return Promise.reject(error);
  }
);

// 响应拦截器
api.interceptors.response.use(
  (response) => {
    return response;
  },
  async (error) => {
    // 记录详细的开发者日志
    const context = `API请求: ${error.config?.method?.toUpperCase()} ${error.config?.url}`;

    // 处理特殊的401错误
    if (error.response?.status === 401) {
      console.log('🔐 API响应401未授权错误');
      await handleUnauthorizedError();
    }

    // 使用统一的网络错误处理器
    const errorResult = handleNetworkError(error, {
      context,
      showAlert: false, // 不在这里显示弹窗，由调用方决定
      logError: true
    });

    // 返回包含用户友好信息的错误
    const enhancedError = {
      ...error,
      userMessage: errorResult.userMessage,
      errorType: errorResult.type,
      isNetworkError: true
    };

    return Promise.reject(enhancedError);
  }
);

/**
 * 发送GET请求
 * @param {string} url - 请求URL
 * @param {object} params - 请求参数
 * @param {object} config - 请求配置
 * @returns {Promise} - 请求响应
 */
export const get = async (url, params = {}, config = {}) => {
  try {
    const response = await api.get(url, { params, ...config });
    return response.data;
  } catch (error) {
    console.error(`GET请求失败: ${url}`, error);
    throw error;
  }
};

/**
 * 发送POST请求
 * @param {string} url - 请求URL
 * @param {object} data - 请求数据
 * @param {object} config - 请求配置
 * @returns {Promise} - 请求响应
 */
export const post = async (url, data = {}, config = {}) => {
  try {
    const response = await api.post(url, data, config);
    return response.data;
  } catch (error) {
    console.error(`POST请求失败: ${url}`, error);
    throw error;
  }
};

/**
 * 发送PUT请求
 * @param {string} url - 请求URL
 * @param {object} data - 请求数据
 * @param {object} config - 请求配置
 * @returns {Promise} - 请求响应
 */
export const put = async (url, data = {}, config = {}) => {
  try {
    const response = await api.put(url, data, config);
    return response.data;
  } catch (error) {
    console.error(`PUT请求失败: ${url}`, error);
    throw error;
  }
};

/**
 * 发送DELETE请求
 * @param {string} url - 请求URL
 * @param {object} config - 请求配置
 * @returns {Promise} - 请求响应
 */
export const del = async (url, config = {}) => {
  try {
    const response = await api.delete(url, config);
    return response.data;
  } catch (error) {
    console.error(`DELETE请求失败: ${url}`, error);
    throw error;
  }
};

export default {
  get,
  post,
  put,
  delete: del,
  api,
};
