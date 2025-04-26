/**
 * 认证API服务
 */
import instance from './interceptor';
import { API_ENDPOINTS } from '../../config/api';
import { setToken, setRefreshToken, setUser, clearAuth } from '../storage';

/**
 * 用户登录
 * @param {object} loginData - 登录数据
 * @returns {Promise} - 登录结果
 */
export const login = async (loginData) => {
  try {
    const response = await instance.post(API_ENDPOINTS.AUTH.LOGIN, loginData);

    // 保存令牌和用户信息
    const { access, refresh, user } = response.data;
    await setToken(access);
    await setRefreshToken(refresh);
    await setUser(user);

    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '登录失败',
      error
    };
  }
};

/**
 * 用户注册
 * @param {object} userData - 用户数据
 * @returns {Promise} - 注册结果
 */
export const register = async (userData) => {
  try {
    const response = await instance.post(API_ENDPOINTS.AUTH.REGISTER, userData);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '注册失败',
      error
    };
  }
};

/**
 * 刷新令牌
 * @param {string} refreshToken - 刷新令牌
 * @returns {Promise} - 刷新结果
 */
export const refreshToken = async (refreshToken) => {
  try {
    const response = await instance.post(API_ENDPOINTS.AUTH.REFRESH_TOKEN, {
      refresh: refreshToken
    });

    // 保存新的访问令牌
    await setToken(response.data.access);

    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '刷新令牌失败',
      error
    };
  }
};

/**
 * 获取用户资料
 * @returns {Promise} - 用户资料
 */
export const getProfile = async () => {
  try {
    const response = await instance.get(API_ENDPOINTS.AUTH.PROFILE);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '获取用户资料失败',
      error
    };
  }
};

/**
 * 更新用户资料
 * @param {object} profileData - 资料数据
 * @returns {Promise} - 更新结果
 */
export const updateProfile = async (profileData) => {
  try {
    const response = await instance.put(API_ENDPOINTS.AUTH.PROFILE, profileData);

    // 更新本地存储的用户信息
    await setUser(response.data);

    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '更新用户资料失败',
      error
    };
  }
};

/**
 * 修改密码
 * @param {string} oldPassword - 旧密码
 * @param {string} newPassword - 新密码
 * @returns {Promise} - 修改结果
 */
export const changePassword = async (oldPassword, newPassword) => {
  try {
    const response = await instance.post(API_ENDPOINTS.AUTH.CHANGE_PASSWORD, {
      old_password: oldPassword,
      new_password: newPassword
    });

    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '修改密码失败',
      error
    };
  }
};

/**
 * 重置密码
 * @param {string} email - 邮箱
 * @returns {Promise} - 重置结果
 */
export const resetPassword = async (email) => {
  try {
    const response = await instance.post(API_ENDPOINTS.AUTH.RESET_PASSWORD, {
      email
    });

    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '重置密码失败',
      error
    };
  }
};

/**
 * 发送验证码
 * @param {string} phone - 手机号
 * @returns {Promise} - 发送结果
 */
export const sendVerificationCode = async (phone) => {
  try {
    const response = await instance.post('/auth/send_verification_code/', {
      phone
    });

    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '发送验证码失败',
      error
    };
  }
};

/**
 * 微信登录
 * @param {string} code - 微信授权码
 * @returns {Promise} - 登录结果
 */
export const wechatLogin = async (code) => {
  try {
    const response = await instance.post('/auth/wechat_login/', {
      code
    });

    // 保存令牌和用户信息
    const { access, refresh, user } = response.data;
    await setToken(access);
    await setRefreshToken(refresh);
    await setUser(user);

    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '微信登录失败',
      error
    };
  }
};

/**
 * QQ登录
 * @param {string} code - QQ授权码
 * @returns {Promise} - 登录结果
 */
export const qqLogin = async (code) => {
  try {
    const response = await instance.post('/auth/qq_login/', {
      code
    });

    // 保存令牌和用户信息
    const { access, refresh, user } = response.data;
    await setToken(access);
    await setRefreshToken(refresh);
    await setUser(user);

    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || 'QQ登录失败',
      error
    };
  }
};

/**
 * 用户登出
 * @returns {Promise} - 登出结果
 */
export const logout = async () => {
  try {
    // 清除本地存储的认证信息
    await clearAuth();

    return {
      success: true
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '登出失败',
      error
    };
  }
};

const authApi = {
  login,
  register,
  refreshToken,
  getProfile,
  updateProfile,
  changePassword,
  resetPassword,
  sendVerificationCode,
  wechatLogin,
  qqLogin,
  logout
};

export default authApi;