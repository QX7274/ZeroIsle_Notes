/**
 * 认证状态切片
 */
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import authApi from '../../services/api/authApi';
import { setToken, setRefreshToken, setUser, clearAuth } from '../../services/storage';

// 初始状态
const initialState = {
  user: null,
  token: null,
  refreshToken: null,
  isAuthenticated: false,
  isLoading: false,
  error: null,
};

// 异步操作：登录
export const login = createAsyncThunk(
  'auth/login',
  async (credentials, { rejectWithValue }) => {
    try {
      // 确保credentials对象存在且格式正确
      if (!credentials || typeof credentials !== 'object') {
        return rejectWithValue('登录信息不完整，请重试');
      }

      const result = await authApi.login(credentials);
      if (result && result.success) {
        return result.data;
      }
      return rejectWithValue(result?.message || '登录失败，请检查用户名和密码');
    } catch (error) {
      console.error('登录错误:', error);
      return rejectWithValue(error?.message || '登录失败，请稍后重试');
    }
  }
);

// 异步操作：注册
export const register = createAsyncThunk(
  'auth/register',
  async (userData, { rejectWithValue }) => {
    try {
      const result = await authApi.register(userData);
      if (result.success) {
        // 确保token是字符串
        const token = String(result.data.token);
        const refreshToken = String(result.data.refreshToken);
        
        // 保存token和用户信息
        await setToken(token);
        await setRefreshToken(refreshToken);
        await setUser(result.data.user);
        
        return {
          token,
          refreshToken,
          user: result.data.user
        };
      }
      return rejectWithValue(result.message || '注册失败');
    } catch (error) {
      return rejectWithValue(error.message || '注册失败');
    }
  }
);

// 异步操作：获取用户资料
export const getProfile = createAsyncThunk(
  'auth/getProfile',
  async (_, { rejectWithValue }) => {
    try {
      const result = await authApi.getProfile();
      if (result.success) {
        return result.data;
      }
      return rejectWithValue(result.message || '获取用户资料失败');
    } catch (error) {
      return rejectWithValue(error.message || '获取用户资料失败');
    }
  }
);

// 异步操作：更新用户资料
export const updateProfile = createAsyncThunk(
  'auth/updateProfile',
  async (profileData, { rejectWithValue }) => {
    try {
      const result = await authApi.updateProfile(profileData);
      if (result.success) {
        return result.data;
      }
      return rejectWithValue(result.message || '更新用户资料失败');
    } catch (error) {
      return rejectWithValue(error.message || '更新用户资料失败');
    }
  }
);

// 异步操作：登出
export const logout = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      const result = await authApi.logout();
      if (result.success) {
        return result.data;
      }
      return rejectWithValue(result.message || '登出失败');
    } catch (error) {
      return rejectWithValue(error.message || '登出失败');
    }
  }
);

// 创建切片
const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    // 设置用户信息
    setUserInfo: (state, action) => {
      state.user = action.payload;
      state.isAuthenticated = !!action.payload;
    },
    // 设置令牌
    setAuthToken: (state, action) => {
      state.token = action.payload;
    },
    // 设置刷新令牌
    setAuthRefreshToken: (state, action) => {
      state.refreshToken = action.payload;
    },
    // 清除认证状态
    clearAuthState: (state) => {
      state.user = null;
      state.token = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
      state.error = null;
    },
    // 清除错误
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // 登录
    builder
      .addCase(login.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(login.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload.user;
        state.token = action.payload.access;
        state.refreshToken = action.payload.refresh;
        state.isAuthenticated = true;
      })
      .addCase(login.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || '登录失败';
      });

    // 注册
    builder
      .addCase(register.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(register.fulfilled, (state) => {
        state.isLoading = false;
      })
      .addCase(register.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || '注册失败';
      });

    // 获取用户资料
    builder
      .addCase(getProfile.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(getProfile.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload;
        state.isAuthenticated = true;
      })
      .addCase(getProfile.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || '获取用户资料失败';
      });

    // 更新用户资料
    builder
      .addCase(updateProfile.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(updateProfile.fulfilled, (state, action) => {
        state.isLoading = false;
        state.user = action.payload;
      })
      .addCase(updateProfile.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || '更新用户资料失败';
      });

    // 登出
    builder
      .addCase(logout.pending, (state) => {
        state.isLoading = true;
      })
      .addCase(logout.fulfilled, (state) => {
        state.isLoading = false;
        state.user = null;
        state.token = null;
        state.refreshToken = null;
        state.isAuthenticated = false;
      })
      .addCase(logout.rejected, (state) => {
        state.isLoading = false;
        state.user = null;
        state.token = null;
        state.refreshToken = null;
        state.isAuthenticated = false;
      });
  },
});

// 导出操作
export const {
  setUserInfo,
  setAuthToken,
  setAuthRefreshToken,
  clearAuthState,
  clearError,
} = authSlice.actions;

// 导出选择器
export const selectUser = (state) => state.auth.user;
export const selectToken = (state) => state.auth.token;
export const selectRefreshToken = (state) => state.auth.refreshToken;
export const selectIsAuthenticated = (state) => state.auth.isAuthenticated;
export const selectIsLoading = (state) => state.auth.isLoading;
export const selectError = (state) => state.auth.error;

// 导出切片
export default authSlice.reducer;
