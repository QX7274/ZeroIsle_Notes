import api from './authService';

// 模拟数据生成函数
const generateMockData = () => {
  return {
    totalUsers: 1234,
    totalNotes: 5678,
    totalTags: 256,
    totalComments: 789,
    todayNewUsers: 12,
    todayNewNotes: 45,
    userGrowthData: {
      dates: ['2025-01-01', '2025-01-02', '2025-01-03', '2025-01-04', '2025-01-05', '2025-01-06', '2025-01-07'],
      values: [100, 120, 140, 160, 180, 200, 220]
    },
    userActivityData: {
      dates: ['2025-01-01', '2025-01-02', '2025-01-03', '2025-01-04', '2025-01-05', '2025-01-06', '2025-01-07'],
      values: [50, 60, 45, 80, 65, 75, 90]
    },
    contentDistribution: {
      notes: 45,
      images: 25,
      audio: 15,
      video: 10,
      documents: 5
    },
    systemStatus: {
      cpu: 35,
      memory: 60,
      disk: 45
    }
  };
};

// 获取仪表盘统计数据
export const getDashboardStats = async () => {
  try {
    // 实际项目中使用API调用
    // const response = await api.get('/stats/dashboard');
    // return response.data.data;

    // 使用模拟数据
    return generateMockData();
  } catch (error) {
    console.error('获取仪表盘统计数据错误:', error);
    throw error;
  }
};

// 获取用户统计数据
export const getUserStats = async () => {
  try {
    const response = await api.get('/users/stats');
    return response.data.data;
  } catch (error) {
    console.error('获取用户统计数据错误:', error);
    throw error;
  }
};

// 获取笔记统计数据
export const getNoteStats = async () => {
  try {
    const response = await api.get('/notes/stats');
    return response.data.data;
  } catch (error) {
    console.error('获取笔记统计数据错误:', error);
    throw error;
  }
};

// 获取标签统计数据
export const getTagStats = async () => {
  try {
    const response = await api.get('/tags/stats');
    return response.data.data;
  } catch (error) {
    console.error('获取标签统计数据错误:', error);
    throw error;
  }
};

// 获取分类统计数据
export const getCategoryStats = async () => {
  try {
    const response = await api.get('/categories/stats');
    return response.data.data;
  } catch (error) {
    console.error('获取分类统计数据错误:', error);
    throw error;
  }
};

// 获取日志统计数据
export const getLogStats = async () => {
  try {
    // 实际项目中使用API调用
    // const response = await api.get('/stats/logs');
    // return response.data.data;

    // 使用模拟数据
    return {
      totalLogs: 100,
      todayLogs: 12,
      loginCount: 35,
      operationCount: 65
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
    // 实际项目中使用API调用
    // const response = await api.get('/stats/users/analytics', { params });
    // return response.data.data;

    // 使用模拟数据
    return {
      userGrowth: {
        dates: ['2025-01-01', '2025-01-02', '2025-01-03', '2025-01-04', '2025-01-05', '2025-01-06', '2025-01-07'],
        values: [100, 120, 140, 160, 180, 200, 220]
      },
      userActivity: {
        dates: ['2025-01-01', '2025-01-02', '2025-01-03', '2025-01-04', '2025-01-05', '2025-01-06', '2025-01-07'],
        values: [50, 60, 45, 80, 65, 75, 90]
      },
      userDistribution: {
        active: 65,
        inactive: 25,
        banned: 10
      },
      userDevices: {
        mobile: 60,
        desktop: 30,
        tablet: 10
      },
      userRegions: [
        { region: '北京', value: 20 },
        { region: '上海', value: 18 },
        { region: '广州', value: 15 },
        { region: '深圳', value: 12 },
        { region: '其他', value: 35 }
      ]
    };
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
    // 实际项目中使用API调用
    // const response = await api.get('/stats/content/analytics', { params });
    // return response.data.data;

    // 使用模拟数据
    return {
      contentGrowth: {
        dates: ['2025-01-01', '2025-01-02', '2025-01-03', '2025-01-04', '2025-01-05', '2025-01-06', '2025-01-07'],
        values: [200, 220, 240, 260, 280, 300, 320]
      },
      contentDistribution: {
        notes: 45,
        images: 25,
        audio: 15,
        video: 10,
        documents: 5
      },
      contentStatus: {
        published: 70,
        draft: 30
      },
      popularTags: [
        { tag: '技术', count: 120 },
        { tag: '学习', count: 100 },
        { tag: '生活', count: 80 },
        { tag: '工作', count: 60 },
        { tag: '其他', count: 40 }
      ],
      popularCategories: [
        { category: '编程', count: 150 },
        { category: '设计', count: 120 },
        { category: '管理', count: 90 },
        { category: '营销', count: 60 },
        { category: '其他', count: 80 }
      ]
    };
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
    // 实际项目中使用API调用
    // const response = await api.get('/stats/system/analytics', { params });
    // return response.data.data;

    // 使用模拟数据
    return {
      systemPerformance: {
        dates: ['2025-01-01', '2025-01-02', '2025-01-03', '2025-01-04', '2025-01-05', '2025-01-06', '2025-01-07'],
        cpu: [30, 35, 40, 38, 42, 45, 40],
        memory: [50, 55, 60, 58, 62, 65, 60],
        disk: [40, 42, 45, 47, 50, 52, 55]
      },
      errorLogs: {
        dates: ['2025-01-01', '2025-01-02', '2025-01-03', '2025-01-04', '2025-01-05', '2025-01-06', '2025-01-07'],
        values: [5, 3, 7, 2, 4, 6, 3]
      },
      apiCalls: {
        dates: ['2025-01-01', '2025-01-02', '2025-01-03', '2025-01-04', '2025-01-05', '2025-01-06', '2025-01-07'],
        values: [1200, 1300, 1100, 1400, 1500, 1600, 1700]
      },
      responseTime: {
        dates: ['2025-01-01', '2025-01-02', '2025-01-03', '2025-01-04', '2025-01-05', '2025-01-06', '2025-01-07'],
        values: [120, 110, 130, 125, 115, 105, 100]
      }
    };
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
export const exportStats = async (params) => {
  try {
    // 实际项目中使用API调用
    // const response = await api.get('/stats/export', {
    //   params,
    //   responseType: 'blob',
    // });

    // // 创建下载链接
    // const url = window.URL.createObjectURL(new Blob([response.data]));
    // const link = document.createElement('a');
    // link.href = url;
    // link.setAttribute('download', `stats-${new Date().toISOString().slice(0, 10)}.xlsx`);
    // document.body.appendChild(link);
    // link.click();
    // link.remove();

    // 模拟成功响应
    return { success: true };
  } catch (error) {
    console.error('导出统计数据失败:', error);
    throw error;
  }
};
