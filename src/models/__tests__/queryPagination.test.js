/**
 * 里程碑 5.1（10 万条笔记）：列表查询分页必须前置到 Realm Results 层。
 *
 * 这些测试用一个「会计数」的伪 Results 集合：任何一次真实读取（迭代/Array.from）
 * 都会累加 materialized 计数。历史实现统一先 Array.from(results) 再 slice，
 * 在 10 万条数据下会把整张表 materialize 出来；修复后只应读取当前页。
 */

const TOTAL_NOTES = 100000;

function createCountingCollection(size, stats) {
  const make = (offset, length) => ({
    offset,
    length,
    filtered() {
      return this;
    },
    sorted() {
      return this;
    },
    slice(start = 0, end = length) {
      const normalizedStart = Math.max(0, Math.floor(start));
      const normalizedEnd = end === undefined ? length : Math.min(length, Math.floor(end));
      return make(offset + normalizedStart, Math.max(0, normalizedEnd - normalizedStart));
    },
    [Symbol.iterator]() {
      let index = 0;
      return {
        next: () => {
          if (index >= length) {
            return { done: true, value: undefined };
          }
          stats.materialized += 1;
          index += 1;
          return { done: false, value: { _id: `note-${offset + index}` } };
        },
      };
    },
  });

  return make(0, size);
}

function createCountingResults(size = TOTAL_NOTES) {
  const stats = { materialized: 0, sliceCalls: 0 };
  const collection = createCountingCollection(size, stats);
  const originalSlice = collection.slice.bind(collection);
  collection.slice = (start, end) => {
    stats.sliceCalls += 1;
    return originalSlice(start, end);
  };
  collection.stats = stats;
  return collection;
}

describe('queryPagination 分页工具', () => {
  it('paginateResults 使用 Results.slice 惰性取页，不 materialize 整表', () => {
    const { paginateResults } = require('../utils/queryPagination');
    const collection = createCountingResults();

    const page = paginateResults(collection, { skip: 40, limit: 20 });

    expect(collection.stats.sliceCalls).toBe(1);
    expect(collection.stats.materialized).toBe(0);
    expect(page.length).toBe(20);
    expect(collection.stats.materialized).toBe(0);
  });

  it('materializePage 只读取当前页的记录', () => {
    const { materializePage } = require('../utils/queryPagination');
    const collection = createCountingResults();

    const page = materializePage(collection, { skip: 1000, limit: 20 });

    expect(page).toHaveLength(20);
    expect(collection.stats.materialized).toBe(20);
  });

  it('未分页时保持原始集合，limit<=0 视为不限制', () => {
    const { paginateResults } = require('../utils/queryPagination');
    const collection = createCountingResults();

    expect(paginateResults(collection, {})).toBe(collection);
    expect(paginateResults(collection, { limit: 0 })).toBe(collection);
    expect(paginateResults(collection, { skip: 0, limit: null })).toBe(collection);
  });
});

describe('Note 列表查询分页前置（10 万条笔记）', () => {
  const loadNote = () => require('../Note').default || require('../Note');

  it('findByUser 只 materialize 当前页', () => {
    const Note = loadNote();
    const collection = createCountingResults();
    const realm = { objects: () => collection };

    const page = Note.findByUser(realm, 'user-1', { skip: 20000, limit: 20 });

    expect(page).toHaveLength(20);
    expect(collection.stats.materialized).toBe(20);
  });

  it('findFavorites / search / findDeleted 同样只 materialize 当前页', () => {
    const Note = loadNote();
    const realm = { objects: () => createCountingResults() };

    expect(Note.findFavorites(realm, 'user-1', { skip: 500, limit: 10 })).toHaveLength(10);
    expect(Note.search(realm, 'user-1', '关键词', { skip: 0, limit: 15 })).toHaveLength(15);
    expect(Note.findDeleted(realm, 'user-1', { skip: 90000, limit: 5 })).toHaveLength(5);
  });
});

describe('RealmService 查询分页前置', () => {
  const loadServiceClass = () => require('../../services/database/realmService');

  it('objects 只转换当前页的对象', async () => {
    const { RealmService } = loadServiceClass();
    const service = new RealmService();
    const collection = createCountingResults();
    service.realm = { objects: () => collection, isClosed: false };
    const plainSpy = jest.spyOn(service, 'realmObjectToPlain').mockImplementation(obj => obj);

    const page = await service.objects('Note', '', { skip: 300, limit: 20 });

    expect(page).toHaveLength(20);
    expect(collection.stats.materialized).toBe(20);
    expect(plainSpy).toHaveBeenCalledTimes(20);
  });

  it('find 只转换当前页的对象', async () => {
    const { RealmService } = loadServiceClass();
    const service = new RealmService();
    const collection = createCountingResults();
    service.realm = { objects: () => collection, isClosed: false };
    const plainSpy = jest.spyOn(service, 'realmObjectToPlain').mockImplementation(obj => obj);

    const page = await service.find('Note', {}, { skip: 400, limit: 10 });

    expect(page).toHaveLength(10);
    expect(collection.stats.materialized).toBe(10);
    expect(plainSpy).toHaveBeenCalledTimes(10);
  });
});
