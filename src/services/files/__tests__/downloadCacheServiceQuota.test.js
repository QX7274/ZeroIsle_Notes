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

// 用自定义配置替换 src/config，验证服务「初始化时读取配置项」
jest.mock('../../../config', () => ({
  CACHE_CONFIG: {
    MAX_CACHE_SIZE: 1024 * 1024,
    RESERVE_RATIO: 0.25,
    CHUNK_WRITE_THRESHOLD: 4096,
    CHUNK_WRITE_SIZE: 2048,
    MAX_CHUNK_WRITE_SIZE: 8192,
  },
}));

const {
  DownloadCacheService,
  downloadCacheService,
  resolveCacheDefaults,
} = require('../downloadCacheService');

const CONFIGURED = {
  MAX_CACHE_SIZE: 1024 * 1024,
  RESERVE_RATIO: 0.25,
  CHUNK_WRITE_THRESHOLD: 4096,
  CHUNK_WRITE_SIZE: 2048,
  MAX_CHUNK_WRITE_SIZE: 8192,
};

// 内置默认值：src/config 缺失或非法时的回退
const DEFAULT_MAX_CACHE_SIZE = 2 * 1024 * 1024 * 1024;
const DEFAULT_RESERVE_RATIO = 0.1;
const DEFAULT_CHUNK_WRITE_THRESHOLD = 8 * 1024 * 1024;
const DEFAULT_CHUNK_WRITE_SIZE = 1024 * 1024;
const DEFAULT_MAX_CHUNK_WRITE_SIZE = 4 * 1024 * 1024;

describe('downloadCacheService 配额配置项接线', () => {
  test('初始化时读取 src/config 的自定义配额', () => {
    const service = new DownloadCacheService();

    expect(service.MAX_CACHE_SIZE).toBe(CONFIGURED.MAX_CACHE_SIZE);
    expect(service.RESERVE_RATIO).toBe(CONFIGURED.RESERVE_RATIO);
    expect(service.CHUNK_WRITE_THRESHOLD).toBe(CONFIGURED.CHUNK_WRITE_THRESHOLD);
    expect(service.CHUNK_WRITE_SIZE).toBe(CONFIGURED.CHUNK_WRITE_SIZE);
    expect(service.getReservedBytes()).toBe(
      Math.floor(CONFIGURED.MAX_CACHE_SIZE * CONFIGURED.RESERVE_RATIO)
    );
  });

  test('默认单例同样采用配置来源的配额', () => {
    expect(downloadCacheService.MAX_CACHE_SIZE).toBe(CONFIGURED.MAX_CACHE_SIZE);
    expect(downloadCacheService.RESERVE_RATIO).toBe(CONFIGURED.RESERVE_RATIO);
  });

  test('setCacheQuota 采用自定义配额', () => {
    const service = new DownloadCacheService();

    const returned = service.setCacheQuota({ maxCacheSize: 500, reserveRatio: 0.5 });

    expect(returned).toBe(service);
    expect(service.MAX_CACHE_SIZE).toBe(500);
    expect(service.RESERVE_RATIO).toBe(0.5);
    expect(service.getReservedBytes()).toBe(250);
  });

  test('setCacheQuota 忽略非法值并保持原值', () => {
    const service = new DownloadCacheService();
    service.setCacheQuota({ maxCacheSize: 500, reserveRatio: 0.5 });

    service.setCacheQuota({ maxCacheSize: -1, reserveRatio: 2 });
    expect(service.MAX_CACHE_SIZE).toBe(500);
    expect(service.RESERVE_RATIO).toBe(0.5);

    service.setCacheQuota({ maxCacheSize: 0, reserveRatio: 1 });
    expect(service.MAX_CACHE_SIZE).toBe(500);
    expect(service.RESERVE_RATIO).toBe(0.5);
  });

  test('setCacheQuota 无参或部分参数不影响既有配置', () => {
    const service = new DownloadCacheService();
    service.setCacheQuota({ maxCacheSize: 800 });

    service.setCacheQuota();
    service.setCacheQuota({ reserveRatio: undefined });

    expect(service.MAX_CACHE_SIZE).toBe(800);
    expect(service.RESERVE_RATIO).toBe(CONFIGURED.RESERVE_RATIO);
  });

  test('configure 行为保持不变：合法项生效、非法项忽略', () => {
    const service = new DownloadCacheService();

    service.configure({
      maxCacheSize: 4096,
      reserveRatio: 0.2,
      chunkWriteThreshold: 128,
      chunkWriteSize: 64,
    });
    expect(service.MAX_CACHE_SIZE).toBe(4096);
    expect(service.RESERVE_RATIO).toBe(0.2);
    expect(service.CHUNK_WRITE_THRESHOLD).toBe(128);
    expect(service.CHUNK_WRITE_SIZE).toBe(64);

    service.configure({ maxCacheSize: 0, reserveRatio: 1, chunkWriteSize: 100 * 1024 * 1024 });
    expect(service.MAX_CACHE_SIZE).toBe(4096);
    expect(service.RESERVE_RATIO).toBe(0.2);
    expect(service.CHUNK_WRITE_SIZE).toBe(CONFIGURED.MAX_CHUNK_WRITE_SIZE);
  });
});

describe('resolveCacheDefaults 非法配置回退内置默认', () => {
  test('空配置回退到 2GB / 10%', () => {
    const defaults = resolveCacheDefaults({});

    expect(defaults.maxCacheSize).toBe(DEFAULT_MAX_CACHE_SIZE);
    expect(defaults.reserveRatio).toBe(DEFAULT_RESERVE_RATIO);
    expect(defaults.chunkWriteThreshold).toBe(DEFAULT_CHUNK_WRITE_THRESHOLD);
    expect(defaults.chunkWriteSize).toBe(DEFAULT_CHUNK_WRITE_SIZE);
    expect(defaults.maxChunkWriteSize).toBe(DEFAULT_MAX_CHUNK_WRITE_SIZE);
  });

  test('非法配置值被忽略并回退默认', () => {
    const defaults = resolveCacheDefaults({
      MAX_CACHE_SIZE: -1,
      RESERVE_RATIO: 1,
      CHUNK_WRITE_THRESHOLD: 'x',
      CHUNK_WRITE_SIZE: 0,
      MAX_CHUNK_WRITE_SIZE: NaN,
    });

    expect(defaults.maxCacheSize).toBe(DEFAULT_MAX_CACHE_SIZE);
    expect(defaults.reserveRatio).toBe(DEFAULT_RESERVE_RATIO);
    expect(defaults.chunkWriteThreshold).toBe(DEFAULT_CHUNK_WRITE_THRESHOLD);
    expect(defaults.chunkWriteSize).toBe(DEFAULT_CHUNK_WRITE_SIZE);
    expect(defaults.maxChunkWriteSize).toBe(DEFAULT_MAX_CHUNK_WRITE_SIZE);
  });

  test('配置的分段大小受上界约束', () => {
    const defaults = resolveCacheDefaults({ CHUNK_WRITE_SIZE: 99999, MAX_CHUNK_WRITE_SIZE: 4096 });

    expect(defaults.chunkWriteSize).toBe(4096);
  });
});
