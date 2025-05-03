import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';
import { showMessage } from '../../utils/messageUtils';
import reminderNotificationService from '../../services/reminderNotificationService';

// 异步操作：加载提醒事项
export const loadReminders = createAsyncThunk(
  'reminders/loadReminders',
  async (data, { rejectWithValue }) => {
    try {
      if (Array.isArray(data)) {
        // 直接使用传入的数据（用于离线模式）
        return data;
      } else {
        // 从API获取数据
        const response = await api.get('/reminders/');
        return response.data;
      }
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: '加载提醒事项失败' });
    }
  }
);

// 异步操作：同步离线提醒事项
export const syncReminders = createAsyncThunk(
  'reminders/syncReminders',
  async (_, { getState, dispatch, rejectWithValue }) => {
    try {
      const { reminders } = getState();
      const offlineReminders = reminders.offlineReminders || [];

      if (offlineReminders.length === 0) {
        return { synced: 0, failed: 0 };
      }

      let synced = 0;
      let failed = 0;

      // 同步每个离线提醒
      for (const reminder of offlineReminders) {
        try {
          // 根据操作类型执行不同的API请求
          if (reminder.operation === 'create') {
            const response = await api.post('/reminders/', reminder.data);
            // 更新本地存储
            await reminderNotificationService.removeOfflineReminder(reminder.id);
            synced++;
          } else if (reminder.operation === 'update') {
            const response = await api.put(`/reminders/${reminder.data.id}/`, reminder.data);
            // 更新本地存储
            await reminderNotificationService.removeOfflineReminder(reminder.id);
            synced++;
          } else if (reminder.operation === 'delete') {
            await api.delete(`/reminders/${reminder.data.id}/`);
            // 更新本地存储
            await reminderNotificationService.removeOfflineReminder(reminder.id);
            synced++;
          }
        } catch (error) {
          console.error(`同步提醒 ${reminder.id} 失败:`, error);
          failed++;
        }
      }

      // 同步完成后重新加载提醒列表
      if (synced > 0) {
        const response = await api.get('/reminders/');
        dispatch(loadReminders(response.data));
      }

      return { synced, failed };
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: '同步提醒事项失败' });
    }
  }
);

// 异步操作：添加提醒事项
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

// 异步操作：更新提醒事项
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

// 异步操作：删除提醒事项
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

// 创建提醒事项切片
const reminderSlice = createSlice({
  name: 'reminders',
  initialState: {
    reminders: [],
    loading: false,
    error: null,
    offlineReminders: [], // 离线提醒列表
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
    // 添加本地提醒事项（离线模式）
    addLocalReminder: (state, action) => {
      const newReminder = {
        ...action.payload,
        id: `local-${Date.now()}`, // 本地临时ID
        isLocal: true, // 标记为本地创建
      };
      state.reminders.push(newReminder);

      // 添加到离线提醒列表
      state.offlineReminders.push({
        id: newReminder.id,
        operation: 'create',
        data: newReminder,
        timestamp: Date.now(),
      });

      // 更新未同步计数
      state.syncStatus.unsyncedCount = state.offlineReminders.length;
    },

    // 更新本地提醒事项（离线模式）
    updateLocalReminder: (state, action) => {
      const { id, reminderData } = action.payload;
      const index = state.reminders.findIndex(reminder => reminder.id === id);
      if (index !== -1) {
        state.reminders[index] = { ...state.reminders[index], ...reminderData };

        // 添加到离线提醒列表
        state.offlineReminders.push({
          id: `update-${id}-${Date.now()}`,
          operation: 'update',
          data: { ...state.reminders[index] },
          timestamp: Date.now(),
        });

        // 更新未同步计数
        state.syncStatus.unsyncedCount = state.offlineReminders.length;
      }
    },

    // 删除本地提醒事项（离线模式）
    deleteLocalReminder: (state, action) => {
      const id = action.payload;
      const reminder = state.reminders.find(r => r.id === id);

      if (reminder) {
        // 从列表中移除
        state.reminders = state.reminders.filter(r => r.id !== id);

        // 添加到离线提醒列表
        state.offlineReminders.push({
          id: `delete-${id}-${Date.now()}`,
          operation: 'delete',
          data: { id },
          timestamp: Date.now(),
        });

        // 更新未同步计数
        state.syncStatus.unsyncedCount = state.offlineReminders.length;
      }
    },

    // 设置筛选条件
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },

    // 重置筛选条件
    resetFilters: (state) => {
      state.filters = {
        category: 'all',
        priority: 'all',
        startDate: null,
        endDate: null,
        tags: [],
      };
    },

    // 清除错误
    clearError: (state) => {
      state.error = null;
      state.syncStatus.error = null;
    },

    // 清除离线提醒
    clearOfflineReminders: (state) => {
      state.offlineReminders = [];
      state.syncStatus.unsyncedCount = 0;
    },
  },
  extraReducers: (builder) => {
    builder
      // 加载提醒事项
      .addCase(loadReminders.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadReminders.fulfilled, (state, action) => {
        state.loading = false;
        state.reminders = action.payload;
      })
      .addCase(loadReminders.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload || { message: '加载提醒事项失败' };
      })

      // 添加提醒事项
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

      // 更新提醒事项
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

      // 删除提醒事项
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

      // 同步离线提醒事项
      .addCase(syncReminders.pending, (state) => {
        state.syncStatus.syncing = true;
        state.syncStatus.error = null;
      })
      .addCase(syncReminders.fulfilled, (state, action) => {
        state.syncStatus.syncing = false;
        state.syncStatus.lastSynced = new Date().toISOString();

        // 如果所有提醒都同步成功，清空离线提醒列表
        if (action.payload.failed === 0 && action.payload.synced > 0) {
          state.offlineReminders = [];
          state.syncStatus.unsyncedCount = 0;
        } else if (action.payload.synced > 0) {
          // 如果有部分同步成功，更新未同步计数
          state.syncStatus.unsyncedCount = state.offlineReminders.length;
        }
      })
      .addCase(syncReminders.rejected, (state, action) => {
        state.syncStatus.syncing = false;
        state.syncStatus.error = action.payload || { message: '同步提醒事项失败' };
      });
  },
});

// 导出操作
export const {
  addLocalReminder,
  updateLocalReminder,
  deleteLocalReminder,
  clearError,
  setFilters,
  resetFilters,
  clearOfflineReminders
} = reminderSlice.actions;

// 导出选择器
export const selectReminders = (state) => state.reminders.reminders;
export const selectReminderLoading = (state) => state.reminders.loading;
export const selectReminderError = (state) => state.reminders.error;
export const selectOfflineReminders = (state) => state.reminders.offlineReminders;
export const selectSyncStatus = (state) => state.reminders.syncStatus;
export const selectFilters = (state) => state.reminders.filters;
export const selectUnsyncedCount = (state) => state.reminders.syncStatus.unsyncedCount;

// 导出reducer
export default reminderSlice.reducer;
