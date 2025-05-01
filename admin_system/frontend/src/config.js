// API基础URL
export const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:8000/api';

// 应用配置
export const APP_CONFIG = {
  name: '零屿笔记管理系统',
  version: '1.0.0',
  copyright: `零屿笔记管理系统 ©${new Date().getFullYear()} 由 零屿团队 提供技术支持`,
  logo: '/logo.png',
  defaultPageSize: 10,
  defaultDateFormat: 'YYYY-MM-DD',
  defaultTimeFormat: 'YYYY-MM-DD HH:mm:ss',
  defaultLocale: 'zh-CN',
  theme: {
    primaryColor: '#4361EE',
    successColor: '#52C41A',
    warningColor: '#FAAD14',
    errorColor: '#F72585',
    infoColor: '#4895EF',
  },
};
