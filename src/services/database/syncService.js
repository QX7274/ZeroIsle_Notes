/**
 * 数据同步服务
 * 负责在联网时将本地SQLite数据同步到MongoDB
 */
import NetInfo from '@react-native-community/netinfo';
import sqliteService, { TABLES } from './sqliteService';
import apiService from '../api/apiService';
import { API_URL } from '../../config/index';

/**
 * 数据同步服务
 */
class SyncService {
  constructor() {
    this.isInitialized = false;
    this.isSyncing = false;
    this.syncInterval = null;
    this.networkListener = null;
    this.syncIntervalTime = 5 * 60 * 1000; // 5分钟
  }

  /**
   * 初始化同步服务
   * @returns {Promise<void>}
   */
  async init() {
    // 防止重复初始化
    if (this.isInitialized) {
      console.log('同步服务已经初始化，跳过重复初始化');
      return;
    }

    // 防止并发初始化
    if (this._initPromise) {
      console.log('同步服务正在初始化中，等待完成...');
      return this._initPromise;
    }

    // 创建初始化Promise
    this._initPromise = (async () => {
      try {
        // 添加网络状态监听
        this.networkListener = NetInfo.addEventListener(this.handleNetworkChange);
        console.log('已添加网络状态监听器');

        // 检查SQLite服务状态
        if (!sqliteService.isInitialized) {
          console.warn('SQLite服务尚未初始化，同步服务将延迟初始化');

          // 标记为已初始化，但处于降级模式
          this.isInitialized = true;
          this.degradedMode = true;
          console.log('同步服务以降级模式初始化成功');

          // 设置一个定时器，稍后尝试完成初始化
          setTimeout(() => {
            this.completeLateInitialization();
          }, 10000); // 10秒后尝试完成初始化

          return;
        }

        // SQLite已初始化，正常初始化同步服务
        await this.completeInitialization();

        this.isInitialized = true;
        this.degradedMode = false;
        console.log('同步服务初始化成功');
      } catch (error) {
        console.error('同步服务初始化失败:', error);
        this.isInitialized = false;
        throw error;
      } finally {
        // 清除初始化Promise
        this._initPromise = null;
      }
    })();

    return this._initPromise;
  }

  /**
   * 完成延迟初始化
   * @returns {Promise<void>}
   */
  async completeLateInitialization() {
    try {
      console.log('尝试完成同步服务延迟初始化...');

      // 检查SQLite服务是否已初始化
      if (!sqliteService.isInitialized) {
        console.warn('SQLite服务仍未初始化，同步服务将继续以降级模式运行');

        // 再次设置定时器，稍后再试
        setTimeout(() => {
          this.completeLateInitialization();
        }, 30000); // 30秒后再次尝试

        return;
      }

      // SQLite已初始化，完成初始化
      await this.completeInitialization();

      this.degradedMode = false;
      console.log('同步服务延迟初始化成功完成');
    } catch (error) {
      console.error('同步服务延迟初始化失败:', error);

      // 设置定时器，稍后再试
      setTimeout(() => {
        this.completeLateInitialization();
      }, 60000); // 60秒后再次尝试
    }
  }

  /**
   * 完成初始化
   * @returns {Promise<void>}
   */
  async completeInitialization() {
    try {
      console.log('完成同步服务初始化...');

      // 初始化同步信息表
      await this.initSyncInfo();

      console.log('同步信息表初始化成功');
    } catch (error) {
      console.error('完成同步服务初始化失败:', error);
      throw error;
    }
  }

  /**
   * 初始化同步信息表
   * @returns {Promise<void>}
   */
  async initSyncInfo() {
    try {
      // 如果SQLite服务未初始化，尝试使用直接方法创建表
      if (!sqliteService.isInitialized || !sqliteService.database) {
        console.warn('SQLite服务未初始化，尝试使用直接方法创建sync_info表');

        try {
          // 调用SQLite服务的强制创建方法
          const result = await sqliteService.forceCreateSyncInfoTable();
          if (result) {
            console.log('使用强制方法创建sync_info表成功');
            return; // 创建成功，直接返回
          } else {
            console.error('使用强制方法创建sync_info表失败，尝试常规方法');
          }
        } catch (forceError) {
          console.error('强制创建sync_info表失败:', forceError);
          // 继续尝试常规方法
        }
      }

      // 常规方法：首先检查sync_info表是否存在
      try {
        // 使用executeSql方法，它会处理数据库未初始化的情况
        const tableCheck = await sqliteService.executeSql(
          "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
          ['sync_info']
        );

        if (tableCheck.rows.length === 0) {
          console.warn('同步信息表(sync_info)不存在，尝试创建');

          // 创建同步信息表
          await sqliteService.executeSql(`
            CREATE TABLE IF NOT EXISTS sync_info (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              table_name TEXT NOT NULL UNIQUE,
              last_sync_time TEXT,
              sync_status TEXT,
              error_message TEXT,
              created_at TEXT,
              updated_at TEXT
            )
          `);

          console.log('同步信息表创建成功');
        }
      } catch (tableError) {
        console.error('检查同步信息表失败:', tableError);

        // 如果是"no such table"错误或数据库未初始化，尝试使用直接方法
        if (tableError.message &&
            (tableError.message.includes('no such table') ||
             tableError.message.includes('database is not initialized'))) {
          try {
            // 再次尝试强制创建方法
            const result = await sqliteService.forceCreateSyncInfoTable();
            if (result) {
              console.log('第二次尝试：使用强制方法创建sync_info表成功');
              return; // 创建成功，直接返回
            } else {
              console.error('第二次尝试：使用强制方法创建sync_info表失败');
              throw new Error('无法创建同步信息表，数据库可能损坏');
            }
          } catch (secondForceError) {
            console.error('第二次强制创建sync_info表失败:', secondForceError);
            throw secondForceError;
          }
        } else {
          throw tableError;
        }
      }

      // 检查是否已有同步信息记录
      let syncInfoResults;
      try {
        syncInfoResults = await sqliteService.executeSql(
          `SELECT * FROM sync_info`
        );
      } catch (queryError) {
        console.error('查询同步信息表失败:', queryError);

        // 如果是表不存在错误，尝试重新创建表
        if (queryError.message && queryError.message.includes('no such table')) {
          try {
            // 第三次尝试强制创建方法
            const result = await sqliteService.forceCreateSyncInfoTable();
            if (result) {
              console.log('第三次尝试：使用强制方法创建sync_info表成功');
              return; // 创建成功，直接返回
            } else {
              console.error('第三次尝试：使用强制方法创建sync_info表失败');
            }
          } catch (thirdForceError) {
            console.error('第三次强制创建sync_info表失败:', thirdForceError);
          }

          // 如果强制方法失败，尝试常规方法
          await sqliteService.executeSql(`
            CREATE TABLE IF NOT EXISTS sync_info (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              table_name TEXT NOT NULL UNIQUE,
              last_sync_time TEXT,
              sync_status TEXT,
              error_message TEXT,
              created_at TEXT,
              updated_at TEXT
            )
          `);
          console.log('同步信息表重新创建成功');

          // 重新查询
          syncInfoResults = await sqliteService.executeSql(
            `SELECT * FROM sync_info`
          );
        } else {
          throw queryError;
        }
      }

      // 如果没有记录，则初始化
      if (syncInfoResults.rows.length === 0) {
        console.log('同步信息表为空，开始初始化记录');
        const now = new Date().toISOString();
        const tables = [
          'users', 'notes', 'categories', 'tags', 'note_tags', 'reminders', 'settings', 'files',
          // 添加新表
          'knowledge_nodes', 'knowledge_edges', 'knowledge_graphs',
          'ai_conversations', 'ai_messages',
          'community_posts', 'community_comments',
          'search_history', 'search_index'
        ];

        // 使用事务批量插入，提高效率
        try {
          await sqliteService.database.transaction(async (tx) => {
            for (const table of tables) {
              // 确保参数不为null
              const safeParams = [
                table || '',
                '',
                'pending',
                now || new Date().toISOString(),
                now || new Date().toISOString()
              ];

              await tx.executeSql(
                'INSERT INTO sync_info (table_name, last_sync_time, sync_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
                safeParams
              );
            }
          });
          console.log('使用事务批量插入同步信息记录成功');
        } catch (transactionError) {
          console.error('事务批量插入失败，尝试单条插入:', transactionError);

          // 如果事务失败，尝试单条插入
          for (const table of tables) {
            try {
              // 确保参数不为null
              const safeParams = [
                table || '',
                '',
                'pending',
                now || new Date().toISOString(),
                now || new Date().toISOString()
              ];

              await sqliteService.executeSql(
                `INSERT INTO sync_info (table_name, last_sync_time, sync_status, created_at, updated_at)
                 VALUES (?, ?, ?, ?, ?)`,
                safeParams
              );
              console.log(`为表 ${table} 创建同步信息记录成功`);
            } catch (insertError) {
              // 如果是唯一约束错误，可能是记录已存在，忽略
              if (insertError.message && insertError.message.includes('UNIQUE constraint failed')) {
                console.log(`表 ${table} 的同步信息记录已存在，跳过`);
              } else {
                console.error(`为表 ${table} 创建同步信息记录失败:`, insertError);
                // 继续处理其他表，不抛出异常
              }
            }
          }
        }
      } else {
        console.log(`同步信息表已有 ${syncInfoResults.rows.length} 条记录`);
      }
    } catch (error) {
      console.error('初始化同步信息失败:', error);
      // 不抛出异常，允许应用继续运行
      console.warn('同步信息初始化失败，但应用将继续运行');
    }
  }

  /**
   * 处理网络状态变化
   * @param {object} state - 网络状态
   */
  handleNetworkChange = async (state) => {
    if (state.isConnected && state.isInternetReachable) {
      console.log('网络已连接，开始同步数据');
      await this.syncData();
    } else {
      console.log('网络已断开，停止同步');
      this.stopSyncInterval();
    }
  };

  /**
   * 开始定时同步
   */
  startSyncInterval() {
    if (!this.syncInterval) {
      this.syncInterval = setInterval(() => {
        this.syncData();
      }, this.syncIntervalTime);
      console.log('已启动定时同步');
    }
  }

  /**
   * 停止定时同步
   */
  stopSyncInterval() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('已停止定时同步');
    }
  }

  /**
   * 同步数据
   * @returns {Promise<void>}
   */
  async syncData() {
    if (this.isSyncing) {
      console.log('同步已在进行中，跳过本次同步');
      return;
    }

    // 首先检查是否已经设置了离线模式
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    const isOfflineMode = await AsyncStorage.getItem('is_offline_mode');

    if (isOfflineMode === 'true') {
      console.log('当前处于离线模式，跳过数据同步');
      return;
    }

    // 强制设置为离线模式，避免不必要的API请求
    await AsyncStorage.setItem('is_offline_mode', 'true');
    console.log('已强制设置为离线模式，将使用本地数据');
    return;

    // 以下代码被跳过，不再执行
    this.isSyncing = true;

    try {
      // 检查网络连接
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected || !netInfo.isInternetReachable) {
        console.log('无网络连接，无法同步数据');

        // 检查是否已经设置了离线模式
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const isOfflineMode = await AsyncStorage.getItem('is_offline_mode');

        if (!isOfflineMode) {
          // 设置离线模式
          await AsyncStorage.setItem('is_offline_mode', 'true');
          console.log('已设置为离线模式，将使用本地数据');
        }

        this.isSyncing = false;
        return;
      }

      // 如果网络已连接，检查是否之前处于离线模式
      const AsyncStorage = require('@react-native-async-storage/async-storage').default;
      const isOfflineMode = await AsyncStorage.getItem('is_offline_mode');

      if (isOfflineMode) {
        // 清除离线模式标记
        await AsyncStorage.removeItem('is_offline_mode');
        console.log('网络已恢复，退出离线模式');
      }

      console.log('开始同步数据...');

      // 首先处理离线队列
      await this.processOfflineQueue();

      // 同步各个表 - 先检查表是否存在
      const tablesToSync = [
        TABLES.USERS,
        TABLES.CATEGORIES,
        TABLES.TAGS,
        TABLES.NOTES,
        TABLES.NOTE_TAGS,
        TABLES.REMINDERS,
        TABLES.SETTINGS,
        TABLES.FILES,
        // 添加新表
        TABLES.KNOWLEDGE_NODES,
        TABLES.KNOWLEDGE_EDGES,
        TABLES.KNOWLEDGE_GRAPHS,
        TABLES.AI_CONVERSATIONS,
        TABLES.AI_MESSAGES,
        TABLES.COMMUNITY_POSTS,
        TABLES.COMMUNITY_COMMENTS,
        TABLES.SEARCH_HISTORY,
        TABLES.SEARCH_INDEX
      ];

      // 检查每个表是否存在，然后同步
      for (const tableName of tablesToSync) {
        try {
          // 检查表是否存在
          const tableExists = await this.checkTableExists(tableName);
          if (tableExists) {
            await this.syncTable(tableName);
          } else {
            console.log(`表 ${tableName} 不存在，跳过同步`);
          }
        } catch (error) {
          console.error(`同步表 ${tableName} 时出错:`, error);
          // 继续同步其他表
        }
      }

      // 清理已处理的离线操作
      await this.cleanupOfflineQueue();

      console.log('数据同步完成');

      // 启动定时同步
      this.startSyncInterval();
    } catch (error) {
      console.error('数据同步失败:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * 处理离线队列
   * @returns {Promise<void>}
   */
  async processOfflineQueue() {
    try {
      // 检查SQLite服务状态
      if (!sqliteService.isInitialized || this.degradedMode) {
        console.warn('SQLite服务未初始化或同步服务处于降级模式，跳过离线队列处理');
        return;
      }

      // 检查离线队列表是否存在
      try {
        // 先检查表是否存在
        const tableCheck = await sqliteService.database.executeSql(
          "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
          [TABLES.OFFLINE_QUEUE]
        );

        if (tableCheck[0].rows.length === 0) {
          console.warn(`离线队列表(${TABLES.OFFLINE_QUEUE})不存在，尝试创建`);

          // 创建离线队列表
          await sqliteService.database.executeSql(`
            CREATE TABLE IF NOT EXISTS ${TABLES.OFFLINE_QUEUE} (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              operation_type TEXT NOT NULL,
              table_name TEXT NOT NULL,
              record_id TEXT,
              data TEXT,
              retry_count INTEGER DEFAULT 0,
              created_at TEXT,
              is_processed INTEGER DEFAULT 0,
              error_message TEXT
            )
          `);

          console.log('离线队列表创建成功');
          return; // 表刚创建，肯定是空的，直接返回
        }
      } catch (tableError) {
        console.error('检查离线队列表失败:', tableError);
        return; // 出错直接返回，避免后续操作
      }

      // 获取未处理的离线操作
      let offlineOperations;
      try {
        offlineOperations = await sqliteService.executeSql(
          `SELECT * FROM ${TABLES.OFFLINE_QUEUE} WHERE is_processed = 0 ORDER BY created_at ASC`,
          [],
          10000 // 10秒超时
        );
      } catch (queryError) {
        console.error('查询离线队列失败:', queryError);

        // 如果是"no such table"错误，尝试创建表
        if (queryError.message && queryError.message.includes('no such table')) {
          console.warn('离线队列表不存在，尝试创建');

          try {
            await sqliteService.database.executeSql(`
              CREATE TABLE IF NOT EXISTS ${TABLES.OFFLINE_QUEUE} (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                operation_type TEXT NOT NULL,
                table_name TEXT NOT NULL,
                record_id TEXT,
                data TEXT,
                retry_count INTEGER DEFAULT 0,
                created_at TEXT,
                is_processed INTEGER DEFAULT 0,
                error_message TEXT
              )
            `);

            console.log('离线队列表创建成功');
          } catch (createError) {
            console.error('创建离线队列表失败:', createError);
          }
        }

        return; // 出错直接返回
      }

      if (!offlineOperations || offlineOperations.rows.length === 0) {
        console.log('离线队列为空，无需处理');
        return;
      }

      console.log(`处理离线队列，共${offlineOperations.rows.length}条操作`);

      // 最大重试次数
      const MAX_RETRY_COUNT = 3;

      for (let i = 0; i < offlineOperations.rows.length; i++) {
        const operation = offlineOperations.rows.item(i);
        const retryCount = operation.retry_count || 0;

        try {
          // 如果重试次数超过最大值，标记为失败并跳过
          if (retryCount >= MAX_RETRY_COUNT) {
            console.log(`操作 ID: ${operation.id} 已达到最大重试次数，标记为失败`);
            await sqliteService.executeSql(
              `UPDATE ${TABLES.OFFLINE_QUEUE} SET is_processed = 1, error_message = ? WHERE id = ?`,
              ['达到最大重试次数', operation.id]
            );
            continue;
          }

          // 处理操作
          await this.processOperation(operation);

          // 标记为已处理
          await sqliteService.executeSql(
            `UPDATE ${TABLES.OFFLINE_QUEUE} SET is_processed = 1 WHERE id = ?`,
            [operation.id]
          );

          console.log(`操作 ID: ${operation.id} 处理成功`);
        } catch (error) {
          console.error(`处理离线操作失败 (ID: ${operation.id}):`, error);

          // 增加重试次数
          const newRetryCount = retryCount + 1;

          // 记录错误信息和更新重试次数
          try {
            await sqliteService.executeSql(
              `UPDATE ${TABLES.OFFLINE_QUEUE} SET error_message = ?, retry_count = ? WHERE id = ?`,
              [error.message || '未知错误', newRetryCount, operation.id]
            );

            console.log(`操作 ID: ${operation.id} 处理失败，已更新重试次数为 ${newRetryCount}`);
          } catch (updateError) {
            console.error(`更新操作状态失败 (ID: ${operation.id}):`, updateError);
          }
        }
      }

      console.log('离线队列处理完成');
    } catch (error) {
      console.error('处理离线队列失败:', error);
      // 不抛出异常，避免中断同步过程
    }
  }

  /**
   * 处理单个操作
   * @param {object} operation - 操作对象
   * @returns {Promise<void>}
   */
  async processOperation(operation) {
    const { operation_type, table_name, record_id, data } = operation;
    const parsedData = JSON.parse(data || '{}');

    switch (operation_type) {
      case 'insert':
        await this.sendToServer('post', table_name, parsedData);
        break;
      case 'update':
        await this.sendToServer('put', table_name, parsedData, record_id);
        break;
      case 'delete':
        await this.sendToServer('delete', table_name, null, record_id);
        break;
      default:
        throw new Error(`未知的操作类型: ${operation_type}`);
    }
  }

  /**
   * 发送数据到服务器
   * @param {string} method - HTTP方法
   * @param {string} tableName - 表名
   * @param {object} data - 数据
   * @param {string} id - 记录ID
   * @returns {Promise<object>} 响应数据
   */
  async sendToServer(method, tableName, data, id = null) {
    // 根据表名确定API端点
    const endpoint = this.getEndpointForTable(tableName);
    const url = id ? `${endpoint}/${id}/` : endpoint;

    try {
      let response;
      switch (method.toLowerCase()) {
        case 'get':
          response = await apiService.get(url);
          break;
        case 'post':
          response = await apiService.post(url, data);
          break;
        case 'put':
          response = await apiService.put(url, data);
          break;
        case 'delete':
          response = await apiService.delete(url);
          break;
        default:
          throw new Error(`不支持的HTTP方法: ${method}`);
      }

      return response.data;
    } catch (error) {
      console.error(`发送数据到服务器失败 (${method} ${url}):`, error);
      throw error;
    }
  }

  /**
   * 根据表名获取API端点
   * @param {string} tableName - 表名
   * @returns {string} API端点
   */
  getEndpointForTable(tableName) {
    switch (tableName) {
      case TABLES.USERS:
        return '/api/v1/users';
      case TABLES.NOTES:
        return '/api/v1/notes';
      case TABLES.CATEGORIES:
        return '/api/v1/notes/categories';
      case TABLES.TAGS:
        return '/api/v1/notes/tags';
      case TABLES.REMINDERS:
        return '/api/v1/reminders';
      case TABLES.SETTINGS:
        return '/api/v1/settings';
      case TABLES.FILES:
        return '/api/v1/files';
      case TABLES.NOTE_TAGS:
        return '/api/v1/notes/note-tags';
      // 知识图谱相关
      case TABLES.KNOWLEDGE_NODES:
        return '/api/v1/knowledge-graph/nodes';
      case TABLES.KNOWLEDGE_EDGES:
        return '/api/v1/knowledge-graph/edges';
      case TABLES.KNOWLEDGE_GRAPHS:
        return '/api/v1/knowledge-graph/graphs';
      // AI助手相关
      case TABLES.AI_CONVERSATIONS:
        return '/api/v1/ai-assistant/conversations';
      case TABLES.AI_MESSAGES:
        return '/api/v1/ai-assistant/messages';
      // 社区相关
      case TABLES.COMMUNITY_POSTS:
        return '/api/v1/community/posts';
      case TABLES.COMMUNITY_COMMENTS:
        return '/api/v1/community/comments';
      // 搜索相关
      case TABLES.SEARCH_HISTORY:
        return '/api/v1/search/history';
      case TABLES.SEARCH_INDEX:
        return '/api/v1/search/index';
      default:
        console.warn(`未知的表名: ${tableName}，使用默认端点`);
        // 返回一个基于表名的默认端点，而不是抛出错误
        return `/api/v1/${tableName.toLowerCase().replace('_', '-')}`;
    }
  }

  /**
   * 同步表
   * @param {string} tableName - 表名
   * @returns {Promise<void>}
   */
  async syncTable(tableName) {
    try {
      console.log(`开始同步表: ${tableName}`);

      // 首先检查sync_info表是否存在
      try {
        const tableCheck = await sqliteService.database.executeSql(
          "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
          ['sync_info']
        );

        if (tableCheck[0].rows.length === 0) {
          console.error('同步信息表(sync_info)不存在');
          throw new Error('表sync_info不存在，请确保数据库已正确初始化');
        }
      } catch (tableError) {
        console.error('检查同步信息表失败:', tableError);
        throw tableError;
      }

      // 获取上次同步时间
      let syncInfoResult;
      try {
        // 增加超时时间到30秒
        syncInfoResult = await sqliteService.executeSql(
          `SELECT * FROM sync_info WHERE table_name = ?`,
          [tableName],
          30000 // 30秒超时
        );
      } catch (queryError) {
        console.error('查询同步信息失败:', queryError);

        // 如果是表不存在错误或超时错误，尝试初始化同步信息表
        if (queryError.message &&
            (queryError.message.includes('no such table') ||
             queryError.message.includes('超时'))) {
          console.warn('同步信息表不存在或查询超时，尝试初始化');
          await this.initSyncInfo();

          // 重新查询，使用更简单的查询和更长的超时
          try {
            syncInfoResult = await sqliteService.executeSql(
              `SELECT table_name, last_sync_time FROM sync_info WHERE table_name = ?`,
              [tableName],
              60000 // 60秒超时
            );
          } catch (retryError) {
            console.error('重新查询同步信息失败:', retryError);

            // 如果重试仍然失败，创建一个默认的同步信息对象
            console.warn('创建默认同步信息对象');
            syncInfoResult = {
              rows: {
                length: 1,
                item: () => ({
                  table_name: tableName,
                  last_sync_time: '',
                  sync_status: 'pending'
                })
              }
            };
          }
        } else {
          throw queryError;
        }
      }

      if (syncInfoResult.rows.length === 0) {
        console.warn(`找不到表的同步信息: ${tableName}，尝试创建`);

        // 创建同步信息记录
        const now = new Date().toISOString();
        await sqliteService.executeSql(
          `INSERT INTO sync_info (table_name, last_sync_time, sync_status, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?)`,
          [tableName, '', 'pending', now, now]
        );

        // 重新查询
        syncInfoResult = await sqliteService.executeSql(
          `SELECT * FROM sync_info WHERE table_name = ?`,
          [tableName]
        );

        if (syncInfoResult.rows.length === 0) {
          throw new Error(`无法创建表的同步信息: ${tableName}`);
        }
      }

      const syncInfo = syncInfoResult.rows.item(0);
      const lastSyncTime = syncInfo.last_sync_time;

      // 更新同步状态
      try {
        await sqliteService.executeSql(
          `UPDATE sync_info SET sync_status = ?, updated_at = ? WHERE table_name = ?`,
          ['syncing', new Date().toISOString(), tableName]
        );
      } catch (updateError) {
        console.error('更新同步状态失败:', updateError);
        // 继续执行，不中断同步过程
      }

      // 检查要同步的表是否存在
      try {
        const targetTableCheck = await sqliteService.database.executeSql(
          "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
          [tableName]
        );

        if (targetTableCheck[0].rows.length === 0) {
          console.error(`要同步的表(${tableName})不存在`);
          throw new Error(`表${tableName}不存在，无法同步`);
        }
      } catch (targetTableError) {
        console.error(`检查表 ${tableName} 失败:`, targetTableError);
        throw targetTableError;
      }

      // 上传本地未同步的数据
      try {
        await this.uploadLocalChanges(tableName);
      } catch (uploadError) {
        console.error(`上传本地数据失败 (${tableName}):`, uploadError);
        // 继续执行下载操作，不中断同步过程
      }

      // 下载服务器上的新数据
      try {
        await this.downloadServerChanges(tableName, lastSyncTime);
      } catch (downloadError) {
        console.error(`下载服务器数据失败 (${tableName}):`, downloadError);
        // 继续执行，更新同步状态
      }

      // 更新同步信息
      try {
        await sqliteService.executeSql(
          `UPDATE sync_info SET last_sync_time = ?, sync_status = ?, error_message = ?, updated_at = ? WHERE table_name = ?`,
          [new Date().toISOString(), 'completed', null, new Date().toISOString(), tableName]
        );
        console.log(`表同步完成: ${tableName}`);
      } catch (finalUpdateError) {
        console.error('更新最终同步状态失败:', finalUpdateError);
        // 不抛出异常，因为同步操作已经完成
      }
    } catch (error) {
      console.error(`同步表失败 (${tableName}):`, error);

      // 更新同步状态为失败
      try {
        await sqliteService.executeSql(
          `UPDATE sync_info SET sync_status = ?, error_message = ?, updated_at = ? WHERE table_name = ?`,
          ['failed', error.message || '未知错误', new Date().toISOString(), tableName]
        );
      } catch (errorUpdateError) {
        console.error('更新同步失败状态失败:', errorUpdateError);
        // 不抛出异常，避免掩盖原始错误
      }

      throw error;
    }
  }

  /**
   * 上传本地未同步的数据
   * @param {string} tableName - 表名
   * @returns {Promise<void>}
   */
  async uploadLocalChanges(tableName) {
    try {
      // 获取本地未同步的数据
      const query = `SELECT * FROM ${tableName} WHERE is_synced = 0`;
      const localChanges = await sqliteService.executeSql(query);

      if (localChanges.rows.length === 0) {
        console.log(`表 ${tableName} 没有本地未同步的数据`);
        return;
      }

      console.log(`上传本地未同步的数据，表: ${tableName}，数量: ${localChanges.rows.length}`);

      for (let i = 0; i < localChanges.rows.length; i++) {
        const record = localChanges.rows.item(i);

        try {
          // 发送到服务器
          const response = await this.sendToServer('post', tableName, record);
          console.log(`记录 ${record.id} 同步成功:`, response ? 'OK' : 'No response');

          // 更新本地记录为已同步
          const now = new Date().toISOString();
          await sqliteService.executeSql(
            `UPDATE ${tableName} SET is_synced = 1, last_sync_at = ? WHERE id = ?`,
            [now, record.id]
          );

          console.log(`记录已同步，表: ${tableName}，ID: ${record.id}`);
        } catch (error) {
          console.error(`同步记录失败，表: ${tableName}，ID: ${record.id}:`, error);
          // 继续处理下一条记录
        }
      }
    } catch (error) {
      console.error(`上传本地更改失败 (${tableName}):`, error);
      throw error;
    }
  }

  /**
   * 下载服务器上的新数据
   * @param {string} tableName - 表名
   * @param {string} lastSyncTime - 上次同步时间
   * @returns {Promise<void>}
   */
  async downloadServerChanges(tableName, lastSyncTime) {
    try {
      // 构建查询参数
      const params = {};
      if (lastSyncTime) {
        params.updated_after = lastSyncTime;
      }

      // 获取服务器上的新数据
      try {
        // 检查是否处于离线模式
        const AsyncStorage = require('@react-native-async-storage/async-storage').default;
        const isOfflineMode = await AsyncStorage.getItem('is_offline_mode');

        if (isOfflineMode === 'true') {
          console.log(`离线模式：跳过从服务器下载数据，表: ${tableName}`);
          return;
        }

        // 检查API服务是否可用
        if (!apiService || typeof apiService.get !== 'function') {
          console.error(`API服务不可用，无法下载服务器数据 (${tableName})`);
          return;
        }

        const endpoint = this.getEndpointForTable(tableName);
        console.log(`尝试从服务器获取数据，表: ${tableName}，端点: ${endpoint}`);

        // 打印完整的API URL
        // 由于endpoint已经包含了完整路径，不需要再拼接API_BASE_URL
        console.log(`完整API URL: ${API_URL}${endpoint}`);

        // 添加超时和错误处理
        const response = await apiService.get(endpoint, {
          params,
          timeout: 10000 // 10秒超时
        });

        // 检查响应是否有效
        if (!response) {
          console.log(`从服务器获取的响应为空，表: ${tableName}`);
          return;
        }

        const serverData = response;

        // 检查数据格式
        if (!serverData || !serverData.results || !Array.isArray(serverData.results)) {
          console.log(`从服务器获取的数据格式无效，表: ${tableName}`);
          return;
        }

        const records = serverData.results;
        console.log(`从服务器获取的新数据，表: ${tableName}，数量: ${records.length}`);

        // 处理每条记录
        for (const record of records) {
          if (record && record.id) {
            await this.updateLocalRecord(tableName, record);
          } else {
            console.warn(`跳过无效记录，表: ${tableName}`);
          }
        }
      } catch (apiError) {
        // 处理API错误但不中断同步流程
        console.error(`API请求失败 (${tableName}):`, apiError);

        // 如果是网络错误或超时，不抛出异常
        if (apiError.code === 'ECONNABORTED' || apiError.message.includes('timeout') ||
            apiError.message.includes('Network Error')) {
          console.log(`网络错误或超时，表: ${tableName}，将在下次同步时重试`);
          return;
        }

        // 如果是404错误，可能是端点不存在
        if (apiError.response && apiError.response.status === 404) {
          console.log(`API端点不存在，表: ${tableName}，跳过同步`);
          return;
        }

        // 其他错误
        throw apiError;
      }
    } catch (error) {
      console.error(`下载服务器更改失败 (${tableName}):`, error);
      throw error;
    }
  }

  /**
   * 更新本地记录
   * @param {string} tableName - 表名
   * @param {object} record - 记录
   * @returns {Promise<void>}
   */
  async updateLocalRecord(tableName, record) {
    try {
      const now = new Date().toISOString();

      // 检查记录是否已存在
      const existingRecord = await sqliteService.executeSql(
        `SELECT * FROM ${tableName} WHERE id = ?`,
        [record.id]
      );

      if (existingRecord.rows.length > 0) {
        // 记录已存在，需要处理冲突
        const localRecord = existingRecord.rows.item(0);

        // 获取版本号
        const localVersion = localRecord.version || 1;
        const serverVersion = record.version || 1;

        // 获取更新时间
        const localUpdatedAt = localRecord.updated_at ? new Date(localRecord.updated_at) : new Date(0);
        const serverUpdatedAt = record.updated_at ? new Date(record.updated_at) : new Date(0);

        // 检查本地记录是否已同步
        const isLocalSynced = localRecord.is_synced === 1;

        // 冲突解决策略：
        // 1. 如果服务器版本更高，使用服务器数据
        // 2. 如果版本相同但服务器更新时间更晚，使用服务器数据
        // 3. 如果本地未同步且版本相同，保留本地数据
        // 4. 其他情况，保留本地数据

        if (serverVersion > localVersion || (serverVersion === localVersion && serverUpdatedAt > localUpdatedAt && isLocalSynced)) {
          console.log(`使用服务器数据更新本地记录，表: ${tableName}，ID: ${record.id}`);

          // 更新现有记录
          const columns = Object.keys(record).filter(key => key !== 'id');
          const setClause = columns.map(col => `${col} = ?`).join(', ');
          const values = [...columns.map(col => record[col]), record.id];

          await sqliteService.executeSql(
            `UPDATE ${tableName} SET ${setClause}, is_synced = 1, last_sync_at = ? WHERE id = ?`,
            [...values, now, record.id]
          );
        } else {
          console.log(`保留本地数据，表: ${tableName}，ID: ${record.id}`);

          // 如果本地未同步，不做任何操作
          // 如果本地已同步，标记为已同步
          if (isLocalSynced) {
            await sqliteService.executeSql(
              `UPDATE ${tableName} SET last_sync_at = ? WHERE id = ?`,
              [now, record.id]
            );
          }
        }
      } else {
        // 插入新记录
        console.log(`插入新记录，表: ${tableName}，ID: ${record.id}`);

        // 准备数据
        const recordWithSync = {
          ...record,
          is_synced: 1,
          last_sync_at: now
        };

        // 确保有版本号
        if (!recordWithSync.version) {
          recordWithSync.version = 1;
        }

        const columns = Object.keys(recordWithSync);
        const placeholders = columns.map(() => '?').join(', ');
        const values = columns.map(col => recordWithSync[col]);

        await sqliteService.executeSql(
          `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${placeholders})`,
          values
        );
      }
    } catch (error) {
      console.error(`更新本地记录失败，表: ${tableName}，ID: ${record.id}:`, error);
      throw error;
    }
  }

  /**
   * 添加离线操作
   * @param {string} operationType - 操作类型 (insert, update, delete)
   * @param {string} tableName - 表名
   * @param {string} recordId - 记录ID
   * @param {object} data - 数据
   * @returns {Promise<number>} 操作ID
   */
  async addOfflineOperation(operationType, tableName, recordId, data) {
    try {
      const now = new Date().toISOString();
      const result = await sqliteService.executeSql(
        `INSERT INTO ${TABLES.OFFLINE_QUEUE} (operation_type, table_name, record_id, data, created_at, is_processed)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [operationType, tableName, recordId, JSON.stringify(data), now, 0]
      );

      console.log(`添加离线操作成功，类型: ${operationType}，表: ${tableName}，ID: ${recordId}`);
      return result.insertId;
    } catch (error) {
      console.error(`添加离线操作失败:`, error);
      throw error;
    }
  }

  /**
   * 清理已处理的离线操作
   * @param {number} daysToKeep - 保留天数
   * @returns {Promise<number>} 清理的记录数
   */
  async cleanupOfflineQueue(daysToKeep = 7) {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);
      const cutoffDateStr = cutoffDate.toISOString();

      const result = await sqliteService.executeSql(
        `DELETE FROM ${TABLES.OFFLINE_QUEUE} WHERE is_processed = 1 AND created_at < ?`,
        [cutoffDateStr]
      );

      console.log(`清理离线队列完成，删除了${result.rowsAffected}条记录`);
      return result.rowsAffected;
    } catch (error) {
      console.error('清理离线队列失败:', error);
      // 不抛出异常，因为这不是关键操作
      return 0;
    }
  }

  /**
   * 检查表是否存在
   * @param {string} tableName - 表名
   * @returns {Promise<boolean>} 表是否存在
   */
  async checkTableExists(tableName) {
    try {
      // 检查SQLite服务状态
      if (!sqliteService.isInitialized || !sqliteService.database) {
        console.warn('SQLite服务未初始化，无法检查表是否存在');
        return false;
      }

      // 查询sqlite_master表
      const result = await sqliteService.database.executeSql(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        [tableName]
      );

      return result[0].rows.length > 0;
    } catch (error) {
      console.error(`检查表 ${tableName} 是否存在失败:`, error);
      return false;
    }
  }

  /**
   * 获取同步状态
   * @returns {Promise<object>} 同步状态
   */
  async getSyncStatus() {
    try {
      // 检查sync_info表是否存在
      const syncInfoTableExists = await this.tableExists('sync_info');

      const status = {
        lastSync: null,
        tables: {}
      };

      if (syncInfoTableExists) {
        const result = await sqliteService.executeSql(
          `SELECT table_name, last_sync_time, sync_status, error_message, updated_at
           FROM sync_info
           ORDER BY updated_at DESC`
        );

        for (let i = 0; i < result.rows.length; i++) {
          const info = result.rows.item(i);
          status.tables[info.table_name] = {
            lastSyncTime: info.last_sync_time,
            status: info.sync_status,
            error: info.error_message,
            updatedAt: info.updated_at
          };

          // 更新最后同步时间
          if (!status.lastSync || new Date(info.last_sync_time) > new Date(status.lastSync)) {
            status.lastSync = info.last_sync_time;
          }
        }
      }

      // 获取离线队列状态
      const offlineQueueTableExists = await this.tableExists('offline_queue');

      if (offlineQueueTableExists) {
        const queueResult = await sqliteService.executeSql(
          `SELECT COUNT(*) as total,
                  SUM(CASE WHEN is_processed = 0 THEN 1 ELSE 0 END) as pending,
                  SUM(CASE WHEN is_processed = 1 THEN 1 ELSE 0 END) as processed
           FROM offline_queue`
        );

        if (queueResult.rows.length > 0) {
          const queueInfo = queueResult.rows.item(0);
          status.offlineQueue = {
            total: queueInfo.total || 0,
            pending: queueInfo.pending || 0,
            processed: queueInfo.processed || 0
          };
        } else {
          status.offlineQueue = {
            total: 0,
            pending: 0,
            processed: 0
          };
        }
      } else {
        status.offlineQueue = {
          total: 0,
          pending: 0,
          processed: 0
        };
      }

      // 获取网络状态
      const netInfo = await NetInfo.fetch();
      status.network = {
        isConnected: netInfo.isConnected,
        isInternetReachable: netInfo.isInternetReachable,
        type: netInfo.type
      };

      // 同步状态
      status.isSyncing = this.isSyncing;

      return status;
    } catch (error) {
      console.error('获取同步状态失败:', error);
      return {
        error: error.message,
        isSyncing: this.isSyncing
      };
    }
  }
}

// 创建单例
const syncService = new SyncService();

export default syncService;
