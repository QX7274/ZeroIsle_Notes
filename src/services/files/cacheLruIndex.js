/**
 * 附件缓存 LRU 索引（纯函数）
 *
 * 与 Realm / RNFS 完全解耦：只接收普通对象数组，返回新的数组或统计数据，
 * 便于单测，也便于在任意持久层之上复用同一套淘汰策略。
 *
 * 条目结构：{ key, size, lastAccessedAt }
 */

/**
 * 归一化大小：非数字、负数、Infinity 一律按 0 处理
 * @param {*} value
 * @returns {number}
 */
const toNonNegativeSize = (value) => {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? num : 0;
};

/**
 * 归一化访问时间：统一转成毫秒时间戳，无法解析时按 0（最旧）处理
 * @param {*} value
 * @returns {number}
 */
const toTimestamp = (value) => {
  if (value instanceof Date) {
    const time = value.getTime();
    return Number.isFinite(time) ? time : 0;
  }
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
};

/**
 * 归一化单个条目
 * @param {Object} entry
 * @returns {{key: string, size: number, lastAccessedAt: *}}
 */
const toEntry = (entry) => {
  const source = entry || {};
  const rawKey = source.key === undefined || source.key === null ? '' : source.key;
  return {
    key: String(rawKey),
    size: toNonNegativeSize(source.size),
    lastAccessedAt: source.lastAccessedAt,
  };
};

/**
 * 归一化条目列表：过滤空值、按 key 去重（后出现的覆盖先出现的）
 * @param {Array} entries
 * @returns {Array}
 */
export function normalizeEntries(entries) {
  const map = new Map();
  if (Array.isArray(entries)) {
    entries.forEach((entry) => {
      if (!entry) {
        return;
      }
      const normalized = toEntry(entry);
      map.set(normalized.key, normalized);
    });
  }
  return Array.from(map.values());
}

/**
 * 最久未访问优先的确定性排序：先按 lastAccessedAt 升序，再按 key 升序
 * @param {Object} a
 * @param {Object} b
 * @returns {number}
 */
const compareByLeastRecentlyUsed = (a, b) => {
  const timeDiff = toTimestamp(a.lastAccessedAt) - toTimestamp(b.lastAccessedAt);
  if (timeDiff !== 0) {
    return timeDiff;
  }
  if (a.key === b.key) {
    return 0;
  }
  return a.key < b.key ? -1 : 1;
};

/**
 * 新增或更新一个条目（返回新数组，不修改入参）
 * 若新条目未携带 lastAccessedAt，则保留原条目的访问时间
 * @param {Array} entries
 * @param {Object} entry
 * @returns {Array}
 */
export function upsert(entries, entry) {
  const normalized = toEntry(entry);
  const list = normalizeEntries(entries);
  const index = list.findIndex((item) => item.key === normalized.key);

  if (index === -1) {
    list.push(normalized);
    return list;
  }

  const hasExplicitTimestamp = normalized.lastAccessedAt !== undefined && normalized.lastAccessedAt !== null;
  list[index] = {
    ...normalized,
    lastAccessedAt: hasExplicitTimestamp ? normalized.lastAccessedAt : list[index].lastAccessedAt,
  };
  return list;
}

/**
 * 更新访问时间（返回新数组）
 * @param {Array} entries
 * @param {string} key
 * @param {number|Date} [at]
 * @returns {Array}
 */
export function touch(entries, key, at = Date.now()) {
  const targetKey = String(key);
  return normalizeEntries(entries).map((item) =>
    item.key === targetKey ? { ...item, lastAccessedAt: at } : item,
  );
}

/**
 * 移除指定 key（返回新数组）
 * @param {Array} entries
 * @param {string} key
 * @returns {Array}
 */
export function remove(entries, key) {
  const targetKey = String(key);
  return normalizeEntries(entries).filter((item) => item.key !== targetKey);
}

/**
 * 统计总占用（同 key 只计一次）
 * @param {Array} entries
 * @returns {number}
 */
export function totalSize(entries) {
  return normalizeEntries(entries).reduce((sum, item) => sum + item.size, 0);
}

/**
 * 选择需要淘汰的 key 列表（最久未访问优先，结果确定可单测）
 *
 * 预算 = maxBytes - reserveBytes，需要满足：
 *   totalSize(entries) + incomingBytes - 已淘汰大小 <= 预算
 *
 * @param {Array} entries 现有条目
 * @param {Object} [options]
 * @param {number} options.maxBytes 配额上限（字节），非正数视为不淘汰
 * @param {number} [options.incomingBytes] 即将写入的大小
 * @param {number} [options.reserveBytes] 需要预留的余量
 * @param {Array<string>} [options.protectedKeys] 不可淘汰的 key（如正在写入的项）
 * @returns {Array<string>} 待淘汰 key，按淘汰顺序返回
 */
export function selectEvictions(entries, options = {}) {
  const maxBytes = Number(options.maxBytes);
  if (!Number.isFinite(maxBytes) || maxBytes <= 0) {
    return [];
  }

  const incomingBytes = toNonNegativeSize(options.incomingBytes);
  const reserveBytes = Math.min(toNonNegativeSize(options.reserveBytes), maxBytes);
  const budgetBytes = Math.max(0, maxBytes - reserveBytes);
  const protectedKeys = new Set(
    (Array.isArray(options.protectedKeys) ? options.protectedKeys : []).map((key) => String(key)),
  );

  const list = normalizeEntries(entries);
  const requiredFreeBytes = totalSize(list) + incomingBytes - budgetBytes;

  // 未超预算：无需淘汰
  if (requiredFreeBytes <= 0) {
    return [];
  }

  const candidates = list
    .filter((item) => !protectedKeys.has(item.key))
    .sort(compareByLeastRecentlyUsed);

  const evictions = [];
  let freedBytes = 0;
  for (const candidate of candidates) {
    if (freedBytes >= requiredFreeBytes) {
      break;
    }
    evictions.push(candidate.key);
    freedBytes += candidate.size;
  }

  // 即使 incomingBytes 超过 maxBytes，也只淘汰到“可用条目为空”，不会出现负数
  return evictions;
}
