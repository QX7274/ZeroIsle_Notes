/**
 * 首页列表分页决策（里程碑 5.1 续 / WS-P）
 *
 * 纯逻辑住在 src/services/offline/getNotes.js（列表查询的所有者，且在本任务 write scope 内），
 * 用例按任务要求放在 src/screens/common/__tests__。
 *
 * 覆盖：
 * 1. 哪些排序可下推 Realm 并可分页（updated_at / created_at），哪些不可（title/type/size）；
 * 2. 分页状态机：页未满 -> hasMore=false；页满 -> hasMore=true；不可下推 -> hasMore 恒为 false；
 * 3. 10 万条下的推进次数与「不会一次读全表」的语义（每页条数 <= pageSize）。
 */

const {
  DEFAULT_LIST_PAGE_SIZE,
  resolveListSortPolicy,
  resolveSortComparator,
  computeHasMore,
  createListPaginationState,
  applyListPageResult,
} = require('../../../services/offline/getNotes');

describe('resolveSortComparator 与 Realm 等价的排序比较器', () => {
  test('时间字段支持 Date 与 ISO 字符串，降序/升序与 Realm.sorted 一致', () => {
    const rows = [
      { _id: 'a', updated_at: new Date('2024-01-01T00:00:00Z') },
      { _id: 'b', updated_at: '2024-03-01T00:00:00.000Z' },
      { _id: 'c', updated_at: new Date('2024-02-01T00:00:00Z') },
    ];

    const desc = [...rows].sort(resolveSortComparator({ field: 'updated_at', descending: true }));
    expect(desc.map((item) => item._id)).toEqual(['b', 'c', 'a']);

    const asc = [...rows].sort(resolveSortComparator({ field: 'updated_at', descending: false }));
    expect(asc.map((item) => item._id)).toEqual(['a', 'c', 'b']);
  });

  test('排序键每个条目只折算一次（缓存），且对同一集合稳定', () => {
    const comparator = resolveSortComparator({ field: 'created_at', descending: true });
    const rows = [
      { _id: 'a', created_at: '2024-01-01T00:00:00.000Z' },
      { _id: 'b', created_at: '2024-02-01T00:00:00.000Z' },
      { _id: 'c', created_at: '2024-03-01T00:00:00.000Z' },
    ];

    const first = [...rows].sort(comparator).map((item) => item._id);
    const second = [...rows].sort(comparator).map((item) => item._id);

    expect(first).toEqual(['c', 'b', 'a']);
    expect(second).toEqual(first);
  });

  test('字符串字段与缺失值不会抛错', () => {
    const rows = [
      { _id: 'a', title: 'b' },
      { _id: 'b' },
      { _id: 'c', title: 'a' },
    ];

    const sorted = [...rows].sort(resolveSortComparator({ field: 'title', descending: false }));
    expect(sorted.map((item) => item._id)).toEqual(['b', 'c', 'a']);
  });
});

describe('resolveListSortPolicy 排序可下推判定', () => {
  test('时间型排序可下推 Realm 并可分页', () => {
    expect(resolveListSortPolicy('updated_desc')).toMatchObject({
      paginated: true,
      sort: { field: 'updated_at', descending: true },
    });
    expect(resolveListSortPolicy('updated_asc')).toMatchObject({
      paginated: true,
      sort: { field: 'updated_at', descending: false },
    });
    expect(resolveListSortPolicy('created_desc')).toMatchObject({
      paginated: true,
      sort: { field: 'created_at', descending: true },
    });
    expect(resolveListSortPolicy('created_asc')).toMatchObject({
      paginated: true,
      sort: { field: 'created_at', descending: false },
    });
    expect(resolveListSortPolicy('updated_desc').reason).toContain('最近访问');
  });

  test('title / type / size 排序不可下推，保持一次性全量 + JS 排序', () => {
    ['title_asc', 'title_desc', 'type', 'size_desc', 'size_asc'].forEach((option) => {
      const policy = resolveListSortPolicy(option);
      expect(policy.paginated).toBe(false);
      expect(policy.sort).toBeNull();
      expect(typeof policy.reason).toBe('string');
      expect(policy.reason.length).toBeGreaterThan(0);
    });
    expect(resolveListSortPolicy('title_asc').reason).toContain('localeCompare');
    expect(resolveListSortPolicy('type').reason).toContain('复合');
  });

  test('未知/空排序按默认 updated_at 降序处理（与 sortNotes 默认分支一致）', () => {
    expect(resolveListSortPolicy(undefined)).toMatchObject({
      paginated: true,
      sort: { field: 'updated_at', descending: true },
    });
    expect(resolveListSortPolicy('something_new')).toMatchObject({
      paginated: true,
      sort: { field: 'updated_at', descending: true },
    });
  });
});

describe('computeHasMore 页满判定', () => {
  test('页满 => 可能还有后续页；页未满/空页 => 到底', () => {
    expect(computeHasMore(50, 50)).toBe(true);
    expect(computeHasMore(51, 50)).toBe(true);
    expect(computeHasMore(49, 50)).toBe(false);
    expect(computeHasMore(0, 50)).toBe(false);
    expect(computeHasMore(50, 0)).toBe(false);
    expect(computeHasMore(undefined, 50)).toBe(false);
  });
});

describe('createListPaginationState / applyListPageResult 状态机', () => {
  test('可下推排序：初始 hasMore=true，页满继续、页未满结束', () => {
    const state = createListPaginationState('updated_desc', 50);

    expect(state).toMatchObject({
      paginated: true,
      sort: { field: 'updated_at', descending: true },
      pageSize: 50,
      skip: 0,
      hasMore: true,
    });

    const full = applyListPageResult(state, 50);
    expect(full).toMatchObject({ skip: 50, hasMore: true });

    const short = applyListPageResult(full, 20);
    expect(short).toMatchObject({ skip: 70, hasMore: false });

    const empty = applyListPageResult(state, 0);
    expect(empty).toMatchObject({ skip: 0, hasMore: false });
  });

  test('不可下推排序：一次全量，hasMore 恒为 false（不会被分页截断）', () => {
    const state = createListPaginationState('title_asc', 50);

    expect(state).toMatchObject({ paginated: false, sort: null, hasMore: false });
    expect(applyListPageResult(state, 50)).toMatchObject({ skip: 0, hasMore: false });
  });

  test('非法 pageSize 回退默认值', () => {
    expect(createListPaginationState('updated_desc', 0).pageSize).toBe(DEFAULT_LIST_PAGE_SIZE);
    expect(createListPaginationState('updated_desc', -1).pageSize).toBe(DEFAULT_LIST_PAGE_SIZE);
    expect(createListPaginationState('updated_desc', 'abc').pageSize).toBe(DEFAULT_LIST_PAGE_SIZE);
    expect(DEFAULT_LIST_PAGE_SIZE).toBe(50);
  });

  test('10 万条模拟：每页 <= 50，页满继续、短页收尾，不会一次读全表', () => {
    const TOTAL = 100000;
    const PAGE_SIZE = 50;
    let state = createListPaginationState('updated_desc', PAGE_SIZE);
    let loaded = 0;
    let requests = 0;
    const pageSizes = [];

    while (state.hasMore && requests < TOTAL) {
      requests += 1;
      const remaining = TOTAL - loaded;
      const pageLength = Math.max(0, Math.min(PAGE_SIZE, remaining));
      pageSizes.push(pageLength);
      loaded += pageLength;
      state = applyListPageResult(state, pageLength);
    }

    // 100000 / 50 整除：取满 2000 页后 hasMore 仍为 true，第 2001 次请求返回空页才收尾
    expect(pageSizes).toHaveLength(2001);
    expect(pageSizes.slice(0, 2000).every((size) => size === PAGE_SIZE)).toBe(true);
    expect(pageSizes[2000]).toBe(0);
    expect(loaded).toBe(TOTAL);
    expect(state.hasMore).toBe(false);
    expect(state.skip).toBe(TOTAL);
    // 任何一页都不超过页大小 => 单次物化上界 = PAGE_SIZE
    expect(Math.max(...pageSizes)).toBeLessThanOrEqual(PAGE_SIZE);
  });
});
