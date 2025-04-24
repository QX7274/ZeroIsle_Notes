import api from '../api';

export const categoryApi = {
  // 获取分类列表
  getCategories: () => api.get('/api/categories/'),
  
  // 创建分类
  createCategory: (data) => api.post('/api/categories/', data),
  
  // 更新分类
  updateCategory: (id, data) => api.put(`/api/categories/${id}/`, data),
  
  // 删除分类
  deleteCategory: (id) => api.delete(`/api/categories/${id}/`),
  
  // 移动笔记到分类
  moveNotes: (id, noteIds) => api.post(`/api/categories/${id}/move_notes/`, { note_ids: noteIds }),
  
  // 获取分类统计
  getStatistics: () => api.get('/api/categories/statistics/'),
  
  // 获取分类树
  getCategoryTree: () => api.get('/api/categories/tree/'),
  
  // 合并分类
  mergeCategories: (id, targetId) => api.post(`/api/categories/${id}/merge/`, { target_category_id: targetId })
}; 