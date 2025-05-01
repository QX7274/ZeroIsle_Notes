import api from './authService';

// 获取仪表盘数据
export const getDashboardData = async () => {
  try {
    const response = await api.get('/analytics/widgets/dashboard_data/');
    return response.data;
  } catch (error) {
    console.error('获取仪表盘数据错误:', error);
    throw error;
  }
};

// 获取用户分析数据
export const getUserAnalytics = async (params) => {
  try {
    const response = await api.get('/analytics/analytics/user_analytics/', { params });
    return response.data;
  } catch (error) {
    console.error('获取用户分析数据错误:', error);
    throw error;
  }
};

// 获取内容分析数据
export const getContentAnalytics = async (params) => {
  try {
    const response = await api.get('/analytics/analytics/content_analytics/', { params });
    return response.data;
  } catch (error) {
    console.error('获取内容分析数据错误:', error);
    throw error;
  }
};

// 获取系统分析数据
export const getSystemAnalytics = async (params) => {
  try {
    const response = await api.get('/analytics/analytics/system_analytics/', { params });
    return response.data;
  } catch (error) {
    console.error('获取系统分析数据错误:', error);
    throw error;
  }
};

// 获取报表列表
export const getReports = async (params) => {
  try {
    const response = await api.get('/analytics/reports/', { params });
    return response.data;
  } catch (error) {
    console.error('获取报表列表错误:', error);
    throw error;
  }
};

// 获取报表详情
export const getReportDetail = async (reportId) => {
  try {
    const response = await api.get(`/analytics/reports/${reportId}/`);
    return response.data;
  } catch (error) {
    console.error('获取报表详情错误:', error);
    throw error;
  }
};

// 生成报表
export const generateReport = async (reportData) => {
  try {
    const response = await api.post('/analytics/reports/generate/', reportData);
    return response.data;
  } catch (error) {
    console.error('生成报表错误:', error);
    throw error;
  }
};

// 导出报表
export const exportReport = async (reportId, format = 'csv') => {
  try {
    // 构建URL
    const url = `/api/analytics/reports/${reportId}/export/?format=${format}`;
    
    // 打开新窗口下载
    window.open(url, '_blank');
    
    return { status: 'success' };
  } catch (error) {
    console.error('导出报表错误:', error);
    throw error;
  }
};

// 获取报表模板列表
export const getReportTemplates = async (params) => {
  try {
    const response = await api.get('/analytics/templates/', { params });
    return response.data;
  } catch (error) {
    console.error('获取报表模板列表错误:', error);
    throw error;
  }
};

// 获取报表模板详情
export const getReportTemplateDetail = async (templateId) => {
  try {
    const response = await api.get(`/analytics/templates/${templateId}/`);
    return response.data;
  } catch (error) {
    console.error('获取报表模板详情错误:', error);
    throw error;
  }
};

// 使用模板生成报表
export const generateReportFromTemplate = async (templateId, reportData) => {
  try {
    const response = await api.post(`/analytics/templates/${templateId}/generate_report/`, reportData);
    return response.data;
  } catch (error) {
    console.error('使用模板生成报表错误:', error);
    throw error;
  }
};

// 获取仪表盘小部件列表
export const getWidgets = async (params) => {
  try {
    const response = await api.get('/analytics/widgets/', { params });
    return response.data;
  } catch (error) {
    console.error('获取仪表盘小部件列表错误:', error);
    throw error;
  }
};

// 创建仪表盘小部件
export const createWidget = async (widgetData) => {
  try {
    const response = await api.post('/analytics/widgets/', widgetData);
    return response.data;
  } catch (error) {
    console.error('创建仪表盘小部件错误:', error);
    throw error;
  }
};

// 更新仪表盘小部件
export const updateWidget = async (widgetId, widgetData) => {
  try {
    const response = await api.put(`/analytics/widgets/${widgetId}/`, widgetData);
    return response.data;
  } catch (error) {
    console.error('更新仪表盘小部件错误:', error);
    throw error;
  }
};

// 删除仪表盘小部件
export const deleteWidget = async (widgetId) => {
  try {
    const response = await api.delete(`/analytics/widgets/${widgetId}/`);
    return response.data;
  } catch (error) {
    console.error('删除仪表盘小部件错误:', error);
    throw error;
  }
};
