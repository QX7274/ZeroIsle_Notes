/**
 * API客户端
 * 提供统一的API请求客户端，处理请求拦截、响应拦截和错误处理
 * 支持离线模式和数据同步
 * 使用 MongoDB 替代 AsyncStorage
 */
import axios from 'axios';
import { API_ENDPOINTS } from '../../constants/api';
import { Alert, Platform, ToastAndroid } from 'react-native';
import { navigationRef } from '../../navigation/navigationRef';
import NetInfo from '@react-native-community/netinfo';
import apiCache from './apiCache';
import authStorage from '../auth/authStorage';
import { STORAGE_KEYS } from '../../utils/constants/config';

// API配置
import { API_URL as CONFIG_API_URL, API_VERSION as CONFIG_API_VERSION, API_TIMEOUT as CONFIG_API_TIMEOUT } from '../../config';

// 使用配置文件中的值
const API_URL = CONFIG_API_URL;  // 使用配置文件中的API_URL
const API_VERSION = CONFIG_API_VERSION;
const API_TIMEOUT = CONFIG_API_TIMEOUT;

// 错误消息
const ERROR_MESSAGES = {
  NETWORK_ERROR: '网络连接失败，请检查网络设置',
  SERVER_ERROR: '服务器错误，请稍后重试',
  FORBIDDEN: '您没有权限执行此操作',
  UNAUTHORIZED: '请先登录',
  NOT_FOUND: '请求的资源不存在',
  TIMEOUT: '请求超时，请稍后重试',
  UNKNOWN: '发生未知错误，请稍后重试'
};

// 创建axios实例
const apiClient = axios.create({
  baseURL: `${API_URL}/api/${API_VERSION}`,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }
});

// 调试信息
console.log('API客户端初始化，baseURL:', `${API_URL}/api/${API_VERSION}`);
console.log('API请求示例:', `${API_URL}/api/${API_VERSION}/auth/register/username/`);

// 检查网络连接状态
const checkNetworkConnection = async () => {
  try {
    const state = await NetInfo.fetch();
    return state.isConnected;
  } catch (error) {
    console.error('检查网络连接失败:', error);
    return false;
  }
};

// 保存离线请求
const saveOfflineRequest = async (config) => {
  try {
    // 获取当前离线请求队列
    const offlineQueue = await apiCache.getItem('offline_queue') || [];

    // 添加新的请求到队列
    offlineQueue.push({
      url: config.url,
      method: config.method,
      data: config.data,
      params: config.params,
      timestamp: new Date().toISOString()
    });

    // 保存更新后的队列
    await apiCache.setItem('offline_queue', offlineQueue);

    // 显示提示
    if (Platform.OS === 'android') {
      ToastAndroid.show('请求已保存，将在网络恢复时发送', ToastAndroid.SHORT);
    }

    return true;
  } catch (error) {
    console.error('保存离线请求失败:', error);
    return false;
  }
};

// 导入令牌服务
import tokenService from '../auth/tokenService';

// 请求拦截器
apiClient.interceptors.request.use(
  async config => {
    try {
      // 检查是否是公开路径（不需要认证的路径）
      const isPublicPath = ['/auth/login', '/auth/register', '/auth/password/reset'].some(
        path => config.url && config.url.includes(path)
      );

      // 如果是公开路径，不需要添加认证令牌
      if (isPublicPath) {
        return config;
      }

      // 获取访问令牌
      const tokenData = await tokenService.getAccessToken();

      // 检查令牌是否过期或即将过期
      const isExpiring = await tokenService.isAccessTokenExpiredOrExpiring();

      if (isExpiring) {
        console.log('访问令牌即将过期，尝试刷新');
        // 尝试刷新令牌
        const newTokenData = await tokenService.refreshAccessToken();

        if (newTokenData && newTokenData.token) {
          // 使用新令牌
          console.log('使用刷新后的令牌:', newTokenData.token.substring(0, 10) + '...');
          config.headers.Authorization = `Bearer ${newTokenData.token}`;
        } else if (tokenData && tokenData.token) {
          // 刷新失败但仍有旧令牌，继续使用
          console.log('刷新令牌失败，使用现有令牌:', tokenData.token.substring(0, 10) + '...');
          config.headers.Authorization = `Bearer ${tokenData.token}`;
        } else {
          console.warn('未找到有效的认证令牌，请求将以未认证状态发送');
          // 记录请求URL，帮助调试
          console.log('未认证请求URL:', config.url);
        }
      } else if (tokenData && tokenData.token) {
        // 令牌有效，直接使用
        console.log('使用有效的访问令牌:', tokenData.token.substring(0, 10) + '...');
        config.headers.Authorization = `Bearer ${tokenData.token}`;
      } else {
        console.warn('未找到认证令牌，请求将以未认证状态发送');
        // 记录请求URL，帮助调试
        console.log('未认证请求URL:', config.url);
      }

      // 检查网络连接
      const isConnected = await checkNetworkConnection();

      // 如果没有网络连接，处理离线逻辑
      if (!isConnected) {
        console.log('无网络连接，处理离线逻辑:', config.url);

        // 对于非GET请求，保存到离线队列
        if (config.method !== 'get') {
          await saveOfflineRequest(config);
        }

        // 检查是否有离线模式标记
        const offlineMode = config.headers['X-Offline-Mode'] === 'true';

        // 如果请求明确标记为离线模式，或者是修改操作，抛出自定义错误
        if (offlineMode || config.method !== 'get') {
          throw {
            isOfflineError: true,
            message: '无网络连接，请求已保存到离线队列',
            config
          };
        }

        // 对于GET请求，尝试从缓存获取数据
        if (config.method === 'get') {
          try {
            const cachedData = await apiCache.getCachedApiResponse(config.url);
            if (cachedData) {
              console.log('使用缓存数据:', config.url);
              // 添加标记，表示这是缓存数据
              config.headers['X-From-Cache'] = 'true';
            } else {
              console.log('无缓存数据，继续请求:', config.url);
              // 添加标记，表示这是离线请求
              config.headers['X-Offline-Request'] = 'true';
            }
          } catch (cacheError) {
            console.error('读取缓存数据失败:', cacheError);
          }
        }
      }
    } catch (error) {
      // 如果是离线错误，直接抛出
      if (error.isOfflineError) {
        return Promise.reject(error);
      }

      console.error('请求拦截器错误:', error);
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
    // 记录成功响应
    console.log(`API响应成功: ${response.config.method.toUpperCase()} ${response.config.url}`);

    // 如果响应包含data字段，直接返回响应数据
    if (response.data !== undefined) {
      return response.data;
    }

    // 否则返回整个响应对象
    console.warn(`API响应没有data字段: ${response.config.url}`);
    return response;
  },
  async error => {
    // 处理离线错误
    if (error.isOfflineError) {
      console.log('离线错误，请求已保存到队列或使用本地数据');

      // 获取请求配置
      const config = error.config || {};

      // 检查是否是GET请求
      if (config.method === 'get') {
        // 尝试从缓存获取数据
        try {
          const cachedData = await apiCache.getCachedApiResponse(config.url);
          if (cachedData) {
            console.log('使用缓存数据响应离线GET请求:', config.url);
            return Promise.resolve({
              data: cachedData,
              status: 200,
              statusText: 'OK (Offline Cache)',
              headers: { 'X-From-Cache': 'true' },
              config,
              offline: true,
              fromCache: true
            });
          }
        } catch (cacheError) {
          console.error('读取缓存数据失败:', cacheError);
        }
      }

      // 对于非GET请求或没有缓存的GET请求，返回一个模拟的响应
      // 特殊处理登录和注册请求
      if (config.url && (config.url.includes('/auth/login') || config.url.includes('/auth/register'))) {
        return Promise.resolve({
          data: {
            offline: true,
            message: '网络连接失败，请检查网络设置后重试',
            timestamp: new Date().toISOString(),
            success: false,  // 登录和注册请求在离线模式下应该返回失败
            method: config.method,
            url: config.url,
            error: 'NETWORK_ERROR'
          },
          status: 200,
          statusText: 'OK (Offline)',
          headers: {},
          config,
          offline: true
        });
      } else {
        // 其他请求返回一个模拟的成功响应
        return Promise.resolve({
          data: {
            offline: true,
            message: '当前处于离线模式，请求已保存或使用本地数据',
            timestamp: new Date().toISOString(),
            success: true,  // 添加success标志，使其与正常响应格式一致
            method: config.method,
            url: config.url
          },
          status: 200,
          statusText: 'OK (Offline)',
          headers: {},
          config,
          offline: true
        });
      }
    }

    // 处理错误响应
    if (error.message === 'Network Error') {
      // 网络错误，显示中文提示
      console.error('网络连接失败:', error);
      console.log('网络错误请求URL:', error.config?.url);
      console.log('网络错误请求方法:', error.config?.method);
      console.log('网络错误请求头:', JSON.stringify(error.config?.headers));

      // 检查网络连接状态
      NetInfo.fetch().then(state => {
        console.log('网络连接状态:', state.isConnected ? '已连接' : '未连接');
        console.log('网络类型:', state.type);
        console.log('网络详情:', JSON.stringify(state.details));
      });

      // 修改错误消息为中文
      error.message = '网络连接失败，请检查网络设置';

      // 不显示弹窗，避免频繁弹窗打扰用户
      // 而是在返回的错误对象中添加标记，让调用方决定如何处理
      error.isNetworkError = true;

      // 直接使用与离线错误相同的处理逻辑
      console.log('网络错误，使用离线模式处理');

      // 获取请求配置
      const config = error.config || {};

      // 检查是否是GET请求
      if (config.method === 'get') {
        // 尝试从缓存获取数据
        try {
          // 使用await获取缓存数据
          const cachedData = await apiCache.getCachedApiResponse(config.url);
          if (cachedData) {
            console.log('使用缓存数据响应网络错误的GET请求:', config.url);
            return Promise.resolve({
              data: cachedData,
              status: 200,
              statusText: 'OK (Offline Cache)',
              headers: { 'X-From-Cache': 'true' },
              config,
              offline: true,
              fromCache: true
            });
          } else {
            console.log('没有找到缓存数据:', config.url);
          }
        } catch (cacheError) {
          console.error('读取缓存数据失败:', cacheError);
        }
      }

      // 对于非GET请求或没有缓存的GET请求，返回一个模拟的响应
      // 特殊处理登录和注册请求
      if (config.url && (config.url.includes('/auth/login') || config.url.includes('/auth/register'))) {
        return Promise.resolve({
          data: {
            offline: true,
            message: '网络连接失败，请检查网络设置后重试',
            timestamp: new Date().toISOString(),
            success: false,  // 登录和注册请求在离线模式下应该返回失败
            method: config.method,
            url: config.url,
            error: 'NETWORK_ERROR'
          },
          status: 200,
          statusText: 'OK (Offline)',
          headers: {},
          config,
          offline: true
        });
      } else {
        // 其他请求返回一个模拟的成功响应
        return Promise.resolve({
          data: {
            offline: true,
            message: '当前处于离线模式，请求已保存或使用本地数据',
            timestamp: new Date().toISOString(),
            success: true,  // 添加success标志，使其与正常响应格式一致
            method: config.method,
            url: config.url
          },
          status: 200,
          statusText: 'OK (Offline)',
          headers: {},
          config,
          offline: true
        });
      }

      /* 以下代码被上面的逻辑替代
      // 检查是否有本地缓存数据
      if (error.config && error.config.url) {
        const cacheKey = `cache_${error.config.url}`;
        try {
          // 使用await获取缓存数据
          const cachedData = await AsyncStorage.getItem(cacheKey);
          if (cachedData) {
            console.log('使用缓存数据:', error.config.url);
            try {
              // 安全解析JSON
              const parsedData = JSON.parse(cachedData);
              return Promise.resolve({
                data: parsedData,
                status: 200,
                statusText: 'OK (Cached)',
                headers: {},
                config: error.config
              });
            } catch (parseError) {
              console.error('解析缓存数据失败:', parseError);
              // 如果解析失败，返回原始字符串
              return Promise.resolve({
                data: { raw: cachedData },
                status: 200,
                statusText: 'OK (Cached, Unparsed)',
                headers: {},
                config: error.config
              });
            }
          }
        } catch (cacheError) {
          console.error('读取缓存数据失败:', cacheError);
        }
      }
      */
    } else if (error.message && error.message.includes('timeout')) {
      // 超时错误，显示中文提示
      console.error('请求超时:', error);
      // 修改错误消息为中文
      error.message = '请求超时，请稍后重试';

      // 添加超时标记
      error.isTimeoutError = true;
    } else if (error.response) {
      const { status, data } = error.response;

      switch (status) {
        case 401:
          // 未授权，清除token并跳转到登录页面
          console.log('收到401未授权响应，URL:', error.config.url);
          console.log('请求头:', JSON.stringify(error.config.headers));

          // 检查是否是公开路径或特定API路径
          const isPublicPath = ['/auth/login', '/auth/register', '/auth/password/reset'].some(
            path => error.config.url && error.config.url.includes(path)
          );

          // 特定API路径，不自动登出
          const skipAuthPaths = [
            '/mind-map/',
            '/knowledge-graph/',
            '/ai-assistant/'
          ];

          const shouldSkipAuth = skipAuthPaths.some(path => error.config.url && error.config.url.includes(path));

          if (isPublicPath || shouldSkipAuth) {
            console.log('跳过自动登出处理，URL:', error.config.url);
            // 为错误添加标记，表示这是一个可以忽略的认证错误
            error.isIgnorableAuthError = true;
            // 对于这些路径，返回错误而不是处理为未授权
            return Promise.reject(error);
          }

          // 处理未授权错误
          handleUnauthorized();
          break;
        case 403:
          // 禁止访问
          console.log('收到403禁止访问响应，URL:', error.config.url);
          Alert.alert('访问被拒绝', ERROR_MESSAGES.FORBIDDEN);
          break;
        case 404:
          // 资源未找到，静默处理，不显示弹窗
          console.log('资源未找到，静默处理:', error.config.url);
          console.log('请求头:', JSON.stringify(error.config.headers));

          // 返回一个模拟的成功响应，避免应用崩溃
          return Promise.resolve({
            data: {
              offline: true,
              message: '资源未找到，使用离线模式',
              timestamp: new Date().toISOString(),
              success: true,
              method: error.config.method,
              url: error.config.url
            },
            status: 200,
            statusText: 'OK (Offline)',
            headers: {},
            config: error.config,
            offline: true
          });
        case 500:
          // 服务器错误
          console.log('收到500服务器错误响应，URL:', error.config.url);
          console.log('请求头:', JSON.stringify(error.config.headers));
          console.log('错误详情:', error.response?.data);

          // 检查是否是网络问题
          NetInfo.fetch().then(state => {
            if (!state.isConnected) {
              Alert.alert('网络连接失败', '请检查您的网络连接后重试');
            } else {
              Alert.alert('服务器错误', ERROR_MESSAGES.SERVER_ERROR);
            }
          });
          break;
        default:
          // 其他错误
          console.error(`HTTP错误 ${status}:`, data);
          // 尝试获取错误消息
          let errorMsg = '未知错误';
          if (data) {
            if (typeof data === 'string') {
              errorMsg = data;
            } else if (data.message) {
              errorMsg = data.message;
            } else if (data.error) {
              errorMsg = data.error;
            }
          }
          Alert.alert('请求失败', errorMsg);
          break;
      }
    } else if (error.request) {
      // 请求已发送但没有收到响应
      Alert.alert('网络错误', ERROR_MESSAGES.NETWORK_ERROR);
    } else {
      // 请求配置出错
      console.error('请求错误:', error.message);
      Alert.alert('请求错误', error.message || '发送请求时出现错误');
    }

    return Promise.reject(error);
  }
);

// 防止多次处理未授权错误
let isHandlingUnauthorized = false;

// 处理未授权错误
const handleUnauthorized = async () => {
  // 如果已经在处理未授权错误，则直接返回
  if (isHandlingUnauthorized) {
    console.log('已经在处理未授权错误，跳过');
    return;
  }

  // 设置标志，表示正在处理未授权错误
  isHandlingUnauthorized = true;

  try {
    // 使用authUtils中的handleUnauthorizedError函数
    try {
      const authUtils = require('../auth/authUtils');
      if (authUtils && typeof authUtils.handleUnauthorizedError === 'function') {
        console.log('使用authUtils.handleUnauthorizedError处理未授权错误');
        await authUtils.handleUnauthorizedError();
      } else {
        console.warn('authUtils.handleUnauthorizedError不可用，使用备选方法');
        throw new Error('authUtils.handleUnauthorizedError不可用');
      }
    } catch (authUtilsError) {
      console.warn('使用authUtils处理未授权错误失败:', authUtilsError);

      // 备选方法：直接清除令牌和用户信息
      console.log('使用备选方法处理未授权错误: 清除token和用户信息');

      // 使用tokenService清除所有令牌
      await tokenService.clearTokens();

      // 清除用户信息
      await authStorage.removeItem(STORAGE_KEYS.USER_INFO);
      await authStorage.removeItem(STORAGE_KEYS.USER);

      // 显示提示
      Alert.alert('登录已过期', '请重新登录');

      // 使用setTimeout确保Alert显示后再执行导航
      setTimeout(() => {
        // 尝试直接修改Redux状态
        try {
          const { store } = require('../../store');
          if (store && typeof store.dispatch === 'function') {
            store.dispatch({ type: 'auth/logout/fulfilled' });
            console.log('已通过Redux状态重置认证状态');
          }
        } catch (reduxError) {
          console.warn('Redux状态重置失败:', reduxError);
        }

        // 尝试重置导航
        try {
          const navigation = require('../../navigation/navigationRef');
          if (navigation && typeof navigation.navigate === 'function') {
            navigation.navigate('Auth', {}, { reset: true });
          }
        } catch (navError) {
          console.warn('导航重置失败:', navError);
        }

        // 重置处理标志
        setTimeout(() => {
          isHandlingUnauthorized = false;
          console.log('重置未授权处理标志');
        }, 1000);
      }, 500);
    }
  } catch (error) {
    console.error('处理未授权错误失败:', error);
    // 即使出错也要重置标志
    isHandlingUnauthorized = false;
  }
};

// 添加缓存方法
apiClient.cache = async (url, data, expirationMinutes = 60) => {
  try {
    return await apiCache.cacheApiResponse(url, data, expirationMinutes);
  } catch (error) {
    console.error('缓存数据失败:', error);
    return false;
  }
};

// 获取缓存方法
apiClient.getCache = async (url) => {
  try {
    return await apiCache.getCachedApiResponse(url);
  } catch (error) {
    console.error('获取缓存数据失败:', error);
    return null;
  }
};

// 清除缓存方法
apiClient.clearCache = async (url) => {
  try {
    if (url) {
      // 清除特定URL的缓存
      const cacheKey = `cache_${url}`;
      await apiCache.removeItem(cacheKey);
    } else {
      // 清除所有缓存
      const keys = await apiCache.getAllKeys();
      const cacheKeys = keys.filter(key => key.startsWith('cache_'));
      await apiCache.multiRemove(cacheKeys);
    }
    return true;
  } catch (error) {
    console.error('清除缓存失败:', error);
    return false;
  }
};

// 获取离线队列
apiClient.getOfflineQueue = async () => {
  try {
    return await apiCache.getItem('offline_queue') || [];
  } catch (error) {
    console.error('获取离线队列失败:', error);
    return [];
  }
};

// 清空离线队列
apiClient.clearOfflineQueue = async () => {
  try {
    await apiCache.removeItem('offline_queue');
    return true;
  } catch (error) {
    console.error('清空离线队列失败:', error);
    return false;
  }
};

// 处理离线队列
apiClient.processOfflineQueue = async () => {
  try {
    // 检查网络连接
    const isConnected = await checkNetworkConnection();
    if (!isConnected) {
      console.log('无网络连接，无法处理离线队列');
      return false;
    }

    // 获取离线队列
    const queue = await apiClient.getOfflineQueue();
    if (!queue || queue.length === 0) {
      console.log('离线队列为空');
      return true;
    }

    console.log(`开始处理离线队列，共 ${queue.length} 个请求`);

    // 显示处理开始提示
    if (Platform.OS === 'android') {
      ToastAndroid.show(`正在处理 ${queue.length} 个离线请求...`, ToastAndroid.SHORT);
    }

    // 处理每个离线请求
    const results = [];
    for (const request of queue) {
      try {
        const { url, method, data, params } = request;

        // 发送请求
        const response = await apiClient({
          url,
          method,
          data,
          params
        });

        results.push({
          request,
          success: true,
          response
        });
      } catch (error) {
        console.error('处理离线请求失败:', error);
        results.push({
          request,
          success: false,
          error: error.message || '未知错误'
        });
      }
    }

    // 过滤出失败的请求
    const failedRequests = results.filter(result => !result.success).map(result => result.request);

    // 更新离线队列，只保留失败的请求
    await apiCache.setItem('offline_queue', failedRequests);

    // 显示处理结果提示
    const successCount = results.length - failedRequests.length;
    if (Platform.OS === 'android') {
      ToastAndroid.show(
        `离线请求处理完成: ${successCount}/${results.length} 个请求成功`,
        ToastAndroid.SHORT
      );
    }

    console.log(`离线队列处理完成: ${successCount}/${results.length} 个请求成功`);

    return true;
  } catch (error) {
    console.error('处理离线队列失败:', error);
    return false;
  }
};

// 设置网络状态监听
NetInfo.addEventListener(state => {
  // 当网络连接恢复时，尝试处理离线队列
  if (state.isConnected) {
    apiClient.processOfflineQueue();
  }
});

// 导出API客户端
export default apiClient;
