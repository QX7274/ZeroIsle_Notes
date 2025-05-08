/**
 * API拦截器
 * 为了保持兼容性，导入并导出apiClient
 * @deprecated 请直接使用apiClient
 */
import apiClient from './apiClient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from '../../config';

/**
 * 为了保持兼容性，导出apiClient
 * 所有使用instance的地方都应该迁移到apiClient
 */
export default apiClient;

// 请求拦截器
apiClient.interceptors.request.use(
  async (config) => {
    try {
      // 从存储中获取token
      const token = await AsyncStorage.getItem(STORAGE_KEYS.AUTH_TOKEN);

      if (token) {
        // 添加认证头
        config.headers.Authorization = `Bearer ${token}`;
        console.log('已添加认证令牌到请求头');
      } else {
        console.warn('未找到认证令牌，请求将以未认证状态发送');
      }

      return config;
    } catch (error) {
      console.error('请求拦截器错误:', error);
      return config;
    }
  },
  (error) => {
    console.error('请求拦截器错误:', error);
    return Promise.reject(error);
  }
);