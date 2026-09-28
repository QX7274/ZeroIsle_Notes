/**
 * 缓存写入元数据构建
 *
 * 负责从文件/附件记录（如路由参数携带的文件记录）中提取「实际可得」的校验字段，
 * 组装为 downloadCacheService.saveToCache 的 metadata。
 *
 * 约定：字段缺失或格式非法时一律不写入，保持「可选校验」语义 —— 缺字段绝不导致写入失败。
 */

const SHA256_PATTERN = /^[a-f0-9]{64}$/;

/**
 * 读取首个合法的 sha256（64 位十六进制，兼容大小写与首尾空白）
 * @param {Object} record 文件/附件记录
 * @returns {string|undefined} 归一化后的小写 sha256
 */
const pickSha256 = (record) => {
  if (!record) {
    return undefined;
  }

  const candidates = [record.sha256, record.hash, record.checksum];
  for (const candidate of candidates) {
    if (typeof candidate !== 'string') {
      continue;
    }
    const normalized = candidate.trim().toLowerCase();
    if (SHA256_PATTERN.test(normalized)) {
      return normalized;
    }
  }
  return undefined;
};

/**
 * 读取记录中首个正数（>0）的大小字段
 * @param {Object} record 文件/附件记录
 * @param {string[]} fields 候选字段名（按优先级）
 * @returns {number|undefined}
 */
const pickPositiveSize = (record, fields) => {
  if (!record) {
    return undefined;
  }

  for (const field of fields) {
    const value = Number(record[field]);
    if (Number.isFinite(value) && value > 0) {
      return value;
    }
  }
  return undefined;
};

/**
 * 构建 saveToCache 的 metadata
 * @param {Object} [record] 文件/附件记录，含 sha256/size 等可选字段
 * @param {Object} [options]
 * @param {number} [options.size] 本地已就绪文件大小（字节），用于配额计算
 * @returns {Object} 仅包含可得字段的 metadata
 */
export const buildCacheSaveMetadata = (record = {}, options = {}) => {
  const metadata = {};

  // 本地文件大小：始终由调用方提供，作为配额计算依据
  const localSize = Number(options.size);
  if (Number.isFinite(localSize) && localSize >= 0) {
    metadata.size = localSize;
  }

  // 记录中声明的期望大小：用于写入后的完整性校验（取不到则不传）
  // 注意：只认可「字节」语义的字段。不要读取 record.contentLength ——
  // 笔记预览元数据里的 contentLength 是「正文字符数」，与字节数不等价（非 ASCII 时必然误判），
  // 一旦当作 expectedSize 会导致 CACHE_INTEGRITY_MISMATCH 而无法打开文件。
  const expectedSize = pickPositiveSize(record, ['expectedSize', 'fileSize', 'size']);
  if (expectedSize !== undefined) {
    metadata.expectedSize = expectedSize;
  }

  // 记录中的 sha256：用于写入后的完整性校验（取不到或格式非法则不传）
  const sha256 = pickSha256(record);
  if (sha256 !== undefined) {
    metadata.sha256 = sha256;
  }

  return metadata;
};

export default buildCacheSaveMetadata;
