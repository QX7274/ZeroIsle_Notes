import axios from 'axios';
import { API_BASE_URL } from './config';

const authApi = {
  // 发送验证码
  sendVerificationCode: async (phone) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/users/send_verification_code/`, {
        phone
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // 注册
  register: async (userData) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/users/`, userData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // 登录
  login: async (loginData) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/users/login/`, loginData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // 微信登录
  wechatLogin: async (code) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/users/wechat_login/`, {
        code
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // QQ登录
  qqLogin: async (code) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/users/qq_login/`, {
        code
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // 获取用户信息
  getUserInfo: async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/users/me/`);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // 更新用户信息
  updateUserInfo: async (userData) => {
    try {
      const response = await axios.patch(`${API_BASE_URL}/users/me/`, userData);
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // 修改密码
  changePassword: async (oldPassword, newPassword) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/users/change_password/`, {
        old_password: oldPassword,
        new_password: newPassword
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  },

  // 重置密码
  resetPassword: async (phone, verificationCode, newPassword) => {
    try {
      const response = await axios.post(`${API_BASE_URL}/users/reset_password/`, {
        phone,
        verification_code: verificationCode,
        new_password: newPassword
      });
      return response.data;
    } catch (error) {
      throw error.response?.data || error;
    }
  }
};

export default authApi; 