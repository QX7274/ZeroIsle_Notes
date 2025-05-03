/**
 * 标签状态管理Slice
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as tagsApi from '../../services/api/tagApi';

// 异步Action: 获取标签列表
export const fetchTags = createAsyncThunk(
  'tags/fetchTags',
  async (_, { rejectWithValue }) => {
    try {
      const response = await tagsApi.getTags();
      return response.data;
    } catch (error) {
      return rejectWithValue(error.message || '获取标签列表失败');
    }
  }
);

// 异步Action: 创建标签
export const createTag = createAsyncThunk(
  'tags/createTag',
  async (tagData, { rejectWithValue }) => {
    try {
      const response = await tagsApi.createTag(tagData);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.message || '创建标签失败');
    }
  }
);

// 初始状态
const initialState = {
  tags: [],
  isLoading: false,
  error: null,
};

// 创建切片
const tagsSlice = createSlice({
  name: 'tags',
  initialState,
  reducers: {
    clearTagsError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // 获取标签列表
    builder
      .addCase(fetchTags.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchTags.fulfilled, (state, action) => {
        state.isLoading = false;
        state.tags = action.payload;
      })
      .addCase(fetchTags.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || '获取标签列表失败';
      });

    // 创建标签
    builder
      .addCase(createTag.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createTag.fulfilled, (state, action) => {
        state.isLoading = false;
        state.tags.push(action.payload);
      })
      .addCase(createTag.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || '创建标签失败';
      });
  },
});

// 导出操作
export const { clearTagsError } = tagsSlice.actions;

// 导出选择器
export const selectTags = (state) => state.tags.tags;
export const selectTagsLoading = (state) => state.tags.isLoading;
export const selectTagsError = (state) => state.tags.error;

// 导出切片
export default tagsSlice.reducer;
