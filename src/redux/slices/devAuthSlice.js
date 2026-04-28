import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import devModeService from '../../services/auth/devModeService';

/**
 * 开发者模式认证状态管理
 * 与正常认证系统完全分离，不影响令牌管理
 */

// 启用开发者模式
export const enableDevMode = createAsyncThunk(
  'devAuth/enableDevMode',
  async (_, { rejectWithValue }) => {
    try {
      const success = await devModeService.enableDevMode();

      if (success) {
        const devAccount = devModeService.getDevAccount();
        if (devAccount) {
          console.log('开发者模式已启用:', devAccount.username);
          return { success: true, user: devAccount };
        }
      }

      throw new Error('启用开发者模式失败');
    } catch (error) {
      console.error('启用开发者模式失败:', error);
      return rejectWithValue(error.message);
    }
  }
);

// 禁用开发者模式
export const disableDevMode = createAsyncThunk(
  'devAuth/disableDevMode',
  async (_, { rejectWithValue }) => {
    try {
      const success = await devModeService.disableDevMode();

      if (success) {
        console.log('开发者模式已禁用');
        return { success: true };
      }

      throw new Error('禁用开发者模式失败');
    } catch (error) {
      console.error('禁用开发者模式失败:', error);
      return rejectWithValue(error.message);
    }
  }
);

// 检查开发者模式状态
export const checkDevModeStatus = createAsyncThunk(
  'devAuth/checkDevModeStatus',
  async (_, { rejectWithValue }) => {
    try {
      const status = devModeService.getDevModeStatus();
      const devAccount = devModeService.getDevAccount();

      return { status, devAccount };
    } catch (error) {
      console.error('检查开发者模式状态失败:', error);
      return rejectWithValue(error.message);
    }
  }
);

const initialState = {
  isDevMode: false,
  devAccount: null,
  devModeStatus: null,
  isLoading: false,
  error: null,
  lastCheck: null,
  features: {
    skipLoginScreen: false,
    autoFillTestData: false,
    showDebugInfo: false,
    enablePerformanceMonitor: false,
  },
};

const devAuthSlice = createSlice({
  name: 'devAuth',
  initialState,
  reducers: {
    // 设置开发者模式状态
    setDevMode: (state, action) => {
      state.isDevMode = action.payload;
    },

    // 设置开发者账户
    setDevAccount: (state, action) => {
      state.devAccount = action.payload;
    },

    // 设置开发者模式特性
    setDevFeatures: (state, action) => {
      state.features = { ...state.features, ...action.payload };
    },

    // 清除开发者模式状态
    clearDevMode: (state) => {
      state.isDevMode = false;
      state.devAccount = null;
      state.devModeStatus = null;
      state.features = initialState.features;
    },

    // 设置错误
    setError: (state, action) => {
      state.error = action.payload;
    },

    // 清除错误
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // 启用开发者模式
      .addCase(enableDevMode.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(enableDevMode.fulfilled, (state, action) => {
        state.isLoading = false;
        state.isDevMode = true;
        state.devAccount = action.payload.user;
        state.lastCheck = Date.now();

        // 更新特性状态
        if (action.payload.user) {
          state.features = {
            skipLoginScreen: true,
            autoFillTestData: true,
            showDebugInfo: true,
            enablePerformanceMonitor: true,
          };
        }
      })
      .addCase(enableDevMode.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // 禁用开发者模式
      .addCase(disableDevMode.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(disableDevMode.fulfilled, (state) => {
        state.isLoading = false;
        state.isDevMode = false;
        state.devAccount = null;
        state.devModeStatus = null;
        state.features = initialState.features;
      })
      .addCase(disableDevMode.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      })

      // 检查开发者模式状态
      .addCase(checkDevModeStatus.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(checkDevModeStatus.fulfilled, (state, action) => {
        state.isLoading = false;
        state.devModeStatus = action.payload.status;
        state.devAccount = action.payload.devAccount;
        state.isDevMode = action.payload.devAccount !== null;
        state.lastCheck = Date.now();
      })
      .addCase(checkDevModeStatus.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload;
      });
  },
});

// 导出actions
export const {
  setDevMode,
  setDevAccount,
  setDevFeatures,
  clearDevMode,
  setError,
  clearError,
} = devAuthSlice.actions;

// 导出selectors
export const selectDevMode = (state) => state.devAuth.isDevMode;
export const selectDevAccount = (state) => state.devAuth.devAccount;
export const selectDevModeStatus = (state) => state.devAuth.devModeStatus;
export const selectDevFeatures = (state) => state.devAuth.features;
export const selectDevAuthLoading = (state) => state.devAuth.isLoading;
export const selectDevAuthError = (state) => state.devAuth.error;

// 导出reducer
export default devAuthSlice.reducer;
