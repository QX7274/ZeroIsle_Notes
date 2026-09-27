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

module.exports = {
  normalizePagination,
  hasPagination,
  paginateResults,
  materializePage,
};

module.exports.default = materializePage;
