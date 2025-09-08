/**
 * 统一认证配置
 * 确保所有认证相关模块使用相同的配置
 */

import { TOKEN_CONFIG } from '../../config';

// 认证配置
export const AUTH_CONFIG = {
  // 令牌配置
  TOKEN: {
    // 访问令牌有效期（分钟）
    ACCESS_TOKEN_LIFETIME: TOKEN_CONFIG.ACCESS_TOKEN_LIFETIME,
    // 刷新令牌有效期（天）
    REFRESH_TOKEN_LIFETIME: TOKEN_CONFIG.REFRESH_TOKEN_LIFETIME,
    // 提前刷新时间（分钟）
    REFRESH_THRESHOLD_MINUTES: TOKEN_CONFIG.REFRESH_THRESHOLD_MINUTES,
  },
  
  // 存储键配置
  STORAGE_KEYS: {
    AUTH_TOKEN: 'auth_token',
    REFRESH_TOKEN: 'refresh_token',
    USER_INFO: 'user_info',
    AUTH_EXPIRED: 'auth_expired',
  },
  
  // API端点配置
  API_ENDPOINTS: {
    LOGIN: '/auth/login/',
    REGISTER: '/auth/register/',
    REFRESH: '/auth/token/refresh/',
    LOGOUT: '/auth/logout/',
    PROFILE: '/auth/profile/',
  },
  
  // 错误消息配置
  ERROR_MESSAGES: {
    TOKEN_EXPIRED: '访问令牌已过期，请重新登录',
    REFRESH_FAILED: '刷新令牌失败，请重新登录',
    AUTH_REQUIRED: '需要认证，请先登录',
    INVALID_CREDENTIALS: '用户名或密码错误',
    NETWORK_ERROR: '网络连接错误，请检查网络设置',
    SERVER_ERROR: '服务器错误，请稍后重试',
  },
  
  // 认证状态配置
  AUTH_STATES: {
    AUTHENTICATED: 'authenticated',
    UNAUTHENTICATED: 'unauthenticated',
    LOADING: 'loading',
    ERROR: 'error',
  },
};

// 导出默认配置
export default AUTH_CONFIG;
