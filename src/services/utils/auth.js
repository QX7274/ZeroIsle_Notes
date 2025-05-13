/**
 * 认证工具函数
 */
import authStorage from '../auth/authStorage';

/**
 * 获取访问令牌
 * @returns {Promise<string|null>} 访问令牌
 */
export const getToken = async () => {
  try {
    const token = await authStorage.getItem('access_token');
    return token;
  } catch (error) {
    console.error('获取令牌失败:', error);
    return null;
  }
};

/**
 * 获取刷新令牌
 * @returns {Promise<string|null>} 刷新令牌
 */
export const getRefreshToken = async () => {
  try {
    const refreshToken = await authStorage.getItem('refresh_token');
    return refreshToken;
  } catch (error) {
    console.error('获取刷新令牌失败:', error);
    return null;
  }
};

/**
 * 获取用户信息
 * @returns {Promise<Object|null>} 用户信息
 */
export const getUser = async () => {
  try {
    const user = await authStorage.getItem('user_info');
    return user;
  } catch (error) {
    console.error('获取用户信息失败:', error);
    return null;
  }
};

/**
 * 检查用户是否已登录
 * @returns {Promise<boolean>} 是否已登录
 */
export const isAuthenticated = async () => {
  try {
    const token = await getToken();
    return !!token;
  } catch (error) {
    console.error('检查认证状态失败:', error);
    return false;
  }
};
