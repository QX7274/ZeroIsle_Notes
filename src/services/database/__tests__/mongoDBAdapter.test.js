const mockRealmService = {
  initialize: jest.fn(async () => undefined),
  create: jest.fn(async () => ({ _id: 'note-1' })),
  findOne: jest.fn(async () => ({ _id: 'note-1' })),
};

jest.mock('../realmService', () => ({
  __esModule: true,
  default: mockRealmService,
}));

const mongoDBService = require('../mongoDBAdapter').default;

describe('mongoDBAdapter Realm schema aliases', () => {
  beforeEach(() => {
    mockRealmService.create.mockClear();
    mockRealmService.findOne.mockClear();
  });

  it('maps the logical notes collection to the registered Note schema', async () => {
    await mongoDBService.insertOne('notes', { _id: 'note-1', title: '标题' });
    await mongoDBService.findOne('notes', { _id: 'note-1' });

    expect(mockRealmService.create).toHaveBeenCalledWith('Note', { _id: 'note-1', title: '标题' });
    expect(mockRealmService.findOne).toHaveBeenCalledWith('Note', { _id: 'note-1' });
  });
});
