import api from './authService';

// 获取仪表盘统计数据
export const getDashboardStats = async (params = {}) => {
  try {
    const response = await api.get('/stats/dashboard', { params });
    return response.data?.data ?? response.data;
  } catch (error) {
    console.error('获取仪表盘统计数据错误:', error);
    throw error;
  }
};

// 获取用户统计数据
//
// 修复：原路径 `/users/stats` 不存在 —— 后端是 `/users/profiles/stats/`
// （UserProfileViewSet 的 stats 动作）。UserList / UserAnalytics 都在用它。
// 同时原实现写死 `response.data.data`，而该端点直接返回扁平对象，
// 会把统计整块变成 undefined；这里改为兼容两种形状。
export const getUserStats = async () => {
  try {
    const response = await api.get('/users/profiles/stats/');
    return response.data?.data ?? response.data;
  } catch (error) {
    console.error('获取用户统计数据错误:', error);
    throw error;
  }
};

// 获取笔记统计数据
//
// 修复：后端无 `/notes/stats`，真实路径是 `/content/notes/stats/`。
export const getNoteStats = async () => {
  try {
    const response = await api.get('/content/notes/stats/');
    return response.data?.data ?? response.data;
  } catch (error) {
    console.error('获取笔记统计数据错误:', error);
    throw error;
  }
};

// 获取标签统计数据
//
// 后端**没有** tags 统计端点（TagViewSet 只有标准 CRUD + sync），
// 原 `/tags/stats` 必然 404。现基于真实标签列表自行聚合，
// 保证数字与列表一致，且无需为统计新增后端接口。
export const getTagStats = async () => {
  try {
    const response = await api.get('/content/tags/', { params: { page_size: 200 } });
    const list = response.data?.results ?? response.data ?? [];
    return { total: Array.isArray(list) ? list.length : 0, list };
  } catch (error) {
    console.error('获取标签统计数据错误:', error);
    throw error;
  }
};

// 获取分类统计数据
//
// 同理，后端没有 categories 统计端点，基于真实分类列表聚合。
export const getCategoryStats = async () => {
  try {
    const response = await api.get('/content/categories/', { params: { page_size: 200 } });
    const list = response.data?.results ?? response.data ?? [];
    return { total: Array.isArray(list) ? list.length : 0, list };
  } catch (error) {
    console.error('获取分类统计数据错误:', error);
    throw error;
  }
};

// 获取日志统计数据
export const getLogStats = async () => {
  try {
    const [adminResponse, systemResponse] = await Promise.all([
      api.get('/logs/admin-logs/stats/'),
      api.get('/logs/system-logs/stats/')
    ]);

    const adminData = adminResponse.data?.data || adminResponse.data || {};
    const systemData = systemResponse.data?.data || systemResponse.data || {};

    return {
      totalLogs: (adminData.total_logs || 0) + (systemData.total_logs || 0),
      adminLogs: adminData,
      systemLogs: systemData
    };
  } catch (error) {
    console.error('获取日志统计数据错误:', error);
    throw error;
  }
};

/**
 * 获取用户分析数据
 * @param {Object} params 查询参数
 * @returns {Promise} 返回用户分析数据
 */
export const getUserAnalytics = async (params) => {
  try {
    const response = await api.get('/analytics/analytics/user_analytics/', { params });
    return response.data?.data || response.data;
  } catch (error) {
    console.error('获取用户分析数据失败:', error);
    throw error;
  }
};

/**
 * 获取内容分析数据
 * @param {Object} params 查询参数
 * @returns {Promise} 返回内容分析数据
 */
export const getContentAnalytics = async (params) => {
  try {
    const response = await api.get('/analytics/analytics/content_analytics/', { params });
    return response.data?.data || response.data;
  } catch (error) {
    console.error('获取内容分析数据失败:', error);
    throw error;
  }
};

/**
 * 获取系统分析数据
 * @param {Object} params 查询参数
 * @returns {Promise} 返回系统分析数据
 */
export const getSystemAnalytics = async (params) => {
  try {
    const response = await api.get('/analytics/analytics/system_analytics/', { params });
    return response.data?.data || response.data;
  } catch (error) {
    console.error('获取系统分析数据失败:', error);
    throw error;
  }
};

/**
 * 导出统计数据
 * @param {Object} params 查询参数
 * @returns {Promise} 返回操作结果
 */
export const exportStats = async (params = {}) => {
  try {
    const queryParams = new URLSearchParams(params).toString();
    const url = `/api/analytics/reports/?${queryParams}`;
    window.open(url, '_blank');
    return { success: true };
  } catch (error) {
    console.error('导出统计数据失败:', error);
    throw error;
  }
};
