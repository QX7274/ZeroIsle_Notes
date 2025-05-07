/**
 * API服务
 * 处理API请求和错误
 */
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_URL, API_VERSION, API_TIMEOUT, STORAGE_KEYS } from '../../config';
import { handleUnauthorizedError } from '../auth/authUtils';

// 创建axios实例
const api = axios.create({
  baseURL: `${API_URL}/${API_VERSION}`,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// 请求拦截器
api.interceptors.request.use(
  async (config) => {
    // 从AsyncStorage获取token
    const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN) || 
                  await AsyncStorage.getItem(STORAGE_KEYS.TOKEN);
    
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
    // 处理错误
    if (error.response) {
      const { status, data } = error.response;
      
      // 处理401未授权错误
      if (status === 401) {
        console.log('API响应401未授权错误');
        await handleUnauthorizedError();
      }
      
      // 处理404资源未找到错误
      if (status === 404) {
        console.error('资源未找到:', error.config.url);
      }
      
      // 处理500服务器错误
      if (status >= 500) {
        console.error('服务器错误:', data);
      }
    } else if (error.request) {
      // 请求已发送但没有收到响应
      console.error('未收到API响应:', error.request);
    } else {
      // 请求配置错误
      console.error('API请求配置错误:', error.message);
    }
    
    return Promise.reject(error);
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
