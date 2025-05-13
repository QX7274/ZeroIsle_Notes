/**
 * API配置文件
 * 提供axios实例和API配置
 */
import axios from 'axios';
import { realmStorageService } from './storage/realmStorageService';
import { API_BASE_URL, REQUEST_TIMEOUT } from '../config/api';

// 创建axios实例
export const axiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: REQUEST_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }
});

// 请求拦截器
axiosInstance.interceptors.request.use(
  async config => {
    try {
      const token = await realmStorageService.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('获取token失败:', error);
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

// 响应拦截器
axiosInstance.interceptors.response.use(
  response => {
    // 直接返回响应数据
    return response.data;
  },
  error => {
    // 处理错误响应
    if (error.message === 'Network Error') {
      // 网络错误，使用中文错误消息
      console.error('网络连接失败，请检查网络设置');
      // 修改错误消息为中文
      error.message = '网络连接失败，请检查网络设置';
    } else if (error.message && error.message.includes('timeout')) {
      // 超时错误，使用中文错误消息
      console.error('请求超时，请稍后重试');
      // 修改错误消息为中文
      error.message = '请求超时，请稍后重试';
    } else if (error.response) {
      const { status, data } = error.response;
      console.error(`API错误 ${status}:`, data);
    } else if (error.request) {
      // 请求已发送但没有收到响应
      console.error('网络错误，请检查网络连接');
    } else {
      // 请求配置出错
      console.error('请求错误:', error.message);
    }

    return Promise.reject(error);
  }
);

export default {
  axiosInstance,
  API_BASE_URL
};
