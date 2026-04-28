import { Platform } from 'react-native';
import { STORAGE_KEYS, TOKEN_CONFIG, API_URL } from '../../config';
import { AUTH_CONFIG } from './authConfig';
import axios from 'axios';

// 动态导入 Keychain，防止在 Web 平台上报错
let Keychain;
if (Platform.OS !== 'web') {
  try {
    Keychain = require('react-native-keychain');
  } catch (e) {
    console.warn('无法导入 react-native-keychain:', e);
  }
}

// 创建用于刷新令牌的axios实例
// 使用配置文件中的统一API地址
const refreshClient = axios.create({
  baseURL: `${API_URL}/api/v1`,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
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
    if (this.initialized) {return;}

    try {
      this.initialized = true;
      console.log('TokenService初始化成功');
    } catch (error) {
      console.error('TokenService初始化失败:', error);
      throw error;
    }
  }

  /**
   * 内部方法：安全保存数据
   * @private
   */
  async _saveSecurely(service, value, identifier = 'token') {
    if (Platform.OS === 'web') {
      try {
        localStorage.setItem(`secure_${service}`, value);
        return true;
      } catch (e) {
        console.error(`Web存储失败 (${service}):`, e);
        return false;
      }
    }

    if (!Keychain) {return false;}
    return await Keychain.setGenericPassword(identifier, value, { service });
  }

  /**
   * 内部方法：获取安全数据
   * @private
   */
  async _getSecurely(service) {
    if (Platform.OS === 'web') {
      try {
        const value = localStorage.getItem(`secure_${service}`);
        return value ? { password: value } : null;
      } catch (e) {
        console.error(`Web读取失败 (${service}):`, e);
        return null;
      }
    }

    if (!Keychain) {return null;}
    return await Keychain.getGenericPassword({ service });
  }

  /**
   * 内部方法：重置安全数据
   * @private
   */
  async _resetSecurely(service) {
    if (Platform.OS === 'web') {
      try {
        localStorage.removeItem(`secure_${service}`);
        return true;
      } catch (e) {
        console.error(`Web删除失败 (${service}):`, e);
        return false;
      }
    }

    if (!Keychain) {return false;}
    return await Keychain.resetGenericPassword({ service });
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
        created_at: now.toISOString(),
      };

      await this._saveSecurely(STORAGE_KEYS.AUTH_TOKEN, JSON.stringify(tokenData), 'access_token');

      console.log('访问令牌安全保存成功');
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
        created_at: now.toISOString(),
      };

      await this._saveSecurely(STORAGE_KEYS.REFRESH_TOKEN, JSON.stringify(refreshTokenData), 'refresh_token');

      console.log('刷新令牌安全保存成功');
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

      const credentials = await this._getSecurely(STORAGE_KEYS.AUTH_TOKEN);

      if (!credentials) {
        console.log('未找到有效的访问令牌');
        return null;
      }

      const tokenData = JSON.parse(credentials.password);

      if (tokenData && tokenData.token) {
        // 检查令牌是否有效
        if (tokenData.expires_at) {
          const expiresAt = new Date(tokenData.expires_at);
          const now = new Date();
          if (expiresAt <= now) {
            console.log('令牌已过期');
            return null;
          } else {
            return tokenData;
          }
        } else {
          console.log('令牌缺少过期时间信息');
          return null;
        }
      } else {
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

      const credentials = await this._getSecurely(STORAGE_KEYS.REFRESH_TOKEN);

      if (!credentials) {
        return null;
      }

      return JSON.parse(credentials.password);
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
        return true;
      }

      const expiresAt = new Date(tokenData.expires_at);
      const now = new Date();
      const thresholdTime = new Date(now.getTime() + thresholdMinutes * 60 * 1000);

      return expiresAt <= thresholdTime;
    } catch (error) {
      console.error('检查令牌过期失败:', error);
      return true;
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
        // 避免开发模式下频繁 warning 干扰真机联调
        console.log('没有可用的刷新令牌');
        return null;
      }

      const refreshExpiresAt = new Date(refreshTokenData.expires_at);
      if (refreshExpiresAt <= new Date()) {
        // 过期属于正常状态，不输出 warning stack
        console.log('刷新令牌已过期，清理本地令牌');
        await this.clearTokens();
        return null;
      }

      try {
        const response = await refreshClient.post(AUTH_CONFIG.API_ENDPOINTS.REFRESH, {
          refresh: refreshTokenData.token,
        });

        if (response.data && response.data.access) {
          await this.saveAccessToken(response.data.access);

          if (response.data.refresh) {
            await this.saveRefreshToken(response.data.refresh);
          }

          console.log('成功刷新访问令牌');
          return await this.getAccessToken();
        } else {
          // 开发联调阶段：非阻断场景降级为log，避免warning弹层打断流程
          console.log('刷新令牌响应中没有访问令牌');
          return null;
        }
      } catch (apiError) {
        // 开发联调阶段：401/刷新失败常见，避免warning弹层打断流程
        console.log('刷新令牌请求失败:', apiError?.message);
        await this.clearTokens();
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

      await Promise.all([
        this._resetSecurely(STORAGE_KEYS.AUTH_TOKEN),
        this._resetSecurely(STORAGE_KEYS.REFRESH_TOKEN),
      ]);

      console.log('所有安全令牌已清除');
      return true;
    } catch (error) {
      console.error('清除令牌失败:', error);
      return false;
    }
  }
}

const tokenService = new TokenService();
tokenService.initialize().catch(error => {
  console.error('初始化令牌服务失败', error);
});

// 兼容历史调用方式（named import / CommonJS destructuring）
export const getToken = async () => {
  const tokenData = await tokenService.getAccessToken();
  return tokenData?.token || null;
};

export const refreshToken = async () => tokenService.refreshAccessToken();
export { tokenService };
export default tokenService;
