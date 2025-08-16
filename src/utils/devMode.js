/**
 * 开发模式工具
 * 提供开发模式的配置和管理功能
 */

import { DEV_CONFIG } from '../config/index.js';

/**
 * 开发模式管理器
 */
class DevModeManager {
  constructor() {
    this.isDevMode = __DEV__;
    this.skipLogin = DEV_CONFIG.SKIP_LOGIN;
  }

  /**
   * 检查是否为开发模式
   * @returns {boolean}
   */
  isDevModeEnabled() {
    return this.isDevMode;
  }

  /**
   * 检查是否跳过登录
   * @returns {boolean}
   */
  shouldSkipLogin() {
    return this.isDevMode && this.skipLogin;
  }

  /**
   * 获取开发模式用户信息
   * @returns {object}
   */
  getDevUser() {
    return DEV_CONFIG.DEFAULT_USER;
  }

  /**
   * 获取开发模式令牌
   * @returns {string}
   */
  getDevToken() {
    return DEV_CONFIG.DEFAULT_TOKEN;
  }

  /**
   * 打印开发模式状态
   */
  logDevModeStatus() {
    if (this.isDevMode) {
      console.log('🔧 开发模式已启用');
      console.log('📝 跳过登录:', this.skipLogin ? '是' : '否');
      if (this.skipLogin) {
        console.log('👤 开发用户:', this.getDevUser().username);
        console.log('🔑 开发令牌:', this.getDevToken().substring(0, 20) + '...');
      }
    } else {
      console.log('🚀 生产模式');
    }
  }

  /**
   * 设置开发模式配置（仅在开发环境下有效）
   * @param {object} config 配置对象
   */
  setDevConfig(config) {
    if (!this.isDevMode) {
      console.warn('⚠️ 只能在开发模式下修改配置');
      return false;
    }

    if (config.skipLogin !== undefined) {
      this.skipLogin = config.skipLogin;
      console.log('🔧 开发模式跳过登录设置已更新:', this.skipLogin);
    }

    return true;
  }

  /**
   * 重置开发模式配置
   */
  resetDevConfig() {
    if (!this.isDevMode) {
      console.warn('⚠️ 只能在开发模式下重置配置');
      return false;
    }

    this.skipLogin = DEV_CONFIG.SKIP_LOGIN;
    console.log('🔄 开发模式配置已重置');
    return true;
  }
}

// 创建单例实例
const devModeManager = new DevModeManager();

// 在应用启动时打印开发模式状态
devModeManager.logDevModeStatus();

export default devModeManager;

/**
 * 便捷函数：检查是否应该跳过登录
 * @returns {boolean}
 */
export const shouldSkipLogin = () => devModeManager.shouldSkipLogin();

/**
 * 便捷函数：获取开发用户信息
 * @returns {object|null}
 */
export const getDevUser = () => devModeManager.shouldSkipLogin() ? devModeManager.getDevUser() : null;

/**
 * 便捷函数：获取开发令牌
 * @returns {string|null}
 */
export const getDevToken = () => devModeManager.shouldSkipLogin() ? devModeManager.getDevToken() : null;

/**
 * 便捷函数：在控制台中切换开发模式配置
 * 使用方法：在React Native调试器控制台中输入
 * require('./src/utils/devMode').toggleSkipLogin()
 */
export const toggleSkipLogin = () => {
  const currentStatus = devModeManager.shouldSkipLogin();
  devModeManager.setDevConfig({ skipLogin: !currentStatus });
  console.log('🔄 跳过登录已', !currentStatus ? '启用' : '禁用');
  console.log('📱 请重新启动应用以使更改生效');
  return !currentStatus;
};

/**
 * 便捷函数：启用跳过登录
 */
export const enableSkipLogin = () => {
  devModeManager.setDevConfig({ skipLogin: true });
  console.log('✅ 跳过登录已启用');
  console.log('📱 请重新启动应用以使更改生效');
};

/**
 * 便捷函数：禁用跳过登录
 */
export const disableSkipLogin = () => {
  devModeManager.setDevConfig({ skipLogin: false });
  console.log('❌ 跳过登录已禁用');
  console.log('📱 请重新启动应用以使更改生效');
};
