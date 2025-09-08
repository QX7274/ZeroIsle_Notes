/**
 * 统一令牌服务
 * 管理访问令牌和刷新令牌的存储、获取、刷新等操作
 */

import { STORAGE_KEYS } from '../../config';
import { TOKEN_CONFIG } from '../../config';
import { AUTH_CONFIG } from './authConfig';
import realmStorageService from '../storage/realmStorageService';
import axios from 'axios';

// 创建用于刷新令牌的axios实例
const refreshClient = axios.create({
  baseURL: 'http://192.168.234.232:8000/api/v1',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }
});

/**
 * 令牌服务类
 */
class TokenService {
  constructor() {
    this.initialized = false;
  }

  /**
   * 初始化服务
   */
  async initialize() {
    if (this.initialized) return;

    try {
      await realmStorageService.initialize();
      this.initialized = true;
      console.log('TokenService初始化成功');
    } catch (error) {
      console.error('TokenService初始化失败:', error);
      throw error;
    }
  }

  /**
   * 保存访问令牌
   * @param {string} token - 访问令牌
   * @returns {Promise<boolean>} 是否成功
   */
  async saveAccessToken(token) {
    try {
      await this.initialize();

      // 计算过期时间
      const now = new Date();
      const expiresAt = new Date(now.getTime() + TOKEN_CONFIG.ACCESS_TOKEN_LIFETIME * 60 * 1000);

      const tokenData = {
        token,
        expires_at: expiresAt.toISOString(),
        created_at: now.toISOString()
      };

      await realmStorageService.setItem(STORAGE_KEYS.AUTH_TOKEN, tokenData);
      console.log('访问令牌保存成功');
      return true;
    } catch (error) {
      console.error('保存访问令牌失败:', error);
      return false;
    }
  }

  /**
   * 保存刷新令牌
   * @param {string} refreshToken - 刷新令牌
   * @returns {Promise<boolean>} 是否成功
   */
  async saveRefreshToken(refreshToken) {
    try {
      await this.initialize();

      // 计算过期时间
      const now = new Date();
      const expiresAt = new Date(now.getTime() + TOKEN_CONFIG.REFRESH_TOKEN_LIFETIME * 24 * 60 * 60 * 1000);

      const refreshTokenData = {
        token: refreshToken,
        expires_at: expiresAt.toISOString(),
        created_at: now.toISOString()
      };

      await realmStorageService.setItem(STORAGE_KEYS.REFRESH_TOKEN, refreshTokenData);
      console.log('刷新令牌保存成功');
      return true;
    } catch (error) {
      console.error('保存刷新令牌失败:', error);
      return false;
    }
  }

  /**
   * 获取访问令牌
   * @returns {Promise<{token: string, expires_at: string}|null>} 令牌数据
   */
  async getAccessToken() {
    try {
      await this.initialize();

      // 获取令牌对象
      const tokenData = await realmStorageService.getItem(STORAGE_KEYS.AUTH_TOKEN);

      if (tokenData && tokenData.token) {
        console.log('获取到访问令牌:', tokenData.token.substring(0, 10) + '...');
        
        // 检查令牌是否有效
        if (tokenData.expires_at) {
          const expiresAt = new Date(tokenData.expires_at);
          const now = new Date();
          if (expiresAt <= now) {
            console.log('令牌已过期，过期时间:', expiresAt);
            return null;
          } else {
            console.log('令牌有效，过期时间:', expiresAt);
            return tokenData;
          }
        } else {
          console.log('令牌缺少过期时间信息');
          return null;
        }
      } else {
        console.log('未找到有效的访问令牌');
        return null;
      }
    } catch (error) {
      console.error('获取访问令牌失败:', error);
      return null;
    }
  }

  /**
   * 获取刷新令牌
   * @returns {Promise<{token: string, expires_at: string}|null>} 令牌数据
   */
  async getRefreshToken() {
    try {
      await this.initialize();
      return await realmStorageService.getItem(STORAGE_KEYS.REFRESH_TOKEN);
    } catch (error) {
      console.error('获取刷新令牌失败:', error);
      return null;
    }
  }

  /**
   * 检查访问令牌是否过期或即将过期
   * @param {number} thresholdMinutes 提前多少分钟视为即将过期
   * @returns {Promise<boolean>} 是否过期或即将过期
   */
  async isAccessTokenExpiredOrExpiring(thresholdMinutes = TOKEN_CONFIG.REFRESH_THRESHOLD_MINUTES) {
    try {
      const tokenData = await this.getAccessToken();

      if (!tokenData || !tokenData.expires_at) {
        return true; // 没有令牌或过期时间，视为已过期
      }

      const expiresAt = new Date(tokenData.expires_at);
      const now = new Date();

      // 计算阈值时间（当前时间 + 阈值分钟）
      const thresholdTime = new Date(now.getTime() + thresholdMinutes * 60 * 1000);

      // 如果过期时间早于阈值时间，则视为即将过期
      return expiresAt <= thresholdTime;
    } catch (error) {
      console.error('检查令牌过期失败:', error);
      return true; // 出错时视为已过期
    }
  }

  /**
   * 刷新访问令牌
   * @returns {Promise<{token: string, expires_at: string}|null>} 新的访问令牌数据
   */
  async refreshAccessToken() {
    try {
      console.log('开始刷新访问令牌...');

      const refreshTokenData = await this.getRefreshToken();

      if (!refreshTokenData || !refreshTokenData.token) {
        console.warn('没有可用的刷新令牌，无法刷新访问令牌');
        return null;
      }

      // 检查刷新令牌是否过期
      const refreshExpiresAt = new Date(refreshTokenData.expires_at);
      if (refreshExpiresAt <= new Date()) {
        console.warn('刷新令牌已过期，需要重新登录');
        // 清除过期的令牌
        await this.clearTokens();
        return null;
      }

      try {
        // 发送刷新请求
        const response = await refreshClient.post(AUTH_CONFIG.API_ENDPOINTS.REFRESH, {
          refresh: refreshTokenData.token
        });

        // 保存新的访问令牌
        if (response.data && response.data.access) {
          await this.saveAccessToken(response.data.access);

          // 如果响应中包含新的刷新令牌，也保存它
          if (response.data.refresh) {
            await this.saveRefreshToken(response.data.refresh);
          }

          console.log('成功刷新访问令牌');
          // 返回新的访问令牌数据
          return await this.getAccessToken();
        } else {
          console.warn('刷新令牌响应中没有访问令牌');
          return null;
        }
      } catch (apiError) {
        // 如果刷新请求失败，可能是刷新令牌无效
        console.warn('刷新令牌请求失败，可能需要重新登录:', apiError.message);

        // 检查是否是401错误，如果是则清除令牌
        if (apiError.response && apiError.response.status === 401) {
          console.warn('刷新令牌无效，清除所有令牌');
          await this.clearTokens();
        }

        return null;
      }
    } catch (error) {
      console.error('刷新访问令牌过程中出现错误:', error);
      return null;
    }
  }

  /**
   * 刷新令牌（别名）
   * @returns {Promise<{token: string, expires_at: string}|null>} 新的访问令牌数据
   */
  async refreshToken() {
    return this.refreshAccessToken();
  }

  /**
   * 清除所有令牌
   * @returns {Promise<boolean>} 是否成功
   */
  async clearTokens() {
    try {
      await this.initialize();

      // 清除所有令牌相关的存储
      await realmStorageService.removeItem(STORAGE_KEYS.AUTH_TOKEN);
      await realmStorageService.removeItem(STORAGE_KEYS.REFRESH_TOKEN);
      await realmStorageService.removeItem(STORAGE_KEYS.AUTH_EXPIRED);

      console.log('所有令牌已清除');
      return true;
    } catch (error) {
      console.error('清除令牌失败:', error);
      return false;
    }
  }
}

// 创建单例实例
const tokenService = new TokenService();

// 初始化
tokenService.initialize().catch(error => {
  console.error('初始化令牌服务失败', error);
});

// 导出
export default tokenService;
