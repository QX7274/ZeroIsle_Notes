import { Platform } from 'react-native';

// API 基础配置
// 根据环境选择API基础URL
export const API_BASE_URL = __DEV__
  ? Platform.OS === 'android'
    ? 'http://10.0.2.2:8000/api/v1'  // Android模拟器访问本机地址
    : 'http://localhost:8000/api/v1' // iOS模拟器访问本机地址
  : 'https://api.zeroislenotes.com/api/v1'; // 生产环境地址

// API版本
export const API_VERSION = 'v1';

// 请求超时时间（毫秒）
export const REQUEST_TIMEOUT = 15000;

// 请求头
export const HEADERS = {
  'Content-Type': 'application/json',
  'Accept': 'application/json',
};

// 错误码
export const ERROR_CODES = {
  // 认证相关
  AUTH_REQUIRED: 401,
  INVALID_TOKEN: 401,
  TOKEN_EXPIRED: 401,
  INVALID_CREDENTIALS: 401,
  USER_NOT_FOUND: 404,
  USER_ALREADY_EXISTS: 400,
  INVALID_VERIFICATION_CODE: 400,
  VERIFICATION_CODE_EXPIRED: 400,

  // 业务相关
  INVALID_PARAMS: 400,
  RESOURCE_NOT_FOUND: 404,
  PERMISSION_DENIED: 403,
  SERVER_ERROR: 500,
};

// 错误消息
export const ERROR_MESSAGES = {
  [ERROR_CODES.AUTH_REQUIRED]: '请先登录',
  [ERROR_CODES.INVALID_TOKEN]: '无效的令牌',
  [ERROR_CODES.TOKEN_EXPIRED]: '令牌已过期',
  [ERROR_CODES.INVALID_CREDENTIALS]: '用户名或密码错误',
  [ERROR_CODES.USER_NOT_FOUND]: '用户不存在',
  [ERROR_CODES.USER_ALREADY_EXISTS]: '用户已存在',
  [ERROR_CODES.INVALID_VERIFICATION_CODE]: '验证码错误',
  [ERROR_CODES.VERIFICATION_CODE_EXPIRED]: '验证码已过期',
  [ERROR_CODES.INVALID_PARAMS]: '参数错误',
  [ERROR_CODES.RESOURCE_NOT_FOUND]: '资源不存在',
  [ERROR_CODES.PERMISSION_DENIED]: '权限不足',
  [ERROR_CODES.SERVER_ERROR]: '服务器错误',
};