import api from './authService';

// 获取用户笔记
export const getUserNotes = async (userId, params) => {
  try {
    const response = await api.get('/content/notes/', {
      params: {
        ...params,
        userId: userId
      }
    });
    return response.data;
  } catch (error) {
    console.error('获取用户笔记错误:', error);
    throw error;
  }
};

// 获取用户评论
export const getUserComments = async (userId, params) => {
  try {
    const response = await api.get('/content/comments/', {
      params: {
        ...params,
        userId: userId
      }
    });
    return response.data;
  } catch (error) {
    console.error('获取用户评论错误:', error);
    throw error;
  }
};

// 获取笔记评论
export const getNoteComments = async (noteId, params) => {
  try {
    const response = await api.get('/content/comments/', {
      params: {
        ...params,
        noteId: noteId
      }
    });
    return response.data;
  } catch (error) {
    console.error('获取笔记评论错误:', error);
    throw error;
  }
};

// 删除评论
export const deleteComment = async (commentId) => {
  try {
    const response = await api.delete(`/content/comments/${commentId}/`);
    return response.data;
  } catch (error) {
    console.error('删除评论错误:', error);
    throw error;
  }
};

// 获取笔记附件
export const getNoteAttachments = async (noteId, params) => {
  try {
    const response = await api.get('/content/attachments/', {
      params: {
        ...params,
        noteId: noteId
      }
    });
    return response.data;
  } catch (error) {
    console.error('获取笔记附件错误:', error);
    throw error;
  }
};

// 删除附件
export const deleteAttachment = async (attachmentId) => {
  try {
    const response = await api.delete(`/content/attachments/${attachmentId}/`);
    return response.data;
  } catch (error) {
    console.error('删除附件错误:', error);
    throw error;
  }
};

// 获取内容统计数据
export const getContentStats = async (params) => {
  try {
    const response = await api.get('/content/notes/stats/', { params });
    return response.data;
  } catch (error) {
    console.error('获取内容统计数据错误:', error);
    throw error;
  }
};

// 获取热门内容
export const getHotContent = async (params) => {
  try {
    const response = await api.get('/content/hot', { params });
    return response.data;
  } catch (error) {
    console.error('获取热门内容错误:', error);
    throw error;
  }
};

// 获取最新内容
export const getLatestContent = async (params) => {
  try {
    const response = await api.get('/content/latest', { params });
    return response.data;
  } catch (error) {
    console.error('获取最新内容错误:', error);
    throw error;
  }
};

// 获取分类列表
export const getCategories = async (params) => {
  try {
    const response = await api.get('/content/categories/', { params });
    return response.data;
  } catch (error) {
    console.error('获取分类列表错误:', error);
    throw error;
  }
};

// 创建分类
export const createCategory = async (categoryData) => {
  try {
    const response = await api.post('/content/categories/', categoryData);
    return response.data;
  } catch (error) {
    console.error('创建分类错误:', error);
    throw error;
  }
};

// 更新分类
export const updateCategory = async (categoryId, categoryData) => {
  try {
    const response = await api.put(`/content/categories/${categoryId}/`, categoryData);
    return response.data;
  } catch (error) {
    console.error('更新分类错误:', error);
    throw error;
  }
};

// 删除分类
export const deleteCategory = async (categoryId) => {
  try {
    const response = await api.delete(`/content/categories/${categoryId}/`);
    return response.data;
  } catch (error) {
    console.error('删除分类错误:', error);
    throw error;
  }
};

// 同步分类数据
export const syncCategories = async (options = {}) => {
  try {
    const response = await api.post('/content/categories/sync/', options);
    return response.data;
  } catch (error) {
    console.error('同步分类数据错误:', error);
    throw error;
  }
};

// 获取标签列表
export const getTags = async (params) => {
  try {
    const response = await api.get('/content/tags/', { params });
    return response.data;
  } catch (error) {
    console.error('获取标签列表错误:', error);
    throw error;
  }
};

// 创建标签
export const createTag = async (tagData) => {
  try {
    const response = await api.post('/content/tags/', tagData);
    return response.data;
  } catch (error) {
    console.error('创建标签错误:', error);
    throw error;
  }
};

// 删除标签
export const deleteTag = async (tagId) => {
  try {
    const response = await api.delete(`/content/tags/${tagId}/`);
    return response.data;
  } catch (error) {
    console.error('删除标签错误:', error);
    throw error;
  }
};

// 同步标签数据
export const syncTags = async (options = {}) => {
  try {
    const response = await api.post('/content/tags/sync/', options);
    return response.data;
  } catch (error) {
    console.error('同步标签数据错误:', error);
    throw error;
  }
};

// 获取举报列表
export const getReports = async (params) => {
  try {
    const response = await api.get('/content/reports/', { params });
    return response.data;
  } catch (error) {
    console.error('获取举报列表错误:', error);
    throw error;
  }
};

// 获取举报详情
export const getReportDetail = async (reportId) => {
  try {
    const response = await api.get(`/content/reports/${reportId}/`);
    return response.data;
  } catch (error) {
    console.error('获取举报详情错误:', error);
    throw error;
  }
};

// 处理举报
export const processReport = async (reportId) => {
  try {
    const response = await api.post(`/content/reports/${reportId}/process/`);
    return response.data;
  } catch (error) {
    console.error('处理举报错误:', error);
    throw error;
  }
};

// 解决举报
export const resolveReport = async (reportId, adminComment) => {
  try {
    const response = await api.post(`/content/reports/${reportId}/resolve/`, { admin_comment: adminComment });
    return response.data;
  } catch (error) {
    console.error('解决举报错误:', error);
    throw error;
  }
};

// 驳回举报
export const rejectReport = async (reportId, adminComment) => {
  try {
    const response = await api.post(`/content/reports/${reportId}/reject/`, { admin_comment: adminComment });
    return response.data;
  } catch (error) {
    console.error('驳回举报错误:', error);
    throw error;
  }
};

// 获取举报统计
export const getReportStats = async () => {
  try {
    const response = await api.get('/content/reports/stats/');
    return response.data;
  } catch (error) {
    console.error('获取举报统计错误:', error);
    throw error;
  }
};

// 同步举报数据
export const syncReports = async (options = {}) => {
  try {
    const response = await api.post('/content/reports/sync/', options);
    return response.data;
  } catch (error) {
    console.error('同步举报数据错误:', error);
    throw error;
  }
};

// 获取笔记列表
export const getNotes = async (params) => {
  try {
    const response = await api.get('/content/notes/', { params });
    return response.data;
  } catch (error) {
    console.error('获取笔记列表错误:', error);
    throw error;
  }
};

// 获取笔记详情
export const getNoteDetail = async (noteId) => {
  try {
    const response = await api.get(`/content/notes/${noteId}/`);
    return response.data;
  } catch (error) {
    console.error('获取笔记详情错误:', error);
    throw error;
  }
};

// 创建笔记
export const createNote = async (noteData) => {
  try {
    const response = await api.post('/content/notes/', noteData);
    return response.data;
  } catch (error) {
    console.error('创建笔记错误:', error);
    throw error;
  }
};

// 更新笔记
export const updateNote = async (noteId, noteData) => {
  try {
    const response = await api.put(`/content/notes/${noteId}/`, noteData);
    return response.data;
  } catch (error) {
    console.error('更新笔记错误:', error);
    throw error;
  }
};

// 删除笔记
export const deleteNote = async (noteId) => {
  try {
    const response = await api.delete(`/content/notes/${noteId}/`);
    return response.data;
  } catch (error) {
    console.error('删除笔记错误:', error);
    throw error;
  }
};

// 批量更新笔记状态
export const batchUpdateNoteStatus = async (noteIds, status) => {
  try {
    const response = await api.post('/content/notes/batch_update_status/', {
      note_ids: noteIds,
      status: status
    });
    return response.data;
  } catch (error) {
    console.error('批量更新笔记状态错误:', error);
    throw error;
  }
};

// 批量删除笔记
export const batchDeleteNotes = async (noteIds) => {
  try {
    const response = await api.post('/content/notes/batch_delete/', { note_ids: noteIds });
    return response.data;
  } catch (error) {
    console.error('批量删除笔记错误:', error);
    throw error;
  }
};

// 导出笔记数据
export const exportNotes = async (filters = {}, noteIds = []) => {
  try {
    const response = await api.post('/content/notes/export/', { filters, note_ids: noteIds });
    return response.data;
  } catch (error) {
    console.error('导出笔记数据错误:', error);
    throw error;
  }
};

// 同步笔记数据
export const syncNotes = async (options = {}) => {
  try {
    const response = await api.post('/content/notes/sync/', options);
    return response.data;
  } catch (error) {
    console.error('同步笔记数据错误:', error);
    throw error;
  }
};

// 批量删除评论
export const batchDeleteComments = async (commentIds) => {
  try {
    const response = await api.post('/content/comments/batch_delete/', { comment_ids: commentIds });
    return response.data;
  } catch (error) {
    console.error('批量删除评论错误:', error);
    throw error;
  }
};

// 同步评论数据
export const syncComments = async (options = {}) => {
  try {
    const response = await api.post('/content/comments/sync/', options);
    return response.data;
  } catch (error) {
    console.error('同步评论数据错误:', error);
    throw error;
  }
};

// 批量删除附件
export const batchDeleteAttachments = async (attachmentIds) => {
  try {
    const response = await api.post('/content/attachments/batch_delete/', { attachment_ids: attachmentIds });
    return response.data;
  } catch (error) {
    console.error('批量删除附件错误:', error);
    throw error;
  }
};

// 同步附件数据
export const syncAttachments = async (options = {}) => {
  try {
    const response = await api.post('/content/attachments/sync/', options);
    return response.data;
  } catch (error) {
    console.error('同步附件数据错误:', error);
    throw error;
  }
};
