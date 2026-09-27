/**
 * Realm 查询字符串安全工具（里程碑 5.1 续 / RISK-PERF-002）
 *
 * 历史代码把用户输入直接拼进 Realm 查询字符串：
 *
 *   filtered(`user_id = "${userId}" AND title CONTAINS[c] "${searchText}"`)
 *
 * 当 userId / searchText 里含有双引号时会拼出语法错误的查询（Realm 抛异常），
 * 因此这里统一做字面量转义；同时提供「能否把字符串原样当作 JSON 子串使用」
 * 的判定，用于把 `shared_with` 这类 JSON 字符串字段的过滤安全地下推到数据库。
 */

/**
 * 转义 Realm 查询字符串中的字面量。
 * - 反斜杠先转义，避免二次转义
 * - 双引号转义为 \"，使查询字符串不会被提前闭合
 * @param {*} value
 * @returns {string}
 */
function escapeRealmString(value) {
  const text = value === null || value === undefined ? '' : String(value);
  return text.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}

/**
 * 判断字符串经 JSON.stringify 之后是否与原文完全一致（即不需要任何转义）。
 *
 * 只有为 true 时，才可以把该字符串直接当作 `shared_with CONTAINS "xxx"` 的子串
 * 使用：此时「对象数组 JSON 里包含 user_id === value 的分享项」必然意味着
 * 原始 JSON 文本包含该子串，因此数据库层过滤结果一定是应用层解析结果的超集，
 * 下推不会漏掉任何记录。
 *
 * @param {*} value
 * @returns {boolean}
 */
function isRawJsonEmbeddable(value) {
  if (typeof value !== 'string' || value.length === 0) {
    return false;
  }
  try {
    return JSON.stringify(value) === `"${value}"`;
  } catch (e) {
    return false;
  }
}

module.exports = {
  escapeRealmString,
  isRawJsonEmbeddable,
};
