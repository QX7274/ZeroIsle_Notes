const apiClient = require('../apiClient').default;
const { generateNoteDataHash } = require('../../data/noteDataHash');

const stores = {
  Note: new Map(),
  NoteBackup: new Map(),
  OfflineQueue: new Map(),
  Category: new Map(),
  SearchIndex: new Map(),
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
  resolveLocalOwnerId: jest.fn(async () => 'dev-account-001'),
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

// 搜索索引模型：断言 notesApi 保存成功后触发增量索引，而不真正写 Realm
jest.mock('../../../models/SearchIndex', () => ({
  __esModule: true,
  default: {
    createOrUpdate: jest.fn(),
  },
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
const SearchIndex = require('../../../models/SearchIndex').default;

describe('notesApi P0 contracts', () => {
  beforeEach(() => {
    Object.values(stores).forEach((store) => store.clear());
    apiClient.post.mockReset();
    SearchIndex.createOrUpdate.mockReset();
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

  it('createNote 在 user_id 缺失时回填解析到的本地 owner，并与离线队列一致', async () => {
    const created = await notesApi.createNote({
      _id: 'owner-note-1',
      title: '无主修复',
      content: '正文',
    });

    expect(stores.Note.get('owner-note-1').user_id).toBe('dev-account-001');
    expect(created.data.user_id).toBe('dev-account-001');
    expect([...stores.OfflineQueue.values()][0].user_id).toBe('dev-account-001');
  });

  it('updateNote 为无主历史笔记回填 owner', async () => {
    stores.Note.set('legacy-note', {
      _id: 'legacy-note',
      id: 'legacy-note',
      title: '历史标题',
      content: '历史正文',
      user_id: '',
      is_deleted: false,
    });

    await notesApi.updateNote('legacy-note', { title: '新标题' });

    expect(stores.Note.get('legacy-note').user_id).toBe('dev-account-001');
  });

  it('saveOfflineNote 在 user_id 缺失时回填 owner，Note 与 OfflineQueue 保持一致', async () => {
    const saved = await notesApi.saveOfflineNote({
      id: 'offline-owner-1',
      title: '离线无主',
      content: '待同步',
      clientOpId: 'op-owner-1',
    });

    expect(stores.Note.get('offline-owner-1').user_id).toBe('dev-account-001');
    const queueItem = [...stores.OfflineQueue.values()][0];
    expect(queueItem.entity_id).toBe('offline-owner-1');
    expect(queueItem.user_id).toBe('dev-account-001');
    expect(saved.note.user_id).toBe('dev-account-001');
  });

  it('owner 解析失败时不阻断保存，且不写入错误 owner', async () => {
    require('../../offline/getNotes').resolveLocalOwnerId.mockResolvedValueOnce(null);

    const created = await notesApi.createNote({
      _id: 'owner-note-2',
      title: '解析失败',
      content: '正文',
    });

    expect(created.success).toBe(true);
    expect(stores.Note.get('owner-note-2').user_id).toBeUndefined();
  });

  it('createNote 落库 metadata 含 previewText 预览字段，并写入搜索增量索引', async () => {
    await notesApi.createNote({
      _id: 'preview-note-1',
      title: '预览标题',
      content: '# 标题\n**正文**内容',
      pages: '[{"id":1}]',
      strokeData: '',
    });

    const metadata = JSON.parse(stores.Note.get('preview-note-1').metadata);
    expect(metadata.previewText).toBe('标题 正文内容');
    expect(metadata.contentLength).toBeGreaterThan(0);
    expect(metadata.hasContent).toBe(true);
    expect(metadata.hasPages).toBe(true);
    expect(metadata.hasStrokeData).toBe(false);

    expect(SearchIndex.createOrUpdate).toHaveBeenCalledWith(
      realm,
      expect.objectContaining({ entity_id: 'preview-note-1', entity_type: 'note' }),
    );
  });

  it('saveOfflineNote 落库 metadata 含 previewText，并写入搜索增量索引', async () => {
    await notesApi.saveOfflineNote({
      id: 'preview-offline-1',
      title: '离线预览',
      content: '> 引用内容',
      clientOpId: 'op-preview-1',
    });

    const metadata = JSON.parse(stores.Note.get('preview-offline-1').metadata);
    expect(metadata.previewText).toBe('引用内容');
    expect(metadata.hasContent).toBe(true);

    expect(SearchIndex.createOrUpdate).toHaveBeenCalledWith(
      realm,
      expect.objectContaining({ entity_id: 'preview-offline-1', entity_type: 'note' }),
    );
  });

  it('updateNote 增量刷新 previewText，并保留调用方已有的 metadata 键', async () => {
    await notesApi.createNote({ _id: 'preview-note-2', title: '标题', content: '旧内容' });

    await notesApi.updateNote('preview-note-2', {
      content: '**新内容**',
      metadata: JSON.stringify({ customKey: 'keep-me' }),
    });

    const metadata = JSON.parse(stores.Note.get('preview-note-2').metadata);
    expect(metadata.customKey).toBe('keep-me');
    expect(metadata.previewText).toBe('新内容');
    expect(SearchIndex.createOrUpdate).toHaveBeenCalledWith(
      realm,
      expect.objectContaining({ entity_id: 'preview-note-2', entity_type: 'note' }),
    );
  });

  it('deleteNote 成功后同步移除搜索索引', async () => {
    await notesApi.createNote({ _id: 'preview-note-3', title: '待删除', content: '内容' });
    const softDelete = jest.fn();
    stores.SearchIndex.set('idx-3', {
      _id: 'idx-3',
      entity_id: 'preview-note-3',
      entity_type: 'note',
      softDelete,
    });

    await notesApi.deleteNote('preview-note-3');

    expect(softDelete).toHaveBeenCalledWith(realm);
    expect(stores.Note.get('preview-note-3').is_deleted).toBe(true);
  });

  it('索引写入失败不阻断保存', async () => {
    SearchIndex.createOrUpdate.mockImplementation(() => {
      throw new Error('索引写入失败');
    });
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const created = await notesApi.createNote({
      _id: 'preview-note-4',
      title: '索引失败',
      content: '正文',
    });

    expect(created.success).toBe(true);
    expect(stores.Note.get('preview-note-4')).toBeDefined();
    expect(warn).toHaveBeenCalled();

    warn.mockRestore();
  });

  it('importNote 落库前打标：导入笔记的 metadata 含 previewText 预览字段', async () => {
    const formData = {
      _parts: [
        ['type', 'pdf'],
        ['file', { uri: 'file:///tmp/imported.pdf', name: 'imported.pdf' }],
      ],
    };

    const result = await notesApi.importNote(formData);

    expect(result.success).toBe(true);
    const stored = stores.Note.get(result.data.note_id);
    const metadata = JSON.parse(stored.metadata);
    // 预览元数据（写入侧打标）
    expect(metadata.previewText).toBe('导入的pdf文件: imported.pdf');
    expect(metadata.hasContent).toBe(true);
    expect(metadata.contentLength).toBe('导入的pdf文件: imported.pdf'.length);
    expect(metadata.hasPages).toBe(false);
    expect(metadata.hasStrokeData).toBe(false);
    // 导入自身的 metadata 键必须保留（增量合并，不整体覆盖）
    expect(metadata).toHaveProperty('pdfPath');
    expect(metadata).toHaveProperty('lastOpenedPage', 1);
    expect(metadata).toHaveProperty('pageCount');
  });
});
