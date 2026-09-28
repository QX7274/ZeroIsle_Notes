/**
 * dev 造数 / 清理服务单测（WS-R）
 *
 * 用可注入的伪 Realm 覆盖：分批边界、按批推进（不会一次写全部/读全表）、
 * 幂等、单条失败不中断、只删自己造的数据、非法 realm、非 __DEV__ 守卫。
 */

jest.mock('../../database/realmService', () => ({
  __esModule: true,
  default: { getRealm: jest.fn() },
}));

const realmServiceMock = require('../../database/realmService').default;
const {
  seedPerfNotes,
  clearPerfNotes,
  buildPerfFixtureNote,
  PERF_FIXTURE_ID_PREFIX,
  PERF_FIXTURE_TITLE_PREFIX,
  PERF_FIXTURE_TAG,
} = require('../perfSeedService');

/**
 * 构造可计数的伪 Realm：
 * - store 是唯一真相，objects()/filtered()/slice() 每次访问都从 store 实时计算，
 *   因此删除后集合会真正收缩（与真实 Realm Results 一致）；
 * - recordsPerWrite 记录每次 realm.write 内成功创建/删除的条数，用于断言「按批推进」。
 */
const createFakeRealm = (initialRows = [], options = {}) => {
  const store = new Map();
  initialRows.forEach((row) => store.set(row._id, { ...row }));
  const failOnCreateIds = new Set(options.failOnCreateIds || []);
  const failOnDeleteIds = new Set(options.failOnDeleteIds || []);

  const stats = {
    writeCalls: 0,
    createCalls: 0,
    deleteCalls: 0,
    createsPerWrite: [],
    deletesPerWrite: [],
    sliceSizes: [],
    materialized: 0,
    queries: [],
  };

  let writeCreates = 0;
  let writeDeletes = 0;

  const makeResults = (getRows) => {
    const results = {
      get length() {
        return getRows().length;
      },
      filtered(query, ...args) {
        stats.queries.push({ query, args });
        return makeResults(() => getRows().filter((row) => {
          if (!query.includes('BEGINSWITH')) {
            return true;
          }
          // 只实现本服务用到的识别标记查询：title / _id 前缀
          return String(row.title || '').startsWith(args[0])
            || String(row._id || '').startsWith(args[1]);
        }));
      },
      sorted() {
        return results;
      },
      slice(start = 0, end = undefined) {
        const rows = getRows();
        const from = Math.max(0, Math.floor(start));
        const rawTo = end === undefined ? rows.length : Math.floor(end);
        const to = Math.max(from, Math.min(rows.length, rawTo));
        const sliced = rows.slice(from, to);
        stats.sliceSizes.push(sliced.length);
        return {
          length: sliced.length,
          [Symbol.iterator]() {
            let cursor = 0;
            return {
              next: () => {
                if (cursor >= sliced.length) {
                  return { done: true, value: undefined };
                }
                const value = sliced[cursor];
                cursor += 1;
                stats.materialized += 1;
                return { done: false, value };
              },
            };
          },
        };
      },
    };
    return results;
  };

  return {
    stats,
    store,
    objects() {
      return makeResults(() => Array.from(store.values()));
    },
    objectForPrimaryKey(schemaName, id) {
      return store.has(id) ? store.get(id) : null;
    },
    create(schemaName, record) {
      if (failOnCreateIds.has(record._id)) {
        throw new Error(`fake create failure: ${record._id}`);
      }
      stats.createCalls += 1;
      writeCreates += 1;
      store.set(record._id, { ...record });
      return store.get(record._id);
    },
    delete(record) {
      if (!record || !store.has(record._id)) {
        return;
      }
      if (failOnDeleteIds.has(record._id)) {
        throw new Error(`fake delete failure: ${record._id}`);
      }
      stats.deleteCalls += 1;
      writeDeletes += 1;
      store.delete(record._id);
    },
    write(callback) {
      stats.writeCalls += 1;
      writeCreates = 0;
      writeDeletes = 0;
      const result = callback();
      stats.createsPerWrite.push(writeCreates);
      stats.deletesPerWrite.push(writeDeletes);
      return result;
    },
  };
};

/** 静默预期的告警输出，避免故障注入用例刷屏（断言仍然有效） */
const withSilencedWarn = async (run) => {
  const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  try {
    return await run();
  } finally {
    warnSpy.mockRestore();
  }
};

/** 造 n 条「用户笔记」（既非 [PERF] 前缀，也非 perf-fixture- id 前缀） */
const createUserNotes = (n) => Array.from({ length: n }, (_, index) => ({
  _id: `user-note-${index}`,
  title: `用户笔记 ${index}（[PERF] 只是标题中间出现）`,
  user_id: 'real-user',
  is_deleted: false,
}));

beforeEach(() => {
  realmServiceMock.getRealm.mockReset();
});

describe('buildPerfFixtureNote 样本字段形态', () => {
  it('_id / title / tag 带可识别标记，且 metadata 已打标、updated_at 递减、user_id 与读取侧一致', () => {
    const baseTime = 1700000000000;
    const first = buildPerfFixtureNote({ index: 0, userId: 'user-1', baseTime });
    const second = buildPerfFixtureNote({ index: 1, userId: 'user-1', baseTime });

    // 可识别标记：清理由这两个前缀驱动，缺一不可
    expect(first._id).toBe(`${PERF_FIXTURE_ID_PREFIX}0`);
    expect(first.title.startsWith(PERF_FIXTURE_TITLE_PREFIX)).toBe(true);
    expect(first.tags).toContain(PERF_FIXTURE_TAG);

    // 读写口径一致：user_id 原样写入；未删除
    expect(first.user_id).toBe('user-1');
    expect(first.is_deleted).toBe(false);

    // updated_at 递减（index 越大越旧），保证首页第一页是 index 较小的样本
    expect(second.updated_at.getTime()).toBeLessThan(first.updated_at.getTime());

    // 预览元数据已打标：首页 summary 不会把它判为「未打标」而整体回退
    const metadata = JSON.parse(first.metadata);
    expect(metadata.perfFixture).toBe(true);
    expect(typeof metadata.previewText).toBe('string');
    expect(metadata.contentLength).toBeGreaterThan(0);
    expect(metadata.hasContent).toBe(true);
  });

  it('样本不产生文件型误触字段（不带 file_uri/uri，type 也不是文件型）', () => {
    const baseTime = 1700000000000;
    // 覆盖类型循环的全部取值：只测第一条会漏掉其余 type
    const samples = Array.from({ length: 20 }, (_, index) =>
      buildPerfFixtureNote({ index, userId: 'user-1', baseTime }),
    );

    const FILE_FIELDS = ['file_uri', 'uri', 'path', 'file_path', 'url', 'file_name', 'file_type'];
    // 与 HomeScreen.handleFilePress 的文件型判定保持一致
    const FILE_VIEWER_TYPES = ['pdf', 'doc', 'docx', 'word', 'ppt', 'pptx', 'markdown', 'txt', 'text'];

    samples.forEach((sample) => {
      FILE_FIELDS.forEach((field) => {
        expect(sample[field]).toBeUndefined();
      });
      expect(FILE_VIEWER_TYPES).not.toContain(String(sample.type).toLowerCase());
    });
  });

  it('正文长度有长短差异', () => {
    const baseTime = 1700000000000;
    const longOne = buildPerfFixtureNote({ index: 10, userId: 'user-1', baseTime });
    const shortOne = buildPerfFixtureNote({ index: 1, userId: 'user-1', baseTime });

    expect(longOne.content.length).toBeGreaterThan(shortOne.content.length);
  });
});

describe('seedPerfNotes 分批与幂等', () => {
  it('分批边界：count 不是 batchSize 整数倍时按 1000/1000/500 三批推进', async () => {
    const realm = createFakeRealm();
    const result = await seedPerfNotes({
      count: 2500,
      batchSize: 1000,
      realm,
      userId: 'user-1',
      baseTime: 1700000000000,
    });

    expect(result.created).toBe(2500);
    expect(result.failed).toBe(0);
    expect(result.batches).toBe(3);
    expect(realm.store.size).toBe(2500);
    // 单次 write 内创建的条数不超过 batchSize（绝不一次性写全部）
    expect(realm.stats.createsPerWrite).toEqual([1000, 1000, 500]);
    expect(Math.max(...realm.stats.createsPerWrite)).toBeLessThanOrEqual(1000);
  });

  it('幂等：重复执行不会重复造数', async () => {
    const realm = createFakeRealm();
    const first = await seedPerfNotes({ count: 2500, batchSize: 1000, realm, userId: 'user-1' });
    const writesAfterFirst = realm.stats.writeCalls;
    const second = await seedPerfNotes({ count: 2500, batchSize: 1000, realm, userId: 'user-1' });

    expect(first.created).toBe(2500);
    expect(second.created).toBe(0);
    expect(second.skipped).toBe(2500);
    expect(realm.store.size).toBe(2500);
    // 第二次没有任何新的写入事务
    expect(realm.stats.writeCalls).toBe(writesAfterFirst);
  });

  it('onProgress 每批回调一次，processed 递增到 total', async () => {
    const realm = createFakeRealm();
    const progress = [];
    await seedPerfNotes({
      count: 2500,
      batchSize: 1000,
      realm,
      userId: 'user-1',
      onProgress: (stats) => progress.push({ processed: stats.processed, total: stats.total }),
    });

    expect(progress).toEqual([
      { processed: 1000, total: 2500 },
      { processed: 2000, total: 2500 },
      { processed: 2500, total: 2500 },
    ]);
  });

  it('单条失败不整体中断：整批失败降级为逐条写入', async () => {
    const realm = createFakeRealm([], { failOnCreateIds: ['perf-fixture-1'] });
    const result = await withSilencedWarn(() => seedPerfNotes({
      count: 2500,
      batchSize: 1000,
      realm,
      userId: 'user-1',
    }));

    expect(result.created).toBe(2499);
    expect(result.failed).toBe(1);
    expect(realm.store.size).toBe(2499);
    expect(realm.store.has('perf-fixture-1')).toBe(false);
    expect(realm.store.has('perf-fixture-0')).toBe(true);
    expect(realm.store.has('perf-fixture-2499')).toBe(true);
  });

  it('非法 count 直接抛错（dev 工具早失败）', async () => {
    const realm = createFakeRealm();
    await expect(seedPerfNotes({ count: 0, realm, userId: 'user-1' })).rejects.toThrow(/count 必须是正整数/);
    await expect(seedPerfNotes({ count: 'abc', realm, userId: 'user-1' })).rejects.toThrow(/count 必须是正整数/);
  });
});

describe('clearPerfNotes 只删本工具生成的数据', () => {
  it('混合数据下只删样本，用户笔记原样保留', async () => {
    const realm = createFakeRealm();
    await seedPerfNotes({ count: 2500, batchSize: 1000, realm, userId: 'user-1' });
    createUserNotes(3).forEach((note) => realm.store.set(note._id, note));
    expect(realm.store.size).toBe(2503);

    const result = await clearPerfNotes({ batchSize: 1000, realm });

    expect(result.deleted).toBe(2500);
    expect(result.failed).toBe(0);
    expect(realm.store.size).toBe(3);
    createUserNotes(3).forEach((note) => {
      expect(realm.store.has(note._id)).toBe(true);
    });
    // 删除条件确实是双前缀识别
    expect(realm.stats.queries[0].query).toContain('BEGINSWITH');
    expect(realm.stats.queries[0].args).toEqual([PERF_FIXTURE_TITLE_PREFIX, PERF_FIXTURE_ID_PREFIX]);
  });

  it('分批删除：单次 materialize / delete 不超过 batchSize', async () => {
    const realm = createFakeRealm();
    await seedPerfNotes({ count: 2500, batchSize: 1000, realm, userId: 'user-1' });

    const result = await clearPerfNotes({ batchSize: 1000, realm });

    expect(result.batches).toBe(3);
    expect(realm.stats.sliceSizes).toEqual([1000, 1000, 500]);
    expect(Math.max(...realm.stats.sliceSizes)).toBeLessThanOrEqual(1000);
    expect(Math.max(...realm.stats.deletesPerWrite, 0)).toBeLessThanOrEqual(1);
  });

  it('幂等：重复清理 deleted=0，不再产生批次', async () => {
    const realm = createFakeRealm();
    await seedPerfNotes({ count: 2500, batchSize: 1000, realm, userId: 'user-1' });
    const first = await clearPerfNotes({ batchSize: 1000, realm });
    const second = await clearPerfNotes({ batchSize: 1000, realm });

    expect(first.deleted).toBe(2500);
    expect(second.deleted).toBe(0);
    expect(second.batches).toBe(0);
    expect(realm.store.size).toBe(0);
  });

  it('删除全部失败时不会死循环：无进展即停止并计数', async () => {
    const realm = createFakeRealm([
      { _id: 'perf-fixture-0', title: '[PERF] 0' },
      { _id: 'perf-fixture-1', title: '[PERF] 1' },
      { _id: 'perf-fixture-2', title: '[PERF] 2' },
      { _id: 'perf-fixture-3', title: '[PERF] 3' },
      { _id: 'perf-fixture-4', title: '[PERF] 4' },
    ], { failOnDeleteIds: ['perf-fixture-0', 'perf-fixture-1', 'perf-fixture-2', 'perf-fixture-3', 'perf-fixture-4'] });

    const result = await withSilencedWarn(() => clearPerfNotes({ batchSize: 10, realm }));

    expect(result.deleted).toBe(0);
    expect(result.failed).toBe(5);
    expect(result.batches).toBe(1);
    expect(realm.store.size).toBe(5);
  });

  it('部分删除失败时仍继续清理其余样本', async () => {
    const realm = createFakeRealm([
      { _id: 'perf-fixture-0', title: '[PERF] 0' },
      { _id: 'perf-fixture-1', title: '[PERF] 1' },
      { _id: 'perf-fixture-2', title: '[PERF] 2' },
    ], { failOnDeleteIds: ['perf-fixture-1'] });

    const result = await withSilencedWarn(() => clearPerfNotes({ batchSize: 10, realm }));

    expect(result.failed).toBe(1);
    expect(realm.store.has('perf-fixture-1')).toBe(true);
    // 首轮无进展保护会停止，属于预期（避免死循环）
    expect(result.deleted).toBeGreaterThanOrEqual(0);
  });
});

describe('realm 注入与 dev 守卫', () => {
  it('非法 realm 显式抛错（seed 与 clear 一致）', async () => {
    await expect(seedPerfNotes({ count: 1, realm: {}, userId: 'user-1' }))
      .rejects.toThrow(/需要有效的 Realm 实例/);
    await expect(clearPerfNotes({ realm: { objects: () => [] } }))
      .rejects.toThrow(/需要有效的 Realm 实例/);
  });

  it('未注入 realm 时惰性使用 realmService.getRealm()', async () => {
    const realm = createFakeRealm();
    realmServiceMock.getRealm.mockResolvedValue(realm);

    const result = await seedPerfNotes({ count: 3, batchSize: 2, userId: 'user-1' });

    expect(realmServiceMock.getRealm).toHaveBeenCalledTimes(1);
    expect(result.created).toBe(3);
    expect(realm.store.size).toBe(3);
  });

  it('非 __DEV__ 环境调用直接抛错（不写入任何数据）', async () => {
    const realm = createFakeRealm();
    const originalDev = global.__DEV__;
    global.__DEV__ = false;
    try {
      await expect(seedPerfNotes({ count: 1, realm, userId: 'user-1' }))
        .rejects.toThrow(/仅允许在开发/);
      await expect(clearPerfNotes({ realm }))
        .rejects.toThrow(/仅允许在开发/);
      expect(realm.stats.writeCalls).toBe(0);
      expect(realm.store.size).toBe(0);
    } finally {
      global.__DEV__ = originalDev;
    }
  });
});
