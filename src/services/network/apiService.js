/**
 * API服务 - 提供与后端API的通信功能
 */

import axios from 'axios';
import { configService } from '../app/configService';
import { networkService } from './networkService';
import { logService } from '../utils/logService';

// 创建axios实例
const api = axios.create({
  timeout: 30000, // 30秒超时
  headers: {
    'Content-Type': 'application/json',
  },
});

class ApiService {
  constructor() {
    this.initialized = false;
    this.initializationPromise = null;
    this.baseUrl = '';
    this.token = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
  }

  /**
   * 初始化API服务
   */
  async initialize() {
    if (this.initialized) return Promise.resolve();
    
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = new Promise(async (resolve, reject) => {
      try {
        // 从配置中获取API基础URL
        const config = await configService.getConfig();
        this.baseUrl = config.api.baseUrl;
        
        // 设置axios默认baseURL
        api.defaults.baseURL = this.baseUrl;
        
        // 从存储中获取令牌
        await this.loadTokens();
        
        // 设置请求拦截器
        this.setupInterceptors();
        
        this.initialized = true;
        logService.info('API服务初始化成功');
        resolve();
      } catch (error) {
        logService.error('API服务初始化失败', error);
        reject(error);
      }
    });

    return this.initializationPromise;
  }

  /**
   * 从存储中加载令牌
   * @private
   */
  async loadTokens() {
    try {
      const tokenData = await configService.get('auth.tokens');
      
      if (tokenData) {
        this.token = tokenData.token;
        this.refreshToken = tokenData.refreshToken;
        this.tokenExpiry = tokenData.expiry;
        
        // 如果令牌已过期，尝试刷新
        if (this.isTokenExpired() && this.refreshToken) {
          await this.refreshAccessToken();
        }
      }
    } catch (error) {
      logService.error('加载令牌失败', error);
    }
  }

  /**
   * 保存令牌到存储
   * @param {string} token 访问令牌
   * @param {string} refreshToken 刷新令牌
   * @param {number} expiresIn 过期时间（秒）
   * @private
   */
  async saveTokens(token, refreshToken, expiresIn) {
    this.token = token;
    this.refreshToken = refreshToken;
    this.tokenExpiry = Date.now() + expiresIn * 1000;
    
    await configService.set('auth.tokens', {
      token,
      refreshToken,
      expiry: this.tokenExpiry,
    });
  }

  /**
   * 清除令牌
   * @private
   */
  async clearTokens() {
    this.token = null;
    this.refreshToken = null;
    this.tokenExpiry = null;
    
    await configService.set('auth.tokens', null);
  }

  /**
   * 检查令牌是否过期
   * @returns {boolean} 是否过期
   * @private
   */
  isTokenExpired() {
    if (!this.tokenExpiry) return true;
    
    // 提前5分钟刷新令牌
    return Date.now() > this.tokenExpiry - 5 * 60 * 1000;
  }

  /**
   * 刷新访问令牌
   * @returns {Promise<string>} 新的访问令牌
   * @private
   */
  async refreshAccessToken() {
    try {
      if (!this.refreshToken) {
        throw new Error('没有刷新令牌');
      }
      
      const response = await axios.post(`${this.baseUrl}/auth/refresh`, {
        refresh_token: this.refreshToken,
      });
      
      const { token, refresh_token, expires_in } = response.data;
      
      await this.saveTokens(token, refresh_token, expires_in);
      
      return token;
    } catch (error) {
      logService.error('刷新令牌失败', error);
      await this.clearTokens();
      throw error;
    }
  }

  /**
   * 设置请求拦截器
   * @private
   */
  setupInterceptors() {
    // 请求拦截器
    api.interceptors.request.use(
      async (config) => {
        // 检查网络连接
        if (!networkService.isOnline()) {
          throw new Error('网络连接不可用');
        }
        
        // 添加认证头
        if (this.token) {
          // 检查令牌是否过期
          if (this.isTokenExpired()) {
            try {
              // 尝试刷新令牌
              await this.refreshAccessToken();
            } catch (error) {
              // 刷新失败，清除令牌
              await this.clearTokens();
            }
          }
          
          if (this.token) {
            config.headers.Authorization = `Bearer ${this.token}`;
          }
        }
        
        return config;
      },
      (error) => {
        logService.error('API请求拦截器错误', error);
        return Promise.reject(error);
      }
    );
    
    // 响应拦截器
    api.interceptors.response.use(
      (response) => {
        return response;
      },
      async (error) => {
        const originalRequest = error.config;
        
        // 如果是401错误且有刷新令牌，尝试刷新令牌并重试请求
        if (error.response && error.response.status === 401 && this.refreshToken && !originalRequest._retry) {
          originalRequest._retry = true;
          
          try {
            await this.refreshAccessToken();
            
            // 更新认证头
            originalRequest.headers.Authorization = `Bearer ${this.token}`;
            
            // 重试请求
            return api(originalRequest);
          } catch (refreshError) {
            // 刷新令牌失败，清除令牌
            await this.clearTokens();
            return Promise.reject(refreshError);
          }
        }
        
        return Promise.reject(error);
      }
    );
  }

  /**
   * 登录
   * @param {string} email 邮箱
   * @param {string} password 密码
   * @returns {Promise<Object>} 用户信息
   */
  async login(email, password) {
    try {
      await this.initialize();
      
      const response = await api.post('/auth/login', {
        email,
        password,
      });
      
      const { token, refresh_token, expires_in, user } = response.data;
      
      await this.saveTokens(token, refresh_token, expires_in);
      
      return user;
    } catch (error) {
      logService.error('登录失败', error);
      throw error;
    }
  }

  /**
   * 注册
   * @param {string} username 用户名
   * @param {string} email 邮箱
   * @param {string} password 密码
   * @returns {Promise<Object>} 用户信息
   */
  async register(username, email, password) {
    try {
      await this.initialize();
      
      const response = await api.post('/auth/register', {
        username,
        email,
        password,
      });
      
      const { token, refresh_token, expires_in, user } = response.data;
      
      await this.saveTokens(token, refresh_token, expires_in);
      
      return user;
    } catch (error) {
      logService.error('注册失败', error);
      throw error;
    }
  }

  /**
   * 登出
   * @returns {Promise<boolean>} 是否成功
   */
  async logout() {
    try {
      await this.initialize();
      
      if (this.token) {
        await api.post('/auth/logout');
      }
      
      await this.clearTokens();
      
      return true;
    } catch (error) {
      logService.error('登出失败', error);
      await this.clearTokens();
      return false;
    }
  }

  /**
   * 获取当前用户信息
   * @returns {Promise<Object>} 用户信息
   */
  async getCurrentUser() {
    try {
      await this.initialize();
      
      if (!this.token) {
        throw new Error('未登录');
      }
      
      const response = await api.get('/users/me');
      
      return response.data;
    } catch (error) {
      logService.error('获取当前用户信息失败', error);
      throw error;
    }
  }

  /**
   * 发送GET请求
   * @param {string} url 请求URL
   * @param {Object} params 查询参数
   * @param {Object} options 请求选项
   * @returns {Promise<Object>} 响应数据
   */
  async get(url, params = {}, options = {}) {
    try {
      await this.initialize();
      
      const response = await api.get(url, {
        params,
        ...options,
      });
      
      return response.data;
    } catch (error) {
      logService.error(`GET请求失败: ${url}`, error);
      throw error;
    }
  }

  /**
   * 发送POST请求
   * @param {string} url 请求URL
   * @param {Object} data 请求数据
   * @param {Object} options 请求选项
   * @returns {Promise<Object>} 响应数据
   */
  async post(url, data = {}, options = {}) {
    try {
      await this.initialize();
      
      const response = await api.post(url, data, options);
      
      return response.data;
    } catch (error) {
      logService.error(`POST请求失败: ${url}`, error);
      throw error;
    }
  }

  /**
   * 发送PUT请求
   * @param {string} url 请求URL
   * @param {Object} data 请求数据
   * @param {Object} options 请求选项
   * @returns {Promise<Object>} 响应数据
   */
  async put(url, data = {}, options = {}) {
    try {
      await this.initialize();
      
      const response = await api.put(url, data, options);
      
      return response.data;
    } catch (error) {
      logService.error(`PUT请求失败: ${url}`, error);
      throw error;
    }
  }

  /**
   * 发送PATCH请求
   * @param {string} url 请求URL
   * @param {Object} data 请求数据
   * @param {Object} options 请求选项
   * @returns {Promise<Object>} 响应数据
   */
  async patch(url, data = {}, options = {}) {
    try {
      await this.initialize();
      
      const response = await api.patch(url, data, options);
      
      return response.data;
    } catch (error) {
      logService.error(`PATCH请求失败: ${url}`, error);
      throw error;
    }
  }

  /**
   * 发送DELETE请求
   * @param {string} url 请求URL
   * @param {Object} options 请求选项
   * @returns {Promise<Object>} 响应数据
   */
  async delete(url, options = {}) {
    try {
      await this.initialize();
      
      const response = await api.delete(url, options);
      
      return response.data;
    } catch (error) {
      logService.error(`DELETE请求失败: ${url}`, error);
      throw error;
    }
  }

  /**
   * 上传文件
   * @param {string} url 请求URL
   * @param {Object} file 文件对象
   * @param {Object} data 附加数据
   * @param {Function} onProgress 进度回调
   * @returns {Promise<Object>} 响应数据
   */
  async uploadFile(url, file, data = {}, onProgress = null) {
    try {
      await this.initialize();
      
      const formData = new FormData();
      
      // 添加文件
      formData.append('file', file);
      
      // 添加其他数据
      Object.keys(data).forEach(key => {
        formData.append(key, data[key]);
      });
      
      const response = await api.post(url, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: onProgress ? (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percentCompleted);
        } : undefined,
      });
      
      return response.data;
    } catch (error) {
      logService.error(`上传文件失败: ${url}`, error);
      throw error;
    }
  }

  /**
   * 下载文件
   * @param {string} url 请求URL
   * @param {Object} params 查询参数
   * @param {Function} onProgress 进度回调
   * @returns {Promise<Blob>} 文件Blob
   */
  async downloadFile(url, params = {}, onProgress = null) {
    try {
      await this.initialize();
      
      const response = await api.get(url, {
        params,
        responseType: 'blob',
        onDownloadProgress: onProgress ? (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percentCompleted);
        } : undefined,
      });
      
      return response.data;
    } catch (error) {
      logService.error(`下载文件失败: ${url}`, error);
      throw error;
    }
  }
}

export const apiService = new ApiService();
