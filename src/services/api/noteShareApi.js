/**
 * 笔记分享API服务
 * 提供笔记分享相关的API调用
 */

import { axiosInstance } from '../config';

/**
 * 获取笔记的分享列表
 * @param {string} noteId - 笔记ID
 * @returns {Promise} - 返回分享列表
 */
export const getNoteShares = (noteId) => {
  return axiosInstance.get(`/api/notes/${noteId}/shares/`);
};

/**
 * 创建笔记分享
 * @param {Object} shareData - 分享数据
 * @param {string} shareData.note_id - 笔记ID
 * @param {string} shareData.access_type - 访问类型 (public|link|password|specific_users)
 * @param {boolean} shareData.is_editable - 是否可编辑
 * @param {string} [shareData.password] - 访问密码 (access_type为password时必填)
 * @param {Array} [shareData.allowed_users_emails] - 允许访问的用户邮箱列表 (access_type为specific_users时必填)
 * @param {string} [shareData.expires_at] - 过期时间 (ISO格式日期字符串)
 * @returns {Promise} - 返回创建的分享
 */
export const createNoteShare = (shareData) => {
  return axiosInstance.post('/api/notes/shares/', shareData);
};

/**
 * 删除笔记分享
 * @param {string} shareId - 分享ID
 * @returns {Promise} - 返回删除结果
 */
export const deleteNoteShare = (shareId) => {
  return axiosInstance.delete(`/api/notes/shares/${shareId}/`);
};

/**
 * 重置分享链接
 * @param {string} shareId - 分享ID
 * @returns {Promise} - 返回更新后的分享
 */
export const resetShareLink = (shareId) => {
  return axiosInstance.post(`/api/notes/shares/${shareId}/reset-link/`);
};

/**
 * 更新分享设置
 * @param {string} shareId - 分享ID
 * @param {Object} updateData - 更新数据
 * @returns {Promise} - 返回更新后的分享
 */
export const updateNoteShare = (shareId, updateData) => {
  return axiosInstance.patch(`/api/notes/shares/${shareId}/`, updateData);
};

/**
 * 获取分享统计
 * @param {string} noteId - 笔记ID
 * @returns {Promise} - 返回分享统计
 */
export const getNoteShareStats = (noteId) => {
  return axiosInstance.get(`/api/notes/${noteId}/share-stats/`);
};

/**
 * 获取分享访问记录
 * @param {string} shareId - 分享ID
 * @returns {Promise} - 返回访问记录
 */
export const getShareAccessLogs = (shareId) => {
  return axiosInstance.get(`/api/notes/shares/${shareId}/access-logs/`);
};
