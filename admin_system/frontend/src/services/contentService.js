import api from './authService';

// 获取用户笔记
export const getUserNotes = async (userId, params) => {
  try {
    const response = await api.get(`/users/${userId}/notes`, { params });
    return response.data;
  } catch (error) {
    console.error('获取用户笔记错误:', error);
    throw error;
  }
};

// 获取用户评论
export const getUserComments = async (userId, params) => {
  try {
    const response = await api.get(`/users/${userId}/comments`, { params });
    return response.data;
  } catch (error) {
    console.error('获取用户评论错误:', error);
    throw error;
  }
};

// 获取笔记评论
export const getNoteComments = async (noteId, params) => {
  try {
    const response = await api.get(`/notes/${noteId}/comments`, { params });
    return response.data;
  } catch (error) {
    console.error('获取笔记评论错误:', error);
    throw error;
  }
};

// 删除评论
export const deleteComment = async (commentId) => {
  try {
    const response = await api.delete(`/comments/${commentId}`);
    return response.data;
  } catch (error) {
    console.error('删除评论错误:', error);
    throw error;
  }
};

// 获取笔记附件
export const getNoteAttachments = async (noteId, params) => {
  try {
    const response = await api.get(`/notes/${noteId}/attachments`, { params });
    return response.data;
  } catch (error) {
    console.error('获取笔记附件错误:', error);
    throw error;
  }
};

// 删除附件
export const deleteAttachment = async (attachmentId) => {
  try {
    const response = await api.delete(`/attachments/${attachmentId}`);
    return response.data;
  } catch (error) {
    console.error('删除附件错误:', error);
    throw error;
  }
};

// 获取内容统计数据
export const getContentStats = async (params) => {
  try {
    const response = await api.get('/content/stats', { params });
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
