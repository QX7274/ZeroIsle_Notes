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

import apiCache from './apiCache';
import authStorage from '../auth/authStorage';
import realmService from '../database/realmService';
import { STORAGE_KEYS } from '../../utils/constants/config';
import networkErrorService from '../networkErrorService';
import networkService from '../network/networkService';
import tokenService from '../auth/tokenService';
import { handleUnauthorizedError } from '../auth/authUtils';

// API配置
import { API_URL as CONFIG_API_URL, API_VERSION as CONFIG_API_VERSION, API_TIMEOUT as CONFIG_API_TIMEOUT } from '../../config';

// 使用配置文件中的值
const API_URL = CONFIG_API_URL;  // 使用配置文件中的API_URL
const API_VERSION = CONFIG_API_VERSION;
const API_TIMEOUT = CONFIG_API_TIMEOUT;
const DEV_SKIP_LOGIN = __DEV__;

// 错误消息
const ERROR_MESSAGES = {
  NETWORK_ERROR: '网络连接失败，请检查网络设置',
  SERVER_ERROR: '服务器错误，请稍后重试',
  FORBIDDEN: '您没有权限执行此操作',
  UNAUTHORIZED: '请先登录',
  NOT_FOUND: '请求的资源不存在',
  TIMEOUT: '请求超时，请稍后重试',
  UNKNOWN: '发生未知错误，请稍后重试',
};

// 创建axios实例
const apiClient = axios.create({
  baseURL: `${API_URL}/api/${API_VERSION}`,
  timeout: API_TIMEOUT,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// 调试信息
console.log('API客户端初始化，baseURL:', `${API_URL}/api/${API_VERSION}`);
console.log('API请求示例:', `${API_URL}/api/${API_VERSION}/auth/register/username/`);

// 检查网络连接状态
const checkNetworkConnection = async () => {
  try {
    const state = await networkService.checkConnection();
    return Boolean(state);
  } catch (error) {
    console.error('检查网络连接失败:', error);
    throw error;
  }
};

// 保存离线请求
const saveOfflineRequest = async (config) => {
  try {
    // 获取当前离线请求队列
    const item = await authStorage.getItem('offline_queue');
    const offlineQueue = item ? JSON.parse(item) : [];

    // 添加新的请求到队列
    offlineQueue.push({
      url: config.url,
      method: config.method,
      data: config.data,
      params: config.params,
      timestamp: new Date().toISOString(),
    });

    // 保存更新后的队列
    await authStorage.setItem('offline_queue', JSON.stringify(offlineQueue));

    // 显示提示
    if (Platform.OS === 'android') {
      ToastAndroid.show('请求已保存，将在网络恢复时发送', ToastAndroid.SHORT);
    }

    return true;
  } catch (error) {
    console.error('保存离线请求失败:', error);
    throw error;
  }
};



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

      // 获取访问令牌 (兼容新旧格式)
      const tokenData = await tokenService.getAccessToken();
      const accessToken = typeof tokenData === 'string' ? tokenData : tokenData?.token;

      // 检查令牌是否过期或即将过期
      const isExpiring = await tokenService.isAccessTokenExpiredOrExpiring();

      if (isExpiring) {
        console.log('访问令牌即将过期，尝试刷新');
        const newTokenData = await tokenService.refreshAccessToken();
        const newAccessToken = typeof newTokenData === 'string' ? newTokenData : newTokenData?.token;

        if (newAccessToken) {
          // 刷新成功，使用新令牌
          config.headers.Authorization = `Bearer ${newAccessToken}`;
        } else {
          // 刷新失败：开发调试模式下不抛阻断错误，避免 LogBox 中断页面联调
          if (DEV_SKIP_LOGIN) {
            console.log('DEV_SKIP_LOGIN: 刷新令牌失败，继续以未认证状态请求:', config.url);
            return config;
          }

          // 非开发调试模式维持原行为
          console.warn('刷新令牌失败，将强制用户登出');
          await handleUnauthorizedError();
          return Promise.reject(new Error('Token refresh failed. User logged out.'));
        }
      } else if (accessToken) {
        // 令牌有效，直接使用
        config.headers.Authorization = `Bearer ${accessToken}`;
      } else {
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
            config,
          };
        }

        // 对于GET请求，尝试从缓存获取数据
        const cachedData = await getCachedData(config.url);
        if (cachedData) {
          console.log('使用缓存数据:', config.url);
          return {
            data: cachedData,
            status: 200,
            statusText: 'OK (Cached)',
            headers: {},
            config,
          };
        }
      }

      return config;
    } catch (error) {
      console.error('请求拦截器错误:', error);
      return Promise.reject(error);
    }
  },
  error => {
    console.error('请求拦截器错误:', error);
    return Promise.reject(error);
  }
);

// 响应拦截器
apiClient.interceptors.response.use(
  response => {
    // 记录成功响应
    console.log(`API响应成功: ${response.config.method.toUpperCase()} ${response.config.url}`);

    // 处理统一的API响应格式 {code, message, data}
    if (response.data && typeof response.data === 'object') {
      const { code, message, data } = response.data;

      // 如果响应包含code字段，说明是新的统一格式
      if (code !== undefined) {
        if (code === 0) {
          // 成功响应：将 axios 的 response.data 替换为后端 data，保持上层兼容
          response.data = data;
          return response;
        } else {
          // 错误响应
          console.error(`API错误 (${code}): ${message}`);
          const error = new Error(message);
          error.code = code;
          error.response = response;
          throw error;
        }
      }
    }

    // 如果响应包含data字段，直接返回响应数据
    if (response.data !== undefined) {
      return response.data;
    }

    // 否则返回整个响应对象
    console.warn(`API响应没有data字段: ${response.config.url}`);
    return response;
  },
  async error => {
    const suppressGlobalErrorUI = Boolean(error?.config?.metadata?.suppressGlobalErrorUI);
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
              fromCache: true,
            });
          }
        } catch (cacheError) {
          console.error('读取缓存数据失败:', cacheError);
        }
      }

      // 对于非GET请求或没有缓存的GET请求，直接返回明确错误，禁止伪成功响应
      const offlineError = new Error('离线状态下无法完成请求，且未命中缓存');
      offlineError.isOfflineError = true;
      offlineError.offline = true;
      offlineError.config = config;
      return Promise.reject(offlineError);
    }

    // 处理错误响应
    if (error.message === 'Network Error') {
      // 网络错误，显示中文提示
      console.error('网络连接失败:', error);
      console.log('网络错误请求URL:', error.config?.url);
      console.log('网络错误请求方法:', error.config?.method);
      console.log('网络错误请求头:', JSON.stringify(error.config?.headers));

      // 检查网络连接状态
      networkService.checkConnection().then(isOnline => {
        console.log('网络连接状态:', isOnline ? '已连接' : '未连接');
      });

      // 修改错误消息为中文
      error.message = '网络连接失败，请检查网络设置';

      // 标记为网络错误
      error.isNetworkError = true;

      // 调用networkErrorService显示网络错误弹窗
      networkErrorService.handleApiError(error, {
        context: 'API请求',
        customMessage: '网络连接失败，请检查网络设置后重试',
        suppressGlobalUI: suppressGlobalErrorUI,
      });

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
              fromCache: true,
            });
          } else {
            console.log('没有找到缓存数据:', config.url);
          }
        } catch (cacheError) {
          console.error('读取缓存数据失败:', cacheError);
        }
      }

      // 对于非GET请求或没有缓存的GET请求，直接返回明确错误，禁止伪成功响应
      const offlineNetworkError = new Error('网络错误且无缓存，无法完成请求');
      offlineNetworkError.isNetworkError = true;
      offlineNetworkError.isOfflineError = true;
      offlineNetworkError.offline = true;
      offlineNetworkError.config = config;
      return Promise.reject(offlineNetworkError);

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

      // 调用networkErrorService显示超时错误弹窗
      networkErrorService.handleApiError(error, {
        context: 'API请求',
        customMessage: '请求超时，请稍后重试',
        suppressGlobalUI: suppressGlobalErrorUI,
      });
    } else if (error.response) {
      const { status, data } = error.response;

      switch (status) {
        case 401:
          // 未授权，但需要检查网络状态
          console.log('收到401未授权响应，URL:', error.config.url);
          console.log('请求头:', JSON.stringify(error.config.headers));

          // 检查网络连接状态
          const isNetworkConnected = await checkNetworkConnection();

          if (!isNetworkConnected) {
            console.log('网络未连接，401错误可能是网络问题，拒绝伪成功响应');
            const offlineAuthError = new Error('离线状态下认证失败');
            offlineAuthError.isOfflineError = true;
            offlineAuthError.offline = true;
            offlineAuthError.config = error.config;
            return Promise.reject(offlineAuthError);
          }

          // 检查是否是公开路径或特定API路径
          const isPublicPath = ['/auth/login', '/auth/register', '/auth/password/reset'].some(
            path => error.config.url && error.config.url.includes(path)
          );

          // 特定API路径，不自动登出
          const skipAuthPaths = [
            '/mind-map/',
            '/knowledge-graph/',
            '/ai-assistant/',
            '/groups/',
            '/group-invitations/',
            '/group-members/',
          ];

          const shouldSkipAuth = skipAuthPaths.some(path => error.config.url && error.config.url.includes(path));

          if (isPublicPath || shouldSkipAuth) {
            console.log('跳过自动登出处理，URL:', error.config.url);
            // 为错误添加标记，表示这是一个可以忽略的认证错误
            error.isIgnorableAuthError = true;
            // 对于这些路径，返回错误而不是处理为未授权
            return Promise.reject(error);
          }

          // 只有在网络连接正常时才处理未授权错误
          await handleUnauthorizedError();
          break;
        case 403:
          // 禁止访问
          console.log('收到403禁止访问响应，URL:', error.config.url);
          networkErrorService.handleApiError(error, {
            context: '访问被拒绝',
            customMessage: ERROR_MESSAGES.FORBIDDEN,
            suppressGlobalUI: suppressGlobalErrorUI,
          });
          break;
        case 404:
          // 资源未找到，静默处理，不显示弹窗
          console.log('资源未找到，静默处理:', error.config.url);
          console.log('请求头:', JSON.stringify(error.config.headers));

          // 不返回伪成功响应，直接抛出错误
          return Promise.reject(error);
        case 500:
          // 服务器错误
          console.log('收到500服务器错误响应，URL:', error.config.url);
          console.log('请求头:', JSON.stringify(error.config.headers));
          console.log('错误详情:', error.response?.data);

          // 检查是否是网络问题
          networkService.checkConnection().then(isOnline => {
            if (!isOnline) {
              networkErrorService.handleApiError(error, {
                context: '服务器错误',
                customMessage: '请检查您的网络连接后重试',
                suppressGlobalUI: suppressGlobalErrorUI,
              });
            } else {
              networkErrorService.handleApiError(error, {
                context: '服务器错误',
                customMessage: ERROR_MESSAGES.SERVER_ERROR,
                suppressGlobalUI: suppressGlobalErrorUI,
              });
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
          networkErrorService.handleApiError(error, {
            context: '请求失败',
            customMessage: errorMsg,
            suppressGlobalUI: suppressGlobalErrorUI,
          });
          break;
      }
    } else if (error.request) {
      // 请求已发送但没有收到响应
      networkErrorService.handleApiError(error, {
        context: '网络错误',
        customMessage: ERROR_MESSAGES.NETWORK_ERROR,
        suppressGlobalUI: suppressGlobalErrorUI,
      });
    } else {
      // 请求配置出错
      console.error('请求错误:', error.message);
      networkErrorService.handleApiError(error, {
        context: '请求配置错误',
        customMessage: error.message || '发送请求时出现错误',
        suppressGlobalUI: suppressGlobalErrorUI,
      });
    }
    return Promise.reject(error);
  }
);



// 添加缓存方法
apiClient.cache = async (url, data, expirationMinutes = 60) => {
  try {
    return await apiCache.cacheApiResponse(url, data, expirationMinutes);
  } catch (error) {
    console.error('缓存数据失败:', error);
    throw error;
  }
};

// 获取缓存方法
apiClient.getCache = async (url) => {
  try {
    return await apiCache.getCachedApiResponse(url);
  } catch (error) {
    console.error('获取缓存数据失败:', error);
    throw error;
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
    throw error;
  }
};

// 获取离线队列
apiClient.getOfflineQueue = async () => {
  try {
    const realm = await realmService.getRealm();
    const item = realm.objects('StorageItem').filtered('key = "offline_queue"');
    return item.length > 0 ? JSON.parse(item[0].value) : [];
  } catch (error) {
    console.error('获取离线队列失败:', error);
    throw error;
  }
};

// 清空离线队列
apiClient.clearOfflineQueue = async () => {
  try {
    const realm = await realmService.getRealm();
    realm.write(() => {
      const itemsToDelete = realm.objects('StorageItem').filtered('key = "offline_queue"');
      realm.delete(itemsToDelete);
    });
    return true;
  } catch (error) {
    console.error('清空离线队列失败:', error);
    throw error;
  }
};

// 处理离线队列
apiClient.processOfflineQueue = async () => {
  try {
    // 检查网络连接
    const isConnected = await checkNetworkConnection();
    if (!isConnected) {
      console.log('无网络连接，无法处理离线队列');
      throw new Error('无网络连接，无法处理离线队列');
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
          params,
        });

        results.push({
          request,
          succeeded: true,
          response,
        });
      } catch (error) {
        console.error('处理离线请求失败:', error);
        results.push({
          request,
          succeeded: false,
          error: error.message || '未知错误',
        });
      }
    }

    // 过滤出失败的请求
    const failedRequests = results.filter(result => !result.succeeded).map(result => result.request);

    // 更新离线队列，只保留失败的请求
    await authStorage.setItem('offline_queue', JSON.stringify(failedRequests));

    // 显示处理结果提示
    const successCount = results.length - failedRequests.length;
    if (Platform.OS === 'android') {
      ToastAndroid.show(
        `离线请求处理完成: ${successCount}/${results.length} 个请求成功`,
        ToastAndroid.SHORT
      );
    }

    console.log(`离线队列处理完成: ${successCount}/${results.length} 个请求成功`);

    const failedCount = failedRequests.length;
    if (failedCount > 0) {
      throw new Error(`离线队列处理未完成，失败 ${failedCount} 项`);
    }

    return true;
  } catch (error) {
    console.error('处理离线队列失败:', error);
    throw error;
  }
};

// 设置网络状态监听
networkService.addNetworkListener(state => {
  // 当网络连接恢复时，尝试处理离线队列
  if (state?.isOnline) {
    apiClient.processOfflineQueue();
  }
});

// 导出API客户端
export default apiClient;
