/**
 * 测试用「会计数物化」的伪 Realm Results 集合（里程碑 5.1 续 / RISK-PERF-002）
 *
 * 与 `queryPagination.test.js` 内的同名思路一致（那份用例不改动）：
 * 任何一次真实读取（迭代 / Array.from）都会累加 `stats.materialized`，
 * 用来断言「历史实现先 Array.from 整表」与「改造后只读当前页」的差别。
 *
 * 与旧 helper 的差别：这里支持显式数据行、`sliced` 视图视图叠加、
 * `sorted(field, reverse)`、以及可选的 `applyFilter`
 * （在测试里模拟「数据库层 query 已经把集合收窄」的语义）。
 */

/**
 * 创建一个会计数的伪 Results 集合
 * @param {Array|number} source 数据行数组，或仅用于生成占位行的数量
 * @param {Object} [options]
 * @param {Function} [options.applyFilter] (item, query) => boolean，模拟数据库层 query 收窄；
 *        未提供时 filtered(query) 只记录 query，返回同一集合（即「查询层已收窄」）
 * @param {boolean} [options.sortedThrows] 让 sorted() 抛错，用于验证排序下推失败时的回退
 * @returns {Object} 伪 Results：length / filtered / sorted / slice / Symbol.iterator / stats
 */
function createCountingResults(source, options = {}) {
  const stats = {
    materialized: 0,
    sliceCalls: 0,
    filteredCalls: 0,
    sortedCalls: 0,
    queries: [],
  };

  const initialData = typeof source === 'number'
    ? Array.from({ length: Math.max(0, source) }, (_, i) => ({ _id: `row-${i}` }))
    : Array.isArray(source) ? source.slice() : [];

  const makeView = (data, start, end) => {
    const viewLength = () => Math.max(0, Math.min(end, data.length) - start);

    const view = {
      stats,
      get length() {
        return viewLength();
      },
      filtered(query) {
        stats.filteredCalls += 1;
        stats.queries.push(query);
        if (typeof options.applyFilter !== 'function') {
          return view;
        }
        // 数据库层收窄：不计入 materialize（真实 Realm 也不会为查询物化 JS 对象）
        const narrowed = data.filter((item, index) => (
          index >= start && index < end && options.applyFilter(item, query)
        ));
        return makeView(narrowed, 0, narrowed.length);
      },
      sorted(field, reverse = false) {
        stats.sortedCalls += 1;
        if (options.sortedThrows) {
          throw new Error(`unsupported sort property: ${field}`);
        }
        const rows = data.slice(start, end).sort((a, b) => {
          const left = a[field];
          const right = b[field];
          if (left === right) {
            return 0;
          }
          const greater = left > right;
          return reverse ? (greater ? -1 : 1) : (greater ? 1 : -1);
        });
        return makeView(rows, 0, rows.length);
      },
      slice(from = 0, to = viewLength()) {
        stats.sliceCalls += 1;
        const len = viewLength();
        const rawStart = Number.isFinite(Number(from)) ? Math.floor(Number(from)) : 0;
        const rawEnd = Number.isFinite(Number(to)) ? Math.floor(Number(to)) : len;
        const safeStart = Math.max(0, Math.min(len, rawStart < 0 ? len + rawStart : rawStart));
        const safeEnd = Math.max(0, Math.min(len, rawEnd < 0 ? len + rawEnd : rawEnd));
        return makeView(data, start + safeStart, start + safeEnd);
      },
      [Symbol.iterator]() {
        let cursor = start;
        const limit = Math.min(end, data.length);
        return {
          next: () => {
            if (cursor >= limit) {
              return { done: true, value: undefined };
            }
            const value = data[cursor];
            cursor += 1;
            stats.materialized += 1;
            return { done: false, value };
          },
        };
      },
    };

    return view;
  };

  return makeView(initialData, 0, initialData.length);
}

module.exports = {
  createCountingResults,
};
