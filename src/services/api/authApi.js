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

    console.log('登录请求数据:', loginData);

    const response = await instance.post(API_ENDPOINTS.AUTH.LOGIN, loginData);

    console.log('登录响应数据:', response.data);

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
    console.log('注册请求数据:', userData);

    const response = await instance.post(API_ENDPOINTS.AUTH.REGISTER, userData);

    console.log('注册响应数据:', response.data);

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
    console.error('注册错误:', error);
    console.error('错误详情:', error.response?.data || error.message);

    return {
      success: false,
      message: error.response?.data?.detail || error.message || '注册失败',
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
    console.log('用户名注册请求数据:', userData);

    const response = await instance.post(API_ENDPOINTS.AUTH.REGISTER_USERNAME, userData);

    console.log('用户名注册响应数据:', response.data);

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
    console.error('用户名注册失败:', error);
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
    console.log('刷新令牌请求数据:', refreshToken);

    const response = await instance.post(API_ENDPOINTS.AUTH.REFRESH_TOKEN, {
      refresh: refreshToken
    });

    console.log('刷新令牌响应数据:', response.data);

    // 保存新的访问令牌
    await setToken(response.data.access);

    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('刷新令牌失败:', error);
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
    console.log('获取用户资料请求');

    const response = await instance.get(API_ENDPOINTS.AUTH.PROFILE);

    console.log('获取用户资料响应数据:', response.data);

    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('获取用户资料失败:', error);
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
    console.log('更新用户资料请求数据:', profileData);

    const response = await instance.put(API_ENDPOINTS.AUTH.PROFILE, profileData);

    console.log('更新用户资料响应数据:', response.data);

    // 更新本地存储的用户信息
    await setUser(response.data);

    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('更新用户资料失败:', error);
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
    console.log('修改密码请求数据:', { oldPassword, newPassword });

    const response = await instance.post(API_ENDPOINTS.AUTH.CHANGE_PASSWORD, {
      old_password: oldPassword,
      new_password: newPassword
    });

    console.log('修改密码响应数据:', response.data);

    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('修改密码失败:', error);
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
    console.log('重置密码请求数据:', { email });

    const response = await instance.post(API_ENDPOINTS.AUTH.RESET_PASSWORD, {
      email
    });

    console.log('重置密码响应数据:', response.data);

    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('重置密码失败:', error);
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
    console.log('发送验证码:', phone, type);

    const response = await instance.post(API_ENDPOINTS.AUTH.SEND_VERIFICATION_CODE, {
      phone,
      type
    });

    console.log('验证码发送响应:', response.data);

    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('发送验证码失败:', error);
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
    console.log('验证码登录请求数据:', loginData);

    const response = await instance.post(API_ENDPOINTS.AUTH.LOGIN_CODE, loginData);

    console.log('验证码登录响应数据:', response.data);

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
    console.error('验证码登录失败:', error);
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
    console.log('手机号注册请求数据:', userData);

    const response = await instance.post(API_ENDPOINTS.AUTH.REGISTER_PHONE, userData);

    console.log('手机号注册响应数据:', response.data);

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
    console.error('手机号注册失败:', error);
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
    console.log('邮箱注册请求数据:', userData);

    const response = await instance.post(API_ENDPOINTS.AUTH.REGISTER_EMAIL, userData);

    console.log('邮箱注册响应数据:', response.data);

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
    console.error('邮箱注册失败:', error);
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
    console.log('微信登录请求数据:', code);

    const response = await instance.post(API_ENDPOINTS.AUTH.LOGIN_WECHAT, {
      code
    });

    console.log('微信登录响应数据:', response.data);

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
    console.error('微信登录失败:', error);
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
    console.log('QQ登录请求数据:', code);

    const response = await instance.post(API_ENDPOINTS.AUTH.LOGIN_QQ, {
      code
    });

    console.log('QQ登录响应数据:', response.data);

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
    console.error('QQ登录失败:', error);
    return {
      success: false,
      message: error.message || 'QQ登录失败',
      error
    };
  }
};

/**
 * 绑定邮箱
 * @param {object} bindData - 绑定数据 (email, password)
 * @param {string} token - 访问令牌（可选）
 * @returns {Promise} - 绑定结果
 */
export const bindEmail = async (bindData, token = null) => {
  try {
    console.log('绑定邮箱请求数据:', bindData);

    // 准备请求配置
    const config = {};
    if (token) {
      config.headers = {
        Authorization: `Bearer ${token}`
      };
    }

    // 发送请求
    const response = await instance.post(API_ENDPOINTS.AUTH.BIND_EMAIL, bindData, config);

    console.log('绑定邮箱响应数据:', response.data);

    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('绑定邮箱失败:', error);
    return {
      success: false,
      message: error.message || '绑定邮箱失败',
      error
    };
  }
};

/**
 * 绑定手机号
 * @param {object} bindData - 绑定数据 (phone, code, password)
 * @param {string} token - 访问令牌（可选）
 * @returns {Promise} - 绑定结果
 */
export const bindPhone = async (bindData, token = null) => {
  try {
    console.log('绑定手机号请求数据:', bindData);

    // 准备请求配置
    const config = {};
    if (token) {
      config.headers = {
        Authorization: `Bearer ${token}`
      };
    }

    // 发送请求
    const response = await instance.post(API_ENDPOINTS.AUTH.BIND_PHONE, bindData, config);

    console.log('绑定手机号响应数据:', response.data);

    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('绑定手机号失败:', error);
    return {
      success: false,
      message: error.message || '绑定手机号失败',
      error
    };
  }
};

/**
 * 绑定微信
 * @param {string} code - 微信授权码
 * @param {string} token - 访问令牌（可选）
 * @returns {Promise} - 绑定结果
 */
export const bindWechat = async (code, token = null) => {
  try {
    console.log('绑定微信请求数据:', code);

    // 准备请求配置
    const config = {};
    if (token) {
      config.headers = {
        Authorization: `Bearer ${token}`
      };
    }

    // 发送请求
    const response = await instance.post(API_ENDPOINTS.AUTH.BIND_WECHAT, { code }, config);

    console.log('绑定微信响应数据:', response.data);

    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('绑定微信失败:', error);
    return {
      success: false,
      message: error.message || '绑定微信失败',
      error
    };
  }
};

/**
 * 绑定QQ
 * @param {string} code - QQ授权码
 * @param {string} token - 访问令牌（可选）
 * @returns {Promise} - 绑定结果
 */
export const bindQQ = async (code, token = null) => {
  try {
    console.log('绑定QQ请求数据:', code);

    // 准备请求配置
    const config = {};
    if (token) {
      config.headers = {
        Authorization: `Bearer ${token}`
      };
    }

    // 发送请求
    const response = await instance.post(API_ENDPOINTS.AUTH.BIND_QQ, { code }, config);

    console.log('绑定QQ响应数据:', response.data);

    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('绑定QQ失败:', error);
    return {
      success: false,
      message: error.message || '绑定QQ失败',
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
  bindEmail,
  bindPhone,
  bindWechat,
  bindQQ,
  logout
};

export default authApi;