/**
 * 存量笔记「列表预览元数据」回填（里程碑 5.1 收尾）
 *
 * 背景：列表轻量投影（noteProjection.toNoteSummary）只从 metadata 读取
 * previewText / contentLength / hasPages / hasStrokeData；写入侧打标（notesApi）上线前
 * 创建的存量笔记没有这些键，HomeScreen 的「未打标保护」会因此整体回退到全量查询，
 * 轻量列表路径无法生效。本模块提供一次性的、可重复执行的回填能力：
 *
 * 1. 按批（默认 200 条）推进 Realm Results，绝不一次性把整表读进内存；
 * 2. 只处理 metadata 缺少 previewText / contentLength 的笔记（未打标）；
 * 3. 已打标的笔记直接跳过 —— 幂等，可反复执行；
 * 4. 单条失败只计数 + 告警，不中断整体；
 * 5. realm 可注入，便于 Jest 单测（避免硬依赖原生 Realm）。
 *
 * 纯逻辑（判定 + 生成新 metadata）单独导出，便于确定性单测。
 */

import { buildNotePreview, mergePreviewMetadata } from '../../models/utils/notePreview';
import { materializePage } from '../../models/utils/queryPagination';

/** 默认单批条数 */
export const DEFAULT_BACKFILL_BATCH_SIZE = 200;

/** Note schema 名（与 noteProjection / notesApi 保持一致） */
const NOTE_SCHEMA_NAME = 'Note';

const LOG_PREFIX = '[notePreviewBackfill]';

/**
 * 归一化批大小：非正数 / 非法值回退默认值
 * @param {*} value
 * @returns {number}
 */
const normalizeBatchSize = (value) => {
  const size = Number(value);
  return Number.isFinite(size) && size > 0 ? Math.floor(size) : DEFAULT_BACKFILL_BATCH_SIZE;
};

/**
 * 解析 metadata 为普通对象；坏 JSON / 非对象一律返回 null（不抛错）
 * @param {*} metadata
 * @returns {Object|null}
 */
const parseMetadataObject = (metadata) => {
  if (metadata && typeof metadata === 'object' && !Array.isArray(metadata)) {
    return metadata;
  }
  if (typeof metadata !== 'string' || metadata === '') {
    return null;
  }
  try {
    const parsed = JSON.parse(metadata);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null;
  } catch (error) {
    return null;
  }
};

/**
 * metadata 是否缺少预览元数据（未打标）。
 *
 * 打标约定：buildNotePreview 一定同时产出 previewText（字符串）与 contentLength（数字），
 * 因此「两者缺一」即视为未打标 —— 只认这两个键，避免把历史 contentLength 之类的脏键误判为已打标。
 *
 * @param {*} metadata Realm Note.metadata（JSON 字符串 / 对象 / null）
 * @returns {boolean}
 */
export const isPreviewMetadataMissing = (metadata) => {
  const parsed = parseMetadataObject(metadata);
  if (!parsed) {
    return true;
  }
  const hasPreviewText = typeof parsed.previewText === 'string';
  const rawLength = parsed.contentLength;
  const hasContentLength = rawLength !== null
    && rawLength !== undefined
    && Number.isFinite(Number(rawLength));
  return !(hasPreviewText && hasContentLength);
};

/**
 * 生成回填后的 metadata JSON 字符串（纯函数）。
 *
 * 返回 null 表示「无需回填」：note 为空，或已打标（幂等跳过）。
 * 只读取传入 note 的 content / pages / strokeData 原值，不做任何额外查询。
 *
 * @param {Object} note Realm Note 或普通对象（需含 metadata / content / pages / strokeData）
 * @returns {string|null}
 */
export const buildBackfillMetadata = (note) => {
  if (!note || !isPreviewMetadataMissing(note.metadata)) {
    return null;
  }
  return mergePreviewMetadata(note.metadata, buildNotePreview({
    content: note.content,
    pages: note.pages,
    strokeData: note.strokeData,
  }));
};

/**
 * 解析 Realm 实例：优先使用注入值；未注入时才惰性加载 realmService
 * （单测注入 realm 时不会触碰原生 Realm 依赖）。
 * @param {Object} [injectedRealm]
 * @returns {Promise<Object>}
 */
const resolveRealm = async (injectedRealm) => {
  if (injectedRealm) {
    return injectedRealm;
  }
  const realmService = require('../database/realmService').default;
  return realmService.getRealm();
};

/**
 * 回填存量笔记的列表预览元数据。
 *
 * @param {Object} [options]
 * @param {Object} [options.realm] 注入的 Realm 实例（缺省时用 realmService.getRealm()）
 * @param {number} [options.batchSize=200] 单批条数（决定单次 materialize 的上界）
 * @param {Function} [options.onProgress] 每批结束回调 (stats) => void
 * @returns {Promise<{scanned: number, updated: number, failed: number, batches: number}>}
 */
export const backfillNotePreviewMetadata = async (options = {}) => {
  const { realm: injectedRealm, batchSize, onProgress } = options;
  const stats = { scanned: 0, updated: 0, failed: 0, batches: 0 };

  const realm = await resolveRealm(injectedRealm);
  if (!realm || typeof realm.objects !== 'function' || typeof realm.write !== 'function') {
    throw new Error('backfillNotePreviewMetadata 需要有效的 Realm 实例（objects/write）');
  }
  const size = normalizeBatchSize(batchSize);

  const results = realm.objects(NOTE_SCHEMA_NAME);

  // 主键稳定排序：offset 分批推进时顺序确定；Results 仍是惰性集合，
  // materializePage 每次只 slice 当前批次，不会整表物化（RISK-PERF-002）。
  let ordered = results;
  if (results && typeof results.sorted === 'function') {
    try {
      ordered = results.sorted('_id');
    } catch (sortError) {
      console.warn(`${LOG_PREFIX} 按 _id 排序失败，退回未排序结果:`, (sortError && sortError.message) || sortError);
      ordered = results;
    }
  }
  const total = ordered && typeof ordered.length === 'number' ? ordered.length : Infinity;

  let offset = 0;
  for (;;) {
    const batch = materializePage(ordered, { skip: offset, limit: size });
    if (!batch || batch.length === 0) {
      break;
    }

    stats.batches += 1;
    offset += batch.length;

    for (let i = 0; i < batch.length; i += 1) {
      const note = batch[i];
      stats.scanned += 1;
      try {
        const nextMetadata = buildBackfillMetadata(note);
        if (nextMetadata === null) {
          // 已打标：幂等跳过
          continue;
        }
        realm.write(() => {
          note.metadata = nextMetadata;
        });
        stats.updated += 1;
      } catch (error) {
        // 单条失败不中断整体：计数 + 告警，继续下一条
        stats.failed += 1;
        console.warn(`${LOG_PREFIX} 单条回填失败，已跳过:`, (error && error.message) || error);
      }
    }

    if (typeof onProgress === 'function') {
      try {
        onProgress({ ...stats });
      } catch (progressError) {
        console.warn(`${LOG_PREFIX} onProgress 回调异常，已忽略:`, (progressError && progressError.message) || progressError);
      }
    }

    if (batch.length < size) {
      break;
    }
    if (Number.isFinite(total) && offset >= total) {
      break;
    }
  }

  return stats;
};

// ---------------------------------------------------------------------------
// 未打标自愈调度（里程碑 5.1 收尾）
//
// 背景：列表侧检测到「未打标 summary」时会回退 getAllNotes() 保证渲染不回归，
// 但只要还有直写 Realm、不打标的入口（CardNoteScreen / SaveButton / PDFViewer 等），
// 新建一条笔记就会让列表长期停留在全量路径。这里把「保护」升级为「自愈」：
// 检测到未打标 -> 后台幂等回填一次 -> updated > 0 时重载一次列表切回轻量路径。
//
// 约束（全部由本控制器保证）：
// 1. in-flight 去重：同一时刻最多一个回填在跑；
// 2. 会话级尝试上限：每个控制器实例（= 一次应用会话）最多尝试 maxAttempts 次，防循环；
// 3. 失败只记日志并返回结果对象，绝不抛错给调用方（用户操作不受影响）；
// 4. reload 只触发一次，且不再被本次调用链重复触发。
//
// 依赖（backfill / reload / isCancelled / logger）全部可注入，便于确定性单测。
// ---------------------------------------------------------------------------

/** 会话内自愈回填的最大尝试次数（默认 1 次：够用且天然防循环） */
export const DEFAULT_SELF_HEAL_MAX_ATTEMPTS = 1;

/**
 * 给「未打标回退」的结果打上自愈标记（列表侧 loadNotesListPayload 使用）。
 *
 * 只在 Promise 决议后附加标记，不改动原调用的次数与错误语义：
 * 原 Promise reject 时依然原样 reject，由调用方既有 catch 处理。
 *
 * @param {Promise<Object>} payloadPromise 例如 notesApi.getAllNotes() 的返回值
 * @param {number} [untaggedCount=0] 未打标条目数（仅用于日志/诊断）
 * @returns {Promise<Object>}
 */
export const withPreviewSelfHealFlag = (payloadPromise, untaggedCount = 0) => payloadPromise.then((payload) => (
  payload && typeof payload === 'object'
    ? { ...payload, needsPreviewSelfHeal: true, untaggedCount }
    : payload
));

/**
 * 创建「未打标自愈」调度器。
 *
 * @param {Object} [options]
 * @param {Function} [options.backfill] 回填函数，返回 { scanned, updated, failed, batches }
 * @param {Function} [options.reload] updated > 0 时调用的重载函数（可为 async）
 * @param {number} [options.maxAttempts=1] 会话级尝试上限
 * @param {Function} [options.isCancelled] 取消判定（例如组件已卸载）=> boolean
 * @param {Object} [options.logger=console] 日志实现，需有 log/warn
 * @returns {{handleUntagged: Function, getAttempts: Function, isInFlight: Function}}
 */
export const createPreviewSelfHealController = (options = {}) => {
  const {
    backfill = backfillNotePreviewMetadata,
    reload = null,
    maxAttempts = DEFAULT_SELF_HEAL_MAX_ATTEMPTS,
    isCancelled = () => false,
    logger = console,
  } = options;

  const attemptLimit = Number.isFinite(Number(maxAttempts)) && Number(maxAttempts) > 0
    ? Math.floor(Number(maxAttempts))
    : DEFAULT_SELF_HEAL_MAX_ATTEMPTS;
  const log = (message, ...rest) => {
    if (logger && typeof logger.log === 'function') { logger.log(message, ...rest); }
  };
  const warn = (message, ...rest) => {
    if (logger && typeof logger.warn === 'function') { logger.warn(message, ...rest); }
  };

  let attempts = 0;
  let inFlight = false;

  /**
   * 处理一次「检测到未打标」。
   * 任何情况下都不抛错；返回结果说明本次是否触发/是否重载及原因。
   *
   * @param {string} [context] 触发上下文（仅用于日志）
   * @returns {Promise<{triggered: boolean, updated: number, reloaded: boolean, reason: string}>}
   */
  const handleUntagged = async (context = '') => {
    const reasonSuffix = context ? `（${context}）` : '';

    if (isCancelled()) {
      return { triggered: false, updated: 0, reloaded: false, reason: 'cancelled' };
    }
    if (inFlight) {
      return { triggered: false, updated: 0, reloaded: false, reason: 'in-flight' };
    }
    if (attempts >= attemptLimit) {
      return { triggered: false, updated: 0, reloaded: false, reason: 'attempts-exhausted' };
    }

    attempts += 1;
    inFlight = true;
    try {
      log(`[previewSelfHeal] 检测到未打标列表${reasonSuffix}，开始后台幂等回填（第 ${attempts}/${attemptLimit} 次）`);
      const stats = await backfill();
      const updated = Number(stats && stats.updated) || 0;

      if (isCancelled()) {
        // 回填期间组件已卸载：不回写任何状态，也不再重载
        return { triggered: true, updated, reloaded: false, reason: 'cancelled' };
      }

      if (updated > 0 && typeof reload === 'function') {
        log(`[previewSelfHeal] 回填完成：更新 ${updated} 条，触发一次列表重载`);
        try {
          const maybePromise = reload();
          if (maybePromise && typeof maybePromise.catch === 'function') {
            maybePromise.catch((reloadError) => {
              warn('[previewSelfHeal] 列表重载失败，已忽略:', (reloadError && reloadError.message) || reloadError);
            });
          }
        } catch (reloadError) {
          warn('[previewSelfHeal] 列表重载失败，已忽略:', (reloadError && reloadError.message) || reloadError);
          return { triggered: true, updated, reloaded: false, reason: 'reload-failed' };
        }
        return { triggered: true, updated, reloaded: true, reason: 'reloaded' };
      }

      if (updated > 0) {
        return { triggered: true, updated, reloaded: false, reason: 'reload-skipped' };
      }

      log('[previewSelfHeal] 本次回填未更新任何条目，保持当前渲染');
      return { triggered: true, updated, reloaded: false, reason: 'nothing-updated' };
    } catch (error) {
      warn('[previewSelfHeal] 后台回填失败，已忽略（保持当前渲染）:', (error && error.message) || error);
      return { triggered: true, updated: 0, reloaded: false, reason: 'failed' };
    } finally {
      inFlight = false;
    }
  };

  return {
    handleUntagged,
    getAttempts: () => attempts,
    isInFlight: () => inFlight,
  };
};

export default {
  DEFAULT_BACKFILL_BATCH_SIZE,
  DEFAULT_SELF_HEAL_MAX_ATTEMPTS,
  isPreviewMetadataMissing,
  buildBackfillMetadata,
  backfillNotePreviewMetadata,
  withPreviewSelfHealFlag,
  createPreviewSelfHealController,
};
