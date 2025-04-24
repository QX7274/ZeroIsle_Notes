/**
 * 社区API服务
 * 提供社区相关的API调用
 */

import axios from 'axios';

/**
 * 获取社区帖子列表
 * @param {Object} params - 查询参数
 * @param {number} params.page - 页码
 * @param {number} params.pageSize - 每页数量
 * @param {string} params.tag - 标签过滤
 * @param {string} params.category - 分类过滤
 * @param {string} params.author - 作者过滤
 * @param {boolean} params.featured - 是否只看精选
 * @param {string} params.ordering - 排序方式
 * @returns {Promise} - 返回帖子列表
 */
export const getPosts = (params = {}) => {
  return axios.get('/api/community/posts/', { params });
};

/**
 * 获取帖子详情
 * @param {string} postId - 帖子ID
 * @returns {Promise} - 返回帖子详情
 */
export const getPostDetail = (postId) => {
  return axios.get(`/api/community/posts/${postId}/`);
};

/**
 * 创建帖子
 * @param {Object} data - 帖子数据
 * @param {string} data.title - 标题
 * @param {string} data.content - 内容
 * @param {string} data.note - 关联笔记ID
 * @param {boolean} data.is_public - 是否公开
 * @param {Array} data.tags - 标签列表
 * @returns {Promise} - 返回创建的帖子
 */
export const createPost = (data) => {
  return axios.post('/api/community/posts/', data);
};

/**
 * 更新帖子
 * @param {string} postId - 帖子ID
 * @param {Object} data - 帖子数据
 * @returns {Promise} - 返回更新后的帖子
 */
export const updatePost = (postId, data) => {
  return axios.patch(`/api/community/posts/${postId}/`, data);
};

/**
 * 删除帖子
 * @param {string} postId - 帖子ID
 * @returns {Promise} - 返回删除结果
 */
export const deletePost = (postId) => {
  return axios.delete(`/api/community/posts/${postId}/`);
};

/**
 * 点赞帖子
 * @param {string} postId - 帖子ID
 * @returns {Promise} - 返回点赞结果
 */
export const likePost = (postId) => {
  return axios.post(`/api/community/posts/${postId}/like/`);
};

/**
 * 收藏帖子
 * @param {string} postId - 帖子ID
 * @returns {Promise} - 返回收藏结果
 */
export const favoritePost = (postId) => {
  return axios.post(`/api/community/posts/${postId}/favorite/`);
};

/**
 * 获取评论列表
 * @param {Object} params - 查询参数
 * @param {string} params.post - 帖子ID
 * @param {string} params.parent - 父评论ID
 * @returns {Promise} - 返回评论列表
 */
export const getComments = (params = {}) => {
  return axios.get('/api/community/comments/', { params });
};

/**
 * 创建评论
 * @param {Object} data - 评论数据
 * @param {string} data.post - 帖子ID
 * @param {string} data.content - 内容
 * @param {string} data.parent - 父评论ID
 * @returns {Promise} - 返回创建的评论
 */
export const createComment = (data) => {
  return axios.post('/api/community/comments/', data);
};

/**
 * 点赞评论
 * @param {string} commentId - 评论ID
 * @returns {Promise} - 返回点赞结果
 */
export const likeComment = (commentId) => {
  return axios.post(`/api/community/comments/${commentId}/like/`);
};

/**
 * 获取标签列表
 * @param {Object} params - 查询参数
 * @param {string} params.search - 搜索关键词
 * @returns {Promise} - 返回标签列表
 */
export const getTags = (params = {}) => {
  return axios.get('/api/community/tags/', { params });
};

/**
 * 获取分类列表
 * @returns {Promise} - 返回分类列表
 */
export const getCategories = () => {
  return axios.get('/api/community/categories/');
};

/**
 * 获取通知列表
 * @returns {Promise} - 返回通知列表
 */
export const getNotifications = () => {
  return axios.get('/api/community/notifications/');
};

/**
 * 标记通知为已读
 * @param {string} notificationId - 通知ID
 * @returns {Promise} - 返回标记结果
 */
export const markNotificationAsRead = (notificationId) => {
  return axios.post(`/api/community/notifications/${notificationId}/mark_as_read/`);
};

/**
 * 标记所有通知为已读
 * @returns {Promise} - 返回标记结果
 */
export const markAllNotificationsAsRead = () => {
  return axios.post('/api/community/notifications/mark_all_as_read/');
};

/**
 * 关注用户
 * @param {string} userId - 用户ID
 * @returns {Promise} - 返回关注结果
 */
export const followUser = (userId) => {
  return axios.post('/api/community/follows/', { followed: userId });
};

/**
 * 取消关注用户
 * @param {string} followId - 关注ID
 * @returns {Promise} - 返回取消关注结果
 */
export const unfollowUser = (followId) => {
  return axios.delete(`/api/community/follows/${followId}/`);
};

/**
 * 获取关注我的用户
 * @returns {Promise} - 返回关注我的用户列表
 */
export const getFollowers = () => {
  return axios.get('/api/community/follows/followers/');
};

/**
 * 获取我关注的用户
 * @returns {Promise} - 返回我关注的用户列表
 */
export const getFollowing = () => {
  return axios.get('/api/community/follows/following/');
};

/**
 * 获取我的帖子
 * @returns {Promise} - 返回我的帖子列表
 */
export const getMyPosts = () => {
  return axios.get('/api/community/posts/my_posts/');
};

/**
 * 获取我收藏的帖子
 * @returns {Promise} - 返回我收藏的帖子列表
 */
export const getMyFavorites = () => {
  return axios.get('/api/community/posts/my_favorites/');
};
