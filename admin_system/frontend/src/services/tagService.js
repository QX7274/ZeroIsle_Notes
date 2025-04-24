import api from './authService';

// 获取标签列表
export const getTags = async (params) => {
  try {
    const response = await api.get('/tags', { params });
    return response.data;
  } catch (error) {
    console.error('获取标签列表错误:', error);
    throw error;
  }
};

// 获取标签详情
export const getTagDetail = async (id) => {
  try {
    const response = await api.get(`/tags/${id}`);
    return response.data;
  } catch (error) {
    console.error('获取标签详情错误:', error);
    throw error;
  }
};

// 创建标签
export const createTag = async (tagData) => {
  try {
    const response = await api.post('/tags', tagData);
    return response.data;
  } catch (error) {
    console.error('创建标签错误:', error);
    throw error;
  }
};

// 更新标签
export const updateTag = async (id, tagData) => {
  try {
    const response = await api.put(`/tags/${id}`, tagData);
    return response.data;
  } catch (error) {
    console.error('更新标签错误:', error);
    throw error;
  }
};

// 删除标签
export const deleteTag = async (id) => {
  try {
    const response = await api.delete(`/tags/${id}`);
    return response.data;
  } catch (error) {
    console.error('删除标签错误:', error);
    throw error;
  }
};

// 批量删除标签
export const batchDeleteTags = async (ids) => {
  try {
    const response = await api.post('/tags/batch-delete', { ids });
    return response.data;
  } catch (error) {
    console.error('批量删除标签错误:', error);
    throw error;
  }
};

// 合并标签
export const mergeTags = async (sourceId, targetId) => {
  try {
    const response = await api.post('/tags/merge', { sourceId, targetId });
    return response.data;
  } catch (error) {
    console.error('合并标签错误:', error);
    throw error;
  }
};

// 获取标签统计数据
export const getTagStats = async () => {
  try {
    const response = await api.get('/tags/stats');
    return response.data;
  } catch (error) {
    console.error('获取标签统计数据错误:', error);
    throw error;
  }
};
