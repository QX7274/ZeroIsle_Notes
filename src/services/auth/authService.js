/**
 * 认证服务
 * 使用MongoDB Realm进行用户认证
 */

import realmService from '../database/realmService';
import realmJwtAuthService from './realmJwtAuthService';
import authStorage from './authStorage';
import { DeviceEventEmitter } from 'react-native';
import { logService } from '../../utils/logService';

class AuthService {
  constructor() {
    this.initialized = false;
    this.initializationPromise = null;
    this.currentUser = null;
    this.isRealmAuthenticated = false;
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
    if (this.initialized) {return Promise.resolve();}

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

          // 尝试自动恢复 Realm 会话（如果本地有 realm_jwt）
          const realmJwt = await authStorage.getRealmJwt();
          if (realmJwt) {
            try {
              await realmJwtAuthService.loginWithJwt(realmJwt);
              this.isRealmAuthenticated = true;
            } catch (realmErr) {
              logService.warn('初始化时自动恢复 Realm 会话失败', realmErr);
            }
          }
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
   * 使用邮箱注册（已废弃：仅保留接口兼容，内部返回错误）
   */
  async registerWithEmail() {
    throw new Error('邮箱注册功能已停用，请使用手机号、微信或 QQ 登录');
  }

  /**
   * 使用邮箱登录（已废弃：仅保留接口兼容，内部返回错误）
   */
  async loginWithEmail() {
    throw new Error('邮箱登录功能已停用，请使用手机号、微信或 QQ 登录');
  }

  /**
   * 第三方登录（手机号/微信/QQ）成功后的回调
   * 需包含后端签发的业务 token 与 realm_jwt
   * @param {string} provider - 'phone' | 'weChat' | 'qq'
   * @param {object} loginResponse - 后端返回的完整响应
   */
  async handleThirdPartyLoginSuccess(provider, loginResponse) {
    try {
      await this.initialize();
      const { user, tokens } = loginResponse.data; // 约定结构：{ user, tokens: { access, refresh, realm_jwt } }

      if (!tokens?.realm_jwt) {
        throw new Error(`后端响应缺失 realm_jwt，登录渠道: ${provider}`);
      }

      // 1. 保存业务数据
      await this.saveUserData(tokens.access, user, tokens.realm_jwt);

      // 2. 同步登录 Realm
      await realmJwtAuthService.loginWithJwt(tokens.realm_jwt);
      this.isRealmAuthenticated = true;

      logService.info(`第三方登录成功 [${provider}], 用户 ID: ${user.id}`);
      return user;
    } catch (error) {
      logService.error(`第三方登录落地失败 [${provider}]`, error);
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

      // 1. 登出 Realm 会话
      await realmJwtAuthService.logout();

      // 2. 清除本地存储
      await authStorage.clearAuth();

      // 3. 重置当前用户
      this.currentUser = null;
      this.isRealmAuthenticated = false;

      return true;
    } catch (error) {
      logService.error('登出失败', error);
      throw error;
    }
  }

  /**
   * 强制登出
   * 清理会话并触发全局事件以导航到登录页
   * @returns {Promise<void>}
   */
  async forceLogout() {
    try {
      await this.logout(); // 调用现有的清理逻辑
      DeviceEventEmitter.emit('FORCE_LOGOUT'); // 发出全局事件
      logService.info('强制登出事件已触发');
    } catch (error) {
      logService.error('强制登出失败', error);
      // 即使登出有异常，也尝试触发UI重置
      DeviceEventEmitter.emit('FORCE_LOGOUT');
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

      // 首先检查本地存储的用户信息
      if (!this.currentUser) {
        const user = await authStorage.getUser();
        if (user) {
          this.currentUser = user;
        }
      }

      // 如果有本地用户信息，认为基础登录有效（支持离线）
      const hasBaseUser = !!this.currentUser;

      // 检查 Realm 会话是否真正可用
      const isRealmValid = realmJwtAuthService.app?.currentUser?.state === 'active';
      this.isRealmAuthenticated = isRealmValid;

      return hasBaseUser && isRealmValid;
    } catch (error) {
      logService.error('检查登录状态失败', error);
      return false;
    }
  }

  /**
   * 保存用户数据
   * @param {string} accessToken - 业务接口 Token
   * @param {object} userProfile - 用户详细信息
   * @param {string} realmJwt - Realm 专用的 JWT
   */
  async saveUserData(accessToken, userProfile, realmJwt) {
    try {
      // 1. 保存用户信息
      await authStorage.saveUser(userProfile);
      this.currentUser = userProfile;

      // 2. 保存 Token 集
      const tokenData = {
        access_token: accessToken,
        realm_jwt: realmJwt,
        updated_at: new Date().toISOString()
      };
      await authStorage.saveToken(tokenData);
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
