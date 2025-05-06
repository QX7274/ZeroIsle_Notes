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

// 异步action：手机号+验证码注册
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

// 异步action：用户名+密码注册
export const registerWithUsername = createAsyncThunk(
  'auth/registerWithUsername',
  async ({ username, password }, { rejectWithValue }) => {
    try {
      console.log('Redux: 开始用户名注册...');
      const response = await userApi.registerWithUsername({ username, password });
      console.log('Redux: 用户名注册响应:', response);

      if (!response || !response.success) {
        console.error('Redux: 注册失败:', response?.message || '未知错误');
        return rejectWithValue(response?.message || '注册失败');
      }

      const responseData = response.data;
      console.log('Redux: 处理注册响应数据:', responseData);

      if (!responseData) {
        console.error('Redux: 注册响应数据无效');
        return rejectWithValue('注册响应数据无效');
      }

      // 保存令牌和用户信息
      try {
        await storage.set('token', responseData.access || responseData.token);
        await storage.set('user', responseData.user);
        console.log('Redux: 保存令牌和用户信息成功');
      } catch (storageError) {
        console.error('Redux: 保存令牌和用户信息失败:', storageError);
        // 继续执行，不要因为存储错误而中断注册流程
      }

      return responseData;
    } catch (error) {
      console.error('Redux: 注册过程中发生错误:', error);
      return rejectWithValue(error.message || '注册失败');
    }
  }
);

// 异步action：手机号+密码注册
export const registerWithPhone = createAsyncThunk(
  'auth/registerWithPhone',
  async ({ phone, password }, { rejectWithValue }) => {
    try {
      const response = await userApi.registerWithPhone(phone, password);
      await storage.set('token', response.data.token);
      await storage.set('user', response.data.user);
      return response.data;
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

// 异步action：邮箱+密码注册
export const registerWithEmail = createAsyncThunk(
  'auth/registerWithEmail',
  async ({ email, password }, { rejectWithValue }) => {
    try {
      const response = await userApi.registerWithEmail(email, password);
      await storage.set('token', response.data.token);
      await storage.set('user', response.data.user);
      return response.data;
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
  refreshToken: null,
  loading: false,
  error: null,
  isAuthenticated: false
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    clearError: (state) => {
      state.error = null;
    },
    setUserInfo: (state, action) => {
      state.user = action.payload;
      state.isAuthenticated = !!state.token && !!state.user;
      console.log('Redux: setUserInfo action 已处理，用户信息已更新');
    },
    setAuthToken: (state, action) => {
      state.token = action.payload;
      state.isAuthenticated = !!state.token && !!state.user;
      console.log('Redux: setAuthToken action 已处理，令牌已更新');
    },
    setAuthRefreshToken: (state, action) => {
      state.refreshToken = action.payload;
      console.log('Redux: setAuthRefreshToken action 已处理，刷新令牌已更新');
    },
    setIsAuthenticated: (state, action) => {
      state.isAuthenticated = action.payload;
      console.log('Redux: setIsAuthenticated action 已处理，认证状态已更新为:', action.payload);
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
      // 手机号+验证码注册
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
      // 用户名+密码注册
      .addCase(registerWithUsername.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(registerWithUsername.fulfilled, (state, action) => {
        state.loading = false;
        console.log('Redux: registerWithUsername.fulfilled, payload:', action.payload);

        // 确保action.payload存在
        if (!action.payload) {
          console.error('Redux: registerWithUsername.fulfilled, 但payload为空');
          return;
        }

        // 设置用户信息
        state.user = action.payload.user;

        // 设置令牌，兼容不同的响应格式
        state.token = action.payload.access || action.payload.token;

        // 设置刷新令牌，如果存在
        if (action.payload.refresh) {
          state.refreshToken = action.payload.refresh;
        }

        // 设置认证状态
        state.isAuthenticated = true;

        console.log('Redux: 用户注册成功，状态已更新');
      })
      .addCase(registerWithUsername.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // 手机号+密码注册
      .addCase(registerWithPhone.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(registerWithPhone.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
      })
      .addCase(registerWithPhone.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // 邮箱+密码注册
      .addCase(registerWithEmail.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(registerWithEmail.fulfilled, (state, action) => {
        state.loading = false;
        state.user = action.payload.user;
        state.token = action.payload.token;
      })
      .addCase(registerWithEmail.rejected, (state, action) => {
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

export const {
  clearError,
  setUserInfo,
  setAuthToken,
  setAuthRefreshToken,
  setIsAuthenticated
} = authSlice.actions;
export default authSlice.reducer;
