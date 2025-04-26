/**
 * 提醒API服务
 */
import instance from './interceptor';
import { API_ENDPOINTS } from '../../config/api';

/**
 * 获取所有提醒
 * @param {object} params - 查询参数
 * @returns {Promise} - 提醒列表
 */
export const getAllReminders = async (params = {}) => {
  try {
    const response = await instance.get(API_ENDPOINTS.REMINDER.BASE, { params });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '获取提醒列表失败',
      error
    };
  }
};

/**
 * 获取提醒详情
 * @param {string} id - 提醒ID
 * @returns {Promise} - 提醒详情
 */
export const getReminderById = async (id) => {
  try {
    const response = await instance.get(API_ENDPOINTS.REMINDER.DETAIL(id));
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '获取提醒详情失败',
      error
    };
  }
};

/**
 * 创建提醒
 * @param {object} reminderData - 提醒数据
 * @returns {Promise} - 创建结果
 */
export const createReminder = async (reminderData) => {
  try {
    const response = await instance.post(API_ENDPOINTS.REMINDER.BASE, reminderData);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '创建提醒失败',
      error
    };
  }
};

/**
 * 更新提醒
 * @param {string} id - 提醒ID
 * @param {object} reminderData - 提醒数据
 * @returns {Promise} - 更新结果
 */
export const updateReminder = async (id, reminderData) => {
  try {
    const response = await instance.put(API_ENDPOINTS.REMINDER.DETAIL(id), reminderData);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '更新提醒失败',
      error
    };
  }
};

/**
 * 删除提醒
 * @param {string} id - 提醒ID
 * @returns {Promise} - 删除结果
 */
export const deleteReminder = async (id) => {
  try {
    await instance.delete(API_ENDPOINTS.REMINDER.DETAIL(id));
    return {
      success: true
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '删除提醒失败',
      error
    };
  }
};

/**
 * 完成提醒
 * @param {string} id - 提醒ID
 * @returns {Promise} - 操作结果
 */
export const completeReminder = async (id) => {
  try {
    const response = await instance.post(API_ENDPOINTS.REMINDER.COMPLETE(id));
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '完成提醒失败',
      error
    };
  }
};

/**
 * 重新打开提醒
 * @param {string} id - 提醒ID
 * @returns {Promise} - 操作结果
 */
export const reopenReminder = async (id) => {
  try {
    const response = await instance.post(API_ENDPOINTS.REMINDER.REOPEN(id));
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '重新打开提醒失败',
      error
    };
  }
};

/**
 * 获取即将到期的提醒
 * @param {object} params - 查询参数
 * @returns {Promise} - 提醒列表
 */
export const getUpcomingReminders = async (params = {}) => {
  try {
    const response = await instance.get(API_ENDPOINTS.REMINDER.UPCOMING, { params });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '获取即将到期的提醒失败',
      error
    };
  }
};

/**
 * 获取已过期的提醒
 * @param {object} params - 查询参数
 * @returns {Promise} - 提醒列表
 */
export const getOverdueReminders = async (params = {}) => {
  try {
    const response = await instance.get(API_ENDPOINTS.REMINDER.OVERDUE, { params });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '获取已过期的提醒失败',
      error
    };
  }
};

/**
 * 获取今日提醒
 * @param {object} params - 查询参数
 * @returns {Promise} - 提醒列表
 */
export const getTodayReminders = async (params = {}) => {
  try {
    const response = await instance.get(API_ENDPOINTS.REMINDER.TODAY, { params });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '获取今日提醒失败',
      error
    };
  }
};

/**
 * 从笔记创建提醒
 * @param {object} data - 包含note_id, title, description, due_date等
 * @returns {Promise} - 创建结果
 */
export const createReminderFromNote = async (data) => {
  try {
    const response = await instance.post('/reminder/from-note/', data);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '从笔记创建提醒失败',
      error
    };
  }
};

/**
 * 启用/禁用提醒
 * @param {string} id - 提醒ID
 * @returns {Promise} - 操作结果
 */
export const toggleEnableReminder = async (id) => {
  try {
    const response = await instance.post(`/reminder/reminders/${id}/toggle_enable/`);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '启用/禁用提醒失败',
      error
    };
  }
};

/**
 * 获取提醒通知
 * @returns {Promise} - 通知列表
 */
export const getReminderNotifications = async () => {
  try {
    const response = await instance.get('/reminder/notifications/');
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '获取提醒通知失败',
      error
    };
  }
};

const reminderApi = {
  getAllReminders,
  getReminderById,
  createReminder,
  updateReminder,
  deleteReminder,
  completeReminder,
  reopenReminder,
  getUpcomingReminders,
  getOverdueReminders,
  getTodayReminders,
  createReminderFromNote,
  toggleEnableReminder,
  getReminderNotifications
};

export default reminderApi;
