import api from '../api';

export const tagApi = {
  // 获取标签列表
  getTags: () => api.get('/api/tags/'),
  
  // 创建标签
  createTag: (data) => api.post('/api/tags/', data),
  
  // 更新标签
  updateTag: (id, data) => api.put(`/api/tags/${id}/`, data),
  
  // 删除标签
  deleteTag: (id) => api.delete(`/api/tags/${id}/`),
  
  // 获取标签下的笔记
  getTagNotes: (id) => api.get(`/api/tags/${id}/notes/`),
  
  // 为笔记添加标签
  addTagToNote: (tagId, noteId) => api.post(`/api/tags/${tagId}/add_to_note/`, { note_id: noteId }),
  
  // 从笔记移除标签
  removeTagFromNote: (tagId, noteId) => api.post(`/api/tags/${tagId}/remove_from_note/`, { note_id: noteId }),
  
  // 获取标签统计
  getStatistics: () => api.get('/api/tags/statistics/'),
  
  // 搜索标签
  searchTags: (query) => api.get(`/api/tags/search/?q=${query}`)
}; 