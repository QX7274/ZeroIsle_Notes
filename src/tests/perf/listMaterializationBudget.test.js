/**
 * 10 万条数据下的「列表入口物化预算」回归门禁（里程碑 5.1 / RISK-PERF-002）
 *
 * 目标：把「10 万条下每个列表入口只物化当前页」从一次性的验证
 * （src/models/__tests__/filteredQueryPagination.test.js、noteProjection.test.js）
 * 升级为可持续运行的回归门禁，并在文件末尾集中输出可归档的基线数据。
 *
 * 度量方式：复用 src/models/__tests__/helpers/countingResults.cjs 的伪 Realm Results，
 * 只有真正读取（迭代 / Array.from）才会累加 stats.materialized；
 * filtered() / sorted() / slice() 全部保持惰性，与真实 Realm 的 Results 语义一致。
 *
 * 断言只使用确定性指标（物化条数、返回值的惰性形态），**不写任何耗时断言**，
 * 避免在不同机器上出现 flaky。
 *
 * 本文件只读取源码，不修改任何实现；无法在不改源码前提下安全构造 100k 假数据的
 * 入口记录在文件末尾的 TODO 与 src/tests/perf/README.md 中。
 */

const TOTAL_ROWS = 100000;

const { createCountingResults } = require('../../models/__tests__/helpers/countingResults.cjs');
const { DEFAULT_FILTER_WINDOW } = require('../../models/utils/queryPagination');

/** 与 src/models/SearchIndex.js 中的 VECTOR_SCAN_LIMIT 常量对齐（该常量未导出） */
const VECTOR_SCAN_LIMIT = 500;

const USER_ID = 'user-1';
const TARGET_USER = 'user-2';
const KEYWORD = '项目';

// ---------------------------------------------------------------------------
// 模型加载器（沿用仓库既有测试的 .default || module 写法）
// ---------------------------------------------------------------------------

const loaders = {
  Note: () => require('../../models/Note').default || require('../../models/Note'),
  AIChat: () => require('../../models/AIChat').default || require('../../models/AIChat'),
  MindMap: () => require('../../models/MindMap').default || require('../../models/MindMap'),
  InfiniteCanvas: () => require('../../models/InfiniteCanvas').default || require('../../models/InfiniteCanvas'),
  KnowledgeGraph: () => require('../../models/KnowledgeGraph').default || require('../../models/KnowledgeGraph'),
  KnowledgeNode: () => require('../../models/KnowledgeNode').default || require('../../models/KnowledgeNode'),
  KnowledgeEdge: () => require('../../models/KnowledgeEdge').default || require('../../models/KnowledgeEdge'),
  SearchIndex: () => require('../../models/SearchIndex').default || require('../../models/SearchIndex'),
  Tag: () => require('../../models/Tag').default || require('../../models/Tag'),
  File: () => require('../../models/File').default || require('../../models/File'),
  Reminder: () => require('../../models/Reminder').default || require('../../models/Reminder'),
  Category: () => require('../../models/Category').default || require('../../models/Category'),
  SearchHistory: () => require('../../models/SearchHistory').default || require('../../models/SearchHistory'),
  SyncInfo: () => require('../../models/SyncInfo').default || require('../../models/SyncInfo'),
};

// ---------------------------------------------------------------------------
// 集中基线报告：各入口实测物化条数在 afterAll 里汇总打印
// ---------------------------------------------------------------------------

const BASELINE = [];

/**
 * 记录一条物化预算基线
 * @param {string} entry 入口名
 * @param {number} materialized 实测物化条数
 * @param {string} budget 预算（中文说明）
 */
function recordBaseline(entry, materialized, budget) {
  BASELINE.push({ entry, materialized, budget });
}

afterAll(() => {
  if (BASELINE.length === 0) {
    return;
  }
  const rows = BASELINE.map(item => `| ${item.entry} | ${item.materialized} | ${item.budget} |`);
  console.info(
    [
      '',
      `10 万条列表物化预算基线汇总（共 ${BASELINE.length} 个入口）`,
      '| 入口 | 实测物化条数 | 预算 |',
      '| --- | --- | --- |',
      ...rows,
      '',
    ].join('\n'),
  );
});

// ---------------------------------------------------------------------------
// 数据与断言辅助
// ---------------------------------------------------------------------------

/**
 * 构造 10 万条笔记行：标记位按固定周期分布，模拟真实库里「少量收藏 / 归档 / 删除」。
 * @param {number} [count]
 * @returns {Array<Object>}
 */
function createNoteRows(count = TOTAL_ROWS) {
  return Array.from({ length: count }, (_, index) => ({
    _id: `note-${index}`,
    user_id: USER_ID,
    title: `标题-${index}`,
    content: `正文-${index}`,
    tags: ['标签-1'],
    category_id: 'cat-1',
    is_favorite: index % 50 === 0,
    is_archived: index % 100 === 0,
    is_deleted: index % 1000 === 0,
    created_at: new Date(1700000000000 + index),
    updated_at: new Date(1700000000000 + index),
    deleted_at: new Date(1700000000000 + index),
    metadata: '{}',
  }));
}

/**
 * 模拟数据库层原生条件收窄（只处理布尔标记位，不做 JS 谓词过滤）。
 * 与真实 Realm 一致：收窄本身不等于 materialize。
 * @param {Object} row
 * @param {string} query
 * @returns {boolean}
 */
function applyNoteDbNarrowing(row, query) {
  if (query.includes('is_deleted = true') && row.is_deleted !== true) {
    return false;
  }
  if (query.includes('is_deleted = false') && row.is_deleted !== false) {
    return false;
  }
  if (query.includes('is_archived = true') && row.is_archived !== true) {
    return false;
  }
  if (query.includes('is_archived = false') && row.is_archived !== false) {
    return false;
  }
  if (query.includes('is_favorite = true') && row.is_favorite !== true) {
    return false;
  }
  return true;
}

/**
 * 用可计数的伪 Results 构造 realm（schema 为空数组，避免 Tag 等入口读取 realm.schema 报错）
 * @param {Array<Object>} rows
 * @param {Object} [options]
 * @returns {{realm: Object, collection: Object}}
 */
function createNoteRealm(rows, options = {}) {
  const collection = createCountingResults(
    rows,
    Object.assign({ applyFilter: applyNoteDbNarrowing }, options),
  );
  return { realm: { objects: () => collection, schema: [] }, collection };
}

/**
 * 消费分页结果：数组直接使用；惰性 Results 则读取当前页（只有这一步才 materialize）。
 * @param {Array|Object} result
 * @returns {Array}
 */
function consumePage(result) {
  return Array.isArray(result) ? result : Array.from(result);
}

/**
 * 有界窗口扫描的物化上界：ceil((skip + limit) / window) * window
 * @param {number} skip
 * @param {number} limit
 * @param {number} [window]
 * @returns {number}
 */
function expectedScannedRows(skip, limit, window = DEFAULT_FILTER_WINDOW) {
  return Math.ceil((skip + limit) / window) * window;
}

// ---------------------------------------------------------------------------
// 门禁灵敏度：证明计数器确实能分辨「整表物化」与「只物化一页」
// ---------------------------------------------------------------------------

describe('门禁灵敏度（对照：历史整表物化写法）', () => {
  it('Array.from(results) 再 slice 会物化全表 10 万条，与分页预算相差 3 个数量级', () => {
    const collection = createCountingResults(createNoteRows());

    // 历史写法：先把整表读成数组，再截取一页
    const legacyPage = Array.from(collection).slice(50000, 50020);

    // 结果条数看起来没问题，但代价是整表 10 万条都进了内存
    expect(legacyPage).toHaveLength(20);
    expect(collection.stats.materialized).toBe(TOTAL_ROWS);
    // 只要某个入口回退成这种写法，本文件里 `materialized === limit` 的断言就会立刻失败
    expect(collection.stats.materialized).toBeGreaterThan(20);
  });
});

// ---------------------------------------------------------------------------
// Note 列表入口
// ---------------------------------------------------------------------------

describe('Note 列表入口（10 万条）', () => {
  let rows;

  beforeAll(() => {
    rows = createNoteRows();
  });

  afterAll(() => {
    rows = null;
  });

  const visibleCount = () => rows.filter(row => row.is_deleted === false && row.is_archived === false).length;

  it('findByUser 分页只物化当前页', () => {
    const Note = loaders.Note();
    const { realm, collection } = createNoteRealm(rows);

    const page = Note.findByUser(realm, USER_ID, { skip: 50000, limit: 20 });

    // 分页后返回普通数组（materializePage 契约）
    expect(Array.isArray(page)).toBe(true);
    expect(page).toHaveLength(20);
    // 只读取当前页 20 条，不是 10 万条
    expect(collection.stats.materialized).toBe(20);
    expect(collection.stats.materialized).toBeLessThan(TOTAL_ROWS / 100);
    // 数据库层条件仍然下推
    expect(collection.stats.queries[0]).toContain(`user_id = "${USER_ID}"`);
    expect(collection.stats.queries[0]).toContain('is_deleted = false');
    recordBaseline('Note.findByUser', collection.stats.materialized, 'limit = 20');
  });

  it('findByUser 未分页时仍返回惰性 Results（既有契约不变）', () => {
    const Note = loaders.Note();
    const { realm, collection } = createNoteRealm(rows);

    const results = Note.findByUser(realm, USER_ID, {});

    // 未分页契约：返回 Realm Results（惰性），不是数组
    expect(Array.isArray(results)).toBe(false);
    expect(typeof results.slice).toBe('function');
    // 未分页时一条都不物化，长度来自收窄后的结果集
    expect(collection.stats.materialized).toBe(0);
    expect(results.length).toBe(visibleCount());
    recordBaseline('Note.findByUser（未分页）', collection.stats.materialized, '0（惰性 Results）');
  });

  it('findByUserSummaries 分页只物化当前页并返回 summary 数组', () => {
    const Note = loaders.Note();
    const { realm, collection } = createNoteRealm(rows);

    const page = Note.findByUserSummaries(realm, USER_ID, { skip: 90000, limit: 10 });

    // 列表主路径：始终返回数组，但只物化当前页
    expect(Array.isArray(page)).toBe(true);
    expect(page).toHaveLength(10);
    expect(collection.stats.materialized).toBe(10);
    expect(collection.stats.materialized).toBeLessThan(TOTAL_ROWS / 100);
    recordBaseline('Note.findByUserSummaries', collection.stats.materialized, 'limit = 10');
  });

  it('search 分页只物化当前页', () => {
    const Note = loaders.Note();
    const { realm, collection } = createNoteRealm(rows);

    const page = Note.search(realm, USER_ID, KEYWORD, { skip: 60000, limit: 15 });

    expect(page).toHaveLength(15);
    expect(collection.stats.materialized).toBe(15);
    // 搜索条件在数据库层表达（title/content CONTAINS）
    expect(collection.stats.queries[0]).toContain('title CONTAINS[c]');
    recordBaseline('Note.search', collection.stats.materialized, 'limit = 15');
  });

  it('findDeleted 分页只物化当前页', () => {
    const Note = loaders.Note();
    const { realm, collection } = createNoteRealm(rows);

    const page = Note.findDeleted(realm, USER_ID, { skip: 50, limit: 5 });

    expect(page).toHaveLength(5);
    expect(collection.stats.materialized).toBe(5);
    expect(collection.stats.queries[0]).toContain('is_deleted = true');
    recordBaseline('Note.findDeleted', collection.stats.materialized, 'limit = 5');
  });

  it('findArchived 分页只物化当前页', () => {
    const Note = loaders.Note();
    const { realm, collection } = createNoteRealm(rows);

    const page = Note.findArchived(realm, USER_ID, { skip: 500, limit: 10 });

    expect(page).toHaveLength(10);
    expect(collection.stats.materialized).toBe(10);
    expect(collection.stats.queries[0]).toContain('is_archived = true');
    recordBaseline('Note.findArchived', collection.stats.materialized, 'limit = 10');
  });

  it('findFavorites 分页只物化当前页', () => {
    const Note = loaders.Note();
    const { realm, collection } = createNoteRealm(rows);

    const page = Note.findFavorites(realm, USER_ID, { skip: 900, limit: 12 });

    expect(page).toHaveLength(12);
    expect(collection.stats.materialized).toBe(12);
    expect(collection.stats.queries[0]).toContain('is_favorite = true');
    recordBaseline('Note.findFavorites', collection.stats.materialized, 'limit = 12');
  });
});

// ---------------------------------------------------------------------------
// AIChat.search（消息 JSON 只能在应用层过滤 => 走有界窗口扫描）
// ---------------------------------------------------------------------------

describe('AIChat.search（10 万条，JS 谓词有界窗口）', () => {
  let rows;

  const createChatRows = count => Array.from({ length: count }, (_, index) => ({
    _id: `chat-${index}`,
    title: `${KEYWORD}-${index}`,
    messages: JSON.stringify([{ role: 'user', content: `内容提到${KEYWORD}-${index}` }]),
    user_id: USER_ID,
    is_deleted: false,
    updated_at: 1700000000000 + index,
  }));

  /** 模拟数据库层收窄：user_id / is_deleted / title CONTAINS[c] 关键词 */
  const applyDbNarrowing = (row, query) => {
    const keywordMatch = /title CONTAINS\[c\] "(.*)"\)/.exec(query);
    const keyword = keywordMatch ? keywordMatch[1] : '';
    return row.user_id === USER_ID
      && row.is_deleted === false
      && row.title.toLowerCase().includes(keyword.toLowerCase());
  };

  beforeAll(() => {
    rows = createChatRows(TOTAL_ROWS);
  });

  afterAll(() => {
    rows = null;
  });

  const realmOf = () => {
    const collection = createCountingResults(rows, { applyFilter: applyDbNarrowing });
    return { realm: { objects: () => collection }, collection };
  };

  it('首页分页只扫描一个窗口（10 万条里只读 DEFAULT_FILTER_WINDOW 条）', () => {
    const AIChat = loaders.AIChat();
    const { realm, collection } = realmOf();

    const page = AIChat.search(realm, USER_ID, KEYWORD, { skip: 0, limit: 3 });

    // 语义：updated_at 降序，取前 3 条
    expect(page.map(chat => chat._id)).toEqual(['chat-99999', 'chat-99998', 'chat-99997']);
    // 有界窗口：一次窗口扫描 = 200 条，远小于 10 万
    expect(collection.stats.materialized).toBe(DEFAULT_FILTER_WINDOW);
    expect(collection.stats.materialized).toBeLessThan(TOTAL_ROWS / 100);
    recordBaseline('AIChat.search（首页）', collection.stats.materialized, `DEFAULT_FILTER_WINDOW = ${DEFAULT_FILTER_WINDOW}`);
  });

  it('深分页按窗口推进，扫描量随页深线性增长而非全表', () => {
    const AIChat = loaders.AIChat();
    const { realm, collection } = realmOf();

    const page = AIChat.search(realm, USER_ID, KEYWORD, { skip: 500, limit: 10 });

    expect(page).toHaveLength(10);
    expect(page[0]._id).toBe(`chat-${TOTAL_ROWS - 1 - 500}`);
    // skip 500 + limit 10 = 510 条目标 => 需要 3 个窗口（600 条）
    expect(collection.stats.materialized).toBe(expectedScannedRows(500, 10));
    expect(collection.stats.materialized).toBeLessThan(TOTAL_ROWS / 10);
    recordBaseline('AIChat.search（skip 500）', collection.stats.materialized, `ceil((skip+limit)/${DEFAULT_FILTER_WINDOW}) * ${DEFAULT_FILTER_WINDOW}`);
  });

  it('未分页时返回全部命中（既有契约，属于已知全量点）', () => {
    const AIChat = loaders.AIChat();
    const { realm, collection } = realmOf();

    const all = AIChat.search(realm, USER_ID, KEYWORD);

    // 未分页契约要求返回全部匹配项数组
    expect(Array.isArray(all)).toBe(true);
    expect(all).toHaveLength(TOTAL_ROWS);
    // 该契约无法避免把全部命中读出（已知点，不是回归）
    expect(collection.stats.materialized).toBe(TOTAL_ROWS);
  });
});

// ---------------------------------------------------------------------------
// MindMap / InfiniteCanvas / KnowledgeGraph.findSharedWithUser
// （shared_with 是 JSON 字符串 => 数据库层只能做超集收窄，实际命中由 JS 判定）
// ---------------------------------------------------------------------------

describe('共享查询 findSharedWithUser（10 万条，JS JSON 过滤 + 排序 + 分页）', () => {
  let rows;

  const createSharedRows = count => Array.from({ length: count }, (_, index) => ({
    _id: `share-${index}`,
    title: `title-${String(count - index).padStart(6, '0')}`,
    shared_with: JSON.stringify(index % 5 === 0
      ? [{ user_id: TARGET_USER, permission: 'read' }]
      : [{ user_id: 'other-user', permission: 'write' }]),
    updated_at: 1700000000000 + index,
    is_deleted: false,
  }));

  /** 模拟数据库层收窄：is_deleted 原生条件 + shared_with CONTAINS[c] 超集收窄 */
  const applyDbNarrowing = (row, query) => {
    if (query.includes('is_deleted = false') && row.is_deleted !== false) {
      return false;
    }
    const match = /shared_with CONTAINS\[c\] "(.*)"/.exec(query);
    if (match) {
      const needle = match[1].replace(/\\"/g, '"');
      return typeof row.shared_with === 'string' && row.shared_with.includes(needle);
    }
    return true;
  };

  beforeAll(() => {
    rows = createSharedRows(TOTAL_ROWS);
  });

  afterAll(() => {
    rows = null;
  });

  const realmOf = () => {
    const collection = createCountingResults(rows, { applyFilter: applyDbNarrowing });
    return { realm: { objects: () => collection }, collection };
  };

  ['MindMap', 'InfiniteCanvas', 'KnowledgeGraph'].forEach(name => {
    it(`${name}.findSharedWithUser 分页只物化一个窗口`, () => {
      const Model = loaders[name]();
      const { realm, collection } = realmOf();

      const page = Model.findSharedWithUser(realm, TARGET_USER, { skip: 0, limit: 10 });

      expect(Array.isArray(page)).toBe(true);
      expect(page).toHaveLength(10);
      // shared_with 超集收窄已经下推（否则需要多扫 5 倍数据）
      expect(collection.stats.queries[0]).toContain(`shared_with CONTAINS[c] "${TARGET_USER}"`);
      // 收窄后的视图里前 10 条即命中，只读一个窗口
      expect(collection.stats.materialized).toBe(DEFAULT_FILTER_WINDOW);
      expect(collection.stats.materialized).toBeLessThan(TOTAL_ROWS / 100);
      recordBaseline(`${name}.findSharedWithUser`, collection.stats.materialized, `DEFAULT_FILTER_WINDOW = ${DEFAULT_FILTER_WINDOW}`);
    });
  });

  it('深分页（skip 1000 / limit 20）扫描量按窗口上界，而不是 10 万条', () => {
    const Model = loaders.MindMap();
    const { realm, collection } = realmOf();

    const page = Model.findSharedWithUser(realm, TARGET_USER, { skip: 1000, limit: 20 });

    expect(page).toHaveLength(20);
    expect(collection.stats.materialized).toBe(expectedScannedRows(1000, 20));
    expect(collection.stats.materialized).toBeLessThan(TOTAL_ROWS / 10);
    recordBaseline('MindMap.findSharedWithUser（skip 1000）', collection.stats.materialized, `ceil((skip+limit)/${DEFAULT_FILTER_WINDOW}) * ${DEFAULT_FILTER_WINDOW}`);
  });

  it('未分页时返回全部命中（既有契约，属于已知全量点）', () => {
    const Model = loaders.MindMap();
    const { realm, collection } = realmOf();

    const all = Model.findSharedWithUser(realm, TARGET_USER);

    expect(Array.isArray(all)).toBe(true);
    // 每 5 条有 1 条分享给目标用户 => 20000 条命中
    expect(all).toHaveLength(TOTAL_ROWS / 5);
    expect(collection.stats.materialized).toBe(TOTAL_ROWS / 5);
  });
});

// ---------------------------------------------------------------------------
// SearchIndex 文本 / 向量 / 列表入口
// ---------------------------------------------------------------------------

describe('SearchIndex 入口（10 万条）', () => {
  let rows;

  beforeAll(() => {
    rows = Array.from({ length: TOTAL_ROWS }, (_, index) => ({
      _id: `idx-${index}`,
      user_id: USER_ID,
      is_deleted: false,
      title: `${KEYWORD}-${index}`,
      content: `正文-${index}`,
      keywords: [KEYWORD],
      tags: ['标签'],
      entity_type: 'note',
      category: 'cat-1',
      relevance_score: 1,
      embedding: JSON.stringify([1, 0]),
      updated_at: 1700000000000 + index,
    }));
  });

  afterAll(() => {
    rows = null;
  });

  it('textSearch 把 slice 前置到 Results，消费当前页才物化当前页', () => {
    const SearchIndex = loaders.SearchIndex();
    const collection = createCountingResults(rows);

    const page = SearchIndex.textSearch({ objects: () => collection }, USER_ID, KEYWORD, { skip: 50000, limit: 20 });

    // 分页前置：返回的仍是惰性 Results 子集（不是数组），此刻一条都还没读
    expect(Array.isArray(page)).toBe(false);
    expect(typeof page.slice).toBe('function');
    expect(page.length).toBe(20);
    expect(collection.stats.materialized).toBe(0);

    // 消费当前页时才 materialize 这一页
    const materializedPage = Array.from(page);
    expect(materializedPage).toHaveLength(20);
    expect(collection.stats.materialized).toBe(20);
    expect(collection.stats.materialized).toBeLessThan(TOTAL_ROWS / 100);

    // 数据库层条件保持下推
    expect(collection.stats.queries[0]).toContain(`user_id = "${USER_ID}"`);
    expect(collection.stats.queries[0]).toContain('is_deleted = false');
    recordBaseline('SearchIndex.textSearch', collection.stats.materialized, 'limit = 20（惰性 slice 后消费）');
  });

  it('vectorSearch 候选上限 500 条，与索引规模无关', () => {
    const SearchIndex = loaders.SearchIndex();
    const collection = createCountingResults(rows);

    const result = SearchIndex.vectorSearch({ objects: () => collection }, USER_ID, [1, 0], {
      limit: 5,
      min_similarity: 0.9,
    });

    // 10 万条索引下仍然只读取 VECTOR_SCAN_LIMIT 条候选做余弦相似度
    expect(collection.stats.materialized).toBe(VECTOR_SCAN_LIMIT);
    expect(result).toHaveLength(5);
    expect(collection.stats.materialized).toBeLessThan(TOTAL_ROWS / 100);
    recordBaseline('SearchIndex.vectorSearch', collection.stats.materialized, `VECTOR_SCAN_LIMIT = ${VECTOR_SCAN_LIMIT}`);
  });

  it('findByUser 分页返回惰性 Results，消费当前页只物化一页', () => {
    const SearchIndex = loaders.SearchIndex();
    const collection = createCountingResults(rows);

    const page = SearchIndex.findByUser({ objects: () => collection }, USER_ID, { skip: 30000, limit: 30 });

    // 分页前置到 slice：返回惰性 Results
    expect(Array.isArray(page)).toBe(false);
    expect(page.length).toBe(30);
    expect(Array.from(page)).toHaveLength(30);
    expect(collection.stats.materialized).toBe(30);
    recordBaseline('SearchIndex.findByUser', collection.stats.materialized, 'limit = 30（惰性 slice 后消费）');
  });
});

// ---------------------------------------------------------------------------
// RealmService.objects / find（服务层列表入口）
// ---------------------------------------------------------------------------

describe('RealmService 入口（10 万条）', () => {
  let rows;

  const loadServiceClass = () => require('../../services/database/realmService');

  /** 构造一个 realm 已就绪、且对象转换不产生额外物化的服务实例 */
  const makeService = collection => {
    const { RealmService } = loadServiceClass();
    const service = new RealmService();
    service.realm = { objects: () => collection, isClosed: false };
    jest.spyOn(service, 'realmObjectToPlain').mockImplementation(obj => obj);
    jest.spyOn(service, '_postProcessRecord').mockImplementation((schemaName, record) => record);
    return service;
  };

  beforeAll(() => {
    rows = createNoteRows();
  });

  afterAll(() => {
    rows = null;
  });

  it('objects 分页只物化当前页', async () => {
    const collection = createCountingResults(rows);
    const service = makeService(collection);

    const page = await service.objects('Note', '', { skip: 50000, limit: 20 });

    expect(Array.isArray(page)).toBe(true);
    expect(page).toHaveLength(20);
    expect(collection.stats.materialized).toBe(20);
    expect(collection.stats.materialized).toBeLessThan(TOTAL_ROWS / 100);
    recordBaseline('realmService.objects', collection.stats.materialized, 'limit = 20');
  });

  it('find 分页只物化当前页', async () => {
    const collection = createCountingResults(rows);
    const service = makeService(collection);

    const page = await service.find('Note', {}, { skip: 400, limit: 10 });

    expect(Array.isArray(page)).toBe(true);
    expect(page).toHaveLength(10);
    expect(collection.stats.materialized).toBe(10);
    expect(collection.stats.materialized).toBeLessThan(TOTAL_ROWS / 100);
    recordBaseline('realmService.find', collection.stats.materialized, 'limit = 10');
  });

  it('未分页时保持返回完整普通对象数组的既有契约（已知全量点）', async () => {
    const collection = createCountingResults(rows);
    const service = makeService(collection);

    const page = await service.objects('Note');

    // 未分页契约要求把全部对象转换成普通对象数组
    expect(Array.isArray(page)).toBe(true);
    expect(page).toHaveLength(TOTAL_ROWS);
    expect(collection.stats.materialized).toBe(TOTAL_ROWS);
  });
});

// ---------------------------------------------------------------------------
// 扩展覆盖：其它模型的 findByUser 分页入口（同一套 materializePage / slice 契约）
// ---------------------------------------------------------------------------

describe('扩展覆盖：其它列表 findByUser 入口（10 万条）', () => {
  const EXTRA_ENTRIES = [
    'AIChat',
    'MindMap',
    'InfiniteCanvas',
    'KnowledgeNode',
    'KnowledgeEdge',
    'SearchIndex',
    'Tag',
    'File',
    'Reminder',
    'Category',
    'SearchHistory',
    'SyncInfo',
  ];

  let rows;

  beforeAll(() => {
    rows = createNoteRows();
  });

  afterAll(() => {
    rows = null;
  });

  EXTRA_ENTRIES.forEach(name => {
    it(`${name}.findByUser 分页消费当前页只物化 limit 条`, () => {
      const Model = loaders[name]();
      const collection = createCountingResults(rows);
      // schema 为空数组：Tag 的默认排序分支会读取 realm.schema，这里给出安全值
      const realm = { objects: () => collection, schema: [] };

      const result = Model.findByUser(realm, USER_ID, { skip: 40000, limit: 25 });
      // 有的入口分页后返回数组（materializePage），有的返回惰性 Results（slice 前置）；
      // 两种契约消费当前页后都只能物化 limit 条。
      const page = consumePage(result);

      expect(page).toHaveLength(25);
      expect(collection.stats.materialized).toBe(25);
      expect(collection.stats.materialized).toBeLessThan(TOTAL_ROWS / 100);
      recordBaseline(`${name}.findByUser`, collection.stats.materialized, 'limit = 25');
    });
  });
});

// ---------------------------------------------------------------------------
// 未纳入本轮的入口（TODO，详见 src/tests/perf/README.md）
// 1. 真机指标：首屏 P95 / 滚动 FPS / JS Heap / 500MB 上传速率 —— 需要真机与后端，
//    本机无法量化，只能在 Windows 平板上按 README 的步骤采样；
// 2. 只传 limit（无 skip）的入口（如 MindMap.findRecent / SearchHistory.findRecent /
//    OfflineQueue.*）：契约同为 materializePage(results, { limit })，已被本文件的核心入口覆盖，
//    如需逐入口断言可追加到「扩展覆盖」；
// 3. src/services/** 中除 realmService.objects / find 之外的列表查询（如云同步分页）。
// ---------------------------------------------------------------------------
