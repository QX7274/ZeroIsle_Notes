const apiClient = require('../apiClient').default;
const { generateNoteDataHash } = require('../../data/noteDataHash');

const stores = {
  Note: new Map(),
  NoteBackup: new Map(),
  OfflineQueue: new Map(),
  Category: new Map(),
};

let objectIdCounter = 0;

const makeCollection = (schemaName, values) => {
  const collection = [...values];

  collection.filtered = (query, ...args) => {
    let result = [...collection];
    if (query.includes('note_id == $0')) {
      result = result.filter((item) => item.note_id === args[0]);
    }
    if (query.includes('entity_id == $0')) {
      result = result.filter((item) => item.entity_id === args[0]);
    }
    if (query.includes('status != "synced"')) {
      result = result.filter((item) => item.status !== 'synced');
    }
    if (query.includes('clientOpId == $0')) {
      result = result.filter((item) => item.clientOpId === args[0]);
    }
    if (query.includes('is_deleted == false') || query.includes('is_deleted = false')) {
      result = result.filter((item) => item.is_deleted === false || item.is_deleted == null);
    }
    return makeCollection(schemaName, result);
  };

  collection.sorted = (field, descending = false) => {
    const sorted = [...collection].sort((left, right) => {
      const a = left[field] instanceof Date ? left[field].getTime() : left[field];
      const b = right[field] instanceof Date ? right[field].getTime() : right[field];
      if (a === b) { return 0; }
      return a > b ? 1 : -1;
    });
    return makeCollection(schemaName, descending ? sorted.reverse() : sorted);
  };

  return collection;
};

const realm = {
  write(callback) {
    callback();
  },
  create(schemaName, data) {
    const key = data._id || data.key;
    const previous = stores[schemaName].get(key);
    const record = previous ? { ...previous, ...data } : { ...data };
    stores[schemaName].set(key, record);
    return record;
  },
  objectForPrimaryKey(schemaName, id) {
    return stores[schemaName].get(id) || null;
  },
  objects(schemaName) {
    return makeCollection(schemaName, Array.from(stores[schemaName].values()));
  },
};

jest.mock('../apiClient', () => ({
  __esModule: true,
  default: {
    post: jest.fn(),
  },
}));

jest.mock('../../database/realmService', () => ({
  __esModule: true,
  default: {
    getRealm: jest.fn(async () => realm),
    createObjectId: jest.fn(() => 'generated-id'),
  },
}));

jest.mock('../../app/deviceIdentityService', () => ({
  __esModule: true,
  deviceIdentityService: {
    getDeviceId: jest.fn(async () => 'device-1'),
  },
}));

jest.mock('../../offline/getNotes', () => ({
  getNotesFromOfflineStorage: jest.fn(async () => ({ data: [] })),
}));

jest.mock('../../networkErrorService', () => ({
  __esModule: true,
  default: {
    isNetworkError: jest.fn(() => false),
    handleApiError: jest.fn(),
  },
}));

jest.mock('react-native-fs', () => ({
  readFile: jest.fn(),
  stat: jest.fn(),
}));

jest.mock('react-native-blob-util', () => ({
  fs: {
    readFile: jest.fn(),
  },
}));

jest.mock('../../../config', () => ({
  API_URL: 'http://localhost:8000',
}));

class TestFormData {
  constructor() {
    this._parts = [];
  }

  append(key, value) {
    this._parts.push([key, value]);
  }
}

global.FormData = TestFormData;

const notesApi = require('../notesApi').default;

describe('notesApi P0 contracts', () => {
  beforeEach(() => {
    Object.values(stores).forEach((store) => store.clear());
    apiClient.post.mockReset();
    objectIdCounter = 0;
    require('../../database/realmService').default.createObjectId.mockImplementation(() => `generated-${++objectIdCounter}`);
  });

  it('maps editor image fields to the backend attachment contract', async () => {
    apiClient.post.mockResolvedValue({ file: '/media/note-image.png' });
    const editorForm = {
      _parts: [
        ['image', { uri: 'file:///tmp/note-image.png', type: 'image/png', name: 'note-image.png' }],
        ['note_id', 'note-1'],
      ],
    };

    const result = await notesApi.uploadImage(editorForm, 'note-1');

    expect(apiClient.post).toHaveBeenCalledWith(
      '/api/v1/notes/attachments',
      expect.objectContaining({
        _parts: [
          ['file', expect.objectContaining({ uri: 'file:///tmp/note-image.png' })],
          ['note', 'note-1'],
        ],
      }),
      expect.objectContaining({
        headers: { 'Content-Type': 'multipart/form-data' },
      }),
    );
    expect(result).toEqual({
      success: true,
      url: '/media/note-image.png',
      attachment: { file: '/media/note-image.png' },
    });
  });

  it('keeps the local image usable when the attachment request is offline', async () => {
    apiClient.post.mockRejectedValue(Object.assign(new Error('offline'), { isOfflineError: true }));
    const editorForm = {
      _parts: [
        ['image', { uri: 'content://note-image.png', type: 'image/png', name: 'note-image.png' }],
        ['note_id', 'note-1'],
      ],
    };

    await expect(notesApi.uploadImage(editorForm, 'note-1')).resolves.toMatchObject({
      success: true,
      url: 'content://note-image.png',
      isOffline: true,
    });
  });

  it('autosaves note content and exposes newest-first local history', async () => {
    const created = await notesApi.createNote({ _id: 'note-1', title: '标题', content: '初始内容' });

    await notesApi.autoSaveNote(created.data.id, { content: '第一次保存' });
    await notesApi.autoSaveNote(created.data.id, { content: '第二次保存' });

    const history = await notesApi.getNoteHistory('note-1');
    expect(history).toHaveLength(2);
    expect(history[0].content).toBe('第二次保存');
    expect(history[0].version_number).toBe(2);
    await expect(notesApi.getNoteVersion('note-1', history[1].version_id)).resolves.toMatchObject({
      content: '第一次保存',
      version_number: 1,
    });
  });

  it('stores the shared data hash when creating a note', async () => {
    const created = await notesApi.createNote({
      _id: 'hash-note',
      title: '完整性标题',
      content: '完整性内容',
      type: 'text',
    });

    expect(created.data.dataHash).toBe(generateNoteDataHash(created.data));
  });

  it('queues a normal note creation with stable device and operation identifiers', async () => {
    const created = await notesApi.createNote({
      _id: 'queued-note-1',
      title: '待同步笔记',
      content: '本地内容',
    });

    expect(stores.OfflineQueue.size).toBe(1);
    expect([...stores.OfflineQueue.values()][0]).toMatchObject({
      entity_id: 'queued-note-1',
      entity_type: 'Note',
      operation: 'create',
      status: 'pending',
      deviceId: 'device-1',
      clientOpId: created.data.clientOpId,
    });
  });

  it('queues a normal note update as a durable operation', async () => {
    const created = await notesApi.createNote({ _id: 'queued-note-2', title: '旧标题', content: '旧内容' });
    stores.OfflineQueue.clear();

    const updated = await notesApi.updateNote(created.data.id, { title: '新标题', content: '新内容' });

    expect(stores.OfflineQueue.size).toBe(1);
    expect([...stores.OfflineQueue.values()][0]).toMatchObject({
      entity_id: 'queued-note-2',
      entity_type: 'Note',
      operation: 'update',
      status: 'pending',
      deviceId: 'device-1',
      clientOpId: updated.data.clientOpId,
    });
  });

  it('queues a normal note deletion as a durable operation', async () => {
    await notesApi.createNote({ _id: 'queued-note-3', title: '待删除', content: '内容' });
    stores.OfflineQueue.clear();

    await notesApi.deleteNote('queued-note-3');

    expect(stores.OfflineQueue.size).toBe(1);
    expect([...stores.OfflineQueue.values()][0]).toMatchObject({
      entity_id: 'queued-note-3',
      entity_type: 'Note',
      operation: 'delete',
      status: 'pending',
      deviceId: 'device-1',
    });
  });

  it('restores a version while preserving the current content as a backup', async () => {
    await notesApi.createNote({ _id: 'note-restore', title: '标题', content: '原始内容' });
    await notesApi.autoSaveNote('note-restore', { content: '新内容' });
    const history = await notesApi.getNoteHistory('note-restore');

    const restored = await notesApi.restoreNoteVersion('note-restore', history[0].version_id);

    expect(restored).toMatchObject({ id: 'note-restore', content: '新内容' });
    expect((await notesApi.getNoteHistory('note-restore')).length).toBe(2);
  });

  it('persists an offline note and deduplicates a repeated client operation', async () => {
    const offlineNote = { id: 'offline-1', title: '离线笔记', content: '待同步', clientOpId: 'op-1' };

    const first = await notesApi.saveOfflineNote(offlineNote);
    const second = await notesApi.saveOfflineNote(offlineNote);

    expect(first).toMatchObject({ success: true, isOffline: true, note: { id: 'offline-1', isOffline: true } });
    expect(second.note.content).toBe('待同步');
    expect(stores.OfflineQueue.size).toBe(1);
  });

  it('returns stable local categories without deleted records', async () => {
    stores.Category.set('cat-2', { _id: 'cat-2', id: 'cat-2', name: '工作', is_deleted: false });
    stores.Category.set('cat-1', { _id: 'cat-1', id: 'cat-1', name: '学习', is_deleted: false });
    stores.Category.set('cat-3', { _id: 'cat-3', id: 'cat-3', name: '隐藏', is_deleted: true });

    await expect(notesApi.getNoteCategories()).resolves.toEqual({
      success: true,
      data: [
        { _id: 'cat-2', id: 'cat-2', name: '工作', is_deleted: false },
        { _id: 'cat-1', id: 'cat-1', name: '学习', is_deleted: false },
      ],
      isOffline: true,
    });
  });
});
