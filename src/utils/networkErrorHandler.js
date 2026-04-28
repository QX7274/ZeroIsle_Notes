/**
 * 网络错误处理工具
 * 为用户提供友好的错误提示，为开发者提供详细的日志信息
 */

import { Alert } from 'react-native';

/**
 * 网络错误类型映射
 */
const ERROR_TYPES = {
  NETWORK_ERROR: 'network_error',
  TIMEOUT_ERROR: 'timeout_error',
  SERVER_ERROR: 'server_error',
  AUTH_ERROR: 'auth_error',
  NOT_FOUND_ERROR: 'not_found_error',
  VALIDATION_ERROR: 'validation_error',
  UNKNOWN_ERROR: 'unknown_error',
};

/**
 * 用户友好的错误消息
 */
const USER_FRIENDLY_MESSAGES = {
  [ERROR_TYPES.NETWORK_ERROR]: {
    title: '网络连接问题',
    message: '请检查您的网络连接后重试',
    icon: '🌐',
  },
  [ERROR_TYPES.TIMEOUT_ERROR]: {
    title: '请求超时',
    message: '服务器响应较慢，请稍后重试',
    icon: '⏱️',
  },
  [ERROR_TYPES.SERVER_ERROR]: {
    title: '服务暂时不可用',
    message: '服务器正在维护中，请稍后重试',
    icon: '🔧',
  },
  [ERROR_TYPES.AUTH_ERROR]: {
    title: '身份验证失败',
    message: '请重新登录后继续使用',
    icon: '🔐',
  },
  [ERROR_TYPES.NOT_FOUND_ERROR]: {
    title: '资源不存在',
    message: '请求的内容不存在或已被删除',
    icon: '📭',
  },
  [ERROR_TYPES.VALIDATION_ERROR]: {
    title: '数据格式错误',
    message: '请检查输入的信息是否正确',
    icon: '📝',
  },
  [ERROR_TYPES.UNKNOWN_ERROR]: {
    title: '未知错误',
    message: '发生了意外错误，请重试',
    icon: '❓',
  },
};

/**
 * 分析错误类型
 */
const analyzeError = (error) => {
  // 网络连接错误
  if (error.code === 'NETWORK_ERROR' ||
      error.message?.includes('Network Error') ||
      error.message?.includes('网络错误') ||
      !navigator.onLine) {
    return ERROR_TYPES.NETWORK_ERROR;
  }

  // 超时错误
  if (error.code === 'ECONNABORTED' ||
      error.message?.includes('timeout') ||
      error.message?.includes('超时')) {
    return ERROR_TYPES.TIMEOUT_ERROR;
  }

  // HTTP状态码错误
  if (error.response?.status) {
    const status = error.response.status;
    if (status === 401 || status === 403) {
      return ERROR_TYPES.AUTH_ERROR;
    }
    if (status === 404) {
      return ERROR_TYPES.NOT_FOUND_ERROR;
    }
    if (status >= 400 && status < 500) {
      return ERROR_TYPES.VALIDATION_ERROR;
    }
    if (status >= 500) {
      return ERROR_TYPES.SERVER_ERROR;
    }
  }

  // 服务器错误关键词
  if (error.message?.includes('服务器') ||
      error.message?.includes('Server') ||
      error.message?.includes('Internal')) {
    return ERROR_TYPES.SERVER_ERROR;
  }

  return ERROR_TYPES.UNKNOWN_ERROR;
};

/**
 * 记录详细的开发者日志
 */
const logDetailedError = (error, context = '') => {
  const timestamp = new Date().toISOString();
  const errorInfo = {
    timestamp,
    context,
    message: error.message,
    stack: error.stack,
    code: error.code,
    status: error.response?.status,
    statusText: error.response?.statusText,
    url: error.config?.url || error.request?.responseURL,
    method: error.config?.method,
    headers: error.config?.headers,
    data: error.config?.data,
    response: error.response?.data,
  };

  console.group(`🚨 网络错误详情 [${timestamp}]`);
  console.error('错误上下文:', context);
  console.error('错误消息:', error.message);
  console.error('错误对象:', error);
  console.error('完整错误信息:', errorInfo);
  console.groupEnd();

  // 如果有错误追踪服务，可以在这里发送
  // errorTrackingService.captureException(error, errorInfo);
};

/**
 * 显示用户友好的错误弹窗
 */
const showUserFriendlyError = (errorType, customMessage = null, actions = []) => {
  const errorConfig = USER_FRIENDLY_MESSAGES[errorType];
  const title = `${errorConfig.icon} ${errorConfig.title}`;
  const message = customMessage || errorConfig.message;

  const defaultActions = [
    { text: '确定', style: 'default' },
  ];

  const alertActions = actions.length > 0 ? actions : defaultActions;

  Alert.alert(title, message, alertActions, { cancelable: true });
};

/**
 * 主要的网络错误处理函数
 */
export const handleNetworkError = (error, options = {}) => {
  const {
    context = '网络请求',
    showAlert = true,
    customMessage = null,
    actions = [],
    logError = true,
  } = options;

  // 记录详细的开发者日志
  if (logError) {
    logDetailedError(error, context);
  }

  // 分析错误类型
  const errorType = analyzeError(error);

  // 显示用户友好的错误提示
  if (showAlert) {
    showUserFriendlyError(errorType, customMessage, actions);
  }

  return {
    type: errorType,
    userMessage: customMessage || USER_FRIENDLY_MESSAGES[errorType].message,
    originalError: error,
  };
};

/**
 * 创建带有错误处理的网络请求包装器
 */
export const createNetworkWrapper = (requestFunction, context) => {
  return async (...args) => {
    try {
      return await requestFunction(...args);
    } catch (error) {
      const errorResult = handleNetworkError(error, { context });
      throw errorResult;
    }
  };
};

/**
 * 快速错误处理方法
 */
export const quickErrorHandler = {
  // 网络连接错误
  network: (customMessage) => handleNetworkError(
    new Error('Network connection failed'),
    { customMessage }
  ),

  // 服务器错误
  server: (customMessage) => handleNetworkError(
    { response: { status: 500 } },
    { customMessage }
  ),

  // 认证错误
  auth: (customMessage) => handleNetworkError(
    { response: { status: 401 } },
    { customMessage }
  ),

  // 超时错误
  timeout: (customMessage) => handleNetworkError(
    new Error('Request timeout'),
    { customMessage }
  ),
};

export default {
  handleNetworkError,
  createNetworkWrapper,
  quickErrorHandler,
  ERROR_TYPES,
};
