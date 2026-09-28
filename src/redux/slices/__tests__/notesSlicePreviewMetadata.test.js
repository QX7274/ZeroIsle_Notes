/**
 * 直写入口回归（RISK-LIST-UNTAGGED-001）：
 * notesSlice.createNote 直写 Realm 时必须先打列表预览标，
 * 否则首页 summary 列表会因为缺 previewText 回退全量渲染。
 */

const createFakeRealm = () => ({
  write: jest.fn((fn) => fn()),
  create: jest.fn((type, data) => ({ ...data })),
  objectForPrimaryKey: jest.fn(() => null),
  objects: jest.fn(() => ({ filtered: jest.fn(() => []) })),
});

const mockRealmRef = { current: null };

jest.mock('../../../services/api/notesApi', () => ({
  __esModule: true,
  default: {
    createNote: jest.fn(async () => ({ success: true, data: { id: 'note-1' } })),
  },
}));

jest.mock('../../../services/api/autoClassificationApi', () => ({}));

jest.mock('../../../services/database/realmService', () => ({
  __esModule: true,
  default: {
    getRealm: jest.fn(async () => mockRealmRef.current),
    createObjectId: jest.fn(() => 'generated-id'),
  },
}));

const { configureStore } = require('@reduxjs/toolkit');
const notesSliceModule = require('../notesSlice');

const notesReducer = notesSliceModule.default;
const { createNote } = notesSliceModule;

describe('notesSlice.createNote 落库打标', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRealmRef.current = createFakeRealm();
  });

  it('realm.create 收到的 payload metadata 含 previewText', async () => {
    const store = configureStore({ reducer: { notes: notesReducer } });

    await store.dispatch(
      createNote({ id: 'note-1', title: '标题', content: '# 标题\n正文' }),
    );

    const realm = mockRealmRef.current;
    const noteCalls = realm.create.mock.calls.filter(([schema]) => schema === 'Note');
    expect(noteCalls).toHaveLength(1);

    const payload = noteCalls[0][1];
    expect(payload.id).toBe('note-1');
    expect(JSON.parse(payload.metadata)).toMatchObject({
      previewText: '标题 正文',
      hasContent: true,
    });
  });
});
