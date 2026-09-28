/**
 * syncErrorRecovery 单元测试
 * 覆盖：错误分类判定与优先级、指数退避边界、可取消重试、不可重试短路、Client Reset 备份/恢复
 * 所有外部依赖（休眠、文件系统、时间、随机数）均通过注入实现，测试不触碰原生模块
 */

const {
  classifySyncError,
  computeBackoffDelay,
  createRetryController,
  createClientResetRecovery,
} = require('../syncErrorRecovery');

// syncManager 接线测试所需的轻量替身：避免加载 Realm / MongoDB / 原生网络实现
jest.mock('../../database/realmService', () => ({
  __esModule: true,
  default: { initialize: jest.fn(), getRealm: jest.fn() },
}));
jest.mock('../../database/mongoDBAdapter', () => ({
  mongoDBService: {
    find: jest.fn(),
    findOne: jest.fn(),
    insertOne: jest.fn(),
    updateOne: jest.fn(),
    deleteOne: jest.fn(),
  },
}));
jest.mock('../../../utils/logService', () => ({
  logService: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../../network/networkService', () => ({
  __esModule: true,
  default: { checkConnection: jest.fn(), addNetworkListener: jest.fn() },
}));

/**
 * 构造带 HTTP 响应的错误
 * @param {number} status 状态码
 * @param {Object} data 响应体
 * @param {string} message 错误消息
 * @returns {Object} 模拟错误
 */
function httpError(status, data = {}, message = `Request failed with status code ${status}`) {
  return { message, response: { status, data } };
}

/**
 * 等待条件成立（仅用于跨微任务等待，避免使用假定时器）
 * @param {Function} predicate 条件
 * @param {number} timeoutMs 超时时间
 * @returns {Promise<void>} 等待结果
 */
async function waitFor(predicate, timeoutMs = 1000) {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeoutMs) {
      throw new Error('等待条件超时');
    }
    await new Promise(resolve => setTimeout(resolve, 1));
  }
}

describe('classifySyncError 分类判定', () => {
  test.each([
    ['network：isNetworkError 标记', { isNetworkError: true, message: 'boom' }, 'network', true],
    ['network：有 request 无 response', { request: {}, message: 'Network Error' }, 'network', true],
    ['network：408 请求超时', httpError(408), 'network', true],
    ['network：网络错误码', { code: 'ECONNREFUSED', message: 'connect refused' }, 'network', true],
    ['auth：401', httpError(401), 'auth', false],
    ['auth：Unauthorized 关键字', { message: 'Unauthorized' }, 'auth', false],
    [
      'sessionExpired：401 且响应体声明令牌过期',
      httpError(401, { code: 'TOKEN_EXPIRED' }, 'token expired'),
      'sessionExpired',
      false,
    ],
    ['sessionExpired：无状态码时按关键字识别', { message: 'Session expired, please login again' }, 'sessionExpired', false],
    ['permission：403', httpError(403), 'permission', false],
    ['permission：Forbidden 关键字', { message: 'Forbidden' }, 'permission', false],
    ['clientReset：错误名', Object.assign(new Error('realm reset'), { name: 'ClientResetError' }), 'clientReset', false],
    ['clientReset：错误码 211', { code: 211, message: 'realm sync error' }, 'clientReset', false],
    ['clientReset：消息关键字', { message: 'Client reset required by server' }, 'clientReset', false],
    ['conflict：409', httpError(409), 'conflict', true],
    ['conflict：Mongo 唯一键冲突', { code: 11000, message: 'duplicate key error' }, 'conflict', true],
    ['server：500', httpError(500), 'server', true],
    ['server：503', httpError(503), 'server', true],
    ['server：429 限流', httpError(429), 'server', true],
    ['unknown：无法识别的错误', new Error('some weird failure'), 'unknown', false],
  ])('%s', (_label, error, category, retryable) => {
    const result = classifySyncError(error);

    expect(result.category).toBe(category);
    expect(result.retryable).toBe(retryable);
    expect(typeof result.userMessage).toBe('string');
    expect(result.userMessage.length).toBeGreaterThan(0);
  });

  test('分类结果只暴露 category/retryable/userMessage 三个字段', () => {
    const result = classifySyncError(httpError(500));

    expect(Object.keys(result).sort()).toEqual(['category', 'retryable', 'userMessage']);
  });

  test('空错误归为 unknown 且不可重试', () => {
    expect(classifySyncError(null).category).toBe('unknown');
    expect(classifySyncError(undefined).retryable).toBe(false);
  });

  test('Client Reset 判定优先于网络与服务端标记', () => {
    const result = classifySyncError({
      isNetworkError: true,
      isClientReset: true,
      message: 'network down',
    });

    expect(result.category).toBe('clientReset');
    expect(result.retryable).toBe(false);
  });

  test('401 带会话过期语义时归为 sessionExpired 而非 auth', () => {
    expect(classifySyncError(httpError(401, { code: 'SESSION_EXPIRED' })).category).toBe('sessionExpired');
    expect(classifySyncError(httpError(401, {}, 'token expired')).category).toBe('sessionExpired');
  });

  test('已收到明确 HTTP 响应时不会被当成网络错误', () => {
    const error = { message: 'connection failed', response: { status: 503 } };

    expect(classifySyncError(error).category).toBe('server');
  });

  test('字符串错误也能安全分类', () => {
    expect(classifySyncError('请求超时，请稍后重试').category).toBe('network');
    expect(classifySyncError('unknown boom').category).toBe('unknown');
  });
});

describe('computeBackoffDelay 指数退避', () => {
  test('默认按 500ms 指数增长并在 30s 封顶', () => {
    expect(computeBackoffDelay(1)).toBe(500);
    expect(computeBackoffDelay(2)).toBe(1000);
    expect(computeBackoffDelay(3)).toBe(2000);
    expect(computeBackoffDelay(7)).toBe(30000);
    expect(computeBackoffDelay(100)).toBe(30000);
  });

  test('attempt 非法或小于 1 时按首次处理', () => {
    expect(computeBackoffDelay(0)).toBe(500);
    expect(computeBackoffDelay(-3)).toBe(500);
    expect(computeBackoffDelay(undefined)).toBe(500);
    expect(computeBackoffDelay('abc')).toBe(500);
    expect(computeBackoffDelay(NaN)).toBe(500);
  });

  test('支持自定义基数与上限', () => {
    expect(computeBackoffDelay(4, { baseMs: 100, maxMs: 1000 })).toBe(800);
    expect(computeBackoffDelay(10, { baseMs: 100, maxMs: 1000 })).toBe(1000);
  });

  test('非法选项回退默认值，且上限不会小于基数', () => {
    expect(computeBackoffDelay(1, { baseMs: 0, maxMs: -1 })).toBe(500);
    expect(computeBackoffDelay(3, { baseMs: 1000, maxMs: 100 })).toBe(1000);
  });

  test('抖动按比例下调延迟且始终落在 [0, 上限]', () => {
    expect(computeBackoffDelay(2, { jitter: 0.5, random: () => 0 })).toBe(500);
    expect(computeBackoffDelay(2, { jitter: 0.5, random: () => 1 })).toBe(1000);
    expect(computeBackoffDelay(2, { jitter: 1, random: () => 0 })).toBe(0);
    expect(computeBackoffDelay(2, { jitter: 1, random: () => 1 })).toBe(1000);

    const jittered = computeBackoffDelay(30, { jitter: 1, random: () => 0.999 });
    expect(jittered).toBeGreaterThanOrEqual(0);
    expect(jittered).toBeLessThanOrEqual(30000);
  });

  test('返回值为非负整数', () => {
    const delay = computeBackoffDelay(3, { baseMs: 333, maxMs: 1000, jitter: 0.3, random: () => 0.42 });

    expect(Number.isInteger(delay)).toBe(true);
    expect(delay).toBeGreaterThanOrEqual(0);
  });
});

describe('createRetryController 可取消重试', () => {
  test('首次成功时不重试也不休眠', async () => {
    const fn = jest.fn(async () => 'ok');
    const sleep = jest.fn(async () => undefined);
    const controller = createRetryController({ maxRetries: 3, sleep });

    await expect(controller.run(fn)).resolves.toBe('ok');

    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(1);
    expect(sleep).not.toHaveBeenCalled();
    expect(controller.cancelled).toBe(false);
  });

  test('可重试错误按指数退避重试直至成功', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce({ isNetworkError: true, message: 'network down' })
      .mockRejectedValueOnce(httpError(503))
      .mockResolvedValue('done');
    const sleep = jest.fn(async () => undefined);
    const controller = createRetryController({ maxRetries: 3, sleep });

    await expect(controller.run(fn)).resolves.toBe('done');

    expect(fn).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls.map(call => call[0])).toEqual([500, 1000]);
  });

  test('不可重试错误（403）立即短路且不吞错', async () => {
    const error = httpError(403, {}, 'Forbidden');
    const fn = jest.fn().mockRejectedValue(error);
    const sleep = jest.fn(async () => undefined);
    const controller = createRetryController({ maxRetries: 5, sleep });

    await expect(controller.run(fn)).rejects.toBe(error);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  test('未知错误保守短路，不盲目重试', async () => {
    const error = new Error('无法识别的内部错误');
    const fn = jest.fn().mockRejectedValue(error);
    const controller = createRetryController({ maxRetries: 3, sleep: jest.fn(async () => undefined) });

    await expect(controller.run(fn)).rejects.toBe(error);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test('重试次数耗尽后抛出最后一次错误', async () => {
    const first = { isNetworkError: true, message: 'first' };
    const second = { isNetworkError: true, message: 'second' };
    const last = { isNetworkError: true, message: 'last' };
    const fn = jest
      .fn()
      .mockRejectedValueOnce(first)
      .mockRejectedValueOnce(second)
      .mockRejectedValue(last);
    const sleep = jest.fn(async () => undefined);
    const controller = createRetryController({ maxRetries: 2, sleep });

    await expect(controller.run(fn)).rejects.toBe(last);

    expect(fn).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls.map(call => call[0])).toEqual([500, 1000]);
  });

  test('maxRetries=0 时只执行一次', async () => {
    const error = { isNetworkError: true, message: 'network down' };
    const fn = jest.fn().mockRejectedValue(error);
    const sleep = jest.fn(async () => undefined);
    const controller = createRetryController({ maxRetries: 0, sleep });

    await expect(controller.run(fn)).rejects.toBe(error);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  test('cancel 后不再重试且抛出最后一次错误（不吞错）', async () => {
    const error = { isNetworkError: true, message: 'network down' };
    const fn = jest.fn().mockRejectedValue(error);
    let releaseSleep;
    const sleep = jest.fn(
      () =>
        new Promise(resolve => {
          releaseSleep = resolve;
        }),
    );
    const controller = createRetryController({ maxRetries: 3, sleep });

    const promise = controller.run(fn);
    await waitFor(() => sleep.mock.calls.length === 1);

    expect(controller.cancelled).toBe(false);
    controller.cancel();
    expect(controller.cancelled).toBe(true);
    expect(controller.isCancelled()).toBe(true);

    await expect(promise).rejects.toBe(error);
    expect(fn).toHaveBeenCalledTimes(1);

    releaseSleep();
  });

  test('shouldAbort 为真时停止重试并抛出最后一次错误', async () => {
    const error = { isNetworkError: true, message: 'network down' };
    const fn = jest.fn().mockRejectedValue(error);
    const sleep = jest.fn(async () => undefined);
    const abortWhenRetrying = () => fn.mock.calls.length >= 1;
    const controller = createRetryController({ maxRetries: 3, sleep, shouldAbort: abortWhenRetrying });

    await expect(controller.run(fn)).rejects.toBe(error);

    expect(fn).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
  });

  test('shouldAbort 自身抛错时按中止处理，不启动执行', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('should not run'));
    const controller = createRetryController({
      maxRetries: 2,
      shouldAbort: () => {
        throw new Error('abort check failed');
      },
    });

    await expect(controller.run(fn)).rejects.toThrow('同步重试已取消');
    expect(fn).not.toHaveBeenCalled();
  });

  test('run 传入非函数时抛出 TypeError', async () => {
    const controller = createRetryController({ maxRetries: 1 });

    await expect(controller.run(null)).rejects.toThrow(TypeError);
  });
});

describe('createClientResetRecovery Client Reset 备份与恢复', () => {
  /**
   * 构造全部注入的文件系统依赖
   * @param {Object} overrides 覆盖项
   * @returns {Object} 依赖集合
   */
  function createDeps(overrides = {}) {
    return {
      exists: jest.fn(async () => true),
      mkdir: jest.fn(async () => undefined),
      copyFile: jest.fn(async () => undefined),
      ...overrides,
    };
  }

  test('备份成功后返回 backupPath/description 并可还原', async () => {
    const deps = createDeps();
    const recovery = await createClientResetRecovery({
      realmPath: '/data/app/default.realm',
      backupDir: '/data/backups',
      now: () => new Date('2024-05-01T10:20:30.400Z'),
      ...deps,
    });

    expect(recovery.backupPath).toBe('/data/backups/backup_2024-05-01T10-20-30-400Z.realm');
    expect(recovery.description).toContain('/data/app/default.realm');
    expect(recovery.description).toContain(recovery.backupPath);
    expect(deps.mkdir).not.toHaveBeenCalled();
    expect(deps.copyFile).toHaveBeenCalledWith('/data/app/default.realm', recovery.backupPath);

    await expect(recovery.restore()).resolves.toBe(true);
    expect(deps.copyFile).toHaveBeenLastCalledWith(recovery.backupPath, '/data/app/default.realm');
  });

  test('备份目录不存在时先创建目录', async () => {
    const deps = createDeps({
      exists: jest.fn(async path => path !== '/data/backups'),
    });
    const recovery = await createClientResetRecovery({
      realmPath: '/data/app.realm',
      backupDir: '/data/backups',
      now: () => new Date('2024-05-01T00:00:00.000Z'),
      ...deps,
    });

    expect(deps.mkdir).toHaveBeenCalledWith('/data/backups');
    expect(recovery.backupPath).toBe('/data/backups/backup_2024-05-01T00-00-00-000Z.realm');
  });

  test('Realm 文件不存在时抛出明确错误且不复制', async () => {
    const deps = createDeps({ exists: jest.fn(async () => false) });

    await expect(
      createClientResetRecovery({
        realmPath: '/data/missing.realm',
        backupDir: '/data/backups',
        now: () => new Date(0),
        ...deps,
      }),
    ).rejects.toThrow(/Client Reset 备份失败.*Realm 文件不存在/);

    expect(deps.copyFile).not.toHaveBeenCalled();
    expect(deps.mkdir).not.toHaveBeenCalled();
  });

  test('复制失败时抛出带原因的备份错误（不静默丢数据）', async () => {
    const deps = createDeps({
      copyFile: jest.fn(async () => {
        throw new Error('磁盘空间不足');
      }),
    });

    let caught;
    try {
      await createClientResetRecovery({
        realmPath: '/data/app.realm',
        backupDir: '/data/backups',
        now: () => new Date(0),
        ...deps,
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(Error);
    expect(caught.message).toContain('Client Reset 备份失败');
    expect(caught.message).toContain('磁盘空间不足');
    expect(caught.message).toContain('/data/app.realm');
    expect(caught.cause).toBeInstanceOf(Error);
  });

  test('备份目录创建失败时抛出明确错误', async () => {
    const deps = createDeps({
      exists: jest.fn(async path => path !== '/data/backups'),
      mkdir: jest.fn(async () => {
        throw new Error('EACCES: permission denied');
      }),
    });

    await expect(
      createClientResetRecovery({
        realmPath: '/data/app.realm',
        backupDir: '/data/backups',
        now: () => new Date(0),
        ...deps,
      }),
    ).rejects.toThrow(/Client Reset 备份失败.*EACCES/);
  });

  test('备份文件缺失时 restore 失败', async () => {
    const deps = createDeps();
    const recovery = await createClientResetRecovery({
      realmPath: '/data/app.realm',
      backupDir: '/data/backups',
      now: () => new Date(0),
      ...deps,
    });

    deps.exists.mockResolvedValue(false);

    await expect(recovery.restore()).rejects.toThrow(/备份文件不存在/);
    expect(deps.copyFile).toHaveBeenCalledTimes(1);
  });

  test('缺少 realmPath 时直接报错', async () => {
    const deps = createDeps();

    await expect(createClientResetRecovery({ backupDir: '/data/backups', ...deps })).rejects.toThrow(
      /缺少 realmPath/,
    );
    expect(deps.copyFile).not.toHaveBeenCalled();
  });

  test('时间源返回非法值时回退到当前时间', async () => {
    const deps = createDeps();
    const recovery = await createClientResetRecovery({
      realmPath: '/data/app.realm',
      backupDir: '/data/backups',
      now: () => new Date('invalid-date'),
      ...deps,
    });

    expect(recovery.backupPath).toMatch(/^\/data\/backups\/backup_\d{4}-\d{2}-\d{2}T.*\.realm$/);
  });
});

describe('syncManager 错误分类接线', () => {
  const syncManager = require('../syncManager').default;
  const { logService } = require('../../../utils/logService');

  test('_classifyAndLogError 返回分类结果并挂回错误对象', () => {
    const error = { response: { status: 403 }, message: 'Forbidden' };

    const classification = syncManager._classifyAndLogError(error, 'syncAll');

    expect(classification.category).toBe('permission');
    expect(error.syncCategory).toBe('permission');
    expect(error.syncRetryable).toBe(false);
    expect(error.syncUserMessage).toBe(classification.userMessage);
    expect(logService.warn).toHaveBeenCalled();
  });

  test('不可扩展的错误对象只记录日志，不影响分类结果', () => {
    const frozen = Object.freeze({
      message: 'Request failed',
      response: Object.freeze({ status: 500 }),
    });

    const classification = syncManager._classifyAndLogError(frozen, 'pullFromServer');

    expect(classification.category).toBe('server');
    expect(frozen.syncCategory).toBeUndefined();
  });
});
