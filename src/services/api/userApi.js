import instance from './interceptor';
import { API_ENDPOINTS } from '../../config/api';

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
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || '获取用户信息失败',
        error
      };
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
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || '更新用户信息失败',
        error
      };
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
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || '上传头像失败',
        error
      };
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
        type: 'bind'
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
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || '绑定手机号失败',
        error
      };
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
        type: 'bind'
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
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || '绑定邮箱失败',
        error
      };
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
        data: response.data
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || '修改密码失败',
        error
      };
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
        user_info: userInfo
      });
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
        user_info: userInfo
      });
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
  },
};

export default userApi;
