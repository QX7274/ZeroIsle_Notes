import axios from 'axios';
import { API_BASE_URL, REQUEST_TIMEOUT, ERROR_CODES, ERROR_MESSAGES } from '../../config/api';
import { getToken, removeToken, removeUser } from '../storage';
import { Alert } from 'react-native';
import { navigate } from '../../navigation/navigationRef';

// 默认请求头
const HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
};

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
    const token = getToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // 添加时间戳防止缓存（仅对GET请求）
    if (config.method === 'get') {
      config.params = {
        ...config.params,
        _t: Date.now()
      };
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

        // 显示提示
        Alert.alert(
          '登录已过期',
          '您的登录已过期，请重新登录',
          [
            {
              text: '确定',
              onPress: () => {
                // 跳转到登录页
                navigate('Auth', { screen: 'Login' });
              }
            }
          ]
        );
      }

      // 获取错误消息
      const errorMessage = response.data?.message ||
                         response.data?.detail ||
                         ERROR_MESSAGES[response.status] ||
                         '未知错误';

      // 创建包含更多信息的错误对象
      const enhancedError = new Error(errorMessage);
      enhancedError.status = response.status;
      enhancedError.data = response.data;
      enhancedError.config = response.config;

      return Promise.reject(enhancedError);
    }

    // 处理网络错误
    if (error.message === 'Network Error') {
      const networkError = new Error('网络错误，请检查网络连接');
      networkError.isNetworkError = true;
      return Promise.reject(networkError);
    }

    // 处理超时错误
    if (error.message.includes('timeout')) {
      const timeoutError = new Error('请求超时，请稍后重试');
      timeoutError.isTimeoutError = true;
      return Promise.reject(timeoutError);
    }

    return Promise.reject(error);
  }
);

export default instance;