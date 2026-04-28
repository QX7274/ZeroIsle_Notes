import api from './authService';

// 获取分类列表
export const getCategories = async (params) => {
  try {
    const response = await api.get('/categories', { params });
    return response.data;
  } catch (error) {
    console.error('获取分类列表错误:', error);
    throw error;
  }
};

// 获取分类详情
export const getCategoryDetail = async (id) => {
  try {
    const response = await api.get(`/categories/${id}`);
    return response.data;
  } catch (error) {
    console.error('获取分类详情错误:', error);
    throw error;
  }
};

// 创建分类
export const createCategory = async (categoryData) => {
  try {
    const response = await api.post('/categories', categoryData);
    return response.data;
  } catch (error) {
    console.error('创建分类错误:', error);
    throw error;
  }
};

// 更新分类
export const updateCategory = async (id, categoryData) => {
  try {
    const response = await api.put(`/categories/${id}`, categoryData);
    return response.data;
  } catch (error) {
    console.error('更新分类错误:', error);
    throw error;
  }
};

// 删除分类
export const deleteCategory = async (id) => {
  try {
    const response = await api.delete(`/categories/${id}`);
    return response.data;
  } catch (error) {
    console.error('删除分类错误:', error);
    throw error;
  }
};

// 获取分类统计数据
export const getCategoryStats = async () => {
  try {
    const response = await api.get('/categories/stats');
    return response.data;
  } catch (error) {
    console.error('获取分类统计数据错误:', error);
    throw error;
  }
};
