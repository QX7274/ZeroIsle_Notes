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
      // 调用实际的API
      const response = await communityApi.getPosts({
        page: params?.page || 1,
        page_size: params?.pageSize || 10,
        tag: params?.tag,
        category: params?.category,
        user: params?.author,
        is_featured: params?.featured,
        ordering: params?.ordering,
      });

      if (!response.success) {
        return rejectWithValue(response.message || '获取社区帖子失败');
      }

      return {
        posts: response.data.results || [],
        pagination: {
          page: params?.page || 1,
          totalPages: Math.ceil(response.data.count / (params?.pageSize || 10)),
          totalItems: response.data.count || 0,
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

      return response.data;
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

      return {
        comments: response.data.results || [],
        pagination: {
          page: page,
          totalPages: Math.ceil(response.data.count / 10),
          totalItems: response.data.count || 0,
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
  async ({ postId, liked }, { rejectWithValue }) => {
    try {
      // 调用实际的API
      const response = await communityApi.togglePostLike(postId);

      if (!response.success) {
        return rejectWithValue(response.message || '点赞操作失败');
      }

      return {
        postId,
        liked: response.data.is_active // 使用后端返回的实际点赞状态
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
        parent_id: parentId
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

      // 点赞帖子
      .addCase(likePost.fulfilled, (state, action) => {
        const { postId, liked } = action.payload;
        state.likedPosts[postId] = liked;

        // 更新帖子点赞数
        if (state.currentPost && state.currentPost.id === postId) {
          state.currentPost.likes = liked
            ? state.currentPost.likes + 1
            : state.currentPost.likes - 1;
        }

        // 更新帖子列表中的点赞数
        const postIndex = state.posts.findIndex(post => post.id === postId);
        if (postIndex !== -1) {
          state.posts[postIndex].likes = liked
            ? state.posts[postIndex].likes + 1
            : state.posts[postIndex].likes - 1;
        }
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

// 导出Reducer
export default communitySlice.reducer;
