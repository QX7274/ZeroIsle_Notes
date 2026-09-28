let noteRecords = [];
let storageRecords = [];
let useArrayCollection = false;

const filteredCalls = [];
const sliceCalls = [];
const sortedCalls = [];
let contentAccessCount = 0;

/**
 * 只实现列表主链用到的查询语义；不依赖真实 Realm。
 */
const applyQuery = (records, query, args) => {
  let result = records;

  const boundUser = query.includes('user_id == $0');
  const allowsEmptyOwner = query.includes('user_id == ""') || query.includes('user_id = ""');
  const allowsNilOwner = query.includes('user_id == nil') || query.includes('user_id = nil');
  const interpolated = /user_id = "([^"]*)"/.exec(query);

  if (boundUser || interpolated || allowsEmptyOwner || allowsNilOwner) {
    result = result.filter(record => {
      const current = record.user_id;
      const isNilOwner = current === null || current === undefined;
      const isEmptyOwner = current === '';
      if (allowsNilOwner && isNilOwner) {
        return true;
      }
      if (allowsEmptyOwner && isEmptyOwner) {
        return true;
      }
      if (boundUser) {
        return current === args[0];
      }
      if (interpolated) {
        return current === interpolated[1];
      }
      return false;
    });
  }

  if (query.includes('is_deleted = false')) {
    result = result.filter(record => record.is_deleted !== true);
  }
  return result;
};

/**
 * 类 Realm Results：有 length / slice / filtered / 索引访问，
 * 但 Array.isArray(results) === false（真实 Realm 的行为）。
 */
const makeResultsLike = (records) => {
  const results = {
    length: records.length,
    filtered: jest.fn((query, ...args) => {
      filteredCalls.push({ query, args });
      return makeResultsLike(applyQuery(records, query, args));
    }),
    sorted: jest.fn((field, descending) => {
      sortedCalls.push([field, descending]);
      return makeResultsLike(records);
    }),
    slice: jest.fn((start, end) => {
      const from = start === undefined ? 0 : start;
      const to = end === undefined ? records.length : end;
      sliceCalls.push([from, to]);
      return makeResultsLike(records.slice(from, to));
    }),
  };
  records.forEach((record, index) => {
    results[index] = record;
  });
  return results;
};

/** 真实 Array 兼容场景：数组 + filtered 方法 */
const makeArrayCollection = (records) => {
  const collection = records.slice();
  collection.filtered = jest.fn((query, ...args) => {
    filteredCalls.push({ query, args });
    return makeArrayCollection(applyQuery(records, query, args));
  });
  return collection;
};

const makeNote = (index, overrides = {}) => ({
  _id: 'note-' + index,
  id: 'note-' + index,
  user_id: 'dev-account-001',
  title: '标题' + index,
  type: 'text',
  tags: [],
  is_deleted: false,
  updated_at: index,
  metadata: null,
  ...overrides,
});

/** 10 万条场景：content 用 getter 守护，任何读取都会被计数 */
class FakeNote {
  constructor(index) {
    this._id = 'note-' + index;
    this.id = 'note-' + index;
    this.user_id = 'dev-account-001';
    this.title = '标题' + index;
    this.type = 'text';
    this.tags = [];
    this.is_deleted = false;
    this.updated_at = index;
    this.metadata = null;
  }

  get content() {
    contentAccessCount += 1;
    return '正文-' + this._id;
  }
}

const mockRealm = {
  objects: jest.fn((schemaName) => {
    const records = schemaName === 'StorageItem' ? storageRecords : noteRecords;
    return useArrayCollection ? makeArrayCollection(records) : makeResultsLike(records);
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

const {
  getNotesFromOfflineStorage,
  getNoteSummariesFromOfflineStorage,
  markNoteOpenedAt,
} = require('../getNotes');

describe('getNotesFromOfflineStorage 列表主链', () => {
  beforeEach(() => {
    noteRecords = [];
    storageRecords = [];
    useArrayCollection = false;
    filteredCalls.length = 0;
    sliceCalls.length = 0;
    sortedCalls.length = 0;
    contentAccessCount = 0;
    jest.clearAllMocks();
  });

  test('25 条笔记时返回全部 25 条，而不是被静默截断到 20 条', async () => {
    noteRecords = Array.from({ length: 25 }, (_, index) => makeNote(index));

    const result = await getNotesFromOfflineStorage();

    expect(result.success).toBe(true);
    expect(result.data).toHaveLength(25);
  });

  test('data 是真正的 Array（notesSlice / HomeScreen 两条链路都能消费）', async () => {
    noteRecords = [makeNote(1), makeNote(2)];

    const result = await getNotesFromOfflineStorage();

    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data).toEqual(noteRecords);
  });

  test('developer 上下文关闭登录时仍能加载本地 Realm 笔记', async () => {
    noteRecords = [makeNote(0, { title: '重启后仍可见', type: 'paged_note' })];

    const result = await getNotesFromOfflineStorage();

    expect(result.success).toBe(true);
    expect(result.data).toEqual(noteRecords);
  });

  test('data 喂给 notesSlice 的 id 过滤后数量不变（回归 Results 被包成 [Results]）', async () => {
    noteRecords = Array.from({ length: 25 }, (_, index) => makeNote(index));

    const result = await getNotesFromOfflineStorage();
    const consumable = result.data.filter(note => note.id || note._id);

    expect(consumable).toHaveLength(25);
  });

  test('user_id 过滤已下推到 filtered，并带实际用户参数', async () => {
    noteRecords = [makeNote(1)];

    await getNotesFromOfflineStorage();

    const userCall = filteredCalls.find(call => String(call.query).includes('user_id'));
    expect(userCall).toBeDefined();
    expect(userCall.query).toContain('user_id');
    expect(userCall.query).toContain('is_deleted = false');
    expect(userCall.query).toContain('user_id == $0');
    expect(userCall.query).toContain('user_id == nil');
    expect(userCall.query).toContain('user_id == ""');
    expect(userCall.args[0]).toBe('dev-account-001');
  });

  test('历史 null owner 笔记必须可见（设备实测 P0 回归：runtime schema 为 string?）', async () => {
    noteRecords = [
      makeNote(1, { user_id: null }),
      makeNote(2, { user_id: null }),
      makeNote(3, { user_id: null }),
    ];

    const result = await getNotesFromOfflineStorage();

    expect(result.data).toHaveLength(3);
    expect(result.data.map(note => note._id)).toEqual(['note-1', 'note-2', 'note-3']);
  });

  test('历史无主笔记（user_id 为空串）必须可见（P0 回归）', async () => {
    noteRecords = [makeNote(1, { user_id: '' })];

    const result = await getNotesFromOfflineStorage();

    expect(result.data).toHaveLength(1);
    expect(result.data[0]._id).toBe('note-1');
  });

  test('无主笔记与当前用户笔记混合时都返回，其他账号仍不可见', async () => {
    noteRecords = [
      makeNote(1),
      makeNote(2, { user_id: '' }),
      makeNote(3, { user_id: '' }),
      makeNote(4, { user_id: 'other-account' }),
      makeNote(5, { user_id: null }),
    ];

    const result = await getNotesFromOfflineStorage();

    expect(result.data.map(note => note._id)).toEqual(['note-1', 'note-2', 'note-3', 'note-5']);
  });

  test('只返回当前用户的笔记，其他账号数据不可见', async () => {
    noteRecords = [makeNote(1), makeNote(2, { user_id: 'other-account' })];

    const result = await getNotesFromOfflineStorage();

    expect(result.data).toHaveLength(1);
    expect(result.data[0].user_id).toBe('dev-account-001');
  });

  test('显式分页时在 Results 层先 slice 再物化，只返回当前页', async () => {
    noteRecords = Array.from({ length: 25 }, (_, index) => makeNote(index));

    const result = await getNotesFromOfflineStorage({ skip: 20, limit: 20 });

    expect(result.data).toHaveLength(5);
    expect(result.data[0]._id).toBe('note-20');
  });

  test('真实 Array 场景（非 Results）同样可用', async () => {
    useArrayCollection = true;
    noteRecords = Array.from({ length: 25 }, (_, index) => makeNote(index));

    const result = await getNotesFromOfflineStorage();

    expect(Array.isArray(result.data)).toBe(true);
    expect(result.data).toHaveLength(25);
  });
});

describe('getNoteSummariesFromOfflineStorage 列表字段裁剪', () => {
  beforeEach(() => {
    noteRecords = [];
    storageRecords = [];
    useArrayCollection = false;
    filteredCalls.length = 0;
    sliceCalls.length = 0;
    sortedCalls.length = 0;
    contentAccessCount = 0;
    jest.clearAllMocks();
  });

  test('10 万条伪 Results 下只物化一页，且全程不读取 content', async () => {
    noteRecords = Array.from({ length: 100000 }, (_, index) => new FakeNote(index));

    const page = await getNoteSummariesFromOfflineStorage({ skip: 50000, limit: 10 });

    expect(page).toHaveLength(10);
    // 只在 Results 层取了一次当前页，没有对整表做 materialize
    expect(sliceCalls).toEqual([[50000, 50010]]);
    // summary 不含正文，也没有触发任何 content getter
    expect(contentAccessCount).toBe(0);
    page.forEach((summary) => {
      expect(Object.prototype.hasOwnProperty.call(summary, 'content')).toBe(false);
      expect(summary._id).toMatch(/^note-/);
    });
  });

  test('可下推 sort 会传到 Realm.sorted（分页 + Realm 侧排序）', async () => {
    noteRecords = [makeNote(1), makeNote(2)];

    await getNoteSummariesFromOfflineStorage({
      skip: 0,
      limit: 50,
      sort: { field: 'created_at', descending: true },
    });

    expect(sortedCalls).toEqual([['created_at', true]]);
    expect(sliceCalls).toEqual([[0, 50]]);
  });

  test('未传 sort 时仍按默认 updated_at desc 下推（既有契约不变）', async () => {
    noteRecords = [makeNote(1)];

    await getNoteSummariesFromOfflineStorage({ skip: 0, limit: 50 });

    expect(sortedCalls).toEqual([['updated_at', true]]);
  });

  test('summary 查询同样带 user_id 隔离', async () => {
    noteRecords = [makeNote(1)];

    await getNoteSummariesFromOfflineStorage({ skip: 0, limit: 10 });

    const userCall = filteredCalls.find(call => String(call.query).includes('user_id'));
    expect(userCall).toBeDefined();
    expect(userCall.query).toContain('user_id = "dev-account-001"');
    expect(userCall.query).toContain('user_id = ""');
  });
});

/**
 * WS-T：「最近访问」落库。打开笔记时单字段写 Note.last_opened_at，
 * 让列表「最近访问」排序可以下推 Realm 并分页。
 */
describe('markNoteOpenedAt 最近访问落库（WS-T）', () => {
  /** 记录被赋值的字段名，用于证明「只写一个字段」 */
  const createTrackedRealm = (note) => {
    const assigned = [];
    const proxy = note
      ? new Proxy(note, {
        set(target, key, value) {
          assigned.push(String(key));
          target[key] = value;
          return true;
        },
      })
      : null;

    return {
      assigned,
      realm: {
        write: jest.fn((callback) => callback()),
        objectForPrimaryKey: jest.fn(() => proxy),
      },
    };
  };

  test('单字段写入：只写 last_opened_at，不刷新 updated_at / metadata', async () => {
    const note = {
      _id: 'note-1',
      title: '标题',
      content: '正文',
      updated_at: '2024-01-01T00:00:00.000Z',
      metadata: '{"previewText":"正文"}',
      last_opened_at: null,
    };
    const { assigned, realm } = createTrackedRealm(note);

    await expect(markNoteOpenedAt('note-1', { realm })).resolves.toBe(true);

    expect(assigned).toEqual(['last_opened_at']);
    expect(note.last_opened_at).toBeInstanceOf(Date);
    expect(note.updated_at).toBe('2024-01-01T00:00:00.000Z');
    expect(note.metadata).toBe('{"previewText":"正文"}');
    expect(realm.objectForPrimaryKey).toHaveBeenCalledWith('Note', 'note-1');
  });

  test('笔记不存在 / 空 id / 临时 id / realm 不可用：返回 false 且不抛错', async () => {
    const realm = createTrackedRealm(null).realm;

    await expect(markNoteOpenedAt('missing', { realm })).resolves.toBe(false);
    await expect(markNoteOpenedAt('', { realm })).resolves.toBe(false);
    await expect(markNoteOpenedAt(null, { realm })).resolves.toBe(false);
    await expect(markNoteOpenedAt(undefined, { realm })).resolves.toBe(false);
    await expect(markNoteOpenedAt('temp_1700000000', { realm })).resolves.toBe(false);
    await expect(markNoteOpenedAt('note-1', { realm: {} })).resolves.toBe(false);
  });

  test('realm 抛错时只告警，不抛给调用方（不得阻断打开流程）', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const realm = {
      write: () => {
        throw new Error('realm 不可用');
      },
      objectForPrimaryKey: () => null,
    };

    await expect(markNoteOpenedAt('note-1', { realm })).resolves.toBe(false);
    expect(warn).toHaveBeenCalled();

    warn.mockRestore();
  });
});
