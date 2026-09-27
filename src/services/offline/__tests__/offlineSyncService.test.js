const mockApiClient = {
  post: jest.fn(),
};

const mockRealm = {
  write(callback) {
    callback();
  },
  objects: jest.fn(),
};

const mockRealmService = {
  initialized: true,
  getRealm: jest.fn(async () => mockRealm),
};

const mockNetworkService = {
  isOnline: jest.fn(() => true),
};

const mockConfigService = {
  initialize: jest.fn(async () => undefined),
  getConfig: jest.fn(async () => ({ sync: { autoSync: false } })),
};

jest.mock('../../api/apiClient', () => ({
  __esModule: true,
  default: mockApiClient,
}));

jest.mock('../../database/realmService', () => ({
  __esModule: true,
  default: mockRealmService,
}));

jest.mock('../../database/mongoDBAdapter', () => ({
  mongoDBService: {
    initialize: jest.fn(async () => undefined),
  },
}));

jest.mock('../../network/networkService', () => ({
  networkService: mockNetworkService,
}));

jest.mock('../../app/configService', () => ({
  configService: mockConfigService,
}));

const makeCollection = (items) => {
  const collection = [...items];
  collection.filtered = (query) => {
    if (query.includes('clientOpId') || query.includes('entity_type == $0')) {
      return makeCollection([]);
    }
    return makeCollection(collection);
  };
  collection.sorted = () => collection;
  return collection;
};

const { OfflineSyncService } = require('../offlineSyncService');

describe('OfflineSyncService Realm queue replay', () => {
  let service;
  let queueItem;

  beforeEach(() => {
    service = new OfflineSyncService();
    queueItem = {
      _id: 'queue-note-1',
      entity_id: 'note-1',
      entity_type: 'Note',
      operation: 'update',
      data: JSON.stringify({ _id: 'note-1', title: '本地标题', content: '本地内容' }),
      status: 'pending',
      retry_count: 0,
      created_at: new Date('2026-07-19T00:00:00.000Z'),
      updated_at: new Date('2026-07-19T00:00:00.000Z'),
      clientOpId: 'note-op-1',
      deviceId: 'device-1',
    };
    mockRealm.objects.mockImplementation(() => makeCollection([queueItem]));
    mockApiClient.post.mockReset();
  });

  test('posts pending note mutations to the authenticated sync endpoint and acknowledges success', async () => {
    mockApiClient.post.mockResolvedValue({ success: true, data: { updated: 1 } });

    const result = await service.processOfflineQueue();

    expect(mockApiClient.post).toHaveBeenCalledWith(
      '/sync/notes/',
      expect.objectContaining({
        notes: [expect.objectContaining({
          _id: 'note-1',
          _operation: 'update',
          clientOpId: 'note-op-1',
          deviceId: 'device-1',
        })],
      }),
    );
    expect(queueItem.status).toBe('synced');
    expect(result).toMatchObject({ processed: 1, failed: 0, success: true });
  });

  test('detects pending Realm OfflineQueue items for automatic sync', async () => {
    await expect(service.hasPendingOfflineQueue()).resolves.toBe(true);
  });

  test('retains a pending note mutation and increments retry metadata when the server fails', async () => {
    mockApiClient.post.mockRejectedValue(new Error('server unavailable'));
    service._backoffByRetryCount = jest.fn(async () => undefined);

    const result = await service.processOfflineQueue();

    expect(queueItem.status).toBe('pending');
    expect(queueItem.retry_count).toBe(1);
    expect(queueItem.error).toBe('server unavailable');
    expect(result).toMatchObject({ processed: 0, failed: 1, success: false });
  });
});
