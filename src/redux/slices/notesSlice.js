/**
 * 笔记状态管理Slice
 */

import { createSlice, createAsyncThunk, createEntityAdapter } from '@reduxjs/toolkit';
import * as notesApi from '../../services/api/notesApi';
import { TIMEOUTS } from '../../utils/constants/config';

// 创建实体适配器，用于规范化状态
const notesAdapter = createEntityAdapter({
  selectId: (note) => note.id,
  sortComparer: (a, b) => b.updated_at.localeCompare(a.updated_at), // 按更新时间降序排序
});

// 异步Action: 获取笔记列表
export const fetchNotes = createAsyncThunk(
  'notes/fetchNotes',
  async (params, { rejectWithValue }) => {
    try {
      const response = await notesApi.getNotes(params);
      return response;
    } catch (error) {
      return rejectWithValue(error.message || '获取笔记列表失败');
    }
  }
);

// 异步Action: 获取单个笔记
export const fetchNoteById = createAsyncThunk(
  'notes/fetchNoteById',
  async (id, { rejectWithValue }) => {
    try {
      const response = await notesApi.getNote(id);
      return response;
    } catch (error) {
      return rejectWithValue(error.message || `获取笔记(ID: ${id})失败`);
    }
  }
);

// 异步Action: 创建笔记
export const createNote = createAsyncThunk(
  'notes/createNote',
  async (noteData, { rejectWithValue }) => {
    try {
      const response = await notesApi.createNote(noteData);
      return response;
    } catch (error) {
      return rejectWithValue(error.message || '创建笔记失败');
    }
  }
);

// 异步Action: 更新笔记
export const updateNote = createAsyncThunk(
  'notes/updateNote',
  async ({ id, noteData }, { rejectWithValue }) => {
    try {
      const response = await notesApi.updateNote(id, noteData);
      return response;
    } catch (error) {
      return rejectWithValue(error.message || `更新笔记(ID: ${id})失败`);
    }
  }
);

// 异步Action: 删除笔记
export const deleteNote = createAsyncThunk(
  'notes/deleteNote',
  async (id, { rejectWithValue }) => {
    try {
      await notesApi.deleteNote(id);
      return id;
    } catch (error) {
      return rejectWithValue(error.message || `删除笔记(ID: ${id})失败`);
    }
  }
);

// 异步Action: 手写识别
export const recognizeHandwriting = createAsyncThunk(
  'notes/recognizeHandwriting',
  async (imageData, { rejectWithValue }) => {
    try {
      const response = await notesApi.recognizeHandwriting(imageData);
      return response;
    } catch (error) {
      return rejectWithValue(error.message || '手写识别失败');
    }
  }
);

// 异步Action: 上传图片
export const uploadImage = createAsyncThunk(
  'notes/uploadImage',
  async ({ imageData, noteId }, { rejectWithValue }) => {
    try {
      const response = await notesApi.uploadImage(imageData, noteId);
      return response;
    } catch (error) {
      return rejectWithValue(error.message || '上传图片失败');
    }
  }
);

// 异步Action: 自动保存笔记
export const autoSaveNote = createAsyncThunk(
  'notes/autoSaveNote',
  async ({ id, noteData }, { rejectWithValue }) => {
    try {
      const response = await notesApi.autoSaveNote(id, noteData);
      return response;
    } catch (error) {
      return rejectWithValue(error.message || `自动保存笔记(ID: ${id})失败`);
    }
  }
);

// 异步Action: 获取笔记历史版本列表
export const getNoteHistory = createAsyncThunk(
  'notes/getNoteHistory',
  async (id, { rejectWithValue }) => {
    try {
      const response = await notesApi.getNoteHistory(id);
      return response;
    } catch (error) {
      return rejectWithValue(error.message || `获取笔记历史版本(ID: ${id})失败`);
    }
  }
);

// 异步Action: 获取笔记特定历史版本
export const getNoteVersion = createAsyncThunk(
  'notes/getNoteVersion',
  async ({ id, versionId }, { rejectWithValue }) => {
    try {
      const response = await notesApi.getNoteVersion(id, versionId);
      return response;
    } catch (error) {
      return rejectWithValue(error.message || `获取笔记版本(ID: ${id}, 版本: ${versionId})失败`);
    }
  }
);

// 异步Action: 恢复笔记到特定历史版本
export const restoreNoteVersion = createAsyncThunk(
  'notes/restoreNoteVersion',
  async ({ id, versionId }, { rejectWithValue }) => {
    try {
      const response = await notesApi.restoreNoteVersion(id, versionId);
      return response;
    } catch (error) {
      return rejectWithValue(error.message || `恢复笔记版本(ID: ${id}, 版本: ${versionId})失败`);
    }
  }
);

// 异步Action: 保存离线笔记
export const saveOfflineNote = createAsyncThunk(
  'notes/saveOfflineNote',
  async (note, { rejectWithValue }) => {
    try {
      const response = await notesApi.saveOfflineNote(note);
      return response;
    } catch (error) {
      return rejectWithValue(error.message || '保存离线笔记失败');
    }
  }
);

// 异步Action: 同步离线笔记
export const syncOfflineNotes = createAsyncThunk(
  'notes/syncOfflineNotes',
  async (_, { rejectWithValue }) => {
    try {
      const response = await notesApi.syncOfflineNotes();
      return response;
    } catch (error) {
      return rejectWithValue(error.message || '同步离线笔记失败');
    }
  }
);

// 初始状态
const initialState = notesAdapter.getInitialState({
  currentNote: null,
  isLoading: false,
  error: null,
  handwritingResult: null,
  handwritingIsLoading: false,
  handwritingError: null,
  filters: {
    category: null,
    tags: [],
    searchQuery: '',
  },
  pagination: {
    page: 1,
    totalPages: 1,
    totalItems: 0,
  },
  // 新增状态
  imageUpload: {
    isLoading: false,
    error: null,
    result: null,
  },
  autoSave: {
    isLoading: false,
    error: null,
    lastSaved: null,
    pendingChanges: false,
  },
  history: {
    isLoading: false,
    error: null,
    versions: [],
    currentVersion: null,
  },
  offline: {
    isLoading: false,
    error: null,
    unsyncedCount: 0,
    lastSynced: null,
  },
});

// 创建Slice
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
    // 设置筛选条件
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    // 清除筛选条件
    clearFilters: (state) => {
      state.filters = initialState.filters;
    },
    // 清除手写识别结果
    clearHandwritingResult: (state) => {
      state.handwritingResult = null;
      state.handwritingError = null;
    },
    // 清除错误
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // 获取笔记列表
      .addCase(fetchNotes.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchNotes.fulfilled, (state, action) => {
        state.isLoading = false;
        notesAdapter.setAll(state, action.payload.notes);
        state.pagination = {
          page: action.payload.page,
          totalPages: action.payload.total_pages,
          totalItems: action.payload.total_items,
        };
      })
      .addCase(fetchNotes.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      
      // 获取单个笔记
      .addCase(fetchNoteById.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchNoteById.fulfilled, (state, action) => {
        state.isLoading = false;
        notesAdapter.upsertOne(state, action.payload);
        state.currentNote = action.payload;
      })
      .addCase(fetchNoteById.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      
      // 创建笔记
      .addCase(createNote.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(createNote.fulfilled, (state, action) => {
        state.isLoading = false;
        notesAdapter.addOne(state, action.payload);
        state.currentNote = action.payload;
      })
      .addCase(createNote.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      
      // 更新笔记
      .addCase(updateNote.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateNote.fulfilled, (state, action) => {
        state.isLoading = false;
        notesAdapter.updateOne(state, {
          id: action.payload.id,
          changes: action.payload,
        });
        state.currentNote = action.payload;
      })
      .addCase(updateNote.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      
      // 删除笔记
      .addCase(deleteNote.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(deleteNote.fulfilled, (state, action) => {
        state.isLoading = false;
        notesAdapter.removeOne(state, action.payload);
        if (state.currentNote && state.currentNote.id === action.payload) {
          state.currentNote = null;
        }
      })
      .addCase(deleteNote.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      
      // 手写识别
      .addCase(recognizeHandwriting.pending, (state) => {
        state.handwritingIsLoading = true;
        state.handwritingError = null;
      })
      .addCase(recognizeHandwriting.fulfilled, (state, action) => {
        state.handwritingIsLoading = false;
        state.handwritingResult = action.payload;
      })
      .addCase(recognizeHandwriting.rejected, (state, action) => {
        state.handwritingIsLoading = false;
        state.handwritingError = action.payload;
      })
      
      // 上传图片
      .addCase(uploadImage.pending, (state) => {
        state.imageUpload.isLoading = true;
        state.imageUpload.error = null;
      })
      .addCase(uploadImage.fulfilled, (state, action) => {
        state.imageUpload.isLoading = false;
        state.imageUpload.result = action.payload;
      })
      .addCase(uploadImage.rejected, (state, action) => {
        state.imageUpload.isLoading = false;
        state.imageUpload.error = action.payload;
      })
      
      // 自动保存笔记
      .addCase(autoSaveNote.pending, (state) => {
        state.autoSave.isLoading = true;
        state.autoSave.error = null;
      })
      .addCase(autoSaveNote.fulfilled, (state, action) => {
        state.autoSave.isLoading = false;
        state.autoSave.lastSaved = new Date().toISOString();
        state.autoSave.pendingChanges = false;
        // 更新当前笔记
        if (state.currentNote && state.currentNote.id === action.payload.id) {
          state.currentNote = action.payload;
        }
        // 更新实体
        notesAdapter.updateOne(state, {
          id: action.payload.id,
          changes: action.payload,
        });
      })
      .addCase(autoSaveNote.rejected, (state, action) => {
        state.autoSave.isLoading = false;
        state.autoSave.error = action.payload;
      })
      
      // 获取笔记历史版本列表
      .addCase(getNoteHistory.pending, (state) => {
        state.history.isLoading = true;
        state.history.error = null;
      })
      .addCase(getNoteHistory.fulfilled, (state, action) => {
        state.history.isLoading = false;
        state.history.versions = action.payload;
      })
      .addCase(getNoteHistory.rejected, (state, action) => {
        state.history.isLoading = false;
        state.history.error = action.payload;
      })
      
      // 获取笔记特定历史版本
      .addCase(getNoteVersion.pending, (state) => {
        state.history.isLoading = true;
        state.history.error = null;
      })
      .addCase(getNoteVersion.fulfilled, (state, action) => {
        state.history.isLoading = false;
        state.history.currentVersion = action.payload;
      })
      .addCase(getNoteVersion.rejected, (state, action) => {
        state.history.isLoading = false;
        state.history.error = action.payload;
      })
      
      // 恢复笔记到特定历史版本
      .addCase(restoreNoteVersion.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(restoreNoteVersion.fulfilled, (state, action) => {
        state.isLoading = false;
        // 更新当前笔记
        state.currentNote = action.payload;
        // 更新实体
        notesAdapter.updateOne(state, {
          id: action.payload.id,
          changes: action.payload,
        });
      })
      .addCase(restoreNoteVersion.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })
      
      // 保存离线笔记
      .addCase(saveOfflineNote.pending, (state) => {
        state.offline.isLoading = true;
        state.offline.error = null;
      })
      .addCase(saveOfflineNote.fulfilled, (state, action) => {
        state.offline.isLoading = false;
        state.offline.unsyncedCount += 1;
        // 更新当前笔记
        if (state.currentNote && state.currentNote.id === action.payload.note.id) {
          state.currentNote = action.payload.note;
        }
        // 更新实体
        notesAdapter.upsertOne(state, action.payload.note);
      })
      .addCase(saveOfflineNote.rejected, (state, action) => {
        state.offline.isLoading = false;
        state.offline.error = action.payload;
      })
      
      // 同步离线笔记
      .addCase(syncOfflineNotes.pending, (state) => {
        state.offline.isLoading = true;
        state.offline.error = null;
      })
      .addCase(syncOfflineNotes.fulfilled, (state, action) => {
        state.offline.isLoading = false;
        state.offline.lastSynced = new Date().toISOString();
        state.offline.unsyncedCount = state.offline.unsyncedCount - action.payload.synced;
        if (state.offline.unsyncedCount < 0) state.offline.unsyncedCount = 0;
      })
      .addCase(syncOfflineNotes.rejected, (state, action) => {
        state.offline.isLoading = false;
        state.offline.error = action.payload;
      });
  },
});

// 导出Actions
export const {
  setCurrentNote,
  clearCurrentNote,
  setFilters,
  clearFilters,
  clearHandwritingResult,
  clearError,
} = notesSlice.actions;

// 导出Selectors
export const {
  selectAll: selectAllNotes,
  selectById: selectNoteById,
  selectIds: selectNoteIds,
  selectEntities: selectNoteEntities,
  selectTotal: selectTotalNotes,
} = notesAdapter.getSelectors((state) => state.notes);

export const selectCurrentNote = (state) => state.notes.currentNote;
export const selectNotesLoading = (state) => state.notes.isLoading;
export const selectNotesError = (state) => state.notes.error;
export const selectHandwritingResult = (state) => state.notes.handwritingResult;
export const selectHandwritingLoading = (state) => state.notes.handwritingIsLoading;
export const selectHandwritingError = (state) => state.notes.handwritingError;
export const selectNoteFilters = (state) => state.notes.filters;
export const selectNotesPagination = (state) => state.notes.pagination;

// 导出Selectors
export const selectImageUploadState = (state) => state.notes.imageUpload;
export const selectAutoSaveState = (state) => state.notes.autoSave;
export const selectHistoryState = (state) => state.notes.history;
export const selectOfflineState = (state) => state.notes.offline;

// 导出Reducer
export default notesSlice.reducer;