/**
 * 笔记列表轻量投影工具（里程碑 5.1：列表字段裁剪 + 正文延迟加载）
 *
 * 背景（RISK-PERF-002）：即便分页已经前置到 Realm `Results.slice`，只要调用
 * `note.toJSON()` / 直接读取 `note.content`，列表页仍会把每一页的正文
 * （可能几十 KB）读进内存。列表页实际只需要标题、标签、时间等轻量字段，
 * 正文应当等到用户点进详情时再按 id 单独加载。
 *
 * 本模块提供三件事：
 * 1. `toNoteSummary(note)`：只读取 NOTE_SUMMARY_FIELDS 白名单字段，绝不回读 content；
 * 2. `materializeNoteSummaries(results, { skip, limit })`：复用 ./queryPagination 的
 *    materializePage，先取当前页再投影（10 万条集合下只物化一页）；
 * 3. `loadNoteContent(realm, noteId)`：进入详情时按 id 单独取正文。
 *
 * hasContent / contentLength 的取舍（重要）：
 * Realm 不读 `content` 就无法得到真实长度，而读 content 正是本模块要避免的开销。
 * 因此这里按以下优先级处理，且全过程不访问 content：
 *   1) metadata（标量 JSON 字符串，读取成本远低于正文）中若声明了
 *      contentLength / content_length / charCount，则直接采用，并由此推出 hasContent；
 *   2) metadata 中若显式声明了布尔 `hasContent`，则采用它，contentLength 保持 null；
 *   3) 两者都没有时，hasContent / contentLength 一律为 null（表示「未知」，而不是 false/0，
 *      避免把「未知」误判成「无正文」）；
 *   4) 无论哪种情况，summary 上都挂有一个非枚举的 `loadContent()` 惰性闭包，
 *      只有调用方真正需要这一条的正文时才回调读取 `note.content`
 *      （非枚举 => 不会进入 JSON.stringify / Redux 序列化结果）。
 */

const { materializePage } = require('./queryPagination');

/** 列表页需要的轻量字段白名单；明确不含 content（正文由 loadNoteContent 延迟加载） */
const NOTE_SUMMARY_FIELDS = Object.freeze([
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
]);

/** metadata 中可能声明正文体积的键（写入方约定，按优先级排列） */
const METADATA_CONTENT_LENGTH_KEYS = Object.freeze([
  'contentLength',
  'content_length',
  'charCount',
]);

/** 笔记 schema 名 */
const NOTE_SCHEMA_NAME = 'Note';

/**
 * 复制 Realm list 字段为普通数组，避免把活着的 List 带出投影。
 * @param {*} value
 * @returns {Array}
 */
function copyListField(value) {
  if (!value) {
    return [];
  }
  return Array.isArray(value) ? value.slice() : Array.from(value);
}

/**
 * 解析 metadata；非法 JSON / 非对象一律返回 null（不抛错，列表页不能因脏数据失败）。
 * @param {string} raw
 * @returns {Object|null}
 */
function parseMetadata(raw) {
  if (!raw || typeof raw !== 'string') {
    return null;
  }
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch (error) {
    return null;
  }
}

/**
 * 取第一个非负有限数字
 * @param {Array<*>} values
 * @returns {number|null}
 */
function firstNonNegativeNumber(values) {
  for (let i = 0; i < values.length; i += 1) {
    const value = Number(values[i]);
    if (Number.isFinite(value) && value >= 0) {
      return Math.floor(value);
    }
  }
  return null;
}

/**
 * 从 metadata 派生正文事实（不读取 content）
 * @param {Object|null} metadata
 * @returns {{hasContent: boolean|null, contentLength: number|null}}
 */
function resolveContentFacts(metadata) {
  const unknown = { hasContent: null, contentLength: null };
  if (!metadata) {
    return unknown;
  }

  const contentLength = firstNonNegativeNumber(
    METADATA_CONTENT_LENGTH_KEYS.map(key => metadata[key]),
  );
  if (contentLength !== null) {
    return { hasContent: contentLength > 0, contentLength };
  }

  if (typeof metadata.hasContent === 'boolean') {
    return { hasContent: metadata.hasContent, contentLength: null };
  }

  return unknown;
}

/**
 * 把一条笔记投影成列表页 summary。
 *
 * 关键约束：整个过程只读取 NOTE_SUMMARY_FIELDS 白名单字段 + metadata，
 * 绝不访问 `note.content`；正文只能通过返回对象上的 `loadContent()` 惰性回读。
 *
 * @param {Object} note Realm Note 对象（也兼容普通对象）
 * @returns {Object|null} summary；入参为空时返回 null
 */
function toNoteSummary(note) {
  if (!note) {
    return null;
  }

  const summary = {};
  for (let i = 0; i < NOTE_SUMMARY_FIELDS.length; i += 1) {
    const field = NOTE_SUMMARY_FIELDS[i];
    summary[field] = field === 'tags' ? copyListField(note[field]) : note[field];
  }

  const facts = resolveContentFacts(parseMetadata(note.metadata));
  summary.hasContent = facts.hasContent;
  summary.contentLength = facts.contentLength;

  // 惰性兜底：只有调用方显式调用时才读取这一条的正文；
  // 定义为非枚举，保证 JSON.stringify / 展开运算符不会意外触发正文读取。
  Object.defineProperty(summary, 'loadContent', {
    value: () => {
      // 只读一次：Realm 每次属性访问都是一次 getter 调用
      const content = note.content;
      return content === undefined || content === null ? '' : content;
    },
    enumerable: false,
    writable: false,
    configurable: false,
  });

  return summary;
}

/**
 * 取当前页并投影成 summary 数组（里程碑 5.1 列表主路径）。
 *
 * 复用 materializePage：先按 `{ skip, limit }` 在 Results 层取一页，
 * 再只物化这一页，因此 10 万条集合下 materialize 的条数恒等于当前页大小。
 *
 * @param {Object|Array} results Realm Results 或数组
 * @param {Object} [options] { skip, limit }；limit 为 null/undefined 表示不限制
 * @returns {Array<Object>} summary 数组
 */
function materializeNoteSummaries(results, options = {}) {
  if (!results) {
    return [];
  }

  return materializePage(results, options)
    .map(note => toNoteSummary(note))
    .filter(summary => summary !== null);
}

/**
 * 按 id 延迟加载正文（点击进入详情时调用）。
 * @param {Realm} realm Realm 实例
 * @param {string} noteId 笔记 id
 * @returns {string|null} 正文；笔记不存在或入参非法时返回 null
 */
function loadNoteContent(realm, noteId) {
  if (
    !realm ||
    typeof realm.objectForPrimaryKey !== 'function' ||
    noteId === null ||
    noteId === undefined ||
    noteId === ''
  ) {
    return null;
  }

  const note = realm.objectForPrimaryKey(NOTE_SCHEMA_NAME, noteId);
  if (!note) {
    return null;
  }

  const content = note.content;
  return content === undefined || content === null ? '' : content;
}

module.exports = {
  NOTE_SUMMARY_FIELDS,
  METADATA_CONTENT_LENGTH_KEYS,
  toNoteSummary,
  materializeNoteSummaries,
  loadNoteContent,
  resolveContentFacts,
};

module.exports.default = toNoteSummary;
