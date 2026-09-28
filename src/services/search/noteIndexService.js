/**
 * 笔记搜索增量索引服务（里程碑 5.1「增量索引更新策略」）
 *
 * 背景：笔记的 SearchIndex 此前只在 enhancedNoteService 的写入路径
 * （_upsertNoteSearchIndex）与全量重建（searchIndexRebuildService）里维护，
 * 通过 notesApi.createNote / updateNote / saveOfflineNote 落库的笔记
 * 在下次全量重建索引前搜不到。本模块把「单条笔记 -> SearchIndex」的映射收敛到一处，
 * 供 notesApi 在保存成功后调用，保证增量写入即可被搜到。
 *
 * 约定：
 * - 字段映射与 searchIndexRebuildService / enhancedNoteService 保持一致：
 *   entity_type = 'note'、正文截断到 4000 字符、keywords 由标题切分；
 * - 索引写入/删除失败绝不阻断笔记保存：*Safe 版本只 console.warn 并返回默认值；
 * - 重新索引会重置软删标记，保证「删除后又更新」的笔记重新可搜。
 */

import SearchIndex from '../../models/SearchIndex';

/** SearchIndex.entity_type 取值 */
export const NOTE_INDEX_ENTITY_TYPE = 'note';

/** 入索引的正文长度上限（与 enhancedNoteService 保持一致，避免索引膨胀） */
export const MAX_INDEXED_CONTENT_LENGTH = 4000;

/** user_id 缺失时的兜底账号（与 enhancedNoteService 一致） */
export const FALLBACK_INDEX_USER_ID = 'local_user';

const MAX_KEYWORDS = 30;
const MIN_KEYWORD_LENGTH = 2;
const LOG_PREFIX = '[noteIndexService]';

/**
 * 归一化 id：空串 / null / undefined 一律视为「无 id」
 * @param {*} value
 * @returns {string|null}
 */
const normalizeId = (value) => (value === null || value === undefined || value === '' ? null : String(value));

/**
 * 取笔记 id（_id 优先，兼容 id）
 * @param {Object} note
 * @returns {string|null}
 */
const resolveNoteId = (note) => {
  if (!note) {
    return null;
  }
  return normalizeId(note._id) || normalizeId(note.id);
};

/**
 * 截断文本到上限
 * @param {*} value
 * @param {number} max
 * @returns {string}
 */
const clip = (value, max) => {
  const text = value === null || value === undefined ? '' : String(value);
  return text.length > max ? text.slice(0, max) : text;
};

/**
 * 由标题切分关键词（与重建索引逻辑一致）
 * @param {string} title
 * @returns {Array<string>}
 */
const buildKeywords = (title) => String(title || '')
  .split(/\s+/)
  .filter(word => word.length >= MIN_KEYWORD_LENGTH)
  .slice(0, MAX_KEYWORDS);

/**
 * 归一化标签：写入侧的笔记可能是普通对象（数组）或 Realm 对象（List），
 * 两种形态都必须能进索引；标签量级很小，这里直接物化成字符串数组。
 * @param {*} tags
 * @returns {Array<string>}
 */
const normalizeTags = (tags) => {
  if (Array.isArray(tags)) {
    return tags.map(String);
  }
  if (tags && typeof tags.length === 'number') {
    return Array.from(tags).map(String);
  }
  return [];
};

/**
 * 校验 Realm 实例（至少能查询与写入）
 * @param {Object} realm
 */
const assertRealm = (realm) => {
  if (!realm || typeof realm.objects !== 'function' || typeof realm.write !== 'function') {
    throw new Error('需要有效的 Realm 实例（objects/write）');
  }
};

/**
 * 查找某个笔记的索引行（不排除软删行，保证幂等重写）
 * @param {Object} realm
 * @param {string} noteId
 * @returns {Object|undefined}
 */
const findNoteIndex = (realm, noteId) => realm
  .objects('SearchIndex')
  .filtered('entity_id == $0 AND entity_type == $1', noteId, NOTE_INDEX_ENTITY_TYPE)[0];

/**
 * 写入/刷新单条笔记的搜索索引（同步；失败时抛错，调用方可用 Safe 版本降级）。
 *
 * @param {Object} realm Realm 实例
 * @param {Object} note 笔记（Realm 对象或普通对象）
 * @returns {Object} SearchIndex 行
 */
export const upsertNoteIndex = (realm, note) => {
  assertRealm(realm);

  const noteId = resolveNoteId(note);
  if (!noteId) {
    throw new Error('笔记缺少 _id/id，无法写入搜索索引');
  }

  const title = String((note && note.title) || '未命名笔记');
  const index = SearchIndex.createOrUpdate(realm, {
    entity_id: noteId,
    entity_type: NOTE_INDEX_ENTITY_TYPE,
    user_id: String((note && note.user_id) || FALLBACK_INDEX_USER_ID),
    title,
    content: clip(note && note.content, MAX_INDEXED_CONTENT_LENGTH),
    keywords: buildKeywords(title),
    tags: normalizeTags(note && note.tags),
    category: note && note.category_id ? String(note.category_id) : null,
    metadata: { source: 'notesApi' },
    relevance_score: 1.0,
    language: 'zh-CN',
  });

  // SearchIndex.createOrUpdate/updateContent 不会改动 is_deleted：
  // 删除后又更新的笔记必须重新可搜，因此这里按笔记当前删除态校正索引标记。
  const shouldBeDeleted = Boolean(note && note.is_deleted);
  if (index && typeof index === 'object' && index.is_deleted !== shouldBeDeleted) {
    realm.write(() => {
      index.is_deleted = shouldBeDeleted;
      index.updated_at = new Date();
    });
  }

  return index;
};

/**
 * 移除单条笔记的搜索索引（笔记被删除时调用）。
 *
 * 采用软删（SearchIndex.is_deleted），与 SearchIndex.textSearch 过滤
 * `is_deleted = false` 的口径一致；找不到索引时返回 false（幂等，不抛错）。
 *
 * @param {Object} realm Realm 实例
 * @param {string} noteId 笔记 id
 * @returns {boolean} 是否找到并移除了索引
 */
export const removeNoteIndex = (realm, noteId) => {
  assertRealm(realm);

  const id = normalizeId(noteId);
  if (!id) {
    return false;
  }

  const index = findNoteIndex(realm, id);
  if (!index) {
    return false;
  }

  if (typeof index.softDelete === 'function') {
    index.softDelete(realm);
  } else {
    realm.write(() => {
      index.is_deleted = true;
      index.updated_at = new Date();
    });
  }

  return true;
};

/**
 * upsertNoteIndex 的降级版本：任何失败只告警，绝不阻断笔记保存。
 * @param {Object} realm
 * @param {Object} note
 * @returns {Object|null} 成功返回索引行，失败返回 null
 */
export const upsertNoteIndexSafe = (realm, note) => {
  try {
    return upsertNoteIndex(realm, note);
  } catch (error) {
    console.warn(`${LOG_PREFIX} 写入笔记索引失败，已忽略:`, (error && error.message) || error);
    return null;
  }
};

/**
 * removeNoteIndex 的降级版本：任何失败只告警，绝不阻断笔记删除。
 * @param {Object} realm
 * @param {string} noteId
 * @returns {boolean} 成功移除返回 true，否则 false
 */
export const removeNoteIndexSafe = (realm, noteId) => {
  try {
    return removeNoteIndex(realm, noteId);
  } catch (error) {
    console.warn(`${LOG_PREFIX} 移除笔记索引失败，已忽略:`, (error && error.message) || error);
    return false;
  }
};

export default {
  upsertNoteIndex,
  removeNoteIndex,
  upsertNoteIndexSafe,
  removeNoteIndexSafe,
};
