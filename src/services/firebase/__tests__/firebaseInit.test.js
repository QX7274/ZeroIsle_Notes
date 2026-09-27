/**
 * Firebase 初始化降级契约：
 * - 有原生 Firebase 配置时（getApps() 非空）不得重复 initializeApp
 * - 缺少原生配置（无 google-services.json）时 initializeApp() 会返回 rejected promise，
 *   初始化必须降级为 false 且不产生未处理的 Promise rejection
 */

const mockGetApps = jest.fn();
const mockInitializeApp = jest.fn();
const mockRequestPermission = jest.fn();

jest.mock('@react-native-firebase/app', () => ({
  __esModule: true,
  getApps: (...args) => mockGetApps(...args),
  initializeApp: (...args) => mockInitializeApp(...args),
  default: { getApps: (...args) => mockGetApps(...args) },
}));

jest.mock('@react-native-firebase/messaging', () => {
  const messaging = () => ({ requestPermission: (...args) => mockRequestPermission(...args) });
  messaging.AuthorizationStatus = { AUTHORIZED: 1, PROVISIONAL: 2 };
  return { __esModule: true, default: messaging, AuthorizationStatus: { AUTHORIZED: 1, PROVISIONAL: 2 } };
});

describe('firebaseInit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.resetModules();
  });

  it('缺少原生 Firebase 配置时降级为 false，且不产生未处理的 rejection', async () => {
    const unhandled = [];
    const onUnhandled = reason => unhandled.push(reason);
    process.on('unhandledRejection', onUnhandled);

    mockGetApps.mockReturnValue([]);
    mockInitializeApp.mockReturnValue(Promise.reject(
      new Error("Missing or invalid FirebaseOptions property 'apiKey'."),
    ));

    const { initializeFirebase } = require('../firebaseInit');
    const result = await initializeFirebase();

    // 让微任务队列排空，模拟真实事件循环
    await new Promise(resolve => setTimeout(resolve, 10));
    process.removeListener('unhandledRejection', onUnhandled);

    expect(result).toBe(false);
    expect(mockInitializeApp).toHaveBeenCalledTimes(1);
    expect(unhandled).toHaveLength(0);
  });

  it('已有原生 Firebase 配置时直接复用，不重复初始化', async () => {
    mockGetApps.mockReturnValue([{ name: '[DEFAULT]' }]);

    const { initializeFirebase } = require('../firebaseInit');
    const result = await initializeFirebase();

    expect(result).toBe(true);
    expect(mockInitializeApp).not.toHaveBeenCalled();
  });

  it('初始化同步抛错时同样降级为 false', async () => {
    mockGetApps.mockReturnValue([]);
    mockInitializeApp.mockImplementation(() => {
      throw new Error('native module unavailable');
    });

    const { initializeFirebase } = require('../firebaseInit');

    await expect(initializeFirebase()).resolves.toBe(false);
  });
});
