/**
 * MongoDB配置
 * 包含MongoDB连接信息，仅用于本地存储
 */

// MongoDB连接信息
export const MONGODB_CONFIG = {
  // 连接URL（仅用于后端连接，前端不使用）
  URI: 'mongodb+srv://qianxin7274:zxcvbnm%40%40081325@cluster0.lo5ybvq.mongodb.net/',
  // 数据库名称
  DB_NAME: 'ZeroIsle_Notes',
  // 本地数据库名称
  LOCAL_DB_NAME: 'zeroislenotes_local',
  // 本地数据库版本
  SCHEMA_VERSION: 12,
};

// 本地存储配置
export const LOCAL_STORAGE_CONFIG = {
  // 是否加密
  ENCRYPTION_ENABLED: false,
  // 是否压缩
  COMPRESSION_ENABLED: false,
  // 最大存储大小（字节）
  MAX_SIZE: 50 * 1024 * 1024, // 50MB
};

// 导出配置
export default {
  MONGODB_CONFIG,
  LOCAL_STORAGE_CONFIG,
};
