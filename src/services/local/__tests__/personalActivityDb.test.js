jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
}));

jest.mock('uuid', () => ({
  v4: jest.fn(() => 'draft-1'),
}));

const AsyncStorage = require('@react-native-async-storage/async-storage');
const personalActivityDb = require('../personalActivityDb').default;

describe('personalActivityDb.saveDraft', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.getItem.mockResolvedValue('[]');
    AsyncStorage.setItem.mockResolvedValue(undefined);
  });

  test('returns the newly created draft', async () => {
    await expect(personalActivityDb.saveDraft({ title: '草稿' })).resolves.toEqual(
      expect.objectContaining({ _id: 'draft-1', title: '草稿' }),
    );
  });
});
