import instance from './apiClient';
import { API_ENDPOINTS } from '../../config/api';
import networkService from '../network/networkService';

/**
 * 用户相关API服务
 */
const userApi = {
  /**
   * 获取用户信息
   * @returns {Promise} - 用户信息
   */
  getUserInfo: async () => {
    try {
      const response = await instance.get(API_ENDPOINTS.AUTH.PROFILE);
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      throw error;
    }
  },

  /**
   * 更新用户信息
   * @param {object} data - 用户信息
   * @returns {Promise} - 更新结果
   */
  updateProfile: async (data) => {
    try {
      const response = await instance.put(API_ENDPOINTS.AUTH.PROFILE, data);
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      throw error;
    }
  },

  /**
   * 上传头像
   * @param {FormData} formData - 头像表单数据
   * @returns {Promise} - 上传结果
   */
  uploadAvatar: async (formData) => {
    try {
      const response = await instance.post('/auth/avatar/upload/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      throw error;
    }
  },

  /**
   * 发送手机验证码
   * @param {string} phone - 手机号
   * @returns {Promise} - 发送结果
   */
  sendPhoneCode: async (phone) => {
    try {
      const response = await instance.post(API_ENDPOINTS.AUTH.SEND_VERIFICATION_CODE, {
        phone,
        type: 'bind',
      });
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      throw error;
    }
  },

  /**
   * 绑定手机号
   * @param {object} data - 绑定数据
   * @returns {Promise} - 绑定结果
   */
  bindPhone: async (data) => {
    try {
      const response = await instance.post(API_ENDPOINTS.AUTH.BIND_PHONE, data);
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      throw error;
    }
  },

  /**
   * 发送邮箱验证码
   * @param {string} email - 邮箱
   * @returns {Promise} - 发送结果
   */
  sendEmailCode: async (email) => {
    try {
      const response = await instance.post(API_ENDPOINTS.AUTH.SEND_VERIFICATION_CODE, {
        email,
        type: 'bind',
      });
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      throw error;
    }
  },

  /**
   * 绑定邮箱
   * @param {object} data - 绑定数据
   * @returns {Promise} - 绑定结果
   */
  bindEmail: async (data) => {
    try {
      const response = await instance.post(API_ENDPOINTS.AUTH.BIND_EMAIL, data);
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      throw error;
    }
  },

  /**
   * 修改密码
   * @param {object} data - 密码数据
   * @returns {Promise} - 修改结果
   */
  changePassword: async (data) => {
    try {
      const response = await instance.post(API_ENDPOINTS.AUTH.CHANGE_PASSWORD, data);
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      throw error;
    }
  },

  /**
   * 微信登录
   * @param {string} code - 微信授权码
   * @param {object} userInfo - 微信用户信息
   * @returns {Promise} - 登录结果
   */
  wechatLogin: async (code, userInfo) => {
    try {
      const response = await instance.post('/auth/wechat/login/', {
        code,
        user_info: userInfo,
      });
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      throw error;
    }
  },

  /**
   * QQ登录
   * @param {string} code - QQ授权码
   * @param {object} userInfo - QQ用户信息
   * @returns {Promise} - 登录结果
   */
  qqLogin: async (code, userInfo) => {
    try {
      const response = await instance.post('/auth/qq/login/', {
        code,
        user_info: userInfo,
      });
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      throw error;
    }
  },

  /**
   * 用户名注册
   * @param {string} username - 用户名
   * @param {string} password - 密码
   * @returns {Promise} - 注册结果
   */
  registerWithUsername: async (username, password) => {
    try {
      // 检查网络连接
      const networkState = await networkService.checkConnection();

      if (!networkState?.isOnline) {
        console.log('网络未连接，无法注册');
        throw new Error('注册失败：请连接网络后再尝试注册');
      }

      const response = await instance.post(API_ENDPOINTS.AUTH.REGISTER_USERNAME, {
        username,
        password,
      });
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      throw error;
    }
  },

  /**
   * 手机号+密码注册
   * @param {string} phone - 手机号
   * @param {string} password - 密码
   * @returns {Promise} - 注册结果
   */
  registerWithPhone: async (phone, password) => {
    try {
      // 检查网络连接
      const networkState = await networkService.checkConnection();

      if (!networkState?.isOnline) {
        console.log('网络未连接，无法注册');
        throw new Error('注册失败：请连接网络后再尝试注册');
      }

      const response = await instance.post(API_ENDPOINTS.AUTH.REGISTER_PHONE, {
        phone,
        password,
      });
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      throw error;
    }
  },

  /**
   * 手机号+验证码注册
   * @param {string} phone - 手机号
   * @param {string} code - 验证码
   * @param {string} password - 密码
   * @returns {Promise} - 注册结果
   */
  registerWithPhoneCode: async (phone, code, password) => {
    try {
      // 检查网络连接
      const networkState = await networkService.checkConnection();

      if (!networkState?.isOnline) {
        console.log('网络未连接，无法注册');
        throw new Error('注册失败：请连接网络后再尝试注册');
      }

      const response = await instance.post(API_ENDPOINTS.AUTH.REGISTER_PHONE, {
        phone,
        code,
        password,
      });
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      throw error;
    }
  },

  /**
   * 邮箱注册
   * @param {string} email - 邮箱
   * @param {string} password - 密码
   * @returns {Promise} - 注册结果
   */
  registerWithEmail: async (email, password) => {
    try {
      // 检查网络连接
      const networkState = await networkService.checkConnection();

      if (!networkState?.isOnline) {
        console.log('网络未连接，无法注册');
        throw new Error('注册失败：请连接网络后再尝试注册');
      }

      const response = await instance.post(API_ENDPOINTS.AUTH.REGISTER_EMAIL, {
        email,
        password,
      });
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      throw error;
    }
  },

  /**
   * 绑定微信
   * @param {object} data - 绑定数据
   * @returns {Promise} - 绑定结果
   */
  bindWechat: async (data) => {
    try {
      const response = await instance.post(API_ENDPOINTS.AUTH.BIND_WECHAT, data);
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      throw error;
    }
  },

  /**
   * 解绑微信
   * @returns {Promise} - 解绑结果
   */
  unbindWechat: async () => {
    try {
      const response = await instance.post(API_ENDPOINTS.AUTH.UNBIND_WECHAT);
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      throw error;
    }
  },

  /**
   * 绑定QQ
   * @param {object} data - 绑定数据
   * @returns {Promise} - 绑定结果
   */
  bindQQ: async (data) => {
    try {
      const response = await instance.post(API_ENDPOINTS.AUTH.BIND_QQ, data);
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      throw error;
    }
  },

  /**
   * 解绑QQ
   * @returns {Promise} - 解绑结果
   */
  unbindQQ: async () => {
    try {
      const response = await instance.post(API_ENDPOINTS.AUTH.UNBIND_QQ);
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      throw error;
    }
  },
};

export default userApi;
