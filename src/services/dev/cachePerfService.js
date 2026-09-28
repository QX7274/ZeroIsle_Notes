/**
 * 500MB 附件缓存链路 —— 设备级验证工具（WS-S，dev-only）
 *
 * 目的：为 PENDING_WORK_GUIDE 4.4「500MB 附件」中**客户端可本地验证**的部分提供可复现工具：
 * 1. 用有界分段在设备上生成指定大小的大文件（默认 512MB），单段不超过 chunkBytes（默认 4MB，
 *    上界 4MB），整个生成过程只持有一块 chunk 字符串，绝不按文件大小构造 Buffer/字符串；
 * 2. 调用 downloadCacheService.saveToCache 把该文件写入缓存（内部走 RNFS.read + writeFile/appendFile
 *    的有界分段写入），并在开始/结束各打印一条稳定可 grep 的日志，写入期间周期性打印心跳，
 *    便于外部用 dumpsys meminfo 对齐采样点；
 * 3. 纯逻辑的配额淘汰检查：验证超配额时按 LRU 淘汰到阈值内、预留余量生效、非法配置回退默认。
 *
 * 安全约束（与 perfSeedService 一致）：
 * - 非 __DEV__ 构建调用一律显式抛错，绝不进生产包行为；
 * - RNFS / downloadCacheService 均可注入，便于单测不真的写 512MB；
 * - 失败不抛未处理异常：benchmark 把 saveToCache 的失败收敛成返回值，交由调用方展示。
 */

import RNFS from 'react-native-fs';
import { selectEvictions } from '../files/cacheLruIndex';
import {
  downloadCacheService,
  resolveCacheDefaults,
} from '../files/downloadCacheService';

/** 默认测试文件大小：512MB（PENDING_WORK_GUIDE 4.4 的 500MB 量级） */
export const DEFAULT_PERF_FILE_SIZE = 512 * 1024 * 1024;

/** 默认分段大小：4MB（也是分段写入的上界） */
export const DEFAULT_PERF_FILE_CHUNK = 4 * 1024 * 1024;

/** 分段大小硬上界：任何入参都会被夹到该值以下，保证单次读写内存有界 */
export const MAX_PERF_FILE_CHUNK = 4 * 1024 * 1024;

/** 写缓存时使用的 fileId（合法字符集，缓存文件名可直接辨认） */
export const DEFAULT_PERF_CACHE_FILE_ID = 'cache-perf-512mb';

const LOG_PREFIX = '[cachePerf]';

/** 写入期间的心跳日志间隔（毫秒）：外部按这个节奏对齐 dumpsys meminfo */
const PROGRESS_INTERVAL_MS = 2000;

/** 生成文件时每多少段打印一次进度 */
const FILE_PROGRESS_EVERY_SEGMENTS = 16;

/**
 * 是否处于 dev 构建。放在函数里读取，便于单测临时改写 global.__DEV__。
 * @returns {boolean}
 */
const isDevEnvironment = () => (typeof __DEV__ === 'undefined' ? false : Boolean(__DEV__));

/**
 * dev-only 守卫：非 dev 直接抛错（显式失败优于静默 no-op）。
 * @param {string} apiName
 */
const assertDevOnly = (apiName) => {
  if (!isDevEnvironment()) {
    throw new Error(
      apiName + ' 仅允许在开发（__DEV__）构建中使用，已阻止在生产环境读写 500MB 测试文件与缓存。',
    );
  }
};

/**
 * 解析 RNFS：优先注入值，未注入时用模块默认实例。
 * @param {Object} [injected]
 * @returns {Object}
 */
const resolveRnfs = (injected) => injected || RNFS;

/**
 * 解析缓存服务：优先注入值，未注入时用全局单例。
 * @param {Object} [injected]
 * @returns {Object}
 */
const resolveCacheService = (injected) => injected || downloadCacheService;

/**
 * 归一化正整数字节数；非法值回退 fallback。
 * @param {*} value
 * @param {number} fallback
 * @returns {number}
 */
const toPositiveInt = (value, fallback) => {
  const num = Number(value);
  return Number.isFinite(num) && num > 0 ? Math.floor(num) : fallback;
};

/**
 * 读取当前进程 RSS（KB）。RN 环境可能没有 process.memoryUsage，返回 null 而不是抛错。
 * 设备侧仍以 adb shell dumpsys meminfo 为准。
 * @returns {number|null}
 */
const readRssKb = () => {
  try {
    if (typeof process !== 'undefined' && process && typeof process.memoryUsage === 'function') {
      const rss = Number(process.memoryUsage().rss);
      return Number.isFinite(rss) && rss > 0 ? Math.round(rss / 1024) : null;
    }
  } catch (error) {
    return null;
  }
  return null;
};

/**
 * 安全触发进度回调：回调异常不影响主流程。
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
    console.warn(LOG_PREFIX + ' onProgress 回调异常，已忽略:', (error && error.message) || error);
  }
};

/**
 * 默认测试文件路径：优先临时目录，其次缓存目录。
 * @param {Object} [rnfs] 可注入的 RNFS
 * @returns {string}
 */
export const getDefaultLargeFilePath = (rnfs) => {
  const fs = resolveRnfs(rnfs);
  const baseDir = (fs && (fs.TemporaryDirectoryPath || fs.CachesDirectoryPath)) || '';
  const sizeMb = Math.round(DEFAULT_PERF_FILE_SIZE / (1024 * 1024));
  return baseDir + '/cache-perf-' + sizeMb + 'mb.bin';
};

/**
 * 用有界分段生成指定大小的测试文件（dev-only）。
 *
 * 内存上界：全过程只持有一块 chunkBytes 的字符串（默认/上界 4MB），
 * 第 N 段通过 appendFile 追加，不会一次性构造整个文件的 Buffer 或字符串。
 *
 * @param {Object} [options]
 * @param {string} [options.path] 目标路径（缺省 getDefaultLargeFilePath）
 * @param {number} [options.sizeBytes=512MB] 文件大小
 * @param {number} [options.chunkBytes=4MB] 单段上界
 * @param {Function} [options.onProgress] 进度回调 ({ writtenBytes, sizeBytes, segments, elapsedMs })
 * @param {Object} [options.rnfs] 注入的 RNFS（单测用）
 * @returns {Promise<{path:string, sizeBytes:number, writtenBytes:number, segments:number, elapsedMs:number}>}
 */
export const createLargeFile = async (options = {}) => {
  assertDevOnly('createLargeFile');

  const fs = resolveRnfs(options.rnfs);
  const sizeBytes = toPositiveInt(options.sizeBytes, DEFAULT_PERF_FILE_SIZE);
  const chunkBytes = Math.min(
    toPositiveInt(options.chunkBytes, DEFAULT_PERF_FILE_CHUNK),
    MAX_PERF_FILE_CHUNK,
  );
  const targetPath = options.path || getDefaultLargeFilePath(fs);
  const startedAt = Date.now();

  console.log(
    LOG_PREFIX + ' file start path=' + targetPath + ' size=' + sizeBytes + ' chunk=' + chunkBytes,
  );

  // 内存上界：整个生成过程只持有这一块 chunkBytes 的字符串
  const chunk = 'A'.repeat(chunkBytes);

  // 覆盖写入：先清掉上次残留，避免尺寸翻倍
  try {
    if (await fs.exists(targetPath)) {
      await fs.unlink(targetPath);
    }
  } catch (error) {
    console.warn(LOG_PREFIX + ' 清理旧测试文件失败，将直接覆盖:', (error && error.message) || error);
  }

  let writtenBytes = 0;
  let segments = 0;
  while (writtenBytes < sizeBytes) {
    const length = Math.min(chunkBytes, sizeBytes - writtenBytes);
    const payload = length === chunkBytes ? chunk : chunk.slice(0, length);
    if (segments === 0) {
      await fs.writeFile(targetPath, payload, 'utf8');
    } else {
      await fs.appendFile(targetPath, payload, 'utf8');
    }
    writtenBytes += length;
    segments += 1;

    if (segments % FILE_PROGRESS_EVERY_SEGMENTS === 0 && writtenBytes < sizeBytes) {
      const elapsedMs = Date.now() - startedAt;
      console.log(
        LOG_PREFIX + ' file progress writtenBytes=' + writtenBytes + '/' + sizeBytes +
          ' segments=' + segments + ' elapsedMs=' + elapsedMs,
      );
      notifyProgress(options.onProgress, { writtenBytes, sizeBytes, segments, elapsedMs });
    }
  }

  if (segments === 0) {
    // 防御：sizeBytes 为 0 时也要落一个空文件，保证后续步骤路径可用
    await fs.writeFile(targetPath, '', 'utf8');
  }

  const elapsedMs = Date.now() - startedAt;
  console.log(
    LOG_PREFIX + ' file finish path=' + targetPath + ' size=' + sizeBytes +
      ' segments=' + segments + ' elapsedMs=' + elapsedMs,
  );

  return { path: targetPath, sizeBytes, writtenBytes, segments, elapsedMs };
};

/**
 * 把大文件写入附件缓存并收集可量化指标（dev-only）。
 *
 * 日志契约（稳定可 grep，供外部对齐 dumpsys meminfo 采样）：
 * - 开始：<LOG_PREFIX> write start ...
 * - 心跳：<LOG_PREFIX> write progress elapsedMs=... rssKb=...
 * - 结束：<LOG_PREFIX> write finish ok=true/false ... elapsedMs=...
 *
 * saveToCache 失败不抛未处理异常：收敛成 { success:false, error } 返回。
 *
 * @param {Object} [options]
 * @param {string} [options.filePath] 源文件路径（缺省 getDefaultLargeFilePath）
 * @param {number} [options.sizeBytes=512MB] 源文件大小
 * @param {string} [options.cacheDir] 临时覆盖缓存目录（结束恢复）
 * @param {number} [options.chunkWriteThreshold] 临时覆盖分段写入阈值
 * @param {number} [options.chunkWriteSize=4MB] 临时覆盖分段大小（受服务上界约束）
 * @param {string} [options.fileId] 缓存 fileId（缺省 cache-perf-512mb）
 * @param {Function} [options.onProgress] 心跳回调 ({ elapsedMs, rssKb })
 * @param {Object} [options.rnfs] 注入的 RNFS
 * @param {Object} [options.cacheService] 注入的缓存服务
 * @returns {Promise<Object>} 统计结果（含 elapsedMs / segments / writtenBytes / peakRssKb / destPath）
 */
export const runCacheWriteBenchmark = async (options = {}) => {
  assertDevOnly('runCacheWriteBenchmark');

  const fs = resolveRnfs(options.rnfs);
  const cacheService = resolveCacheService(options.cacheService);
  const fileId = options.fileId || DEFAULT_PERF_CACHE_FILE_ID;
  const sizeBytes = toPositiveInt(options.sizeBytes, DEFAULT_PERF_FILE_SIZE);
  const filePath = options.filePath || getDefaultLargeFilePath(fs);
  const chunkWriteSize = Math.min(
    toPositiveInt(options.chunkWriteSize, DEFAULT_PERF_FILE_CHUNK),
    MAX_PERF_FILE_CHUNK,
  );

  // 临时覆盖服务配置（只覆盖显式传入的项，不动服务默认语义）
  const configurePayload = { chunkWriteSize };
  if (Number.isFinite(Number(options.chunkWriteThreshold)) && Number(options.chunkWriteThreshold) > 0) {
    configurePayload.chunkWriteThreshold = Math.floor(Number(options.chunkWriteThreshold));
  }
  if (typeof cacheService.configure === 'function') {
    cacheService.configure(configurePayload);
  }

  const previousCacheDir = cacheService.CACHE_DIR;
  if (options.cacheDir) {
    cacheService.CACHE_DIR = options.cacheDir;
  }

  const effectiveChunk = Math.min(
    toPositiveInt(cacheService.CHUNK_WRITE_SIZE, chunkWriteSize),
    toPositiveInt(cacheService.MAX_CHUNK_WRITE_SIZE, MAX_PERF_FILE_CHUNK),
  );
  const effectiveThreshold = toPositiveInt(cacheService.CHUNK_WRITE_THRESHOLD, chunkWriteSize);
  // 分段数是按「配置的分段大小」推算的上界（服务内部按同样规则切段）
  const segments = sizeBytes >= effectiveThreshold ? Math.max(1, Math.ceil(sizeBytes / effectiveChunk)) : 1;

  const startedAt = Date.now();
  let peakRssKb = readRssKb();

  console.log(
    LOG_PREFIX + ' write start fileId=' + fileId + ' size=' + sizeBytes +
      ' chunkWriteSize=' + effectiveChunk + ' threshold=' + effectiveThreshold +
      ' segments=' + segments + ' source=' + filePath,
  );

  // 写入期间的心跳：外部按这个节奏采 dumpsys meminfo
  const heartbeat = setInterval(() => {
    const rssKb = readRssKb();
    if (rssKb !== null) {
      peakRssKb = peakRssKb === null ? rssKb : Math.max(peakRssKb, rssKb);
    }
    const elapsedMs = Date.now() - startedAt;
    console.log(
      LOG_PREFIX + ' write progress elapsedMs=' + elapsedMs +
        ' rssKb=' + (rssKb === null ? 'n/a' : rssKb),
    );
    notifyProgress(options.onProgress, { elapsedMs, rssKb });
  }, PROGRESS_INTERVAL_MS);

  try {
    const destPath = await cacheService.saveToCache(fileId, filePath, { size: sizeBytes });
    const elapsedMs = Date.now() - startedAt;
    console.log(
      LOG_PREFIX + ' write finish ok=true size=' + sizeBytes + ' elapsedMs=' + elapsedMs +
        ' segments=' + segments + ' writtenBytes=' + sizeBytes +
        ' peakRssKb=' + (peakRssKb === null ? 'n/a' : peakRssKb) + ' dest=' + destPath,
    );
    return {
      success: true,
      fileId,
      sourcePath: filePath,
      destPath,
      sizeBytes,
      writtenBytes: sizeBytes,
      segments,
      chunkWriteSize: effectiveChunk,
      chunkWriteThreshold: effectiveThreshold,
      elapsedMs,
      peakRssKb,
    };
  } catch (error) {
    const elapsedMs = Date.now() - startedAt;
    const message = (error && error.message) || String(error);
    console.log(
      LOG_PREFIX + ' write finish ok=false size=' + sizeBytes + ' elapsedMs=' + elapsedMs +
        ' segments=' + segments + ' error=' + message,
    );
    console.warn(LOG_PREFIX + ' 缓存写入失败:', message);
    return {
      success: false,
      fileId,
      sourcePath: filePath,
      sizeBytes,
      writtenBytes: 0,
      segments,
      chunkWriteSize: effectiveChunk,
      chunkWriteThreshold: effectiveThreshold,
      elapsedMs,
      peakRssKb,
      error: message,
    };
  } finally {
    clearInterval(heartbeat);
    if (options.cacheDir) {
      cacheService.CACHE_DIR = previousCacheDir;
    }
  }
};

/**
 * 纯逻辑的配额淘汰检查：不触碰 Realm/RNFS，便于断言。
 *
 * 语义与 downloadCacheService._enforceLRU 一致：
 * 预算 = maxCacheSize - reserveBytes，按最久未访问优先淘汰，直到
 * 剩余占用 + incomingBytes 落入预算；预留余量必须生效；非法配置回退默认。
 *
 * @param {Object} [options]
 * @param {Array<{key:string,size:number,lastAccessedAt:*}>} [options.entries] 现有缓存条目
 * @param {number} [options.incomingBytes=0] 即将写入的大小
 * @param {number} [options.maxCacheSize] 配额上限（非法值回退默认/服务现值）
 * @param {number} [options.reserveRatio] 预留比例（非法值回退默认/服务现值）
 * @param {Object} [options.cacheConfig] 自定义 CACHE_CONFIG（用于验证「非法配置回退默认」）
 * @param {Object} [options.cacheService] 注入的缓存服务（读取其现值）
 * @returns {Object} 淘汰结果与占用统计
 */
export const runQuotaEvictionCheck = (options = {}) => {
  assertDevOnly('runQuotaEvictionCheck');

  const cacheService = options.cacheService;
  const defaults = resolveCacheDefaults(options.cacheConfig);

  const rawMax = Number(options.maxCacheSize);
  const maxCacheSize = Number.isFinite(rawMax) && rawMax > 0
    ? Math.floor(rawMax)
    : (cacheService && Number.isFinite(Number(cacheService.MAX_CACHE_SIZE))
      ? Math.floor(Number(cacheService.MAX_CACHE_SIZE))
      : defaults.maxCacheSize);

  const rawRatio = Number(options.reserveRatio);
  const reserveRatio = Number.isFinite(rawRatio) && rawRatio >= 0 && rawRatio < 1
    ? rawRatio
    : (cacheService && Number.isFinite(Number(cacheService.RESERVE_RATIO))
      ? Number(cacheService.RESERVE_RATIO)
      : defaults.reserveRatio);

  const reserveBytes = Math.floor(maxCacheSize * reserveRatio);
  const budgetBytes = Math.max(0, maxCacheSize - reserveBytes);
  const entries = Array.isArray(options.entries) ? options.entries.filter(Boolean) : [];
  const incomingBytes = toPositiveInt(options.incomingBytes, 0);

  const sizeOf = (entry) => {
    const size = Number(entry && entry.size);
    return Number.isFinite(size) && size > 0 ? Math.floor(size) : 0;
  };

  const totalBefore = entries.reduce((sum, entry) => sum + sizeOf(entry), 0);
  const evictedKeys = selectEvictions(entries, {
    maxBytes: maxCacheSize,
    incomingBytes,
    reserveBytes,
  });

  const byKey = new Map(entries.map((entry) => [String(entry && entry.key), entry]));
  const evictions = evictedKeys.map((key) => {
    const entry = byKey.get(key);
    return {
      key,
      size: sizeOf(entry),
      lastAccessedAt: entry ? entry.lastAccessedAt : undefined,
    };
  });
  const evictedBytes = evictions.reduce((sum, item) => sum + item.size, 0);
  const totalAfter = Math.max(0, totalBefore - evictedBytes);

  return {
    maxCacheSize,
    reserveRatio,
    reserveBytes,
    budgetBytes,
    incomingBytes,
    totalBefore,
    evictedBytes,
    evictedCount: evictions.length,
    totalAfter,
    evictions,
    withinBudget: totalAfter + incomingBytes <= budgetBytes,
  };
};

/**
 * 删除测试大文件并返回是否成功（dev-only、幂等）。
 *
 * 幂等语义：文件本来就不存在时同样返回 true（目标状态已达成）。
 *
 * @param {string} [path] 目标路径（缺省 getDefaultLargeFilePath）
 * @param {Object} [options]
 * @param {Object} [options.rnfs] 注入的 RNFS
 * @returns {Promise<boolean>} 调用后文件是否已不存在
 */
export const cleanupLargeFile = async (path, options = {}) => {
  assertDevOnly('cleanupLargeFile');

  const fs = resolveRnfs(options.rnfs);
  const targetPath = path || getDefaultLargeFilePath(fs);
  let removed = false;

  try {
    if (await fs.exists(targetPath)) {
      await fs.unlink(targetPath);
      removed = true;
    }
    const stillExists = await fs.exists(targetPath);
    console.log(
      LOG_PREFIX + ' cleanup path=' + targetPath + ' removed=' + removed + ' exists=' + stillExists,
    );
    return !stillExists;
  } catch (error) {
    console.warn(LOG_PREFIX + ' 清理测试文件失败:', (error && error.message) || error);
    return false;
  }
};

export default {
  DEFAULT_PERF_FILE_SIZE,
  DEFAULT_PERF_FILE_CHUNK,
  MAX_PERF_FILE_CHUNK,
  DEFAULT_PERF_CACHE_FILE_ID,
  getDefaultLargeFilePath,
  createLargeFile,
  runCacheWriteBenchmark,
  runQuotaEvictionCheck,
  cleanupLargeFile,
};
