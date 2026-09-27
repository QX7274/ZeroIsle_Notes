const localNotes = [];

const mockRealm = {
  objects: jest.fn(() => {
    const collection = [...localNotes];
    collection.filtered = jest.fn(() => collection);
    return collection;
  }),
};

jest.mock('../../../config', () => ({
  DEV_MODE_CONFIG: {
    ENABLED: true,
    DEV_ACCOUNT: { id: 'dev-account-001', username: 'developer' },
    FEATURES: { SKIP_LOGIN_SCREEN: true },
  },
}));
jest.mock('../../network/networkService', () => ({
  __esModule: true,
  default: { checkConnection: jest.fn(async () => true) },
}));
jest.mock('../../database/realmService', () => ({
  __esModule: true,
  default: { getRealm: jest.fn(async () => mockRealm) },
}));
jest.mock('../../auth/authStorage', () => ({
  __esModule: true,
  default: { getUser: jest.fn(async () => null) },
}));

const { getNotesFromOfflineStorage } = require('../getNotes');

describe('getNotesFromOfflineStorage developer context', () => {
  beforeEach(() => {
    localNotes.splice(0, localNotes.length);
    jest.clearAllMocks();
  });

  test('loads local Realm notes when developer mode skips login', async () => {
    localNotes.push({
      _id: 'paged-note-after-restart',
      id: 'paged-note-after-restart',
      title: '重启后仍可见',
      type: 'paged_note',
      is_deleted: false,
    });

    const result = await getNotesFromOfflineStorage();

    expect(result.success).toBe(true);
    expect(result.data).toEqual(localNotes);
  });
});
