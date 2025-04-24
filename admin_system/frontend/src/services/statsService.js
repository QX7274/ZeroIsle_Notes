import api from './authService';

// 获取仪表盘统计数据
export const getDashboardStats = async () => {
  try {
    const response = await api.get('/stats/dashboard');
    return response.data.data;
  } catch (error) {
    console.error('获取仪表盘统计数据错误:', error);
    throw error;
  }
};

// 获取用户统计数据
export const getUserStats = async () => {
  try {
    const response = await api.get('/users/stats');
    return response.data.data;
  } catch (error) {
    console.error('获取用户统计数据错误:', error);
    throw error;
  }
};

// 获取笔记统计数据
export const getNoteStats = async () => {
  try {
    const response = await api.get('/notes/stats');
    return response.data.data;
  } catch (error) {
    console.error('获取笔记统计数据错误:', error);
    throw error;
  }
};

// 获取标签统计数据
export const getTagStats = async () => {
  try {
    const response = await api.get('/tags/stats');
    return response.data.data;
  } catch (error) {
    console.error('获取标签统计数据错误:', error);
    throw error;
  }
};

// 获取分类统计数据
export const getCategoryStats = async () => {
  try {
    const response = await api.get('/categories/stats');
    return response.data.data;
  } catch (error) {
    console.error('获取分类统计数据错误:', error);
    throw error;
  }
};

// 获取日志统计数据
export const getLogStats = async () => {
  try {
    const response = await api.get('/stats/logs');
    return response.data.data;
  } catch (error) {
    console.error('获取日志统计数据错误:', error);
    throw error;
  }
};
