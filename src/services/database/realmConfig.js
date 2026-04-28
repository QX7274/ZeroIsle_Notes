/**
 * Realm数据库配置
 */

import Realm from 'realm';
import realmService from './realmService';

import { getAllSchemas } from './realmModels.js';
import { backupRealmFile } from '../recovery/realmBackupService';
// 导入MongoDB配置
import { MONGODB_CONFIG as DB_CONFIG } from '../../config/mongodbConfig.js';
// 导入Realm配置
import { REALM_APP_ID, USE_LOCAL_STORAGE } from '../../config/realmConfig.js';

// 统一的 Sync 开关：开发阶段可先关闭，接入正式 Realm App 后开启
export const SYNC_ENABLED = !USE_LOCAL_STORAGE;
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
  console.log('✅ [RealmConfig] 正在配置 Realm，Schema 版本: 17');
  if (__DEV__) {
    console.log('⚠️ [RealmConfig] 开发模式启用 deleteRealmIfMigrationNeeded，将清空并重建本地 Realm 数据库');
  } else {
    console.log('✅ [RealmConfig] 生产模式禁用 deleteRealmIfMigrationNeeded，保留数据并执行迁移');
  }
  const config = {
    schema: getAllSchemas(),
    schemaVersion: 17, // 增加版本号到17，统一修复 list/objectType 声明
    path: `${MONGODB_CONFIG.dbName}.realm`,
    deleteRealmIfMigrationNeeded: __DEV__, // 开发环境清库
    migration: (oldRealm, newRealm) => {
      // 处理架构迁移 - 安全模式，保留所有数据
      console.info('✅ [安全迁移] 执行Realm架构迁移', {
        oldVersion: oldRealm.schemaVersion,
        newVersion: newRealm.schemaVersion,
      });

      if (oldRealm.schemaVersion < 17) {
        console.info('✅ [安全迁移] 从版本', oldRealm.schemaVersion, '迁移到版本 17');
        console.info('✅ [安全迁移] 统一列表字段声明（list/objectType），不变更业务字段语义');
      }

      // 处理syncStatus和lastBackupAt字段添加的迁移
      if (oldRealm.schemaVersion < 14) {
        console.info('✅ [安全迁移] 从版本', oldRealm.schemaVersion, '迁移到版本 14');
        console.info('✅ [安全迁移] 添加syncStatus和lastBackupAt字段');

        // 新字段会自动创建，无需特殊处理
        console.info('✅ [安全迁移] syncStatus和lastBackupAt字段添加完成');

        // 处理updatedAt/deviceId/clientOpId字段添加的迁移
        if (oldRealm.schemaVersion < 15) {
          console.info('✅ [安全迁移] 从版本', oldRealm.schemaVersion, '迁移到版本 15');
          console.info('✅ [安全迁移] 添加updatedAt/deviceId/clientOpId字段');
          // 新字段为可选字段，无需遍历写入
          console.info('✅ [安全迁移] 字段添加完成');
        }
      }

      // 处理File和NoteBackup模型添加的迁移
      if (oldRealm.schemaVersion < 13) {
        console.info('✅ [安全迁移] 从版本', oldRealm.schemaVersion, '迁移到版本 13');
        console.info('✅ [安全迁移] 添加File和NoteBackup模型');

        // 新模型会自动创建，无需特殊处理
        console.info('✅ [安全迁移] File和NoteBackup模型添加完成');
      }

      // 处理Note主键添加的迁移
      if (oldRealm.schemaVersion < 12) {
        console.info('✅ [安全迁移] 从版本', oldRealm.schemaVersion, '迁移到版本 12');
        console.info('✅ [安全迁移] 处理Note主键添加');

        try {
          // 处理Note模式的主键添加
          const oldNoteObjects = oldRealm.objects('Note');
          const newNoteObjects = newRealm.objects('Note');

          console.info(`✅ [安全迁移] 处理 Note 模式，共 ${oldNoteObjects.length} 个对象`);

          // 为现有的Note对象添加主键
          for (let i = 0; i < Math.min(oldNoteObjects.length, newNoteObjects.length); i++) {
            const oldObj = oldNoteObjects[i];
            const newObj = newNoteObjects[i];

            // 如果旧对象没有_id字段，生成一个新的字符串ID
            if (!oldObj._id) {
              newObj._id = realmService.createObjectId();
            } else {
              newObj._id = oldObj._id.toString();
            }
          }

          console.info('✅ [安全迁移] Note主键添加完成');
        } catch (error) {
          console.warn('⚠️ [安全迁移] 处理Note主键添加时出错:', error);
        }
      }

      // 处理OfflineQueue主键添加的迁移
      if (oldRealm.schemaVersion < 11) {
        console.info('✅ [安全迁移] 从版本', oldRealm.schemaVersion, '迁移到版本 11');
        console.info('✅ [安全迁移] 处理OfflineQueue主键添加');

        try {
          // 处理OfflineQueue模式的主键添加
          const oldOfflineQueueObjects = oldRealm.objects('OfflineQueue');
          const newOfflineQueueObjects = newRealm.objects('OfflineQueue');

          console.info(`✅ [安全迁移] 处理 OfflineQueue 模式，共 ${oldOfflineQueueObjects.length} 个对象`);

          // 为现有的OfflineQueue对象添加主键
          for (let i = 0; i < Math.min(oldOfflineQueueObjects.length, newOfflineQueueObjects.length); i++) {
            const oldObj = oldOfflineQueueObjects[i];
            const newObj = newOfflineQueueObjects[i];

            // 如果旧对象没有_id字段，生成一个新的字符串ID
            if (!oldObj._id) {
              newObj._id = realmService.createObjectId();
            } else {
              newObj._id = oldObj._id.toString();
            }
          }

          console.info('✅ [安全迁移] OfflineQueue主键添加完成');
        } catch (error) {
          console.warn('⚠️ [安全迁移] 处理OfflineQueue主键添加时出错:', error);
        }
      }

      // 处理从ObjectId到string的迁移
      if (oldRealm.schemaVersion < 10) {
        console.info('✅ [安全迁移] 从版本', oldRealm.schemaVersion, '迁移到版本 10');
        console.info('✅ [安全迁移] 处理ObjectId到string的字段类型迁移');

        // 处理所有模式的ObjectId字段迁移
        const schemasToMigrate = [
          'Note', 'User', 'Reminder', 'MindMapNode', 'SyncInfo',
          'KnowledgeEdge', 'MindMap', 'OfflineQueue', 'KnowledgeNode',
          'KnowledgeGraph', 'Settings', 'File', 'Tag', 'Category',
        ];

        for (const schemaName of schemasToMigrate) {
          try {
            const oldObjects = oldRealm.objects(schemaName);
            const newObjects = newRealm.objects(schemaName);

            console.info(`✅ [安全迁移] 处理 ${schemaName} 模式，共 ${oldObjects.length} 个对象`);

            // 遍历所有对象，转换ObjectId字段为字符串
            for (let i = 0; i < Math.min(oldObjects.length, newObjects.length); i++) {
              const oldObj = oldObjects[i];
              const newObj = newObjects[i];

              // 转换_id字段
              if (oldObj._id && typeof oldObj._id === 'object') {
                newObj._id = oldObj._id.toString();
              }

              // 转换其他可能的ObjectId字段
              const objectIdFields = ['user_id', 'category_id', 'parent_id', 'entity_id', 'note_id', 'graph_id', 'source_id', 'target_id'];
              for (const field of objectIdFields) {
                if (oldObj[field] && typeof oldObj[field] === 'object') {
                  newObj[field] = oldObj[field].toString();
                }
              }
            }
          } catch (error) {
            console.warn(`⚠️ [安全迁移] 处理 ${schemaName} 模式时出错:`, error);
            // 继续处理其他模式
          }
        }

        console.info('✅ [安全迁移] ObjectId到string迁移完成');
      }

      // 处理其他字段的默认值设置
      if (oldRealm.schemaVersion < 9) {
        const oldObjects = oldRealm.objects('Note');
        const newObjects = newRealm.objects('Note');

        console.info('✅ [安全迁移] 保留', oldObjects.length, '条笔记数据');

        // 遍历所有笔记，确保新字段有默认值
        for (let i = 0; i < newObjects.length; i++) {
          const note = newObjects[i];

          // 为PDF相关字段设置默认值（如果不存在）
          if (!note.pdfAnnotations && note.type === 'pdf') {
            note.pdfAnnotations = JSON.stringify({ totalPages: 0, pages: [] });
          }

          // 为画布相关字段设置默认值
          if (!note.strokeData && note.type === 'canvas') {
            note.strokeData = JSON.stringify([]);
          }
          if (!note.viewport && note.type === 'canvas') {
            note.viewport = JSON.stringify({ x: 0, y: 0, scale: 1 });
          }

          // 为分页笔记设置默认值
          if (!note.pages && note.type === 'paged_note') {
            note.pages = JSON.stringify([{ content: '', pageNumber: 1, strokes: [] }]);
          }
        }

        console.info('✅ [安全迁移] 迁移完成，所有数据已保留');
      }
    },
  };

  return config;
};

/**
 * 获取 Sync 模式下的 Realm 配置
 * 需要有效的 Realm.App.currentUser
 */
export const getSyncRealmConfig = (user) => {
  if (!user) {
    throw new Error('getSyncRealmConfig 需要有效的 Realm 用户');
  }

  const baseConfig = getRealmConfig();

  return {
    ...baseConfig,
    sync: {
      user,
      flexible: true,
      newRealmFileBehavior: {
        type: 'downloadBeforeOpen',
      },
      existingRealmFileBehavior: {
        type: 'openImmediately',
      },
      onError: async (session, error) => {
        console.error('[Realm Sync] 会话错误:', error?.name, error?.message || error);

        // 处理 Client Reset 错误 (里程碑 2.3)
        if (error?.name === 'ClientReset') {
          console.warn('⚠️ [Realm Sync] 检测到 Client Reset，启动自动备份与恢复策略');
          try {
            const path = session.config.path;
            const backup = await backupRealmFile(path);
            if (backup.success) {
              console.info(`✅ [Realm Sync] Client Reset 备份成功: ${backup.path}`);
            }

            // 提示：Realm JS SDK 会在 ClientReset 错误后自动执行必要的清理
            // 这里我们主要负责数据安全备份和告知用户（或重启应用）
            // 在生产环境中，建议引导用户重启应用以加载新的 Realm 文件
          } catch (e) {
            console.error('[Realm Sync] Client Reset 处理失败', e);
          }
        }

        // 其他错误分类处理 (网络/权限/会话过期)
        const errorCode = error?.code;
        if (errorCode === 1001) { // 示例：连接超时
          console.log('[Realm Sync] 网络连接超时，将自动重试');
        } else if (errorCode === 202) { // 示例：权限拒绝
          console.error('[Realm Sync] 同步权限不足，请检查账号状态');
        }
      },
      // initialSubscriptions：最小订阅集，正式上线前需与 Realm 控制台权限保持一致
      initialSubscriptions: {
        update: (subs, realm) => {
          const userId = user.id;
          subs.add(realm.objects('Note').filtered('user_id == $0', userId), {
            name: 'user_notes',
          });
          subs.add(realm.objects('Attachment').filtered('user_id == $0', userId), {
            name: 'user_attachments',
          });
          subs.add(realm.objects('OfflineQueue').filtered('user_id == $0', userId), {
            name: 'user_offline_queue',
          });
          subs.add(realm.objects('SyncInfo').filtered('user_id == $0', userId), {
            name: 'user_sync_info',
          });
          subs.add(realm.objects('KnowledgeGraph').filtered('user_id == $0', userId), {
            name: 'user_knowledge_graphs',
          });
          subs.add(realm.objects('KnowledgeNode').filtered('user_id == $0', userId), {
            name: 'user_knowledge_nodes',
          });
          subs.add(realm.objects('KnowledgeEdge').filtered('user_id == $0', userId), {
            name: 'user_knowledge_edges',
          });
        },
      },
    },
  };
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
  if (USE_LOCAL_STORAGE && __DEV__) {
    console.info('⚠️ [RealmConfig] 开发模式：使用本地存储，不连接 MongoDB Atlas');
    return {
      id: 'local-only-app',
      currentUser: null,
      logIn: async () => {
        console.info('使用本地模式，不连接MongoDB Atlas');
        // 本地模式契约：无远端用户会话，返回 null（非错误）
        return null;
      },
    };
  } else {
    // 生产环境或显式关闭本地存储时，必须连接 MongoDB Atlas
    if (!REALM_APP_ID || REALM_APP_ID === 'zeroislenotes-app') {
      // 如果没有配置有效的 App ID，在非开发模式下抛出错误
      if (!__DEV__) {
        throw new Error('❌ [RealmConfig] 生产环境缺少有效的 REALM_APP_ID');
      }
    }

    try {
      console.info('尝试连接 MongoDB Atlas，App ID:', REALM_APP_ID);
      return new Realm.App({ id: REALM_APP_ID });
    } catch (error) {
      console.error('连接 MongoDB Atlas 失败', error);
      // 严禁生产环境静默回退
      if (!__DEV__) {
        throw error;
      }

      console.warn('⚠️ [RealmConfig] 连接失败，开发环境回退到本地模式');
      return {
        id: 'local-fallback-app',
        currentUser: null,
        logIn: async () => {
          console.info('使用本地模式（回退），不连接MongoDB Atlas');
          // 本地回退模式契约：无远端用户会话，返回 null（非错误）
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
  // 本地模式契约：当前无 Atlas 登录用户，返回 null（非错误）
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
  MONGODB_CONFIG,
};
