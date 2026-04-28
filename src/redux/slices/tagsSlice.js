/**
 * 标签状态管理Slice
 */

import { createSlice, createAsyncThunk, createEntityAdapter } from '@reduxjs/toolkit';
import tagApi from '../../services/api/tagApi';
import { logService } from '../../utils/logService';
import networkErrorService from '../../services/networkErrorService';

// 创建实体适配器，用于规范化状态
const tagsAdapter = createEntityAdapter({
  selectId: (tag) => tag.id,
  sortComparer: (a, b) => a.name.localeCompare(b.name), // 按名称排序
});

// 异步Action: 获取标签列表
export const fetchTags = createAsyncThunk(
  'tags/fetchTags',
  async (options = {}, { rejectWithValue }) => {
    try {
      const response = await tagApi.getTags(options);

      // 检查响应格式
      if (response && response.data) {
        return response.data;
      }

      return response;
    } catch (error) {
      logService.error('获取标签列表失败', error);
      if (networkErrorService.isNetworkError(error)) {
        networkErrorService.handleApiError(error, {
          context: '获取标签列表',
          customMessage: '网络连接失败，无法获取标签列表',
        });
      }
      return rejectWithValue(error.message || '获取标签列表失败');
    }
  }
);

// 异步Action: 创建标签
export const createTag = createAsyncThunk(
  'tags/createTag',
  async (tagData, { rejectWithValue }) => {
    try {
      const response = await tagApi.createTag(tagData);

      // 检查响应格式
      if (response && response.data) {
        return response.data;
      }

      return response;
    } catch (error) {
      logService.error('创建标签失败', error);
      if (networkErrorService.isNetworkError(error)) {
        networkErrorService.handleApiError(error, {
          context: '创建标签',
          customMessage: '网络连接失败，无法创建标签',
        });
      }
      return rejectWithValue(error.message || '创建标签失败');
    }
  }
);

// 异步Action: 更新标签
export const updateTag = createAsyncThunk(
  'tags/updateTag',
  async ({ id, tagData }, { rejectWithValue }) => {
    try {
      const response = await tagApi.updateTag(id, tagData);

      // 检查响应格式
      if (response && response.data) {
        return response.data;
      }

      return response;
    } catch (error) {
      logService.error(`更新标签(ID: ${id})失败`, error);
      return rejectWithValue(error.message || `更新标签(ID: ${id})失败`);
    }
  }
);

// 异步Action: 删除标签
export const deleteTag = createAsyncThunk(
  'tags/deleteTag',
  async (id, { rejectWithValue }) => {
    try {
      await tagApi.deleteTag(id);
      return id;
    } catch (error) {
      logService.error(`删除标签(ID: ${id})失败`, error);
      return rejectWithValue(error.message || `删除标签(ID: ${id})失败`);
    }
  }
);

// 异步Action: 获取标签统计
export const fetchTagStatistics = createAsyncThunk(
  'tags/fetchTagStatistics',
  async (_, { rejectWithValue }) => {
    try {
      const response = await tagApi.getStatistics();

      // 检查响应格式
      if (response && response.data) {
        return response.data;
      }

      return response;
    } catch (error) {
      logService.error('获取标签统计失败', error);
      return rejectWithValue(error.message || '获取标签统计失败');
    }
  }
);

// 异步Action: 搜索标签
export const searchTags = createAsyncThunk(
  'tags/searchTags',
  async (query, { rejectWithValue }) => {
    try {
      const response = await tagApi.searchTags(query);

      // 检查响应格式
      if (response && response.data) {
        return response.data;
      }

      return response;
    } catch (error) {
      logService.error(`搜索标签(关键词: ${query})失败`, error);
      return rejectWithValue(error.message || `搜索标签(关键词: ${query})失败`);
    }
  }
);

// 初始状态
const initialState = tagsAdapter.getInitialState({
  isLoading: false,
  error: null,
  statistics: null,
  searchResults: [],
  searchLoading: false,
  searchError: null,
  isOffline: false,
});

// 创建切片
const tagsSlice = createSlice({
  name: 'tags',
  initialState,
  reducers: {
    clearTagsError: (state) => {
      state.error = null;
      state.searchError = null;
    },

    // 设置离线状态
    setOfflineMode: (state, action) => {
      state.isOffline = action.payload;
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

        // 检查是否为离线数据
        if (action.payload.isOffline) {
          state.isOffline = true;
        }

        // 使用适配器更新状态
        tagsAdapter.setAll(state, action.payload);
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

        // 检查是否为离线数据
        if (action.payload.isOffline) {
          state.isOffline = true;
        }

        // 使用适配器添加标签
        tagsAdapter.addOne(state, action.payload);
      })
      .addCase(createTag.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || '创建标签失败';
      });

    // 更新标签
    builder
      .addCase(updateTag.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateTag.fulfilled, (state, action) => {
        state.isLoading = false;

        // 检查是否为离线数据
        if (action.payload.isOffline) {
          state.isOffline = true;
        }

        // 使用适配器更新标签
        tagsAdapter.updateOne(state, {
          id: action.payload.id,
          changes: action.payload,
        });
      })
      .addCase(updateTag.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || '更新标签失败';
      });

    // 删除标签
    builder
      .addCase(deleteTag.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(deleteTag.fulfilled, (state, action) => {
        state.isLoading = false;

        // 使用适配器删除标签
        tagsAdapter.removeOne(state, action.payload);
      })
      .addCase(deleteTag.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || '删除标签失败';
      });

    // 获取标签统计
    builder
      .addCase(fetchTagStatistics.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchTagStatistics.fulfilled, (state, action) => {
        state.isLoading = false;
        state.statistics = action.payload;

        // 检查是否为离线数据
        if (action.payload.isOffline) {
          state.isOffline = true;
        }
      })
      .addCase(fetchTagStatistics.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || '获取标签统计失败';
      });

    // 搜索标签
    builder
      .addCase(searchTags.pending, (state) => {
        state.searchLoading = true;
        state.searchError = null;
      })
      .addCase(searchTags.fulfilled, (state, action) => {
        state.searchLoading = false;
        state.searchResults = action.payload;

        // 检查是否为离线数据
        if (action.payload.isOffline) {
          state.isOffline = true;
        }
      })
      .addCase(searchTags.rejected, (state, action) => {
        state.searchLoading = false;
        state.searchError = action.payload || '搜索标签失败';
      });
  },
});

// 导出操作
export const { clearTagsError, setOfflineMode } = tagsSlice.actions;

// 导出选择器
export const {
  selectAll: selectAllTags,
  selectById: selectTagById,
  selectIds: selectTagIds,
} = tagsAdapter.getSelectors((state) => state.tags);

// 自定义选择器
export const selectTags = selectAllTags; // 兼容旧代码
export const selectTagsLoading = (state) => state.tags.isLoading;
export const selectTagsError = (state) => state.tags.error;
export const selectTagsStatistics = (state) => state.tags.statistics;
export const selectTagsSearchResults = (state) => state.tags.searchResults;
export const selectTagsSearchLoading = (state) => state.tags.searchLoading;
export const selectTagsSearchError = (state) => state.tags.searchError;
export const selectIsOffline = (state) => state.tags.isOffline;

// 导出切片
export default tagsSlice.reducer;
