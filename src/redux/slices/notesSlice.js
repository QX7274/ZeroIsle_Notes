/**
 * 笔记状态管理Slice
 */

import { createSlice, createAsyncThunk, createEntityAdapter } from '@reduxjs/toolkit';
import notesApi from '../../services/api/notesApi';
import * as autoClassificationApi from '../../services/api/autoClassificationApi';
// 验证notesApi是否正确导入
if (!notesApi) {
  console.error('notesApi导入失败，请检查文件路径和导出');
}
import realmService from '../../services/database/realmService';

// 创建实体适配器，用于规范化状态
const notesAdapter = createEntityAdapter({
  // 改进的selectId实现，同时支持id和_id字段
  selectId: (note) => {
    // 防止note为null或undefined
    if (!note) {
      console.warn('selectId收到无效的note对象:', note);
      return realmService.createObjectId();
    }

    // 优先使用_id字段（MongoDB/Realm标准）
    if (note._id !== undefined) {
      return typeof note._id === 'object' ? note._id.toString() : String(note._id);
    }

    // 其次使用id字段
    if (note.id !== undefined) {
      return typeof note.id === 'object' ? note.id.toString() : String(note.id);
    }

    // 如果都没有，生成一个临时ID
    console.warn('笔记对象既没有_id也没有id字段:', note);
    return realmService.createObjectId();
  },
  // 改进的排序比较器，处理可能的无效日期
  sortComparer: (a, b) => {
    // 防止a或b为null或undefined
    if (!a || !b) {return 0;}

    // 获取更新时间，如果不存在则使用创建时间，如果都不存在则使用当前时间
    const aDate = a.updated_at || a.created_at || new Date().toISOString();
    const bDate = b.updated_at || b.created_at || new Date().toISOString();

    // 安全地比较日期字符串
    try {
      // 确保日期是字符串格式
      const aDateStr = typeof aDate === 'string' ? aDate : new Date(aDate).toISOString();
      const bDateStr = typeof bDate === 'string' ? bDate : new Date(bDate).toISOString();
      return bDateStr.localeCompare(aDateStr); // 按更新时间降序排序
    } catch (error) {
      console.warn('日期比较失败:', error, { a, b });
      return 0; // 保持原有顺序
    }
  },
});

// 异步Action: 获取笔记列表
export const fetchNotes = createAsyncThunk(
  'notes/fetchNotes',
  async (params, { rejectWithValue }) => {
    try {
      const response = await notesApi.getAllNotes(params);
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
      console.log('Redux createNote action开始执行，笔记数据:', noteData);

      // 生成唯一ID，确保在离线状态下也能使用
      const noteId = noteData.id || realmService.createObjectId();

      // 准备离线笔记数据，添加必要的元数据
      const offlineNote = {
        ...noteData,
        id: noteId,
        isOffline: true,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      console.log('准备保存离线笔记:', offlineNote);

      // 1. 优先尝试保存到本地离线存储
      try {
        const realm = await realmService.getRealm();
        realm.write(() => {
          // 使用'modified'模式：如果Note已存在则更新，不存在则创建
          realm.create('Note', offlineNote, 'modified');
        });
        console.log('离线笔记保存成功:', noteId);
      } catch (offlineError) {
        console.error('保存到离线存储失败，但继续尝试API保存:', offlineError);
        // 即使离线存储失败，也继续尝试API保存
      }

      // 2. 尝试通过API保存（可能是本地SQLite或远程服务器）
      try {
        console.log('尝试通过API创建笔记');
        const response = await notesApi.createNote(noteData);
        console.log('API创建笔记成功:', response);

        // 如果API保存成功，更新离线存储中的状态
        try {
          if (response && response.data) {
            const realm = await realmService.getRealm();
            realm.write(() => {
              const note = realm.objectForPrimaryKey('Note', noteId);
              if (note) {
                Object.assign(note, {
                  ...response.data,
                  isOffline: false,
                });
              }
            });
            console.log('更新离线存储中的笔记状态成功');
          }
        } catch (updateError) {
          console.warn('更新离线存储中的笔记状态失败，但API保存成功:', updateError);
        }

        // 后台触发知识图谱构建（不阻塞UI）
        try {
          const createdId = (response && response.data && (response.data.id || response.data._id)) || noteId;
          if (createdId) {
            autoClassificationApi.buildKnowledgeGraph(createdId, true);
          }
        } catch (e) {
          console.warn('触发知识图谱构建失败（忽略）', e);
        }

        // 返回API响应
        return response.data || response;
      } catch (apiError) {
        console.warn('API创建笔记失败，使用离线笔记:', apiError);

        // 3. 如果API保存失败，返回离线笔记
        // 这确保即使API调用失败，用户仍然可以看到他们创建的笔记
        return offlineNote;
      }
    } catch (error) {
      console.error('创建笔记过程中发生严重错误:', error);

      // 即使在最坏的情况下，也尝试返回一些有用的信息
      try {
        // 创建一个最小的笔记对象
        const emergencyNote = {
          id: 'emergency_' + Date.now(),
          title: noteData.title || '紧急恢复的笔记',
          content: noteData.content || '',
          isOffline: true,
          isEmergency: true,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        console.log('创建紧急恢复笔记:', emergencyNote);
        return emergencyNote;
      } catch (emergencyError) {
        console.error('创建紧急恢复笔记也失败:', emergencyError);
        return rejectWithValue(error.message || '创建笔记失败');
      }
    }
  }
);

// 异步Action: 更新笔记
export const updateNote = createAsyncThunk(
  'notes/updateNote',
  async ({ id, noteData }, { rejectWithValue }) => {
    try {
      const response = await notesApi.updateNote(id, noteData);
      // 异步触发知识图谱构建
      try {
        autoClassificationApi.buildKnowledgeGraph(id, true);
      } catch (e) {
        console.warn('触发知识图谱构建失败（忽略）', e);
      }
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
      // 获取所有离线笔记
      const realm = await realmService.getRealm();
      const offlineNotes = realm.objects('Note').filtered('isOffline = true');
      let syncedCount = 0;

      // 批量同步离线笔记
      for (const note of offlineNotes) {
        try {
          // 根据笔记ID判断是创建还是更新
          const response = note.id
            ? await notesApi.updateNote(note.id, note)
            : await notesApi.createNote(note);

          // 同步成功后更新本地状态
          const realm = await realmService.getRealm();
          realm.write(() => {
            const note = realm.objectForPrimaryKey('Note', note.id);
            if (note) {
              Object.assign(note, {
            ...response,
                isOffline: false,
              });
            }
          });
          syncedCount++;
        } catch (error) {
          console.error(`同步笔记(ID: ${note.id})失败:`, error);
        }
      }

      return { synced: syncedCount, total: offlineNotes.length };
    } catch (error) {
      return rejectWithValue(error.message || '同步离线笔记失败');
    }
  }
);

// 异步Action: 导入笔记
export const importNote = createAsyncThunk(
  'notes/importNote',
  async (formData, { rejectWithValue }) => {
    try {
      const response = await notesApi.importNote(formData);

      // 检查响应是否成功
      if (!response.success) {
        console.log('导入笔记API返回失败，但继续处理本地导入:', response);

        // 如果有数据，即使API返回失败也继续处理
        if (response.data) {
          console.log('使用本地导入的数据:', response.data);
          return response.data;
        }

        throw new Error(response.message || '导入笔记失败');
      }

      return response.data;
    } catch (error) {
      console.error('导入笔记异常:', error);

      // 如果有错误对象中包含数据，尝试使用它
      if (error.response && error.response.data) {
        console.log('尝试从错误响应中提取数据:', error.response.data);
        return error.response.data;
      }

      return rejectWithValue(error.message || '导入笔记失败');
    }
  }
);

// 异步Action: 获取笔记分类
export const fetchCategories = createAsyncThunk(
  'notes/fetchCategories',
  async (_, { rejectWithValue }) => {
    try {
      const response = await notesApi.getNoteCategories();
      return response;
    } catch (error) {
      return rejectWithValue(error.message || '获取笔记分类失败');
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
  categories: {
    items: [],
    isLoading: false,
    error: null,
  },
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
    // 添加单个笔记
    addNote: notesAdapter.addOne,
    // 添加多个笔记
    addNotes: notesAdapter.addMany,
    // 更新单个笔记
    updateOneNote: notesAdapter.updateOne,
    // 更新多个笔记
    updateNotes: notesAdapter.updateMany,
    // 删除单个笔记
    removeNote: notesAdapter.removeOne,
    // 删除多个笔记
    removeNotes: notesAdapter.removeMany,
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
    // 设置笔记列表（用于批量更新）
    setNotes: (state, action) => {
      state.isLoading = false;
      state.error = null;

      // 清空现有笔记
      notesAdapter.removeAll(state);

      // 添加新笔记
      if (Array.isArray(action.payload)) {
        notesAdapter.addMany(state, action.payload);
      }
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

        // 处理各种可能的响应格式
        let notes = [];
        let pagination = {
          page: 1,
          totalPages: 1,
          totalItems: 0,
        };

        try {
          // 检查响应格式
          if (action.payload) {
            // 如果响应包含data字段（新API格式）
            if (action.payload.data) {
              notes = Array.isArray(action.payload.data) ? action.payload.data : [action.payload.data];

              // 提取分页信息
              pagination = {
                page: action.payload.page || 1,
                totalPages: action.payload.total_pages || 1,
                totalItems: action.payload.total_items || notes.length,
              };
            }
            // 如果响应包含notes字段（旧API格式）
            else if (action.payload.notes) {
              notes = Array.isArray(action.payload.notes) ? action.payload.notes : [action.payload.notes];

              // 提取分页信息
              pagination = {
                page: action.payload.page || 1,
                totalPages: action.payload.total_pages || 1,
                totalItems: action.payload.total_items || notes.length,
              };
            }
            // 如果响应本身就是数组
            else if (Array.isArray(action.payload)) {
              notes = action.payload;
            }
          }

          // 过滤掉无效的笔记（没有id或_id的笔记）
          notes = notes.filter(note => note && (note.id || note._id));

          console.log(`处理了${notes.length}条有效笔记`);

          // 更新状态
          notesAdapter.setAll(state, notes);
          state.pagination = pagination;
          state.pagination.totalItems = notes.length; // 确保totalItems与实际笔记数量一致
        } catch (error) {
          console.error('处理笔记响应失败:', error);
          // 出错时不更新状态，保持现有笔记
        }
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
        console.log('创建笔记成功，处理响应数据:', action.payload);

        // 处理各种可能的响应格式
        let noteData = action.payload;

        // 如果响应是一个包含data属性的对象，使用data
        if (noteData && noteData.data) {
          noteData = noteData.data;
          console.log('从response.data中提取笔记数据:', noteData);
        }

        // 如果响应是一个包含success属性的对象，检查是否成功
        if (noteData && typeof noteData.success === 'boolean') {
          if (!noteData.success) {
            console.warn('API返回失败状态，但继续处理:', noteData.message);
            // 如果有错误消息，记录到state.error
            state.error = noteData.message || '创建笔记失败';
          }
        }

        // 确保笔记有一个有效的ID
        if (noteData && !noteData.id) {
          const tempId = realmService.createObjectId();
          console.log(`笔记缺少ID，生成临时ID: ${tempId}`);
          noteData.id = tempId;
        }

        // 确保笔记有标题和内容
        if (noteData) {
          if (!noteData.title) {
            console.log('笔记缺少标题，设置默认标题');
            noteData.title = '无标题笔记';
          }
          if (!noteData.content && noteData.content !== '') {
            console.log('笔记缺少内容，设置为空字符串');
            noteData.content = '';
          }
        }

        // 确保笔记有创建和更新时间
        if (noteData) {
          const now = new Date().toISOString();

          // 处理不同格式的时间字段
          if (!noteData.created_at && !noteData.createdAt) {
            console.log('笔记缺少创建时间，设置为当前时间');
            noteData.created_at = now;
            noteData.createdAt = now;
          } else if (noteData.created_at && !noteData.createdAt) {
            noteData.createdAt = noteData.created_at;
          } else if (!noteData.created_at && noteData.createdAt) {
            noteData.created_at = noteData.createdAt;
          }

          if (!noteData.updated_at && !noteData.updatedAt) {
            console.log('笔记缺少更新时间，设置为当前时间');
            noteData.updated_at = now;
            noteData.updatedAt = now;
          } else if (noteData.updated_at && !noteData.updatedAt) {
            noteData.updatedAt = noteData.updated_at;
          } else if (!noteData.updated_at && noteData.updatedAt) {
            noteData.updated_at = noteData.updatedAt;
          }
        }

        // 只有当笔记数据有效时才添加到状态
        if (noteData && noteData.id) {
          console.log('将笔记添加到Redux状态:', noteData);

          // 确保数据格式一致，避免重复字段
          const normalizedNote = {
            id: noteData.id,
            title: noteData.title || '无标题笔记',
            content: noteData.content || '',
            created_at: noteData.created_at || noteData.createdAt,
            updated_at: noteData.updated_at || noteData.updatedAt,
            category_id: noteData.category_id || noteData.categoryId,
            is_favorite: noteData.is_favorite || noteData.isFavorite || false,
            is_offline: noteData.is_offline || noteData.isOffline || false,
            tags: noteData.tags || [],
          };

          notesAdapter.addOne(state, normalizedNote);
          state.currentNote = normalizedNote;
        } else {
          console.warn('收到无效的笔记数据，无法添加到Redux状态:', noteData);

          // 创建一个紧急笔记对象
          const emergencyNote = {
            id: 'emergency_' + Date.now(),
            title: '恢复的笔记',
            content: '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            is_emergency: true,
          };

          console.log('创建紧急恢复笔记:', emergencyNote);
          notesAdapter.addOne(state, emergencyNote);
          state.currentNote = emergencyNote;
          state.error = '笔记数据无效，已创建恢复笔记';
        }
      })
      .addCase(createNote.rejected, (state, action) => {
        state.isLoading = false;
        console.error('创建笔记被拒绝:', action.payload || action.error);

        // 记录错误信息
        state.error = action.payload || action.error?.message || '创建笔记失败';

        // 即使在拒绝的情况下，也尝试从payload中提取有用的信息
        try {
          if (action.payload && typeof action.payload === 'object') {
            // 如果有数据，尝试添加到状态
            if (action.payload.data) {
              const noteData = action.payload.data;
              console.log('从拒绝的action中提取笔记数据:', noteData);

              if (noteData.id || noteData.title || noteData.content) {
                notesAdapter.addOne(state, noteData);
                state.currentNote = noteData;
                return;
              }
            }

            // 如果有紧急恢复笔记
            if (action.payload.isEmergency && action.payload.id) {
              console.log('使用紧急恢复笔记:', action.payload);
              notesAdapter.addOne(state, action.payload);
              state.currentNote = action.payload;
              return;
            }
          }

          // 如果没有可用数据，创建一个紧急笔记
          const emergencyNote = {
            id: 'emergency_' + Date.now(),
            title: '恢复的笔记',
            content: '',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            is_emergency: true,
          };

          console.log('创建紧急恢复笔记:', emergencyNote);
          notesAdapter.addOne(state, emergencyNote);
          state.currentNote = emergencyNote;
        } catch (error) {
          console.error('处理拒绝状态时出错:', error);
        }
      })

      // 更新笔记
      .addCase(updateNote.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateNote.fulfilled, (state, action) => {
        state.isLoading = false;

        // 处理各种可能的响应格式
        let noteData = action.payload;

        // 如果响应是一个包含data属性的对象，使用data
        if (noteData && noteData.data) {
          noteData = noteData.data;
          console.log('从response.data中提取笔记数据:', noteData);
        }

        // 如果响应是一个包含success属性的对象，检查是否成功
        if (noteData && typeof noteData.success === 'boolean') {
          if (!noteData.success) {
            console.warn('API返回失败状态，但继续处理:', noteData.message);
            // 如果有错误消息，记录到state.error
            state.error = noteData.message || '更新笔记失败';
            return;
          }
        }

        // 确保笔记有一个有效的ID
        if (!noteData || !noteData.id) {
          console.error('更新笔记响应中没有有效的笔记ID:', noteData);
          return;
        }

        console.log('更新笔记成功，更新Redux状态:', noteData);

        // 更新实体
        notesAdapter.updateOne(state, {
          id: noteData.id,
          changes: noteData,
        });

        // 更新当前笔记
        state.currentNote = noteData;
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
        if (state.offline.unsyncedCount < 0) {state.offline.unsyncedCount = 0;}
      })
      .addCase(syncOfflineNotes.rejected, (state, action) => {
        state.offline.isLoading = false;
        state.offline.error = action.payload;
      })

      // 获取笔记分类
      .addCase(fetchCategories.pending, (state) => {
        state.categories.isLoading = true;
        state.categories.error = null;
      })
      .addCase(fetchCategories.fulfilled, (state, action) => {
        state.categories.isLoading = false;
        state.categories.items = action.payload.data || [];
      })
      .addCase(fetchCategories.rejected, (state, action) => {
        state.categories.isLoading = false;
        state.categories.error = action.payload;
      })

      // 导入笔记
      .addCase(importNote.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(importNote.fulfilled, (state, action) => {
        state.isLoading = false;

        // 检查action.payload是否存在
        if (!action.payload) {
          console.error('导入笔记成功但没有返回数据');
          return;
        }

        // 添加导入的笔记到状态
        const note = {
          ...action.payload,
          id: action.payload.note_id || action.payload.id,
        };

        console.log('导入笔记成功，添加到Redux状态:', note);

        // 确保笔记有ID
        if (!note.id) {
          console.error('导入的笔记没有ID，生成临时ID');
          note.id = realmService.createObjectId();
        }

        // 确保笔记有标题
        if (!note.title && note.file_name) {
          note.title = note.file_name.split('.')[0];
        }

        // 确保笔记有预览图片
        if (!note.preview_image && note.file_type === 'pdf') {
          note.preview_image = 'https://img-blog.csdnimg.cn/20200627111426602.png';
        }

        // 使用upsertOne而不是addOne，以防止ID冲突
        notesAdapter.upsertOne(state, note);

        // 更新当前笔记
        state.currentNote = note;

        // 增加未同步计数
        if (note.is_offline || note.isOffline) {
          state.offline.unsyncedCount += 1;
        }
      })
      .addCase(importNote.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;

        // 即使API请求失败，也尝试从错误中提取数据
        if (action.error && action.error.response && action.error.response.data) {
          try {
            const errorData = action.error.response.data;
            console.log('从错误响应中提取数据:', errorData);

            // 如果有笔记数据，添加到状态
            if (errorData.note || errorData.data) {
              const noteData = errorData.note || errorData.data;
              const note = {
                ...noteData,
                id: noteData.note_id || noteData.id || realmService.createObjectId(),
                is_offline: true,
                isOffline: true,
              };

              console.log('从错误中提取的笔记数据:', note);

              // 添加到状态
              notesAdapter.upsertOne(state, note);
            }
          } catch (extractError) {
            console.error('从错误中提取数据失败:', extractError);
          }
        }
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
  setNotes,
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

// 导出Actions
export const {
  addNote,
  addNotes,
  updateOneNote,
  updateNotes,
  deleteNotes,
  clearNotes,
  setLoading,
  setError,
  setSearchQuery,
  clearSearchQuery,
  setSortBy,
  setFilterBy,
  clearFilter,
  setSelectedNotes,
  clearSelectedNotes,
  toggleNoteSelection,
  deselectAllNotes,
  setImageUploadProgress,
  setImageUploadError,
  clearImageUploadState,
  setAutoSaveEnabled,
  setAutoSaveInterval,
  addHistoryEntry,
  clearHistory,
  setOfflineMode,
  setSyncStatus,
  addPendingSync,
  removePendingSync,
  clearPendingSync,
} = notesSlice.actions;

// 导出Reducer
export default notesSlice.reducer;
