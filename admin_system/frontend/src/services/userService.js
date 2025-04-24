import api from './authService';

// 获取用户列表
export const getUsers = async (params) => {
  try {
    const response = await api.get('/users', { params });
    return response.data.data;
  } catch (error) {
    console.error('获取用户列表错误:', error);
    throw error;
  }
};

// 获取用户详情
export const getUserDetail = async (id) => {
  try {
    const response = await api.get(`/users/${id}`);
    return response.data.data;
  } catch (error) {
    console.error('获取用户详情错误:', error);
    throw error;
  }
};

// 创建用户
export const createUser = async (userData) => {
  try {
    const response = await api.post('/users', userData);
    return response.data.data;
  } catch (error) {
    console.error('创建用户错误:', error);
    throw error;
  }
};

// 更新用户
export const updateUser = async (id, userData) => {
  try {
    const response = await api.put(`/users/${id}`, userData);
    return response.data;
  } catch (error) {
    console.error('更新用户错误:', error);
    throw error;
  }
};

// 删除用户
export const deleteUser = async (id) => {
  try {
    const response = await api.delete(`/users/${id}`);
    return response.data;
  } catch (error) {
    console.error('删除用户错误:', error);
    throw error;
  }
};

// 更新用户状态
export const updateUserStatus = async (id, status) => {
  try {
    const response = await api.patch(`/users/${id}/status`, { status });
    return response.data;
  } catch (error) {
    console.error('更新用户状态错误:', error);
    throw error;
  }
};

// 重置用户密码
export const resetUserPassword = async (id) => {
  try {
    const response = await api.post(`/users/${id}/reset-password`);
    return response.data;
  } catch (error) {
    console.error('重置用户密码错误:', error);
    throw error;
  }
};

// 获取用户统计数据
export const getUserStats = async () => {
  try {
    const response = await api.get('/users/stats');
    return response.data;
  } catch (error) {
    console.error('获取用户统计数据错误:', error);
    throw error;
  }
};
