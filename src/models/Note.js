/**
 * 笔记模型 - Realm版本
 */

import Realm from 'realm';
const { materializePage } = require('./utils/queryPagination');
const { materializeNoteSummaries } = require('./utils/noteProjection');

/**
 * Realm 可下推的排序字段白名单（里程碑 5.1：列表分页要求排序在 Realm 侧完成）。
 *
 * Realm 的 `sorted(field, descending)` 只接受 schema 中声明的标量字段，未知字段会直接抛错；
 * 这里显式白名单化，未知字段统一回退默认排序，避免列表因为一个排序参数而整体失败。
 * 字段与 Note schema（src/models/Note.js / src/services/database/realmModels.js）一一对应。
 */
const REALM_SORTABLE_FIELDS = Object.freeze([
  'updated_at',
  'created_at',
  'last_opened_at',
  'title',
  'type',
  'file_size',
]);

/** 默认排序：updated_at 降序（与历史行为一致） */
const DEFAULT_SORT_FIELD = 'updated_at';
const DEFAULT_SORT_DESCENDING = true;

/** 排序字符串里的字段别名（'updated_desc' -> updated_at） */
const SORT_FIELD_ALIASES = Object.freeze({
  updated: 'updated_at',
  created: 'created_at',
});

/**
 * 归一化次级排序键（可选的第二把排序键）。
 *
 * 用途（WS-T）：「最近访问」= last_opened_at desc，但历史/从未打开的笔记该字段为 null，
 * 只按它排会让这部分笔记顺序不确定；因此追加 updated_at 作为次级键，
 * 形成「有访问时间按访问时间、没有的按更新时间」的确定性顺序，且仍可整体下推 Realm
 * （Realm 的 sorted() 支持 [[field, desc], [field2, desc2]] 多键）。
 *
 * @param {Object|null} secondary
 * @returns {{field: string, descending: boolean}|null}
 */
const normalizeSecondarySort = (secondary) => {
  if (!secondary || typeof secondary !== 'object' || typeof secondary.field !== 'string') {
    return null;
  }
  if (!REALM_SORTABLE_FIELDS.includes(secondary.field)) {
    return null;
  }
  return {
    field: secondary.field,
    descending: secondary.descending === true || secondary.direction === -1,
  };
};

/**
 * 归一化排序入参，产出 Realm 可直接下推的 { field, descending }（可带 secondary）。
 *
 * 兼容三种写法：
 * - { field: 'created_at', descending: true }  （新式：显式声明可下推字段）
 * - { field: 'last_opened_at', descending: true, secondary: { field: 'updated_at', descending: true } }
 *                                              （多键：用于「最近访问」+ 未访问兜底）
 * - { title: 1 } / { title: -1 }               （历史 Mongo 风格，-1 = 降序）
 * - 'updated_desc' / 'title_asc' / 'created_at'（字符串简写）
 *
 * 无法解析或不在白名单内时返回 null，由调用方回退默认 updated_at desc。
 *
 * @param {Object|string|null} sort
 * @returns {{field: string, descending: boolean, secondary?: {field: string, descending: boolean}}|null}
 */
const normalizeRealmSort = (sort) => {
  if (!sort) {
    return null;
  }

  if (typeof sort === 'string') {
    const matched = /^(.+)_(asc|desc)$/.exec(sort);
    const rawField = matched ? matched[1] : sort;
    const field = SORT_FIELD_ALIASES[rawField] || rawField;
    const descending = matched ? matched[2] === 'desc' : DEFAULT_SORT_DESCENDING;
    return REALM_SORTABLE_FIELDS.includes(field) ? { field, descending } : null;
  }

  if (typeof sort !== 'object') {
    return null;
  }

  if (typeof sort.field === 'string') {
    if (!REALM_SORTABLE_FIELDS.includes(sort.field)) {
      return null;
    }
    const primary = {
      field: sort.field,
      descending: sort.descending === true || sort.direction === -1,
    };
    const secondary = normalizeSecondarySort(sort.secondary);
    return secondary ? { ...primary, secondary } : primary;
  }

  const field = Object.keys(sort)[0];
  if (!field) {
    return null;
  }
  return REALM_SORTABLE_FIELDS.includes(field)
    ? { field, descending: sort[field] === -1 }
    : null;
};

/**
 * 笔记模型定义
 */
class Note extends Realm.Object {
  static schema = {
    name: 'Note',
    primaryKey: '_id',
    properties: {
      _id: 'string',
      title: { type: 'string', indexed: true },
      content: { type: 'string', default: '', indexed: true },
      type: { type: 'string', default: 'text', indexed: true },
      tags: { type: 'list', objectType: 'string', default: [] },
      category_id: { type: 'string', optional: true, indexed: true },
      color: { type: 'string', default: '#4CAF50' },
      is_favorite: { type: 'bool', default: false, indexed: true },
      is_archived: { type: 'bool', default: false, indexed: true },
      is_deleted: { type: 'bool', default: false, indexed: true },
      is_synced: { type: 'bool', default: false },
      created_at: { type: 'date', indexed: true },
      updated_at: { type: 'date', indexed: true },
      deleted_at: { type: 'date', optional: true },
      // 「最近访问」落库字段（WS-T），与运行时 schema（realmModels.js）保持一致：
      // 打开笔记时单字段写入；可空，历史数据由 Realm 迁移自动补 null。
      last_opened_at: { type: 'date', optional: true },
      // 与运行时 schema（src/services/database/realmModels.js）保持一致：user_id 可空。
      // 历史写入路径会落 null / 空串（无主笔记），读取侧按「当前用户 + 无主」谓词兼容，
      // 因此这里必须声明为可空，避免声明与真实数据形态不一致（RISK-SCHEMA-001）。
      user_id: { type: 'string?', indexed: true },
      metadata: { type: 'string', default: '{}' }, // 存储为JSON字符串
      file_path: { type: 'string', optional: true },
      file_size: { type: 'int', optional: true },
      file_type: { type: 'string', optional: true },
      thumbnail_path: { type: 'string', optional: true },
      shared_with: { type: 'string', default: '[]' }, // 存储为JSON字符串
      version: { type: 'int', default: 1 },
      parent_id: { type: 'string', optional: true, indexed: true },
    },
  };

  /**
   * 转换为JSON
   */
  toJSON() {
    const metadata = this.metadata ? JSON.parse(this.metadata) : {};
    const sharedWith = this.shared_with ? JSON.parse(this.shared_with) : [];

    return {
      _id: this._id,
      id: this._id,
      title: this.title,
      content: this.content,
      type: this.type,
      tags: this.tags,
      category_id: this.category_id,
      color: this.color,
      is_favorite: this.is_favorite,
      is_archived: this.is_archived,
      is_deleted: this.is_deleted,
      is_synced: this.is_synced,
      created_at: this.created_at,
      updated_at: this.updated_at,
      deleted_at: this.deleted_at,
      user_id: this.user_id,
      metadata: metadata,
      file_path: this.file_path,
      file_size: this.file_size,
      file_type: this.file_type,
      thumbnail_path: this.thumbnail_path,
      shared_with: sharedWith,
      version: this.version,
      parent_id: this.parent_id,
    };
  }

  /**
   * 软删除
   * @param {Realm} realm Realm实例
   */
  softDelete(realm) {
    realm.write(() => {
      this.is_deleted = true;
      this.deleted_at = new Date();
      this.updated_at = new Date();
    });
    return this;
  }

  /**
   * 恢复
   * @param {Realm} realm Realm实例
   */
  restore(realm) {
    realm.write(() => {
      this.is_deleted = false;
      this.deleted_at = null;
      this.updated_at = new Date();
    });
    return this;
  }

  /**
   * 归档
   * @param {Realm} realm Realm实例
   */
  archive(realm) {
    realm.write(() => {
      this.is_archived = true;
      this.updated_at = new Date();
    });
    return this;
  }

  /**
   * 取消归档
   * @param {Realm} realm Realm实例
   */
  unarchive(realm) {
    realm.write(() => {
      this.is_archived = false;
      this.updated_at = new Date();
    });
    return this;
  }

  /**
   * 收藏
   * @param {Realm} realm Realm实例
   */
  favorite(realm) {
    realm.write(() => {
      this.is_favorite = true;
      this.updated_at = new Date();
    });
    return this;
  }

  /**
   * 取消收藏
   * @param {Realm} realm Realm实例
   */
  unfavorite(realm) {
    realm.write(() => {
      this.is_favorite = false;
      this.updated_at = new Date();
    });
    return this;
  }

  /**
   * 添加标签
   * @param {Realm} realm Realm实例
   * @param {string} tag 标签
   */
  addTag(realm, tag) {
    if (!this.tags.includes(tag)) {
      realm.write(() => {
        this.tags.push(tag);
        this.updated_at = new Date();
      });
    }
    return this;
  }

  /**
   * 移除标签
   * @param {Realm} realm Realm实例
   * @param {string} tag 标签
   */
  removeTag(realm, tag) {
    realm.write(() => {
      this.tags = this.tags.filter(t => t !== tag);
      this.updated_at = new Date();
    });
    return this;
  }

  /**
   * 分享给用户
   * @param {Realm} realm Realm实例
   * @param {string} userId 用户ID
   * @param {string} permission 权限
   */
  shareWith(realm, userId, permission = 'read') {
    realm.write(() => {
      const sharedWith = this.shared_with ? JSON.parse(this.shared_with) : [];
      const existingShareIndex = sharedWith.findIndex(s => s.user_id === userId);

      if (existingShareIndex >= 0) {
        sharedWith[existingShareIndex].permission = permission;
      } else {
        sharedWith.push({
          user_id: userId,
          permission,
          shared_at: new Date().toISOString(),
        });
      }

      this.shared_with = JSON.stringify(sharedWith);
      this.updated_at = new Date();
    });

    return this;
  }

  /**
   * 取消分享
   * @param {Realm} realm Realm实例
   * @param {string} userId 用户ID
   */
  unshare(realm, userId) {
    realm.write(() => {
      const sharedWith = this.shared_with ? JSON.parse(this.shared_with) : [];
      this.shared_with = JSON.stringify(sharedWith.filter(s => s.user_id !== userId));
      this.updated_at = new Date();
    });

    return this;
  }

  /**
   * 静态方法 - 根据ID查找
   * @param {Realm} realm Realm实例
   * @param {string} id ID
   */
  static findById(realm, id) {
    return realm.objectForPrimaryKey('Note', id);
  }

  /**
   * 私有辅助 - 组装用户笔记的过滤 + 排序集合（不做分页，保持惰性）
   *
   * 抽出来是为了让 findByUser / findByUserSummaries 共用同一套过滤与排序语义，
   * 两者唯一的差别只是「是否做字段裁剪」。
   *
   * @param {Realm} realm Realm实例
   * @param {string} userId 用户ID
   * @param {Object} options 选项
   * @returns {Object} Realm Results（惰性、已排序，未分页）
   */
  static _queryUserResults(realm, userId, options = {}) {
    const {
      is_deleted = false,
      is_archived = false,
      is_favorite = null,
      category_id = null,
      type = null,
      tags = null,
      search = null,
    } = options;

    // 同时匹配当前用户与「无主」历史笔记。运行时 schema 为 user_id: 'string?'（可空），
    // 历史/分页笔记可能落成 null，也可能落成空串，因此两种都要覆盖。
    let query = `(user_id = "${userId}" OR user_id = nil OR user_id = "") AND is_deleted = ${is_deleted}`;

    if (is_archived !== null) {
      query += ` AND is_archived = ${is_archived}`;
    }

    if (is_favorite !== null) {
      query += ` AND is_favorite = ${is_favorite}`;
    }

    if (category_id) {
      query += ` AND category_id = "${category_id}"`;
    }

    if (type) {
      query += ` AND type = "${type}"`;
    }

    if (tags) {
      // 在Realm中处理数组包含查询比较复杂，这里简化处理
      const tagArray = Array.isArray(tags) ? tags : [tags];
      const tagQueries = tagArray.map(tag => `tags CONTAINS "${tag}"`).join(' OR ');
      if (tagQueries) {
        query += ` AND (${tagQueries})`;
      }
    }

    // 注意：Realm不支持全文搜索，这里简化为包含查询
    if (search) {
      query += ` AND (title CONTAINS[c] "${search}" OR content CONTAINS[c] "${search}")`;
    }

    let results = realm.objects('Note').filtered(query);

    // 排序：仅在白名单字段上做 Realm 侧下推；未传 sort 时保持历史行为（updated_at desc）
    const sortSpec = normalizeRealmSort(options.sort);
    if (options.sort && !sortSpec) {
      console.warn(
        `Note._queryUserResults: 排序字段无法下推 Realm，回退 ${DEFAULT_SORT_FIELD} desc:`,
        options.sort,
      );
    }
    if (sortSpec) {
      // 多键排序（如「最近访问」= last_opened_at desc, updated_at desc）同样完全下推 Realm
      results = sortSpec.secondary
        ? results.sorted([
          [sortSpec.field, sortSpec.descending],
          [sortSpec.secondary.field, sortSpec.secondary.descending],
        ])
        : results.sorted(sortSpec.field, sortSpec.descending);
    } else {
      results = results.sorted(DEFAULT_SORT_FIELD, DEFAULT_SORT_DESCENDING);
    }

    return results;
  }

  /**
   * 静态方法 - 查找用户的笔记（契约不变：未传分页时返回惰性 Results）
   * @param {Realm} realm Realm实例
   * @param {string} userId 用户ID
   * @param {Object} options 选项
   */
  static findByUser(realm, userId, options = {}) {
    let results = Note._queryUserResults(realm, userId, options);

    // 分页
    if (options.skip !== undefined && options.limit !== undefined) {
      const skip = options.skip || 0;
      const limit = options.limit || 20;
      results = materializePage(results, { skip, limit });
    }

    return results;
  }

  /**
   * 静态方法 - 列表页轻量投影（里程碑 5.1：字段裁剪 + 正文延迟加载）
   *
   * 过滤/排序/分页语义与 findByUser 完全一致，但只物化当前页并投影成
   * NOTE_SUMMARY_FIELDS 白名单字段，全程不读取 content；需要正文时用
   * loadNoteContent(realm, id) 或 summary.loadContent() 单独取。
   *
   * 与 findByUser 的差别：本方法始终返回数组（summary 数组）；
   * 未传 skip/limit 时投影整个结果集，列表页应始终传入分页参数。
   *
   * @param {Realm} realm Realm实例
   * @param {string} userId 用户ID
   * @param {Object} options 选项（同 findByUser，支持 skip/limit）
   * @returns {Array<Object>} summary 数组（不含 content）
   */
  static findByUserSummaries(realm, userId, options = {}) {
    const results = Note._queryUserResults(realm, userId, options);
    const paged = options.skip !== undefined && options.limit !== undefined;
    const pageOptions = paged
      ? { skip: options.skip || 0, limit: options.limit || 20 }
      : {};

    // 统一走 materializeNoteSummaries（先取当前页，再按 NOTE_SUMMARY_FIELDS 投影）：
    // last_opened_at 已在白名单内（WS-U），不再需要任何旁路补标量；
    // 物化上界恒等于当前页大小。
    return materializeNoteSummaries(results, pageOptions);
  }

  /**
   * 静态方法 - 查找已删除的笔记
   * @param {Realm} realm Realm实例
   * @param {string} userId 用户ID
   * @param {Object} options 选项
   */
  static findDeleted(realm, userId, options = {}) {
    let results = realm.objects('Note')
      .filtered(`(user_id = "${userId}" OR user_id = nil OR user_id = "") AND is_deleted = true`)
      .sorted('deleted_at', true);

    // 分页
    if (options.skip !== undefined && options.limit !== undefined) {
      const skip = options.skip || 0;
      const limit = options.limit || 20;
      results = materializePage(results, { skip, limit });
    }

    return results;
  }

  /**
   * 静态方法 - 查找已归档的笔记
   * @param {Realm} realm Realm实例
   * @param {string} userId 用户ID
   * @param {Object} options 选项
   */
  static findArchived(realm, userId, options = {}) {
    let results = realm.objects('Note')
      .filtered(`(user_id = "${userId}" OR user_id = nil OR user_id = "") AND is_archived = true AND is_deleted = false`)
      .sorted('updated_at', true);

    // 分页
    if (options.skip !== undefined && options.limit !== undefined) {
      const skip = options.skip || 0;
      const limit = options.limit || 20;
      results = materializePage(results, { skip, limit });
    }

    return results;
  }

  /**
   * 静态方法 - 查找收藏的笔记
   * @param {Realm} realm Realm实例
   * @param {string} userId 用户ID
   * @param {Object} options 选项
   */
  static findFavorites(realm, userId, options = {}) {
    let results = realm.objects('Note')
      .filtered(`(user_id = "${userId}" OR user_id = nil OR user_id = "") AND is_favorite = true AND is_deleted = false`)
      .sorted('updated_at', true);

    // 分页
    if (options.skip !== undefined && options.limit !== undefined) {
      const skip = options.skip || 0;
      const limit = options.limit || 20;
      results = materializePage(results, { skip, limit });
    }

    return results;
  }

  /**
   * 静态方法 - 搜索笔记
   * @param {Realm} realm Realm实例
   * @param {string} userId 用户ID
   * @param {string} searchText 搜索关键词
   * @param {Object} options 选项
   */
  static search(realm, userId, searchText, options = {}) {
    const {
      is_deleted = false,
      is_archived = false,
    } = options;

    // 注意：Realm不支持全文搜索，这里简化为包含查询
    let query = `user_id = "${userId}" AND is_deleted = ${is_deleted} AND is_archived = ${is_archived}`;
    query += ` AND (title CONTAINS[c] "${searchText}" OR content CONTAINS[c] "${searchText}")`;

    let results = realm.objects('Note').filtered(query).sorted('updated_at', true);

    // 分页
    if (options.skip !== undefined && options.limit !== undefined) {
      const skip = options.skip || 0;
      const limit = options.limit || 20;
      results = materializePage(results, { skip, limit });
    }

    return results;
  }
}

export default Note;
export { REALM_SORTABLE_FIELDS, DEFAULT_SORT_FIELD, DEFAULT_SORT_DESCENDING, normalizeRealmSort };
