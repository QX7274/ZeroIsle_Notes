import axios from 'axios';
import { API_URL } from '../config';
import AsyncStorage from '@react-native-async-storage/async-storage';

const api = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json'
  }
});

// 请求拦截器
api.interceptors.request.use(
  async config => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('获取token失败:', error);
    }
    return config;
  },
  error => {
    return Promise.reject(error);
  }
);

// 响应拦截器
api.interceptors.response.use(
  response => response.data,
  error => {
    if (error.response) {
      switch (error.response.status) {
        case 401:
          // 处理未授权
          break;
        case 403:
          // 处理禁止访问
          break;
        case 404:
          // 处理未找到
          break;
        case 500:
          // 处理服务器错误
          break;
        default:
          // 处理其他错误
          break;
      }
    }
    return Promise.reject(error);
  }
);

export const notesApi = {
  getAll: () => api.get('/notes'),
  getById: (id) => api.get(`/notes/${id}`),
  create: (data) => api.post('/notes', data),
  update: (id, data) => api.put(`/notes/${id}`, data),
  delete: (id) => api.delete(`/notes/${id}`),
  search: (query) => api.get(`/notes/search?q=${query}`),
  share: (id, data) => api.post(`/notes/${id}/share`, data)
};

export const userApi = {
  // 登录相关
  login: (data) => api.post('/auth/login', data),
  loginWithPassword: (data) => api.post('/auth/login/password', data),
  loginWithCode: (data) => api.post('/auth/login/code', data),
  loginWithEmail: (data) => api.post('/auth/login/email', data),

  // 注册相关
  register: (data) => api.post('/auth/register', data),
  registerWithEmail: (data) => api.post('/auth/register/email', data),

  // 验证码相关
  sendVerificationCode: (data) => api.post('/auth/verification-code', data),
  verifyCode: (data) => api.post('/auth/verify-code', data),

  // 用户信息相关
  getProfile: () => api.get('/user/profile'),
  updateProfile: (data) => api.put('/user/profile', data),
  changePassword: (data) => api.post('/user/change-password', data),
  resetPassword: (data) => api.post('/auth/reset-password', data),

  // 第三方登录
  loginWithWechat: (data) => api.post('/auth/login/wechat', data),
  loginWithQQ: (data) => api.post('/auth/login/qq', data)
};

export const remindersApi = {
  getAll: () => api.get('/reminders'),
  getById: (id) => api.get(`/reminders/${id}`),
  create: (data) => api.post('/reminders', data),
  update: (id, data) => api.put(`/reminders/${id}`, data),
  delete: (id) => api.delete(`/reminders/${id}`)
};