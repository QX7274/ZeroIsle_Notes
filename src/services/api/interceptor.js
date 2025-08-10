/**
 * API拦截器
 * 为了保持兼容性，导入并导出apiClient
 * @deprecated 请直接使用apiClient
 */
import apiClient from './apiClient';
import { realmStorageService } from '../storage/realmStorageService';
import { STORAGE_KEYS } from '../../utils/constants/config';
import tokenService from '../auth/tokenService';

/**
 * 为了保持兼容性，导出apiClient
 * 所有使用instance的地方都应该迁移到apiClient
 */
export default apiClient;

// 不需要认证的路径列表
const PUBLIC_PATHS = [
  '/auth/login',
  '/auth/register',
  '/auth/register/username',
  '/auth/register/phone',
  '/auth/register/email',
  '/auth/verify',
  '/auth/refresh',
  '/auth/forgot-password'
];

// 请求拦截器
apiClient.interceptors.request.use(
  async (config) => {
    try {
      // 记录请求URL和方法
      console.log(`API请求: ${config.method?.toUpperCase() || 'GET'} ${config.url}`);

      // 检查是否是公开路径
      const isPublicPath = PUBLIC_PATHS.some(path => config.url && config.url.includes(path));

      // 如果是公开路径，不需要添加认证令牌
      if (isPublicPath) {
        console.log('公开路径请求，不添加认证令牌:', config.url);
        return config;
      }

      // 使用tokenService获取访问令牌
      const tokenData = await tokenService.getAccessToken();

      if (tokenData && tokenData.token) {
        // 添加认证头
        config.headers.Authorization = `Bearer ${tokenData.token}`;
        console.log('已添加认证令牌到请求头:', config.url);

        // 检查令牌是否即将过期
        const expiresAt = new Date(tokenData.expires_at);
        const now = new Date();
        const timeUntilExpiry = expiresAt.getTime() - now.getTime();
        const minutesUntilExpiry = Math.floor(timeUntilExpiry / (60 * 1000));

        if (minutesUntilExpiry < 5) {
          console.log(`令牌即将在${minutesUntilExpiry}分钟后过期，应考虑刷新`);
        }
      } else {
        // 尝试从旧的存储位置获取令牌
        try {
          const token = await realmStorageService.getItem(STORAGE_KEYS.AUTH_TOKEN);
          if (token) {
            // 如果找到了令牌，添加到请求头
            if (typeof token === 'string') {
              config.headers.Authorization = `Bearer ${token}`;
              console.log('已从旧存储位置添加认证令牌到请求头:', config.url);
            } else if (token.token) {
              config.headers.Authorization = `Bearer ${token.token}`;
              console.log('已从旧存储位置添加认证令牌对象到请求头:', config.url);
            }
          } else {
            // 只有在非公开路径上才显示警告
            console.warn('未找到认证令牌，请求将以未认证状态发送:', config.url);
          }
        } catch (storageError) {
          console.error('从存储中获取令牌失败:', storageError);
          console.warn('未找到认证令牌，请求将以未认证状态发送:', config.url);
        }
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

// 响应拦截器 - 处理401未授权错误
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    
    // 处理401错误
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      
      try {
        // 尝试刷新令牌
        const newToken = await tokenService.refreshToken();
        if (newToken) {
          // 更新请求头并重试原始请求
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          return apiClient(originalRequest);
        }
      } catch (refreshError) {
        console.error('刷新令牌失败:', refreshError);
        // 刷新失败，跳转登录页
        authService.logout();
      }
    }
    
    return Promise.reject(error);
  }
);