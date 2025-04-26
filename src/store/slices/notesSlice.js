/**
 * 笔记状态切片
 */
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { notesApi } from '../../services/api';

// 初始状态
const initialState = {
  notes: [],
  currentNote: null,
  categories: [],
  tags: [],
  stats: null,
  isLoading: false,
  error: null,
  pagination: {
    page: 1,
    pageSize: 10,
    totalPages: 0,
    totalItems: 0,
  },
};

// 异步操作：获取所有笔记
export const fetchNotes = createAsyncThunk(
  'notes/fetchNotes',
  async (params, { rejectWithValue }) => {
    try {
      const result = await notesApi.getAllNotes(params);
      if (result.success) {
        return result.data;
      }
      return rejectWithValue(result.message || '获取笔记列表失败');
    } catch (error) {
      return rejectWithValue(error.message || '获取笔记列表失败');
    }
  }
);

// 异步操作：获取笔记详情
export const fetchNoteById = createAsyncThunk(
  'notes/fetchNoteById',
  async (id, { rejectWithValue }) => {
    try {
      const result = await notesApi.getNoteById(id);
      if (result.success) {
        return result.data;
      }
      return rejectWithValue(result.message || '获取笔记详情失败');
    } catch (error) {
      return rejectWithValue(error.message || '获取笔记详情失败');
    }
  }
);

// 异步操作：创建笔记
export const createNote = createAsyncThunk(
  'notes/createNote',
  async (noteData, { rejectWithValue }) => {
    try {
      const result = await notesApi.createNote(noteData);
      if (result.success) {
        return result.data;
      }
      return rejectWithValue(result.message || '创建笔记失败');
    } catch (error) {
      return rejectWithValue(error.message || '创建笔记失败');
    }
  }
);

// 异步操作：更新笔记
export const updateNote = createAsyncThunk(
  'notes/updateNote',
  async ({ id, noteData }, { rejectWithValue }) => {
    try {
      const result = await notesApi.updateNote(id, noteData);
      if (result.success) {
        return result.data;
      }
      return rejectWithValue(result.message || '更新笔记失败');
    } catch (error) {
      return rejectWithValue(error.message || '更新笔记失败');
    }
  }
);

// 异步操作：删除笔记
export const deleteNote = createAsyncThunk(
  'notes/deleteNote',
  async (id, { rejectWithValue }) => {
    try {
      const result = await notesApi.deleteNote(id);
      if (result.success) {
        return id;
      }
      return rejectWithValue(result.message || '删除笔记失败');
    } catch (error) {
      return rejectWithValue(error.message || '删除笔记失败');
    }
  }
);

// 异步操作：获取笔记分类
export const fetchCategories = createAsyncThunk(
  'notes/fetchCategories',
  async (_, { rejectWithValue }) => {
    try {
      const result = await notesApi.getNoteCategories();
      if (result.success) {
        return result.data;
      }
      return rejectWithValue(result.message || '获取笔记分类失败');
    } catch (error) {
      return rejectWithValue(error.message || '获取笔记分类失败');
    }
  }
);

// 异步操作：获取笔记标签
export const fetchTags = createAsyncThunk(
  'notes/fetchTags',
  async (_, { rejectWithValue }) => {
    try {
      const result = await notesApi.getNoteTags();
      if (result.success) {
        return result.data;
      }
      return rejectWithValue(result.message || '获取笔记标签失败');
    } catch (error) {
      return rejectWithValue(error.message || '获取笔记标签失败');
    }
  }
);

// 异步操作：获取笔记统计信息
export const fetchStats = createAsyncThunk(
  'notes/fetchStats',
  async (_, { rejectWithValue }) => {
    try {
      const result = await notesApi.getNoteStats();
      if (result.success) {
        return result.data;
      }
      return rejectWithValue(result.message || '获取笔记统计信息失败');
    } catch (error) {
      return rejectWithValue(error.message || '获取笔记统计信息失败');
    }
  }
);

// 创建切片
const notesSlice = createSlice({
  name: 'notes',
  initialState,
  reducers: {
    // 设置当前笔记
    setCurrentNote: (state, action) => {
      state.currentNote = action.payload;
    },
    // 清除当前笔记
    clearCurrentNote: (state) => {
      state.currentNote = null;
    },
    // 设置分页信息
    setPagination: (state, action) => {
      state.pagination = {
        ...state.pagination,
        ...action.payload,
      };
    },
    // 清除错误
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // 获取所有笔记
    builder
      .addCase(fetchNotes.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchNotes.fulfilled, (state, action) => {
        state.isLoading = false;
        state.notes = action.payload.results;
        state.pagination = {
          page: action.payload.page || 1,
          pageSize: action.payload.page_size || 10,
          totalPages: action.payload.total_pages || 1,
          totalItems: action.payload.count || 0,
        };
      })
      .addCase(fetchNotes.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || '获取笔记列表失败';
      });

    // 获取笔记详情
    builder
      .addCase(fetchNoteById.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchNoteById.fulfilled, (state, action) => {
        state.isLoading = false;
        state.currentNote = action.payload;
      })
      .addCase(fetchNoteById.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || '获取笔记详情失败';
      });

    // 创建笔记
    builder
      .addCase(createNote.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createNote.fulfilled, (state, action) => {
        state.isLoading = false;
        state.notes.unshift(action.payload);
        state.currentNote = action.payload;
      })
      .addCase(createNote.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || '创建笔记失败';
      });

    // 更新笔记
    builder
      .addCase(updateNote.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateNote.fulfilled, (state, action) => {
        state.isLoading = false;
        state.notes = state.notes.map((note) =>
          note.id === action.payload.id ? action.payload : note
        );
        state.currentNote = action.payload;
      })
      .addCase(updateNote.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || '更新笔记失败';
      });

    // 删除笔记
    builder
      .addCase(deleteNote.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(deleteNote.fulfilled, (state, action) => {
        state.isLoading = false;
        state.notes = state.notes.filter((note) => note.id !== action.payload);
        if (state.currentNote && state.currentNote.id === action.payload) {
          state.currentNote = null;
        }
      })
      .addCase(deleteNote.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || '删除笔记失败';
      });

    // 获取笔记分类
    builder
      .addCase(fetchCategories.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchCategories.fulfilled, (state, action) => {
        state.isLoading = false;
        state.categories = action.payload;
      })
      .addCase(fetchCategories.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || '获取笔记分类失败';
      });

    // 获取笔记标签
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
        state.error = action.payload || '获取笔记标签失败';
      });

    // 获取笔记统计信息
    builder
      .addCase(fetchStats.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchStats.fulfilled, (state, action) => {
        state.isLoading = false;
        state.stats = action.payload;
      })
      .addCase(fetchStats.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || '获取笔记统计信息失败';
      });
  },
});

// 导出操作
export const {
  setCurrentNote,
  clearCurrentNote,
  setPagination,
  clearError,
} = notesSlice.actions;

// 导出选择器
export const selectNotes = (state) => state.notes.notes;
export const selectCurrentNote = (state) => state.notes.currentNote;
export const selectCategories = (state) => state.notes.categories;
export const selectTags = (state) => state.notes.tags;
export const selectStats = (state) => state.notes.stats;
export const selectIsLoading = (state) => state.notes.isLoading;
export const selectError = (state) => state.notes.error;
export const selectPagination = (state) => state.notes.pagination;

// 导出切片
export default notesSlice.reducer;
