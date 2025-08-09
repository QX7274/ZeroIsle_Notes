/**
 * Realm数据库配置
 */

import Realm from 'realm';
import { getAllSchemas } from './realmModels';
// 导入MongoDB配置
import { MONGODB_CONFIG as DB_CONFIG } from '../../config/mongodbConfig';
// 导入Realm配置
import { REALM_APP_ID, USE_LOCAL_STORAGE } from '../../config/realmConfig';

// MongoDB配置
export const MONGODB_CONFIG = {
  // 数据库名称
  dbName: DB_CONFIG.LOCAL_DB_NAME || 'zeroislenotes_local',
  // 模式版本
  schemaVersion: DB_CONFIG.SCHEMA_VERSION || 1,
};

/**
 * 获取Realm配置
 * @param {Object} options 选项
 * @returns {Object} Realm配置
 */
export const getRealmConfig = () => {
  // 基本配置 - 不使用同步功能
  const config = {
    schema: getAllSchemas(),
    schemaVersion: 4, // 增加版本号，因为我们更新了模型定义
    path: `${MONGODB_CONFIG.dbName}.realm`,
    deleteRealmIfMigrationNeeded: true, // 如果迁移失败，删除旧的Realm文件并创建新的
    migration: (oldRealm, newRealm) => {
      // 处理架构迁移
      console.info('执行Realm架构迁移', {
        oldVersion: oldRealm.schemaVersion,
        newVersion: newRealm.schemaVersion
      });

      // 迁移逻辑
      if (oldRealm.schemaVersion < 2) {
        // 从版本1迁移到版本2
        console.info('从版本1迁移到版本2');

        // 这里可以添加数据迁移逻辑
        // 例如：添加新字段的默认值，转换数据格式等
      }

      if (oldRealm.schemaVersion < 3) {
        // 从版本2迁移到版本3
        console.info('从版本2迁移到版本3 - 将_id字段从ObjectId类型改为字符串类型');

        // 由于我们将_id字段从ObjectId类型改为字符串类型，
        // 这里不需要特殊的迁移逻辑，因为ObjectId可以自动转换为字符串
      }

      if (oldRealm.schemaVersion < 4) {
        // 从版本3迁移到版本4
        console.info('从版本3迁移到版本4 - 处理主键添加问题');

        // 由于主键添加问题，我们使用deleteRealmIfMigrationNeeded选项
        // 这将删除旧的Realm文件并创建新的，而不是尝试迁移数据
        // 这意味着所有本地数据将被重置，但这是最简单的解决方案
        console.info('使用deleteRealmIfMigrationNeeded选项，将删除旧的Realm文件并创建新的');
      }
    },
  };

  return config;
};

/**
 * 打开Realm数据库 * @returns {Promise<Realm>} Realm实例
 */
export const openRealm = async () => {
  try {
    const config = getRealmConfig();
    return await Realm.open(config);
  } catch (error) {
    console.error('打开Realm数据库失败', error);
    throw error;
  }
};

/**
 * 关闭Realm数据库
 * @param {Realm} realm Realm实例
 */
export const closeRealm = (realm) => {
  if (realm && !realm.isClosed) {
    realm.close();
  }
};

/**
 * MongoDB Realm App Service 集成
 * 仅用于本地存储，不连接MongoDB Atlas
 */

/**
 * 获取Realm App对象
 * 如果USE_LOCAL_STORAGE为true，则返回模拟的App对象
 * 否则尝试连接MongoDB Atlas
 * @returns {Object} Realm App对象
 */
export const getRealmApp = () => {
  // 检查是否使用本地存储模式
  if (USE_LOCAL_STORAGE) {
    console.info('使用本地存储模式，不连接MongoDB Atlas');
    // 返回一个模拟的App对象
    return {
      id: 'local-only-app',
      currentUser: null,
      logIn: async () => {
        console.info('使用本地模式，不连接MongoDB Atlas');
        return null;
      },
    };
  } else {
    // 尝试连接MongoDB Atlas
    try {
      console.info('尝试连接MongoDB Atlas，App ID:', REALM_APP_ID);
      return new Realm.App({ id: REALM_APP_ID });
    } catch (error) {
      console.error('连接MongoDB Atlas失败，回退到本地模式', error);
      // 回退到本地模式
      return {
        id: 'local-fallback-app',
        currentUser: null,
        logIn: async () => {
          console.info('使用本地模式（回退），不连接MongoDB Atlas');
          return null;
        },
      };
    }
  }
};

/**
 * 登录MongoDB Atlas（模拟）
 * 仅用于保持API兼容性，不实际连接MongoDB Atlas
 * @param {string} email 用户邮箱
 * @param {string} password 用户密码
 * @returns {Promise<Object>} 模拟的用户对象
 */
export const loginToAtlas = async (email, password) => {
  console.info('使用本地模式，不连接MongoDB Atlas进行登录');
  return {
    id: 'local-user',
    profile: { email },
    isAnonymous: false,
  };
};

/**
 * 匿名登录MongoDB Atlas（模拟）
 * 仅用于保持API兼容性，不实际连接MongoDB Atlas
 * @returns {Promise<Object>} 模拟的匿名用户对象
 */
export const loginAnonymously = async () => {
  console.info('使用本地模式，不连接MongoDB Atlas进行匿名登录');
  return {
    id: 'local-anonymous-user',
    isAnonymous: true,
  };
};

/**
 * 登出MongoDB Atlas（模拟）
 * 仅用于保持API兼容性，不实际连接MongoDB Atlas
 * @returns {Promise<void>}
 */
export const logoutFromAtlas = async () => {
  console.info('使用本地模式，不连接MongoDB Atlas进行登出');
  return;
};

/**
 * 获取当前用户（模拟）
 * 仅用于保持API兼容性，不实际连接MongoDB Atlas
 * @returns {Object|null} 模拟的用户对象或null
 */
export const getCurrentUser = () => {
  console.info('使用本地模式，不连接MongoDB Atlas获取用户');
  return null;
};

export default {
  openRealm,
  closeRealm,
  getRealmApp,
  loginToAtlas,
  loginAnonymously,
  logoutFromAtlas,
  getCurrentUser,
  MONGODB_CONFIG
};

