import { axiosInstance } from './config';

const reminderApi = {
  /**
   * 获取所有提醒
   */
  getAll: () => axiosInstance.get('/reminders/'),

  /**
   * 创建提醒
   * @param {Object} reminderData - 提醒数据
   */
  create: (reminderData) => axiosInstance.post('/reminders/', reminderData),

  /**
   * 更新提醒
   * @param {string} id - 提醒ID
   * @param {Object} reminderData - 更新数据
   */
  update: (id, reminderData) => axiosInstance.put(`/reminders/${id}/`, reminderData),

  /**
   * 删除提醒
   * @param {string} id - 提醒ID
   */
  delete: (id) => axiosInstance.delete(`/reminders/${id}/`),

  /**
   * 获取即将到期的提醒
   * @param {number} days - 天数(默认7天)
   */
  getUpcoming: (days = 7) => axiosInstance.get('/reminders/upcoming/', { params: { days } }),

  /**
   * 标记提醒为已完成
   * @param {string} id - 提醒ID
   */
  markComplete: (id) => axiosInstance.post(`/reminders/complete/${id}/`),

  /**
   * 从笔记创建提醒
   * @param {Object} data - 包含note_id, title, description, due_date等
   */
  createFromNote: (data) => axiosInstance.post('/reminders/from-note/', data),

  /**
   * 启用/禁用提醒
   * @param {string} id - 提醒ID
   */
  toggleEnable: (id) => axiosInstance.post(`/reminders/${id}/toggle_enable/`),

  /**
   * 获取提醒通知
   */
  getNotifications: () => axiosInstance.get('/reminders/upcoming_notifications/')
};

export default reminderApi;
