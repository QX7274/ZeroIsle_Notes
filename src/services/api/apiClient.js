/**
 * API客户端
 * 提供统一的API请求客户端，处理请求拦截、响应拦截和错误处理
 */
import axios from 'axios';
import { API_URL, API_TIMEOUT, ERROR_MESSAGES } from '../../config/index';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Alert } from 'react-native';
import { navigate } from '../../navigation/navigationRef';

// 创建axios实例
const apiClient = axios.create({
  baseURL: API_URL,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }
});

// 请求拦截器
apiClient.interceptors.request.use(
  async config => {
    try {
      const token = await AsyncStorage.getItem('token');
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
apiClient.interceptors.response.use(
  response => {
    // 直接返回响应数据
    return response.data;
  },
  error => {
    // 处理错误响应
    if (error.response) {
      const { status, data } = error.response;
      
      switch (status) {
        case 401:
          // 未授权，清除token并跳转到登录页面
          handleUnauthorized();
          break;
        case 403:
          // 禁止访问
          Alert.alert('访问被拒绝', ERROR_MESSAGES.FORBIDDEN);
          break;
        case 404:
          // 资源未找到
          console.error('资源未找到:', error.config.url);
          break;
        case 500:
          // 服务器错误
          Alert.alert('服务器错误', ERROR_MESSAGES.SERVER_ERROR);
          break;
        default:
          // 其他错误
          console.error(`HTTP错误 ${status}:`, data);
          break;
      }
    } else if (error.request) {
      // 请求已发送但没有收到响应
      Alert.alert('网络错误', ERROR_MESSAGES.NETWORK_ERROR);
    } else {
      // 请求配置出错
      console.error('请求错误:', error.message);
    }
    
    return Promise.reject(error);
  }
);

// 处理未授权错误
const handleUnauthorized = async () => {
  try {
    // 清除token和用户信息
    await AsyncStorage.removeItem('token');
    await AsyncStorage.removeItem('user');
    
    // 跳转到登录页面
    navigate('Login');
    
    // 显示提示
    Alert.alert('登录已过期', '请重新登录');
  } catch (error) {
    console.error('处理未授权错误失败:', error);
  }
};

// 导出API客户端
export default apiClient;
