/**
 * WS-Q 回归：noteService.updateNoteOriginal 的离线回退更新路径
 *
 * 缺陷背景：回退分支用 Object.assign(note, update) 写入，update 可能携带 metadata（'{}'），
 * 会把已打标的 previewText 整块覆盖。本用例强制 updateDocument 失败以进入回退分支，
 * 断言预览元数据被增量合并并刷新，而不是被抹掉。
 */

jest.mock('react-native', () => ({ Alert: {} }));

const mockUpdateDocument = jest.fn();

jest.mock('../../database/realmQueries', () => ({
  findDocuments: jest.fn(),
  findOneDocument: jest.fn(),
  findDocumentById: jest.fn(),
  createDocument: jest.fn(),
  updateDocument: (...args) => mockUpdateDocument(...args),
  deleteDocument: jest.fn(),
}));

jest.mock('../../database/mongoDBAdapter', () => ({
  mongoDBService: { initialize: jest.fn(async () => undefined) },
}));

const mockRealmService = { getRealm: jest.fn() };
jest.mock('../../database/realmService', () => ({
  __esModule: true,
  default: mockRealmService,
}));

const mockNetworkService = { isOnline: jest.fn(() => false), checkConnection: jest.fn(async () => false) };
jest.mock('../../network/networkService', () => ({ networkService: mockNetworkService }));

jest.mock('../../../utils/logService', () => ({
  logService: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../../files/fileService', () => ({ fileService: {} }));

jest.mock('../permanentStorageManager', () => ({
  __esModule: true,
  default: {
    initialize: jest.fn(async () => undefined),
    createNote: jest.fn(),
    getNote: jest.fn(),
    updateNote: jest.fn(),
  },
}));

const noteService = require('../noteService');

describe('noteService.updateNoteOriginal 回退更新不抹预览元数据', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockNetworkService.isOnline.mockReturnValue(false);
  });

  test('回退分支走守卫：previewText 按新正文刷新，自定义键保留', async () => {
    const note = {
      _id: 'note-service-1',
      title: '标题',
      content: '旧正文',
      metadata: JSON.stringify({
        previewText: '旧正文',
        contentLength: 3,
        hasContent: true,
        customKey: 'keep-me',
      }),
    };
    const realm = {
      write: jest.fn((callback) => callback()),
      objectForPrimaryKey: jest.fn(() => note),
    };
    mockRealmService.getRealm.mockResolvedValue(realm);
    // 让主路径失败，强制走 Object.assign 回退分支
    mockUpdateDocument.mockRejectedValue(new Error('updateDocument 失败'));

    const result = await noteService.updateNoteOriginal('note-service-1', {
      content: '更新后的正文',
      metadata: '{}',
    });

    expect(result).toBe(note);
    const metadata = JSON.parse(note.metadata);
    expect(metadata.previewText).toBe('更新后的正文');
    expect(metadata.customKey).toBe('keep-me');
    expect(metadata.hasContent).toBe(true);
  });
});
