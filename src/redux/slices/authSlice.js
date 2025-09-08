/**
 * 认证状态管理Slice
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { userApi } from '../../services/api';
import { storage } from '../../utils';
import { Platform } from 'react-native';
import { navigate, navigationRef } from '../../navigation/navigationRef';
import tokenService from '../../services/auth/tokenService';
import authUtils from '../../services/auth/authUtils';
import authStorage from '../../services/auth/authStorage';

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
  async (_, { rejectWithValue, dispatch }) => {
    try {
      console.log('开始登出流程...');

      // 1. 首先清除本地存储中的认证信息
      try {
        await storage.remove('token');
        await storage.remove('user');
        console.log('本地存储中的认证信息已清除');
      } catch (storageError) {
        console.error('清除本地存储中的认证信息失败:', storageError);
        // 继续执行，不阻止登出流程
      }

      // 2. 确保Redux状态被正确更新 - 直接分发action而不是等待异步操作完成
      try {
        dispatch({ type: 'auth/logout/fulfilled' });
        console.log('Redux状态已更新，用户已登出');
      } catch (reduxError) {
        console.error('更新Redux状态失败:', reduxError);
        // 继续执行，不阻止登出流程
      }

      // 3. 使用setTimeout确保Redux状态更新后再尝试导航
      setTimeout(() => {
        try {
          console.log('尝试导航到登录页面...');

          // 导入导航模块
          const navigation = require('../navigation/navigationRef');

          // 尝试使用导航辅助函数
          if (navigation && typeof navigation.reset === 'function') {
            console.log('使用navigation.reset导航到Auth页面');
            navigation.reset({
              index: 0,
              routes: [{ name: 'Auth' }]
            });
            return;
          }

          // 如果导航辅助函数不可用，尝试使用navigationRef
          if (navigationRef && navigationRef.current) {
            console.log('使用navigationRef.current导航到Auth页面');

            // 尝试使用CommonActions.reset
            try {
              const { CommonActions } = require('@react-navigation/native');
              navigationRef.current.dispatch(
                CommonActions.reset({
                  index: 0,
                  routes: [{ name: 'Auth' }]
                })
              );
              return;
            } catch (resetError) {
              console.error('使用CommonActions.reset失败:', resetError);

              // 尝试使用navigate方法
              try {
                navigationRef.current.navigate('Auth');
                return;
              } catch (navigateError) {
                console.error('使用navigate方法失败:', navigateError);

                // 尝试使用dispatch方法
                try {
                  navigationRef.current.dispatch({
                    type: 'NAVIGATE',
                    payload: {
                      name: 'Auth',
                      params: {},
                    },
                  });
                  return;
                } catch (dispatchError) {
                  console.error('使用dispatch方法失败:', dispatchError);
                }
              }
            }
          } else {
            console.warn('navigationRef.current不存在，无法使用导航方法');
          }

          // 如果所有导航方法都失败，尝试强制刷新应用
          console.log('所有导航方法都失败，尝试强制刷新应用...');

          // 导入Platform
          const { Platform } = require('react-native');

          // 在Web平台上强制刷新页面
          if (Platform && Platform.OS === 'web') {
            console.log('在Web平台上强制刷新页面');
            window.location.reload();
          } else {
            console.log('非Web平台，无法强制刷新页面');
            // 在移动平台上，可以考虑使用其他方法重新加载应用
            // 例如，使用DevSettings.reload()（仅在开发模式下可用）
            try {
              const DevSettings = require('react-native').DevSettings;
              if (DevSettings && DevSettings.reload) {
                DevSettings.reload();
              }
            } catch (devSettingsError) {
              console.error('使用DevSettings.reload失败:', devSettingsError);
            }
          }
        } catch (navigationError) {
          console.error('导航过程中发生错误:', navigationError);
        }
      }, 300); // 增加延迟时间，确保Redux状态更新完成

      return null;
    } catch (error) {
      console.error('登出过程中发生错误:', error);
      return rejectWithValue(error.message);
    }
  }
);


// 异步action：检查认证状态
export const checkAuthState = createAsyncThunk(
  'auth/checkAuthState',
  async (_, { rejectWithValue, dispatch }) => {
    try {
      console.log('Redux: 检查认证状态...');

      // 检查开发模式 - 直接使用内联配置避免导入问题
      const DEV_CONFIG = {
        SKIP_LOGIN: __DEV__ && true,
        DEFAULT_USER: {
          id: 'dev-user-001',
          username: 'developer',
          email: 'dev@zeroislenotes.com',
          nickname: '开发者',
          avatar: null,
          isAnonymous: false,
          isDeveloper: true,
          createdAt: new Date().toISOString(),
        },
        DEFAULT_TOKEN: 'dev-token-' + Date.now(),
      };

      if (DEV_CONFIG && DEV_CONFIG.SKIP_LOGIN) {
        console.log('Redux: 开发模式 - 跳过认证检查，自动设置为已认证');

        // 设置开发模式的用户和令牌
        const devUser = DEV_CONFIG.DEFAULT_USER;
        const devToken = DEV_CONFIG.DEFAULT_TOKEN;

        // 保存到本地存储
        try {
          await authStorage.saveUser(devUser);
          await tokenService.saveAccessToken(devToken);
          await tokenService.saveRefreshToken(devToken);
          console.log('Redux: 开发模式 - 已保存默认用户和令牌');
        } catch (saveError) {
          console.warn('Redux: 开发模式 - 保存用户信息失败:', saveError);
        }

        // 设置Redux状态
        dispatch({ type: 'auth/setIsAuthenticated', payload: true });
        dispatch({ type: 'auth/setUserInfo', payload: devUser });
        dispatch({ type: 'auth/setAuthToken', payload: devToken });

        return { user: devUser, token: devToken, refreshToken: devToken };
      }

      // 使用统一的认证信息获取函数
      const { token, refreshToken, user } = await authUtils.getAuthInfo();

      // 如果没有令牌，返回null
      if (!token) {
        console.log('Redux: 未找到访问令牌，用户未认证');

        // 确保清除认证状态
        await tokenService.clearTokens();

        // 确保Redux状态一致
        dispatch({ type: 'auth/setIsAuthenticated', payload: false });
        dispatch({ type: 'auth/setUserInfo', payload: null });
        dispatch({ type: 'auth/setAuthToken', payload: null });

        return null;
      }

      // 检查令牌是否过期
      const isTokenExpired = await tokenService.isAccessTokenExpiredOrExpiring();

      if (isTokenExpired && refreshToken) {
        console.log('Redux: 访问令牌已过期或即将过期，尝试刷新...');

        // 尝试刷新令牌
        const newTokenData = await tokenService.refreshAccessToken();

        if (newTokenData) {
          console.log('Redux: 令牌刷新成功');
          // 获取最新的认证信息
          const { token: newToken, user: newUser } = await authUtils.getAuthInfo();

          // 确保Redux状态一致
          dispatch({ type: 'auth/setIsAuthenticated', payload: true });
          dispatch({ type: 'auth/setUserInfo', payload: newUser });
          dispatch({ type: 'auth/setAuthToken', payload: newToken });

          return { user: newUser, token: newToken, refreshToken };
        } else {
          console.log('Redux: 刷新令牌失败，用户未认证');

          // 确保清除认证状态
          await tokenService.clearTokens();

          // 确保Redux状态一致
          dispatch({ type: 'auth/setIsAuthenticated', payload: false });
          dispatch({ type: 'auth/setUserInfo', payload: null });
          dispatch({ type: 'auth/setAuthToken', payload: null });

          return null;
        }
      }

      console.log('Redux: 用户已认证');

      // 确保Redux状态一致
      dispatch({ type: 'auth/setIsAuthenticated', payload: true });
      dispatch({ type: 'auth/setUserInfo', payload: user });
      dispatch({ type: 'auth/setAuthToken', payload: token });

      return { user, token, refreshToken };
    } catch (error) {
      console.error('Redux: 检查认证状态失败:', error);

      // 出错时确保清除认证状态
      try {
        await tokenService.clearTokens();
      } catch (clearError) {
        console.error('Redux: 清除令牌失败:', clearError);
      }

      return rejectWithValue(error.message);
    }
  }
);

// 开发者模式相关action
export const enableDevMode = createAsyncThunk(
  'auth/enableDevMode',
  async (_, { dispatch }) => {
    try {
      const devModeService = require('../../services/auth/devModeService').default;
      const success = await devModeService.enableDevMode();
      
      if (success) {
        const devAccount = devModeService.getDevAccount();
        if (devAccount) {
          dispatch({ type: 'auth/setIsAuthenticated', payload: true });
          dispatch({ type: 'auth/setUserInfo', payload: devAccount });
          dispatch({ type: 'auth/setIsDevMode', payload: true });
          dispatch({ type: 'auth/setAuthMethod', payload: 'dev_mode' });
          
          console.log('Redux: 开发者模式已启用');
          return { success: true, user: devAccount };
        }
      }
      
      throw new Error('启用开发者模式失败');
    } catch (error) {
      console.error('启用开发者模式失败:', error);
      throw error;
    }
  }
);

export const disableDevMode = createAsyncThunk(
  'auth/disableDevMode',
  async (_, { dispatch }) => {
    try {
      const devModeService = require('../../services/auth/devModeService').default;
      const success = await devModeService.disableDevMode();
      
      if (success) {
        dispatch({ type: 'auth/setIsAuthenticated', payload: false });
        dispatch({ type: 'auth/setUserInfo', payload: null });
        dispatch({ type: 'auth/setIsDevMode', payload: false });
        dispatch({ type: 'auth/setAuthMethod', payload: null });
        
        console.log('Redux: 开发者模式已禁用');
        return { success: true };
      }
      
      throw new Error('禁用开发者模式失败');
    } catch (error) {
      console.error('禁用开发者模式失败:', error);
      throw error;
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
          state.refreshToken = action.payload.refreshToken;
          state.isAuthenticated = !!action.payload.token && !!action.payload.user;
          console.log('Redux: 认证状态已更新，isAuthenticated:', state.isAuthenticated);
        } else {
          // 如果payload为null，清除认证状态
          state.user = null;
          state.token = null;
          state.refreshToken = null;
          state.isAuthenticated = false;
          console.log('Redux: 认证状态已清除');
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
        state.refreshToken = null;
        state.isAuthenticated = false;
        console.log('Redux: 用户已登出，认证状态已重置');
      })
      .addCase(logout.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      })
      // 临时用户功能已移除
  }
});

export const {
  clearError,
  setUserInfo,
  setAuthToken,
  setAuthRefreshToken,
  setIsAuthenticated
} = authSlice.actions;

// 注意：异步action已经通过createAsyncThunk自动导出，不需要重复导出

export default authSlice.reducer;
