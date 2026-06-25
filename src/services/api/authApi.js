/**
 * 认证API服务
 */
import instance from './apiClient';
import { API_ENDPOINTS } from '../../config/api';
import { API_URL } from '../../config';
import realmService from '../database/realmService';
import tokenService from '../auth/tokenService';
import authStorage from '../auth/authStorage';
import { saveAuthInfo, clearAuthInfo } from '../auth/authUtils';
import networkErrorService from '../networkErrorService';
import networkService from '../network/networkService';

/**
 * 用户登录
 * @param {object} loginData - 登录数据
 * @returns {Promise} - 登录结果
 */
export const login = async (loginData) => {
  try {
    // 验证loginData是否有效
    if (!loginData || typeof loginData !== 'object') {
      throw new Error('登录信息不完整，请重试');
    }

    // console.log('登录请求数据:', loginData); // 移除敏感日志

    // 确保请求数据格式正确
    const requestData = { ...loginData };

    // 如果没有提供identifier字段，尝试从username/email/phone中提取
    if (!requestData.identifier) {
      if (requestData.username) {
        requestData.identifier = requestData.username;
      } else if (requestData.email) {
        requestData.identifier = requestData.email;
      } else if (requestData.phone) {
        requestData.identifier = requestData.phone;
      }
    }

    // console.log('处理后的登录请求数据:', requestData); // 移除敏感日志

    // 检查网络连接
    const isOnline = await networkService.checkConnection();

    if (!isOnline) {
      console.log('网络未连接，尝试离线登录');

      // 检查是否有离线用户
      const realm = await realmService.getRealm();
      const item = realm.objects('StorageItem').filtered('key = "offline_user"');
      const offlineUserJson = item.length > 0 ? item[0].value : null;

      if (offlineUserJson) {
        const offlineUser = JSON.parse(offlineUserJson);

        // 检查用户名和密码是否匹配
        if (
          (requestData.username && requestData.username === offlineUser.username) ||
          (requestData.identifier && requestData.identifier === offlineUser.username)
        ) {
          console.log('离线模式：检测到本地用户记录，但禁止生成/保存伪造token');

          // 标记离线模式（仅用于UI/流程判断，不代表已完成认证）
          const realm = await realmService.getRealm();
          realm.write(() => {
            const existingItem = realm.objects('StorageItem').filtered('key = "is_offline_mode"');
            if (existingItem.length > 0) {
              existingItem[0].value = 'true';
              existingItem[0].updated_at = new Date();
            } else {
              realm.create('StorageItem', {
                key: 'is_offline_mode',
                value: 'true',
                createdAt: new Date(),
                updated_at: new Date(),
              });
            }
          });

          throw new Error('当前离线：无法完成登录认证，请联网后重试');
        } else {
          throw new Error('用户名或密码错误');
        }
      } else {
        throw new Error('离线模式下未找到用户，请先在有网络连接时注册');
      }
    }

    // 如果网络已连接，尝试正常登录
    const response = await instance.post(API_ENDPOINTS.AUTH.LOGIN, requestData);

    console.log('登录响应数据:', response);

    // 检查响应是否为undefined
    if (!response) {
      console.error('登录响应为undefined');
      throw new Error('服务器无响应，请稍后重试');
    }

    // 检查响应数据
    const responseData = response.data || response;
    console.log('处理后的登录响应数据:', responseData);

    // 检查是否是离线模式的错误响应
    if (responseData.offline && responseData.error === 'NETWORK_ERROR') {
      console.log('离线模式下的登录请求，返回网络错误');
      throw new Error('网络连接失败，请检查网络设置后重试');
    }

    // 验证响应数据是否包含必要的字段
    if (!responseData || !responseData.access || !responseData.refresh || !responseData.user) {
      console.error('登录响应数据格式错误:', responseData);
      throw new Error('服务器返回数据格式错误，请联系管理员');
    }

    // 保存令牌和用户信息
    const { access, refresh, user } = responseData;
    try {
      // 使用统一的认证信息保存函数
      await saveAuthInfo(access, refresh, user);
    } catch (storageError) {
      console.error('保存认证信息时出错:', storageError);
      throw storageError;
    }

    return {
      success: true,
      data: responseData,
    };
  } catch (error) {
    console.error('登录API错误:', error);
    console.error('错误详情:', error.response?.data || error.message);

    if (error.message === 'Network Error' || error.isNetworkError) {
      console.log('登录时发生网络错误');
      throw new Error('网络连接失败，请检查网络设置后重试');
    }

    if (error.response) {
      const { status, data } = error.response;

      console.error('服务器错误响应:', {
        status: error.response.status,
        data: error.response.data,
        headers: error.response.headers,
      });

      if (status === 401) {
        throw new Error('用户名或密码错误');
      }
      if (status === 404) {
        throw new Error('登录服务不可用，请联系管理员');
      }
      if (status === 400 && data && data.error) {
        throw new Error(data.error);
      }
      if (data && data.error) {
        throw new Error(data.error);
      }

      throw new Error(data?.detail || data?.error || `服务器错误 (${status})`);
    }

    if (error.request) {
      console.error('未收到服务器响应:', error.request);
      networkErrorService.handleApiError(error, {
        context: '用户登录',
        customMessage: '服务器无响应，请检查网络连接或服务器状态',
      });
      throw new Error('服务器无响应，请检查网络连接或服务器状态');
    }

    console.error('请求设置错误:', error.message);
    if (networkErrorService.isNetworkError(error)) {
      networkErrorService.handleApiError(error, {
        context: '用户登录',
        customMessage: '网络连接失败，请检查网络设置',
      });
    }
    throw new Error(`请求错误: ${error.message}`);
  }
};

/**
 * 用户注册
 * @param {object} userData - 用户数据
 * @returns {Promise} - 注册结果
 */
export const register = async (userData) => {
  try {
    // 检查网络连接
    const isOnline = await networkService.checkConnection();

    if (!isOnline) {
      console.log('网络未连接，无法注册');
      throw new Error('注册失败：请连接网络后再尝试注册');
    }

    // 添加必要的参数
    const completeUserData = {
      ...userData,
      confirm_password: userData.password, // 添加确认密码
      // 不再自动添加手机号
    };

    console.log('注册请求数据:', completeUserData);

    const response = await instance.post(API_ENDPOINTS.AUTH.REGISTER, completeUserData);

    console.log('注册响应数据:', response.data);

    // 检查响应数据格式
    if (!response.data || !response.data.access || !response.data.refresh || !response.data.user) {
      throw new Error('服务器返回数据格式错误');
    }

    // 确保token是字符串且不为空
    const accessToken = response.data.access?.toString()?.trim();
    const refreshToken = response.data.refresh?.toString()?.trim();

    if (!accessToken || !refreshToken) {
      throw new Error('无效的token格式');
    }

    // 保存令牌和用户信息
    await saveAuthInfo(accessToken, refreshToken, response.data.user);

    return {
      success: true,
      data: {
        token: accessToken,
        refreshToken: refreshToken,
        user: response.data.user,
      },
    };
  } catch (error) {
    console.error('注册错误:', error);
    console.error('错误详情:', error.response?.data || error.message);

    if (error.response) {
      console.error('服务器错误响应:', {
        status: error.response.status,
        data: error.response.data,
        headers: error.response.headers,
      });

      if (error.response.status === 400) {
        const errorData = error.response.data;
        if (errorData && errorData.error === '用户名已存在') {
          throw new Error('用户名已存在');
        }
        if (errorData && errorData.error) {
          throw new Error(errorData.error);
        }
      }

      throw new Error(
        error.response.data?.detail ||
          error.response.data?.error ||
          `服务器错误 (${error.response.status})`
      );
    }

    if (error.request) {
      console.error('未收到服务器响应:', error.request);
      throw new Error('服务器无响应，请检查网络连接或服务器状态');
    }

    console.error('请求设置错误:', error.message);
    throw new Error(`请求错误: ${error.message}`);
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
    console.log('用户名注册端点:', API_ENDPOINTS.AUTH.REGISTER_USERNAME);

    // 打印完整的API URL
    console.log('完整API URL:', `${API_URL}/api/v1${API_ENDPOINTS.AUTH.REGISTER_USERNAME}`);

    // 检查网络连接
    const isOnline = await networkService.checkConnection();

    if (!isOnline) {
      console.log('网络未连接，无法注册');
      throw new Error('注册失败：请连接网络后再尝试注册');
    }

    // 如果网络已连接，尝试正常注册
    let response;

    // 使用instance发送请求
    try {
      console.log('开始发送请求...');
      response = await instance.post(API_ENDPOINTS.AUTH.REGISTER_USERNAME, userData);

      console.log('用户名注册响应数据:', response);
    } catch (error) {
      console.error('请求失败:', error);

      // 如果请求失败，检查是否是网络错误
      if (error.message && error.message.includes('Network Error')) {
        console.error('网络连接错误，可能是服务器CORS配置问题');
        throw new Error('网络连接失败，请检查网络设置或联系管理员');
      } else {
        throw error;
      }
    }

    // 检查响应是否有效
    if (!response) {
      console.error('注册响应为undefined');
      throw new Error('服务器无响应，请稍后重试');
    }

    // 检查响应数据
    const responseData = response.data;
    console.log('处理后的注册响应数据:', responseData);

    // 打印更详细的调试信息
    console.log('response类型:', typeof response);
    console.log('response.data类型:', typeof response.data);
    console.log('response属性:', Object.keys(response));

    // 如果response.data是undefined，尝试直接使用response
    if (!responseData && response) {
      console.log('尝试直接使用response作为响应数据');
      return {
        success: true,
        data: response,
      };
    }

    // 如果响应数据无效，返回错误
    if (!responseData) {
      console.error('注册响应数据为undefined');
      throw new Error('服务器返回数据无效，请联系管理员');
    }

    // 检查响应中是否包含离线标记
    if (response && response.offline === true) {
      console.log('响应中包含离线标记');
      throw new Error(response.message || '网络连接失败，请检查网络设置后重试');
    }

    // 检查响应数据中是否包含离线标记
    if (responseData && responseData.offline === true) {
      console.log('响应数据中包含离线标记');
      throw new Error(responseData.message || '网络连接失败，请检查网络设置后重试');
    }

    // 保存令牌和用户信息
    if (responseData.access && responseData.refresh && responseData.user) {
      try {
        await saveAuthInfo(responseData.access, responseData.refresh, responseData.user);
      } catch (storageError) {
        console.error('保存认证信息时出错:', storageError);
        throw storageError;
      }
    } else {
      console.warn('注册响应数据缺少必要字段');
    }

    return {
      success: true,
      data: responseData,
    };
  } catch (error) {
    console.error('用户名注册失败:', error);

    if (error.response) {
      console.error('服务器错误响应:', {
        status: error.response.status,
        data: error.response.data,
        headers: error.response.headers,
      });

      if (error.response.status === 400) {
        const errorData = error.response.data;
        if (errorData && errorData.error === '用户名已存在') {
          throw new Error('用户名已存在');
        }
        if (errorData && errorData.error) {
          throw new Error(errorData.error);
        }
      }

      throw new Error(
        error.response.data?.detail ||
          error.response.data?.error ||
          `服务器错误 (${error.response.status})`
      );
    }

    if (error.request) {
      console.error('未收到服务器响应:', error.request);
      throw new Error('服务器无响应，请检查网络连接或服务器状态');
    }

    console.error('请求设置错误:', error.message);
    throw new Error(`请求错误: ${error.message}`);
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
      refresh: refreshToken,
    });

    console.log('刷新令牌响应数据:', response.data);

    // 保存新的访问令牌
    try {
      await tokenService.saveAccessToken(response.data.access);

      // 如果响应中包含新的刷新令牌，也保存它
      if (response.data.refresh) {
        await tokenService.saveRefreshToken(response.data.refresh);
      }

      console.log('访问令牌刷新成功');
    } catch (storageError) {
      console.error('保存刷新后的令牌失败:', storageError);
      // 继续执行，不要因为存储错误而中断刷新流程
    }

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('刷新令牌失败:', error);
    throw error;
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
      data: response.data,
    };
  } catch (error) {
    console.error('获取用户资料失败:', error);
    throw error;
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
    await authStorage.saveUser(response.data);

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('更新用户资料失败:', error);
    throw error;
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
      new_password: newPassword,
    });

    console.log('修改密码响应数据:', response.data);

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('修改密码失败:', error);
    throw error;
  }
};

/**
 * 发送密码重置验证码
 * @param {object} data - 包含email或phone的对象
 * @returns {Promise} - 发送结果
 */
export const sendResetCode = async (data) => {
  try {
    console.log('发送密码重置验证码请求数据:', data);

    const response = await instance.post(API_ENDPOINTS.AUTH.SEND_VERIFICATION_CODE, {
      ...data,
      type: 'reset_password',
    });

    console.log('发送密码重置验证码响应数据:', response.data);

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('发送密码重置验证码失败:', error);
    throw error;
  }
};

/**
 * 验证密码重置验证码
 * @param {object} data - 包含email/phone和code的对象
 * @returns {Promise} - 验证结果
 */
export const verifyResetCode = async (data) => {
  try {
    console.log('验证密码重置验证码请求数据:', data);

    const response = await instance.post(API_ENDPOINTS.AUTH.VERIFY_RESET_CODE, {
      ...data,
      type: 'reset_password',
    });

    console.log('验证密码重置验证码响应数据:', response.data);

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('验证密码重置验证码失败:', error);
    throw error;
  }
};

/**
 * 重置密码
 * @param {object} data - 包含email/phone、verification_id和new_password的对象
 * @returns {Promise} - 重置结果
 */
export const resetPassword = async (data) => {
  try {
    console.log('重置密码请求数据:', data);

    const response = await instance.post(API_ENDPOINTS.AUTH.RESET_PASSWORD, data);

    console.log('重置密码响应数据:', response.data);

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('重置密码失败:', error);
    throw error;
  }
};

/**
 * 发送验证码
 * @param {object} data - 包含email或phone的对象，以及type
 * @returns {Promise} - 发送结果
 */
export const sendVerificationCode = async (data) => {
  try {
    console.log('发送验证码请求数据:', data);

    // 确保data是对象
    const requestData = typeof data === 'object' ? data : { phone: data, type: arguments[1] || 'login' };

    const response = await instance.post(API_ENDPOINTS.AUTH.SEND_VERIFICATION_CODE, requestData);
    const responseData = response?.data || response;

    console.log('验证码发送响应:', responseData);

    return {
      success: true,
      data: responseData,
    };
  } catch (error) {
    console.error('发送验证码失败:', error);
    throw error;
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

    const requestData = {
      ...loginData,
      verification_code: loginData?.verification_code || loginData?.code,
    };

    if ('code' in requestData) {
      delete requestData.code;
    }

    const response = await instance.post(API_ENDPOINTS.AUTH.LOGIN_CODE, requestData);
    const responseData = response?.data || response;

    console.log('验证码登录响应数据:', responseData);

    // 保存令牌和用户信息
    const { access, refresh, user } = responseData;
    console.log('验证码登录响应关键字段:', {
      hasAccess: Boolean(access),
      hasRefresh: Boolean(refresh),
      hasUser: Boolean(user),
      userId: user?.id,
      username: user?.username,
    });
    await saveAuthInfo(access, refresh, user);

    return {
      success: true,
      data: responseData,
    };
  } catch (error) {
    console.error('验证码登录失败:', error);
    console.error('验证码登录失败详情:', {
      message: error?.message,
      code: error?.code,
      status: error?.response?.status,
      responseData: error?.response?.data,
    });
    throw error;
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

    // 检查网络连接
    const isOnline = await networkService.checkConnection();

    if (!isOnline) {
      console.log('网络未连接，无法注册');
      throw new Error('注册失败：请连接网络后再尝试注册');
    }

    const response = await instance.post(API_ENDPOINTS.AUTH.REGISTER_PHONE, userData);
    console.log('手机号注册响应数据:', response);

    // 检查是否是离线模式的响应
    if (response.offline === true) {
      console.log('检测到离线模式响应');
      throw new Error(response.data?.message || '网络连接失败，请检查网络设置后重试');
    }

    // 检查响应数据中是否包含离线标记
    if (response.data && response.data.offline === true) {
      console.log('响应数据中包含离线标记');
      throw new Error(response.data.message || '网络连接失败，请检查网络设置后重试');
    }

    console.log('手机号注册响应数据:', response.data);

    // 保存令牌和用户信息
    if (response.data && response.data.access && response.data.refresh && response.data.user) {
      await saveAuthInfo(response.data.access, response.data.refresh, response.data.user);
    }

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('手机号注册失败:', error);
    throw error;
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

    // 检查网络连接
    const isOnline = await networkService.checkConnection();

    if (!isOnline) {
      console.log('网络未连接，无法注册');
      throw new Error('注册失败：请连接网络后再尝试注册');
    }

    const response = await instance.post(API_ENDPOINTS.AUTH.REGISTER_EMAIL, userData);
    console.log('邮箱注册响应数据:', response);

    // 检查是否是离线模式的响应
    if (response.offline === true) {
      console.log('检测到离线模式响应');
      throw new Error(response.data?.message || '网络连接失败，请检查网络设置后重试');
    }

    // 检查响应数据中是否包含离线标记
    if (response.data && response.data.offline === true) {
      console.log('响应数据中包含离线标记');
      throw new Error(response.data.message || '网络连接失败，请检查网络设置后重试');
    }

    console.log('邮箱注册响应数据:', response.data);

    // 保存令牌和用户信息
    if (response.data && response.data.access && response.data.refresh && response.data.user) {
      await saveAuthInfo(response.data.access, response.data.refresh, response.data.user);
    }

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('邮箱注册失败:', error);
    throw error;
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
      code,
    });

    console.log('微信登录响应数据:', response.data);

    // 保存令牌和用户信息
    const { access, refresh, user } = response.data;
    await saveAuthInfo(access, refresh, user);

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('微信登录失败:', error);
    throw error;
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
      code,
    });

    console.log('QQ登录响应数据:', response.data);

    // 保存令牌和用户信息
    const { access, refresh, user } = response.data;
    await saveAuthInfo(access, refresh, user);

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('QQ登录失败:', error);
    throw error;
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
        Authorization: `Bearer ${token}`,
      };
    }

    // 发送请求
    const response = await instance.post(API_ENDPOINTS.AUTH.BIND_EMAIL, bindData, config);

    console.log('绑定邮箱响应数据:', response.data);

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('绑定邮箱失败:', error);
    throw error;
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
        Authorization: `Bearer ${token}`,
      };
    }

    // 发送请求
    const response = await instance.post(API_ENDPOINTS.AUTH.BIND_PHONE, bindData, config);

    console.log('绑定手机号响应数据:', response.data);

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('绑定手机号失败:', error);
    throw error;
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
        Authorization: `Bearer ${token}`,
      };
    }

    // 发送请求
    const response = await instance.post(API_ENDPOINTS.AUTH.BIND_WECHAT, { code }, config);

    console.log('绑定微信响应数据:', response.data);

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('绑定微信失败:', error);
    throw error;
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
        Authorization: `Bearer ${token}`,
      };
    }

    // 发送请求
    const response = await instance.post(API_ENDPOINTS.AUTH.BIND_QQ, { code }, config);

    console.log('绑定QQ响应数据:', response.data);

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('绑定QQ失败:', error);
    throw error;
  }
};

/**
 * 解绑微信
 * @param {string} token - 访问令牌（可选）
 * @returns {Promise} - 解绑结果
 */
export const unbindWechat = async (token = null) => {
  try {
    console.log('解绑微信请求');

    // 准备请求配置
    const config = {};
    if (token) {
      config.headers = {
        Authorization: `Bearer ${token}`,
      };
    }

    // 发送请求
    const response = await instance.post(API_ENDPOINTS.AUTH.UNBIND_WECHAT, {}, config);

    console.log('解绑微信响应数据:', response.data);

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('解绑微信失败:', error);
    throw error;
  }
};

/**
 * 解绑QQ
 * @param {string} token - 访问令牌（可选）
 * @returns {Promise} - 解绑结果
 */
export const unbindQQ = async (token = null) => {
  try {
    console.log('解绑QQ请求');

    // 准备请求配置
    const config = {};
    if (token) {
      config.headers = {
        Authorization: `Bearer ${token}`,
      };
    }

    // 发送请求
    const response = await instance.post(API_ENDPOINTS.AUTH.UNBIND_QQ, {}, config);

    console.log('解绑QQ响应数据:', response.data);

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('解绑QQ失败:', error);
    throw error;
  }
};

/**
 * 用户登出
 * @returns {Promise} - 登出结果
 */
export const logout = async () => {
  try {
    // 清除本地存储的认证信息
    await clearAuthInfo();

    return {
      success: true,
    };
  } catch (error) {
    throw error;
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
  unbindWechat,
  unbindQQ,
  logout,
};

export default authApi;
