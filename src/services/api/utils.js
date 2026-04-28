/**
 * API工具函数
 */

/**
 * 处理API响应
 * @param {Object} response - Axios响应对象
 * @returns {Object} - 处理后的响应
 */
export const handleApiResponse = (response) => {
  return {
    success: true,
    data: response.data,
    status: response.status,
    headers: response.headers,
  };
};

/**
 * 处理API错误
 * @param {Error} error - Axios错误对象
 * @returns {Object} - 处理后的错误
 */
export const handleApiError = (error) => {
  // 网络错误
  if (error.message === 'Network Error') {
    throw new Error('网络错误，请检查网络连接');
  }

  // 超时错误
  if (error.message && error.message.includes('timeout')) {
    throw new Error('请求超时，请稍后重试');
  }

  // 服务器响应错误
  if (error.response) {
    const { status, data } = error.response;

    let message = '未知错误';
    if (data) {
      if (typeof data === 'string') {
        message = data;
      } else if (data.message) {
        message = data.message;
      } else if (data.detail) {
        message = data.detail;
      } else if (data.error) {
        message = data.error;
      } else if (Array.isArray(data.errors) && data.errors.length > 0) {
        message = data.errors[0].message || data.errors[0];
      }
    }

    const apiError = new Error(message);
    apiError.status = status;
    apiError.data = data;
    apiError.originalError = error;
    throw apiError;
  }

  // 其他错误
  throw new Error(error.message || '未知错误');
};

/**
 * 构建查询参数
 * @param {Object} params - 查询参数对象
 * @returns {string} - 查询参数字符串
 */
export const buildQueryParams = (params) => {
  if (!params || Object.keys(params).length === 0) {
    return '';
  }

  const queryParams = Object.entries(params)
    .filter(([_, value]) => value !== undefined && value !== null && value !== '')
    .map(([key, value]) => {
      if (Array.isArray(value)) {
        return value.map(item => `${encodeURIComponent(key)}=${encodeURIComponent(item)}`).join('&');
      }
      return `${encodeURIComponent(key)}=${encodeURIComponent(value)}`;
    })
    .join('&');

  return queryParams ? `?${queryParams}` : '';
};

/**
 * 格式化日期
 * @param {Date|string} date - 日期对象或日期字符串
 * @param {string} format - 格式化模板
 * @returns {string} - 格式化后的日期字符串
 */
export const formatDate = (date, format = 'YYYY-MM-DD HH:mm:ss') => {
  if (!date) {return '';}

  const d = typeof date === 'string' ? new Date(date) : date;

  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');

  return format
    .replace('YYYY', year)
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
};

export default {
  handleApiResponse,
  handleApiError,
  buildQueryParams,
  formatDate,
};
