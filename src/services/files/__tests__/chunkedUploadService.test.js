jest.mock('react-native-fs', () => ({
  read: jest.fn(),
  hash: jest.fn(),
}));

jest.mock('../../database/realmService', () => ({
  __esModule: true,
  default: {
    getRealm: jest.fn(),
    createObjectId: jest.fn(() => 'object-id'),
  },
}));

jest.mock('../../api/apiClient', () => ({
  __esModule: true,
  default: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

jest.mock('../../app/deviceIdentityService', () => ({
  __esModule: true,
  deviceIdentityService: { getDeviceId: jest.fn(() => Promise.resolve('device-1')) },
  default: { getDeviceId: jest.fn(() => Promise.resolve('device-1')) },
}));

jest.mock('../../network/networkService', () => ({
  __esModule: true,
  networkService: { isOnline: jest.fn(() => true) },
  default: { isOnline: jest.fn(() => true) },
}));

jest.mock('../../../utils/logService', () => ({
  logService: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const RNFS = require('react-native-fs');
const realmService = require('../../database/realmService').default;
const apiClient = require('../../api/apiClient').default;
const networkService = require('../../network/networkService').networkService;
const { chunkedUploadService } = require('../chunkedUploadService');
const { Buffer } = require('buffer');

describe('chunkedUploadService server-authoritative resume', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    RNFS.hash.mockResolvedValue('a'.repeat(64));
  });

  test('reconciles the server offset before reading the next local chunk', async () => {
    const session = {
      sessionId: 'up-1',
      fileId: 'up-1',
      localPath: '/data/sample.bin',
      fileSize: 4,
      chunkSize: 2,
      uploadedBytes: 0,
      status: 'paused',
      retryCount: 0,
      updatedAt: new Date(),
      deviceId: 'device-1',
      clientOpId: 'op-1',
    };
    const realm = {
      objects: jest.fn(() => ({
        filtered: jest.fn(() => [session]),
      })),
      write: jest.fn((callback) => callback()),
    };
    realmService.getRealm.mockResolvedValue(realm);
    apiClient.get.mockResolvedValue({
      sessionId: 'up-1',
      fileId: 'up-1',
      uploadedBytes: 2,
      totalSize: 4,
      chunkSize: 2,
      status: 'uploading',
    });
    apiClient.post
      .mockResolvedValueOnce({ uploadedBytes: 4 })
      .mockResolvedValueOnce({ url: 'https://example.test/sample.bin' });
    RNFS.read.mockResolvedValue('YWI=');
    networkService.isOnline.mockReturnValue(true);

    const result = await chunkedUploadService.resumeUpload({
      sessionId: 'up-1',
      onProgress: jest.fn(),
    });

    expect(apiClient.get).toHaveBeenCalledWith('/files/upload/up-1/status/');
    expect(RNFS.read).toHaveBeenCalledWith('/data/sample.bin', 2, 2, 'base64');
    expect(session.uploadedBytes).toBe(4);
    expect(result.success).toBe(true);
    expect(result.remoteUrl).toBe('https://example.test/sample.bin');
    expect(apiClient.post.mock.calls[1][1].sha256).toBe('a'.repeat(64));
  });

  test('sends each chunk as bounded binary data with server-authoritative headers', async () => {
    apiClient.post.mockResolvedValue({ uploadedBytes: 3 });

    await chunkedUploadService._uploadChunk({
      sessionId: 'up-1',
      fileId: 'up-1',
      fileSize: 5,
      chunkSize: 3,
      deviceId: 'device-1',
      clientOpId: 'op-1',
    }, 'YWJj', 0);

    const [url, body, config] = apiClient.post.mock.calls[0];
    expect(url).toBe('/files/upload/chunk/');
    expect(Buffer.isBuffer(body)).toBe(true);
    expect(body.toString('utf8')).toBe('abc');
    expect(config.headers).toEqual(expect.objectContaining({
      'Content-Type': 'application/octet-stream',
      'X-Upload-Session': 'up-1',
      'X-Upload-Offset': '0',
      'X-Upload-Chunk-Index': '0',
      'X-Upload-Total-Size': '5',
    }));
  });

  test('uses the server-provided chunk size when creating a new session', async () => {
    const createdSession = {};
    const realm = {
      objects: jest.fn(() => ({ filtered: jest.fn(() => []) })),
      create: jest.fn((_schema, values) => {
        Object.assign(createdSession, values);
        return createdSession;
      }),
      write: jest.fn((callback) => callback()),
    };
    realmService.getRealm.mockResolvedValue(realm);
    apiClient.post
      .mockResolvedValueOnce({ sessionId: 'up-1', fileId: 'up-1', chunkSize: 4096 })
      .mockResolvedValueOnce({ uploadedBytes: 1 })
      .mockResolvedValueOnce({ url: 'https://example.test/sample.bin' });
    RNFS.read.mockResolvedValue('YQ==');

    await chunkedUploadService.startUpload({
      uri: '/data/sample.bin',
      size: 1,
      name: 'sample.bin',
      type: 'application/octet-stream',
    });

    expect(createdSession.chunkSize).toBe(4096);
  });
});
