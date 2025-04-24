/**
 * 搜索状态管理Slice
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import * as searchApi from '../../services/searchApi';

// 搜索异步Action
export const search = createAsyncThunk(
  'search/search',
  async (searchData, { rejectWithValue }) => {
    try {
      let response;
      
      if (searchData.mode === 'text') {
        response = await searchApi.textSearch(searchData.query, searchData.options);
      } else if (searchData.mode === 'voice') {
        response = await searchApi.voiceSearch(searchData.audioUri, searchData.options);
      } else if (searchData.mode === 'image') {
        response = await searchApi.imageSearch(searchData.imageUri, searchData.options);
      } else {
        throw new Error('不支持的搜索模式');
      }
      
      return response.data;
    } catch (error) {
      return rejectWithValue(error.message || '搜索失败');
    }
  }
);

// 知识图谱搜索异步Action
export const knowledgeGraphSearch = createAsyncThunk(
  'search/knowledgeGraphSearch',
  async (searchData, { rejectWithValue }) => {
    try {
      const response = await searchApi.knowledgeGraphSearch(
        searchData.query,
        searchData.options
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(error.message || '知识图谱搜索失败');
    }
  }
);

// 初始状态
const initialState = {
  results: [],
  isLoading: false,
  error: null,
  searchHistory: [],
  recentSearches: [],
};

// 创建Slice
const searchSlice = createSlice({
  name: 'search',
  initialState,
  reducers: {
    // 清除搜索结果
    clearSearchResults: (state) => {
      state.results = [];
      state.error = null;
    },
    
    // 添加到搜索历史
    addToSearchHistory: (state, action) => {
      const { query, mode, timestamp } = action.payload;
      
      // 避免重复
      const existingIndex = state.searchHistory.findIndex(
        (item) => item.query === query && item.mode === mode
      );
      
      if (existingIndex !== -1) {
        // 移除旧的
        state.searchHistory.splice(existingIndex, 1);
      }
      
      // 添加到开头
      state.searchHistory.unshift({
        query,
        mode,
        timestamp: timestamp || new Date().toISOString(),
      });
      
      // 限制历史记录数量
      if (state.searchHistory.length > 100) {
        state.searchHistory = state.searchHistory.slice(0, 100);
      }
    },
    
    // 清除搜索历史
    clearSearchHistory: (state) => {
      state.searchHistory = [];
    },
    
    // 添加到最近搜索
    addToRecentSearches: (state, action) => {
      const { query } = action.payload;
      
      // 避免重复
      const existingIndex = state.recentSearches.indexOf(query);
      if (existingIndex !== -1) {
        // 移除旧的
        state.recentSearches.splice(existingIndex, 1);
      }
      
      // 添加到开头
      state.recentSearches.unshift(query);
      
      // 限制最近搜索数量
      if (state.recentSearches.length > 10) {
        state.recentSearches = state.recentSearches.slice(0, 10);
      }
    },
    
    // 清除最近搜索
    clearRecentSearches: (state) => {
      state.recentSearches = [];
    },
  },
  extraReducers: (builder) => {
    builder
      // 搜索
      .addCase(search.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(search.fulfilled, (state, action) => {
        state.isLoading = false;
        state.results = action.payload.results || [];
        
        // 添加到搜索历史和最近搜索
        if (action.meta.arg.query) {
          searchSlice.caseReducers.addToSearchHistory(state, {
            payload: {
              query: action.meta.arg.query,
              mode: action.meta.arg.mode || 'text',
            },
          });
          
          searchSlice.caseReducers.addToRecentSearches(state, {
            payload: { query: action.meta.arg.query },
          });
        }
      })
      .addCase(search.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || '搜索失败';
      })
      
      // 知识图谱搜索
      .addCase(knowledgeGraphSearch.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(knowledgeGraphSearch.fulfilled, (state, action) => {
        state.isLoading = false;
        state.results = action.payload.results || [];
        
        // 添加到搜索历史和最近搜索
        if (action.meta.arg.query) {
          searchSlice.caseReducers.addToSearchHistory(state, {
            payload: {
              query: action.meta.arg.query,
              mode: 'knowledge',
            },
          });
          
          searchSlice.caseReducers.addToRecentSearches(state, {
            payload: { query: action.meta.arg.query },
          });
        }
      })
      .addCase(knowledgeGraphSearch.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || '知识图谱搜索失败';
      });
  },
});

// 导出Actions
export const {
  clearSearchResults,
  addToSearchHistory,
  clearSearchHistory,
  addToRecentSearches,
  clearRecentSearches,
} = searchSlice.actions;

// 导出Selectors
export const selectSearchResults = (state) => state.search.results;
export const selectIsLoading = (state) => state.search.isLoading;
export const selectError = (state) => state.search.error;
export const selectSearchHistory = (state) => state.search.searchHistory;
export const selectRecentSearches = (state) => state.search.recentSearches;

// 导出Reducer
export default searchSlice.reducer;
