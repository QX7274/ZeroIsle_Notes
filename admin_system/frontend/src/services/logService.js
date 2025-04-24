import api from './authService';

// 获取管理员操作日志
export const getAdminLogs = async (params) => {
  try {
    const response = await api.get('/logs/admin', { params });
    return response.data;
  } catch (error) {
    console.error('获取管理员操作日志错误:', error);
    throw error;
  }
};

// 清空管理员操作日志
export const clearAdminLogs = async () => {
  try {
    const response = await api.delete('/logs/admin/clear');
    return response.data;
  } catch (error) {
    console.error('清空管理员操作日志错误:', error);
    throw error;
  }
};

// 导出管理员操作日志
export const exportAdminLogs = async (params) => {
  try {
    const response = await api.get('/logs/admin/export', { 
      params,
      responseType: 'blob'
    });
    
    // 创建下载链接
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `admin-logs-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    
    return true;
  } catch (error) {
    console.error('导出管理员操作日志错误:', error);
    throw error;
  }
};

// 获取系统日志
export const getSystemLogs = async (params) => {
  try {
    const response = await api.get('/logs/system', { params });
    return response.data;
  } catch (error) {
    console.error('获取系统日志错误:', error);
    throw error;
  }
};

// 清空系统日志
export const clearSystemLogs = async () => {
  try {
    const response = await api.delete('/logs/system/clear');
    return response.data;
  } catch (error) {
    console.error('清空系统日志错误:', error);
    throw error;
  }
};

// 导出系统日志
export const exportSystemLogs = async (params) => {
  try {
    const response = await api.get('/logs/system/export', { 
      params,
      responseType: 'blob'
    });
    
    // 创建下载链接
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `system-logs-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    
    return true;
  } catch (error) {
    console.error('导出系统日志错误:', error);
    throw error;
  }
};

// 获取登录日志
export const getLoginLogs = async (params) => {
  try {
    const response = await api.get('/logs/login', { params });
    return response.data;
  } catch (error) {
    console.error('获取登录日志错误:', error);
    throw error;
  }
};

// 清空登录日志
export const clearLoginLogs = async () => {
  try {
    const response = await api.delete('/logs/login/clear');
    return response.data;
  } catch (error) {
    console.error('清空登录日志错误:', error);
    throw error;
  }
};

// 导出登录日志
export const exportLoginLogs = async (params) => {
  try {
    const response = await api.get('/logs/login/export', { 
      params,
      responseType: 'blob'
    });
    
    // 创建下载链接
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `login-logs-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    
    return true;
  } catch (error) {
    console.error('导出登录日志错误:', error);
    throw error;
  }
};
