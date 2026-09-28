jest.mock('react-native-fs', () => ({
  CachesDirectoryPath: '/cache',
  exists: jest.fn(),
  mkdir: jest.fn(),
  copyFile: jest.fn(),
  unlink: jest.fn(),
  stat: jest.fn(),
  read: jest.fn(),
  writeFile: jest.fn(),
  appendFile: jest.fn(),
  hash: jest.fn(),
}));

jest.mock('../../database/realmService', () => ({
  __esModule: true,
  default: {
    getRealm: jest.fn(),
  },
}));

jest.mock('../../../utils/logService', () => ({
  logService: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const RNFS = require('react-native-fs');
const realmService = require('../../database/realmService').default;
const { downloadCacheService } = require('../downloadCacheService');

const DEFAULT_MAX_CACHE_SIZE = 2 * 1024 * 1024 * 1024;
const DEFAULT_CHUNK_WRITE_THRESHOLD = 8 * 1024 * 1024;
const DEFAULT_CHUNK_WRITE_SIZE = 1024 * 1024;

/**
 * 构造被 service 使用的 Realm mock：
 * objects() 返回类数组结果（带 sorted），objectForPrimaryKey/create/delete 可断言
 */
const createRealm = ({ items = [], primary = null } = {}) => {
  const results = items.slice();
  results.sorted = jest.fn(() => results);
  return {
    objects: jest.fn(() => results),
    objectForPrimaryKey: jest.fn(() => primary),
    write: jest.fn((callback) => callback()),
    create: jest.fn(),
    delete: jest.fn(),
  };
};

describe('downloadCacheService remote cache keys', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    downloadCacheService.initialized = false;
  });

  test('resolves a remote URL through its persisted cache index path', async () => {
    const remoteUrl = 'https://example.test/media/report.pdf?version=1';
    const indexedPath = '/cache/attachments/remote_hash.pdf';
    const realm = {
      objectForPrimaryKey: jest.fn(() => ({ path: indexedPath })),
      write: jest.fn((callback) => callback()),
    };
    realmService.getRealm.mockResolvedValue(realm);
    RNFS.exists.mockResolvedValue(true);

    const result = await downloadCacheService.getCachePath(remoteUrl);

    expect(result).toBe(indexedPath);
    expect(realm.objectForPrimaryKey).toHaveBeenCalledWith(
      'FileCacheIndex',
      expect.stringMatching(/^cache_remote_[a-f0-9]{64}$/)
    );
    expect(result).not.toContain('https://');
  });

  test('saves remote URLs under a safe hashed filename and keeps the raw URL in metadata', async () => {
    const remoteUrl = 'https://example.test/media/report.pdf?version=1';
    const cacheItems = { length: 0, sum: jest.fn(() => 0) };
    const realm = {
      objects: jest.fn(() => ({ sorted: jest.fn(() => cacheItems) })),
      write: jest.fn((callback) => callback()),
      create: jest.fn(),
    };
    realmService.getRealm.mockResolvedValue(realm);
    RNFS.exists.mockResolvedValue(false);

    const result = await downloadCacheService.saveToCache(remoteUrl, '/tmp/report.pdf', {
      extension: '.pdf?version=1',
      size: 12,
      mimeType: 'application/pdf',
    });

    expect(result).toMatch(/^\/cache\/attachments\/remote_[a-f0-9]{64}\.pdfversion1$/);
    expect(RNFS.copyFile).toHaveBeenCalledWith('/tmp/report.pdf', result);
    expect(realm.create).toHaveBeenCalledWith(
      'FileCacheIndex',
      expect.objectContaining({ fileId: remoteUrl, path: result, size: 12 }),
      'modified'
    );
  });
});

describe('downloadCacheService quota, integrity and chunked writes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    downloadCacheService.initialized = false;
    downloadCacheService.configure({
      maxCacheSize: DEFAULT_MAX_CACHE_SIZE,
      reserveRatio: 0.1,
      chunkWriteThreshold: DEFAULT_CHUNK_WRITE_THRESHOLD,
      chunkWriteSize: DEFAULT_CHUNK_WRITE_SIZE,
    });
    RNFS.exists.mockResolvedValue(true);
    RNFS.hash.mockResolvedValue('a'.repeat(64));
    RNFS.stat.mockResolvedValue({ size: 0 });
  });

  test('按配额清理最久未访问的缓存后再写入', async () => {
    downloadCacheService.configure({ maxCacheSize: 250, reserveRatio: 0 });
    const oldItem = {
      _id: 'cache_old',
      fileId: 'old',
      path: '/cache/attachments/old',
      size: 100,
      lastAccessedAt: new Date(1000),
    };
    const newItem = {
      _id: 'cache_new',
      fileId: 'new',
      path: '/cache/attachments/new',
      size: 100,
      lastAccessedAt: new Date(2000),
    };
    const realm = createRealm({ items: [oldItem, newItem] });
    realmService.getRealm.mockResolvedValue(realm);

    const result = await downloadCacheService.saveToCache('fresh', '/tmp/fresh.bin', { size: 100 });

    expect(RNFS.unlink).toHaveBeenCalledWith('/cache/attachments/old');
    expect(RNFS.unlink).not.toHaveBeenCalledWith('/cache/attachments/new');
    expect(realm.delete).toHaveBeenCalledWith(oldItem);
    expect(RNFS.copyFile).toHaveBeenCalledWith('/tmp/fresh.bin', result);
    expect(realm.create).toHaveBeenCalledWith(
      'FileCacheIndex',
      expect.objectContaining({ fileId: 'fresh', path: result, size: 100 }),
      'modified'
    );
  });

  test('正在写入的 key 会被保护，不参与淘汰', async () => {
    downloadCacheService.configure({ maxCacheSize: 250, reserveRatio: 0 });
    const target = {
      _id: 'cache_fresh',
      fileId: 'fresh',
      path: '/cache/attachments/fresh',
      size: 200,
      lastAccessedAt: new Date(1000),
    };
    const other = {
      _id: 'cache_other',
      fileId: 'other',
      path: '/cache/attachments/other',
      size: 200,
      lastAccessedAt: new Date(1),
    };
    const realm = createRealm({ items: [target, other] });
    realmService.getRealm.mockResolvedValue(realm);

    // 当前 400 + 100 = 500 > 250，需释放 250；target 受保护 -> 淘汰 other
    await downloadCacheService.saveToCache('fresh', '/tmp/fresh.bin', { size: 100 });

    expect(RNFS.unlink).toHaveBeenCalledWith('/cache/attachments/other');
    expect(realm.delete).toHaveBeenCalledWith(other);
    expect(realm.delete).not.toHaveBeenCalledWith(target);
  });

  test('sha256 校验失败时抛错并清理半成品，不写索引', async () => {
    const realm = createRealm();
    realmService.getRealm.mockResolvedValue(realm);
    RNFS.hash.mockResolvedValue('b'.repeat(64));

    await expect(
      downloadCacheService.saveToCache('bad', '/tmp/bad.bin', {
        size: 10,
        sha256: 'a'.repeat(64),
      })
    ).rejects.toThrow(/sha256/);

    expect(realm.create).not.toHaveBeenCalled();
    expect(RNFS.unlink).toHaveBeenCalledWith('/cache/attachments/bad');
  });

  test('expectedSize 不匹配时抛错，不写索引', async () => {
    const realm = createRealm();
    realmService.getRealm.mockResolvedValue(realm);
    RNFS.stat.mockResolvedValue({ size: 7 });

    await expect(
      downloadCacheService.saveToCache('sized', '/tmp/sized.bin', { size: 10, expectedSize: 10 })
    ).rejects.toThrow(/大小校验失败/);

    expect(realm.create).not.toHaveBeenCalled();
  });

  test('sha256 匹配时正常写入索引', async () => {
    const realm = createRealm();
    realmService.getRealm.mockResolvedValue(realm);
    RNFS.hash.mockResolvedValue('A'.repeat(64));
    RNFS.stat.mockResolvedValue({ size: 10 });

    const result = await downloadCacheService.saveToCache('good', '/tmp/good.bin', {
      size: 10,
      expectedSize: 10,
      sha256: 'a'.repeat(64),
    });

    expect(result).toBe('/cache/attachments/good');
    expect(realm.create).toHaveBeenCalled();
  });

  test('RNFS.hash 不可用时安全降级为仅大小校验，不阻断主流程', async () => {
    const realm = createRealm();
    realmService.getRealm.mockResolvedValue(realm);
    RNFS.stat.mockResolvedValue({ size: 10 });
    const originalHash = RNFS.hash;
    RNFS.hash = undefined;

    try {
      const result = await downloadCacheService.saveToCache('nohash', '/tmp/nohash.bin', {
        size: 10,
        expectedSize: 10,
        sha256: 'a'.repeat(64),
      });

      expect(result).toBe('/cache/attachments/nohash');
      expect(realm.create).toHaveBeenCalled();
    } finally {
      RNFS.hash = originalHash;
    }
  });

  test('大文件走有界分段写入而非 copyFile', async () => {
    downloadCacheService.configure({ chunkWriteThreshold: 4, chunkWriteSize: 2 });
    const realm = createRealm();
    realmService.getRealm.mockResolvedValue(realm);
    RNFS.read.mockImplementation((path, length, position) =>
      Promise.resolve(`part-${position}-${length}`)
    );
    RNFS.stat.mockResolvedValue({ size: 5 });

    const result = await downloadCacheService.saveToCache('big', '/tmp/big.bin', {
      size: 5,
      expectedSize: 5,
    });

    expect(RNFS.copyFile).not.toHaveBeenCalled();
    expect(RNFS.read.mock.calls).toEqual([
      ['/tmp/big.bin', 2, 0, 'base64'],
      ['/tmp/big.bin', 2, 2, 'base64'],
      ['/tmp/big.bin', 1, 4, 'base64'],
    ]);
    expect(RNFS.writeFile).toHaveBeenCalledWith(result, 'part-0-2', 'base64');
    expect(RNFS.appendFile).toHaveBeenNthCalledWith(1, result, 'part-2-2', 'base64');
    expect(RNFS.appendFile).toHaveBeenNthCalledWith(2, result, 'part-4-1', 'base64');
    expect(realm.create).toHaveBeenCalled();
  });

  test('分段大小受上界约束', () => {
    downloadCacheService.configure({ chunkWriteSize: 100 * 1024 * 1024 });

    expect(downloadCacheService.CHUNK_WRITE_SIZE).toBe(downloadCacheService.MAX_CHUNK_WRITE_SIZE);
  });

  test('getCacheStats 返回条目数、占用与配额', async () => {
    downloadCacheService.configure({ maxCacheSize: 1000, reserveRatio: 0.1 });
    const realm = createRealm({
      items: [
        {
          _id: 'cache_a',
          fileId: 'a',
          path: '/cache/attachments/a',
          size: 100,
          lastAccessedAt: new Date(1),
        },
        {
          _id: 'cache_b',
          fileId: 'b',
          path: '/cache/attachments/b',
          size: 300,
          lastAccessedAt: new Date(2),
        },
      ],
    });
    realmService.getRealm.mockResolvedValue(realm);

    const stats = await downloadCacheService.getCacheStats();

    expect(stats).toEqual({
      count: 2,
      totalSize: 400,
      maxCacheSize: 1000,
      reserveBytes: 100,
      usageRatio: 0.4,
    });
  });

  test('removeFromCache 删除文件与索引', async () => {
    const item = {
      _id: 'cache_x',
      fileId: 'x',
      path: '/cache/attachments/x',
      size: 1,
      lastAccessedAt: new Date(1),
    };
    const realm = createRealm({ primary: item });
    realmService.getRealm.mockResolvedValue(realm);

    await expect(downloadCacheService.removeFromCache('x')).resolves.toBe(true);

    expect(RNFS.unlink).toHaveBeenCalledWith('/cache/attachments/x');
    expect(realm.delete).toHaveBeenCalledWith(item);
  });

  test('removeFromCache 未命中时返回 false', async () => {
    const realm = createRealm();
    realmService.getRealm.mockResolvedValue(realm);

    await expect(downloadCacheService.removeFromCache('missing')).resolves.toBe(false);

    expect(RNFS.unlink).not.toHaveBeenCalled();
    expect(realm.delete).not.toHaveBeenCalled();
  });

  test('clearCache 清空全部文件与索引', async () => {
    const a = {
      _id: 'cache_a',
      fileId: 'a',
      path: '/cache/attachments/a',
      size: 1,
      lastAccessedAt: new Date(1),
    };
    const b = {
      _id: 'cache_b',
      fileId: 'b',
      path: '/cache/attachments/b',
      size: 2,
      lastAccessedAt: new Date(2),
    };
    const realm = createRealm({ items: [a, b] });
    realmService.getRealm.mockResolvedValue(realm);

    await expect(downloadCacheService.clearCache()).resolves.toBe(2);

    expect(RNFS.unlink).toHaveBeenCalledWith('/cache/attachments/a');
    expect(RNFS.unlink).toHaveBeenCalledWith('/cache/attachments/b');
    expect(realm.delete).toHaveBeenCalledTimes(2);
  });
});
