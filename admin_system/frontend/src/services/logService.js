import api from './authService';

// 获取管理员操作日志
export const getAdminLogs = async (params) => {
  try {
    // 实际项目中使用API调用
    // const response = await api.get('/logs/admin', { params });
    // return response.data;

    // 使用模拟数据
    return mockAdminLogs(params);
  } catch (error) {
    console.error('获取管理员操作日志错误:', error);
    throw error;
  }
};

// 获取日志统计数据
export const getLogStats = async () => {
  try {
    // 实际项目中使用API调用
    // const response = await api.get('/logs/stats');
    // return response.data;

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

// 清空管理员操作日志
export const clearAdminLogs = async () => {
  try {
    // 实际项目中使用API调用
    // const response = await api.delete('/logs/admin/clear');
    // return response.data;

    // 模拟成功响应
    return { success: true, message: '日志已清空' };
  } catch (error) {
    console.error('清空管理员操作日志错误:', error);
    throw error;
  }
};

// 导出管理员操作日志
export const exportAdminLogs = async (params) => {
  try {
    // 实际项目中使用API调用
    // const response = await api.get('/logs/admin/export', {
    //   params,
    //   responseType: 'blob'
    // });

    // 模拟导出功能
    // 创建一个包含模拟数据的CSV字符串
    const mockData = mockAdminLogs({ ...params, pageSize: 1000 }).data;
    const headers = ['ID', '管理员', '操作类型', '目标模型', '目标ID', '操作描述', 'IP地址', '操作时间'];
    const csvContent = [
      headers.join(','),
      ...mockData.map(log => [
        log.id,
        log.admin?.username || '-',
        log.action,
        log.targetModel,
        log.targetId || '-',
        `"${log.description.replace(/"/g, '""')}"`,
        log.ipAddress,
        log.createdAt
      ].join(','))
    ].join('\n');

    // 创建Blob对象
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });

    // 创建下载链接
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `admin-logs-${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);

    return true;
  } catch (error) {
    console.error('导出管理员操作日志错误:', error);
    throw error;
  }
};

// 获取系统日志
export const getSystemLogs = async (params) => {
  try {
    // 实际项目中使用API调用
    // const response = await api.get('/logs/system', { params });
    // return response.data;

    // 使用模拟数据
    return mockSystemLogs(params);
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
    // 实际项目中使用API调用
    // const response = await api.get('/logs/login', { params });
    // return response.data;

    // 使用模拟数据
    return mockLoginLogs(params);
  } catch (error) {
    console.error('获取登录日志错误:', error);
    throw error;
  }
};

// 模拟数据
const mockAdminLogs = (params) => {
  // 生成模拟管理员操作日志
  const generateMockLogs = (count) => {
    const logs = [];
    const actions = ['CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'OTHER'];
    const targetModels = ['User', 'Note', 'Category', 'Tag', 'Setting', 'Admin'];
    const admins = [
      { id: 1, username: 'admin' },
      { id: 2, username: 'manager' },
      { id: 3, username: 'editor' },
    ];

    for (let i = 1; i <= count; i++) {
      const actionIndex = i % actions.length;
      const action = actions[actionIndex];
      const targetModel = targetModels[i % targetModels.length];
      const admin = admins[i % admins.length];

      logs.push({
        id: i,
        admin,
        action,
        targetModel,
        targetId: action !== 'LOGIN' && action !== 'LOGOUT' ? Math.floor(Math.random() * 100) + 1 : null,
        description: getLogDescription(action, targetModel),
        ipAddress: `192.168.1.${Math.floor(Math.random() * 255) + 1}`,
        createdAt: new Date(Date.now() - i * 3600000).toISOString().replace('T', ' ').substring(0, 19),
      });
    }

    return logs;
  };

  // 获取日志描述
  const getLogDescription = (action, targetModel) => {
    switch (action) {
      case 'CREATE':
        return `创建了一个新的${targetModel}`;
      case 'UPDATE':
        return `更新了${targetModel}信息`;
      case 'DELETE':
        return `删除了${targetModel}`;
      case 'LOGIN':
        return '登录系统';
      case 'LOGOUT':
        return '退出系统';
      default:
        return '执行了其他操作';
    }
  };

  // 模拟分页和筛选
  const allLogs = generateMockLogs(100);
  let filteredLogs = [...allLogs];

  // 关键词筛选
  if (params.keyword) {
    const keyword = params.keyword.toLowerCase();
    filteredLogs = filteredLogs.filter(
      (log) =>
        (log.admin?.username && log.admin.username.toLowerCase().includes(keyword)) ||
        log.description.toLowerCase().includes(keyword) ||
        (log.targetModel && log.targetModel.toLowerCase().includes(keyword)) ||
        (log.ipAddress && log.ipAddress.includes(keyword))
    );
  }

  // 操作类型筛选
  if (params.action) {
    filteredLogs = filteredLogs.filter(
      (log) => log.action === params.action
    );
  }

  // 管理员筛选
  if (params.adminId) {
    filteredLogs = filteredLogs.filter(
      (log) => log.admin?.id === parseInt(params.adminId)
    );
  }

  // 日期范围筛选
  if (params.startDate && params.endDate) {
    filteredLogs = filteredLogs.filter(
      (log) =>
        log.createdAt.substring(0, 10) >= params.startDate && log.createdAt.substring(0, 10) <= params.endDate
    );
  }

  // 排序
  if (params.sortField && params.sortOrder) {
    filteredLogs.sort((a, b) => {
      const fieldA = a[params.sortField];
      const fieldB = b[params.sortField];

      if (params.sortOrder === 'ascend') {
        return fieldA > fieldB ? 1 : -1;
      } else {
        return fieldA < fieldB ? 1 : -1;
      }
    });
  } else {
    // 默认按时间倒序排序
    filteredLogs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  // 分页
  const pageSize = params.pageSize || 10;
  const page = params.page || 1;
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const paginatedLogs = filteredLogs.slice(start, end);

  return {
    data: paginatedLogs,
    total: filteredLogs.length,
    page,
    pageSize,
  };
};

const mockSystemLogs = (params) => {
  // 生成模拟系统日志
  const generateMockLogs = (count) => {
    const logs = [];
    const levels = ['INFO', 'WARNING', 'ERROR', 'DEBUG'];
    const modules = ['System', 'Database', 'API', 'Auth', 'File', 'Cache'];

    for (let i = 1; i <= count; i++) {
      const levelIndex = Math.floor(Math.random() * levels.length);
      const level = levels[levelIndex];
      const module = modules[i % modules.length];

      logs.push({
        id: i,
        level,
        module,
        message: getSystemLogMessage(level, module),
        details: getSystemLogDetails(level, module),
        createdAt: new Date(Date.now() - i * 3600000).toISOString().replace('T', ' ').substring(0, 19),
      });
    }

    return logs;
  };

  // 获取系统日志消息
  const getSystemLogMessage = (level, module) => {
    switch (level) {
      case 'INFO':
        return `${module} 模块正常运行`;
      case 'WARNING':
        return `${module} 模块出现警告`;
      case 'ERROR':
        return `${module} 模块出现错误`;
      case 'DEBUG':
        return `${module} 模块调试信息`;
      default:
        return `${module} 模块日志`;
    }
  };

  // 获取系统日志详情
  const getSystemLogDetails = (level, module) => {
    switch (level) {
      case 'INFO':
        return `${module} 模块正常运行，一切正常。`;
      case 'WARNING':
        return `${module} 模块出现警告，可能需要注意。警告代码: W${Math.floor(Math.random() * 1000)}`;
      case 'ERROR':
        return `${module} 模块出现错误，请检查系统。错误代码: E${Math.floor(Math.random() * 1000)}`;
      case 'DEBUG':
        return `${module} 模块调试信息，仅供开发人员参考。`;
      default:
        return `${module} 模块日志详情。`;
    }
  };

  // 模拟分页和筛选
  const allLogs = generateMockLogs(200);
  let filteredLogs = [...allLogs];

  // 关键词筛选
  if (params.keyword) {
    const keyword = params.keyword.toLowerCase();
    filteredLogs = filteredLogs.filter(
      (log) =>
        log.message.toLowerCase().includes(keyword) ||
        log.details.toLowerCase().includes(keyword) ||
        log.module.toLowerCase().includes(keyword)
    );
  }

  // 级别筛选
  if (params.level && params.level !== 'ALL') {
    filteredLogs = filteredLogs.filter(
      (log) => log.level === params.level
    );
  }

  // 模块筛选
  if (params.module && params.module !== 'ALL') {
    filteredLogs = filteredLogs.filter(
      (log) => log.module === params.module
    );
  }

  // 日期范围筛选
  if (params.startDate && params.endDate) {
    filteredLogs = filteredLogs.filter(
      (log) =>
        log.createdAt.substring(0, 10) >= params.startDate && log.createdAt.substring(0, 10) <= params.endDate
    );
  }

  // 排序
  if (params.sortField && params.sortOrder) {
    filteredLogs.sort((a, b) => {
      const fieldA = a[params.sortField];
      const fieldB = b[params.sortField];

      if (params.sortOrder === 'ascend') {
        return fieldA > fieldB ? 1 : -1;
      } else {
        return fieldA < fieldB ? 1 : -1;
      }
    });
  } else {
    // 默认按时间倒序排序
    filteredLogs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  // 分页
  const pageSize = params.pageSize || 10;
  const page = params.page || 1;
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const paginatedLogs = filteredLogs.slice(start, end);

  return {
    data: paginatedLogs,
    total: filteredLogs.length,
    page,
    pageSize,
  };
};

const mockLoginLogs = (params) => {
  // 生成模拟登录日志
  const generateMockLogs = (count) => {
    const logs = [];
    const statuses = ['success', 'failed'];
    const users = [
      { id: 1, username: 'admin' },
      { id: 2, username: 'manager' },
      { id: 3, username: 'editor' },
      { id: 4, username: 'user1' },
      { id: 5, username: 'user2' },
    ];

    for (let i = 1; i <= count; i++) {
      const statusIndex = Math.random() > 0.8 ? 1 : 0; // 80% 成功，20% 失败
      const status = statuses[statusIndex];
      const user = users[i % users.length];

      logs.push({
        id: i,
        user,
        status,
        ipAddress: `192.168.1.${Math.floor(Math.random() * 255) + 1}`,
        userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        reason: status === 'failed' ? getFailReason() : null,
        createdAt: new Date(Date.now() - i * 3600000).toISOString().replace('T', ' ').substring(0, 19),
      });
    }

    return logs;
  };

  // 获取登录失败原因
  const getFailReason = () => {
    const reasons = [
      '密码错误',
      '账户被锁定',
      '账户不存在',
      'IP地址被禁止',
      '验证码错误',
    ];

    return reasons[Math.floor(Math.random() * reasons.length)];
  };

  // 模拟分页和筛选
  const allLogs = generateMockLogs(150);
  let filteredLogs = [...allLogs];

  // 关键词筛选
  if (params.keyword) {
    const keyword = params.keyword.toLowerCase();
    filteredLogs = filteredLogs.filter(
      (log) =>
        (log.user?.username && log.user.username.toLowerCase().includes(keyword)) ||
        (log.ipAddress && log.ipAddress.includes(keyword)) ||
        (log.reason && log.reason.toLowerCase().includes(keyword))
    );
  }

  // 状态筛选
  if (params.status && params.status !== 'all') {
    filteredLogs = filteredLogs.filter(
      (log) => log.status === params.status
    );
  }

  // 用户筛选
  if (params.userId) {
    filteredLogs = filteredLogs.filter(
      (log) => log.user?.id === parseInt(params.userId)
    );
  }

  // 日期范围筛选
  if (params.startDate && params.endDate) {
    filteredLogs = filteredLogs.filter(
      (log) =>
        log.createdAt.substring(0, 10) >= params.startDate && log.createdAt.substring(0, 10) <= params.endDate
    );
  }

  // 排序
  if (params.sortField && params.sortOrder) {
    filteredLogs.sort((a, b) => {
      const fieldA = a[params.sortField];
      const fieldB = b[params.sortField];

      if (params.sortOrder === 'ascend') {
        return fieldA > fieldB ? 1 : -1;
      } else {
        return fieldA < fieldB ? 1 : -1;
      }
    });
  } else {
    // 默认按时间倒序排序
    filteredLogs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  // 分页
  const pageSize = params.pageSize || 10;
  const page = params.page || 1;
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const paginatedLogs = filteredLogs.slice(start, end);

  return {
    data: paginatedLogs,
    total: filteredLogs.length,
    page,
    pageSize,
  };
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
