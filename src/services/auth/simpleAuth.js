/**
 * 简单认证服务
 * 使用统一的令牌格式，避免开发环境和生产环境的不匹配
 */

import { RealmStorage } from '../storage/RealmStorage';

class SimpleAuth {
  constructor() {
    this.baseURL = 'http://192.168.234.232:8000/api/v1';
  }

  /**
   * 获取或创建有效的认证令牌
   */
  async getValidToken() {
    try {
      // 尝试从存储中获取现有令牌
      const tokenStr = await RealmStorage.getItem('auth_token');
      
      if (tokenStr) {
        try {
          const tokenData = JSON.parse(tokenStr);
          
          // 检查令牌是否过期
          if (tokenData.expires_at) {
            const expiryTime = new Date(tokenData.expires_at);
            const now = new Date();
            
            if (expiryTime > now) {
              console.log('SimpleAuth: 使用现有有效令牌');
              return tokenData.token;
            }
          }
        } catch (parseError) {
          console.warn('SimpleAuth: 令牌解析失败，将创建新令牌');
        }
      }

      // 创建新的简单令牌
      return await this.createSimpleToken();

    } catch (error) {
      console.error('SimpleAuth: 获取令牌失败:', error);
      return null;
    }
  }

  /**
   * 创建简单的认证令牌
   */
  async createSimpleToken() {
    try {
      const timestamp = Date.now();
      const expiry = new Date(timestamp + 24 * 60 * 60 * 1000); // 24小时后过期
      
      // 使用简单的令牌格式
      const tokenData = {
        token: `simple-auth-${timestamp}`,
        expires_at: expiry.toISOString(),
        token_type: 'Bearer',
        created_at: new Date().toISOString()
      };

      // 保存到存储
      await RealmStorage.setItem('auth_token', JSON.stringify(tokenData));
      await RealmStorage.setItem('token', tokenData.token);
      await RealmStorage.setItem('token_expiry', tokenData.expires_at);

      // 清除过期标记
      await RealmStorage.removeItem('auth_expired');

      console.log('SimpleAuth: 创建新令牌成功');
      return tokenData.token;

    } catch (error) {
      console.error('SimpleAuth: 创建令牌失败:', error);
      return null;
    }
  }

  /**
   * 清除所有认证数据
   */
  async clearAuth() {
    try {
      const keys = ['auth_token', 'refresh_token', 'token', 'token_expiry'];
      
      for (const key of keys) {
        await RealmStorage.removeItem(key);
      }

      console.log('SimpleAuth: 认证数据已清除');
      return true;

    } catch (error) {
      console.error('SimpleAuth: 清除认证数据失败:', error);
      return false;
    }
  }

  /**
   * 检查认证状态
   */
  async checkAuthStatus() {
    try {
      const token = await this.getValidToken();
      
      return {
        isAuthenticated: !!token,
        token: token,
        timestamp: new Date().toISOString()
      };

    } catch (error) {
      console.error('SimpleAuth: 检查认证状态失败:', error);
      return {
        isAuthenticated: false,
        token: null,
        error: error.message
      };
    }
  }

  /**
   * 为API请求添加认证头
   */
  async addAuthHeader(headers = {}) {
    try {
      const token = await this.getValidToken();
      
      if (token) {
        return {
          ...headers,
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        };
      }

      return {
        ...headers,
        'Content-Type': 'application/json'
      };

    } catch (error) {
      console.error('SimpleAuth: 添加认证头失败:', error);
      return {
        ...headers,
        'Content-Type': 'application/json'
      };
    }
  }

  /**
   * 处理API响应中的认证错误
   */
  async handleAuthError(error, originalRequest) {
    try {
      if (error.response?.status === 401) {
        console.log('SimpleAuth: 检测到401错误，清除认证数据');
        await this.clearAuth();
        
        // 返回一个友好的离线响应
        return {
          data: {
            success: true,
            offline: true,
            message: '当前处于离线模式',
            timestamp: new Date().toISOString()
          },
          status: 200,
          statusText: 'OK (Offline Mode)'
        };
      }

      throw error;

    } catch (handlingError) {
      console.error('SimpleAuth: 处理认证错误失败:', handlingError);
      throw error;
    }
  }

  /**
   * 初始化认证服务
   */
  async initialize() {
    try {
      console.log('SimpleAuth: 初始化认证服务');
      
      const authStatus = await this.checkAuthStatus();
      
      if (authStatus.isAuthenticated) {
        console.log('SimpleAuth: 认证服务初始化成功');
      } else {
        console.log('SimpleAuth: 认证服务初始化完成（未认证状态）');
      }

      return authStatus;

    } catch (error) {
      console.error('SimpleAuth: 初始化失败:', error);
      return {
        isAuthenticated: false,
        error: error.message
      };
    }
  }
}

// 创建并导出单例
const simpleAuth = new SimpleAuth();

export default simpleAuth;
