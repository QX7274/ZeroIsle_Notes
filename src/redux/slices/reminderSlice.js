import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';
import { showMessage } from '../../utils/messageUtils';
import reminderNotificationService from '../../services/reminder/reminderNotificationService';

// 寮傛鎿嶄綔锛氬姞杞芥彁閱掍簨椤?
export const loadReminders = createAsyncThunk(
  'reminders/loadReminders',
  async (data, { rejectWithValue }) => {
    try {
      if (Array.isArray(data)) {
        // 鐩存帴浣跨敤浼犲叆鐨勬暟鎹紙鐢ㄤ簬绂荤嚎妯″紡锛?
        return data;
      } else {
        // 浠嶢PI鑾峰彇鏁版嵁
        const response = await api.get('/reminders/');
        return response.data;
      }
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: '加载提醒事项失败' });
    }
  }
);

// 寮傛鎿嶄綔锛氬悓姝ョ绾挎彁閱掍簨椤?
export const syncReminders = createAsyncThunk(
  'reminders/syncReminders',
  async (_, { dispatch, rejectWithValue }) => {
    try {
      const offlineOperations = await reminderNotificationService.getOfflineOperations();

      if (offlineOperations.length === 0) {
        return { synced: 0, failed: 0, remaining: 0 };
      }

      const syncResult = await reminderNotificationService.syncOfflineReminders();

      if (syncResult.synced > 0) {
        const response = await api.get('/reminders/');
        dispatch(loadReminders(response.data));
      }

      const remainingOperations = await reminderNotificationService.getOfflineOperations();
      return {
        synced: syncResult.synced || 0,
        failed: syncResult.failed || 0,
        remaining: remainingOperations.length,
      };
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: '同步提醒事项失败' });
    }
  }
);

// 寮傛鎿嶄綔锛氭坊鍔犳彁閱掍簨椤?
export const addReminder = createAsyncThunk(
  'reminders/addReminder',
  async (reminderData, { rejectWithValue }) => {
    try {
      const response = await api.post('/reminders/', reminderData);
      showMessage('提醒事项已添加');
      return response.data;
    } catch (error) {
      showMessage('添加提醒事项失败', 'error');
      return rejectWithValue(error.response?.data || { message: '添加提醒事项失败' });
    }
  }
);

// 寮傛鎿嶄綔锛氭洿鏂版彁閱掍簨椤?
export const updateReminder = createAsyncThunk(
  'reminders/updateReminder',
  async ({ id, reminderData }, { rejectWithValue }) => {
    try {
      const response = await api.put(`/reminders/${id}/`, reminderData);
      showMessage('提醒事项已更新');
      return response.data;
    } catch (error) {
      showMessage('更新提醒事项失败', 'error');
      return rejectWithValue(error.response?.data || { message: '更新提醒事项失败' });
    }
  }
);

// 寮傛鎿嶄綔锛氬垹闄ゆ彁閱掍簨椤?
export const deleteReminder = createAsyncThunk(
  'reminders/deleteReminder',
  async (id, { rejectWithValue }) => {
    try {
      await api.delete(`/reminders/${id}/`);
      showMessage('提醒事项已删除');
      return id;
    } catch (error) {
      showMessage('删除提醒事项失败', 'error');
      return rejectWithValue(error.response?.data || { message: '删除提醒事项失败' });
    }
  }
);

// 鍒涘缓鎻愰啋浜嬮」鍒囩墖
const reminderSlice = createSlice({
  name: 'reminders',
  initialState: {
    reminders: [],
    loading: false,
    error: null,
    offlineReminders: [], // 绂荤嚎鎻愰啋鍒楄〃
    syncStatus: {
      syncing: false,
      lastSynced: null,
      error: null,
      unsyncedCount: 0,
    },
    filters: {
      category: 'all',
      priority: 'all',
      startDate: null,
      endDate: null,
      tags: [],
    },
  },
  reducers: {
    // 娣诲姞鏈湴鎻愰啋浜嬮」锛堢绾挎ā寮忥級
    addLocalReminder: (state, action) => {
      const newReminder = {
        ...action.payload,
        id: action.payload?.id || `local-${Date.now()}`, // ????ID
        isLocal: true, // 鏍囪涓烘湰鍦板垱寤?
      };
      state.reminders = state.reminders.filter(reminder => reminder.id !== newReminder.id);
      state.reminders.push(newReminder);

      // 娣诲姞鍒扮绾挎彁閱掑垪琛?
      state.offlineReminders.push({
        id: newReminder.id,
        operation: 'create',
        data: newReminder,
        timestamp: Date.now(),
      });

      // 鏇存柊鏈悓姝ヨ鏁?
      state.syncStatus.unsyncedCount = state.offlineReminders.length;
    },

    // 鏇存柊鏈湴鎻愰啋浜嬮」锛堢绾挎ā寮忥級
    updateLocalReminder: (state, action) => {
      const { id, reminderData } = action.payload;
      const index = state.reminders.findIndex(reminder => reminder.id === id);
      if (index !== -1) {
        state.reminders[index] = { ...state.reminders[index], ...reminderData };

        // 娣诲姞鍒扮绾挎彁閱掑垪琛?
        state.offlineReminders.push({
          id: `update-${id}-${Date.now()}`,
          operation: 'update',
          data: { ...state.reminders[index] },
          timestamp: Date.now(),
        });

        // 鏇存柊鏈悓姝ヨ鏁?
        state.syncStatus.unsyncedCount = state.offlineReminders.length;
      }
    },

    // 鍒犻櫎鏈湴鎻愰啋浜嬮」锛堢绾挎ā寮忥級
    deleteLocalReminder: (state, action) => {
      const id = action.payload;
      const reminder = state.reminders.find(r => r.id === id);

      if (reminder) {
        // 浠庡垪琛ㄤ腑绉婚櫎
        state.reminders = state.reminders.filter(r => r.id !== id);

        // 娣诲姞鍒扮绾挎彁閱掑垪琛?
        state.offlineReminders.push({
          id: `delete-${id}-${Date.now()}`,
          operation: 'delete',
          data: { id },
          timestamp: Date.now(),
        });

        // 鏇存柊鏈悓姝ヨ鏁?
        state.syncStatus.unsyncedCount = state.offlineReminders.length;
      }
    },

    // 璁剧疆绛涢€夋潯浠?
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },

    // 閲嶇疆绛涢€夋潯浠?
    resetFilters: (state) => {
      state.filters = {
        category: 'all',
        priority: 'all',
        startDate: null,
        endDate: null,
        tags: [],
      };
    },

    // 娓呴櫎閿欒
    clearError: (state) => {
      state.error = null;
      state.syncStatus.error = null;
    },

    // 娓呴櫎绂荤嚎鎻愰啋
    clearOfflineReminders: (state) => {
      state.offlineReminders = [];
      state.syncStatus.unsyncedCount = 0;
    },
  },
  extraReducers: (builder) => {
    builder
      // 鍔犺浇鎻愰啋浜嬮」
      .addCase(loadReminders.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadReminders.fulfilled, (state, action) => {
        state.loading = false;
        const localReminders = state.reminders.filter(reminder => reminder.isLocal);
        const incomingReminders = Array.isArray(action.payload) ? action.payload : [];
        const incomingIds = new Set(incomingReminders.map(reminder => reminder.id));
        const preservedLocalReminders = localReminders.filter(reminder => !incomingIds.has(reminder.id));

        state.reminders = [...incomingReminders, ...preservedLocalReminders];
      })
      .addCase(loadReminders.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || { message: '加载提醒事项失败' };
      })

      // 娣诲姞鎻愰啋浜嬮」
      .addCase(addReminder.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(addReminder.fulfilled, (state, action) => {
        state.loading = false;
        state.reminders.push(action.payload);
      })
      .addCase(addReminder.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || { message: '添加提醒事项失败' };
      })

      // 鏇存柊鎻愰啋浜嬮」
      .addCase(updateReminder.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(updateReminder.fulfilled, (state, action) => {
        state.loading = false;
        const index = state.reminders.findIndex(reminder => reminder.id === action.payload.id);
        if (index !== -1) {
          state.reminders[index] = action.payload;
        }
      })
      .addCase(updateReminder.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || { message: '更新提醒事项失败' };
      })

      // 鍒犻櫎鎻愰啋浜嬮」
      .addCase(deleteReminder.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteReminder.fulfilled, (state, action) => {
        state.loading = false;
        state.reminders = state.reminders.filter(reminder => reminder.id !== action.payload);
      })
      .addCase(deleteReminder.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || { message: '删除提醒事项失败' };
      })

      // 鍚屾绂荤嚎鎻愰啋浜嬮」
      .addCase(syncReminders.pending, (state) => {
        state.syncStatus.syncing = true;
        state.syncStatus.error = null;
      })
      .addCase(syncReminders.fulfilled, (state, action) => {
        state.syncStatus.syncing = false;
        state.syncStatus.lastSynced = new Date().toISOString();
        state.syncStatus.unsyncedCount = action.payload.remaining ?? state.offlineReminders.length;

        if (action.payload.remaining === 0) {
          state.offlineReminders = [];
        }
      })
      .addCase(syncReminders.rejected, (state, action) => {
        state.syncStatus.syncing = false;
        state.syncStatus.error = action.payload || { message: '同步提醒事项失败' };
      });
  },
});
export const {
  addLocalReminder,
  updateLocalReminder,
  deleteLocalReminder,
  clearError,
  setFilters,
  resetFilters,
  clearOfflineReminders,
} = reminderSlice.actions;

export const selectReminders = (state) => state.reminders.reminders;
export const selectReminderLoading = (state) => state.reminders.loading;
export const selectReminderError = (state) => state.reminders.error;
export const selectOfflineReminders = (state) => state.reminders.offlineReminders;
export const selectSyncStatus = (state) => state.reminders.syncStatus;
export const selectFilters = (state) => state.reminders.filters;
export const selectUnsyncedCount = (state) => state.reminders.syncStatus.unsyncedCount;

// 瀵煎嚭reducer
export default reminderSlice.reducer;
