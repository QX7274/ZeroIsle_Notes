/**
 * 社区状态管理Slice
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import communityApi from '../../services/api/communityApi';

// 异步Action: 获取社区帖子列表
export const fetchPosts = createAsyncThunk(
  'community/fetchPosts',
  async (params, { rejectWithValue }) => {
    try {
      const {
        page = 1,
        pageSize = 10,
        suppressGlobalErrorUI = false,
        tag,
        category,
        author,
        featured,
        ordering,
      } = params || {};

      // 调用实际的API
      const response = await communityApi.getPosts(
        {
          page,
          page_size: pageSize,
          tag,
          category,
          user: author,
          is_featured: featured,
          ordering,
        },
        {
          suppressGlobalErrorUI,
        }
      );

      if (!response.success) {
        return rejectWithValue(response.message || '获取社区帖子失败');
      }

      // 统一将后端字段映射为前端UI使用的字段
      const results = response.data?.results || response.data?.data?.results || response.data?.results || [];
      const count = response.data?.count ?? response.data?.data?.count ?? 0;

      const uiPosts = results.map(item => ({
        id: item.id,
        title: item.title,
        preview: item.excerpt,
        // 后端 user 为对象，包含 username 和 avatar
        author: item.user?.nickname || item.user?.username || '用户',
        authorAvatar: item.user?.avatar || '',
        likes: item.like_count ?? item.likes ?? 0,
        comments: item.comment_count ?? item.comments ?? 0,
        downloads: item.downloads ?? 0,
        timestamp: item.published_at || item.created_at,
        tags: item.tag_names || (Array.isArray(item.tags) ? item.tags.map(t => t.name || t) : []),
      }));

      return {
        posts: uiPosts,
        pagination: {
          page,
          totalPages: Math.ceil(count / pageSize),
          totalItems: count,
        },
      };
    } catch (error) {
      return rejectWithValue(error.message || '获取社区帖子失败');
    }
  }
);

// 异步Action: 获取帖子详情
export const fetchPostDetail = createAsyncThunk(
  'community/fetchPostDetail',
  async (postId, { rejectWithValue }) => {
    try {
      // 调用实际的API
      const response = await communityApi.getPostDetail(postId);

      if (!response.success) {
        return rejectWithValue(response.message || '获取帖子详情失败');
      }

      // 将帖子详情映射到UI结构
      const item = response.data ?? response;
      const detail = {
        id: item.id,
        title: item.title,
        content: item.content,
        author: item.user?.nickname || item.user?.username || '用户',
        authorAvatar: item.user?.avatar || '',
        authorId: item.user?.id,
        likes: item.like_count ?? item.likes ?? 0,
        comments: item.comment_count ?? item.comments ?? 0,
        downloads: item.downloads ?? 0,
        timestamp: item.published_at || item.created_at,
        tags: Array.isArray(item.tags) ? item.tags.map(t => t.name || t) : (item.tag_names || []),
        attachments: item.attachments || [],
        followed: item.is_followed ?? false,
      };
      return detail;
    } catch (error) {
      return rejectWithValue(error.message || '获取帖子详情失败');
    }
  }
);

// 异步Action: 获取帖子评论
export const fetchComments = createAsyncThunk(
  'community/fetchComments',
  async ({ postId, page = 1 }, { rejectWithValue }) => {
    try {
      // 调用实际的API
      const response = await communityApi.getPostComments(postId, {
        page: page,
        page_size: 10,
        parent: null, // 获取顶级评论
      });

      if (!response.success) {
        return rejectWithValue(response.message || '获取评论失败');
      }

      // 映射评论到UI结构
      const results = response.data?.results || response.data?.data?.results || response.data?.results || [];
      const count = response.data?.count ?? response.data?.data?.count ?? 0;

      const uiComments = results.map(c => ({
        id: c.id,
        author: c.user?.nickname || c.user?.username || '用户',
        authorAvatar: c.user?.avatar || '',
        content: c.content,
        likes: c.like_count ?? 0,
        timestamp: c.created_at,
      }));

      return {
        comments: uiComments,
        pagination: {
          page: page,
          totalPages: Math.ceil(count / 10),
          totalItems: count,
        },
      };
    } catch (error) {
      return rejectWithValue(error.message || '获取评论失败');
    }
  }
);

// 异步Action: 点赞帖子
export const likePost = createAsyncThunk(
  'community/likePost',
  async ({ postId, liked }, { rejectWithValue, getState }) => {
    try {
      // 这里的 liked 参数是用户期望的新状态
      // 我们在 pending 中已经乐观更新了状态
      const response = await communityApi.togglePostLike(postId);

      if (!response.success) {
        return rejectWithValue(response.message || '点赞操作失败');
      }

      return {
        postId,
        // 后端 PostViewSet.like 返回字段为 is_liked
        liked: (response.data?.is_liked ?? response.data?.is_active ?? false),
      };
    } catch (error) {
      return rejectWithValue(error.message || '点赞操作失败');
    }
  }
);

// 异步Action: 发布评论
export const postComment = createAsyncThunk(
  'community/postComment',
  async ({ postId, content, parentId = null }, { rejectWithValue }) => {
    try {
      // 调用实际的API
      const response = await communityApi.addComment(postId, {
        content: content,
        parent_id: parentId,
      });

      if (!response.success) {
        return rejectWithValue(response.message || '发布评论失败');
      }

      return response.data;
    } catch (error) {
      return rejectWithValue(error.message || '发布评论失败');
    }
  }
);

// 异步Action: 创建帖子
export const createPost = createAsyncThunk(
  'community/createPost',
  async (postData, { rejectWithValue }) => {
    try {
      // 处理FormData
      let formData = null;

      if (postData.cover_image || postData.attachments) {
        formData = new FormData();

        // 添加基本字段
        formData.append('title', postData.title);
        formData.append('content', postData.content);
        formData.append('excerpt', postData.excerpt);

        if (postData.category_id) {
          formData.append('category_id', postData.category_id);
        }

        // 添加标签
        if (postData.tags && postData.tags.length > 0) {
          postData.tags.forEach(tag => {
            formData.append('tags', tag);
          });
        }

        // 添加其他字段
        formData.append('is_public', postData.is_public ? 'true' : 'false');
        formData.append('allow_comments', postData.allow_comments ? 'true' : 'false');

        // 添加封面图片
        if (postData.cover_image) {
          formData.append('cover_image', postData.cover_image);
        }

        // 添加附件
        if (postData.attachments && postData.attachments.length > 0) {
          postData.attachments.forEach((attachment, index) => {
            formData.append(`attachment_${index}`, attachment);
          });
        }
      }

      // 调用实际的API
      const response = await communityApi.createPost(formData || postData);

      if (!response.success) {
        return rejectWithValue(response.message || '创建帖子失败');
      }

      return response.data;
    } catch (error) {
      return rejectWithValue(error.message || '创建帖子失败');
    }
  }
);

// 异步Action: 切换关注作者
export const toggleUserFollow = createAsyncThunk(
  'community/toggleUserFollow',
  async (userId, { rejectWithValue }) => {
    try {
      const response = await communityApi.toggleFollow(userId);
      if (!response.success) {
        return rejectWithValue(response.message || '关注操作失败');
      }
      return {
        userId,
        followed: (response.data?.is_active ?? response.data?.is_followed ?? false),
      };
    } catch (error) {
      return rejectWithValue(error.message || '关注操作失败');
    }
  }
);

// 异步Action: 点赞/取消点赞评论
export const toggleCommentLike = createAsyncThunk(
  'community/toggleCommentLike',
  async (commentId, { rejectWithValue }) => {
    try {
      const response = await communityApi.toggleCommentLike(commentId);
      if (!response.success) {
        return rejectWithValue(response.message || '点赞评论失败');
      }
      return {
        commentId,
        liked: (response.data?.is_liked ?? response.data?.is_active ?? false),
        likeCount: response.data?.like_count,
      };
    } catch (error) {
      return rejectWithValue(error.message || '点赞评论失败');
    }
  }
);

// 异步Action: 获取关注者列表（followers）
export const fetchFollowers = createAsyncThunk(
  'community/fetchFollowers',
  async ({ userId, page = 1, pageSize = 20 }, { rejectWithValue }) => {
    try {
      const response = await communityApi.getUserFollowers(userId, {
        page,
        page_size: pageSize,
      });

      if (!response.success) {
        return rejectWithValue(response.message || '获取关注者失败');
      }

      const data = response.data || {};
      const results = data.results || data.data?.results || data || [];
      const count = data.count ?? data.data?.count ?? (Array.isArray(results) ? results.length : 0);

      const followers = (Array.isArray(results) ? results : []).map(item => ({
        id: item.id,
        userId: item.user?.id,
        nickname: item.user?.nickname || item.user?.username || '用户',
        avatar: item.user?.avatar || '',
        followedAt: item.created_at,
      }));

      return {
        followers,
        pagination: {
          page,
          totalPages: Math.ceil(count / pageSize),
          totalItems: count,
        },
      };
    } catch (error) {
      return rejectWithValue(error.message || '获取关注者失败');
    }
  }
);

// 异步Action: 获取关注的人（following）
export const fetchFollowing = createAsyncThunk(
  'community/fetchFollowing',
  async ({ userId, page = 1, pageSize = 20 }, { rejectWithValue }) => {
    try {
      const response = await communityApi.getUserFollowing(userId, {
        page,
        page_size: pageSize,
      });

      if (!response.success) {
        return rejectWithValue(response.message || '获取关注列表失败');
      }

      const data = response.data || {};
      const results = data.results || data.data?.results || data || [];
      const count = data.count ?? data.data?.count ?? (Array.isArray(results) ? results.length : 0);

      // 由于后端Follow序列化未包含目标对象详情，这里仅展示目标ID
      const following = (Array.isArray(results) ? results : []).map(item => ({
        id: item.id,
        targetId: item.object_id,
        contentType: item.content_type,
        followedAt: item.created_at,
      }));

      return {
        following,
        pagination: {
          page,
          totalPages: Math.ceil(count / pageSize),
          totalItems: count,
        },
      };
    } catch (error) {
      return rejectWithValue(error.message || '获取关注列表失败');
    }
  }
);

// 异步Action: 获取通知列表
export const fetchNotifications = createAsyncThunk(
  'community/fetchNotifications',
  async ({ page = 1, pageSize = 20 } = {}, { rejectWithValue }) => {
    try {
      const response = await communityApi.getUserNotifications({
        page,
        page_size: pageSize,
      });

      if (!response.success) {
        return rejectWithValue(response.message || '获取通知失败');
      }

      const data = response.data || {};
      const results = data.results || data.data?.results || data || [];
      const count = data.count ?? data.data?.count ?? (Array.isArray(results) ? results.length : 0);

      const notifications = (Array.isArray(results) ? results : []).map(n => ({
        id: n.id,
        title: n.title || n.type || '通知',
        message: n.message || n.content || '',
        is_read: n.is_read ?? false,
        created_at: n.created_at,
      }));

      return {
        notifications,
        pagination: {
          page,
          totalPages: Math.ceil(count / pageSize),
          totalItems: count,
        },
      };
    } catch (error) {
      return rejectWithValue(error.message || '获取通知失败');
    }
  }
);

// 异步Action: 标记通知为已读
export const markNotificationRead = createAsyncThunk(
  'community/markNotificationRead',
  async (id, { rejectWithValue }) => {
    try {
      const response = await communityApi.markNotificationAsRead(id);
      if (!response.success) {
        return rejectWithValue(response.message || '标记通知失败');
      }
      return { id };
    } catch (error) {
      return rejectWithValue(error.message || '标记通知失败');
    }
  }
);

// 异步Action: 标记所有通知为已读
export const markAllNotificationsRead = createAsyncThunk(
  'community/markAllNotificationsRead',
  async (_, { rejectWithValue }) => {
    try {
      const response = await communityApi.markAllNotificationsAsRead();
      if (!response.success) {
        return rejectWithValue(response.message || '标记所有通知失败');
      }
      return true;
    } catch (error) {
      return rejectWithValue(error.message || '标记所有通知失败');
    }
  }
);

// 异步Action: 获取活动流
export const fetchActivity = createAsyncThunk(
  'community/fetchActivity',
  async ({ page = 1, pageSize = 20 } = {}, { rejectWithValue }) => {
    try {
      const response = await communityApi.getActivityStream({
        page,
        page_size: pageSize,
      });

      if (!response.success) {
        return rejectWithValue(response.message || '获取活动流失败');
      }

      const data = response.data || {};
      const results = data.results || data.data?.results || data || [];
      const count = data.count ?? data.data?.count ?? (Array.isArray(results) ? results.length : 0);

      const activity = (Array.isArray(results) ? results : []).map(a => ({
        id: a.id || a._id,
        type: a.type || a.event || 'activity',
        title: a.title || a.summary || '活动',
        message: a.message || a.detail || a.content || '',
        created_at: a.created_at || a.timestamp,
      })).filter(item => item.id);

      return {
        activity,
        pagination: {
          page,
          totalPages: Math.ceil(count / pageSize),
          totalItems: count,
        },
      };
    } catch (error) {
      return rejectWithValue(error.message || '获取活动流失败');
    }
  }
);

// 初始状态
const initialState = {
  posts: [],
  currentPost: null,
  comments: [],
  isLoading: false,
  error: null,
  pagination: {
    page: 1,
    totalPages: 1,
    totalItems: 0,
  },
  commentsPagination: {
    page: 1,
    totalPages: 1,
    totalItems: 0,
  },
  likedPosts: {},
  bookmarkedPosts: {},
  likedComments: {},
  followedUsers: {},
  followers: [],
  followersPagination: { page: 1, totalPages: 1, totalItems: 0 },
  following: [],
  followingPagination: { page: 1, totalPages: 1, totalItems: 0 },
  notifications: [],
  notificationsPagination: { page: 1, totalPages: 1, totalItems: 0 },
  activity: [],
  activityPagination: { page: 1, totalPages: 1, totalItems: 0 },
};

// 创建Slice
const communitySlice = createSlice({
  name: 'community',
  initialState,
  reducers: {
    // 清除当前帖子
    clearCurrentPost: (state) => {
      state.currentPost = null;
      state.comments = [];
    },
    // 清除错误
    clearError: (state) => {
      state.error = null;
    },
    // 设置书签
    toggleBookmark: (state, action) => {
      const postId = action.payload;
      state.bookmarkedPosts[postId] = !state.bookmarkedPosts[postId];
    },
  },
  extraReducers: (builder) => {
    builder
      // 获取帖子列表
      .addCase(fetchPosts.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchPosts.fulfilled, (state, action) => {
        state.isLoading = false;
        state.posts = action.payload.posts;
        state.pagination = action.payload.pagination;
      })
      .addCase(fetchPosts.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // 获取帖子详情
      .addCase(fetchPostDetail.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchPostDetail.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentPost = action.payload;
      })
      .addCase(fetchPostDetail.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // 获取评论
      .addCase(fetchComments.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchComments.fulfilled, (state, action) => {
        state.isLoading = false;
        state.comments = action.payload.comments;
        state.commentsPagination = action.payload.pagination;
      })
      .addCase(fetchComments.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // 点赞帖子 - 乐观更新
      .addCase(likePost.pending, (state, action) => {
        const { postId, liked } = action.meta.arg;

        // 保存旧状态以便回滚（如果需要的话，但这里我们直接使用 liked 参数，因为它是取反后的）
        // 实际上我们可以直接在状态中标记，但在 Redux Toolkit 中通常在 fulfilled 或 pending 中处理

        state.likedPosts[postId] = liked;

        // 乐观更新帖子点赞数
        if (state.currentPost && state.currentPost.id === postId) {
          state.currentPost.likes = liked
            ? state.currentPost.likes + 1
            : Math.max(0, state.currentPost.likes - 1);
        }

        const postIndex = state.posts.findIndex(post => post.id === postId);
        if (postIndex !== -1) {
          state.posts[postIndex].likes = liked
            ? state.posts[postIndex].likes + 1
            : Math.max(0, state.posts[postIndex].likes - 1);
        }
      })
      .addCase(likePost.fulfilled, (state, action) => {
        const { postId, liked } = action.payload;
        // 确保最终状态与服务器同步
        state.likedPosts[postId] = liked;

        // 更新点赞数（此处可能需要根据服务器返回的真实数值进行校准，
        // 但为了简单，我们假设乐观更新是正确的，或者服务器返回了最新数值）
      })
      .addCase(likePost.rejected, (state, action) => {
        const { postId, liked } = action.meta.arg;

        // 发生错误，回滚点赞状态
        state.likedPosts[postId] = !liked;

        // 回滚点赞数
        if (state.currentPost && state.currentPost.id === postId) {
          state.currentPost.likes = !liked
            ? state.currentPost.likes + 1
            : Math.max(0, state.currentPost.likes - 1);
        }

        const postIndex = state.posts.findIndex(post => post.id === postId);
        if (postIndex !== -1) {
          state.posts[postIndex].likes = !liked
            ? state.posts[postIndex].likes + 1
            : Math.max(0, state.posts[postIndex].likes - 1);
        }

        state.error = action.payload;
      })

      // 发布评论
      .addCase(postComment.fulfilled, (state, action) => {
        state.comments.unshift(action.payload);

        // 更新评论数
        if (state.currentPost) {
          state.currentPost.comments += 1;
        }

        // 更新帖子列表中的评论数
        const postIndex = state.posts.findIndex(post => post.id === action.payload.postId);
        if (postIndex !== -1) {
          state.posts[postIndex].comments += 1;
        }
      })

      // 创建帖子
      .addCase(createPost.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createPost.fulfilled, (state, action) => {
        state.isLoading = false;
        state.posts.unshift(action.payload);
      })
      .addCase(createPost.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // 关注作者
      .addCase(toggleUserFollow.fulfilled, (state, action) => {
        const { userId, followed } = action.payload;
        state.followedUsers[userId] = followed;
        if (state.currentPost && state.currentPost.authorId === userId) {
          state.currentPost.followed = followed;
        }
      })

      // 点赞评论
      .addCase(toggleCommentLike.fulfilled, (state, action) => {
        const { commentId, liked, likeCount } = action.payload;
        state.likedComments[commentId] = liked;
        const idx = state.comments.findIndex(c => c.id === commentId);
        if (idx !== -1) {
          if (typeof likeCount === 'number') {
            state.comments[idx].likes = likeCount;
          } else {
            state.comments[idx].likes = liked
              ? (state.comments[idx].likes || 0) + 1
              : Math.max(0, (state.comments[idx].likes || 0) - 1);
          }
        }
      })

      // 获取关注者
      .addCase(fetchFollowers.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchFollowers.fulfilled, (state, action) => {
        state.isLoading = false;
        state.followers = action.payload.followers;
        state.followersPagination = action.payload.pagination;
      })
      .addCase(fetchFollowers.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // 获取关注列表
      .addCase(fetchFollowing.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchFollowing.fulfilled, (state, action) => {
        state.isLoading = false;
        state.following = action.payload.following;
        state.followingPagination = action.payload.pagination;
      })
      .addCase(fetchFollowing.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // 获取通知
      .addCase(fetchNotifications.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchNotifications.fulfilled, (state, action) => {
        state.isLoading = false;
        state.notifications = action.payload.notifications;
        state.notificationsPagination = action.payload.pagination;
      })
      .addCase(fetchNotifications.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // 标记通知已读
      .addCase(markNotificationRead.fulfilled, (state, action) => {
        const id = action.payload.id;
        const idx = state.notifications.findIndex(n => n.id === id);
        if (idx !== -1) {
          state.notifications[idx].is_read = true;
        }
      })
      .addCase(markAllNotificationsRead.fulfilled, (state) => {
        state.notifications = state.notifications.map(n => ({ ...n, is_read: true }));
      })

      // 获取活动流
      .addCase(fetchActivity.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchActivity.fulfilled, (state, action) => {
        state.isLoading = false;
        state.activity = action.payload.activity;
        state.activityPagination = action.payload.pagination;
      })
      .addCase(fetchActivity.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
  },
});

// 导出Actions
export const { clearCurrentPost, clearError, toggleBookmark } = communitySlice.actions;

// 导出Selectors
export const selectPosts = (state) => state.community.posts;
export const selectCurrentPost = (state) => state.community.currentPost;
export const selectComments = (state) => state.community.comments;
export const selectIsLoading = (state) => state.community.isLoading;
export const selectError = (state) => state.community.error;
export const selectPagination = (state) => state.community.pagination;
export const selectCommentsPagination = (state) => state.community.commentsPagination;
export const selectLikedPosts = (state) => state.community.likedPosts;
export const selectBookmarkedPosts = (state) => state.community.bookmarkedPosts;
export const selectLikedComments = (state) => state.community.likedComments;
export const selectFollowedUsers = (state) => state.community.followedUsers;
export const selectFollowers = (state) => state.community.followers;
export const selectFollowersPagination = (state) => state.community.followersPagination;
export const selectFollowing = (state) => state.community.following;
export const selectFollowingPagination = (state) => state.community.followingPagination;
export const selectNotifications = (state) => state.community.notifications;
export const selectNotificationsPagination = (state) => state.community.notificationsPagination;
export const selectActivity = (state) => state.community.activity;
export const selectActivityPagination = (state) => state.community.activityPagination;

// 导出Reducer
export default communitySlice.reducer;
