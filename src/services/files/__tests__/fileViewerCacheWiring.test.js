const fs = require('fs');
const path = require('path');

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
const { buildCacheSaveMetadata } = require('../cacheSaveMetadata');

const SCREEN_PATH = path.resolve(__dirname, '../../../screens/common/FileViewerScreen.js');
const SCREEN_SOURCE = fs.readFileSync(SCREEN_PATH, 'utf8');

/**
 * 提取 callee(...) 的括号内源码（括号计数，测试用例中不含嵌套括号字符串）
 */
const extractCallArguments = (source, callee) => {
  const calleeIndex = source.indexOf(callee);
  if (calleeIndex === -1) {
    return null;
  }
  const openIndex = source.indexOf('(', calleeIndex);
  if (openIndex === -1) {
    return null;
  }

  let depth = 0;
  for (let i = openIndex; i < source.length; i += 1) {
    const char = source[i];
    if (char === '(') {
      depth += 1;
    } else if (char === ')') {
      depth -= 1;
      if (depth === 0) {
        return source.slice(openIndex + 1, i);
      }
    }
  }
  return null;
};

const createRealm = () => {
  const results = [];
  results.sorted = jest.fn(() => results);
  return {
    objects: jest.fn(() => results),
    objectForPrimaryKey: jest.fn(() => null),
    write: jest.fn((callback) => callback()),
    create: jest.fn(),
    delete: jest.fn(),
  };
};

describe('FileViewerScreen 缓存写入接线（静态契约）', () => {
  test('从文件记录构建校验元数据并展开传入 saveToCache', () => {
    expect(SCREEN_SOURCE).toContain(
      "import { buildCacheSaveMetadata } from '../../services/files/cacheSaveMetadata';"
    );
    expect(SCREEN_SOURCE).toMatch(/const cacheMetadata = buildCacheSaveMetadata\(route\.params, \{/);

    const args = extractCallArguments(SCREEN_SOURCE, 'downloadCacheService.saveToCache');
    expect(args).not.toBeNull();
    expect(args).toContain('...cacheMetadata');
    // 既有字段保持不变
    expect(args).toContain('name');
    expect(args).toContain('extension');
  });
});

describe('文件记录的 sha256/expectedSize 会驱动 saveToCache 校验', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    downloadCacheService.initialized = false;
    downloadCacheService.configure({
      maxCacheSize: 2 * 1024 * 1024 * 1024,
      reserveRatio: 0.1,
      chunkWriteThreshold: 8 * 1024 * 1024,
      chunkWriteSize: 1024 * 1024,
    });
    RNFS.exists.mockResolvedValue(false);
    RNFS.hash.mockResolvedValue('a'.repeat(64));
    RNFS.stat.mockResolvedValue({ size: 10 });
  });

  test('文件记录带 sha256 时会传入并触发 hash 校验', async () => {
    const realm = createRealm();
    realmService.getRealm.mockResolvedValue(realm);

    // 模拟 FileViewerScreen：route.params 即文件记录
    const record = { sha256: 'A'.repeat(64), size: 10 };
    const metadata = buildCacheSaveMetadata(record, { size: 10 });

    const result = await downloadCacheService.saveToCache('remote', '/tmp/remote.bin', {
      name: 'remote.bin',
      extension: 'bin',
      ...metadata,
    });

    expect(metadata.sha256).toBe('a'.repeat(64));
    expect(metadata.expectedSize).toBe(10);
    expect(RNFS.hash).toHaveBeenCalledWith(result, 'sha256');
    expect(realm.create).toHaveBeenCalled();
  });

  test('文件记录缺少校验字段时行为与现在一致（不触发 hash）', async () => {
    const realm = createRealm();
    realmService.getRealm.mockResolvedValue(realm);

    const metadata = buildCacheSaveMetadata({ title: 'plain.bin' }, { size: 12 });

    const result = await downloadCacheService.saveToCache('plain', '/tmp/plain.bin', {
      name: 'plain.bin',
      extension: 'bin',
      ...metadata,
    });

    expect(metadata).toEqual({ size: 12 });
    expect(RNFS.hash).not.toHaveBeenCalled();
    expect(RNFS.copyFile).toHaveBeenCalledWith('/tmp/plain.bin', result);
    expect(realm.create).toHaveBeenCalledWith(
      'FileCacheIndex',
      expect.objectContaining({ fileId: 'plain', path: result, size: 12 }),
      'modified'
    );
  });
});
