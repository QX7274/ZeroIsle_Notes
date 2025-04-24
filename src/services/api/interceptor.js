import axios from 'axios';
import { API_BASE_URL, REQUEST_TIMEOUT, HEADERS } from './config';
import { ERROR_CODES, ERROR_MESSAGES } from './config';
import { removeToken, removeUser } from '../storage';

// 创建 axios 实例
const instance = axios.create({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT,
  headers: HEADERS,
});

// 请求拦截器
instance.interceptors.request.use(
  (config) => {
    // 从本地存储获取 token
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器
instance.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    const { response } = error;
    
    if (response) {
      // 处理认证错误
      if (response.status === ERROR_CODES.AUTH_REQUIRED ||
          response.status === ERROR_CODES.INVALID_TOKEN ||
          response.status === ERROR_CODES.TOKEN_EXPIRED) {
        // 清除本地存储的 token 和用户信息
        removeToken();
        removeUser();
        // 跳转到登录页
        window.location.href = '/login';
      }
      
      // 获取错误消息
      const errorMessage = response.data?.message || 
                         ERROR_MESSAGES[response.status] || 
                         '未知错误';
      
      // 抛出错误
      throw new Error(errorMessage);
    }
    
    // 处理网络错误
    if (error.message === 'Network Error') {
      throw new Error('网络错误，请检查网络连接');
    }
    
    // 处理超时错误
    if (error.message.includes('timeout')) {
      throw new Error('请求超时，请稍后重试');
    }
    
    throw error;
  }
);

export default instance; 