import api from './authService';

// 获取系统设置
export const getSystemSettings = async (params) => {
  try {
    const response = await api.get('/settings/system/', { params });
    return response.data;
  } catch (error) {
    console.error('获取系统设置错误:', error);
    throw error;
  }
};

// 获取所有系统配置
export const getAllConfigs = async () => {
  try {
    const response = await api.get('/settings/system/all_configs/');
    return response.data;
  } catch (error) {
    console.error('获取所有系统配置错误:', error);
    throw error;
  }
};

// 更新系统配置
export const updateConfig = async (configData) => {
  try {
    const response = await api.post('/settings/system/update_config/', configData);
    return response.data;
  } catch (error) {
    console.error('更新系统配置错误:', error);
    throw error;
  }
};

// 批量更新系统设置
export const batchUpdateSettings = async (settingsData) => {
  try {
    const response = await api.post('/settings/system/batch_update/', settingsData);
    return response.data;
  } catch (error) {
    console.error('批量更新系统设置错误:', error);
    throw error;
  }
};

// 获取系统公告列表
export const getAnnouncements = async (params) => {
  try {
    const response = await api.get('/settings/announcements/', { params });
    return response.data;
  } catch (error) {
    console.error('获取系统公告列表错误:', error);
    throw error;
  }
};

// 获取系统公告详情
export const getAnnouncementDetail = async (id) => {
  try {
    const response = await api.get(`/settings/announcements/${id}/`);
    return response.data;
  } catch (error) {
    console.error('获取系统公告详情错误:', error);
    throw error;
  }
};

// 创建系统公告
export const createAnnouncement = async (announcementData) => {
  try {
    const response = await api.post('/settings/announcements/', announcementData);
    return response.data;
  } catch (error) {
    console.error('创建系统公告错误:', error);
    throw error;
  }
};

// 更新系统公告
export const updateAnnouncement = async (id, announcementData) => {
  try {
    const response = await api.put(`/settings/announcements/${id}/`, announcementData);
    return response.data;
  } catch (error) {
    console.error('更新系统公告错误:', error);
    throw error;
  }
};

// 删除系统公告
export const deleteAnnouncement = async (id) => {
  try {
    const response = await api.delete(`/settings/announcements/${id}/`);
    return response.data;
  } catch (error) {
    console.error('删除系统公告错误:', error);
    throw error;
  }
};

// 发布系统公告
export const publishAnnouncement = async (id, notificationSettings = null) => {
  try {
    const data = notificationSettings ? { notification_settings: notificationSettings } : {};
    const response = await api.post(`/settings/announcements/${id}/publish/`, data);
    return response.data;
  } catch (error) {
    console.error('发布系统公告错误:', error);
    throw error;
  }
};

// 发送公告通知
export const sendAnnouncementNotification = async (id, notificationSettings) => {
  try {
    const response = await api.post(`/settings/announcements/${id}/send_notification/`, {
      notification_settings: notificationSettings
    });
    return response.data;
  } catch (error) {
    console.error('发送公告通知错误:', error);
    throw error;
  }
};

// 设置系统公告为过期
export const expireAnnouncement = async (id) => {
  try {
    const response = await api.post(`/settings/announcements/${id}/expire/`);
    return response.data;
  } catch (error) {
    console.error('设置系统公告为过期错误:', error);
    throw error;
  }
};

// 获取当前有效的系统公告
export const getActiveAnnouncements = async () => {
  try {
    const response = await api.get('/settings/announcements/active/');
    return response.data;
  } catch (error) {
    console.error('获取当前有效的系统公告错误:', error);
    throw error;
  }
};

// 同步系统设置
export const syncSettings = async (options = {}) => {
  try {
    const response = await api.post('/settings/system/sync/', options);
    return response.data;
  } catch (error) {
    console.error('同步系统设置错误:', error);
    throw error;
  }
};

// 同步系统公告
export const syncAnnouncements = async (options = {}) => {
  try {
    const response = await api.post('/settings/announcements/sync/', options);
    return response.data;
  } catch (error) {
    console.error('同步系统公告错误:', error);
    throw error;
  }
};

// 获取系统备份列表
export const getBackups = async (params) => {
  try {
    const response = await api.get('/settings/backups/', { params });
    return response.data;
  } catch (error) {
    console.error('获取系统备份列表错误:', error);
    throw error;
  }
};

// 获取系统备份详情
export const getBackupDetail = async (id) => {
  try {
    const response = await api.get(`/settings/backups/${id}/`);
    return response.data;
  } catch (error) {
    console.error('获取系统备份详情错误:', error);
    throw error;
  }
};

// 创建系统备份
export const createBackup = async (backupData) => {
  try {
    const response = await api.post('/settings/backups/', backupData);
    return response.data;
  } catch (error) {
    console.error('创建系统备份错误:', error);
    throw error;
  }
};

// 删除系统备份
export const deleteBackup = async (id) => {
  try {
    const response = await api.delete(`/settings/backups/${id}/`);
    return response.data;
  } catch (error) {
    console.error('删除系统备份错误:', error);
    throw error;
  }
};

// 恢复系统备份
export const restoreBackup = async (id) => {
  try {
    const response = await api.post(`/settings/backups/${id}/restore/`);
    return response.data;
  } catch (error) {
    console.error('恢复系统备份错误:', error);
    throw error;
  }
};

// 下载系统备份
export const downloadBackup = async (id) => {
  try {
    // 构建URL
    const url = `/api/settings/backups/${id}/download/`;

    // 打开新窗口下载
    window.open(url, '_blank');

    return { status: 'success' };
  } catch (error) {
    console.error('下载系统备份错误:', error);
    throw error;
  }
};

// 获取系统备份信息
export const getBackupInfo = async (id) => {
  try {
    const response = await api.get(`/settings/backups/${id}/info/`);
    return response.data;
  } catch (error) {
    console.error('获取系统备份信息错误:', error);
    throw error;
  }
};

// 创建完整备份
export const createFullBackup = async (backupData = {}) => {
  try {
    const response = await api.post('/settings/backups/create_full_backup/', backupData);
    return response.data;
  } catch (error) {
    console.error('创建完整备份错误:', error);
    throw error;
  }
};

// 创建数据备份
export const createDataBackup = async (backupData = {}) => {
  try {
    const response = await api.post('/settings/backups/create_data_backup/', backupData);
    return response.data;
  } catch (error) {
    console.error('创建数据备份错误:', error);
    throw error;
  }
};

// 创建设置备份
export const createSettingsBackup = async (backupData = {}) => {
  try {
    const response = await api.post('/settings/backups/create_settings_backup/', backupData);
    return response.data;
  } catch (error) {
    console.error('创建设置备份错误:', error);
    throw error;
  }
};
