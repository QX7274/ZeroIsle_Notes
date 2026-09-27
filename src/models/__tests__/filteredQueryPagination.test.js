/**
 * 里程碑 5.1 续（RISK-PERF-002）：JS 谓词过滤路径不再无条件全量物化。
 *
 * 覆盖对象：
 * - `src/models/utils/queryPagination.js` 的有界窗口工具
 * - `src/models/utils/realmQuery.js` 的查询字面量工具
 * - `AIChat.search`（消息 JSON 全文匹配 + 分页）
 * - `MindMap / InfiniteCanvas / KnowledgeGraph.findSharedWithUser`（shared_with JSON 解析 + 排序 + 分页）
 * - `SearchIndex.vectorSearch`（已有限流写法的确认）
 *
 * 每个改造点都同时断言两件事：
 * 1. 语义不变：与「旧实现」在同一份伪数据上的结果逐条一致（用 _id 序列比对）；
 * 2. 内存有界：常规分页调用的 materialize 条目数显著小于全量行数。
 */

const { createCountingResults } = require('./helpers/countingResults.cjs');
const {
  DEFAULT_FILTER_WINDOW,
  filterPageInWindows,
  tryFilterSortPageInWindows,
  comparableKeyOf,
} = require('../utils/queryPagination');
const { escapeRealmString, isRawJsonEmbeddable } = require('../utils/realmQuery');

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------

describe('queryPagination 有界窗口工具', () => {
  const rows = Array.from({ length: 1000 }, (_, i) => ({ _id: `r${i}`, value: i }));
  const isEven = row => row.value % 2 === 0;

  it('filterPageInWindows 只物化取满当前页所需的窗口，结果与全量过滤一致', () => {
    const collection = createCountingResults(rows);
    const page = filterPageInWindows(collection, isEven, { skip: 4, limit: 3 });
    const expected = rows.filter(isEven).slice(4, 7).map(row => row._id);

    expect(page.map(row => row._id)).toEqual(expected);
    // 7 条匹配落在第一个窗口内 => 只读一个窗口
    expect(collection.stats.materialized).toBe(DEFAULT_FILTER_WINDOW);
    expect(collection.stats.materialized).toBeLessThan(rows.length);
  });

  it('filterPageInWindows 未分页时返回全部匹配项（保持数组契约）', () => {
    const collection = createCountingResults(rows);
    const all = filterPageInWindows(collection, isEven, {});

    expect(all).toHaveLength(500);
    expect(all[0]._id).toBe('r0');
    expect(all[499]._id).toBe('r998');
    expect(collection.stats.materialized).toBe(rows.length);
  });

  it('filterPageInWindows 保留历史 slice 边界语义（limit<=0 / 负数 skip 回退为全量收集）', () => {
    const collection = createCountingResults(rows);

    // 旧实现：Array.from(results).filter(p).slice(0, -3)
    const page = filterPageInWindows(collection, isEven, { skip: 0, limit: -3 });
    const expected = rows.filter(isEven).slice(0, -3).map(row => row._id);

    expect(page.map(row => row._id)).toEqual(expected);
    // 无法有界 => 全量收集（与旧实现一致）
    expect(collection.stats.materialized).toBe(rows.length);
  });

  it('tryFilterSortPageInWindows 在排序键唯一时返回有界页，并列键跨页时返回 null 回退', () => {
    const unique = Array.from({ length: 600 }, (_, i) => ({ _id: `u${i}`, score: 600 - i }));
    const comparator = (a, b) => b.score - a.score;

    const distinctCollection = createCountingResults(unique);
    const sorted = distinctCollection.sorted('score', true);
    const page = tryFilterSortPageInWindows(sorted, () => true, comparator, {
      skip: 2,
      limit: 3,
      sortField: 'score',
      requireDistinctKeys: true,
    });

    expect(page.map(row => row._id)).toEqual(['u2', 'u3', 'u4']);
    expect(distinctCollection.stats.materialized).toBe(DEFAULT_FILTER_WINDOW);

    // 并列键一直延续到集合末尾 => 无法只靠前缀判定，必须回退
    const tied = Array.from({ length: 300 }, (_, i) => ({ _id: `t${i}`, score: 1 }));
    const tiedCollection = createCountingResults(tied);
    const tiedSorted = tiedCollection.sorted('score', true);
    expect(tryFilterSortPageInWindows(tiedSorted, () => true, comparator, {
      skip: 0,
      limit: 3,
      sortField: 'score',
      requireDistinctKeys: true,
    })).toBeNull();
  });

  it('前缀已覆盖到集合末尾时无需并列键守卫，直接返回该页', () => {
    const tied = Array.from({ length: 5 }, (_, i) => ({ _id: `e${i}`, score: 1 }));
    const collection = createCountingResults(tied);
    const sorted = collection.sorted('score', true);

    const page = tryFilterSortPageInWindows(sorted, () => true, (a, b) => b.score - a.score, {
      skip: 0,
      limit: 5,
      sortField: 'score',
      requireDistinctKeys: true,
    });

    expect(page.map(row => row._id)).toEqual(['e0', 'e1', 'e2', 'e3', 'e4']);
    expect(collection.stats.materialized).toBe(5);
  });

  it('页内出现并列排序键且后面还有其它记录时必须回退（守卫 A）', () => {
    const duplicatedKeyRows = [
      { _id: 'a', score: 5 },
      { _id: 'b', score: 5 },
      { _id: 'c', score: 4 },
      { _id: 'd', score: 3 },
      { _id: 'e', score: 2 },
    ];
    const collection = createCountingResults(duplicatedKeyRows);
    const sorted = collection.sorted('score', true);

    expect(tryFilterSortPageInWindows(sorted, () => true, (a, b) => b.score - a.score, {
      skip: 0,
      limit: 3,
      sortField: 'score',
      requireDistinctKeys: true,
    })).toBeNull();
  });

  it('comparableKeyOf 只接受可比较的排序键', () => {
    expect(comparableKeyOf({ k: 3 }, 'k')).toBe(3);
    expect(comparableKeyOf({ k: 'a' }, 'k')).toBe('a');
    expect(comparableKeyOf({ k: new Date(5) }, 'k')).toBe(5);
    expect(comparableKeyOf({ k: { nested: 1 } }, 'k')).toBeNull();
    expect(comparableKeyOf({ k: null }, 'k')).toBeNull();
  });
});

describe('realmQuery 查询字面量工具', () => {
  it('escapeRealmString 转义双引号与反斜杠', () => {
    expect(escapeRealmString('a"b')).toBe('a\\"b');
    expect(escapeRealmString('a\\b')).toBe('a\\\\b');
    expect(escapeRealmString(undefined)).toBe('');
  });

  it('isRawJsonEmbeddable 只对可原样嵌入 JSON 的 id 返回 true', () => {
    expect(isRawJsonEmbeddable('user-1')).toBe(true);
    expect(isRawJsonEmbeddable('用户😀')).toBe(true);
    expect(isRawJsonEmbeddable('user"1')).toBe(false);
    expect(isRawJsonEmbeddable('user\\1')).toBe(false);
    expect(isRawJsonEmbeddable('')).toBe(false);
    expect(isRawJsonEmbeddable(null)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// AIChat.search
// ---------------------------------------------------------------------------

describe('AIChat.search 有界窗口（消息 JSON 全文匹配）', () => {
  const load = () => require('../AIChat').default || require('../AIChat');

  const KEYWORD = '项目';
  const USER = 'user-1';

  const makeChat = (id, index, title, contents) => ({
    _id: id,
    title,
    messages: JSON.stringify(contents.map(content => ({ role: 'user', content }))),
    user_id: USER,
    is_deleted: false,
    updated_at: 100000 - index,
  });

  // 1500 条：updated_at 降序（模拟 .sorted('updated_at', true)）。
  // 偶数下标标题都含关键词 => 能通过数据库层的 title 收窄（750 条）；
  // 其中只有 4 条的消息 JSON 真正含关键词 => 必须由 JS 过滤决定。
  const MATCHING_INDEXES = [0, 2, 4, 450];
  const chats = Array.from({ length: 1500 }, (_, index) => {
    if (MATCHING_INDEXES.includes(index)) {
      return makeChat(`chat-${index}`, index, `项目-${index}`, [`内容提到项目-${index}`]);
    }
    if (index % 2 === 0) {
      return makeChat(`chat-${index}`, index, `项目-${index}`, [`普通内容${index}`]);
    }
    return makeChat(`chat-${index}`, index, `普通标题${index}`, [`普通内容${index}`]);
  });
  const DB_NARROWED_COUNT = chats.filter(chat => chat.title.includes(KEYWORD)).length;

  // 数据库层收窄的模拟：user_id / is_deleted / title CONTAINS[c] keyword
  const applyDbNarrowing = (chat, query) => {
    const keywordMatch = query.match(/title CONTAINS\[c\] "(.*)"\)/);
    const keyword = keywordMatch ? keywordMatch[1].replace(/\\"/g, '"').replace(/\\\\/g, '\\') : '';
    return chat.user_id === USER
      && chat.is_deleted === false
      && chat.title.toLowerCase().includes(keyword.toLowerCase());
  };

  /** 旧实现（全量物化）作为语义基准 */
  const legacySearch = (rows, userId, searchText, options = {}) => {
    const keyword = typeof searchText === 'string' ? searchText : '';
    const matched = rows.filter(chat => (
      chat.user_id === userId
      && chat.is_deleted === false
      && chat.title.toLowerCase().includes(keyword.toLowerCase())
    )).filter(chat => {
      try {
        const messages = JSON.parse(chat.messages);
        return messages.some(msg => msg.content && msg.content.toLowerCase().includes(keyword.toLowerCase()));
      } catch (e) {
        return false;
      }
    });

    if (options.skip !== undefined && options.limit !== undefined) {
      const skip = options.skip || 0;
      const limit = options.limit || 20;
      return matched.slice(skip, skip + limit);
    }
    return matched;
  };

  const makeRealm = () => {
    const collection = createCountingResults(chats, { applyFilter: applyDbNarrowing });
    return { realm: { objects: () => collection }, collection };
  };

  it('未分页时返回全部命中（数量、顺序、字段值与旧实现一致）', () => {
    const AIChat = load();
    const { realm, collection } = makeRealm();

    const result = AIChat.search(realm, USER, KEYWORD);

    expect(result.map(chat => chat._id)).toEqual(legacySearch(chats, USER, KEYWORD).map(chat => chat._id));
    expect(result.map(chat => chat._id)).toEqual(['chat-0', 'chat-2', 'chat-4', 'chat-450']);
    expect(result[0].title).toBe('项目-0');
    expect(result[3].updated_at).toBe(100000 - 450);
    // 未分页的契约是「返回全部匹配项」=> 数据库层收窄后的 750 条都要读一遍（不可避免，已注释）
    expect(DB_NARROWED_COUNT).toBe(750);
    expect(collection.stats.materialized).toBe(DB_NARROWED_COUNT);
  });

  it('对照：历史 Array.from(results) 写法必然物化收窄后的全部 750 行', () => {
    const collection = createCountingResults(chats, { applyFilter: applyDbNarrowing });
    const matchesMessages = chat => {
      try {
        const messages = JSON.parse(chat.messages);
        return messages.some(msg => msg.content && msg.content.toLowerCase().includes(KEYWORD.toLowerCase()));
      } catch (e) {
        return false;
      }
    };

    // 旧实现等价写法：先按数据库条件收窄，再整表物化、过滤、分页
    const dbNarrowed = collection.filtered(
      `user_id = "${USER}" AND is_deleted = false AND (title CONTAINS[c] "${KEYWORD}")`,
    );
    const legacyPage = Array.from(dbNarrowed).filter(matchesMessages).slice(0, 2);

    expect(legacyPage.map(chat => chat._id)).toEqual(['chat-0', 'chat-2']);
    expect(collection.stats.materialized).toBe(DB_NARROWED_COUNT);
    expect(collection.stats.materialized).toBeGreaterThan(DEFAULT_FILTER_WINDOW);
  });

  it('分页时只物化当前页所在的窗口，结果与全量过滤后 slice 一致', () => {
    const AIChat = load();
    const { realm, collection } = makeRealm();

    const page = AIChat.search(realm, USER, KEYWORD, { skip: 1, limit: 2 });

    expect(page.map(chat => chat._id)).toEqual(
      legacySearch(chats, USER, KEYWORD, { skip: 1, limit: 2 }).map(chat => chat._id),
    );
    expect(page.map(chat => chat._id)).toEqual(['chat-2', 'chat-4']);
    expect(collection.stats.materialized).toBe(DEFAULT_FILTER_WINDOW);
    expect(collection.stats.materialized).toBeLessThan(chats.length / 5);
  });

  it('命中项在很靠后的位置时按需扩展窗口，仍然小于全量', () => {
    const AIChat = load();

    const headCollection = createCountingResults(chats, { applyFilter: applyDbNarrowing });
    const headPage = AIChat.search(
      { objects: () => headCollection },
      USER,
      KEYWORD,
      { skip: 0, limit: 1 },
    );
    expect(headPage.map(chat => chat._id)).toEqual(['chat-0']);
    expect(headCollection.stats.materialized).toBe(DEFAULT_FILTER_WINDOW);

    // chat-450 是收窄后视图里的第 226 条 => 需要读到第 2 个窗口
    const lateCollection = createCountingResults(chats, { applyFilter: applyDbNarrowing });
    const latePage = AIChat.search(
      { objects: () => lateCollection },
      USER,
      KEYWORD,
      { skip: 3, limit: 1 },
    );
    expect(latePage.map(chat => chat._id)).toEqual(['chat-450']);
    expect(lateCollection.stats.materialized).toBe(DEFAULT_FILTER_WINDOW * 2);
    expect(lateCollection.stats.materialized).toBeLessThan(chats.length);
  });

  it('数据库层条件（user_id / is_deleted / title）保持下推，且查询串已转义', () => {
    const AIChat = load();
    const { realm, collection } = makeRealm();

    AIChat.search(realm, 'user-"1"', '标题 "引号"', { skip: 0, limit: 5 });

    expect(collection.stats.queries).toHaveLength(1);
    expect(collection.stats.queries[0]).toContain('user_id = "user-\\"1\\""');
    expect(collection.stats.queries[0]).toContain('is_deleted = false');
    expect(collection.stats.queries[0]).toContain('title CONTAINS[c] "标题 \\"引号\\""');
  });

  it('10 万条聊天记录下，分页查询也只物化一个窗口', () => {
    const AIChat = load();
    const total = 100000;
    const bigRows = Array.from({ length: total }, (_, index) => {
      const title = index % 2 === 0 ? `项目-${index}` : `普通标题${index}`;
      const content = index < 6 && index % 2 === 0 ? `内容提到项目-${index}` : `普通内容${index}`;
      return makeChat(`chat-${index}`, index, title, [content]);
    });
    const collection = createCountingResults(bigRows, { applyFilter: applyDbNarrowing });

    const page = AIChat.search({ objects: () => collection }, USER, KEYWORD, { skip: 0, limit: 3 });

    expect(page.map(chat => chat._id)).toEqual(['chat-0', 'chat-2', 'chat-4']);
    expect(collection.stats.materialized).toBe(DEFAULT_FILTER_WINDOW);
    expect(collection.stats.materialized).toBeLessThan(total / 100);
  });

  it('非字符串关键词按空关键词处理，不再拼出 "undefined" 查询', () => {
    const AIChat = load();
    const { realm, collection } = makeRealm();

    const result = AIChat.search(realm, USER, undefined, { skip: 0, limit: 2 });

    expect(collection.stats.queries[0]).toContain('title CONTAINS[c] ""');
    // 空关键词 => 消息过滤恒真，返回前 2 条（按 updated_at 降序）
    expect(result.map(chat => chat._id)).toEqual(['chat-0', 'chat-1']);
  });
});

// ---------------------------------------------------------------------------
// MindMap / InfiniteCanvas / KnowledgeGraph.findSharedWithUser
// ---------------------------------------------------------------------------

describe('findSharedWithUser 有界窗口（shared_with JSON 过滤 + 排序 + 分页）', () => {
  const MODELS = [
    { name: 'MindMap', loader: () => require('../MindMap').default || require('../MindMap') },
    { name: 'InfiniteCanvas', loader: () => require('../InfiniteCanvas').default || require('../InfiniteCanvas') },
    { name: 'KnowledgeGraph', loader: () => require('../KnowledgeGraph').default || require('../KnowledgeGraph') },
  ];

  const TARGET_USER = 'user-2';

  /**
   * 伪数据：1000 条未删除记录，每 5 条中有 1 条分享给 TARGET_USER，
   * updated_at 唯一（保证有界路径可用），title 唯一（支持 options.sort 分支）。
   */
  const buildRows = () => Array.from({ length: 1000 }, (_, index) => {
    const sharedWithTarget = index % 5 === 0;
    return {
      _id: `row-${index}`,
      title: `title-${String(1000 - index).padStart(4, '0')}`,
      shared_with: JSON.stringify(sharedWithTarget
        ? [{ user_id: TARGET_USER, permission: 'read' }]
        : [{ user_id: 'other-user', permission: 'write' }]),
      updated_at: 100000 - index,
      is_deleted: false,
    };
  });

  // 模拟数据库层收窄（is_deleted + shared_with CONTAINS[c]）
  const applyDbNarrowing = (row, query) => {
    if (!query.includes('is_deleted = false')) {
      return true;
    }
    const containsMatch = query.match(/shared_with CONTAINS\[c\] "(.*)"/);
    if (!containsMatch) {
      return true;
    }
    const needle = containsMatch[1].replace(/\\"/g, '"');
    return typeof row.shared_with === 'string' && row.shared_with.includes(needle);
  };

  /** 旧实现（全量物化 + JS 解析 + JS 排序 + JS 分页）作为语义基准 */
  const legacyFindSharedWithUser = (rows, userId, options = {}) => {
    const { permission = null } = options;
    let matched = rows.filter(row => {
      try {
        const sharedWith = JSON.parse(row.shared_with || '[]');
        const share = sharedWith.find(s => s.user_id === userId);
        if (!share) {
          return false;
        }
        if (permission && share.permission !== permission) {
          return false;
        }
        return true;
      } catch (e) {
        return false;
      }
    });

    if (options.sort) {
      const sortField = Object.keys(options.sort)[0];
      const sortDirection = options.sort[sortField] === -1;
      matched = matched.slice().sort((a, b) => {
        if (sortDirection) {
          return b[sortField] > a[sortField] ? 1 : -1;
        }
        return a[sortField] > b[sortField] ? 1 : -1;
      });
    } else {
      matched = matched.slice().sort((a, b) => b.updated_at - a.updated_at);
    }

    if (options.skip !== undefined && options.limit !== undefined) {
      const skip = options.skip || 0;
      const limit = options.limit || 20;
      return matched.slice(skip, skip + limit);
    }
    return matched;
  };

  MODELS.forEach(({ name, loader }) => {
    describe(name, () => {
      const Model = loader();

      it('未分页时返回全部命中（结果与旧实现一致）', () => {
        const rows = buildRows();
        const collection = createCountingResults(rows, { applyFilter: applyDbNarrowing });
        const realm = { objects: () => collection };

        const result = Model.findSharedWithUser(realm, TARGET_USER);

        expect(result.map(row => row._id)).toEqual(
          legacyFindSharedWithUser(rows, TARGET_USER).map(row => row._id),
        );
        expect(result).toHaveLength(200);
        expect(result[0]._id).toBe('row-0');
        expect(result[199]._id).toBe('row-995');
        // 未分页要求返回全部命中 => 全量读取（注释中已标明）
        expect(collection.stats.materialized).toBe(200);
      });

      it('分页时只物化当前页所在窗口，结果与旧实现一致', () => {
        const rows = buildRows();
        const collection = createCountingResults(rows, { applyFilter: applyDbNarrowing });
        const realm = { objects: () => collection };

        const result = Model.findSharedWithUser(realm, TARGET_USER, { skip: 2, limit: 3 });

        expect(result.map(row => row._id)).toEqual(
          legacyFindSharedWithUser(rows, TARGET_USER, { skip: 2, limit: 3 }).map(row => row._id),
        );
        expect(result.map(row => row._id)).toEqual(['row-10', 'row-15', 'row-20']);
        expect(collection.stats.materialized).toBeLessThan(rows.length);
      });

      it('对照：历史写法物化全部 1000 行，改造后只读前缀窗口', () => {
        const rows = buildRows();

        const legacyCollection = createCountingResults(rows);
        Array.from(legacyCollection)
          .filter(row => JSON.parse(row.shared_with).some(share => share.user_id === TARGET_USER))
          .slice(0, 50);
        expect(legacyCollection.stats.materialized).toBe(rows.length);

        const boundedCollection = createCountingResults(rows);
        Model.findSharedWithUser({ objects: () => boundedCollection }, TARGET_USER, { skip: 0, limit: 50 });
        expect(boundedCollection.stats.materialized).toBe(DEFAULT_FILTER_WINDOW * 2);
        expect(boundedCollection.stats.materialized).toBeLessThan(legacyCollection.stats.materialized);
      });

      it('shared_with 下推（超集收窄）确实减少了需要 JS 处理的数据量', () => {
        const rows = buildRows();
        const narrowed = createCountingResults(rows, { applyFilter: applyDbNarrowing });
        Model.findSharedWithUser({ objects: () => narrowed }, TARGET_USER, { skip: 0, limit: 50 });

        const broad = createCountingResults(rows);
        Model.findSharedWithUser({ objects: () => broad }, TARGET_USER, { skip: 0, limit: 50 });

        expect(broad.stats.queries[0]).toContain('shared_with CONTAINS[c] "user-2"');
        expect(narrowed.stats.queries[0]).toContain('shared_with CONTAINS[c] "user-2"');
        // 未收窄时需要扫过 400 行才凑够 50 条命中；收窄后一个窗口即可
        expect(broad.stats.materialized).toBe(DEFAULT_FILTER_WINDOW * 2);
        expect(narrowed.stats.materialized).toBe(DEFAULT_FILTER_WINDOW);
        expect(narrowed.stats.materialized).toBeLessThan(broad.stats.materialized);
      });

      it('options.sort 分支同样保持语义，并在并列键不可判定时回退', () => {
        const rows = buildRows();
        const collection = createCountingResults(rows, { applyFilter: applyDbNarrowing });
        const realm = { objects: () => collection };
        const options = { sort: { title: -1 }, skip: 1, limit: 2 };

        const result = Model.findSharedWithUser(realm, TARGET_USER, options);

        expect(result.map(row => row._id)).toEqual(
          legacyFindSharedWithUser(rows, TARGET_USER, options).map(row => row._id),
        );
        // title 唯一 => 有界路径可用
        expect(collection.stats.materialized).toBeLessThan(rows.length);
      });

      it('排序键并列时回退到全量路径，结果仍与旧实现逐条一致', () => {
        const rows = buildRows().map(row => ({ ...row, updated_at: 1 }));
        const collection = createCountingResults(rows, { applyFilter: applyDbNarrowing });
        const realm = { objects: () => collection };
        const options = { skip: 0, limit: 4 };

        const result = Model.findSharedWithUser(realm, TARGET_USER, options);

        expect(result.map(row => row._id)).toEqual(
          legacyFindSharedWithUser(rows, TARGET_USER, options).map(row => row._id),
        );
        // 并列键无法只靠前缀判定 => 回退到全量路径：
        // 守卫扫描先读了 200 条，回退时又从头物化 200 条（正确性优先于这一次额外的读取）
        expect(collection.stats.materialized).toBe(400);
      });

      it('排序下推失败时回退到全量路径，结果仍与旧实现一致', () => {
        const rows = buildRows();
        const collection = createCountingResults(rows, {
          applyFilter: applyDbNarrowing,
          sortedThrows: true,
        });
        const realm = { objects: () => collection };
        const options = { skip: 1, limit: 3 };

        const result = Model.findSharedWithUser(realm, TARGET_USER, options);

        expect(result.map(row => row._id)).toEqual(
          legacyFindSharedWithUser(rows, TARGET_USER, options).map(row => row._id),
        );
        expect(collection.stats.materialized).toBe(200);
      });

      it('userId 不能原样嵌入 JSON 时不下推 shared_with，避免漏结果', () => {
        const rows = buildRows();
        const collection = createCountingResults(rows, { applyFilter: applyDbNarrowing });
        const realm = { objects: () => collection };
        const trickyUser = 'user-"2"';

        Model.findSharedWithUser(realm, trickyUser, { skip: 0, limit: 5 });

        expect(collection.stats.queries[0]).not.toContain('shared_with CONTAINS[c]');
        expect(collection.stats.queries[0]).toBe('is_deleted = false');
      });

      it('permission 过滤保持有效', () => {
        const rows = buildRows().map((row, index) => (
          index % 10 === 0
            ? { ...row, shared_with: JSON.stringify([{ user_id: TARGET_USER, permission: 'write' }]) }
            : row
        ));
        const collection = createCountingResults(rows, { applyFilter: applyDbNarrowing });
        const realm = { objects: () => collection };
        const options = { permission: 'write', skip: 0, limit: 3 };

        const result = Model.findSharedWithUser(realm, TARGET_USER, options);

        expect(result.map(row => row._id)).toEqual(
          legacyFindSharedWithUser(rows, TARGET_USER, options).map(row => row._id),
        );
        expect(result.map(row => row._id)).toEqual(['row-0', 'row-10', 'row-20']);
      });
    });
  });
});

// ---------------------------------------------------------------------------
// SearchIndex.vectorSearch
// ---------------------------------------------------------------------------

describe('SearchIndex.vectorSearch 已有限流写法', () => {
  const load = () => require('../SearchIndex').default || require('../SearchIndex');

  const buildIndexRows = count => Array.from({ length: count }, (_, index) => ({
    _id: `idx-${index}`,
    embedding: JSON.stringify([1, 0]),
    relevance_score: 1,
  }));

  it('最多只物化 500 条候选，不会把整张索引表读出来', () => {
    const SearchIndex = load();
    const rows = buildIndexRows(1200);
    const collection = createCountingResults(rows);
    const realm = { objects: () => collection };

    const result = SearchIndex.vectorSearch(realm, 'user-1', [1, 0], { limit: 5, min_similarity: 0.9 });

    expect(collection.stats.materialized).toBe(500);
    expect(result.map(row => row._id)).toEqual(['idx-0', 'idx-1', 'idx-2', 'idx-3', 'idx-4']);
    expect(collection.stats.materialized).toBeLessThan(rows.length);
  });

  it('索引规模小于上限时结果不受影响（与全量候选计算一致）', () => {
    const SearchIndex = load();
    const rows = buildIndexRows(10);
    const collection = createCountingResults(rows);
    const realm = { objects: () => collection };

    const result = SearchIndex.vectorSearch(realm, 'user-1', [1, 0], { limit: 20, min_similarity: 0.5 });

    expect(result).toHaveLength(10);
    expect(collection.stats.materialized).toBe(10);
  });
});
