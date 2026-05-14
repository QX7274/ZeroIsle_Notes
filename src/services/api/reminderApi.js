/**
 * 提醒API服务
 */
import instance from './apiClient';
import { API_ENDPOINTS } from '../../config/api';

/**
 * 获取所有提醒
 * @param {object} params - 查询参数
 * @returns {Promise} - 提醒列表
 */
export const getAllReminders = async (params = {}, requestOptions = {}) => {
  try {
    const response = await instance.get(API_ENDPOINTS.REMINDER.BASE, {
      params,
      metadata: {
        suppressGlobalErrorUI: Boolean(requestOptions.suppressGlobalErrorUI),
      },
    });
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    throw error;
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
      data: response.data,
    };
  } catch (error) {
    throw error;
  }
};

/**
 * 创建提醒
 * @param {object} reminderData - 提醒数据
 * @returns {Promise} - 创建结果
 */
export const createReminder = async (reminderData, requestOptions = {}) => {
  try {
    const response = await instance.post(API_ENDPOINTS.REMINDER.BASE, reminderData, {
      metadata: {
        suppressGlobalErrorUI: Boolean(requestOptions.suppressGlobalErrorUI),
      },
    });
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    throw error;
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
      data: response.data,
    };
  } catch (error) {
    throw error;
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
      success: true,
    };
  } catch (error) {
    throw error;
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
      data: response.data,
    };
  } catch (error) {
    throw error;
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
      data: response.data,
    };
  } catch (error) {
    throw error;
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
      data: response.data,
    };
  } catch (error) {
    throw error;
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
      data: response.data,
    };
  } catch (error) {
    throw error;
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
      data: response.data,
    };
  } catch (error) {
    throw error;
  }
};

/**
 * 从笔记创建提醒
 * @param {object} data - 包含note_id, title, description, due_date等
 * @returns {Promise} - 创建结果
 */
export const createReminderFromNote = async (data) => {
  try {
    const response = await instance.post(API_ENDPOINTS.REMINDER.BASE + 'from-note/', data);
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('从笔记创建提醒失败:', error);
    throw error;
  }
};

/**
 * 启用/禁用提醒
 * @param {string} id - 提醒ID
 * @returns {Promise} - 操作结果
 */
export const toggleEnableReminder = async (id) => {
  try {
    const response = await instance.post(`${API_ENDPOINTS.REMINDER.DETAIL(id)}toggle_enable/`);
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('启用/禁用提醒失败:', error);
    throw error;
  }
};

/**
 * 获取提醒通知
 * @returns {Promise} - 通知列表
 */
export const getReminderNotifications = async () => {
  try {
    const response = await instance.get(API_ENDPOINTS.REMINDER.BASE + 'notifications/');
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('获取提醒通知失败:', error);
    throw error;
  }
};

/**
 * 获取提醒统计信息
 * @returns {Promise} - 统计信息
 */
export const getReminderStatistics = async () => {
  try {
    const response = await instance.get(API_ENDPOINTS.REMINDER.STATISTICS);
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('获取提醒统计信息失败:', error);
    throw error;
  }
};

/**
 * 获取日历视图数据
 * @param {number} year - 年份
 * @param {number} month - 月份
 * @returns {Promise} - 日历数据
 */
export const getCalendarData = async (year, month) => {
  try {
    const response = await instance.get(API_ENDPOINTS.REMINDER.CALENDAR, {
      params: { year, month },
    });
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('获取日历数据失败:', error);
    throw error;
  }
};

/**
 * 导出提醒数据
 * @param {Object} options - 导出选项
 * @param {string} options.format - 导出格式 ('json' 或 'csv')
 * @param {boolean} options.includeCompleted - 是否包含已完成的提醒
 * @returns {Promise} - 导出数据
 */
export const exportReminders = async (options = {}) => {
  try {
    const response = await instance.get(API_ENDPOINTS.REMINDER.EXPORT, {
      params: options,
      responseType: 'text',
    });
    return {
      success: true,
      data: response.data,
      headers: response.headers,
    };
  } catch (error) {
    console.error('导出提醒数据失败:', error);
    throw error;
  }
};

/**
 * 导入提醒数据
 * @param {Array|Object} data - 导入提醒数组或包含 data 的对象
 * @returns {Promise} - 导入结果
 */
export const importReminders = async (data) => {
  try {
    const payload = Array.isArray(data) ? { data } : data;
    const response = await instance.post(API_ENDPOINTS.REMINDER.IMPORT, payload);
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('导入提醒数据失败:', error);
    throw error;
  }
};

/**
 * 更新提醒的日历集成信息
 * @param {string} id - 提醒ID
 * @param {Object} calendarData - 日历数据
 * @param {string} calendarData.calendar_event_id - 日历事件ID
 * @param {string} calendarData.calendar_id - 日历ID
 * @returns {Promise} - 更新结果
 */
export const updateReminderCalendarInfo = async (id, calendarData) => {
  try {
    const response = await instance.post(
      `${API_ENDPOINTS.REMINDER.DETAIL(id)}calendar_integration/`,
      calendarData
    );
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    console.error('更新提醒日历集成信息失败:', error);
    throw error;
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
  getReminderNotifications,
  getReminderStatistics,
  getCalendarData,
  exportReminders,
  importReminders,
  updateReminderCalendarInfo,
};

export default reminderApi;
