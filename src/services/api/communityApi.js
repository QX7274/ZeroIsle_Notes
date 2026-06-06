/**
 * 社区API服务
 * 提供社区相关的API调用，包括帖子、评论、点赞、关注等功能
 */
import instance from './apiClient';
// 统一改为使用 src/config/api.js 提供的端点（baseURL 已包含 /api/v1 前缀）
import { API_ENDPOINTS } from '../../config/api';
import realmService from '../database/realmService';
import networkService from '../network/networkService';

/**
 * 获取社区帖子列表
 * @param {object} params - 查询参数
 * @returns {Promise} - 帖子列表
 */
export const getPosts = async (params = {}, requestOptions = {}) => {
  try {
    const response = await instance.get(API_ENDPOINTS.COMMUNITY.POSTS, {
      params,
      metadata: {
        suppressGlobalErrorUI: Boolean(requestOptions.suppressGlobalErrorUI),
      },
    });
    // apiClient 响应拦截器已返回 response.data，这里直接用 response
    return {
      success: true,
      data: response,
    };
  } catch (error) {
    throw error;
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
      data: response,
    };
  } catch (error) {
    throw error;
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
    // 使用后端提供的 by_post 动作，保证与后端 CommentViewSet 对齐
    const response = await instance.get(
      API_ENDPOINTS.COMMUNITY.COMMENTS_BY_POST(id),
      { params }
    );
    return {
      success: true,
      data: response,
    };
  } catch (error) {
    throw error;
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
    // 后端创建评论接口为 /community/comments/ ，字段为 { post_id, parent_id?, content }
    const payload = { post_id: id, ...commentData };
    const response = await instance.post(API_ENDPOINTS.COMMUNITY.COMMENTS, payload);
    return {
      success: true,
      data: response,
    };
  } catch (error) {
    throw error;
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
      success: true,
    };
  } catch (error) {
    throw error;
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
      data: response,
    };
  } catch (error) {
    throw error;
  }
};

/**
 * 关注/取消关注用户
 * @param {string} userId - 用户ID
 * @returns {Promise} - 操作结果
 */
export const toggleFollow = async (userId) => {
  try {
    const response = await instance.post(API_ENDPOINTS.COMMUNITY.FOLLOW(userId), {
      content_type: 'User',
      object_id: userId,
    });
    return {
      success: true,
      data: response,
    };
  } catch (error) {
    throw error;
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
    const response = await instance.get(API_ENDPOINTS.COMMUNITY.FOLLOWERS(userId), {
      params: {
        ...params,
        content_type: 'User',
        object_id: userId,
      },
    });
    return {
      success: true,
      data: response,
    };
  } catch (error) {
    throw error;
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
    const response = await instance.get(API_ENDPOINTS.COMMUNITY.FOLLOWING(userId), {
      params: {
        ...params,
        user_id: userId,
      },
    });
    return {
      success: true,
      data: response,
    };
  } catch (error) {
    throw error;
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
      data: response,
    };
  } catch (error) {
    throw error;
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
      data: response,
    };
  } catch (error) {
    throw error;
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
      data: response,
    };
  } catch (error) {
    throw error;
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
      data: response,
    };
  } catch (error) {
    throw error;
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
      data: response,
    };
  } catch (error) {
    throw error;
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
      data: response,
    };
  } catch (error) {
    throw error;
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
    const isOnline = await networkService.checkConnection();

    if (!isOnline) {
      // 离线模式：从缓存获取
      // 使用 realmService 替代 offlineStorageService
      const realm = await realmService.getRealm();
      const cachedData = realm.objects('StorageItem').filtered('key = "community_posts"');
      const cachedPosts = cachedData.length > 0 ? JSON.parse(cachedData[0].value) : null;
      const post = cachedPosts?.find(p => p.id === id);

      if (post) {
        return {
          success: true,
          data: post,
          fromCache: true,
        };
      } else {
        throw new Error('离线模式下无法获取未缓存的帖子');
      }
    }

    // 在线模式：从服务器获取
    const response = await instance.get(API_ENDPOINTS.COMMUNITY.POST_DETAIL(id));

    // 缓存数据
    // 使用 realmService 替代 offlineStorageService
    const realm = await realmService.getRealm();
    const cachedData = realm.objects('StorageItem').filtered('key = "community_posts"');
    const cachedPosts = cachedData.length > 0 ? JSON.parse(cachedData[0].value) : [];
    const postIndex = cachedPosts.findIndex(p => p.id === id);

    if (postIndex >= 0) {
      cachedPosts[postIndex] = response;
    } else {
      cachedPosts.push(response);
    }

    // 使用 realmService 缓存数据
    const cacheRealm = await realmService.getRealm();
    cacheRealm.write(() => {
      const existingItem = cacheRealm.objects('StorageItem').filtered('key = "community_posts"');
      if (existingItem.length > 0) {
        existingItem[0].value = JSON.stringify(cachedPosts);
        existingItem[0].updated_at = new Date();
      } else {
        cacheRealm.create('StorageItem', {
          key: 'community_posts',
          value: JSON.stringify(cachedPosts),
          createdAt: new Date(),
          updated_at: new Date(),
        });
      }
    });

    return {
      success: true,
      data: response,
    };
  } catch (error) {
    throw error;
  }
};

/**
 * 创建帖子
 * @param {object|FormData} postData - 帖子数据或FormData对象
 * @returns {Promise} - 创建结果
 */
export const createPost = async (postData) => {
  try {
    // 检查网络状态
    const status = await networkService.checkConnection();

    if (!status?.isOnline) {
      throw new Error('离线模式下无法创建帖子，请连接网络后重试');
    }

    // 在线模式：发送到服务器
    let response;

    // 根据数据类型设置不同的请求头
    if (postData instanceof FormData) {
      response = await instance.post(API_ENDPOINTS.COMMUNITY.POSTS, postData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
    } else {
      response = await instance.post(API_ENDPOINTS.COMMUNITY.POSTS, postData);
    }

    // 更新缓存
    // 使用 realmService 替代 offlineStorageService
    const realm = await realmService.getRealm();
    const cachedData = realm.objects('StorageItem').filtered('key = "community_posts"');
    const cachedPosts = cachedData.length > 0 ? JSON.parse(cachedData[0].value) : [];
    cachedPosts.unshift(response);
    // 使用 realmService 缓存数据
    const cacheRealm = await realmService.getRealm();
    cacheRealm.write(() => {
      const existingItem = cacheRealm.objects('StorageItem').filtered('key = "community_posts"');
      if (existingItem.length > 0) {
        existingItem[0].value = JSON.stringify(cachedPosts);
        existingItem[0].updated_at = new Date();
      } else {
        cacheRealm.create('StorageItem', {
          key: 'community_posts',
          value: JSON.stringify(cachedPosts),
          createdAt: new Date(),
          updated_at: new Date(),
        });
      }
    });

    return {
      success: true,
      data: response,
    };
  } catch (error) {
    console.error('创建帖子失败:', error);
    throw error;
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
    const status = await networkService.checkConnection();

    if (!status?.isOnline) {
      throw new Error('离线模式下无法更新帖子，请连接网络后重试');
    }

    // 在线模式：发送到服务器
    const response = await instance.put(API_ENDPOINTS.COMMUNITY.POST_DETAIL(id), postData);

    // 更新缓存
    // 使用 realmService 替代 offlineStorageService
    const realm = await realmService.getRealm();
    const cachedData = realm.objects('StorageItem').filtered('key = "community_posts"');
    const cachedPosts = cachedData.length > 0 ? JSON.parse(cachedData[0].value) : [];
    const postIndex = cachedPosts.findIndex(p => p.id === id);

    if (postIndex >= 0) {
      cachedPosts[postIndex] = response;
      // 使用 realmService 缓存数据
      const cacheRealm = await realmService.getRealm();
      cacheRealm.write(() => {
        const existingItem = cacheRealm.objects('StorageItem').filtered('key = "community_posts"');
        if (existingItem.length > 0) {
          existingItem[0].value = JSON.stringify(cachedPosts);
          existingItem[0].updated_at = new Date();
        } else {
          cacheRealm.create('StorageItem', {
            key: 'community_posts',
            value: JSON.stringify(cachedPosts),
            createdAt: new Date(),
            updated_at: new Date(),
          });
        }
      });
    }

    return {
      success: true,
      data: response,
    };
  } catch (error) {
    throw error;
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
    const status = await networkService.checkConnection();

    if (!status?.isOnline) {
      throw new Error('离线模式下无法删除帖子，请连接网络后重试');
    }

    // 在线模式：发送到服务器
    await instance.delete(API_ENDPOINTS.COMMUNITY.POST_DETAIL(id));

    // 更新缓存
    // 使用 realmService 替代 offlineStorageService
    const realm = await realmService.getRealm();
    const cachedData = realm.objects('StorageItem').filtered('key = "community_posts"');
    const cachedPosts = cachedData.length > 0 ? JSON.parse(cachedData[0].value) : [];
    const updatedPosts = cachedPosts.filter(p => p.id !== id);
    const cacheRealm = await realmService.getRealm();
    cacheRealm.write(() => {
      const existingItem = cacheRealm.objects('StorageItem').filtered('key = "community_posts"');
      if (existingItem.length > 0) {
        existingItem[0].value = JSON.stringify(updatedPosts);
        existingItem[0].updated_at = new Date();
      } else {
        cacheRealm.create('StorageItem', {
          key: 'community_posts',
          value: JSON.stringify(updatedPosts),
          createdAt: new Date(),
          updated_at: new Date(),
        });
      }
    });

    return {
      success: true,
    };
  } catch (error) {
    throw error;
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
      data: response.data,
    };
  } catch (error) {
    throw error;
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
      data: response.data,
    };
  } catch (error) {
    throw error;
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
      data: response.data,
    };
  } catch (error) {
    throw error;
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
      data: response.data,
    };
  } catch (error) {
    throw error;
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
  getNoteComments: getPostComments,
};

export default communityApi;
