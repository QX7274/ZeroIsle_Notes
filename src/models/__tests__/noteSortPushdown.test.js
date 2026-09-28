/**
 * 列表排序下推（里程碑 5.1 续）：Note._queryUserResults / findByUserSummaries
 *
 * 用「会计数物化 + 记录 sorted 参数」的伪 Results 验证：
 * 1. 可下推字段（updated_at/created_at/title/type/file_size）真的走到 Realm.sorted()，参数正确；
 * 2. 未传 sort 时保持历史行为（updated_at desc）；
 * 3. 10 万条下按页取只物化一页（分页前置到 Results 层）；
 * 4. 未传分页时 findByUser 仍返回惰性集合（契约不变）；
 * 5. 未知排序字段回退默认排序并告警，不让列表整体失败。
 */

const { createCountingResults } = require('./helpers/countingResults.cjs');
const Note = require('../Note').default;
const { REALM_SORTABLE_FIELDS, normalizeRealmSort } = require('../Note');

const TOTAL = 100000;

/**
 * 构造笔记行
 * @param {number} index
 * @returns {Object}
 */
const createRow = (index) => ({
  _id: `note-${index}`,
  title: `标题-${index}`,
  type: 'text',
  tags: [],
  category_id: null,
  color: null,
  is_favorite: false,
  is_archived: false,
  is_deleted: false,
  is_synced: true,
  created_at: new Date(1700000000000 + index),
  updated_at: new Date(1700000000000 + index),
  user_id: 'user-1',
  metadata: '{}',
  file_path: null,
  file_size: null,
  file_type: null,
  thumbnail_path: null,
  version: 1,
  parent_id: null,
});

const createRows = (count) => Array.from({ length: count }, (_, index) => createRow(index));

/**
 * 包装伪 Results：保持惰性契约，同时记录 sorted(field, descending) 调用参数。
 * @param {Object} view createCountingResults 产出的视图
 * @param {Array} sortedArgs
 * @returns {Object}
 */
const wrapResults = (view, sortedArgs) => ({
  stats: view.stats,
  get length() {
    return view.length;
  },
  filtered(query, ...args) {
    return wrapResults(view.filtered(query, ...args), sortedArgs);
  },
  sorted(field, descending) {
    sortedArgs.push([field, descending]);
    return wrapResults(view.sorted(field, descending), sortedArgs);
  },
  slice(from, to) {
    return wrapResults(view.slice(from, to), sortedArgs);
  },
  [Symbol.iterator]() {
    return view[Symbol.iterator]();
  },
});

const createRealm = (rows) => {
  const collection = createCountingResults(rows);
  const sortedArgs = [];
  return {
    collection,
    sortedArgs,
    realm: { objects: () => wrapResults(collection, sortedArgs) },
  };
};

describe('Note.normalizeRealmSort（排序归一化）', () => {
  test('白名单只含 schema 中的标量字段', () => {
    expect(REALM_SORTABLE_FIELDS).toEqual(
      expect.arrayContaining(['updated_at', 'created_at', 'title', 'type', 'file_size']),
    );
  });

  test('兼容新式、Mongo 风格与字符串三种写法', () => {
    expect(normalizeRealmSort({ field: 'created_at', descending: true }))
      .toEqual({ field: 'created_at', descending: true });
    expect(normalizeRealmSort({ field: 'created_at', direction: -1 }))
      .toEqual({ field: 'created_at', descending: true });
    expect(normalizeRealmSort({ title: 1 })).toEqual({ field: 'title', descending: false });
    expect(normalizeRealmSort({ title: -1 })).toEqual({ field: 'title', descending: true });
    expect(normalizeRealmSort('updated_desc')).toEqual({ field: 'updated_at', descending: true });
    expect(normalizeRealmSort('title_asc')).toEqual({ field: 'title', descending: false });
    expect(normalizeRealmSort('created_at')).toEqual({ field: 'created_at', descending: true });
  });

  test('未知字段 / 非法入参返回 null（由调用方回退默认排序）', () => {
    expect(normalizeRealmSort(null)).toBeNull();
    expect(normalizeRealmSort(undefined)).toBeNull();
    expect(normalizeRealmSort({})).toBeNull();
    expect(normalizeRealmSort({ foo: 1 })).toBeNull();
    expect(normalizeRealmSort('foo_asc')).toBeNull();
    expect(normalizeRealmSort(42)).toBeNull();
  });
});

describe('Note.findByUserSummaries 排序下推与分页物化', () => {
  test('10 万条下按页只物化一页，且 sort 下推到 Realm.sorted', () => {
    const { collection, sortedArgs, realm } = createRealm(createRows(TOTAL));

    const page = Note.findByUserSummaries(realm, 'user-1', {
      skip: 50000,
      limit: 50,
      sort: { field: 'created_at', descending: true },
    });

    expect(page).toHaveLength(50);
    // 降序（created_at desc）下，第 50000 条之后的 50 条从 note-49999 开始
    expect(page[0]._id).toBe('note-49999');
    expect(page[49]._id).toBe('note-49950');
    // 只取了一次当前页，没有整表物化
    expect(collection.stats.materialized).toBe(50);
    expect(collection.stats.sliceCalls).toBe(1);
    // 排序参数原样下推
    expect(sortedArgs).toEqual([['created_at', true]]);
    // summary 不含正文
    expect(page[0]).not.toHaveProperty('content');
  });

  test('未传 sort 时保持历史行为：updated_at desc', () => {
    const { sortedArgs, realm } = createRealm(createRows(10));

    Note.findByUserSummaries(realm, 'user-1', { skip: 0, limit: 5 });

    expect(sortedArgs).toEqual([['updated_at', true]]);
  });

  test('历史 Mongo 风格 sort 仍可用（title: 1 / title: -1）', () => {
    const asc = createRealm(createRows(5));
    Note.findByUserSummaries(asc.realm, 'user-1', { skip: 0, limit: 5, sort: { title: 1 } });
    expect(asc.sortedArgs).toEqual([['title', false]]);

    const desc = createRealm(createRows(5));
    Note.findByUser(desc.realm, 'user-1', { skip: 0, limit: 5, sort: { title: -1 } });
    expect(desc.sortedArgs).toEqual([['title', true]]);
  });

  test('未知排序字段回退默认排序并告警（不让列表整体失败）', () => {
    const { sortedArgs, realm } = createRealm(createRows(5));
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    const page = Note.findByUserSummaries(realm, 'user-1', { skip: 0, limit: 5, sort: { foo: 1 } });

    expect(page).toHaveLength(5);
    expect(sortedArgs).toEqual([['updated_at', true]]);
    expect(warn).toHaveBeenCalled();

    warn.mockRestore();
  });

  test('findByUser 未传分页时仍是惰性集合，且排序已下推（契约不变）', () => {
    const { collection, sortedArgs, realm } = createRealm(createRows(1000));

    const results = Note.findByUser(realm, 'user-1', { sort: 'updated_desc' });

    expect(Array.isArray(results)).toBe(false);
    expect(results.length).toBe(1000);
    expect(collection.stats.materialized).toBe(0);
    expect(sortedArgs).toEqual([['updated_at', true]]);
  });
});
