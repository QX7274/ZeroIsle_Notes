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
    // 验证loginData是否有效
    if (!loginData || typeof loginData !== 'object') {
      return {
        success: false,
        message: '登录信息不完整，请重试'
      };
    }

    const response = await instance.post(API_ENDPOINTS.AUTH.LOGIN, loginData);

    // 验证响应数据是否包含必要的字段
    if (!response.data || !response.data.access || !response.data.refresh || !response.data.user) {
      return {
        success: false,
        message: '服务器返回数据格式错误，请联系管理员'
      };
    }

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
    console.error('登录API错误:', error);

    // 根据错误类型返回不同的错误消息
    if (error.status === 401) {
      return {
        success: false,
        message: '用户名或密码错误',
        error
      };
    }

    return {
      success: false,
      message: error.message || '登录失败，请稍后重试',
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

    // 保存令牌和用户信息
    if (response.data.access && response.data.refresh && response.data.user) {
      await setToken(response.data.access);
      await setRefreshToken(response.data.refresh);
      await setUser(response.data.user);
    }

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
 * 用户名注册
 * @param {object} userData - 用户数据 (username, password)
 * @returns {Promise} - 注册结果
 */
export const registerWithUsername = async (userData) => {
  try {
    const response = await instance.post('/auth/register/username', userData);

    // 保存令牌和用户信息
    if (response.data.access && response.data.refresh && response.data.user) {
      await setToken(response.data.access);
      await setRefreshToken(response.data.refresh);
      await setUser(response.data.user);
    }

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
 * @param {string} type - 验证码类型 (login/register)
 * @returns {Promise} - 发送结果
 */
export const sendVerificationCode = async (phone, type = 'login') => {
  try {
    const response = await instance.post('/auth/send_verification_code/', {
      phone,
      type
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
 * 手机号+验证码登录
 * @param {object} loginData - 登录数据 (phone, code)
 * @returns {Promise} - 登录结果
 */
export const loginWithCode = async (loginData) => {
  try {
    const response = await instance.post('/auth/login/code', loginData);

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
 * 手机号+验证码注册
 * @param {object} userData - 用户数据 (phone, code, password)
 * @returns {Promise} - 注册结果
 */
export const registerWithPhone = async (userData) => {
  try {
    const response = await instance.post('/auth/register/phone', userData);

    // 保存令牌和用户信息
    if (response.data.access && response.data.refresh && response.data.user) {
      await setToken(response.data.access);
      await setRefreshToken(response.data.refresh);
      await setUser(response.data.user);
    }

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
 * 邮箱注册
 * @param {object} userData - 用户数据 (email, password)
 * @returns {Promise} - 注册结果
 */
export const registerWithEmail = async (userData) => {
  try {
    const response = await instance.post('/auth/register/email', userData);

    // 保存令牌和用户信息
    if (response.data.access && response.data.refresh && response.data.user) {
      await setToken(response.data.access);
      await setRefreshToken(response.data.refresh);
      await setUser(response.data.user);
    }

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
  registerWithUsername,
  registerWithEmail,
  registerWithPhone,
  refreshToken,
  getProfile,
  updateProfile,
  changePassword,
  resetPassword,
  sendVerificationCode,
  loginWithCode,
  wechatLogin,
  qqLogin,
  logout
};

export default authApi;