import api from './authService';

// 获取管理员操作日志
export const getAdminLogs = async (params) => {
  try {
    const response = await api.get('/logs/admin-logs/', { params });
    return response.data;
  } catch (error) {
    console.error('获取管理员操作日志错误:', error);
    throw error;
  }
};

// 获取管理员操作日志统计
export const getAdminLogStats = async () => {
  try {
    const response = await api.get('/logs/admin-logs/stats/');
    return response.data;
  } catch (error) {
    console.error('获取管理员操作日志统计错误:', error);
    throw error;
  }
};

// 获取系统日志统计
export const getSystemLogStats = async () => {
  try {
    const response = await api.get('/logs/system-logs/stats/');
    return response.data;
  } catch (error) {
    console.error('获取系统日志统计错误:', error);
    throw error;
  }
};

// 清空管理员操作日志
export const clearAdminLogs = async () => {
  try {
    const response = await api.delete('/logs/admin-logs/clear/');
    return response.data?.data || response.data;
  } catch (error) {
    console.error('清空管理员操作日志错误:', error);
    throw error;
  }
};

// 导出管理员操作日志
export const exportAdminLogs = async (params) => {
  try {
    // 构建URL
    const queryParams = new URLSearchParams(params).toString();
    const url = `/api/logs/admin-logs/export/?${queryParams}`;

    // 打开新窗口下载
    window.open(url, '_blank');

    // 记录导出历史
    try {
      await api.post('/logs/export-history/', {
        log_type: 'admin',
        format: params.format || 'csv',
        filter_params: params
      });
    } catch (historyError) {
      console.error('记录导出历史错误:', historyError);
    }

    return { status: 'success' };
  } catch (error) {
    console.error('导出管理员操作日志错误:', error);
    throw error;
  }
};

// 获取系统日志
export const getSystemLogs = async (params) => {
  try {
    const response = await api.get('/logs/system-logs/', { params });
    return response.data;
  } catch (error) {
    console.error('获取系统日志错误:', error);
    throw error;
  }
};

// 清空系统日志
export const clearSystemLogs = async () => {
  try {
    const response = await api.delete('/logs/system-logs/clear/');
    return response.data?.data || response.data;
  } catch (error) {
    console.error('清空系统日志错误:', error);
    throw error;
  }
};

// 导出系统日志
export const exportSystemLogs = async (params) => {
  try {
    // 构建URL
    const queryParams = new URLSearchParams(params).toString();
    const url = `/api/logs/system-logs/export/?${queryParams}`;

    // 打开新窗口下载
    window.open(url, '_blank');

    // 记录导出历史
    try {
      await api.post('/logs/export-history/', {
        log_type: 'system',
        format: params.format || 'csv',
        filter_params: params
      });
    } catch (historyError) {
      console.error('记录导出历史错误:', historyError);
    }

    return { status: 'success' };
  } catch (error) {
    console.error('导出系统日志错误:', error);
    throw error;
  }
};

// 同步管理员操作日志
export const syncAdminLogs = async (options = {}) => {
  try {
    const response = await api.post('/logs/admin-logs/sync/', options);
    return response.data;
  } catch (error) {
    console.error('同步管理员操作日志错误:', error);
    throw error;
  }
};

// 获取日志导出历史
export const getExportHistory = async (params = {}) => {
  try {
    const response = await api.get('/logs/export-history/', { params });
    return response.data;
  } catch (error) {
    console.error('获取日志导出历史错误:', error);
    throw error;
  }
};

// 删除日志导出历史
export const deleteExportHistory = async (id) => {
  try {
    const response = await api.delete(`/logs/export-history/${id}/`);
    return response.data;
  } catch (error) {
    console.error('删除日志导出历史错误:', error);
    throw error;
  }
};

// 获取导出统计数据
export const getExportStats = async () => {
  try {
    const response = await api.get('/logs/export-history/stats/');
    return response.data;
  } catch (error) {
    console.error('获取导出统计数据错误:', error);
    throw error;
  }
};

// 同步系统日志
export const syncSystemLogs = async (options = {}) => {
  try {
    const response = await api.post('/logs/system-logs/sync/', options);
    return response.data;
  } catch (error) {
    console.error('同步系统日志错误:', error);
    throw error;
  }
};

// 获取日志分析数据
export const getLogAnalytics = async (params) => {
  try {
    const response = await api.get('/logs/analytics/', { params });
    return response.data;
  } catch (error) {
    console.error('获取日志分析数据错误:', error);
    throw error;
  }
};

// 获取日志导出历史（兼容别名）
export const getLogExportHistory = async (params = {}) => {
  return getExportHistory(params);
};

// 创建日志备份
export const createLogBackup = async (data) => {
  try {
    const response = await api.post('/logs/backup/', data);
    return response.data;
  } catch (error) {
    console.error('创建日志备份错误:', error);
    throw error;
  }
};

// 获取日志备份列表
export const getLogBackups = async () => {
  try {
    const response = await api.get('/logs/backup/');
    return response.data;
  } catch (error) {
    console.error('获取日志备份列表错误:', error);
    throw error;
  }
};

// 删除日志备份
export const deleteLogBackup = async (backupId) => {
  try {
    const response = await api.delete(`/logs/backup/${backupId}/`);
    return response.data;
  } catch (error) {
    console.error('删除日志备份错误:', error);
    throw error;
  }
};

// 下载日志备份
export const downloadLogBackup = async (backupId) => {
  try {
    const response = await api.get(`/logs/backup/${backupId}/download/`);
    // 处理文件下载
    if (response.data && response.data.download_url) {
      window.open(response.data.download_url, '_blank');
    }
    return response.data;
  } catch (error) {
    console.error('下载日志备份错误:', error);
    throw error;
  }
};
