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
 * 注意：本入口只提供能力，不改变 HomeScreen 的现有契约。
 * HomeScreen 列表预览仍读取 item.content
 * （src/screens/common/HomeScreen.js:1848-1886 的 renderContentPreview / renderCover），
 * 而 summary 按设计不含正文；UI 全量切换前需要先补「正文预览字段」。
 *
 * @param {Object} [options]
 * @param {number} [options.skip] 跳过条数
 * @param {number} [options.limit] 单页条数（列表页应始终传入，避免整表投影）
 * @returns {Promise<Array<Object>>} summary 数组（不含 content）
 */
export const getNoteSummariesFromOfflineStorage = async (options = {}) => {
  const user = await resolveCurrentUser();
  const userId = String(user.id);
  const realm = await realmService.getRealm();

  // 归一化分页：只要显式传了 skip/limit 就按分页处理，保证 10 万条下只物化一页
  const hasPaging = options.skip !== undefined || options.limit !== undefined;
  let pageOptions = {};
  if (hasPaging) {
    const rawSkip = Number(options.skip);
    const rawLimit = Number(options.limit);
    pageOptions = {
      skip: Number.isFinite(rawSkip) && rawSkip > 0 ? Math.floor(rawSkip) : 0,
      limit: Number.isFinite(rawLimit) && rawLimit > 0 ? Math.floor(rawLimit) : RECENT_FALLBACK_LIMIT,
    };
  }

  return Note.findByUserSummaries(realm, userId, pageOptions);
};
