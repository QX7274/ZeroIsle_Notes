jest.mock('../../../services/api/index', () => ({
  userApi: {
    loginWithPassword: jest.fn(),
    logout: jest.fn(),
    getUserInfo: jest.fn(),
  },
}));

jest.mock('../../../services/api/authApi', () => ({
  __esModule: true,
  default: {
    login: jest.fn(),
    register: jest.fn(),
    registerWithUsername: jest.fn(),
    registerWithEmail: jest.fn(),
    registerWithPhone: jest.fn(),
    refreshToken: jest.fn(),
    getProfile: jest.fn(),
    updateProfile: jest.fn(),
    changePassword: jest.fn(),
    resetPassword: jest.fn(),
    sendVerificationCode: jest.fn(),
    loginWithCode: jest.fn(),
    wechatLogin: jest.fn(),
    qqLogin: jest.fn(),
    bindEmail: jest.fn(),
    bindPhone: jest.fn(),
    bindWechat: jest.fn(),
    bindQQ: jest.fn(),
    unbindWechat: jest.fn(),
    unbindQQ: jest.fn(),
    logout: jest.fn(),
  },
}));

jest.mock('../../../utils', () => ({
  storage: {
    set: jest.fn(),
    remove: jest.fn(),
  },
}));

jest.mock('../../../services/auth/tokenService', () => ({
  __esModule: true,
  default: {
    clearTokens: jest.fn(),
    isAccessTokenExpiredOrExpiring: jest.fn(),
    refreshAccessToken: jest.fn(),
    saveAccessToken: jest.fn(),
    saveRefreshToken: jest.fn(),
  },
}));

jest.mock('../../../services/auth/authUtils', () => ({
  __esModule: true,
  default: {
    getAuthInfo: jest.fn(),
  },
}));

jest.mock('../../../services/auth/authStorage', () => ({
  __esModule: true,
  default: {
    saveUser: jest.fn(),
    saveToken: jest.fn(),
  },
}));

jest.mock('../../../services/auth/devSessionRestore', () => ({
  __esModule: true,
  default: jest.fn().mockResolvedValue(null),
}));

jest.mock('../../../navigation/navigationRef', () => ({
  navigate: jest.fn(),
  navigationRef: { current: null },
}));

import authReducer, {
  checkAuthState,
  logout,
  setAuthToken,
  setIsAuthenticated,
  setUserInfo,
} from '../authSlice';
import { userApi } from '../../../services/api/index';
import tokenService from '../../../services/auth/tokenService';
import authUtils from '../../../services/auth/authUtils';
import authStorage from '../../../services/auth/authStorage';

describe('authSlice', () => {
  const initialState = {
    user: null,
    token: null,
    refreshToken: null,
    loading: false,
    error: null,
    isAuthenticated: false,
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return initial state', () => {
    expect(authReducer(undefined, { type: 'unknown' })).toEqual(initialState);
  });

  describe('reducers', () => {
    it('setUserInfo should update user', () => {
      const user = { id: 1, name: 'Test' };
      const nextState = authReducer(initialState, setUserInfo(user));
      expect(nextState.user).toEqual(user);
    });

    it('setAuthToken should update token', () => {
      const token = 'xyz';
      const nextState = authReducer(initialState, setAuthToken(token));
      expect(nextState.token).toEqual(token);
    });

    it('setIsAuthenticated should update status', () => {
      const nextState = authReducer(initialState, setIsAuthenticated(true));
      expect(nextState.isAuthenticated).toBe(true);
    });
  });

  describe('extra reducers', () => {
    it('logout.fulfilled should reset state', () => {
      const loggedIn = { ...initialState, isAuthenticated: true, user: {} };
      const nextState = authReducer(loggedIn, { type: logout.fulfilled.type });
      expect(nextState.isAuthenticated).toBe(false);
      expect(nextState.user).toBeNull();
    });
  });

  describe('checkAuthState', () => {
    it('should prefer real token over dev fallback', async () => {
      const realUser = { id: 'u1', nickname: '真实用户' };
      authUtils.getAuthInfo
        .mockResolvedValueOnce({ token: 'real-token', refreshToken: 'real-refresh', user: realUser });
      tokenService.isAccessTokenExpiredOrExpiring.mockResolvedValue(false);

      const dispatch = jest.fn();
      const thunk = checkAuthState();
      const result = await thunk(dispatch, () => ({}), undefined);

      expect(result.type).toBe('auth/checkAuthState/fulfilled');
      expect(result.payload).toEqual({
        user: realUser,
        token: 'real-token',
        refreshToken: 'real-refresh',
      });
      expect(tokenService.saveAccessToken).not.toHaveBeenCalled();
      expect(tokenService.saveRefreshToken).not.toHaveBeenCalled();
      expect(authStorage.saveUser).not.toHaveBeenCalled();
      expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
        type: 'auth/setIsAuthenticated',
        payload: true,
      }));
    });

    it('should restore profile when token exists but user is missing', async () => {
      const profileUser = { id: 'u2', nickname: '补回资料用户' };
      authUtils.getAuthInfo.mockResolvedValue({
        token: 'real-token',
        refreshToken: 'real-refresh',
        user: null,
      });
      tokenService.isAccessTokenExpiredOrExpiring.mockResolvedValue(false);
      userApi.getUserInfo.mockResolvedValue({
        success: true,
        data: profileUser,
      });

      const dispatch = jest.fn();
      const thunk = checkAuthState();
      const result = await thunk(dispatch, () => ({}), undefined);

      expect(result.type).toBe('auth/checkAuthState/fulfilled');
      expect(result.payload).toEqual({
        user: profileUser,
        token: 'real-token',
        refreshToken: 'real-refresh',
      });
      expect(userApi.getUserInfo).toHaveBeenCalledTimes(1);
      expect(authStorage.saveUser).toHaveBeenCalledWith(profileUser);
    });

    it('should clear dev placeholder token and stay unauthenticated when skip login is disabled', async () => {
      authUtils.getAuthInfo.mockResolvedValue({
        token: 'dev-token-123456',
        refreshToken: 'dev-token-123456',
        user: { id: 'dev-user-001', nickname: '开发者' },
      });

      const dispatch = jest.fn();
      const thunk = checkAuthState();
      const result = await thunk(dispatch, () => ({}), undefined);

      expect(result.type).toBe('auth/checkAuthState/fulfilled');
      expect(result.payload).toBeNull();
      expect(tokenService.clearTokens).toHaveBeenCalled();
      expect(tokenService.saveAccessToken).not.toHaveBeenCalled();
      expect(tokenService.saveRefreshToken).not.toHaveBeenCalled();
      expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({
        type: 'auth/setIsAuthenticated',
        payload: false,
      }));
    });
  });
});
