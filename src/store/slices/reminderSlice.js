import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api from '../../services/api';
import { showMessage } from '../../utils/messageUtils';

// 异步操作：加载提醒事项
export const loadReminders = createAsyncThunk(
  'reminders/loadReminders',
  async (_, { rejectWithValue }) => {
    try {
      const response = await api.get('/reminders/');
      return response.data;
    } catch (error) {
      return rejectWithValue(error.response?.data || { message: '加载提醒事项失败' });
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
    },
    // 更新本地提醒事项（离线模式）
    updateLocalReminder: (state, action) => {
      const { id, reminderData } = action.payload;
      const index = state.reminders.findIndex(reminder => reminder.id === id);
      if (index !== -1) {
        state.reminders[index] = { ...state.reminders[index], ...reminderData };
      }
    },
    // 删除本地提醒事项（离线模式）
    deleteLocalReminder: (state, action) => {
      state.reminders = state.reminders.filter(reminder => reminder.id !== action.payload);
    },
    // 清除错误
    clearError: (state) => {
      state.error = null;
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
      });
  },
});

// 导出操作
export const { addLocalReminder, updateLocalReminder, deleteLocalReminder, clearError } = reminderSlice.actions;

// 导出选择器
export const selectReminders = (state) => state.reminders.reminders;
export const selectReminderLoading = (state) => state.reminders.loading;
export const selectReminderError = (state) => state.reminders.error;

// 导出reducer
export default reminderSlice.reducer;
