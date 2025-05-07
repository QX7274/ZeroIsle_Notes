/**
 * 数据同步服务
 * 负责在联网时将本地SQLite数据同步到MongoDB
 */
import NetInfo from '@react-native-community/netinfo';
import sqliteService, { TABLES } from './sqliteService';
import { apiService } from '../api';

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
    if (this.isInitialized) {
      return;
    }

    try {
      // 确保SQLite服务已初始化
      await sqliteService.init();

      // 添加网络状态监听
      this.networkListener = NetInfo.addEventListener(this.handleNetworkChange);

      // 初始化同步信息表
      await this.initSyncInfo();

      this.isInitialized = true;
      console.log('同步服务初始化成功');
    } catch (error) {
      console.error('同步服务初始化失败:', error);
      throw error;
    }
  }

  /**
   * 初始化同步信息表
   * @returns {Promise<void>}
   */
  async initSyncInfo() {
    try {
      // 检查是否已有同步信息记录
      const syncInfoResults = await sqliteService.executeSql(
        `SELECT * FROM ${TABLES.SYNC_INFO}`
      );

      // 如果没有记录，则初始化
      if (syncInfoResults.rows.length === 0) {
        const now = new Date().toISOString();
        const tables = Object.values(TABLES);

        for (const table of tables) {
          // 跳过同步信息表和离线队列表
          if (table === TABLES.SYNC_INFO || table === TABLES.OFFLINE_QUEUE) {
            continue;
          }

          await sqliteService.executeSql(
            `INSERT INTO ${TABLES.SYNC_INFO} (table_name, last_sync_time, sync_status, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?)`,
            [table, null, 'pending', now, now]
          );
        }
      }
    } catch (error) {
      console.error('初始化同步信息失败:', error);
      throw error;
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

    this.isSyncing = true;

    try {
      // 检查网络连接
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected || !netInfo.isInternetReachable) {
        console.log('无网络连接，无法同步数据');
        this.isSyncing = false;
        return;
      }

      console.log('开始同步数据...');

      // 首先处理离线队列
      await this.processOfflineQueue();

      // 同步各个表
      await this.syncTable(TABLES.USERS);
      await this.syncTable(TABLES.CATEGORIES);
      await this.syncTable(TABLES.TAGS);
      await this.syncTable(TABLES.NOTES);
      await this.syncTable(TABLES.NOTE_TAGS);
      await this.syncTable(TABLES.REMINDERS);
      await this.syncTable(TABLES.SETTINGS);
      await this.syncTable(TABLES.FILES);

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
      // 获取未处理的离线操作
      const offlineOperations = await sqliteService.executeSql(
        `SELECT * FROM ${TABLES.OFFLINE_QUEUE} WHERE is_processed = 0 ORDER BY created_at ASC`
      );

      if (offlineOperations.rows.length === 0) {
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
          await sqliteService.executeSql(
            `UPDATE ${TABLES.OFFLINE_QUEUE} SET error_message = ?, retry_count = ? WHERE id = ?`,
            [error.message, newRetryCount, operation.id]
          );

          console.log(`操作 ID: ${operation.id} 处理失败，已更新重试次数为 ${newRetryCount}`);
        }
      }

      console.log('离线队列处理完成');
    } catch (error) {
      console.error('处理离线队列失败:', error);
      throw error;
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
        return '/users';
      case TABLES.NOTES:
        return '/notes';
      case TABLES.CATEGORIES:
        return '/categories';
      case TABLES.TAGS:
        return '/tags';
      case TABLES.REMINDERS:
        return '/reminders';
      case TABLES.SETTINGS:
        return '/settings';
      case TABLES.FILES:
        return '/files';
      case TABLES.NOTE_TAGS:
        return '/note-tags';
      default:
        throw new Error(`未知的表名: ${tableName}`);
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

      // 获取上次同步时间
      const syncInfoResult = await sqliteService.executeSql(
        `SELECT * FROM ${TABLES.SYNC_INFO} WHERE table_name = ?`,
        [tableName]
      );

      if (syncInfoResult.rows.length === 0) {
        throw new Error(`找不到表的同步信息: ${tableName}`);
      }

      const syncInfo = syncInfoResult.rows.item(0);
      const lastSyncTime = syncInfo.last_sync_time;

      // 更新同步状态
      await sqliteService.executeSql(
        `UPDATE ${TABLES.SYNC_INFO} SET sync_status = ?, updated_at = ? WHERE table_name = ?`,
        ['syncing', new Date().toISOString(), tableName]
      );

      // 上传本地未同步的数据
      await this.uploadLocalChanges(tableName, lastSyncTime);

      // 下载服务器上的新数据
      await this.downloadServerChanges(tableName, lastSyncTime);

      // 更新同步信息
      await sqliteService.executeSql(
        `UPDATE ${TABLES.SYNC_INFO} SET last_sync_time = ?, sync_status = ?, updated_at = ? WHERE table_name = ?`,
        [new Date().toISOString(), 'completed', new Date().toISOString(), tableName]
      );

      console.log(`表同步完成: ${tableName}`);
    } catch (error) {
      console.error(`同步表失败 (${tableName}):`, error);

      // 更新同步状态为失败
      await sqliteService.executeSql(
        `UPDATE ${TABLES.SYNC_INFO} SET sync_status = ?, error_message = ?, updated_at = ? WHERE table_name = ?`,
        ['failed', error.message, new Date().toISOString(), tableName]
      );

      throw error;
    }
  }

  /**
   * 上传本地未同步的数据
   * @param {string} tableName - 表名
   * @param {string} lastSyncTime - 上次同步时间
   * @returns {Promise<void>}
   */
  async uploadLocalChanges(tableName, lastSyncTime) {
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

          // 更新本地记录为已同步
          await sqliteService.executeSql(
            `UPDATE ${tableName} SET is_synced = 1 WHERE id = ?`,
            [record.id]
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
      const endpoint = this.getEndpointForTable(tableName);
      const response = await apiService.get(endpoint, { params });
      const serverData = response.data;

      if (!serverData || !Array.isArray(serverData.results)) {
        console.log(`从服务器获取的数据无效，表: ${tableName}`);
        return;
      }

      const records = serverData.results;
      console.log(`从服务器获取的新数据，表: ${tableName}，数量: ${records.length}`);

      for (const record of records) {
        await this.updateLocalRecord(tableName, record);
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
   * 获取同步状态
   * @returns {Promise<object>} 同步状态
   */
  async getSyncStatus() {
    try {
      const result = await sqliteService.executeSql(
        `SELECT table_name, last_sync_time, sync_status, error_message, updated_at
         FROM ${TABLES.SYNC_INFO}
         ORDER BY updated_at DESC`
      );

      const status = {
        lastSync: null,
        tables: {}
      };

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

      // 获取离线队列状态
      const queueResult = await sqliteService.executeSql(
        `SELECT COUNT(*) as total,
                SUM(CASE WHEN is_processed = 0 THEN 1 ELSE 0 END) as pending,
                SUM(CASE WHEN is_processed = 1 THEN 1 ELSE 0 END) as processed
         FROM ${TABLES.OFFLINE_QUEUE}`
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
