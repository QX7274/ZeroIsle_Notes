/**
 * 从离线存储获取笔记的辅助函数
 */
// 已移除 offlineStorageService 导入，现在直接使用 realmService
import networkService from '../network/networkService';
import realmService from '../database/realmService';
import { DEV_MODE_CONFIG } from '../../config';
import { materializePage } from '../../models/utils/queryPagination';
import Note from '../../models/Note';

const NOTE_SCHEMA = 'Note';
const RECENT_FALLBACK_LIMIT = 20;

/**
 * 列表主查询谓词：当前用户 + 「无主」历史笔记。
 *
 * 历史写入路径只在 source.user_id !== undefined 时才落 user_id，或写入 'current_user' 哨兵，
 * UI 新建笔记因此落成 schema 默认值；若只匹配 user_id == $0，这些历史/无主笔记会被整体过滤掉
 * （设备实测：3 条 paged note 的 user_id 全为 null，filtered count = 0，首页空列表）。
 *
 * 运行时 schema（src/services/database/realmModels.js）是 user_id: 'string?'（可空），
 * 因此必须同时匹配 nil 与空串；user_id 为其他账号的笔记仍不可见。
 */
const LOCAL_NOTES_QUERY =
  'is_deleted = false AND (user_id == $0 OR user_id == nil OR user_id == "")';

/**
 * 是否是「类 Realm Results」的惰性集合。
 *
 * Realm 的 Results 不是 Array（Array.isArray(results) === false），但拥有
 * length 与 slice。历史上用 Array.isArray 判断会把所有真实 Results 判为无效，
 * 导致列表必然回落到「最近导入」分支并被截断到 20 条。
 * 这里以 length: number + slice: function 作为契约，同时兼容真正的 Array。
 *
 * @param {*} value
 * @returns {boolean}
 */
export const isResultsLike = (value) =>
  value !== null &&
  typeof value === 'object' &&
  typeof value.length === 'number' &&
  typeof value.slice === 'function';

/**
 * 过滤掉既无 _id 也无 id 的脏数据，保证消费方（notesSlice 的
 * notes.filter(n => n.id || n._id)）不会把整页过滤空。
 * @param {Array} notes
 * @returns {Array}
 */
const pickValidNotes = (notes) =>
  (Array.isArray(notes) ? notes : []).filter(
    note => note && typeof note === 'object' && (note._id || note.id),
  );

/**
 * 解析当前用户（保持既有 authStorage + DEV_SKIP_LOGIN 兜底语义不变）。
 *
 * user.id 缺失时沿用原有的失败路径（抛错，由调用方的 Promise 捕获处理），
 * 并打印告警，避免用缺失的 user_id 去做「无隔离」的全表查询。
 *
 * @returns {Promise<Object>} 当前用户
 */
const resolveCurrentUser = async () => {
  let user = null;
  try {
    const authStorage = require('../auth/authStorage').default;
    user = await authStorage.getUser();

    if (user && user.id) {
      console.log('从authStorage获取到用户信息:', user.username || user.id);
    } else {
      throw new Error('未获取到有效的用户信息，无法读取离线笔记');
    }
  } catch (userError) {
    const DEV_SKIP_LOGIN = __DEV__ && Boolean(DEV_MODE_CONFIG?.FEATURES?.SKIP_LOGIN_SCREEN);
    if (DEV_SKIP_LOGIN) {
      user = DEV_MODE_CONFIG.DEV_ACCOUNT || {
        id: 'dev-account-001',
        username: 'developer',
      };
      console.log('DEV_SKIP_LOGIN 模式：使用开发者账户上下文读取本地笔记:', user.username || user.id);
    }
    if (!user) {
      console.warn('获取用户信息失败:', userError);
      throw userError;
    }
  }

  if (!user.id) {
    // 兜底账户也可能缺少 id：保留原有失败语义，绝不退化成跨账号查询
    console.warn('当前用户缺少 id，无法按用户隔离读取离线笔记');
    throw new Error('未获取到有效的用户信息，无法读取离线笔记');
  }

  return user;
};

/**
 * 解析本地笔记 owner id（供写入侧复用，保证读写同一口径）。
 *
 * 失败一律返回 null 且不抛错：写入侧据此保持「无主」本地保存，
 * 绝不因为解析失败阻断保存，也不写入错误的 owner。
 *
 * @returns {Promise<string|null>}
 */
export const resolveLocalOwnerId = async () => {
  try {
    const user = await resolveCurrentUser();
    return user && user.id ? String(user.id) : null;
  } catch (error) {
    console.warn('[getNotes] 无法解析本地笔记 owner，写入侧将保持无主:', error);
    return null;
  }
};

/**
 * 最近导入兜底：同样按 user_id 隔离，并把 Results 物化成真正的 Array
 * @param {string} userId
 * @returns {Promise<Array>}
 */
const loadRecentNotes = async (userId) => {
  try {
    console.log('尝试获取最近导入的笔记');
    const realm = await realmService.getRealm();
    const results = realm
      .objects(NOTE_SCHEMA)
      .filtered(LOCAL_NOTES_QUERY, userId)
      .sorted('updated_at', true);

    if (!isResultsLike(results)) {
      return [];
    }

    // 在 Results 层先 slice 再物化，避免把整表读进内存
    return pickValidNotes(materializePage(results, { limit: RECENT_FALLBACK_LIMIT }));
  } catch (recentError) {
    console.warn('获取最近导入的笔记失败:', recentError);
    return [];
  }
};

/**
 * 从离线存储获取当前用户的笔记
 *
 * 契约：
 * - 未传分页参数时返回该用户全部未删除笔记（不静默截断到 20 条）；
 * - 传 { skip, limit } 时在 Results 层先 slice 再物化，只读当前页；
 * - 返回的 data 始终是真正的 Array（materializePage 内部已 Array.from），
 *   保证 Array.isArray(data) === true，HomeScreen 与 notesSlice 两条消费链都能工作；
 * - 查询带 user_id 隔离（同时容忍无主历史笔记，含 runtime schema 的 null）：
 *   is_deleted = false AND (user_id == $0 OR user_id == nil OR user_id == "")。
 *
 * @param {Object} [options]
 * @param {number} [options.skip] 跳过条数
 * @param {number} [options.limit] 单页条数
 * @returns {Promise<Object>} 笔记列表和状态
 */
export const getNotesFromOfflineStorage = async (options = {}) => {
  try {
    console.log('从离线存储获取笔记...');

    // 1. 获取网络状态
    const networkStatus = await networkService.checkConnection();
    const isOnline = Boolean(networkStatus);
    console.log('网络状态:', isOnline ? '在线' : '离线');

    // 2. 获取用户信息（保持既有兜底语义）
    const user = await resolveCurrentUser();
    const userId = String(user.id);
    console.log('当前用户:', user.username || userId);

    // 使用realmService获取笔记
    try {
      // realmService 不需要手动初始化
      const realm = await realmService.getRealm();
      // 用户隔离：只读当前用户未删除的笔记；用户 id 走绑定参数，避免字符串拼接
      const results = realm
        .objects(NOTE_SCHEMA)
        .filtered(LOCAL_NOTES_QUERY, userId);

      console.log('从离线存储获取到笔记数量:', isResultsLike(results) ? results.length : 0);

      // 分页在 Results 层完成，materializePage 保证返回值是 Array
      const page = isResultsLike(results) ? materializePage(results, options) : [];
      const validNotes = pickValidNotes(page);
      const hasPaging = options.skip !== undefined || options.limit !== undefined;

      if (validNotes.length === 0 && !hasPaging) {
        // 尝试获取最近导入的笔记
        const recentNotes = await loadRecentNotes(userId);

        if (recentNotes.length > 0) {
          console.log('找到' + recentNotes.length + '条最近导入的笔记');
          return {
            success: true,
            data: recentNotes,
            isOffline: !isOnline,
            message: '显示最近导入的笔记',
          };
        }

        return {
          success: true,
          data: [],
          isFirstUse: true,
          message: '首次使用或尚未创建笔记',
        };
      }

      // 显式分页时，空页就是空页，不能回落到「最近导入」而返回错页数据
      return {
        success: true,
        data: validNotes,
        isOffline: !isOnline,
      };
    } catch (offlineError) {
      console.error('从离线存储获取笔记失败:', offlineError);

      // 尝试从本地存储中恢复最后一次成功的笔记列表
      try {
        console.log('尝试从本地存储中恢复最后一次成功的笔记列表');
        const lastNotesKey = 'last_successful_notes';
        const realm = await realmService.getRealm();
        const item = realm.objects('StorageItem').filtered('key = "' + lastNotesKey + '"');
        const lastNotesJson = item.length > 0 ? item[0].value : null;

        if (lastNotesJson) {
          // 导入JSON工具函数
          const { safeParseJSON } = require('../../utils/jsonUtils');

          // 使用安全的JSON解析函数
          const lastNotes = safeParseJSON(lastNotesJson, []);

          if (Array.isArray(lastNotes) && lastNotes.length > 0) {
            console.log('从本地存储中恢复了' + lastNotes.length + '条笔记');
            return {
              success: true,
              data: lastNotes,
              isOffline: true,
              isRecovered: true,
              message: '显示上次缓存的笔记',
            };
          } else {
            console.warn('解析的缓存笔记不是数组或为空');
          }
        } else {
          console.log('本地存储中没有找到缓存的笔记');
        }
      } catch (recoveryError) {
        console.error('从本地存储中恢复笔记失败:', recoveryError);
      }

      throw new Error('获取笔记失败，请稍后重试');
    }
  } catch (error) {
    console.error('获取笔记列表失败:', error);
    throw error;
  }
};

/**
 * 从离线存储获取当前用户的列表页轻量 summary（里程碑 5.1：字段裁剪）
 *
 * 复用 Note.findByUserSummaries：过滤/排序/分页语义与主查询一致，
 * 只投影 NOTE_SUMMARY_FIELDS 白名单字段，全程不读取 content。
 *
 * 里程碑 5.1 续（列表分页）：支持传入 Realm 可下推的 sort（{ field, descending }），
 * 由 Note._queryUserResults 白名单校验后下推到 Realm.sorted()，从而做到「每页只物化一页」。
 *
 * @param {Object} [options]
 * @param {number} [options.skip] 跳过条数
 * @param {number} [options.limit] 单页条数（列表页应始终传入，避免整表投影）
 * @param {{field: string, descending: boolean}} [options.sort] Realm 可下推排序
 * @returns {Promise<Array<Object>>} summary 数组（不含 content）
 */
export const getNoteSummariesFromOfflineStorage = async (options = {}) => {
  const user = await resolveCurrentUser();
  const userId = String(user.id);
  const realm = await realmService.getRealm();

  // 归一化分页：只要显式传了 skip/limit 就按分页处理，保证 10 万条下只物化一页
  const hasPaging = options.skip !== undefined || options.limit !== undefined;
  const pageOptions = {};
  if (hasPaging) {
    const rawSkip = Number(options.skip);
    const rawLimit = Number(options.limit);
    pageOptions.skip = Number.isFinite(rawSkip) && rawSkip > 0 ? Math.floor(rawSkip) : 0;
    pageOptions.limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.floor(rawLimit) : RECENT_FALLBACK_LIMIT;
  }
  if (options.sort) {
    pageOptions.sort = options.sort;
  }

  return Note.findByUserSummaries(realm, userId, pageOptions);
};

/**
 * 「是否应记录这次打开」的纯判定（所有打开入口共用的守卫，WS-U）。
 *
 * 只有「用户主动打开一篇既有笔记」才算访问：
 * - 新建流程（isNew / createNew）不记 —— 产品语义上不是「访问」；
 * - 空 id、临时 id（temp_ 前缀）不记（这类 id 还没有落库的 Note）。
 *
 * 纯函数、无副作用，便于单测与被各入口复用。
 *
 * @param {string} noteId
 * @param {{isNew?: boolean}} [options]
 * @returns {boolean}
 */
export const shouldMarkNoteOpened = (noteId, options = {}) => {
  if (options.isNew === true) {
    return false;
  }
  const id = noteId === null || noteId === undefined || noteId === '' ? null : String(noteId);
  if (!id || id.startsWith('temp_')) {
    return false;
  }
  return true;
};

/**
 * 路由参数 → 「打开既有笔记」记录（各屏幕统一入口，WS-U）。
 *
 * 约定：params.noteId/_id/id 是笔记 id；params.createNew / params.isNew 表示新建流程。
 * 新建流程直接跳过，因此屏幕不需要自己判断。
 *
 * @param {Object} params 路由参数（route.params）
 * @param {{realm?: Object}} [options]
 * @returns {Promise<boolean>}
 */
export const markNoteOpenedFromParams = (params, options = {}) => {
  const source = params || {};
  const noteId = source.noteId || source._id || source.id;
  const isNew = source.createNew === true || source.isNew === true;
  return markNoteOpenedAt(noteId, { ...options, isNew });
};

/**
 * 记录「最近访问」：打开笔记时**单字段**写入 Note.last_opened_at（WS-T）。
 *
 * 为什么落库：列表「最近访问」排序要能下推 Realm 才能分页；fileHistoryService 的访问历史
 * 在 JS 内存里，无法参与 Realm 排序。写入本字段后，
 * 排序 = [last_opened_at desc, updated_at desc] 完全由 Realm 完成。
 *
 * 约束（刻意保持轻量）：
 * - 只写 last_opened_at 一个字段，不刷新 updated_at / metadata / dataHash，也不入离线同步队列
 *   （访问时间是本机使用信号，不参与跨端同步；避免把「打开过」变成一次待同步写）；
 * - 独立 realm.write，失败只 console.warn，绝不抛错、绝不阻断打开流程；
 * - 临时 id（temp_ 前缀）与空 id 直接跳过；
 * - 新建流程（isNew/createNew）不算访问：见 shouldMarkNoteOpened。
 *
 * @param {string} noteId 笔记 id
 * @param {{realm?: Object, isNew?: boolean}} [options]
 *        realm 可注入（便于单测；缺省用 realmService.getRealm()）；
 *        isNew=true 表示「这是新建笔记的流程」，直接跳过，不写访问时间
 * @returns {Promise<boolean>} 是否写入成功（笔记不存在或跳过时为 false）
 */
export const markNoteOpenedAt = async (noteId, options = {}) => {
  if (!shouldMarkNoteOpened(noteId, options)) {
    return false;
  }
  const id = String(noteId);

  try {
    const realm = options.realm || await realmService.getRealm();
    if (!realm
      || typeof realm.write !== 'function'
      || typeof realm.objectForPrimaryKey !== 'function') {
      return false;
    }

    let wrote = false;
    realm.write(() => {
      const note = realm.objectForPrimaryKey(NOTE_SCHEMA, id);
      if (!note) {
        return;
      }
      note.last_opened_at = new Date();
      wrote = true;
    });
    return wrote;
  } catch (error) {
    console.warn('[getNotes] 写入 last_opened_at 失败，已忽略:', error);
    return false;
  }
};

// ---------------------------------------------------------------------------
// 列表分页决策（里程碑 5.1 续）
//
// 只有「能把排序下推 Realm」的排序才允许分页：分页要求数据库侧的排序就是最终的展示顺序，
// 否则第 N 页取回后再用 JS 比较器重排，会出现跨页乱序/重复/漏项。
//
// - updated_desc / recent_desc（最近访问）：WS-T 把访问时间落库为 Note.last_opened_at 后，
//   排序 = [last_opened_at desc, updated_at desc] —— 打开过的笔记按访问时间，历史/从未打开的
//   （last_opened_at 为 null）排在后面并按 updated_at 兜底。两把键都能整体下推 Realm，
//   因此「最近访问」也走分页，不再一次性取回全部 summary。
//   语义差异：旧实现用 max(updated_at, fileHistory.lastOpened) 取较新者，
//   现在访问时间优先（访问过的排在未访问过的前面）；fileHistoryService 退为
//   title/type/size 等「不可下推排序」的 JS 侧参考，不再参与分页排序。
// - updated_asc（最早更新）：保持纯 updated_at asc，不掺入访问时间（避免「最早访问」混淆语义）。
// - created_desc / created_asc：纯时间字段，与既有 JS 比较器完全等价。
// - title_asc / title_desc：Realm 字符串按码点排序，既有实现是 localeCompare('zh-CN',
//   { numeric: true })（中文按拼音、数字按数值）。两者顺序不一致，分页会改变可见顺序，
//   因此保持一次性全量 + JS 排序。
// - type：复合比较器（类型优先级 + updated_at/访问时间），无法整体下推。
// - size_desc / size_asc：size 来自 size/fileSize/file_size（甚至回退正文长度），非单一字段。
// ---------------------------------------------------------------------------

/** 列表分页默认页大小 */
export const DEFAULT_LIST_PAGE_SIZE = 50;

/**
 * 「最近访问」排序（WS-T）：last_opened_at desc（Realm 的 null 值在降序中排最后），
 * 未访问过（null）的笔记用 updated_at desc 兜底，保证顺序确定且可整体下推。
 */
const RECENT_DESC_SORT = Object.freeze({
  field: 'last_opened_at',
  descending: true,
  secondary: { field: 'updated_at', descending: true },
});

/** 「最早访问」：last_opened_at asc（null 排最前），未访问过的按 updated_at asc 兜底 */
const RECENT_ASC_SORT = Object.freeze({
  field: 'last_opened_at',
  descending: false,
  secondary: { field: 'updated_at', descending: false },
});

/** Realm 可下推排序的 UI 排序 id（全部走分页） */
const PAGINATED_SORT_OPTIONS = Object.freeze({
  updated_desc: RECENT_DESC_SORT,
  recent_desc: RECENT_DESC_SORT,
  recent_asc: RECENT_ASC_SORT,
  updated_asc: { field: 'updated_at', descending: false },
  created_desc: { field: 'created_at', descending: true },
  created_asc: { field: 'created_at', descending: false },
});

/** 「最近访问」家族：排序以 last_opened_at 为主键 */
const RECENT_SORT_KEYS = Object.freeze(['updated_desc', 'recent_desc', 'recent_asc']);

/** 不可下推排序的原因（用于日志/报告，避免「静默不分页」） */
const NON_PAGINATED_SORT_REASONS = Object.freeze({
  title_asc: 'Realm 字符串按码点排序，与既有 localeCompare(zh-CN) 不一致，保持一次性全量 + JS 排序',
  title_desc: 'Realm 字符串按码点排序，与既有 localeCompare(zh-CN) 不一致，保持一次性全量 + JS 排序',
  type: '类型排序是「类型优先级 + updated_at/最近访问」的复合比较器，无法整体下推 Realm',
  size_desc: 'size 来自 size/fileSize/file_size 多来源（甚至回退正文长度），不是单一 Realm 字段',
  size_asc: 'size 来自 size/fileSize/file_size 多来源（甚至回退正文长度），不是单一 Realm 字段',
});

/**
 * 解析 UI 排序对应的「分页策略」：能否下推 Realm、下推参数、以及原因。
 * 纯函数，供 HomeScreen 与单测共用。
 *
 * @param {string} [sortOption] HomeScreen 的 sortOption
 * @returns {{key: string, paginated: boolean, sort: {field: string, descending: boolean}|null, reason: string}}
 */
export const resolveListSortPolicy = (sortOption) => {
  const key = sortOption || 'updated_desc';

  if (PAGINATED_SORT_OPTIONS[key]) {
    const isRecent = RECENT_SORT_KEYS.includes(key);
    return {
      key,
      paginated: true,
      sort: { ...PAGINATED_SORT_OPTIONS[key] },
      reason: isRecent
        ? `${key} 可下推 Realm：[last_opened_at 主键 + 未访问过（null）按 updated_at 兜底]；` +
          '访问时间已落库（WS-T），因此「最近访问」也走分页'
        : key.startsWith('created')
          ? `${key} 可下推 Realm（纯创建时间，与既有 JS 比较器等价），每页只物化一页`
          : `${key} 可下推 Realm（updated_at 时间字段），每页只物化一页`,
    };
  }

  if (NON_PAGINATED_SORT_REASONS[key]) {
    return {
      key,
      paginated: false,
      sort: null,
      reason: NON_PAGINATED_SORT_REASONS[key],
    };
  }

  // 未知排序：按默认「最近访问」处理（与 UI 默认 updated_desc 一致）
  return {
    key,
    paginated: true,
    sort: { ...RECENT_DESC_SORT },
    reason: `未知排序「${key}」按默认「最近访问」处理（last_opened_at 主键 + updated_at 兜底）`,
  };
};

/**
 * 把排序字段值转成可比较的标量（与 Realm 的语义对齐：日期用时间戳，其余用字符串）。
 * @param {*} value
 * @param {string} field
 * @returns {number|string}
 */
const toComparableSortValue = (value, field) => {
  if (field.endsWith('_at')) {
    if (value === null || value === undefined) {
      return 0;
    }
    const time = value instanceof Date ? value.getTime() : new Date(value).getTime();
    return Number.isFinite(time) ? time : 0;
  }
  if (value === null || value === undefined) {
    return '';
  }
  return String(value);
};

/**
 * 归一化比较器使用的排序键列表（主键 + 可选次级键）。
 * @param {Object} sort
 * @returns {Array<{field: string, descending: boolean}>}
 */
const normalizeComparatorKeys = (sort) => {
  const keys = [];
  if (sort && typeof sort.field === 'string') {
    keys.push({ field: sort.field, descending: Boolean(sort.descending) });
  }
  if (sort && sort.secondary && typeof sort.secondary.field === 'string') {
    keys.push({ field: sort.secondary.field, descending: Boolean(sort.secondary.descending) });
  }
  if (keys.length === 0) {
    keys.push({ field: 'updated_at', descending: true });
  }
  return keys;
};

/**
 * 可下推排序在 JS 侧的「等价比较器」（支持主键 + 次级键，如「最近访问」）。
 *
 * 用途：Redux 的 notes adapter 自带 sortComparer（固定按 updated_at desc），
 * 因此 created_at / last_opened_at 等排序在 Redux 里会被重排。列表渲染前用这里返回的
 * 比较器按同一组排序键排列「已加载的 summary 子集」，既能继续反映新建/删除，
 * 又保证与 Realm 的分页边界一致。
 *
 * null 语义与 Realm/Mongo 对齐：日期字段 null 折算为 0（epoch），
 * 因此降序时空值自然排最后、升序时排最前。
 *
 * 纯函数，便于单测。
 *
 * @param {{field: string, descending: boolean, secondary?: {field: string, descending: boolean}}} sort
 * @returns {(a: Object, b: Object) => number}
 */
export const resolveSortComparator = (sort) => {
  const keys = normalizeComparatorKeys(sort);
  // 每个条目每把键只折算一次：10 万条下避免 O(n log n) 次 Date 解析
  const keyCache = new Map();

  const keysOf = (item) => {
    if (!item) {
      return keys.map(() => '');
    }
    if (keyCache.has(item)) {
      return keyCache.get(item);
    }
    const values = keys.map((key) => toComparableSortValue(item[key.field], key.field));
    keyCache.set(item, values);
    return values;
  };

  return (left, right) => {
    const aKeys = keysOf(left);
    const bKeys = keysOf(right);

    for (let index = 0; index < keys.length; index += 1) {
      const a = aKeys[index];
      const b = bKeys[index];
      if (a === b) {
        continue;
      }
      const order = a > b ? 1 : -1;
      return keys[index].descending ? -order : order;
    }
    return 0;
  };
};

/**
 * 一页是否已满 => 可能还有后续页。
 * 纯函数：列表「加载更多」的可见性由它决定（页未满即到底，绝不静默截断）。
 *
 * @param {number} pageLength 本页实际条数
 * @param {number} pageSize 请求的页大小
 * @returns {boolean}
 */
export const computeHasMore = (pageLength, pageSize) => {
  const length = Number(pageLength);
  const size = Number(pageSize);
  if (!Number.isFinite(length) || !Number.isFinite(size) || size <= 0) {
    return false;
  }
  return length >= size;
};

/**
 * 创建列表分页状态机（纯逻辑，便于单测）。
 *
 * @param {string} sortOption UI 排序 id
 * @param {number} [pageSize=DEFAULT_LIST_PAGE_SIZE]
 * @returns {{key: string, paginated: boolean, sort: Object|null, reason: string, pageSize: number, skip: number, hasMore: boolean}}
 */
export const createListPaginationState = (sortOption, pageSize = DEFAULT_LIST_PAGE_SIZE) => {
  const policy = resolveListSortPolicy(sortOption);
  const size = Number(pageSize);
  const normalizedSize = Number.isFinite(size) && size > 0 ? Math.floor(size) : DEFAULT_LIST_PAGE_SIZE;

  return {
    key: policy.key,
    paginated: policy.paginated,
    sort: policy.sort,
    reason: policy.reason,
    pageSize: normalizedSize,
    skip: 0,
    // 只有可下推排序才允许「加载更多」；不可下推排序一次性全量加载，hasMore 恒为 false
    hasMore: policy.paginated,
  };
};

/**
 * 用一页结果推进分页状态（纯函数）。
 * @param {Object} state createListPaginationState 的返回值
 * @param {number} pageLength 本页实际条数
 * @returns {Object} 新状态（skip 前进，hasMore 由「页是否满」决定）
 */
export const applyListPageResult = (state, pageLength) => {
  if (!state || !state.paginated) {
    return { ...(state || {}), skip: 0, hasMore: false };
  }
  const length = Number(pageLength);
  const safeLength = Number.isFinite(length) && length > 0 ? Math.floor(length) : 0;

  return {
    ...state,
    skip: Number(state.skip || 0) + safeLength,
    hasMore: computeHasMore(safeLength, state.pageSize),
  };
};
