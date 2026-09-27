/**
 * Realm 列表查询分页工具（里程碑 5.1 / RISK-PERF-002）
 *
 * Realm 的 `Results` 是惰性集合：`slice(start, end)` 返回一个惰性子集，
 * 不会把整张表读进内存。历史上的列表查询统一写成：
 *
 *   results = Array.from(results).slice(skip, skip + limit);
 *
 * 在 10 万条笔记场景下这会先把整表 materialize 成对象数组，再截取一页，
 * 造成首屏卡顿和内存峰值上涨。此处把分页前置到 `Results` 层，
 * 只在真正需要时（materializePage / Array.from）读取当前页。
 */

/**
 * 归一化分页参数。
 * - skip：有限正数时取整，否则为 0
 * - limit：有限正数时取整，否则为 null（表示不限制；limit <= 0 视为不限制，
 *   与历史上 `options.limit || 默认值` 的语义保持一致）
 * @param {Object} [options]
 * @returns {{skip: number, limit: number|null}}
 */
function normalizePagination(options = {}) {
  const rawSkip = Number(options.skip);
  const rawLimit = Number(options.limit);
  const skip = Number.isFinite(rawSkip) && rawSkip > 0 ? Math.floor(rawSkip) : 0;
  const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.floor(rawLimit) : null;

  return { skip, limit };
}

/**
 * 是否需要分页
 * @param {Object} [options]
 * @returns {boolean}
 */
function hasPagination(options = {}) {
  const { skip, limit } = normalizePagination(options);
  return skip > 0 || limit !== null;
}

/**
 * 在 Results（或数组）层取一页，返回惰性子集，不做 materialize。
 * @param {Object|Array} results Realm Results 或数组
 * @param {Object} [options] { skip, limit }
 * @returns {Object|Array} 同一集合类型的一页
 */
function paginateResults(results, options = {}) {
  if (!results || typeof results.slice !== 'function') {
    return results;
  }

  const { skip, limit } = normalizePagination(options);

  if (skip === 0 && limit === null) {
    return results;
  }

  return limit === null ? results.slice(skip) : results.slice(skip, skip + limit);
}

/**
 * 取一页并 materialize 成数组（保持历史上返回数组的契约）。
 * @param {Object|Array} results Realm Results 或数组
 * @param {Object} [options] { skip, limit }
 * @returns {Array}
 */
function materializePage(results, options = {}) {
  return Array.from(paginateResults(results, options));
}

// ---------------------------------------------------------------------------
// 里程碑 5.1 续（RISK-PERF-002）：JS 谓词过滤路径的「有界窗口」扫描
//
// Realm 的 `Results` 不支持 JS 谓词过滤，历史写法是先把整张表 materialize：
//
//   const all = Array.from(results);
//   const matched = all.filter(predicate);
//   return matched.slice(skip, skip + limit);
//
// 在 10 万条数据下这会一次性读出整表。下面的工具改为按固定窗口
// （`results.slice(offset, offset + window)`）惰性推进，取满当前页所需的匹配项后
// 立即停止扫描，只对「当前页 + 判定所需的最少后缀」做 materialize。
//
// 等价性约定（非常重要）：
// 1. 无 JS 排序时（filterPageInWindows），扫描顺序就是输出顺序，因此
//    「先扫描到 skip+limit 条匹配」与「全量过滤后再 slice」结果完全一致。
// 2. 需要 JS 排序时（tryFilterSortPageInWindows），必须由调用方把排序下推到
//    Realm（`results.sorted(field, desc)`），使扫描顺序 = 最终排序顺序；
//    并且当页边界处的排序键存在并列、或页内排序键重复时，旧比较函数
//    （对相等项返回 -1，属于非稳定比较）在全量数组上的排列无法只靠前缀复现，
//    此时函数返回 null，由调用方回退到全量路径，绝不返回不同结果。
// ---------------------------------------------------------------------------

/** 默认扫描窗口大小：一次 materialize 的记录条数上界 */
const DEFAULT_FILTER_WINDOW = 200;

/**
 * 归一化窗口大小
 * @param {number} [value]
 * @returns {number}
 */
function normalizeScanWindow(value) {
  const size = Number(value);
  return Number.isFinite(size) && size > 0 ? Math.floor(size) : DEFAULT_FILTER_WINDOW;
}

/**
 * 读取集合长度；Realm Results 的 length 是廉价的元信息。
 * 拿不到可信长度时返回 Infinity，调用方会退化为全量路径。
 * @param {Object} results
 * @returns {number}
 */
function resultsLength(results) {
  const length = results && typeof results.length === 'number' ? results.length : NaN;
  return Number.isFinite(length) && length >= 0 ? length : Infinity;
}

/**
 * 是否是「可分页且有界」的入参形态：
 * 只有 limit 为正数、skip 为非负有限数时，扫描前缀才等价于全量过滤后取页。
 * 其它（含 limit <= 0、负数 skip、NaN）一律退化为全量收集，保证与历史行为一致。
 * @param {number} skip
 * @param {number} limit
 * @returns {boolean}
 */
function isBoundedPage(skip, limit) {
  const rawSkip = Number(skip);
  const rawLimit = Number(limit);
  return Number.isFinite(rawSkip) && rawSkip >= 0 && Number.isFinite(rawLimit) && rawLimit > 0;
}

/**
 * 创建一个「按窗口惰性读取」的顺序游标。
 * 任何时刻最多只 materialize 一个窗口，读取过的窗口不会重复读取。
 * @param {Object} results
 * @param {number} windowSize
 * @returns {{next: function(): {done: boolean, value: *}}}
 */
function createWindowScanner(results, windowSize) {
  const total = resultsLength(results);
  let offset = 0;
  let buffer = [];
  let index = 0;
  let finished = false;

  return {
    next() {
      while (index >= buffer.length) {
        if (finished || offset >= total) {
          finished = true;
          buffer = [];
          index = 0;
          return { done: true, value: undefined };
        }
        const size = Math.min(windowSize, total - offset);
        buffer = Array.from(results.slice(offset, offset + size));
        index = 0;
        offset += size;
        if (buffer.length === 0) {
          // 空窗口（集合被并发清空等）=> 视为结束，避免死循环
          finished = true;
          return { done: true, value: undefined };
        }
        if (buffer.length < size) {
          // 不足一个窗口 => 已经到集合末尾
          finished = true;
        }
      }
      const value = buffer[index];
      index += 1;
      return { done: false, value };
    },
  };
}

/**
 * 有界窗口 + JS 谓词过滤，最多收集 skip + limit 条匹配项。
 * @param {Object} results Realm Results
 * @param {Function} predicate (item, index) => boolean
 * @param {Object} [options] { skip, limit, window }；limit 为 null 表示收集全部匹配项
 * @returns {Array} 匹配项（扫描顺序）
 */
function collectFilteredItems(results, predicate, options = {}) {
  const windowSize = normalizeScanWindow(options.window);
  const target = options.limit === null || options.limit === undefined
    ? Infinity
    : Number(options.skip || 0) + Number(options.limit);

  if (
    !results ||
    typeof results.slice !== 'function' ||
    !Number.isFinite(resultsLength(results))
  ) {
    // 防御：没有惰性 slice 或长度不可信时，退回历史上的全量过滤
    return Array.from(results || []).filter(predicate);
  }

  const scanner = createWindowScanner(results, windowSize);
  const collected = [];
  let step = scanner.next();
  while (!step.done && collected.length < target) {
    if (predicate(step.value, collected.length)) {
      collected.push(step.value);
    }
    step = scanner.next();
  }
  return collected;
}

/**
 * 「JS 谓词过滤 + 分页」的有界窗口实现（无 JS 排序场景）。
 * 与 `Array.from(results).filter(predicate).slice(skip, skip + limit)` 结果完全一致。
 * @param {Object} results Realm Results
 * @param {Function} predicate
 * @param {Object} [options] { skip, limit, window }；limit 为 null/undefined 表示不分页
 * @returns {Array}
 */
function filterPageInWindows(results, predicate, options = {}) {
  const { skip = 0, limit = null } = options;

  if (limit === null || limit === undefined) {
    // 不分页：调用方契约要求返回全部匹配项（数组），此处无法避免把匹配项全部读出来，
    // 但按窗口推进，峰值内存只多保留一个窗口，而不是「整表 + 匹配结果」两份。
    return collectFilteredItems(results, predicate, { limit: null, window: options.window });
  }

  const bounded = isBoundedPage(skip, limit);
  const collected = collectFilteredItems(results, predicate, {
    skip,
    limit: bounded ? limit : null,
    window: options.window,
  });

  // 与历史实现保持一致的边界语义（含 limit <= 0 时 JS slice 的负数语义）
  return collected.slice(skip, skip + limit);
}

/**
 * 取排序键的可比较值；日期归一化为时间戳。不可比较（对象/列表/null）时返回 null。
 * @param {Object} item
 * @param {string} field
 * @returns {number|string|boolean|null}
 */
function comparableKeyOf(item, field) {
  if (!item) {
    return null;
  }
  const value = item[field];
  if (value === null || value === undefined) {
    return null;
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  const type = typeof value;
  return type === 'number' || type === 'string' || type === 'boolean' ? value : null;
}

/**
 * 比较两个排序键
 * @param {number|string|boolean} a
 * @param {number|string|boolean} b
 * @returns {number} -1 / 0 / 1
 */
function compareKeys(a, b) {
  if (a === b) {
    return 0;
  }
  return a > b ? 1 : -1;
}

/**
 * 「JS 谓词过滤 + JS 排序 + 分页」的有界窗口实现（排序由调用方下推到 Realm）。
 *
 * 返回数组时必须保证与「全量物化后 filter、sort(comparator)、slice(skip, skip+limit)」
 * 的结果逐条一致；只要存在无法从前缀判定的情况就返回 null，由调用方回退到全量路径。
 *
 * @param {Object} results 已按 sortField 排好序的 Realm Results
 * @param {Function} predicate (item, index) => boolean
 * @param {Function} comparator 历史比较函数（只作用于当前页，保证页内顺序与旧实现一致）
 * @param {Object} options { skip, limit, sortField, window, requireDistinctKeys }
 * @returns {Array|null}
 */
function tryFilterSortPageInWindows(results, predicate, comparator, options = {}) {
  const { skip = 0, limit = null, sortField, requireDistinctKeys = false } = options;

  if (
    typeof sortField !== 'string' ||
    typeof comparator !== 'function' ||
    typeof predicate !== 'function' ||
    limit === null ||
    limit === undefined ||
    !isBoundedPage(skip, limit) ||
    !results ||
    typeof results.slice !== 'function' ||
    !Number.isFinite(resultsLength(results))
  ) {
    return null;
  }

  const numericSkip = Number(skip);
  const numericLimit = Number(limit);
  const target = numericSkip + numericLimit;
  const scanner = createWindowScanner(results, normalizeScanWindow(options.window));
  const collected = [];
  let step = scanner.next();

  while (!step.done && collected.length < target) {
    if (predicate(step.value, collected.length)) {
      collected.push(step.value);
    }
    step = scanner.next();
  }

  if (collected.length < target || step.done) {
    // 匹配项不足一页，或前缀已经覆盖到集合末尾 => 与全量实现完全等价，
    // 无需再做并列键守卫（此时「前缀」就是筛选后的全部候选）。
    collected.sort(comparator);
    return collected.slice(numericSkip, numericSkip + numericLimit);
  }

  // 守卫 A：旧比较函数对「排序键相等」返回 -1（非稳定比较），
  // 页内出现并列键时其全量排列无法只靠前缀复现，直接回退。
  if (requireDistinctKeys) {
    const seen = new Set();
    for (let i = 0; i < collected.length; i += 1) {
      const key = comparableKeyOf(collected[i], sortField);
      if (key === null || seen.has(key)) {
        return null;
      }
      seen.add(key);
    }
  }

  // 守卫 B：页内最后一条的排序键若与后续记录并列，后续记录可能挤进当前页；
  // 只有确认「后面第一条键不同的记录严格排在页尾之后」才能安全截断。
  const boundaryKey = comparableKeyOf(collected[collected.length - 1], sortField);
  if (boundaryKey === null) {
    return null;
  }

  let guardStep = step;
  while (!guardStep.done) {
    const key = comparableKeyOf(guardStep.value, sortField);
    if (key === null) {
      return null;
    }
    const order = compareKeys(key, boundaryKey);
    if (order !== 0) {
      if (order > 0) {
        // 扫描顺序与排序方向不符（排序未真正下推），宁可回退
        return null;
      }
      break;
    }
    guardStep = scanner.next();
  }
  if (guardStep.done) {
    // 并列排序键一直延续到集合末尾，无法只靠前缀判定页内条目
    return null;
  }

  collected.sort(comparator);
  return collected.slice(numericSkip, numericSkip + numericLimit);
}

module.exports = {
  normalizePagination,
  hasPagination,
  paginateResults,
  materializePage,
  DEFAULT_FILTER_WINDOW,
  collectFilteredItems,
  filterPageInWindows,
  tryFilterSortPageInWindows,
  comparableKeyOf,
};

module.exports.default = materializePage;
