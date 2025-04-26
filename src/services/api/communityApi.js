/**
 * 社区API服务
 */
import instance from './interceptor';
import { API_ENDPOINTS } from '../../config/api';

/**
 * 获取社区笔记
 * @param {object} params - 查询参数
 * @returns {Promise} - 笔记列表
 */
export const getCommunityNotes = async (params = {}) => {
  try {
    const response = await instance.get(API_ENDPOINTS.COMMUNITY.NOTES, { params });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '获取社区笔记失败',
      error
    };
  }
};

/**
 * 点赞/取消点赞笔记
 * @param {string} id - 笔记ID
 * @returns {Promise} - 操作结果
 */
export const toggleLike = async (id) => {
  try {
    const response = await instance.post(API_ENDPOINTS.COMMUNITY.LIKE(id));
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '操作失败',
      error
    };
  }
};

/**
 * 获取笔记评论
 * @param {string} id - 笔记ID
 * @param {object} params - 查询参数
 * @returns {Promise} - 评论列表
 */
export const getNoteComments = async (id, params = {}) => {
  try {
    const response = await instance.get(API_ENDPOINTS.COMMUNITY.COMMENTS(id), { params });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '获取评论失败',
      error
    };
  }
};

/**
 * 添加评论
 * @param {string} id - 笔记ID
 * @param {object} commentData - 评论数据
 * @returns {Promise} - 添加结果
 */
export const addComment = async (id, commentData) => {
  try {
    const response = await instance.post(API_ENDPOINTS.COMMUNITY.COMMENTS(id), commentData);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '添加评论失败',
      error
    };
  }
};

/**
 * 删除评论
 * @param {string} id - 评论ID
 * @returns {Promise} - 删除结果
 */
export const deleteComment = async (id) => {
  try {
    await instance.delete(API_ENDPOINTS.COMMUNITY.COMMENT_DETAIL(id));
    return {
      success: true
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '删除评论失败',
      error
    };
  }
};

/**
 * 关注/取消关注用户
 * @param {string} id - 用户ID
 * @returns {Promise} - 操作结果
 */
export const toggleFollow = async (id) => {
  try {
    const response = await instance.post(API_ENDPOINTS.COMMUNITY.FOLLOW(id));
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '操作失败',
      error
    };
  }
};

/**
 * 获取活动流
 * @param {object} params - 查询参数
 * @returns {Promise} - 活动列表
 */
export const getActivityStream = async (params = {}) => {
  try {
    const response = await instance.get(API_ENDPOINTS.COMMUNITY.ACTIVITY, { params });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '获取活动流失败',
      error
    };
  }
};

/**
 * 分享笔记到社区
 * @param {string} id - 笔记ID
 * @param {object} shareData - 分享数据
 * @returns {Promise} - 分享结果
 */
export const shareNoteToCommuity = async (id, shareData) => {
  try {
    const response = await instance.post(`/notes/${id}/share/`, shareData);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '分享笔记失败',
      error
    };
  }
};

/**
 * 获取热门标签
 * @param {object} params - 查询参数
 * @returns {Promise} - 标签列表
 */
export const getPopularTags = async (params = {}) => {
  try {
    const response = await instance.get('/community/tags/popular/', { params });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '获取热门标签失败',
      error
    };
  }
};

/**
 * 获取推荐用户
 * @param {object} params - 查询参数
 * @returns {Promise} - 用户列表
 */
export const getRecommendedUsers = async (params = {}) => {
  try {
    const response = await instance.get('/community/users/recommended/', { params });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '获取推荐用户失败',
      error
    };
  }
};

/**
 * 获取用户关注的人
 * @param {string} id - 用户ID
 * @param {object} params - 查询参数
 * @returns {Promise} - 用户列表
 */
export const getUserFollowing = async (id, params = {}) => {
  try {
    const response = await instance.get(`/community/users/${id}/following/`, { params });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '获取关注列表失败',
      error
    };
  }
};

/**
 * 获取用户的粉丝
 * @param {string} id - 用户ID
 * @param {object} params - 查询参数
 * @returns {Promise} - 用户列表
 */
export const getUserFollowers = async (id, params = {}) => {
  try {
    const response = await instance.get(`/community/users/${id}/followers/`, { params });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '获取粉丝列表失败',
      error
    };
  }
};

const communityApi = {
  getCommunityNotes,
  toggleLike,
  getNoteComments,
  addComment,
  deleteComment,
  toggleFollow,
  getActivityStream,
  shareNoteToCommuity,
  getPopularTags,
  getRecommendedUsers,
  getUserFollowing,
  getUserFollowers
};

export default communityApi;
