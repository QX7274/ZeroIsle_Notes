jest.mock('../../../utils/realmStorage', () => ({
  __esModule: true,
  default: {
    getItem: jest.fn(),
    setItem: jest.fn(),
    removeItem: jest.fn(),
  },
}));

jest.mock('../tokenService', () => ({
  __esModule: true,
  default: {
    isAccessTokenExpiredOrExpiring: jest.fn(),
  },
}));

jest.mock('../authStorage', () => ({
  __esModule: true,
  default: {
    getToken: jest.fn(),
    clearAuth: jest.fn(),
  },
}));

jest.mock('../../../utils/logService', () => ({
  logService: {
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('simpleAuth configuration', () => {
  test('loads with the shared API URL and storage adapter', () => {
    const simpleAuth = require('../simpleAuth').default;

    expect(simpleAuth.baseURL).toMatch(/\/api\/v1$/);
  });
});
