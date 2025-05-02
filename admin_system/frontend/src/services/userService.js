import api from './authService';

// 获取用户列表
export const getUsers = async (params) => {
  try {
    // 调用后端API
    const response = await api.get('/users/profiles/', { params });
    return {
      data: response.data.results,
      total: response.data.count,
      page: params.page || 1,
      pageSize: params.pageSize || 10
    };
  } catch (error) {
    console.error('获取用户列表错误:', error);
    throw error;
  }
};

// 获取用户详情
export const getUserDetail = async (id) => {
  try {
    // 调用后端API
    const response = await api.get(`/users/profiles/${id}/`);
    return response.data;
  } catch (error) {
    console.error('获取用户详情错误:', error);
    throw error;
  }
};

// 创建用户
export const createUser = async (userData) => {
  try {
    const response = await api.post('/users/profiles/', userData);
    return response.data;
  } catch (error) {
    console.error('创建用户错误:', error);
    throw error;
  }
};

// 更新用户
export const updateUser = async (id, userData) => {
  try {
    const response = await api.put(`/users/profiles/${id}/`, userData);
    return response.data;
  } catch (error) {
    console.error('更新用户错误:', error);
    throw error;
  }
};

// 删除用户
export const deleteUser = async (id) => {
  try {
    const response = await api.delete(`/users/profiles/${id}/`);
    return response.data;
  } catch (error) {
    console.error('删除用户错误:', error);
    throw error;
  }
};

// 更新用户状态
export const updateUserStatus = async (id, status) => {
  try {
    const response = await api.patch(`/users/profiles/${id}/status/`, { status });
    return response.data;
  } catch (error) {
    console.error('更新用户状态错误:', error);
    throw error;
  }
};

// 重置用户密码
export const resetUserPassword = async (id) => {
  try {
    const response = await api.post(`/users/profiles/${id}/reset-password/`);
    return response.data;
  } catch (error) {
    console.error('重置用户密码错误:', error);
    throw error;
  }
};

// 获取用户统计数据
export const getUserStats = async () => {
  try {
    // 调用后端API
    const response = await api.get('/users/profiles/stats/');
    return response.data;
  } catch (error) {
    console.error('获取用户统计数据错误:', error);
    throw error;
  }
};

// 获取用户增长趋势
export const getUserGrowth = async (days = 30) => {
  try {
    // 调用后端API
    const response = await api.get('/users/profiles/growth/', { params: { days } });
    return response.data;
  } catch (error) {
    console.error('获取用户增长趋势错误:', error);
    throw error;
  }
};

// 同步用户数据
export const syncUsers = async (options = {}) => {
  try {
    const response = await api.post('/users/profiles/sync/', options);
    return response.data;
  } catch (error) {
    console.error('同步用户数据错误:', error);
    throw error;
  }
};

// 批量激活用户
export const batchActivateUsers = async (userIds) => {
  try {
    const response = await api.post('/users/profiles/batch_activate/', { user_ids: userIds });
    return response.data;
  } catch (error) {
    console.error('批量激活用户错误:', error);
    throw error;
  }
};

// 批量禁用用户
export const batchDeactivateUsers = async (userIds) => {
  try {
    const response = await api.post('/users/profiles/batch_deactivate/', { user_ids: userIds });
    return response.data;
  } catch (error) {
    console.error('批量禁用用户错误:', error);
    throw error;
  }
};

// 批量删除用户
export const batchDeleteUsers = async (userIds) => {
  try {
    const response = await api.post('/users/profiles/batch_delete/', { user_ids: userIds });
    return response.data;
  } catch (error) {
    console.error('批量删除用户错误:', error);
    throw error;
  }
};

// 导入用户数据
export const importUsers = async (usersData) => {
  try {
    const response = await api.post('/users/profiles/import_users/', { users: usersData });
    return response.data;
  } catch (error) {
    console.error('导入用户数据错误:', error);
    throw error;
  }
};

// 导出用户数据
export const exportUsers = async (filters = {}, userIds = []) => {
  try {
    const response = await api.post('/users/profiles/export/', { filters, user_ids: userIds });
    return response.data;
  } catch (error) {
    console.error('导出用户数据错误:', error);
    throw error;
  }
};

// 获取用户活动记录
export const getUserActivities = async (params) => {
  try {
    const response = await api.get('/users/activities/', { params });
    return {
      data: response.data.results,
      total: response.data.count,
      page: params.page || 1,
      pageSize: params.pageSize || 10
    };
  } catch (error) {
    console.error('获取用户活动记录错误:', error);
    throw error;
  }
};

// 获取指定用户的活动记录
export const getUserActivityById = async (userId, params) => {
  try {
    const response = await api.get(`/users/profiles/${userId}/activities/`, { params });
    return {
      data: response.data.results,
      total: response.data.count,
      page: params.page || 1,
      pageSize: params.pageSize || 10
    };
  } catch (error) {
    console.error('获取指定用户活动记录错误:', error);
    throw error;
  }
};

// 模拟数据
const mockUsers = (params) => {
  // 生成模拟用户数据
  const generateMockUsers = (count) => {
    const users = [];
    for (let i = 1; i <= count; i++) {
      users.push({
        id: `user-${i}`,
        username: `user${i}`,
        email: `user${i}@example.com`,
        phone: i % 3 === 0 ? null : `1380013800${i}`,
        nickname: `用户${i}`,
        avatar: null,
        status: i % 10 === 0 ? 'banned' : (i % 5 === 0 ? 'inactive' : 'active'),
        isEmailVerified: i % 3 !== 0,
        isPhoneVerified: i % 4 !== 0,
        createdAt: new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        lastLoginAt: i % 7 === 0 ? null : new Date(Date.now() - i * 12 * 60 * 60 * 1000).toISOString().split('T')[0],
      });
    }
    return users;
  };

  // 模拟分页和筛选
  const allUsers = generateMockUsers(100);
  let filteredUsers = [...allUsers];

  // 关键词筛选
  if (params.keyword) {
    const keyword = params.keyword.toLowerCase();
    filteredUsers = filteredUsers.filter(
      (user) =>
        user.username.toLowerCase().includes(keyword) ||
        user.email.toLowerCase().includes(keyword) ||
        (user.phone && user.phone.includes(keyword)) ||
        (user.nickname && user.nickname.toLowerCase().includes(keyword))
    );
  }

  // 状态筛选
  if (params.status && params.status !== 'all') {
    filteredUsers = filteredUsers.filter(
      (user) => user.status === params.status
    );
  }

  // 日期范围筛选
  if (params.startDate && params.endDate) {
    filteredUsers = filteredUsers.filter(
      (user) =>
        user.createdAt >= params.startDate && user.createdAt <= params.endDate
    );
  }

  // 排序
  if (params.sortField && params.sortOrder) {
    filteredUsers.sort((a, b) => {
      const fieldA = a[params.sortField];
      const fieldB = b[params.sortField];

      if (params.sortOrder === 'ascend') {
        return fieldA > fieldB ? 1 : -1;
      } else {
        return fieldA < fieldB ? 1 : -1;
      }
    });
  }

  // 分页
  const pageSize = params.pageSize || 10;
  const page = params.page || 1;
  const start = (page - 1) * pageSize;
  const end = start + pageSize;
  const paginatedUsers = filteredUsers.slice(start, end);

  return {
    data: paginatedUsers,
    total: filteredUsers.length,
    page,
    pageSize,
  };
};

const mockUserDetail = (id) => {
  // 模拟用户详情
  const userId = id.split('-')[1];
  return {
    id,
    username: `user${userId}`,
    email: `user${userId}@example.com`,
    phone: userId % 3 === 0 ? null : `1380013800${userId}`,
    nickname: `用户${userId}`,
    avatar: null,
    bio: `这是用户${userId}的个人简介，包含了用户的一些基本信息和介绍。`,
    status: userId % 10 === 0 ? 'banned' : (userId % 5 === 0 ? 'inactive' : 'active'),
    isEmailVerified: userId % 3 !== 0,
    isPhoneVerified: userId % 4 !== 0,
    createdAt: new Date(Date.now() - userId * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    lastLoginAt: userId % 7 === 0 ? null : new Date(Date.now() - userId * 12 * 60 * 60 * 1000).toISOString().split('T')[0],
    roles: ['user'],
    permissions: ['read', 'write'],
    notesCount: Math.floor(Math.random() * 20),
    commentsCount: Math.floor(Math.random() * 10),
    likesCount: Math.floor(Math.random() * 30),
  };
};

const mockUserStats = () => {
  // 模拟用户统计数据
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  return {
    totalUsers: 100,
    activeUsers: 75,
    inactiveUsers: 20,
    bannedUsers: 5,
    todayNewUsers: 3,
    userGrowth: [
      { date: '2023-01-01', count: 5 },
      { date: '2023-01-02', count: 8 },
      { date: '2023-01-03', count: 12 },
      { date: '2023-01-04', count: 7 },
      { date: '2023-01-05', count: 10 },
      { date: '2023-01-06', count: 15 },
      { date: '2023-01-07', count: 20 },
    ],
    userActivity: [
      { date: '2023-01-01', count: 30 },
      { date: '2023-01-02', count: 45 },
      { date: '2023-01-03', count: 60 },
      { date: '2023-01-04', count: 40 },
      { date: '2023-01-05', count: 55 },
      { date: '2023-01-06', count: 70 },
      { date: '2023-01-07', count: 80 },
    ],
    recentUsers: [
      { id: 'user-1', username: 'user1', createdAt: today.toISOString().split('T')[0] },
      { id: 'user-2', username: 'user2', createdAt: today.toISOString().split('T')[0] },
      { id: 'user-3', username: 'user3', createdAt: yesterday.toISOString().split('T')[0] },
    ],
  };
};
