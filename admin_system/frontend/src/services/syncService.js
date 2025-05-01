import api from './authService';

/**
 * 同步服务 - 用于与主应用进行数据同步
 */

// 获取主应用同步状态
export const getSyncStatus = async () => {
  try {
    // 实际项目中使用API调用
    // const response = await api.get('/sync/status');
    // return response.data;
    
    // 使用模拟数据
    return mockSyncStatus();
  } catch (error) {
    console.error('获取同步状态错误:', error);
    throw error;
  }
};

// 执行数据同步
export const syncData = async (options = {}) => {
  try {
    // 实际项目中使用API调用
    // const response = await api.post('/sync/execute', options);
    // return response.data;
    
    // 使用模拟数据
    return mockSyncData(options);
  } catch (error) {
    console.error('执行数据同步错误:', error);
    throw error;
  }
};

// 获取同步历史记录
export const getSyncHistory = async (params) => {
  try {
    // 实际项目中使用API调用
    // const response = await api.get('/sync/history', { params });
    // return response.data;
    
    // 使用模拟数据
    return mockSyncHistory(params);
  } catch (error) {
    console.error('获取同步历史记录错误:', error);
    throw error;
  }
};

// 获取同步配置
export const getSyncConfig = async () => {
  try {
    // 实际项目中使用API调用
    // const response = await api.get('/sync/config');
    // return response.data;
    
    // 使用模拟数据
    return mockSyncConfig();
  } catch (error) {
    console.error('获取同步配置错误:', error);
    throw error;
  }
};

// 更新同步配置
export const updateSyncConfig = async (configData) => {
  try {
    // 实际项目中使用API调用
    // const response = await api.put('/sync/config', configData);
    // return response.data;
    
    // 使用模拟数据
    console.log('更新同步配置:', configData);
    return { success: true, message: '同步配置更新成功' };
  } catch (error) {
    console.error('更新同步配置错误:', error);
    throw error;
  }
};

// 获取主应用数据统计
export const getMainAppStats = async () => {
  try {
    // 实际项目中使用API调用
    // const response = await api.get('/sync/main-app-stats');
    // return response.data;
    
    // 使用模拟数据
    return mockMainAppStats();
  } catch (error) {
    console.error('获取主应用数据统计错误:', error);
    throw error;
  }
};

// 模拟数据
const mockSyncStatus = () => {
  return {
    lastSyncTime: '2023-05-01 10:30:00',
    syncStatus: 'completed', // completed, in_progress, failed
    syncProgress: 100,
    dataStatus: {
      users: { total: 1000, synced: 1000, lastUpdated: '2023-05-01 10:30:00' },
      notes: { total: 5000, synced: 5000, lastUpdated: '2023-05-01 10:30:00' },
      categories: { total: 50, synced: 50, lastUpdated: '2023-05-01 10:30:00' },
      tags: { total: 200, synced: 200, lastUpdated: '2023-05-01 10:30:00' },
    },
    connectionStatus: 'connected', // connected, disconnected, connecting
    mainAppVersion: '1.0.0',
    adminSystemVersion: '1.0.0',
  };
};

const mockSyncData = (options) => {
  // 模拟同步过程
  return {
    success: true,
    message: '数据同步已开始，请稍后查看同步状态',
    syncId: `sync_${new Date().getTime()}`,
    startTime: new Date().toISOString().replace('T', ' ').substring(0, 19),
    options,
  };
};

const mockSyncHistory = (params) => {
  // 生成模拟同步历史记录
  const generateMockHistory = (count) => {
    const history = [];
    const statuses = ['completed', 'failed', 'cancelled'];
    const types = ['full', 'incremental', 'users', 'notes', 'categories', 'tags'];
    
    for (let i = 1; i <= count; i++) {
      const statusIndex = Math.random() > 0.8 ? (Math.random() > 0.5 ? 1 : 2) : 0; // 80% 成功，10% 失败，10% 取消
      const status = statuses[statusIndex];
      const type = types[i % types.length];
      const startTime = new Date(Date.now() - i * 24 * 3600000);
      const endTime = new Date(startTime.getTime() + (Math.floor(Math.random() * 30) + 1) * 60000);
      
      history.push({
        id: `sync_${i}`,
        type,
        status,
        startTime: startTime.toISOString().replace('T', ' ').substring(0, 19),
        endTime: status !== 'in_progress' ? endTime.toISOString().replace('T', ' ').substring(0, 19) : null,
        duration: status !== 'in_progress' ? Math.floor((endTime - startTime) / 1000) : null,
        syncedItems: status === 'completed' ? {
          users: Math.floor(Math.random() * 100) + 900,
          notes: Math.floor(Math.random() * 500) + 4500,
          categories: Math.floor(Math.random() * 10) + 40,
          tags: Math.floor(Math.random() * 50) + 150,
        } : null,
        error: status === 'failed' ? '连接超时或数据库错误' : null,
        initiatedBy: 'admin',
      });
    }
    
    return history;
  };
  
  // 模拟分页和筛选
  const allHistory = generateMockHistory(50);
  let filteredHistory = [...allHistory];
  
  // 类型筛选
  if (params.type && params.type !== 'all') {
    filteredHistory = filteredHistory.filter(
      (item) => item.type === params.type
    );
  }
  
  // 状态筛选
  if (params.status && params.status !== 'all') {
    filteredHistory = filteredHistory.filter(
      (item) => item.status === params.status
    );
  }
  
  // 日期范围筛选
  if (params.startDate && params.endDate) {
    filteredHistory = filteredHistory.filter(
      (item) =>
        item.startTime.substring(0, 10) >= params.startDate && item.startTime.substring(0, 10) <= params.endDate
    );
  }
  
  // 排序
  if (params.sortField && params.sortOrder) {
    filteredHistory.sort((a, b) => {
      const fieldA = a[params.sortField];
      const fieldB = b[params.sortField];
      
      if (params.sortOrder === 'ascend') {
        return fieldA > fieldB ? 1 : -1;
      } else {
        return fieldA < fieldB ? 1 : -1;
      }
    });
  } else {
    // 默认按开始时间倒序排序
    filteredHistory.sort((a, b) => new Date(b.startTime) - new Date(a.startTime));
  }
  
  // 分页
  const pageSize = params.pageSize || 10;
  const page = params.page || 1;
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const paginatedHistory = filteredHistory.slice(start, end);
  
  return {
    data: paginatedHistory,
    total: filteredHistory.length,
    page,
    pageSize,
  };
};

const mockSyncConfig = () => {
  return {
    autoSync: true,
    syncInterval: 60, // 分钟
    syncTime: '03:00:00', // 每天定时同步时间
    syncTypes: ['users', 'notes', 'categories', 'tags'],
    conflictResolution: 'newer', // newer, admin, main
    maxRetries: 3,
    timeout: 300, // 秒
    batchSize: 100,
    notifyOnComplete: true,
    notifyOnError: true,
    logLevel: 'info', // debug, info, warning, error
    mainAppUrl: 'http://localhost:8000',
    apiKey: '********',
  };
};

const mockMainAppStats = () => {
  return {
    users: {
      total: 1000,
      active: 800,
      new: 50,
      growth: [
        { date: '2023-04-01', count: 900 },
        { date: '2023-04-15', count: 950 },
        { date: '2023-05-01', count: 1000 },
      ],
    },
    notes: {
      total: 5000,
      published: 4000,
      draft: 1000,
      growth: [
        { date: '2023-04-01', count: 4500 },
        { date: '2023-04-15', count: 4750 },
        { date: '2023-05-01', count: 5000 },
      ],
    },
    categories: {
      total: 50,
      mostUsed: [
        { id: 'category-1', name: '工作', count: 2000 },
        { id: 'category-2', name: '学习', count: 1500 },
        { id: 'category-3', name: '生活', count: 1000 },
      ],
    },
    tags: {
      total: 200,
      mostUsed: [
        { id: 'tag-1', name: '重要', count: 1000 },
        { id: 'tag-2', name: '会议', count: 800 },
        { id: 'tag-3', name: '项目', count: 600 },
      ],
    },
    storage: {
      total: '10 GB',
      used: '5.5 GB',
      free: '4.5 GB',
      usagePercent: 55,
    },
    performance: {
      responseTime: '120 ms',
      uptime: '99.9%',
      lastRestart: '2023-04-15 00:00:00',
    },
  };
};
