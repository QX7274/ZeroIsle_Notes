/**
 * 里程碑 5.1：列表字段裁剪（轻量投影 + 正文延迟加载）
 *
 * 用 helpers/countingResults.cjs 的伪 Results 验证：
 * 1. 10 万条集合下只物化当前页（materialized === 当前页大小）；
 * 2. 投影过程中 content getter 从未被访问（getter 一旦被访问就计数，未提供值时直接抛错）；
 * 3. hasContent / contentLength 由 metadata 派生，缺失时为 null（不为了它们回读正文）；
 * 4. loadNoteContent 能按 id 取回正文；
 * 5. findByUser 的既有返回值契约不变。
 */

const TOTAL_NOTES = 100000;

const { createCountingResults } = require('./helpers/countingResults.cjs');
const {
  NOTE_SUMMARY_FIELDS,
  toNoteSummary,
  materializeNoteSummaries,
  loadNoteContent,
} = require('../utils/noteProjection');

/**
 * 构造笔记行工厂：content 定义在共享原型上（避免 10 万次 defineProperty），
 * getter 一旦被读取就计数；未提供 content 值时直接抛错，让误读立刻暴露。
 * @param {{count: number}} counter
 * @param {{content?: string}} [options]
 * @returns {Function}
 */
function createRowFactory(counter, options = {}) {
  const prototype = {};
  Object.defineProperty(prototype, 'content', {
    enumerable: true,
    get() {
      counter.count += 1;
      if (options.content === undefined) {
        throw new Error('列表投影不得读取 content');
      }
      return options.content;
    },
  });

  return (index, overrides = {}) =>
    Object.assign(
      Object.create(prototype),
      {
        _id: `note-${index}`,
        title: `标题-${index}`,
        type: 'text',
        tags: ['标签-1'],
        category_id: 'cat-1',
        color: '#4CAF50',
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
      },
      overrides,
    );
}

/**
 * 批量构造笔记行
 * @param {number} count
 * @param {Function} factory
 * @returns {Array}
 */
function createRows(count, factory) {
  return Array.from({ length: count }, (_, index) => factory(index));
}

describe('noteProjection 轻量字段裁剪', () => {
  it('NOTE_SUMMARY_FIELDS 覆盖列表所需轻量字段，且明确不含 content', () => {
    expect(NOTE_SUMMARY_FIELDS).toEqual(
      expect.arrayContaining([
        '_id',
        'title',
        'type',
        'tags',
        'category_id',
        'color',
        'is_favorite',
        'is_archived',
        'is_deleted',
        'is_synced',
        'created_at',
        'updated_at',
        'user_id',
        'file_path',
        'file_size',
        'file_type',
        'thumbnail_path',
        'version',
        'parent_id',
      ]),
    );
    expect(NOTE_SUMMARY_FIELDS).not.toContain('content');
  });

  it('toNoteSummary 只投影白名单字段 + hasContent/contentLength，不读取 content', () => {
    const counter = { count: 0 };
    const summary = toNoteSummary(createRowFactory(counter)(7));

    expect(Object.keys(summary).sort()).toEqual(
      [...NOTE_SUMMARY_FIELDS, 'hasContent', 'contentLength'].sort(),
    );
    expect(summary._id).toBe('note-7');
    expect(summary.tags).toEqual(['标签-1']);
    expect(summary.hasContent).toBeNull();
    expect(summary.contentLength).toBeNull();
    expect(counter.count).toBe(0);
  });

  it('hasContent / contentLength 由 metadata 派生，缺失时为 null', () => {
    const counter = { count: 0 };
    const factory = createRowFactory(counter);
    const rows = [
      factory(0, { metadata: JSON.stringify({ contentLength: 120, hasContent: true }) }),
      factory(1, { metadata: JSON.stringify({ contentLength: 0 }) }),
      factory(2, { metadata: JSON.stringify({ hasContent: true }) }),
      factory(3, { metadata: '{}' }),
      factory(4, { metadata: 'not-json' }),
      factory(5, { metadata: '' }),
    ];

    const summaries = materializeNoteSummaries(createCountingResults(rows), {
      skip: 0,
      limit: 20,
    });

    expect(summaries.map(item => [item.hasContent, item.contentLength])).toEqual([
      [true, 120],
      [false, 0],
      [true, null],
      [null, null],
      [null, null],
      [null, null],
    ]);
    expect(counter.count).toBe(0);
  });

  it('loadContent 是惰性闭包：只有被调用时才读取正文，且不参与序列化', () => {
    const counter = { count: 0 };
    const summary = toNoteSummary(createRowFactory(counter, { content: '正文A' })(1));

    expect(counter.count).toBe(0);
    expect(Object.keys(summary)).not.toContain('loadContent');
    expect(summary.loadContent()).toBe('正文A');
    expect(counter.count).toBe(1);
  });

  it('10 万条集合下只物化当前页，且投影过程从不读取 content', () => {
    const counter = { count: 0 };
    const collection = createCountingResults(
      createRows(TOTAL_NOTES, createRowFactory(counter)),
    );

    const page = materializeNoteSummaries(collection, {
      skip: TOTAL_NOTES - 20,
      limit: 20,
    });

    expect(page).toHaveLength(20);
    expect(collection.stats.materialized).toBe(20);
    expect(collection.stats.sliceCalls).toBe(1);
    expect(counter.count).toBe(0);
    expect(page[0]._id).toBe(`note-${TOTAL_NOTES - 20}`);
    expect(page[19]._id).toBe(`note-${TOTAL_NOTES - 1}`);
    expect(page.every(summary => !('content' in summary))).toBe(true);
    expect(typeof page[0].loadContent).toBe('function');
  });

  it('loadNoteContent 按 id 取回正文；不存在或入参非法时返回 null', () => {
    const realm = {
      objectForPrimaryKey: jest.fn((schema, id) =>
        id === 'note-1' ? { _id: 'note-1', content: '详情正文' } : null,
      ),
    };

    expect(loadNoteContent(realm, 'note-1')).toBe('详情正文');
    expect(realm.objectForPrimaryKey).toHaveBeenCalledWith('Note', 'note-1');
    expect(loadNoteContent(realm, 'missing')).toBeNull();
    expect(loadNoteContent(null, 'note-1')).toBeNull();
    expect(loadNoteContent({}, 'note-1')).toBeNull();
  });
});

describe('Note.findByUserSummaries（10 万条笔记列表主路径）', () => {
  const loadNote = () => require('../Note').default || require('../Note');

  it('只物化当前页，返回 summary 且不含 content', () => {
    const Note = loadNote();
    const counter = { count: 0 };
    const collection = createCountingResults(
      createRows(TOTAL_NOTES, createRowFactory(counter)),
    );
    const realm = { objects: () => collection };

    const page = Note.findByUserSummaries(realm, 'user-1', { skip: 50000, limit: 10 });

    expect(page).toHaveLength(10);
    expect(collection.stats.materialized).toBe(10);
    expect(collection.stats.queries[0]).toContain('user_id = "user-1"');
    expect(collection.stats.queries[0]).toContain('user_id = ""');
    expect(collection.stats.queries[0]).toContain('user_id = nil');
    expect(collection.stats.queries[0]).toContain('is_deleted = false');
    expect(counter.count).toBe(0);
    expect(page[0]).not.toHaveProperty('content');
  });

  it('过滤条件与排序语义与 findByUser 一致', () => {
    const Note = loadNote();
    const collection = createCountingResults(
      createRows(40, createRowFactory({ count: 0 })),
    );
    const realm = { objects: () => collection };

    const page = Note.findByUserSummaries(realm, 'user-2', {
      category_id: 'cat-9',
      tags: ['a', 'b'],
      search: '关键词',
      sort: { title: 1 },
      skip: 5,
      limit: 5,
    });

    const query = collection.stats.queries[0];
    expect(page).toHaveLength(5);
    expect(query).toContain('user_id = "user-2"');
    expect(query).toContain('user_id = ""');
    expect(query).toContain('user_id = nil');
    expect(query).toContain('category_id = "cat-9"');
    expect(query).toContain('tags CONTAINS "a" OR tags CONTAINS "b"');
    expect(query).toContain('title CONTAINS[c] "关键词"');
    expect(collection.stats.sortedCalls).toBe(1);
  });

  it('无主笔记（user_id 为空串）与当前用户笔记一起进入 summary 页，其他账号仍被排除', () => {
    const Note = loadNote();
    const makeRows = (count, overrides) =>
      createRows(count, createRowFactory({ count: 0 })).map((row, index) => ({
        ...row,
        ...overrides(row, index),
      }));
    const rows = [
      ...makeRows(5, () => ({})),
      ...makeRows(5, (row, index) => ({ _id: `ownerless-${index}`, user_id: '' })),
      ...makeRows(5, (row, index) => ({ _id: `foreign-${index}`, user_id: 'other-account' })),
    ];
    const collection = createCountingResults(rows, {
      applyFilter: (item, query) => {
        const allowsEmptyOwner = query.includes('user_id = ""');
        const matched = /user_id = "([^"]*)"/.exec(query);
        if (!matched) {
          return true;
        }
        return item.user_id === matched[1] || (allowsEmptyOwner && item.user_id === '');
      },
    });
    const realm = { objects: () => collection };

    const page = Note.findByUserSummaries(realm, 'user-1', { skip: 0, limit: 20 });

    expect(page).toHaveLength(10);
    expect(page.filter(summary => summary.user_id === '')).toHaveLength(5);
    expect(page.some(summary => String(summary._id).startsWith('ownerless-'))).toBe(true);
    expect(page.some(summary => summary.user_id === 'other-account')).toBe(false);
  });

  it('null owner 笔记（runtime schema string?）同样进入 summary 页，其他账号仍被排除', () => {
    const Note = loadNote();
    const makeRows = (count, overrides) =>
      createRows(count, createRowFactory({ count: 0 })).map((row, index) => ({
        ...row,
        ...overrides(row, index),
      }));
    const rows = [
      ...makeRows(5, () => ({})),
      ...makeRows(5, (row, index) => ({ _id: `null-owner-${index}`, user_id: null })),
      ...makeRows(5, (row, index) => ({ _id: `foreign-${index}`, user_id: 'other-account' })),
    ];
    const collection = createCountingResults(rows, {
      applyFilter: (item, query) => {
        const allowsEmptyOwner = query.includes('user_id = ""');
        const allowsNilOwner = query.includes('user_id = nil');
        const matched = /user_id = "([^"]*)"/.exec(query);
        const isOwnerless =
          (allowsNilOwner && (item.user_id === null || item.user_id === undefined)) ||
          (allowsEmptyOwner && item.user_id === '');
        if (isOwnerless) {
          return true;
        }
        if (!matched) {
          return true;
        }
        return item.user_id === matched[1];
      },
    });
    const realm = { objects: () => collection };

    const page = Note.findByUserSummaries(realm, 'user-1', { skip: 0, limit: 20 });

    expect(page).toHaveLength(10);
    expect(page.filter(summary => summary.user_id === null)).toHaveLength(5);
    expect(page.some(summary => String(summary._id).startsWith('null-owner-'))).toBe(true);
    expect(page.some(summary => summary.user_id === 'other-account')).toBe(false);
  });

  it('findByUser 契约不变：未分页时返回惰性集合，不物化整表', () => {
    const Note = loadNote();
    const counter = { count: 0 };
    const collection = createCountingResults(createRows(100, createRowFactory(counter)));
    const realm = { objects: () => collection };

    const results = Note.findByUser(realm, 'user-1');

    expect(Array.isArray(results)).toBe(false);
    expect(results.length).toBe(100);
    expect(collection.stats.materialized).toBe(0);
    expect(counter.count).toBe(0);
  });

  it('findByUser 分页时仍只物化当前页（回归）', () => {
    const Note = loadNote();
    const collection = createCountingResults(
      createRows(1000, createRowFactory({ count: 0 })),
    );
    const realm = { objects: () => collection };

    const page = Note.findByUser(realm, 'user-1', { skip: 500, limit: 10 });

    expect(page).toHaveLength(10);
    expect(collection.stats.materialized).toBe(10);
  });
});
