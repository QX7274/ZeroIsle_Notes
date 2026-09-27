const mockStores = {
  Note: new Map(),
  NoteBackup: new Map(),
  OfflineQueue: new Map(),
};

const mockCollection = values => {
  const collection = [...values];
  collection.filtered = (query, ...args) => {
    let result = [...collection];
    if (query.includes('clientOpId == $0')) {
      result = result.filter(item => item.clientOpId === args[0]);
    }
    if (query.includes('deviceId == $1')) {
      result = result.filter(item => item.deviceId === args[1]);
    }
    if (query.includes('status != "synced"')) {
      result = result.filter(item => item.status !== 'synced');
    }
    return mockCollection(result);
  };
  return collection;
};

const mockRealm = {
  write(callback) {
    callback();
  },
  create(schemaName, data) {
    const record = { ...data };
    mockStores[schemaName].set(record._id, record);
    return record;
  },
  objectForPrimaryKey(schemaName, id) {
    return mockStores[schemaName].get(id) || null;
  },
  objects(schemaName) {
    return mockCollection(Array.from(mockStores[schemaName].values()));
  },
};

const mockRealmService = {
  getRealm: jest.fn(async () => mockRealm),
  createObjectId: jest.fn(() => 'generated-id'),
  getCurrentUser: jest.fn(() => null),
};

const mockApiClient = {
  post: jest.fn(),
};

const mockNetworkService = {
  isOnline: jest.fn(() => false),
};

jest.mock('react-native', () => ({ Alert: {} }));
jest.mock('../../database/realmService', () => ({
  __esModule: true,
  default: mockRealmService,
}));
jest.mock('../../database/mongoDBAdapter', () => ({
  mongoDBService: { initialize: jest.fn(async () => undefined) },
}));
jest.mock('../../api/apiClient', () => ({
  __esModule: true,
  default: mockApiClient,
}));
jest.mock('../../network/networkService', () => ({
  networkService: mockNetworkService,
}));
jest.mock('../../../utils/logService', () => ({
  logService: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock('../../../models', () => ({
  OfflineQueue: {},
  SearchIndex: { createOrUpdate: jest.fn() },
}));
jest.mock('../../files/fileService', () => ({ fileService: {} }));
jest.mock('../../storage/offlineDataService', () => ({
  __esModule: true,
  default: { initialize: jest.fn(async () => undefined) },
}));
jest.mock('../../app/deviceIdentityService', () => ({
  deviceIdentityService: { getDeviceId: jest.fn(async () => 'device-test') },
}));

const { EnhancedNoteService } = require('../enhancedNoteService');
const { generateNoteDataHash } = require('../../data/noteDataHash');

describe('EnhancedNoteService data integrity', () => {
  beforeEach(() => {
    Object.values(mockStores).forEach(store => store.clear());
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('hashes the canonical note persisted by createNote', async () => {
    const service = new EnhancedNoteService();

    const created = await service.createNote({
      _id: 'note-canonical-hash',
      title: 'Canonical hash',
      content: '',
    });

    expect(created.dataHash).toBe(generateNoteDataHash(created));
    expect(service.validateDataIntegrity(created)).toBe(true);
    service.destroy();
  });

  it('syncs the editor note through the authenticated HTTP sync contract', async () => {
    const service = new EnhancedNoteService();
    const created = await service.createNote({
      _id: 'note-http-sync',
      title: 'HTTP同步标题',
      content: 'HTTP同步内容',
    });
    mockNetworkService.isOnline.mockReturnValue(true);
    mockApiClient.post.mockResolvedValue({ success: true, data: { updated: 1 } });

    await service.syncNoteToServer(created._id);

    expect(mockApiClient.post).toHaveBeenCalledWith(
      '/sync/notes/',
      expect.objectContaining({
        notes: [expect.objectContaining({
          _id: 'note-http-sync',
          clientOpId: expect.any(String),
          deviceId: 'device-test',
        })],
      }),
    );
    expect([...mockStores.OfflineQueue.values()]).toEqual(
      expect.arrayContaining([expect.objectContaining({
        entity_id: 'note-http-sync',
        status: 'synced',
        clientOpId: expect.any(String),
      })]),
    );
    service.destroy();
  });
});
