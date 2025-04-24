import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:8000/api';

// 创建axios实例
const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// 请求拦截器 - 添加token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('adminToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 响应拦截器 - 处理token过期
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response && error.response.status === 401) {
      // Token过期，清除本地存储并重定向到登录页
      localStorage.removeItem('adminToken');
      localStorage.removeItem('adminUser');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// 登录
export const login = async (username, password) => {
  try {
    const response = await api.post('/auth/login', { username, password });
    return response.data;
  } catch (error) {
    console.error('登录错误:', error);
    throw error;
  }
};

// 退出登录
export const logout = async () => {
  try {
    const response = await api.post('/auth/logout');
    return response.data;
  } catch (error) {
    console.error('退出登录错误:', error);
    throw error;
  }
};

// 检查认证状态
export const checkAuth = async () => {
  try {
    const token = localStorage.getItem('adminToken');
    if (!token) {
      return false;
    }

    const response = await api.get('/auth/check');
    return response.data.data.isAuthenticated;
  } catch (error) {
    console.error('认证检查错误:', error);
    return false;
  }
};

// 获取当前用户信息
export const getCurrentUser = async () => {
  try {
    const response = await api.get('/auth/me');
    return response.data;
  } catch (error) {
    console.error('获取用户信息错误:', error);
    throw error;
  }
};

// 更新用户密码
export const updatePassword = async (oldPassword, newPassword) => {
  try {
    const response = await api.put('/auth/password', { oldPassword, newPassword });
    return response.data;
  } catch (error) {
    console.error('更新密码错误:', error);
    throw error;
  }
};

export default api;
