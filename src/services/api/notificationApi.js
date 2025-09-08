/**
 * 通知API服务
 */
import instance from './interceptor';
import { API_ENDPOINTS } from '../../config/api';
import networkErrorService from '../networkErrorService';

/**
 * 获取通知列表
 * @param {object} params - 查询参数
 * @returns {Promise} - 通知列表
 */
export const getNotifications = async (params = {}) => {
  try {
    const response = await instance.get(API_ENDPOINTS.NOTIFICATION.BASE, { params });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    if (networkErrorService.isNetworkError(error)) {
      networkErrorService.handleApiError(error, {
        context: '获取通知列表',
        customMessage: '网络连接失败，无法获取通知列表'
      });
    }
    return {
      success: false,
      message: error.message || '获取通知列表失败',
      error
    };
  }
};

/**
 * 获取通知详情
 * @param {string} id - 通知ID
 * @returns {Promise} - 通知详情
 */
export const getNotificationDetail = async (id) => {
  try {
    const response = await instance.get(API_ENDPOINTS.NOTIFICATION.DETAIL(id));
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    if (networkErrorService.isNetworkError(error)) {
      networkErrorService.handleApiError(error, {
        context: '获取通知详情',
        customMessage: '网络连接失败，无法获取通知详情'
      });
    }
    return {
      success: false,
      message: error.message || '获取通知详情失败',
      error
    };
  }
};

/**
 * 标记通知为已读
 * @param {string} id - 通知ID
 * @returns {Promise} - 操作结果
 */
export const markAsRead = async (id) => {
  try {
    const response = await instance.post(API_ENDPOINTS.NOTIFICATION.MARK_AS_READ(id));
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    if (networkErrorService.isNetworkError(error)) {
      networkErrorService.handleApiError(error, {
        context: '标记通知为已读',
        customMessage: '网络连接失败，无法标记通知为已读'
      });
    }
    return {
      success: false,
      message: error.message || '标记通知为已读失败',
      error
    };
  }
};

/**
 * 标记所有通知为已读
 * @returns {Promise} - 操作结果
 */
export const markAllAsRead = async () => {
  try {
    const response = await instance.post(API_ENDPOINTS.NOTIFICATION.MARK_ALL_AS_READ);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    if (networkErrorService.isNetworkError(error)) {
      networkErrorService.handleApiError(error, {
        context: '标记所有通知为已读',
        customMessage: '网络连接失败，无法标记所有通知为已读'
      });
    }
    return {
      success: false,
      message: error.message || '标记所有通知为已读失败',
      error
    };
  }
};

/**
 * 获取未读通知数量
 * @returns {Promise} - 未读通知数量
 */
export const getUnreadCount = async () => {
  try {
    const response = await instance.get(API_ENDPOINTS.NOTIFICATION.UNREAD_COUNT);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    if (networkErrorService.isNetworkError(error)) {
      networkErrorService.handleApiError(error, {
        context: '获取未读通知数量',
        customMessage: '网络连接失败，无法获取未读通知数量'
      });
    }
    return {
      success: false,
      message: error.message || '获取未读通知数量失败',
      error
    };
  }
};

/**
 * 删除所有通知
 * @returns {Promise} - 操作结果
 */
export const deleteAllNotifications = async () => {
  try {
    const response = await instance.delete(API_ENDPOINTS.NOTIFICATION.DELETE_ALL);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    if (networkErrorService.isNetworkError(error)) {
      networkErrorService.handleApiError(error, {
        context: '删除所有通知',
        customMessage: '网络连接失败，无法删除所有通知'
      });
    }
    return {
      success: false,
      message: error.message || '删除所有通知失败',
      error
    };
  }
};

// 导出默认对象
export default {
  getNotifications,
  getNotificationDetail,
  markAsRead,
  markAllAsRead,
  getUnreadCount,
  deleteAllNotifications
};
