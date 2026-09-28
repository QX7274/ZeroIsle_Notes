/**
 * cachePerfService 单测（WS-S）
 *
 * 不真的写 512MB：RNFS 与 downloadCacheService 都注入伪实现，
 * 覆盖分段边界 / 内存上界 / 统计返回 / 失败收敛 / 配额淘汰 / dev 守卫 / 清理幂等。
 */

jest.mock('react-native-fs', () => ({
  CachesDirectoryPath: '/cache',
  TemporaryDirectoryPath: '/tmp',
  exists: jest.fn(),
  mkdir: jest.fn(),
  unlink: jest.fn(),
  writeFile: jest.fn(),
  appendFile: jest.fn(),
  copyFile: jest.fn(),
  stat: jest.fn(),
  read: jest.fn(),
  hash: jest.fn(),
}));

jest.mock('../../../config', () => ({
  CACHE_CONFIG: {
    MAX_CACHE_SIZE: 2 * 1024 * 1024 * 1024,
    RESERVE_RATIO: 0.1,
    CHUNK_WRITE_THRESHOLD: 8 * 1024 * 1024,
    CHUNK_WRITE_SIZE: 1024 * 1024,
    MAX_CHUNK_WRITE_SIZE: 4 * 1024 * 1024,
  },
}));

jest.mock('../../database/realmService', () => ({
  __esModule: true,
  default: { getRealm: jest.fn() },
}));

jest.mock('../../../utils/logService', () => ({
  logService: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const {
  DEFAULT_PERF_FILE_SIZE,
  DEFAULT_PERF_FILE_CHUNK,
  MAX_PERF_FILE_CHUNK,
  DEFAULT_PERF_CACHE_FILE_ID,
  getDefaultLargeFilePath,
  createLargeFile,
  runCacheWriteBenchmark,
  runQuotaEvictionCheck,
  cleanupLargeFile,
} = require('../cachePerfService');

const MB = 1024 * 1024;

/** 伪 RNFS：把写入长度记下来，用来断言「单次写入不超过 chunkBytes」 */
const createFakeRnfs = () => {
  const files = new Map();
  const writes = [];
  return {
    files,
    writes,
    TemporaryDirectoryPath: '/tmp',
    CachesDirectoryPath: '/cache',
    exists: jest.fn(async (path) => files.has(path)),
    unlink: jest.fn(async (path) => {
      files.delete(path);
    }),
    writeFile: jest.fn(async (path, data) => {
      const text = String(data);
      writes.push({ op: 'writeFile', path, length: text.length });
      files.set(path, text.length);
    }),
    appendFile: jest.fn(async (path, data) => {
      const text = String(data);
      writes.push({ op: 'appendFile', path, length: text.length });
      files.set(path, (files.get(path) || 0) + text.length);
    }),
  };
};

/** 伪缓存服务：configure 语义与 DownloadCacheService 保持一致 */
const createFakeCacheService = () => ({
  CACHE_DIR: '/cache/attachments',
  MAX_CACHE_SIZE: 2 * 1024 * 1024 * 1024,
  RESERVE_RATIO: 0.1,
  CHUNK_WRITE_THRESHOLD: 8 * MB,
  CHUNK_WRITE_SIZE: 1 * MB,
  MAX_CHUNK_WRITE_SIZE: 4 * MB,
  configure: jest.fn(function configure(payload = {}) {
    if (Number.isFinite(payload.chunkWriteSize) && payload.chunkWriteSize > 0) {
      this.CHUNK_WRITE_SIZE = Math.min(payload.chunkWriteSize, this.MAX_CHUNK_WRITE_SIZE);
    }
    if (Number.isFinite(payload.chunkWriteThreshold) && payload.chunkWriteThreshold > 0) {
      this.CHUNK_WRITE_THRESHOLD = payload.chunkWriteThreshold;
    }
    return this;
  }),
  saveToCache: jest.fn(async () => '/cache/attachments/' + DEFAULT_PERF_CACHE_FILE_ID),
});

const captureLogs = () => {
  const lines = [];
  const logSpy = jest.spyOn(console, 'log').mockImplementation((...args) => {
    lines.push(String(args[0]));
  });
  const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  return {
    lines,
    restore() {
      logSpy.mockRestore();
      warnSpy.mockRestore();
    },
  };
};

describe('createLargeFile 有界分段生成', () => {
  it('size 不是 chunk 整数倍时按段推进，末段取余且单次写入不超过 chunkBytes', async () => {
    const rnfs = createFakeRnfs();
    const sizeBytes = 10 * MB + 123;
    const chunkBytes = 4 * MB;

    const result = await createLargeFile({ path: '/tmp/big.bin', sizeBytes, chunkBytes, rnfs });

    expect(result.segments).toBe(3);
    expect(result.sizeBytes).toBe(sizeBytes);
    expect(result.writtenBytes).toBe(sizeBytes);
    expect(rnfs.writeFile).toHaveBeenCalledTimes(1);
    expect(rnfs.appendFile).toHaveBeenCalledTimes(2);
    expect(rnfs.writes.map((item) => item.length)).toEqual([4 * MB, 4 * MB, 2 * MB + 123]);
    // 内存上界：任何一次写入都不超过 chunkBytes
    expect(Math.max(...rnfs.writes.map((item) => item.length))).toBeLessThanOrEqual(chunkBytes);
    expect(rnfs.files.get('/tmp/big.bin')).toBe(sizeBytes);
  });

  it('超过上界的 chunkBytes 会被夹到 4MB', async () => {
    const rnfs = createFakeRnfs();

    const result = await createLargeFile({
      path: '/tmp/big.bin',
      sizeBytes: 5 * MB,
      chunkBytes: 100 * MB,
      rnfs,
    });

    expect(result.segments).toBe(2);
    expect(Math.max(...rnfs.writes.map((item) => item.length))).toBeLessThanOrEqual(MAX_PERF_FILE_CHUNK);
  });

  it('默认参数是 512MB / 4MB，默认路径落在临时目录', () => {
    expect(DEFAULT_PERF_FILE_SIZE).toBe(512 * MB);
    expect(DEFAULT_PERF_FILE_CHUNK).toBe(4 * MB);
    expect(getDefaultLargeFilePath({ TemporaryDirectoryPath: '/tmp', CachesDirectoryPath: '/cache' }))
      .toBe('/tmp/cache-perf-512mb.bin');
  });
});

describe('runCacheWriteBenchmark 统计与日志', () => {
  it('调用 saveToCache 并返回统计，日志含稳定可 grep 的 start/finish', async () => {
    const logs = captureLogs();
    try {
      const cacheService = createFakeCacheService();

      const result = await runCacheWriteBenchmark({
        filePath: '/tmp/big.bin',
        sizeBytes: 512 * MB,
        chunkWriteSize: 4 * MB,
        cacheService,
      });

      expect(cacheService.saveToCache).toHaveBeenCalledWith(
        DEFAULT_PERF_CACHE_FILE_ID,
        '/tmp/big.bin',
        { size: 512 * MB },
      );
      expect(result.success).toBe(true);
      expect(result.segments).toBe(128);
      expect(result.writtenBytes).toBe(512 * MB);
      expect(result.destPath).toBe('/cache/attachments/' + DEFAULT_PERF_CACHE_FILE_ID);
      expect(typeof result.elapsedMs).toBe('number');

      expect(logs.lines.some((line) => line.startsWith('[cachePerf] write start'))).toBe(true);
      expect(logs.lines.some((line) => line.startsWith('[cachePerf] write finish ok=true'))).toBe(true);
      expect(logs.lines.find((line) => line.startsWith('[cachePerf] write start')))
        .toContain('size=' + 512 * MB);
    } finally {
      logs.restore();
    }
  });

  it('saveToCache 失败时收敛为 success=false，不抛未处理异常', async () => {
    const logs = captureLogs();
    try {
      const cacheService = createFakeCacheService();
      cacheService.saveToCache.mockRejectedValue(new Error('磁盘空间不足'));

      const result = await runCacheWriteBenchmark({
        filePath: '/tmp/big.bin',
        sizeBytes: 512 * MB,
        cacheService,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('磁盘空间不足');
      expect(logs.lines.some((line) => line.includes('write finish ok=false'))).toBe(true);
    } finally {
      logs.restore();
    }
  });
});

describe('runQuotaEvictionCheck 配额淘汰（纯逻辑）', () => {
  const entries = [
    { key: 'old', size: 60, lastAccessedAt: 1 },
    { key: 'new', size: 50, lastAccessedAt: 2 },
  ];

  it('超配额时按 LRU 淘汰到预算内', () => {
    const result = runQuotaEvictionCheck({
      maxCacheSize: 100,
      reserveRatio: 0,
      incomingBytes: 20,
      entries,
    });

    expect(result.evictions.map((item) => item.key)).toEqual(['old']);
    expect(result.evictedBytes).toBe(60);
    expect(result.evictedCount).toBe(1);
    expect(result.totalAfter).toBe(50);
    expect(result.withinBudget).toBe(true);
  });

  it('预留余量生效：预算 = maxCacheSize - reserveBytes', () => {
    const result = runQuotaEvictionCheck({
      maxCacheSize: 100,
      reserveRatio: 0.2,
      incomingBytes: 0,
      entries,
    });

    expect(result.reserveBytes).toBe(20);
    expect(result.budgetBytes).toBe(80);
    expect(result.totalBefore).toBe(110);
    expect(result.evictions.map((item) => item.key)).toEqual(['old']);
    expect(result.totalAfter).toBe(50);
  });

  it('未超配额时不淘汰', () => {
    const result = runQuotaEvictionCheck({
      maxCacheSize: 1000,
      reserveRatio: 0,
      incomingBytes: 10,
      entries,
    });

    expect(result.evictions).toEqual([]);
    expect(result.evictedBytes).toBe(0);
    expect(result.withinBudget).toBe(true);
  });

  it('非法配置回退默认（2GB / 10%）', () => {
    const result = runQuotaEvictionCheck({ maxCacheSize: -1, reserveRatio: 5, entries: [] });

    expect(result.maxCacheSize).toBe(2 * 1024 * 1024 * 1024);
    expect(result.reserveRatio).toBe(0.1);
    expect(result.reserveBytes).toBe(Math.floor(2 * 1024 * 1024 * 1024 * 0.1));
  });
});

describe('dev 守卫与清理幂等', () => {
  it('非 __DEV__ 环境调用直接抛错', async () => {
    const originalDev = global.__DEV__;
    global.__DEV__ = false;
    try {
      await expect(createLargeFile({ path: '/tmp/x.bin', sizeBytes: 1, rnfs: createFakeRnfs() }))
        .rejects.toThrow(/仅允许在开发/);
      await expect(runCacheWriteBenchmark({ cacheService: createFakeCacheService() }))
        .rejects.toThrow(/仅允许在开发/);
      expect(() => runQuotaEvictionCheck({ entries: [] })).toThrow(/仅允许在开发/);
      await expect(cleanupLargeFile('/tmp/x.bin', { rnfs: createFakeRnfs() }))
        .rejects.toThrow(/仅允许在开发/);
    } finally {
      global.__DEV__ = originalDev;
    }
  });

  it('cleanupLargeFile 删除成功后再次调用仍返回 true（幂等）', async () => {
    const rnfs = createFakeRnfs();
    rnfs.files.set('/tmp/big.bin', 123);

    await expect(cleanupLargeFile('/tmp/big.bin', { rnfs })).resolves.toBe(true);
    expect(rnfs.files.has('/tmp/big.bin')).toBe(false);
    await expect(cleanupLargeFile('/tmp/big.bin', { rnfs })).resolves.toBe(true);
  });
});
