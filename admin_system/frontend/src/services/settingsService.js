import api from './authService';

// 获取系统配置
export const getSystemConfig = async () => {
  try {
    const response = await api.get('/settings/system');
    return response.data;
  } catch (error) {
    console.error('获取系统配置错误:', error);
    throw error;
  }
};

// 更新系统配置
export const updateSystemConfig = async (configData) => {
  try {
    const response = await api.put('/settings/system', configData);
    return response.data;
  } catch (error) {
    console.error('更新系统配置错误:', error);
    throw error;
  }
};

// 获取安全配置
export const getSecurityConfig = async () => {
  try {
    const response = await api.get('/settings/security');
    return response.data;
  } catch (error) {
    console.error('获取安全配置错误:', error);
    throw error;
  }
};

// 更新安全配置
export const updateSecurityConfig = async (configData) => {
  try {
    const response = await api.put('/settings/security', configData);
    return response.data;
  } catch (error) {
    console.error('更新安全配置错误:', error);
    throw error;
  }
};

// 获取管理员列表
export const getAdmins = async (params) => {
  try {
    const response = await api.get('/settings/admins', { params });
    return response.data;
  } catch (error) {
    console.error('获取管理员列表错误:', error);
    throw error;
  }
};

// 创建管理员
export const createAdmin = async (adminData) => {
  try {
    const response = await api.post('/settings/admins', adminData);
    return response.data;
  } catch (error) {
    console.error('创建管理员错误:', error);
    throw error;
  }
};

// 更新管理员
export const updateAdmin = async (id, adminData) => {
  try {
    const response = await api.put(`/settings/admins/${id}`, adminData);
    return response.data;
  } catch (error) {
    console.error('更新管理员错误:', error);
    throw error;
  }
};

// 删除管理员
export const deleteAdmin = async (id) => {
  try {
    const response = await api.delete(`/settings/admins/${id}`);
    return response.data;
  } catch (error) {
    console.error('删除管理员错误:', error);
    throw error;
  }
};

// 获取角色列表
export const getRoles = async () => {
  try {
    const response = await api.get('/settings/roles');
    return response.data;
  } catch (error) {
    console.error('获取角色列表错误:', error);
    throw error;
  }
};

// 创建角色
export const createRole = async (roleData) => {
  try {
    const response = await api.post('/settings/roles', roleData);
    return response.data;
  } catch (error) {
    console.error('创建角色错误:', error);
    throw error;
  }
};

// 更新角色
export const updateRole = async (id, roleData) => {
  try {
    const response = await api.put(`/settings/roles/${id}`, roleData);
    return response.data;
  } catch (error) {
    console.error('更新角色错误:', error);
    throw error;
  }
};

// 删除角色
export const deleteRole = async (id) => {
  try {
    const response = await api.delete(`/settings/roles/${id}`);
    return response.data;
  } catch (error) {
    console.error('删除角色错误:', error);
    throw error;
  }
};

// 获取系统公告列表
export const getAnnouncements = async (params) => {
  try {
    const response = await api.get('/settings/announcements', { params });
    return response.data;
  } catch (error) {
    console.error('获取系统公告列表错误:', error);
    throw error;
  }
};

// 创建系统公告
export const createAnnouncement = async (announcementData) => {
  try {
    const response = await api.post('/settings/announcements', announcementData);
    return response.data;
  } catch (error) {
    console.error('创建系统公告错误:', error);
    throw error;
  }
};

// 更新系统公告
export const updateAnnouncement = async (id, announcementData) => {
  try {
    const response = await api.put(`/settings/announcements/${id}`, announcementData);
    return response.data;
  } catch (error) {
    console.error('更新系统公告错误:', error);
    throw error;
  }
};

// 删除系统公告
export const deleteAnnouncement = async (id) => {
  try {
    const response = await api.delete(`/settings/announcements/${id}`);
    return response.data;
  } catch (error) {
    console.error('删除系统公告错误:', error);
    throw error;
  }
};

// 创建数据库备份
export const createBackup = async () => {
  try {
    const response = await api.post('/settings/backup');
    return response.data;
  } catch (error) {
    console.error('创建数据库备份错误:', error);
    throw error;
  }
};

// 获取备份列表
export const getBackups = async () => {
  try {
    const response = await api.get('/settings/backup');
    return response.data;
  } catch (error) {
    console.error('获取备份列表错误:', error);
    throw error;
  }
};

// 恢复数据库
export const restoreBackup = async (backupId) => {
  try {
    const response = await api.post(`/settings/backup/${backupId}/restore`);
    return response.data;
  } catch (error) {
    console.error('恢复数据库错误:', error);
    throw error;
  }
};

// 删除备份
export const deleteBackup = async (backupId) => {
  try {
    const response = await api.delete(`/settings/backup/${backupId}`);
    return response.data;
  } catch (error) {
    console.error('删除备份错误:', error);
    throw error;
  }
};
