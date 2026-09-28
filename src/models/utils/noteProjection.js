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
 * hasContent / contentLength / previewText / hasPages / hasStrokeData 的取舍（重要）：
 * Realm 不读 `content` / `pages` / `strokeData` 就无法得到这些事实，
 * 而读它们正是本模块要避免的开销。因此写入侧（src/services/api/notesApi.js）
 * 保存时会用 src/models/utils/notePreview.js 的 buildNotePreview + mergePreviewMetadata
 * 把预览元数据打进 metadata，列表侧只解析 metadata，全过程不读大字段。
 *
 * hasContent / contentLength 按以下优先级处理：
 *   1) metadata（标量 JSON 字符串，读取成本远低于正文）中若声明了
 *      contentLength / content_length / charCount，则直接采用，并由此推出 hasContent；
 *   2) metadata 中若显式声明了布尔 `hasContent`，则采用它，contentLength 保持 null；
 *   3) 两者都没有时，hasContent / contentLength 一律为 null（表示「未知」，而不是 false/0，
 *      避免把「未知」误判成「无正文」）；
 *   4) previewText / hasPages / hasStrokeData 同样只从 metadata 读取；
 *      缺失或类型非法时一律为 null（表示「未知」，而不是 ''/false），避免误判；
 *   5) 无论哪种情况，summary 上都挂有一个非枚举的 `loadContent()` 惰性闭包，
 *      只有调用方真正需要这一条的正文时才回调读取 `note.content`
 *      （非枚举 => 不会进入 JSON.stringify / Redux 序列化结果）。
 */

const { materializePage } = require('./queryPagination');

/**
 * 列表页需要的轻量字段白名单。
 *
 * 全部是**小标量**（id / 标题 / 类型 / 大小 / 时间 / 文件路径等），
 * 明确不含 content / pages / strokeData / attachments 等大字段——
 * 正文预览由 metadata.previewText 提供，需要正文时用 loadNoteContent / notesApi.getById 延迟加载。
 */
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
  'updatedAt',
  'createdAt',
  // 「最近访问」排序键（WS-T/WS-U）：小标量日期，随 summary 一并投影，
  // 让前端能用与 Realm 相同的 [last_opened_at, updated_at] 顺序复现分页边界。
  'last_opened_at',
  'user_id',
  'file_path',
  'file_size',
  'file_type',
  'thumbnail_path',
  'version',
  'parent_id',
  // 卡片渲染（NoteItem 的封面/标题/文件路由）需要的描述性字段，全部为小标量
  'file_uri',
  'uri',
  'file_name',
  'original_type',
  'original_file_name',
  'is_converted',
  'noteType',
  'note_type',
  'name',
  'fileName',
  'fileType',
  'url',
  'path',
  'noteStyle',
  'canvasStyle',
  'is_pinned',
  'syncStatus',
]);

/** metadata 中可能声明正文体积的键（写入方约定，按优先级排列） */
const METADATA_CONTENT_LENGTH_KEYS = Object.freeze([
  'contentLength',
  'content_length',
  'charCount',
]);

/**
 * metadata 中列表预览 / 徽标相关的键。
 * 由写入侧 src/models/utils/notePreview.js 的 buildNotePreview 产出、
 * mergePreviewMetadata 合并（见 notesApi 的 createNote/updateNote/saveOfflineNote）。
 */
const METADATA_PREVIEW_KEYS = Object.freeze([
  'previewText',
  'hasPages',
  'hasStrokeData',
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
 * 从 metadata 取预览文本；缺失或类型非法时为 null（未知，不误判）
 * @param {Object|null} metadata
 * @returns {string|null}
 */
function resolvePreviewText(metadata) {
  if (!metadata || typeof metadata.previewText !== 'string') {
    return null;
  }
  return metadata.previewText;
}

/**
 * 从 metadata 取布尔标记（hasPages / hasStrokeData）；缺失或类型非法时为 null
 * @param {Object|null} metadata
 * @param {string} key
 * @returns {boolean|null}
 */
function resolveMetadataFlag(metadata, key) {
  if (!metadata || typeof metadata[key] !== 'boolean') {
    return null;
  }
  return metadata[key];
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

  // metadata 是标量 JSON 字符串：解析一次，派生正文事实与预览/徽标标记
  const metadata = parseMetadata(note.metadata);
  const facts = resolveContentFacts(metadata);
  summary.hasContent = facts.hasContent;
  summary.contentLength = facts.contentLength;
  summary.previewText = resolvePreviewText(metadata);
  summary.hasPages = resolveMetadataFlag(metadata, 'hasPages');
  summary.hasStrokeData = resolveMetadataFlag(metadata, 'hasStrokeData');

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
  METADATA_PREVIEW_KEYS,
  toNoteSummary,
  materializeNoteSummaries,
  loadNoteContent,
  resolveContentFacts,
  resolvePreviewText,
  resolveMetadataFlag,
};

module.exports.default = toNoteSummary;
