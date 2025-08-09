/**
 * MongoDB Realm配置
 * 提供Realm数据库的配置信息
 */

// Realm应用ID，需要从MongoDB Realm控制台获取
export const REALM_APP_ID = 'zeroislenotes-app'; // 使用与configService中一致的App ID

// 使用本地存储模式，不连接MongoDB Atlas
export const USE_LOCAL_STORAGE = true; // 使用本地存储模式

// Realm数据库配置
export const REALM_CONFIG = {
  schemaVersion: 1,
  migration: (oldRealm, newRealm) => {
    // 处理架构版本迁移
    if (oldRealm.schemaVersion < 1) {
      // 执行迁移逻辑
    }
  },
  shouldCompactOnLaunch: (totalBytes, usedBytes) => {
    // 当数据库文件大小超过100MB且使用率低于50%时进行压缩
    const MB = 1024 * 1024;
    return totalBytes > 100 * MB && usedBytes / totalBytes < 0.5;
  },
};

// Realm同步配置
export const REALM_SYNC_CONFIG = {
  flexible: true,
  newRealmFileBehavior: {
    type: 'downloadBeforeOpen',
  },
  existingRealmFileBehavior: {
    type: 'openImmediately',
  },
};

// MongoDB Atlas连接信息
export const MONGODB_ATLAS_CONFIG = {
  uri: 'mongodb+srv://qianxin7274:zxcvbnm@@081325@cluster0.lo5ybvq.mongodb.net/',
  dbName: 'ZeroIsle_Notes',
};
