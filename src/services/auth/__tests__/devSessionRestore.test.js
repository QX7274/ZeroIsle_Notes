jest.mock('../tokenService', () => ({
  __esModule: true,
  default: {
    getAccessToken: jest.fn(),
    getRefreshToken: jest.fn(),
  },
}));

jest.mock('../authStorage', () => ({
  __esModule: true,
  default: {
    getUser: jest.fn(),
  },
}));

jest.mock('../authUtils', () => ({
  __esModule: true,
  saveAuthInfo: jest.fn(),
}));

jest.mock('../../api/authApi', () => ({
  __esModule: true,
  default: {
    sendVerificationCode: jest.fn(),
    loginWithCode: jest.fn(),
  },
}));

jest.mock('../../../config', () => ({
  API_URL: 'http://127.0.0.1:8001',
  API_VERSION: 'v1',
  DEV_MODE_CONFIG: {
    ENABLED: true,
    FEATURES: {
      SKIP_LOGIN_SCREEN: false,
    },
  },
}));

describe('devSessionRestore', () => {
  let tryRestoreDevSession;
  let tokenService;
  let authStorage;
  let authApi;
  let saveAuthInfo;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    global.__DEV__ = true;
    global.fetch = jest.fn();

    tokenService = require('../tokenService').default;
    authStorage = require('../authStorage').default;
    authApi = require('../../api/authApi').default;
    ({ saveAuthInfo } = require('../authUtils'));
    ({ tryRestoreDevSession } = require('../devSessionRestore'));
  });

  it('默认优先复用本地有效 token', async () => {
    tokenService.getAccessToken.mockResolvedValue({ token: 'cached_access' });
    tokenService.getRefreshToken.mockResolvedValue({ token: 'cached_refresh' });
    authStorage.getUser.mockResolvedValue({ id: 'user-1' });

    const result = await tryRestoreDevSession();

    expect(result).toEqual({
      token: 'cached_access',
      refreshToken: 'cached_refresh',
      user: { id: 'user-1' },
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it('forceRefresh 时跳过旧 token，直接重新直登', async () => {
    tokenService.getAccessToken.mockResolvedValue({ token: 'stale_access' });
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        access: 'fresh_access',
        refresh: 'fresh_refresh',
        user: { id: 'user-2' },
      }),
    });

    const result = await tryRestoreDevSession({ forceRefresh: true });

    expect(global.fetch).toHaveBeenCalledWith(
      'http://127.0.0.1:8001/api/v1/auth/login/',
      expect.objectContaining({
        method: 'POST',
      })
    );
    expect(saveAuthInfo).toHaveBeenCalledWith('fresh_access', 'fresh_refresh', { id: 'user-2' });
    expect(result).toEqual({
      token: 'fresh_access',
      refreshToken: 'fresh_refresh',
      user: { id: 'user-2' },
    });
  });
});
