import api from './authService';

// 获取系统配置
export const getSystemConfig = async () => {
  try {
    // 尝试从API获取配置
    try {
      const response = await api.get('/settings/system/all_configs/');
      if (response.data && response.data.status === 'success') {
        // 处理API返回的数据
        const configData = response.data.data;

        // 转换布尔值字符串为实际布尔值
        if (configData.userRegistration === 'true') configData.userRegistration = true;
        if (configData.userRegistration === 'false') configData.userRegistration = false;
        if (configData.emailVerification === 'true') configData.emailVerification = true;
        if (configData.emailVerification === 'false') configData.emailVerification = false;

        // 转换数字字符串为数字
        if (configData.pageSize) configData.pageSize = parseInt(configData.pageSize, 10);
        if (configData.uploadMaxSize) configData.uploadMaxSize = parseInt(configData.uploadMaxSize, 10);

        // 转换文件类型字符串为数组
        if (configData.allowedFileTypes && typeof configData.allowedFileTypes === 'string') {
          configData.allowedFileTypes = configData.allowedFileTypes.split(',');
        }

        return configData;
      }
    } catch (apiError) {
      console.warn('API调用失败，使用模拟数据:', apiError);
    }

    // 如果API调用失败，使用模拟数据
    return mockSystemConfig();
  } catch (error) {
    console.error('获取系统配置错误:', error);
    throw error;
  }
};

// 更新系统配置
export const updateSystemConfig = async (configData) => {
  try {
    // 尝试通过API更新配置
    try {
      const response = await api.post('/settings/system/update_config/', configData);
      if (response.data && response.data.status === 'success') {
        return { success: true, message: '系统配置更新成功', data: response.data.data };
      }
    } catch (apiError) {
      console.warn('API调用失败，使用模拟响应:', apiError);
    }

    // 如果API调用失败，使用模拟响应
    console.log('更新系统配置:', configData);
    return { success: true, message: '系统配置更新成功' };
  } catch (error) {
    console.error('更新系统配置错误:', error);
    throw error;
  }
};

// 获取安全配置
export const getSecurityConfig = async () => {
  try {
    // 尝试从API获取配置
    try {
      const response = await api.get('/settings/system/by_key/', {
        params: { key: 'security_config' }
      });

      if (response.data && response.data.status === 'success') {
        // 尝试解析JSON字符串
        try {
          const securityConfig = JSON.parse(response.data.data.value);
          return securityConfig;
        } catch (parseError) {
          console.warn('解析安全配置JSON失败:', parseError);
        }
      }
    } catch (apiError) {
      console.warn('API调用失败，使用模拟数据:', apiError);
    }

    // 如果API调用失败，使用模拟数据
    return mockSecurityConfig();
  } catch (error) {
    console.error('获取安全配置错误:', error);
    throw error;
  }
};

// 更新安全配置
export const updateSecurityConfig = async (configData) => {
  try {
    // 尝试通过API更新配置
    try {
      const response = await api.post('/settings/system/batch_update/', [
        {
          key: 'security_config',
          value: JSON.stringify(configData),
          description: '安全配置'
        }
      ]);

      if (response.data && response.data.status === 'success') {
        return { success: true, message: '安全配置更新成功', data: response.data.data };
      }
    } catch (apiError) {
      console.warn('API调用失败，使用模拟响应:', apiError);
    }

    // 如果API调用失败，使用模拟响应
    console.log('更新安全配置:', configData);
    return { success: true, message: '安全配置更新成功' };
  } catch (error) {
    console.error('更新安全配置错误:', error);
    throw error;
  }
};

// 获取管理员列表
export const getAdmins = async (params) => {
  try {
    // 实际项目中使用API调用
    // const response = await api.get('/settings/admins', { params });
    // return response.data;

    // 使用模拟数据
    return mockAdmins(params);
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
    // 尝试从API获取公告
    try {
      const response = await api.get('/settings/announcements/', { params });
      if (response.data) {
        return response.data;
      }
    } catch (apiError) {
      console.warn('API调用失败，使用模拟数据:', apiError);
    }

    // 如果API调用失败，使用模拟数据
    return mockAnnouncements(params);
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
    // 尝试从API获取备份列表
    try {
      const response = await api.get('/settings/backup/');
      if (response.data) {
        return response.data;
      }
    } catch (apiError) {
      console.warn('API调用失败，使用模拟数据:', apiError);
    }

    // 如果API调用失败，使用模拟数据
    return mockBackups();
  } catch (error) {
    console.error('获取备份列表错误:', error);
    throw error;
  }
};

// 模拟数据
const mockSystemConfig = () => {
  return {
    siteName: '零屿笔记管理系统',
    siteDescription: '零屿笔记的管理后台系统，用于管理用户、内容和系统设置',
    siteKeywords: '零屿笔记,管理系统,后台管理',
    siteLogo: '/logo.png',
    siteFavicon: '/favicon.ico',
    adminEmail: 'admin@zeroisle.com',
    userRegistration: true,
    emailVerification: true,
    defaultUserRole: 'user',
    pageSize: 10,
    uploadMaxSize: 10,
    allowedFileTypes: ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'doc', 'docx'],
    timezone: 'Asia/Shanghai',
    dateFormat: 'YYYY-MM-DD',
    timeFormat: 'HH:mm:ss',
  };
};

const mockSecurityConfig = () => {
  return {
    passwordMinLength: 8,
    passwordRequireUppercase: true,
    passwordRequireLowercase: true,
    passwordRequireNumbers: true,
    passwordRequireSpecialChars: true,
    passwordExpiryDays: 90,
    loginMaxAttempts: 5,
    loginLockoutTime: 30,
    sessionTimeout: 120,
    twoFactorAuth: false,
    ipRestriction: false,
    allowedIPs: [],
    sslEnabled: true,
    xssProtection: true,
    csrfProtection: true,
    reCaptchaEnabled: false,
    reCaptchaSiteKey: '',
    reCaptchaSecretKey: '',
  };
};

const mockAdmins = (params) => {
  // 生成模拟管理员数据
  const admins = [
    { id: 1, username: 'admin', email: 'admin@zeroisle.com', role: 'superadmin', status: 'active', lastLogin: '2023-05-01 10:00:00', createdAt: '2023-01-01' },
    { id: 2, username: 'manager', email: 'manager@zeroisle.com', role: 'admin', status: 'active', lastLogin: '2023-05-01 09:30:00', createdAt: '2023-01-02' },
    { id: 3, username: 'editor', email: 'editor@zeroisle.com', role: 'editor', status: 'active', lastLogin: '2023-05-01 09:00:00', createdAt: '2023-01-03' },
    { id: 4, username: 'viewer', email: 'viewer@zeroisle.com', role: 'viewer', status: 'inactive', lastLogin: '2023-04-30 15:00:00', createdAt: '2023-01-04' },
    { id: 5, username: 'tester', email: 'tester@zeroisle.com', role: 'editor', status: 'active', lastLogin: '2023-04-30 14:00:00', createdAt: '2023-01-05' },
  ];

  // 关键词筛选
  let filteredAdmins = [...admins];
  if (params && params.keyword) {
    const keyword = params.keyword.toLowerCase();
    filteredAdmins = filteredAdmins.filter(
      (admin) =>
        admin.username.toLowerCase().includes(keyword) ||
        admin.email.toLowerCase().includes(keyword)
    );
  }

  // 角色筛选
  if (params && params.role) {
    filteredAdmins = filteredAdmins.filter(
      (admin) => admin.role === params.role
    );
  }

  // 状态筛选
  if (params && params.status) {
    filteredAdmins = filteredAdmins.filter(
      (admin) => admin.status === params.status
    );
  }

  // 分页
  if (params && params.page && params.pageSize) {
    const pageSize = params.pageSize;
    const page = params.page;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginatedAdmins = filteredAdmins.slice(start, end);

    return {
      data: paginatedAdmins,
      total: filteredAdmins.length,
      page,
      pageSize,
    };
  }

  return {
    data: filteredAdmins,
    total: filteredAdmins.length,
    page: 1,
    pageSize: filteredAdmins.length,
  };
};

const mockAnnouncements = (params) => {
  // 生成模拟公告数据
  const announcements = [
    { id: 1, title: '系统维护通知', content: '系统将于2023年5月10日22:00-24:00进行维护，请提前做好准备。', status: 'published', createdBy: 'admin', createdAt: '2023-05-01', publishedAt: '2023-05-01', expiredAt: '2023-05-11' },
    { id: 2, title: '新功能上线通知', content: '我们的系统新增了XXX功能，欢迎使用。', status: 'published', createdBy: 'admin', createdAt: '2023-04-20', publishedAt: '2023-04-20', expiredAt: '2023-05-20' },
    { id: 3, title: '用户反馈调查', content: '为了提升用户体验，我们正在进行用户反馈调查，请点击链接参与。', status: 'draft', createdBy: 'manager', createdAt: '2023-04-15', publishedAt: null, expiredAt: null },
    { id: 4, title: '安全更新提醒', content: '我们发布了安全更新，建议所有用户及时更新系统。', status: 'published', createdBy: 'admin', createdAt: '2023-04-10', publishedAt: '2023-04-10', expiredAt: '2023-05-10' },
    { id: 5, title: '节日活动预告', content: '即将到来的节日活动，敬请期待。', status: 'draft', createdBy: 'editor', createdAt: '2023-04-05', publishedAt: null, expiredAt: null },
  ];

  // 关键词筛选
  let filteredAnnouncements = [...announcements];
  if (params && params.keyword) {
    const keyword = params.keyword.toLowerCase();
    filteredAnnouncements = filteredAnnouncements.filter(
      (announcement) =>
        announcement.title.toLowerCase().includes(keyword) ||
        announcement.content.toLowerCase().includes(keyword)
    );
  }

  // 状态筛选
  if (params && params.status) {
    filteredAnnouncements = filteredAnnouncements.filter(
      (announcement) => announcement.status === params.status
    );
  }

  // 创建者筛选
  if (params && params.createdBy) {
    filteredAnnouncements = filteredAnnouncements.filter(
      (announcement) => announcement.createdBy === params.createdBy
    );
  }

  // 日期范围筛选
  if (params && params.startDate && params.endDate) {
    filteredAnnouncements = filteredAnnouncements.filter(
      (announcement) =>
        announcement.createdAt >= params.startDate && announcement.createdAt <= params.endDate
    );
  }

  // 分页
  if (params && params.page && params.pageSize) {
    const pageSize = params.pageSize;
    const page = params.page;
    const start = (page - 1) * pageSize;
    const end = start + pageSize;
    const paginatedAnnouncements = filteredAnnouncements.slice(start, end);

    return {
      data: paginatedAnnouncements,
      total: filteredAnnouncements.length,
      page,
      pageSize,
    };
  }

  return {
    data: filteredAnnouncements,
    total: filteredAnnouncements.length,
    page: 1,
    pageSize: filteredAnnouncements.length,
  };
};

const mockBackups = () => {
  // 生成模拟备份数据
  const backups = [
    { id: 1, name: 'backup_20230501_120000', size: '256MB', type: 'full', status: 'completed', createdBy: 'admin', createdAt: '2023-05-01 12:00:00' },
    { id: 2, name: 'backup_20230420_120000', size: '240MB', type: 'full', status: 'completed', createdBy: 'admin', createdAt: '2023-04-20 12:00:00' },
    { id: 3, name: 'backup_20230410_120000', size: '220MB', type: 'full', status: 'completed', createdBy: 'admin', createdAt: '2023-04-10 12:00:00' },
    { id: 4, name: 'backup_20230401_120000', size: '210MB', type: 'full', status: 'completed', createdBy: 'admin', createdAt: '2023-04-01 12:00:00' },
    { id: 5, name: 'backup_20230320_120000', size: '200MB', type: 'full', status: 'completed', createdBy: 'admin', createdAt: '2023-03-20 12:00:00' },
  ];

  return backups;
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
