/**
 * 认证修复器
 * 用于修复认证相关的问题
 */

class AuthFixer {
  constructor() {
    this.isRefreshing = false;
    this.failedQueue = [];
  }

  /**
   * 修复认证令牌
   */
  async fixAuthToken() {
    try {
      console.log('开始修复认证令牌...');

      // 检查当前令牌状态
      const { tokenService } = require('./tokenService');
      const currentToken = await tokenService.getAccessToken();

      if (currentToken && currentToken.token) {
        console.log('当前令牌有效，无需修复');
        return currentToken;
      }

      // 如果没有有效令牌，尝试刷新
      console.log('尝试刷新令牌...');
      const refreshedToken = await tokenService.refreshAccessToken();

      if (refreshedToken) {
        console.log('令牌刷新成功');
        return refreshedToken;
      } else {
        console.log('令牌刷新失败，需要重新登录');
        return null;
      }
    } catch (error) {
      console.error('修复认证令牌失败:', error);
      return null;
    }
  }

  /**
   * 清理过期的认证状态
   */
  async cleanupExpiredAuth() {
    try {
      console.log('清理过期的认证状态...');

      const { tokenService } = require('./tokenService');
      await tokenService.clearTokens();

      console.log('过期认证状态已清理');
      return true;
    } catch (error) {
      console.error('清理过期认证状态失败:', error);
      return false;
    }
  }
}

export default new AuthFixer();
