import api from './authService';

// 获取笔记列表
export const getNotes = async (params) => {
  try {
    const response = await api.get('/notes', { params });
    return response.data;
  } catch (error) {
    console.error('获取笔记列表错误:', error);
    throw error;
  }
};

// 获取笔记详情
export const getNoteDetail = async (id) => {
  try {
    const response = await api.get(`/notes/${id}`);
    return response.data;
  } catch (error) {
    console.error('获取笔记详情错误:', error);
    throw error;
  }
};

// 创建笔记
export const createNote = async (noteData) => {
  try {
    const response = await api.post('/notes', noteData);
    return response.data;
  } catch (error) {
    console.error('创建笔记错误:', error);
    throw error;
  }
};

// 更新笔记
export const updateNote = async (id, noteData) => {
  try {
    const response = await api.put(`/notes/${id}`, noteData);
    return response.data;
  } catch (error) {
    console.error('更新笔记错误:', error);
    throw error;
  }
};

// 删除笔记
export const deleteNote = async (id) => {
  try {
    const response = await api.delete(`/notes/${id}`);
    return response.data;
  } catch (error) {
    console.error('删除笔记错误:', error);
    throw error;
  }
};

// 更新笔记状态
export const updateNoteStatus = async (id, status) => {
  try {
    const response = await api.patch(`/notes/${id}/status`, { status });
    return response.data;
  } catch (error) {
    console.error('更新笔记状态错误:', error);
    throw error;
  }
};

// 获取笔记版本历史
export const getNoteVersions = async (id) => {
  try {
    const response = await api.get(`/notes/${id}/versions`);
    return response.data;
  } catch (error) {
    console.error('获取笔记版本历史错误:', error);
    throw error;
  }
};

// 恢复笔记到指定版本
export const restoreNoteVersion = async (id, versionId) => {
  try {
    const response = await api.post(`/notes/${id}/versions/${versionId}/restore`);
    return response.data;
  } catch (error) {
    console.error('恢复笔记版本错误:', error);
    throw error;
  }
};

// 获取笔记统计数据
export const getNoteStats = async () => {
  try {
    const response = await api.get('/notes/stats');
    return response.data;
  } catch (error) {
    console.error('获取笔记统计数据错误:', error);
    throw error;
  }
};
