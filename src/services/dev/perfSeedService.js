/**
 * 10 万条笔记性能基线 —— dev-only 造数 / 清理服务（WS-R / PENDING_WORK_GUIDE 未产出项）
 *
 * 目的：让「10 万条笔记」这个性能验收前提可以在模拟器 / 真机上**可复现地**建立与撤销，
 * 供首屏计时、滚动 FPS、JS Heap 采样使用（采集步骤见 src/tests/perf/README.md 第 5 节）。
 *
 * 设计约束（与任务要求一一对应）：
 * 1. 仅 dev 可用：非 __DEV__ 构建调用一律显式抛错，绝不进生产包行为；
 * 2. realm 可注入：单测注入伪 Realm，运行时不注入则惰性取 realmService.getRealm()；
 * 3. 分批推进：每批最多 batchSize 条，既不整表物化也不一次性写全量；
 * 4. 幂等：样本 _id 确定（perf-fixture-<index>），已存在则跳过，重复执行不会越造越多；
 * 5. 只删自己造的数据：clearPerfNotes 只匹配本工具的 title / _id 前缀，绝不误删用户笔记；
 * 6. 单条失败不整体中断：整批失败降级为逐条写入/删除，失败只计数 + 告警。
 *
 * 写入字段与读取侧对齐（src/services/offline/getNotes.js）：
 * - user_id 默认走 resolveLocalOwnerId()（与首页读取同一口径，失败则写 null =
 *   读取侧同样可见的「无主」笔记）；
 * - metadata 经 withPreviewMetadata 打标（previewText / contentLength / hasContent），
 *   避免首页把它判成「未打标 summary」而整体回退全量渲染。
 */

import { withPreviewMetadata } from '../../models/utils/notePreview';
import { materializePage } from '../../models/utils/queryPagination';

/** Note schema 名（与 noteProjection / getNotes 保持一致） */
const NOTE_SCHEMA_NAME = 'Note';

/** 样本 _id 前缀：clearPerfNotes 的识别标记之一 */
export const PERF_FIXTURE_ID_PREFIX = 'perf-fixture-';

/** 样本标题前缀：clearPerfNotes 的识别标记之一（人也一眼能看出来） */
export const PERF_FIXTURE_TITLE_PREFIX = '[PERF]';

/** 样本标签：便于人工在列表里辨认（不参与删除判定，避免误伤用户同名标签） */
export const PERF_FIXTURE_TAG = 'perf-fixture';

/** 默认造数条数（10 万条是 PENDING_WORK_GUIDE 的验收规模） */
export const DEFAULT_PERF_SEED_COUNT = 100000;

/** 默认批大小：决定单次 realm.write 与单次 materialize 的上界 */
export const DEFAULT_PERF_SEED_BATCH_SIZE = 1000;

/** 造数上限：防止误传超大 count 把设备写满（超过则截断并告警） */
export const MAX_PERF_SEED_COUNT = 200000;

const LOG_PREFIX = '[perfSeed]';

/**
 * 样本类型循环：只使用「普通笔记」类型。
 *
 * 回归（首页误触「文件错误」）：HomeScreen.handleFilePress 会把
 * type === 'text' / 'markdown' / 'pdf' / 'doc(x)' / 'ppt(x)' 的条目判定为文件型，
 * 在没有 file_uri/uri 时直接弹「文件错误：路径不存在或导入失败，请删除后重新导入」。
 * 性能样本本来就不带任何文件路径字段，因此这里必须避开文件型 type，
 * 只用 note / card / canvas / paged_note 这类普通笔记类型做区分。
 */
const FIXTURE_TYPES = Object.freeze(['note', 'card', 'canvas', 'paged_note']);

/**
 * 是否处于 dev 构建。放在函数里读取，便于单测临时改写 global.__DEV__。
 * @returns {boolean}
 */
const isDevEnvironment = () => (typeof __DEV__ === 'undefined' ? false : Boolean(__DEV__));

/**
 * dev-only 守卫：非 dev 直接抛错（显式失败优于静默 no-op，避免生产构建悄悄写数据）。
 * @param {string} apiName
 */
const assertDevOnly = (apiName) => {
  if (!isDevEnvironment()) {
    throw new Error(
      `${apiName} 仅允许在开发（__DEV__）构建中使用，已阻止在生产环境读写性能测试数据。`,
    );
  }
};

/**
 * 归一化条数：undefined 用默认值；非法值直接抛错（dev 工具，早失败早发现）。
 * @param {*} value
 * @returns {number}
 */
const normalizeCount = (value) => {
  if (value === undefined || value === null) {
    return DEFAULT_PERF_SEED_COUNT;
  }
  const size = Number(value);
  if (!Number.isFinite(size) || size <= 0) {
    throw new Error(`seedPerfNotes 的 count 必须是正整数，收到: ${String(value)}`);
  }
  const floored = Math.floor(size);
  if (floored > MAX_PERF_SEED_COUNT) {
    console.warn(`${LOG_PREFIX} count=${floored} 超过上限 ${MAX_PERF_SEED_COUNT}，已截断为上限。`);
    return MAX_PERF_SEED_COUNT;
  }
  return floored;
};

/**
 * 归一化批大小：非法值回退默认值（与 backfillNotePreviewMetadata 的语义一致）。
 * @param {*} value
 * @returns {number}
 */
const normalizeBatchSize = (value) => {
  const size = Number(value);
  return Number.isFinite(size) && size > 0 ? Math.floor(size) : DEFAULT_PERF_SEED_BATCH_SIZE;
};

/**
 * 解析 Realm 实例：优先注入值，未注入时才惰性加载 realmService。
 * @param {Object} [injectedRealm]
 * @returns {Promise<Object>}
 */
const resolveRealm = async (injectedRealm) => {
  if (injectedRealm) {
    return injectedRealm;
  }
  const realmModule = require('../database/realmService');
  const realmService = realmModule.default || realmModule;
  return realmService.getRealm();
};

/**
 * 校验 Realm 具备本服务需要的最小能力面。
 * @param {Object} realm
 * @param {string} apiName
 */
const assertUsableRealm = (realm, apiName) => {
  if (!realm || typeof realm.objects !== 'function' || typeof realm.write !== 'function') {
    throw new Error(`${apiName} 需要有效的 Realm 实例（至少提供 objects/write 方法）`);
  }
};

/**
 * 解析样本的 user_id：与首页读取侧同一口径（resolveLocalOwnerId），保证读写一致。
 * 解析失败返回 null（读取侧同样可见的「无主」笔记），不阻断造数。
 * @param {string|null|undefined} injectedUserId
 * @returns {Promise<string|null>}
 */
const resolveSeedUserId = async (injectedUserId) => {
  if (injectedUserId !== undefined) {
    return injectedUserId === null ? null : String(injectedUserId);
  }

  try {
    const getNotesModule = require('../offline/getNotes');
    const ownerId = await getNotesModule.resolveLocalOwnerId();
    return ownerId === null || ownerId === undefined ? null : String(ownerId);
  } catch (error) {
    console.warn(
      `${LOG_PREFIX} 无法解析当前用户，样本将以无主（user_id=null）写入，读取侧同样可见:`,
      (error && error.message) || error,
    );
    return null;
  }
};

/**
 * 构造一条性能样本（纯函数，便于断言字段形态）。
 * @param {Object} params
 * @param {number} params.index 样本序号（0 起）
 * @param {string|null} params.userId 写入的 user_id
 * @param {number} params.baseTime 基准时间戳（updated_at 从这里递减）
 * @returns {Object} 可直接交给 realm.create 的 Note payload
 */
export const buildPerfFixtureNote = ({ index, userId, baseTime }) => {
  const id = `${PERF_FIXTURE_ID_PREFIX}${index}`;
  // 正文有长短差异：每 10 条一条长文、每 3 条一条中等，其余短句
  const repeat = index % 10 === 0 ? 20 : index % 3 === 0 ? 5 : 1;
  const content = `${'性能样本正文。'.repeat(repeat)}#${index}`;
  const updatedAt = new Date(baseTime - index * 1000);

  return withPreviewMetadata({
    _id: id,
    id,
    title: `${PERF_FIXTURE_TITLE_PREFIX} 性能样本 #${index}`,
    content,
    type: FIXTURE_TYPES[index % FIXTURE_TYPES.length],
    tags: [PERF_FIXTURE_TAG],
    user_id: userId,
    category_id: null,
    is_deleted: false,
    is_archived: false,
    is_pinned: false,
    is_locked: false,
    is_synced: false,
    created_at: updatedAt,
    updated_at: updatedAt,
    metadata: JSON.stringify({ perfFixture: true, perfFixtureIndex: index, perfSeed: true }),
  });
};

/**
 * 判断样本是否已存在（主键幂等检查）。
 * @param {Object} realm
 * @param {string} id
 * @returns {boolean}
 */
const fixtureExists = (realm, id) => {
  if (typeof realm.objectForPrimaryKey !== 'function') {
    return false;
  }
  try {
    return Boolean(realm.objectForPrimaryKey(NOTE_SCHEMA_NAME, id));
  } catch (error) {
    return false;
  }
};

/**
 * 安全触发进度回调：回调异常不影响造数/清理流程。
 * @param {Function} onProgress
 * @param {Object} payload
 */
const notifyProgress = (onProgress, payload) => {
  if (typeof onProgress !== 'function') {
    return;
  }
  try {
    onProgress(payload);
  } catch (error) {
    console.warn(`${LOG_PREFIX} onProgress 回调异常，已忽略:`, (error && error.message) || error);
  }
};

/**
 * 写入一批样本：
 * - 先按主键过滤已存在记录（幂等），再整批 realm.write；
 * - 整批失败时降级为逐条写入，单条失败只计数不中断。
 * @param {Object} realm
 * @param {Array<Object>} records
 * @param {Object} stats
 */
const persistBatch = (realm, records, stats) => {
  const pending = [];
  records.forEach((record) => {
    if (fixtureExists(realm, record._id)) {
      stats.skipped += 1;
      return;
    }
    pending.push(record);
  });

  if (pending.length === 0) {
    return;
  }

  try {
    realm.write(() => {
      pending.forEach((record) => {
        realm.create(NOTE_SCHEMA_NAME, record, 'modified');
      });
    });
    stats.created += pending.length;
  } catch (batchError) {
    console.warn(
      `${LOG_PREFIX} 批量写入失败，降级为逐条写入:`,
      (batchError && batchError.message) || batchError,
    );
    pending.forEach((record) => {
      try {
        realm.write(() => {
          realm.create(NOTE_SCHEMA_NAME, record, 'modified');
        });
        stats.created += 1;
      } catch (recordError) {
        stats.failed += 1;
        console.warn(
          `${LOG_PREFIX} 单条样本写入失败，已跳过: ${record._id}`,
          (recordError && recordError.message) || recordError,
        );
      }
    });
  }
};

/**
 * 分批生成 10 万条性能样本（dev-only，幂等）。
 *
 * @param {Object} [options]
 * @param {number} [options.count=100000] 目标样本总数
 * @param {number} [options.batchSize=1000] 单批条数（单次 write / materialize 上界）
 * @param {Object} [options.realm] 注入的 Realm 实例（缺省时用 realmService.getRealm()）
 * @param {string|null} [options.userId] 注入的 owner id（缺省时用读取侧同一口径解析）
 * @param {number} [options.baseTime] updated_at 基准时间戳（便于确定性单测）
 * @param {Function} [options.onProgress] 每批结束回调 (stats) => void
 * @returns {Promise<{created:number, deleted:number, failed:number, skipped:number, batches:number, elapsedMs:number}>}
 */
export const seedPerfNotes = async (options = {}) => {
  assertDevOnly('seedPerfNotes');

  const {
    count,
    batchSize,
    realm: injectedRealm,
    userId: injectedUserId,
    baseTime,
    onProgress,
  } = options;

  const total = normalizeCount(count);
  const size = normalizeBatchSize(batchSize);
  const startedAt = Date.now();
  const stats = { created: 0, deleted: 0, failed: 0, skipped: 0, batches: 0, elapsedMs: 0 };

  const realm = await resolveRealm(injectedRealm);
  assertUsableRealm(realm, 'seedPerfNotes');
  const userId = await resolveSeedUserId(injectedUserId);
  const base = Number.isFinite(Number(baseTime)) ? Number(baseTime) : startedAt;

  for (let offset = 0; offset < total; offset += size) {
    const end = Math.min(offset + size, total);
    const batch = [];
    for (let index = offset; index < end; index += 1) {
      batch.push(buildPerfFixtureNote({ index, userId, baseTime: base }));
    }

    stats.batches += 1;
    persistBatch(realm, batch, stats);
    notifyProgress(onProgress, { ...stats, total, processed: end });
  }

  stats.elapsedMs = Date.now() - startedAt;
  return stats;
};

/**
 * 分批清除本工具生成的性能样本（dev-only，只删带识别标记的记录）。
 *
 * 识别标记：title 以 `[PERF]` 开头 **或** _id 以 `perf-fixture-` 开头；
 * 两个条件任一命中才删除，绝不会碰到用户笔记。
 *
 * @param {Object} [options]
 * @param {Object} [options.realm] 注入的 Realm 实例（缺省时用 realmService.getRealm()）
 * @param {number} [options.batchSize=1000] 单批条数（单次 materialize / delete 上界）
 * @param {Function} [options.onProgress] 每批结束回调 (stats) => void
 * @returns {Promise<{created:number, deleted:number, failed:number, skipped:number, batches:number, elapsedMs:number}>}
 */
export const clearPerfNotes = async (options = {}) => {
  assertDevOnly('clearPerfNotes');

  const { realm: injectedRealm, batchSize, onProgress } = options;
  const size = normalizeBatchSize(batchSize);
  const startedAt = Date.now();
  const stats = { created: 0, deleted: 0, failed: 0, skipped: 0, batches: 0, elapsedMs: 0 };

  const realm = await resolveRealm(injectedRealm);
  assertUsableRealm(realm, 'clearPerfNotes');

  const fixtureQuery = 'title BEGINSWITH $0 OR _id BEGINSWITH $1';
  const results = realm
    .objects(NOTE_SCHEMA_NAME)
    .filtered(fixtureQuery, PERF_FIXTURE_TITLE_PREFIX, PERF_FIXTURE_ID_PREFIX);

  const total = results && typeof results.length === 'number' ? results.length : 0;

  // 始终取「第一页」并立即删除：删除后集合收缩，不需要（也不能）用 skip 推进。
  // 每轮最多 materialize batchSize 条，绝不整表物化。
  for (;;) {
    const batch = materializePage(results, { skip: 0, limit: size });
    if (!batch || batch.length === 0) {
      break;
    }

    stats.batches += 1;
    const deletedBefore = stats.deleted;

    batch.forEach((note) => {
      try {
        realm.write(() => {
          realm.delete(note);
        });
        stats.deleted += 1;
      } catch (error) {
        stats.failed += 1;
        console.warn(
          `${LOG_PREFIX} 单条样本删除失败，已跳过: ${note && note._id}`,
          (error && error.message) || error,
        );
      }
    });

    notifyProgress(onProgress, { ...stats, total, processed: stats.deleted + stats.failed });

    if (stats.deleted === deletedBefore) {
      // 本批一条都没删掉（全部失败）：集合头部不会前进，继续循环会死锁，直接停止并告警
      console.warn(`${LOG_PREFIX} 本批样本全部删除失败，停止清理以避免死循环。`);
      break;
    }
    if (batch.length < size) {
      break;
    }
  }

  stats.elapsedMs = Date.now() - startedAt;
  return stats;
};

export default {
  DEFAULT_PERF_SEED_COUNT,
  DEFAULT_PERF_SEED_BATCH_SIZE,
  MAX_PERF_SEED_COUNT,
  PERF_FIXTURE_ID_PREFIX,
  PERF_FIXTURE_TITLE_PREFIX,
  PERF_FIXTURE_TAG,
  buildPerfFixtureNote,
  seedPerfNotes,
  clearPerfNotes,
};
