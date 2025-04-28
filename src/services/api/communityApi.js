/**
 * 社区API服务
 * 提供社区相关的API调用，包括帖子、评论、点赞、关注等功能
 */
import instance from './interceptor';
import { API_ENDPOINTS } from '../../config/api';
import { offlineStorageService } from '../offlineStorage';

/**
 * 获取社区帖子列表
 * @param {object} params - 查询参数
 * @returns {Promise} - 帖子列表
 */
export const getPosts = async (params = {}) => {
  try {
    const response = await instance.get(API_ENDPOINTS.COMMUNITY.POSTS, { params });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '获取社区帖子失败',
      error
    };
  }
};

/**
 * 点赞/取消点赞帖子
 * @param {string} id - 帖子ID
 * @returns {Promise} - 操作结果
 */
export const togglePostLike = async (id) => {
  try {
    const response = await instance.post(API_ENDPOINTS.COMMUNITY.LIKE_POST(id));
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '点赞操作失败',
      error
    };
  }
};

/**
 * 获取帖子评论
 * @param {string} id - 帖子ID
 * @param {object} params - 查询参数
 * @returns {Promise} - 评论列表
 */
export const getPostComments = async (id, params = {}) => {
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
 * @param {string} id - 帖子ID
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
 * 点赞/取消点赞评论
 * @param {string} id - 评论ID
 * @returns {Promise} - 操作结果
 */
export const toggleCommentLike = async (id) => {
  try {
    const response = await instance.post(API_ENDPOINTS.COMMUNITY.LIKE_COMMENT(id));
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '点赞评论失败',
      error
    };
  }
};

/**
 * 关注/取消关注用户
 * @param {string} userId - 用户ID
 * @returns {Promise} - 操作结果
 */
export const toggleFollow = async (userId) => {
  try {
    const response = await instance.post(API_ENDPOINTS.COMMUNITY.FOLLOW, {
      content_type: 'User',
      object_id: userId
    });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '关注操作失败',
      error
    };
  }
};

/**
 * 获取用户的关注者
 * @param {string} userId - 用户ID
 * @param {object} params - 查询参数
 * @returns {Promise} - 关注者列表
 */
export const getUserFollowers = async (userId, params = {}) => {
  try {
    const response = await instance.get(API_ENDPOINTS.COMMUNITY.FOLLOWERS, {
      params: {
        ...params,
        content_type: 'User',
        object_id: userId
      }
    });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '获取关注者失败',
      error
    };
  }
};

/**
 * 获取用户关注的人
 * @param {string} userId - 用户ID
 * @param {object} params - 查询参数
 * @returns {Promise} - 关注列表
 */
export const getUserFollowing = async (userId, params = {}) => {
  try {
    const response = await instance.get(API_ENDPOINTS.COMMUNITY.FOLLOWING, {
      params: {
        ...params,
        user_id: userId
      }
    });
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
    const response = await instance.get(API_ENDPOINTS.COMMUNITY.POPULAR_TAGS, { params });
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
 * 获取所有标签
 * @param {object} params - 查询参数
 * @returns {Promise} - 标签列表
 */
export const getTags = async (params = {}) => {
  try {
    const response = await instance.get(API_ENDPOINTS.COMMUNITY.TAGS, { params });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '获取标签失败',
      error
    };
  }
};

/**
 * 获取所有分类
 * @param {object} params - 查询参数
 * @returns {Promise} - 分类列表
 */
export const getCategories = async (params = {}) => {
  try {
    const response = await instance.get(API_ENDPOINTS.COMMUNITY.CATEGORIES, { params });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '获取分类失败',
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
 * 获取帖子详情
 * @param {string} id - 帖子ID
 * @returns {Promise} - 帖子详情
 */
export const getPostDetail = async (id) => {
  try {
    // 检查网络状态
    const status = offlineStorageService.getStatus();

    if (!status.isOnline) {
      // 离线模式：从缓存获取
      const cachedPosts = await offlineStorageService.getCachedData('community_posts');
      const post = cachedPosts?.find(p => p.id === id);

      if (post) {
        return {
          success: true,
          data: post,
          fromCache: true
        };
      } else {
        return {
          success: false,
          message: '离线模式下无法获取未缓存的帖子',
          error: new Error('Offline mode')
        };
      }
    }

    // 在线模式：从服务器获取
    const response = await instance.get(API_ENDPOINTS.COMMUNITY.POST_DETAIL(id));

    // 缓存数据
    const cachedPosts = await offlineStorageService.getCachedData('community_posts') || [];
    const postIndex = cachedPosts.findIndex(p => p.id === id);

    if (postIndex >= 0) {
      cachedPosts[postIndex] = response.data;
    } else {
      cachedPosts.push(response.data);
    }

    await offlineStorageService.cacheData('community_posts', cachedPosts);

    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '获取帖子详情失败',
      error
    };
  }
};

/**
 * 创建帖子
 * @param {object} postData - 帖子数据
 * @returns {Promise} - 创建结果
 */
export const createPost = async (postData) => {
  try {
    // 检查网络状态
    const status = offlineStorageService.getStatus();

    if (!status.isOnline) {
      // 离线模式：添加到待处理操作
      const tempId = `temp_${Date.now()}`;
      const tempPost = {
        ...postData,
        id: tempId,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_synced: false
      };

      // 添加到离线存储
      await offlineStorageService.addPendingOperation({
        type: 'create_post',
        data: postData,
        timestamp: new Date().toISOString()
      });

      // 更新缓存
      const cachedPosts = await offlineStorageService.getCachedData('community_posts') || [];
      cachedPosts.unshift(tempPost);
      await offlineStorageService.cacheData('community_posts', cachedPosts);

      return {
        success: true,
        data: tempPost,
        fromCache: true
      };
    }

    // 在线模式：发送到服务器
    const response = await instance.post(API_ENDPOINTS.COMMUNITY.POSTS, postData);

    // 更新缓存
    const cachedPosts = await offlineStorageService.getCachedData('community_posts') || [];
    cachedPosts.unshift(response.data);
    await offlineStorageService.cacheData('community_posts', cachedPosts);

    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '创建帖子失败',
      error
    };
  }
};

/**
 * 更新帖子
 * @param {string} id - 帖子ID
 * @param {object} postData - 帖子数据
 * @returns {Promise} - 更新结果
 */
export const updatePost = async (id, postData) => {
  try {
    // 检查网络状态
    const status = offlineStorageService.getStatus();

    if (!status.isOnline) {
      // 离线模式：添加到待处理操作
      await offlineStorageService.addPendingOperation({
        type: 'update_post',
        data: { id, ...postData },
        timestamp: new Date().toISOString()
      });

      // 更新缓存
      const cachedPosts = await offlineStorageService.getCachedData('community_posts') || [];
      const postIndex = cachedPosts.findIndex(p => p.id === id);

      if (postIndex >= 0) {
        cachedPosts[postIndex] = {
          ...cachedPosts[postIndex],
          ...postData,
          updated_at: new Date().toISOString(),
          is_synced: false
        };
        await offlineStorageService.cacheData('community_posts', cachedPosts);
      }

      return {
        success: true,
        data: cachedPosts[postIndex],
        fromCache: true
      };
    }

    // 在线模式：发送到服务器
    const response = await instance.put(API_ENDPOINTS.COMMUNITY.POST_DETAIL(id), postData);

    // 更新缓存
    const cachedPosts = await offlineStorageService.getCachedData('community_posts') || [];
    const postIndex = cachedPosts.findIndex(p => p.id === id);

    if (postIndex >= 0) {
      cachedPosts[postIndex] = response.data;
      await offlineStorageService.cacheData('community_posts', cachedPosts);
    }

    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '更新帖子失败',
      error
    };
  }
};

/**
 * 删除帖子
 * @param {string} id - 帖子ID
 * @returns {Promise} - 删除结果
 */
export const deletePost = async (id) => {
  try {
    // 检查网络状态
    const status = offlineStorageService.getStatus();

    if (!status.isOnline) {
      // 离线模式：添加到待处理操作
      await offlineStorageService.addPendingOperation({
        type: 'delete_post',
        data: { id },
        timestamp: new Date().toISOString()
      });

      // 更新缓存
      const cachedPosts = await offlineStorageService.getCachedData('community_posts') || [];
      const updatedPosts = cachedPosts.filter(p => p.id !== id);
      await offlineStorageService.cacheData('community_posts', updatedPosts);

      return {
        success: true,
        fromCache: true
      };
    }

    // 在线模式：发送到服务器
    await instance.delete(API_ENDPOINTS.COMMUNITY.POST_DETAIL(id));

    // 更新缓存
    const cachedPosts = await offlineStorageService.getCachedData('community_posts') || [];
    const updatedPosts = cachedPosts.filter(p => p.id !== id);
    await offlineStorageService.cacheData('community_posts', updatedPosts);

    return {
      success: true
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '删除帖子失败',
      error
    };
  }
};

/**
 * 获取用户帖子
 * @param {string} userId - 用户ID
 * @param {object} params - 查询参数
 * @returns {Promise} - 帖子列表
 */
export const getUserPosts = async (userId, params = {}) => {
  try {
    const response = await instance.get(`/community/users/${userId}/posts/`, { params });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '获取用户帖子失败',
      error
    };
  }
};

/**
 * 获取用户通知
 * @param {object} params - 查询参数
 * @returns {Promise} - 通知列表
 */
export const getUserNotifications = async (params = {}) => {
  try {
    const response = await instance.get(API_ENDPOINTS.COMMUNITY.NOTIFICATIONS, { params });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '获取通知失败',
      error
    };
  }
};

/**
 * 标记通知为已读
 * @param {string} id - 通知ID
 * @returns {Promise} - 操作结果
 */
export const markNotificationAsRead = async (id) => {
  try {
    const response = await instance.post(API_ENDPOINTS.COMMUNITY.MARK_NOTIFICATION_READ(id));
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '标记通知失败',
      error
    };
  }
};

/**
 * 标记所有通知为已读
 * @returns {Promise} - 操作结果
 */
export const markAllNotificationsAsRead = async () => {
  try {
    const response = await instance.post(`${API_ENDPOINTS.COMMUNITY.NOTIFICATIONS}mark_all_as_read/`);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '标记所有通知失败',
      error
    };
  }
};

const communityApi = {
  // 帖子相关
  getPosts,
  getPostDetail,
  createPost,
  updatePost,
  deletePost,
  togglePostLike,
  getUserPosts,

  // 评论相关
  getPostComments,
  addComment,
  deleteComment,
  toggleCommentLike,

  // 关注相关
  toggleFollow,
  getUserFollowers,
  getUserFollowing,

  // 标签和分类
  getTags,
  getPopularTags,
  getCategories,

  // 活动和通知
  getActivityStream,
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,

  // 其他
  getRecommendedUsers,
  shareNoteToCommuity,

  // 兼容旧版API
  getCommunityNotes: getPosts,
  toggleLike: togglePostLike,
  getNoteComments: getPostComments
};

export default communityApi;
