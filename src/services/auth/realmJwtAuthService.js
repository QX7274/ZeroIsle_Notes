/**
 * Realm JWT 认证服务
 * 专门处理通过后端签发的 Custom JWT 进行 Realm 身份验证
 */

import Realm from 'realm';
import { getRealmApp } from '../database/realmConfig';
import { logService } from '../../utils/logService';

class RealmJwtAuthService {
  constructor() {
    this.app = null;
  }

  /**
   * 初始化 App 实例
   */
  async _ensureApp() {
    if (!this.app) {
      this.app = getRealmApp();
    }
    if (!this.app) {
      throw new Error('Realm App 实例未就绪');
    }
  }

  /**
   * 使用后端签发的 JWT 登录 Realm
   * @param {string} realmJwt - 后端返回的专用 Realm JWT
   * @returns {Promise<Realm.User>}
   */
  async loginWithJwt(realmJwt) {
    try {
      await this._ensureApp();
      
      logService.info('正在尝试使用 Custom JWT 登录 Realm...');
      const credentials = Realm.Credentials.jwt(realmJwt);
      const user = await this.app.logIn(credentials);
      
      logService.info(`Realm 登录成功: ${user.id}`);
      return user;
    } catch (error) {
      logService.error('Realm JWT 登录失败', error);
      throw error;
    }
  }

  /**
   * 刷新当前 Realm 用户会话
   */
  async refreshSession() {
    try {
      await this._ensureApp();
      const currentUser = this.app.currentUser;
      
      if (currentUser && currentUser.state === 'active') {
        // Realm SDK 会自动管理刷新，但在 Custom JWT 下通常需要重新调用 logIn 
        // 这里提供一个显式刷新入口，供 AuthService 调用后端续期后的 token
        return currentUser;
      }
      return null;
    } catch (error) {
      logService.error('刷新 Realm 会话失败', error);
      return null;
    }
  }

  /**
   * 登出当前 Realm 会话
   */
  async logout() {
    try {
      await this._ensureApp();
      if (this.app.currentUser) {
        await this.app.currentUser.logOut();
        logService.info('Realm 会话已安全登出');
      }
    } catch (error) {
      logService.error('Realm 登出失败', error);
    }
  }
}

const realmJwtAuthService = new RealmJwtAuthService();
export default realmJwtAuthService;

