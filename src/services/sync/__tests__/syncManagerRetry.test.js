/**
 * syncManager 重试接线 / 取消 / Client Reset 备份单元测试
 * 覆盖：
 * 1. 单条操作可重试成功、重试耗尽保持既有失败语义、不可重试错误短路
 * 2. cancelPendingRetries() 中止退避等待、取消不吞错且不当作成功、剩余操作保持待处理
 * 3. clientReset 分类复用 realmBackupService.backupRealmFile 备份、同会话去重、备份失败显式报错
 * 所有原生依赖（Realm / MongoDB / RNFS / 网络）均以替身注入，测试不触碰原生模块
 */

jest.mock('../../database/realmService', () => ({
  __esModule: true,
  default: {
    initialize: jest.fn(),
    getRealm: jest.fn(),
    createObjectId: jest.fn(() => 'generated-id'),
    realmObjectToPlain: jest.fn(),
  },
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

// realmBackupService 与 realmConfig.onError 共用；这里替身化以验证默认懒加载路径且不触碰原生 RNFS
jest.mock('../../recovery/realmBackupService', () => ({
  __esModule: true,
  backupRealmFile: jest.fn(),
}));

const realmService = require('../../database/realmService').default;
const { mongoDBService } = require('../../database/mongoDBAdapter');
const { logService } = require('../../../utils/logService');
const networkService = require('../../network/networkService').default;
const realmBackupService = require('../../recovery/realmBackupService');
const { SyncManager } = require('../syncManager');

/** 默认备份结果路径（沿用 realmBackupService 的 backup_<timestamp>.realm 命名） */
const BACKUP_PATH = '/data/backups/backup_2024-05-01T10-20-30-400Z.realm';

/**
 * 构造可用的轻量 Realm 替身
 * @param {Array<Object>} operations 待处理操作
 * @param {Object} [options] 选项
 * @param {string} [options.path] Realm 文件路径
 * @returns {Object} Realm 替身
 */
function createFakeRealm(operations = [], options = {}) {
  const store = new Map(operations.map(operation => [operation._id, { ...operation }]));

  return {
    store,
    path: options.path === undefined ? '/data/app/default.realm' : options.path,
    objects: jest.fn(() => Array.from(store.values())),
    objectForPrimaryKey: jest.fn((type, id) => store.get(id) || null),
    write: jest.fn(callback => callback()),
  };
}

/**
 * 构造待处理操作
 * @param {Object} [overrides] 覆盖字段
 * @returns {Object} 操作对象
 */
function makeOperation(overrides = {}) {
  const documentId = overrides.documentId || 'note-1';

  return {
    _id: 'op-1',
    type: 'create',
    collection: 'notes',
    documentId,
    data: JSON.stringify({ _id: documentId, title: '测试笔记' }),
    status: 'pending',
    ...overrides,
  };
}

/**
 * 构造网络类错误（分类为 network，可重试）
 * @param {string} [message] 错误消息
 * @returns {Object} 错误对象
 */
function networkError(message = 'network down') {
  return { isNetworkError: true, message };
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

/**
 * 构造已初始化的 SyncManager（isOnline=true，已加载待处理操作）
 * @param {Array<Object>} operations 待处理操作
 * @param {Object} [options] 选项
 * @param {Object} [options.retryOptions] 重试参数
 * @param {Object} [options.clientResetOptions] Client Reset 备份依赖
 * @param {Object} [options.realmOptions] Realm 替身选项
 * @returns {Promise<{manager: Object, realm: Object}>} 管理器与 Realm 替身
 */
async function createManager(operations, options = {}) {
  const realm = createFakeRealm(operations, options.realmOptions || {});

  realmService.initialize.mockResolvedValue(undefined);
  realmService.getRealm.mockResolvedValue(realm);
  realmService.realmObjectToPlain.mockImplementation(object => object);
  networkService.checkConnection.mockResolvedValue({ isConnected: true });
  networkService.addNetworkListener.mockReturnValue(jest.fn());

  const manager = new SyncManager();
  manager.setRetryOptions({ sleep: jest.fn(async () => undefined), ...(options.retryOptions || {}) });
  if (options.clientResetOptions) {
    manager.setClientResetRecoveryOptions(options.clientResetOptions);
  }

  await manager.initialize();

  return { manager, realm };
}

/**
 * 构造 Client Reset 备份选项（realmPath + 注入的 backupRealmFile）
 * @param {Object} [overrides] 覆盖项
 * @returns {Object} 备份选项
 */
function createBackupOptions(overrides = {}) {
  return {
    realmPath: '/data/app/default.realm',
    backupRealmFile: jest.fn(async () => ({ success: true, path: BACKUP_PATH })),
    ...overrides,
  };
}

describe('syncManager 单条操作重试接线', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('可重试错误按退避重试直至成功，操作标记为 completed', async () => {
    mongoDBService.findOne
      .mockRejectedValueOnce(networkError())
      .mockRejectedValueOnce(networkError())
      .mockResolvedValue(null);
    const sleep = jest.fn(async () => undefined);
    const { manager, realm } = await createManager([makeOperation()], {
      retryOptions: { maxRetries: 3, baseMs: 500, maxMs: 30000, sleep },
    });

    await expect(manager.syncPendingOperations()).resolves.toBe(true);

    expect(mongoDBService.findOne).toHaveBeenCalledTimes(3);
    expect(sleep.mock.calls.map(call => call[0])).toEqual([500, 1000]);
    expect(mongoDBService.insertOne).toHaveBeenCalledTimes(1);
    expect(realm.store.get('op-1').status).toBe('completed');
  });

  test('重试耗尽后保持既有语义：标记失败并写入 error', async () => {
    mongoDBService.findOne.mockRejectedValue(networkError('network down'));
    const sleep = jest.fn(async () => undefined);
    const { manager, realm } = await createManager([makeOperation()], {
      retryOptions: { maxRetries: 2, baseMs: 10, maxMs: 20, sleep },
    });

    await expect(manager.syncPendingOperations()).resolves.toBe(true);

    expect(mongoDBService.findOne).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenCalledTimes(2);

    const operation = realm.store.get('op-1');
    expect(operation.status).toBe('failed');
    expect(operation.error).toBe('network down');
    expect(logService.error).toHaveBeenCalledWith('同步操作失败: op-1', expect.anything());
    expect(logService.warn).toHaveBeenCalledWith(expect.stringContaining('错误分类: network'));
  });

  test('不可重试错误（403）立即短路：不重试、不休眠、直接失败', async () => {
    const forbidden = { response: { status: 403 }, message: 'Forbidden' };
    mongoDBService.findOne.mockRejectedValue(forbidden);
    const sleep = jest.fn(async () => undefined);
    const { manager, realm } = await createManager([makeOperation()], {
      retryOptions: { maxRetries: 5, sleep },
    });

    await expect(manager.syncPendingOperations()).resolves.toBe(true);

    expect(mongoDBService.findOne).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
    expect(realm.store.get('op-1').status).toBe('failed');
    expect(logService.warn).toHaveBeenCalledWith(expect.stringContaining('错误分类: permission'));
  });

  test('首次即成功时不触发任何退避等待', async () => {
    mongoDBService.findOne.mockResolvedValue({ _id: 'note-1' });
    const sleep = jest.fn(async () => undefined);
    const { manager, realm } = await createManager([makeOperation()], { retryOptions: { sleep } });

    await expect(manager.syncPendingOperations()).resolves.toBe(true);

    expect(mongoDBService.findOne).toHaveBeenCalledTimes(1);
    expect(mongoDBService.updateOne).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
    expect(realm.store.get('op-1').status).toBe('completed');
  });
});

describe('syncManager 取消进行中的重试', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('cancelPendingRetries 中止退避等待：不吞错、不当作成功、剩余操作保持待处理', async () => {
    const error = networkError('network down');
    mongoDBService.findOne.mockRejectedValue(error);
    let releaseSleep;
    const sleep = jest.fn(
      () =>
        new Promise(resolve => {
          releaseSleep = resolve;
        }),
    );
    const { manager, realm } = await createManager(
      [makeOperation(), makeOperation({ _id: 'op-2', documentId: 'note-2' })],
      { retryOptions: { maxRetries: 3, baseMs: 500, maxMs: 30000, sleep } },
    );

    const promise = manager.syncPendingOperations();
    await waitFor(() => sleep.mock.calls.length === 1);

    expect(manager.cancelPendingRetries()).toBe(1);
    await expect(promise).resolves.toBe(true);

    // 退避被中止，没有发起第二次尝试
    expect(mongoDBService.findOne).toHaveBeenCalledTimes(1);

    // 被取消的操作按失败处理，绝不当成成功
    expect(realm.store.get('op-1').status).toBe('failed');
    expect(realm.store.get('op-1').error).toBe('network down');

    // 取消后不再启动剩余操作，剩余操作保持待处理
    expect(realm.store.get('op-2').status).toBe('pending');
    expect(logService.warn).toHaveBeenCalledWith(expect.stringContaining('同步重试已取消'));

    releaseSleep();
  });

  test('无进行中重试时 cancelPendingRetries 返回 0，且下次同步会重置取消标记', async () => {
    mongoDBService.findOne.mockResolvedValue(null);
    const { manager, realm } = await createManager([makeOperation()]);

    expect(manager.cancelPendingRetries()).toBe(0);

    await expect(manager.syncPendingOperations()).resolves.toBe(true);

    expect(realm.store.get('op-1').status).toBe('completed');
    expect(logService.warn).not.toHaveBeenCalledWith(expect.stringContaining('同步重试已取消'));
  });
});

describe('syncManager Client Reset 主动备份（复用 realmBackupService）', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  test('clientReset 分类复用 backupRealmFile 备份并记录状态（不重试）', async () => {
    mongoDBService.findOne.mockRejectedValue({ code: 211, message: 'realm sync client reset' });
    const options = createBackupOptions();
    const sleep = jest.fn(async () => undefined);
    const { manager, realm } = await createManager([makeOperation()], {
      retryOptions: { maxRetries: 3, sleep },
      clientResetOptions: options,
    });

    await expect(manager.syncPendingOperations()).resolves.toBe(true);

    // clientReset 不可重试：只执行一次
    expect(mongoDBService.findOne).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();

    // 复用与 realmConfig.onError 相同的备份实现
    expect(options.backupRealmFile).toHaveBeenCalledTimes(1);
    expect(options.backupRealmFile).toHaveBeenCalledWith('/data/app/default.realm');

    const state = manager.getClientResetState();
    expect(state).not.toBeNull();
    expect(state.backupPath).toBe(BACKUP_PATH);
    expect(state.description).toContain(BACKUP_PATH);
    expect(state.operationId).toBe('op-1');
    expect(state.error).toBeNull();
    expect(logService.warn).toHaveBeenCalledWith(expect.stringContaining('Client Reset 备份完成'));

    // 操作本身仍按失败处理，但备份已保留
    expect(realm.store.get('op-1').status).toBe('failed');
  });

  test('未注入时默认懒加载 realmBackupService.backupRealmFile', async () => {
    realmBackupService.backupRealmFile.mockResolvedValue({ success: true, path: '/data/backups/backup_default.realm' });
    mongoDBService.findOne.mockRejectedValue({ code: 211, message: 'client reset' });
    const { manager } = await createManager([makeOperation()], {
      retryOptions: { maxRetries: 3, sleep: jest.fn(async () => undefined) },
      clientResetOptions: { realmPath: '/data/app/default.realm' },
    });

    await expect(manager.syncPendingOperations()).resolves.toBe(true);

    expect(realmBackupService.backupRealmFile).toHaveBeenCalledWith('/data/app/default.realm');
    expect(manager.getClientResetState().backupPath).toBe('/data/backups/backup_default.realm');
  });

  test('同一会话内第二次 clientReset 不重复备份，仅记录 warn 且操作仍失败', async () => {
    mongoDBService.findOne.mockRejectedValue({ code: 211, message: 'client reset' });
    const options = createBackupOptions();
    const { manager, realm } = await createManager(
      [makeOperation(), makeOperation({ _id: 'op-2', documentId: 'note-2' })],
      {
        retryOptions: { maxRetries: 3, sleep: jest.fn(async () => undefined) },
        clientResetOptions: options,
      },
    );

    await expect(manager.syncPendingOperations()).resolves.toBe(true);

    // 同一会话只备份一次
    expect(options.backupRealmFile).toHaveBeenCalledTimes(1);
    expect(manager.getClientResetState().backupPath).toBe(BACKUP_PATH);

    // 第二次操作仍按失败处理，但没有再次备份
    expect(realm.store.get('op-1').status).toBe('failed');
    expect(realm.store.get('op-2').status).toBe('failed');
    expect(logService.warn).toHaveBeenCalledWith(expect.stringContaining('跳过重复备份'));
  });

  test('备份实现抛错时显式报错：操作失败且 error 带原因，状态记录 error', async () => {
    mongoDBService.findOne.mockRejectedValue({ code: 211, message: 'client reset' });
    const options = createBackupOptions({
      backupRealmFile: jest.fn(async () => {
        throw new Error('磁盘空间不足');
      }),
    });
    const { manager, realm } = await createManager([makeOperation()], {
      retryOptions: { maxRetries: 3, sleep: jest.fn(async () => undefined) },
      clientResetOptions: options,
    });

    await expect(manager.syncPendingOperations()).resolves.toBe(true);

    const operation = realm.store.get('op-1');
    expect(operation.status).toBe('failed');
    expect(operation.error).toContain('Client Reset 备份失败');
    expect(operation.error).toContain('磁盘空间不足');

    const state = manager.getClientResetState();
    expect(state.error).toBeInstanceOf(Error);
    expect(state.backupPath).toBeNull();
    expect(logService.error).toHaveBeenCalledWith(
      expect.stringContaining('Client Reset 备份失败'),
      expect.any(Error),
    );
  });

  test('备份实现返回 success:false 时显式判败，不生成“看似成功”的状态', async () => {
    mongoDBService.findOne.mockRejectedValue({ code: 211, message: 'client reset' });
    const options = createBackupOptions({ backupRealmFile: jest.fn(async () => ({ success: false })) });
    const { manager, realm } = await createManager([makeOperation()], {
      retryOptions: { maxRetries: 3, sleep: jest.fn(async () => undefined) },
      clientResetOptions: options,
    });

    await expect(manager.syncPendingOperations()).resolves.toBe(true);

    const operation = realm.store.get('op-1');
    expect(operation.status).toBe('failed');
    expect(operation.error).toContain('未返回有效备份路径');

    const state = manager.getClientResetState();
    expect(state.error).toBeInstanceOf(Error);
    expect(state.backupPath).toBeNull();
  });

  test('备份失败后同一会话再次 clientReset 仍会重新备份（失败不参与去重）', async () => {
    mongoDBService.findOne.mockRejectedValue({ code: 211, message: 'client reset' });
    const backupRealmFile = jest
      .fn()
      .mockRejectedValueOnce(new Error('首次磁盘空间不足'))
      .mockResolvedValueOnce({ success: true, path: BACKUP_PATH });
    const { manager, realm } = await createManager(
      [makeOperation(), makeOperation({ _id: 'op-2', documentId: 'note-2' })],
      {
        retryOptions: { maxRetries: 3, sleep: jest.fn(async () => undefined) },
        clientResetOptions: createBackupOptions({ backupRealmFile }),
      },
    );

    await expect(manager.syncPendingOperations()).resolves.toBe(true);

    expect(backupRealmFile).toHaveBeenCalledTimes(2);
    expect(manager.getClientResetState().backupPath).toBe(BACKUP_PATH);
    expect(realm.store.get('op-2').status).toBe('failed');
  });

  test('无法确定 Realm 路径时显式失败，不调用备份实现', async () => {
    mongoDBService.findOne.mockRejectedValue({ code: 211, message: 'client reset' });
    const options = createBackupOptions({ realmPath: '' });
    const { manager, realm } = await createManager([makeOperation()], {
      retryOptions: { maxRetries: 3, sleep: jest.fn(async () => undefined) },
      clientResetOptions: options,
      realmOptions: { path: null },
    });

    await expect(manager.syncPendingOperations()).resolves.toBe(true);

    const operation = realm.store.get('op-1');
    expect(operation.status).toBe('failed');
    expect(operation.error).toContain('无法确定 Realm 文件路径');
    expect(options.backupRealmFile).not.toHaveBeenCalled();
  });

  test('Realm 路径可从 realm 实例回退解析', async () => {
    mongoDBService.findOne.mockRejectedValue({ code: 211, message: 'client reset' });
    const options = createBackupOptions({ realmPath: undefined });
    const { manager } = await createManager([makeOperation()], {
      retryOptions: { maxRetries: 3, sleep: jest.fn(async () => undefined) },
      clientResetOptions: options,
      realmOptions: { path: '/data/realm-fallback/default.realm' },
    });

    await expect(manager.syncPendingOperations()).resolves.toBe(true);

    expect(options.backupRealmFile).toHaveBeenCalledWith('/data/realm-fallback/default.realm');
  });

  test('非 clientReset 错误不触发备份', async () => {
    mongoDBService.findOne.mockRejectedValue(networkError());
    const options = createBackupOptions();
    const { manager } = await createManager([makeOperation()], {
      retryOptions: { maxRetries: 0, sleep: jest.fn(async () => undefined) },
      clientResetOptions: options,
    });

    await expect(manager.syncPendingOperations()).resolves.toBe(true);

    expect(options.backupRealmFile).not.toHaveBeenCalled();
    expect(manager.getClientResetState()).toBeNull();
  });
});
