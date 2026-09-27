jest.mock('react-native-fs', () => ({
  CachesDirectoryPath: '/cache',
  exists: jest.fn(),
  mkdir: jest.fn(),
  copyFile: jest.fn(),
  unlink: jest.fn(),
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
