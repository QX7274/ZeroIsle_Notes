/**
 * 搜索状态管理Slice
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import searchApi from '../../services/api/searchApi';

// 本地搜索工具函数
const fuzzySearch = (text, query) => {
  if (!text || !query) return false;

  const textLower = text.toLowerCase();
  const queryLower = query.toLowerCase();

  // 精确匹配
  if (textLower.includes(queryLower)) return true;

  // 模糊匹配 - 检查查询词的字符是否按顺序出现在文本中
  let queryIndex = 0;
  for (let i = 0; i < textLower.length && queryIndex < queryLower.length; i++) {
    if (textLower[i] === queryLower[queryIndex]) {
      queryIndex++;
    }
  }

  return queryIndex === queryLower.length;
};

const searchInContent = (content, query) => {
  if (!content || !query) return { found: false, matches: [] };

  const queryLower = query.toLowerCase();
  const contentLower = content.toLowerCase();
  const matches = [];

  // 查找所有匹配位置
  let index = contentLower.indexOf(queryLower);
  while (index !== -1) {
    // 获取匹配上下文（前后各30个字符）
    const start = Math.max(0, index - 30);
    const end = Math.min(content.length, index + queryLower.length + 30);
    const context = content.substring(start, end);

    matches.push({
      index,
      context,
      highlight: query
    });

    index = contentLower.indexOf(queryLower, index + 1);
  }

  return { found: matches.length > 0, matches };
};

// 本地搜索函数 - 支持多种数据类型
const performLocalSearch = (allData, query, scope = 'all') => {
  if (!query || !query.trim()) return [];
  if (!allData || !Array.isArray(allData)) {
    console.warn('SearchSlice: 搜索数据无效:', allData);
    return [];
  }

  const searchQuery = query.trim();
  const results = [];

  allData.forEach(item => {
    if (!item) return;

    // 根据scope过滤
    if (scope !== 'all' && item.sourceType !== scope && item.type !== scope) return;

    let relevanceScore = 0;
    let matchDetails = {
      titleMatch: false,
      contentMatch: false,
      matches: []
    };

    // 获取标题（支持多种字段名）
    const title = item.title || item.name || item.fileName || '';

    // 搜索标题
    if (title && fuzzySearch(title, searchQuery)) {
      relevanceScore += 10;
      matchDetails.titleMatch = true;
    }

    // 获取内容（支持多种字段名）
    const content = item.content || item.description || item.text || '';

    // 搜索内容
    if (content) {
      const contentSearch = searchInContent(content, searchQuery);
      if (contentSearch.found) {
        relevanceScore += 5 + contentSearch.matches.length;
        matchDetails.contentMatch = true;
        matchDetails.matches = contentSearch.matches;
      }
    }

    // 搜索标签
    if (item.tags && Array.isArray(item.tags)) {
      item.tags.forEach(tag => {
        if (fuzzySearch(tag, searchQuery)) {
          relevanceScore += 3;
        }
      });
    }

    // 搜索文件路径
    const path = item.path || item.uri || item.filePath || '';
    if (path && fuzzySearch(path, searchQuery)) {
      relevanceScore += 2;
    }

    // 如果有匹配，添加到结果中
    if (relevanceScore > 0) {
      // 智能推断文件类型
      const detectedType = detectItemType(item);

      results.push({
        ...item,
        relevanceScore,
        matchDetails,
        searchQuery,
        type: detectedType,
        displayTitle: title || '未命名',
        displayContent: content ? content.substring(0, 100) + '...' : ''
      });
    }
  });

  // 按相关性排序
  return results.sort((a, b) => b.relevanceScore - a.relevanceScore);
};

// 智能文件类型检测
const detectItemType = (item) => {
  // 优先使用已有的类型信息
  if (item.type) return item.type;
  if (item.sourceType) return item.sourceType;
  if (item.noteType) return item.noteType;

  // 根据文件扩展名检测
  const fileName = item.fileName || item.name || item.title || '';
  const path = item.path || item.uri || item.filePath || '';
  const fullName = fileName || path;

  if (fullName) {
    const extension = fullName.toLowerCase().split('.').pop();

    switch (extension) {
      case 'pdf':
        return 'pdf';
      case 'ppt':
      case 'pptx':
        return 'ppt';
      case 'doc':
      case 'docx':
        return 'doc';
      case 'md':
      case 'markdown':
        return 'md';
      case 'txt':
        return 'text';
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'bmp':
        return 'image';
      case 'mp3':
      case 'wav':
      case 'aac':
        return 'audio';
      case 'mp4':
      case 'avi':
      case 'mov':
        return 'video';
    }
  }

  // 根据内容特征检测
  if (item.content || item.text) {
    return 'note';
  }

  if (item.paths) {
    return 'canvas';
  }

  if (item.reminder || item.dueDate) {
    return 'reminder';
  }

  // 默认类型
  return 'file';
};

// 本地搜索异步Action
export const localSearch = createAsyncThunk(
  'search/localSearch',
  async ({ query, mode = 'text', scope = 'all' }, { getState, rejectWithValue }) => {
    try {
      console.log('SearchSlice: 开始本地搜索', { query, mode, scope });

      const state = getState();

      // 获取所有可能的数据源
      const notes = state.notes?.notes || [];
      const canvases = state.canvas?.canvases || [];
      const files = state.files?.files || [];
      const reminders = state.reminders?.reminders || [];

      // 合并所有数据源进行搜索
      const allData = [
        ...notes.map(note => ({ ...note, sourceType: 'note' })),
        ...canvases.map(canvas => ({ ...canvas, sourceType: 'canvas' })),
        ...files.map(file => ({ ...file, sourceType: 'file' })),
        ...reminders.map(reminder => ({ ...reminder, sourceType: 'reminder' }))
      ];

      console.log('SearchSlice: 搜索数据源统计:', {
        notes: notes.length,
        canvases: canvases.length,
        files: files.length,
        reminders: reminders.length,
        total: allData.length
      });

      // 执行本地搜索
      const results = performLocalSearch(allData, query, scope);

      console.log('SearchSlice: 本地搜索完成，结果数量:', results.length);
      return {
        query,
        mode,
        scope,
        results,
        timestamp: Date.now(),
        hasResults: results.length > 0,
        isLocal: true
      };
    } catch (error) {
      console.error('SearchSlice: 本地搜索失败:', error);
      return rejectWithValue(error.message);
    }
  }
);

// 搜索异步Action
export const search = createAsyncThunk(
  'search/search',
  async (searchData, { rejectWithValue }) => {
    try {
      let response;
      // 确保 options 包含 scope 参数
      const options = {
        ...searchData.options,
        scope: searchData.scope || 'home'
      };

      if (searchData.mode === 'text') {
        response = await searchApi.textSearch(searchData.query, options);
      } else if (searchData.mode === 'voice') {
        response = await searchApi.voiceSearch(searchData.audioBase64, options);
      } else if (searchData.mode === 'image') {
        response = await searchApi.imageSearch(searchData.imageBase64, options);
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
      // 确保 options 包含 scope 参数
      const options = {
        ...searchData.options,
        scope: searchData.scope || 'home'
      };

      const response = await searchApi.knowledgeGraphSearch(
        searchData.query,
        options
      );
      return response.data;
    } catch (error) {
      return rejectWithValue(error.message || '知识图谱搜索失败');
    }
  }
);

// 获取搜索历史异步Action
export const fetchSearchHistory = createAsyncThunk(
  'search/fetchSearchHistory',
  async (params = {}, { rejectWithValue, getState }) => {
    try {
      const { limit = 10, scope = 'home', useLocalOnly = false } = params;

      // 如果指定使用本地历史记录，直接返回当前状态中的历史记录
      if (useLocalOnly) {
        const state = getState();
        const currentHistory = state.search.searchHistory || [];
        // 过滤当前范围的历史记录
        const filteredHistory = currentHistory.filter(item =>
          !item.scope || item.scope === scope
        ).slice(0, limit);

        return {
          history: filteredHistory,
          isLocalData: true
        };
      }

      // 否则从API获取历史记录
      const response = await searchApi.getSearchHistory(limit, scope);
      if (response.success) {
        return response.data;
      } else {
        return rejectWithValue(response.message || '获取搜索历史失败');
      }
    } catch (error) {
      console.error('获取搜索历史失败:', error);
      // 出错时尝试使用本地历史记录
      try {
        const state = getState();
        const currentHistory = state.search.searchHistory || [];
        return {
          history: currentHistory.slice(0, limit),
          isLocalData: true,
          error: error.message
        };
      } catch (fallbackError) {
        return rejectWithValue(error.message || '获取搜索历史失败');
      }
    }
  }
);

// 清除搜索历史异步Action
export const clearSearchHistoryAsync = createAsyncThunk(
  'search/clearSearchHistoryAsync',
  async (_, { rejectWithValue }) => {
    try {
      const response = await searchApi.clearSearchHistory();
      if (response.success) {
        return response.data;
      } else {
        return rejectWithValue(response.message || '清除搜索历史失败');
      }
    } catch (error) {
      return rejectWithValue(error.message || '清除搜索历史失败');
    }
  }
);

// 获取搜索建议异步Action
export const fetchSearchSuggestions = createAsyncThunk(
  'search/fetchSearchSuggestions',
  async ({ query, limit = 5 }, { rejectWithValue }) => {
    try {
      const response = await searchApi.getSearchSuggestions(query, limit);
      if (response.success) {
        return response.data;
      } else {
        return rejectWithValue(response.message || '获取搜索建议失败');
      }
    } catch (error) {
      return rejectWithValue(error.message || '获取搜索建议失败');
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
  suggestions: [],
  isFetchingSuggestions: false,
  suggestionsError: null,
  searchMode: 'text', // text, voice, image, knowledge
  filters: {
    type: 'all', // all, note, tag, knowledge, etc.
    dateRange: null,
    sortBy: 'relevance', // relevance, date, title
    sortOrder: 'desc', // asc, desc
  },
  pagination: {
    page: 1,
    totalPages: 1,
    totalResults: 0,
    pageSize: 20,
  },
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
      const { query, mode, timestamp, scope = 'home' } = action.payload;

      // 避免重复
      const existingIndex = state.searchHistory.findIndex(
        (item) => item.query === query && item.mode === mode
      );

      if (existingIndex !== -1) {
        // 移除旧的
        state.searchHistory.splice(existingIndex, 1);
      }

      // 添加到开头
      const newItem = {
        query,
        mode,
        timestamp: timestamp || new Date().toISOString(),
      };

      state.searchHistory.unshift(newItem);

      // 限制历史记录数量
      if (state.searchHistory.length > 100) {
        state.searchHistory = state.searchHistory.slice(0, 100);
      }

      // 保存到本地存储
      try {
        const { offlineStorageService } = require('../../services/offline/offlineStorageService');
        if (offlineStorageService && offlineStorageService.saveSearchHistory) {
          offlineStorageService.saveSearchHistory(query, mode, scope);
        }
      } catch (error) {
        console.error('保存搜索历史到本地失败:', error);
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

    // 设置搜索模式
    setSearchMode: (state, action) => {
      state.searchMode = action.payload;
    },

    // 设置过滤器
    setFilter: (state, action) => {
      state.filters = {
        ...state.filters,
        ...action.payload,
      };
    },

    // 重置过滤器
    resetFilters: (state) => {
      state.filters = initialState.filters;
    },

    // 设置分页
    setPagination: (state, action) => {
      state.pagination = {
        ...state.pagination,
        ...action.payload,
      };
    },

    // 清除建议
    clearSuggestions: (state) => {
      state.suggestions = [];
    },
  },
  extraReducers: (builder) => {
    builder
      // 本地搜索
      .addCase(localSearch.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(localSearch.fulfilled, (state, action) => {
        state.isLoading = false;
        state.results = action.payload.results || [];
        state.hasResults = action.payload.hasResults;

        // 添加到搜索历史和最近搜索
        if (action.payload.query) {
          searchSlice.caseReducers.addToSearchHistory(state, {
            payload: {
              query: action.payload.query,
              mode: action.payload.mode || 'text',
              scope: action.payload.scope || 'all',
              timestamp: action.payload.timestamp,
              resultCount: action.payload.results.length
            },
          });

          searchSlice.caseReducers.addToRecentSearches(state, {
            payload: { query: action.payload.query },
          });
        }
      })
      .addCase(localSearch.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || '搜索失败';
        state.hasResults = false;
      })

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
              scope: action.meta.arg.scope || 'home',
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
              scope: action.meta.arg.scope || 'home',
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
      })

      // 获取搜索历史
      .addCase(fetchSearchHistory.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchSearchHistory.fulfilled, (state, action) => {
        state.isLoading = false;
        state.searchHistory = action.payload.history || [];
      })
      .addCase(fetchSearchHistory.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || '获取搜索历史失败';
      })

      // 清除搜索历史
      .addCase(clearSearchHistoryAsync.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(clearSearchHistoryAsync.fulfilled, (state) => {
        state.isLoading = false;
        state.searchHistory = [];
      })
      .addCase(clearSearchHistoryAsync.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || '清除搜索历史失败';
      })

      // 获取搜索建议
      .addCase(fetchSearchSuggestions.pending, (state) => {
        state.isFetchingSuggestions = true;
        state.suggestionsError = null;
      })
      .addCase(fetchSearchSuggestions.fulfilled, (state, action) => {
        state.isFetchingSuggestions = false;
        state.suggestions = action.payload.suggestions || [];
      })
      .addCase(fetchSearchSuggestions.rejected, (state, action) => {
        state.isFetchingSuggestions = false;
        state.suggestionsError = action.payload || '获取搜索建议失败';
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
  setSearchMode,
  setFilter,
  resetFilters,
  setPagination,
  clearSuggestions,
} = searchSlice.actions;

// 导出Selectors
export const selectSearchResults = (state) => state.search.results;
export const selectIsLoading = (state) => state.search.isLoading;
export const selectError = (state) => state.search.error;
export const selectSearchHistory = (state) => state.search.searchHistory;
export const selectRecentSearches = (state) => state.search.recentSearches;
export const selectSuggestions = (state) => state.search.suggestions;
export const selectIsFetchingSuggestions = (state) => state.search.isFetchingSuggestions;
export const selectSuggestionsError = (state) => state.search.suggestionsError;
export const selectSearchMode = (state) => state.search.searchMode;
export const selectFilters = (state) => state.search.filters;
export const selectPagination = (state) => state.search.pagination;

// 导出Reducer
export default searchSlice.reducer;
