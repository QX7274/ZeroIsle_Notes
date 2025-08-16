/**
 * 认证服务
 * 使用MongoDB Realm进行用户认证
 */

import { realmService } from '../database/realmService';
import authStorage from './authStorage';
import { STORAGE_KEYS } from '../../utils/constants/config';
import { logService } from '../utils/logService';

class AuthService {
  constructor() {
    this.initialized = false;
    this.initializationPromise = null;
    this.currentUser = null;
  }

  async getAuthToken() {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.currentUser?.accessToken;
  }

  /**
   * 初始化认证服务
   * @returns {Promise<void>}
   */
  async initialize() {
    if (this.initialized) return Promise.resolve();

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = new Promise(async (resolve, reject) => {
      try {
        // 确保realmService已初始化
        await realmService.initialize();

        // 检查是否有保存的用户信息
        const user = await authStorage.getUser();
        if (user) {
          this.currentUser = user;
        }

        this.initialized = true;
        logService.info('认证服务初始化成功');
        resolve();
      } catch (error) {
        logService.error('认证服务初始化失败', error);
        reject(error);
      }
    });

    return this.initializationPromise;
  }

  /**
   * 使用邮箱和密码注册
   * @param {string} email 邮箱
   * @param {string} password 密码
   * @param {object} userData 用户数据
   * @returns {Promise<object>} 用户对象
   */
  async registerWithEmail(email, password, userData = {}) {
    try {
      await this.initialize();

      // 使用Realm注册
      const app = realmService.app;
      
      // 创建邮箱密码用户
      await app.emailPasswordAuth.registerUser({ email, password });
      
      // 登录
      const credentials = Realm.Credentials.emailPassword(email, password);
      const user = await app.logIn(credentials);
      
      // 保存用户信息
      const userProfile = {
        id: user.id,
        email,
        ...userData,
        createdAt: new Date().toISOString(),
      };
      
      // 保存到本地存储
      await this.saveUserData(user, userProfile);
      
      return userProfile;
    } catch (error) {
      logService.error('邮箱注册失败', error);
      throw error;
    }
  }

  /**
   * 使用邮箱和密码登录
   * @param {string} email 邮箱
   * @param {string} password 密码
   * @returns {Promise<object>} 用户对象
   */
  async loginWithEmail(email, password) {
    try {
      await this.initialize();

      // 使用realmService登录
      const user = await realmService.login(email, password);
      
      // 获取用户信息
      const userProfile = await this.fetchUserProfile(user);
      
      // 保存到本地存储
      await this.saveUserData(user, userProfile);
      
      return userProfile;
    } catch (error) {
      logService.error('邮箱登录失败', error);
      throw error;
    }
  }

  /**
   * 开发模式自动登录
   * @returns {Promise<object>} 用户对象
   */
  async loginAsDeveloper() {
    try {
      await this.initialize();

      const { DEV_CONFIG } = require('../../config');

      if (!DEV_CONFIG.SKIP_LOGIN) {
        throw new Error('开发模式自动登录未启用');
      }

      console.log('开发模式：执行自动登录');

      // 设置开发用户信息
      this.currentUser = DEV_CONFIG.DEFAULT_USER;

      // 保存到本地存储
      await authStorage.saveUser(this.currentUser);
      await authStorage.saveToken(DEV_CONFIG.DEFAULT_TOKEN);

      console.log('开发模式：自动登录成功', this.currentUser);

      return this.currentUser;
    } catch (error) {
      logService.error('开发模式自动登录失败', error);
      throw error;
    }
  }

  /**
   * 匿名登录
   * @returns {Promise<object>} 用户对象
   */
  async loginAnonymously() {
    try {
      await this.initialize();

      // 使用realmService匿名登录
      const user = await realmService.loginAnonymously();

      // 创建匿名用户信息
      const userProfile = {
        id: user.id,
        isAnonymous: true,
        createdAt: new Date().toISOString(),
      };

      // 保存到本地存储
      await this.saveUserData(user, userProfile);

      return userProfile;
    } catch (error) {
      logService.error('匿名登录失败', error);
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

      // 使用realmService登出
      await realmService.logout();
      
      // 清除本地存储
      await authStorage.clearAuth();
      
      // 重置当前用户
      this.currentUser = null;
      
      return true;
    } catch (error) {
      logService.error('登出失败', error);
      throw error;
    }
  }

  /**
   * 获取当前用户
   * @returns {Promise<object|null>} 用户对象
   */
  async getCurrentUser() {
    try {
      await this.initialize();

      // 如果已有当前用户，直接返回
      if (this.currentUser) {
        return this.currentUser;
      }

      // 从本地存储获取
      const user = await authStorage.getUser();
      if (user) {
        this.currentUser = user;
        return user;
      }

      return null;
    } catch (error) {
      logService.error('获取当前用户失败', error);
      return null;
    }
  }

  /**
   * 检查是否已登录
   * @returns {Promise<boolean>} 是否已登录
   */
  async isLoggedIn() {
    try {
      await this.initialize();

      // 开发模式下跳过登录检查
      const { DEV_CONFIG } = require('../../config');
      if (DEV_CONFIG.SKIP_LOGIN) {
        console.log('开发模式：跳过登录检查，自动设置为已登录状态');

        // 如果没有当前用户，设置默认开发用户
        if (!this.currentUser) {
          this.currentUser = DEV_CONFIG.DEFAULT_USER;
          // 保存到本地存储
          await authStorage.saveUser(this.currentUser);
          await authStorage.saveToken(DEV_CONFIG.DEFAULT_TOKEN);
          console.log('开发模式：已设置默认用户和令牌');
        }

        return true;
      }

      // 首先检查本地存储的用户信息
      if (!this.currentUser) {
        const user = await authStorage.getUser();
        if (user) {
          this.currentUser = user;
        }
      }

      // 如果有本地用户信息，认为用户已登录（支持离线模式）
      if (this.currentUser) {
        console.log('用户已登录（基于本地存储）:', this.currentUser.id || this.currentUser.email);
        return true;
      }

      // 检查realmService是否已登录（在线模式）
      try {
        const isLoggedIn = realmService.isUserLoggedIn();
        if (isLoggedIn) {
          console.log('用户已登录（基于Realm服务）');
          return true;
        }
      } catch (realmError) {
        // Realm服务可能在离线模式下不可用，但不影响登录状态检查
        console.log('Realm服务检查失败，可能处于离线模式:', realmError.message);
      }

      return false;
    } catch (error) {
      logService.error('检查登录状态失败', error);

      // 即使检查失败，如果有本地用户信息，仍然认为已登录
      if (this.currentUser) {
        console.log('检查登录状态失败，但基于本地用户信息认为已登录');
        return true;
      }

      return false;
    }
  }

  /**
   * 获取用户信息
   * @param {object} user Realm用户对象
   * @returns {Promise<object>} 用户信息
   * @private
   */
  async fetchUserProfile(user) {
    try {
      // 这里可以从MongoDB获取用户信息
      // 或者从用户自定义数据获取
      const customData = user.customData || {};
      
      return {
        id: user.id,
        email: user.profile.email,
        ...customData,
      };
    } catch (error) {
      logService.error('获取用户信息失败', error);
      
      // 返回基本信息
      return {
        id: user.id,
        email: user.profile?.email,
      };
    }
  }

  /**
   * 处理网络恢复时的认证状态同步
   * @returns {Promise<boolean>} 是否同步成功
   */
  async syncAuthStateOnNetworkRestore() {
    try {
      await this.initialize();

      // 如果没有本地用户信息，无需同步
      if (!this.currentUser) {
        console.log('没有本地用户信息，无需同步认证状态');
        return false;
      }

      console.log('网络恢复，开始同步认证状态');

      // 尝试验证当前令牌是否仍然有效
      try {
        const token = await authStorage.getToken();
        if (token) {
          // 这里可以添加令牌验证逻辑
          console.log('令牌存在，认证状态同步完成');
          return true;
        }
      } catch (tokenError) {
        console.log('令牌验证失败:', tokenError.message);
      }

      // 如果令牌无效或不存在，但用户信息存在，保持离线登录状态
      console.log('保持离线登录状态，等待用户主动重新认证');
      return true;
    } catch (error) {
      logService.error('同步认证状态失败', error);
      return false;
    }
  }

  /**
   * 强制刷新认证令牌
   * @returns {Promise<boolean>} 是否刷新成功
   */
  async refreshToken() {
    try {
      await this.initialize();

      // 尝试使用Realm服务刷新令牌
      if (realmService.isUserLoggedIn()) {
        const user = realmService.getCurrentUser();
        if (user && user.accessToken) {
          await authStorage.saveToken(user.accessToken);
          console.log('令牌刷新成功');
          return true;
        }
      }

      console.log('无法刷新令牌，可能需要重新登录');
      return false;
    } catch (error) {
      logService.error('刷新令牌失败', error);
      return false;
    }
  }

  /**
   * 保存用户数据
   * @param {object} user Realm用户对象
   * @param {object} userProfile 用户信息
   * @returns {Promise<void>}
   * @private
   */
  async saveUserData(user, userProfile) {
    try {
      // 保存用户信息
      await authStorage.saveUser(userProfile);

      // 保存当前用户
      this.currentUser = userProfile;

      // 保存令牌（如果有）
      if (user.accessToken) {
        await authStorage.saveToken(user.accessToken);
      }
    } catch (error) {
      logService.error('保存用户数据失败', error);
      throw error;
    }
  }
}

// 创建单例实例
const authService = new AuthService();

// 初始化并等待完成
(async () => {
  try {
    await authService.initialize();
  } catch (error) {
    console.error('初始化认证服务失败', error);
  }
})();

export default authService;
