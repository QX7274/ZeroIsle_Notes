/**
 * 认证状态管理Slice
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { userApi } from '../../services/api';
import { storage } from '../../utils';

// 异步action：发送验证码
export const sendVerificationCode = createAsyncThunk(
  'auth/sendVerificationCode',
  async (phone, { rejectWithValue }) => {
    try {
      await userApi.sendVerificationCode(phone);
      return { phone };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// 异步action：手机号+验证码登录
export const loginWithCode = createAsyncThunk(
  'auth/loginWithCode',
  async ({ phone, code }, { rejectWithValue }) => {
    try {
      const response = await userApi.loginWithCode({ phone, code });
      await storage.set('token', response.token);
      await storage.set('user', response.user);
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// 异步action：手机号+密码登录
export const loginWithPassword = createAsyncThunk(
  'auth/loginWithPassword',
  async ({ phone, password }, { rejectWithValue }) => {
    try {
      const response = await userApi.loginWithPassword({ phone, password });
      await storage.set('token', response.token);
      await storage.set('user', response.user);
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// 异步action：微信登录
export const loginWithWeChat = createAsyncThunk(
  'auth/loginWithWeChat',
  async (_, { rejectWithValue }) => {
    try {
      const response = await userApi.loginWithWeChat();
      await storage.set('token', response.token);
      await storage.set('user', response.user);
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// 异步action：QQ登录
export const loginWithQQ = createAsyncThunk(
  'auth/loginWithQQ',
  async (_, { rejectWithValue }) => {
    try {
      const response = await userApi.loginWithQQ();
      await storage.set('token', response.token);
      await storage.set('user', response.user);
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// 异步action：注册
export const register = createAsyncThunk(
  'auth/register',
  async ({ phone, code, password }, { rejectWithValue }) => {
    try {
      const response = await userApi.register({ phone, code, password });
      await storage.set('token', response.token);
      await storage.set('user', response.user);
      return response;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// 异步action：登出
export const logout = createAsyncThunk(
  'auth/logout',
  async (_, { rejectWithValue }) => {
    try {
      await storage.remove('token');
      await storage.remove('user');
      return null;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// 异步action：检查认证状态
export const checkAuthState = createAsyncThunk(
  'auth/checkAuthState',
  async (_, { rejectWithValue }) => {
    try {
      const token = await storage.get('token');
      if (!token) return null;
      
      const user = await storage.get('user');
      return { user, token };
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

const initialState = {
  user: null,
  token: null,
  loading: false,
  error: null
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    }
  },
  extraReducers: (builder) => {
    builder
      // 检查认证状态
      .addCase(checkAuthState.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(checkAuthState.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload) {
          state.user = action.payload.user;
          state.token = action.payload.token;
        }
      })
      .addCase(checkAuthState.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // 发送验证码
      .addCase(sendVerificationCode.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(sendVerificationCode.fulfilled, (state) => {
        state.loading = false;
      })
      .addCase(sendVerificationCode.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // 手机号+验证码登录
      .addCase(loginWithCode.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginWithCode.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
      })
      .addCase(loginWithCode.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // 手机号+密码登录
      .addCase(loginWithPassword.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginWithPassword.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
      })
      .addCase(loginWithPassword.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // 微信登录
      .addCase(loginWithWeChat.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginWithWeChat.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
      })
      .addCase(loginWithWeChat.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // QQ登录
      .addCase(loginWithQQ.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loginWithQQ.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
      })
      .addCase(loginWithQQ.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // 注册
      .addCase(register.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(register.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
      })
      .addCase(register.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // 登出
      .addCase(logout.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(logout.fulfilled, (state) => {
        state.loading = false;
        state.user = null;
        state.token = null;
      })
      .addCase(logout.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  }
});

export const { clearError } = authSlice.actions;
export default authSlice.reducer;