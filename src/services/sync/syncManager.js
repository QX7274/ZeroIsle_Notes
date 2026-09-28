/**
 * 同步管理器
 * 管理本地数据与云端数据的同步
 */

import realmService from '../database/realmService';
import { mongoDBService } from '../database/mongoDBAdapter';
import { logService } from '../../utils/logService';
import networkService from '../network/networkService';
import {
  classifySyncError,
  createRetryController,
  SYNC_ERROR_CATEGORIES,
} from './syncErrorRecovery';

/**
 * 描述错误信息（用于构造带上下文的 Client Reset 备份错误）
 * @param {*} error 错误对象
 * @returns {string} 错误描述
 */
function describeError(error) {
  if (!error) {
    return '未知原因';
  }
  if (typeof error === 'string') {
    return error;
  }
  return error.message || String(error);
}

/**
 * 构造带上下文的 Client Reset 备份错误（保留原始错误为 cause）
 * @param {string} reason 失败原因
 * @param {string} realmPath Realm 路径
 * @param {string|null} operationId 触发操作 ID
 * @param {*} cause 原始错误
 * @returns {Error} 备份错误
 */
function createClientResetBackupError(reason, realmPath, operationId, cause) {
  const error = new Error(`Client Reset 备份失败：${reason} (realmPath=${realmPath}, operation=${operationId || 'unknown'})`);
  error.realmPath = realmPath;
  error.operationId = operationId;
  if (cause) {
    error.cause = cause;
  }
  return error;
}

/**
 * 同步管理器类
 *
 * Client Reset 备份触发点说明：
 * - 真实 Realm 回调触发点是 realmConfig.getSyncRealmConfig 的 sync.onError（error.name === 'ClientReset'）
 * - 本类的 clientReset 分支是「同步错误分类」的兜底触发（realm 20.1.0 未导出 ClientResetError，
 *   只能靠 classifySyncError 判定 category === 'clientReset'）
 * - 二者共用同一备份实现 realmBackupService.backupRealmFile；本类在同一会话内去重，避免重复备份
 */
class SyncManager {
  constructor() {
    this.initialized = false;
    this.initializationPromise = null;
    this.isOnline = false;
    this.isSyncing = false;
    this.lastSyncTime = null;
    this.pendingOperations = [];
    this.syncInterval = null;
    this.networkListener = null;
    // 单条操作的重试接线：重试参数可注入，便于测试零等待运行
    this.retryOptions = {};
    this.activeRetryControllers = new Set();
    this.pendingRetriesCancelled = false;
    // Client Reset 备份接线：文件系统依赖保持可注入，避免 Jest 下硬依赖原生模块
    this.clientResetRecoveryOptions = {};
    this.clientResetState = null;
  }

  /**
   * 初始化同步管理器
   */
  async initialize() {
    if (this.initialized) {return Promise.resolve();}

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = new Promise(async (resolve, reject) => {
      try {
        // 初始化Realm服务
        await realmService.initialize();

        // 检查网络状态
        const netInfo = await networkService.checkConnection();
        this.isOnline = Boolean(netInfo);

        // 设置网络状态监听
        this.setupNetworkListener();

        // 加载待处理操作
        await this.loadPendingOperations();

        this.initialized = true;
        logService.info('同步管理器初始化成功');
        resolve();
      } catch (error) {
        logService.error('同步管理器初始化失败', error);
        reject(error);
      }
    });

    return this.initializationPromise;
  }

  /**
   * 设置网络状态监听
   * @private
   */
  setupNetworkListener() {
    // 移除现有监听器
    if (this.networkListener) {
      this.networkListener();
    }

    // 添加新监听器
    this.networkListener = networkService.addNetworkListener(state => {
      const wasOnline = this.isOnline;
      this.isOnline = Boolean(state?.isOnline);

      // 网络状态变化日志
      logService.info(`网络状态变化: ${wasOnline ? '在线' : '离线'} -> ${this.isOnline ? '在线' : '离线'}`);

      // 如果从离线变为在线，尝试同步
      if (!wasOnline && this.isOnline) {
        this.syncAll().catch(error => {
          logService.error('自动同步失败', error);
        });
      }
    });
  }

  /**
   * 加载待处理操作
   * @private
   */
  async loadPendingOperations() {
    try {
      const realm = await realmService.getRealm();
      const operations = realm.objects('SyncOperation');
      this.pendingOperations = Array.from(operations).map(op => realmService.realmObjectToPlain(op));
      logService.info(`加载了 ${this.pendingOperations.length} 个待处理同步操作`);
    } catch (error) {
      logService.error('加载待处理同步操作失败', error);
      this.pendingOperations = [];
    }
  }

  /**
   * 添加待处理操作
   * @param {Object} operation 操作对象
   * @returns {Promise<boolean>} 是否成功
   */
  async addPendingOperation(operation) {
    try {
      await this.initialize();

      const realm = await realmService.getRealm();

      // 创建操作记录
      realm.write(() => {
        realm.create('SyncOperation', {
          _id: `sync_${realmService.createObjectId()}`,
          type: operation.type,
          collection: operation.collection,
          documentId: operation.documentId,
          data: JSON.stringify(operation.data),
          timestamp: new Date(),
          status: 'pending',
        });
      });

      // 重新加载待处理操作
      await this.loadPendingOperations();

      // 如果在线，尝试立即同步
      if (this.isOnline && !this.isSyncing) {
        this.syncPendingOperations().catch(error => {
          logService.error('同步待处理操作失败', error);
        });
      }

      return true;
    } catch (error) {
      logService.error('添加待处理同步操作失败', error);
      throw error;
    }
  }

  /**
   * 同步所有数据
   * @param {Object} options 同步选项
   * @param {boolean} options.force 是否强制同步所有数据
   * @param {Array<string>} options.collections 要同步的集合列表
   * @returns {Promise<boolean>} 是否成功
   */
  async syncAll(options = {}) {
    try {
      await this.initialize();

      // 检查网络状态
      if (!this.isOnline) {
        logService.warn('无法同步数据：网络离线');
        throw new Error('无网络连接，无法同步数据，请连接网络后重试');
      }

      // 检查是否已在同步
      if (this.isSyncing) {
        logService.warn('同步已在进行中');
        throw new Error('同步已在进行中，请稍后重试');
      }

      const { force = false, collections = ['notes', 'tags', 'categories', 'settings'] } = options;

      // 如果不是强制同步，检查上次同步时间
      if (!force && this.lastSyncTime) {
        const now = new Date();
        const timeSinceLastSync = now.getTime() - this.lastSyncTime.getTime();

        // 如果距离上次同步不到5分钟，跳过同步
        if (timeSinceLastSync < 5 * 60 * 1000) {
          logService.info(`跳过同步：距离上次同步不到5分钟 (${Math.round(timeSinceLastSync / 1000)}秒)`);
          return true;
        }
      }

      this.isSyncing = true;
      logService.info(`开始同步数据 (${force ? '强制' : '普通'}模式)`);

      try {
        // 同步待处理操作
        await this.syncPendingOperations();

        // 根据指定的集合列表同步数据
        const syncPromises = [];

        if (collections.includes('notes')) {
          syncPromises.push(this.syncNotes());
        }

        if (collections.includes('tags')) {
          syncPromises.push(this.syncTags());
        }

        if (collections.includes('categories')) {
          syncPromises.push(this.syncCategories());
        }

        if (collections.includes('settings')) {
          syncPromises.push(this.syncSettings());
        }

        // 并行执行同步操作
        const results = await Promise.allSettled(syncPromises);

        // 检查同步结果
        const failedSyncs = results.filter(result => result.status === 'rejected');
        if (failedSyncs.length > 0) {
          logService.warn(`部分同步操作失败: ${failedSyncs.length}/${results.length}`);
        }

        // 更新最后同步时间
        this.lastSyncTime = new Date();
        logService.info('所有数据同步完成');
        return failedSyncs.length === 0;
      } finally {
        this.isSyncing = false;
      }
    } catch (error) {
      logService.error('同步所有数据失败', error);
      this._classifyAndLogError(error, 'syncAll');
      this.isSyncing = false;
      throw error;
    }
  }

  /**
   * 同步待处理操作
   * @returns {Promise<boolean>} 是否成功
   */
  async syncPendingOperations() {
    try {
      await this.initialize();

      // 检查网络状态
      if (!this.isOnline) {
        logService.warn('无法同步待处理操作：网络离线');
        throw new Error('无网络连接，无法同步待处理操作，请连接网络后重试');
      }

      // 获取待处理操作
      const operations = [...this.pendingOperations];
      if (operations.length === 0) {
        logService.info('没有待处理的同步操作');
        return true;
      }

      logService.info(`开始同步 ${operations.length} 个待处理操作`);

      // 本次同步重新开始，重置上一次的取消标记（取消只作用于进行中的重试）
      this.pendingRetriesCancelled = false;

      // 处理每个操作
      const realm = await realmService.getRealm();

      for (let index = 0; index < operations.length; index += 1) {
        const operation = operations[index];

        // 取消发生在退避等待中时，不再启动新的操作，剩余操作保持待处理留待下次同步
        if (this._isRetryCancelled()) {
          logService.warn(`同步重试已取消，停止处理剩余 ${operations.length - index} 个待处理操作`);
          break;
        }

        try {
          if (!['create', 'update', 'delete'].includes(operation.type)) {
            logService.warn(`未知的操作类型: ${operation.type}`);
            continue;
          }

          await this._executeOperationWithRetry(operation);

          // 标记操作为已完成
          realm.write(() => {
            const op = realm.objectForPrimaryKey('SyncOperation', operation._id);
            if (op) {
              op.status = 'completed';
              op.completedAt = new Date();
            }
          });
        } catch (error) {
          logService.error(`同步操作失败: ${operation._id}`, error);
          this._classifyAndLogError(error, `单条操作 ${operation._id}`);

          // 标记操作为失败
          realm.write(() => {
            const op = realm.objectForPrimaryKey('SyncOperation', operation._id);
            if (op) {
              op.status = 'failed';
              op.error = error.message;
            }
          });
        }
      }

      // 重新加载待处理操作
      await this.loadPendingOperations();

      logService.info('待处理操作同步完成');
      return true;
    } catch (error) {
      logService.error('同步待处理操作失败', error);
      throw error;
    }
  }

  /**
   * 对同步错误进行分类并记录日志，同时把分类结果挂回错误对象
   * 接线点：syncAll / pullFromServer 的顶层 catch，以及 syncPendingOperations 的单条操作 catch
   * @param {Error} error 原始错误
   * @param {string} scene 场景描述（用于日志定位）
   * @returns {Object} classifySyncError 的分类结果
   * @private
   */
  _classifyAndLogError(error, scene) {
    const classification = classifySyncError(error);
    logService.warn(`[sync] ${scene} 错误分类: ${classification.category} (retryable=${classification.retryable}) - ${classification.userMessage}`);

    // 把分类结果附加到错误对象，便于 UI 层或重试控制器直接复用；不可扩展的错误对象跳过
    if (error && typeof error === 'object' && !Object.isFrozen(error)) {
      try {
        error.syncCategory = classification.category;
        error.syncRetryable = classification.retryable;
        error.syncUserMessage = classification.userMessage;
      } catch (assignError) {
        // 附加分类信息失败不影响同步主流程
      }
    }

    return classification;
  }

  /**
   * 设置单条操作的重试参数（maxRetries/baseMs/maxMs/jitter/sleep/random 等）
   * 参数直接透传给 createRetryController，便于测试注入 sleep 实现以避免真实等待
   * @param {Object} options createRetryController 支持的选项
   */
  setRetryOptions(options = {}) {
    this.retryOptions = { ...this.retryOptions, ...(options || {}) };
  }

  /**
   * 取消进行中的同步重试
   * 接线点：停止同步 / 组件卸载等场景调用，可中止正在退避等待的 run()；
   * 取消不会吞掉错误，也不会把被取消的操作当成成功（外层 catch 仍按失败处理），
   * 同时阻止本次同步继续启动新的重试。
   * @returns {number} 被取消的重试控制器数量
   */
  cancelPendingRetries() {
    this.pendingRetriesCancelled = true;

    const controllers = Array.from(this.activeRetryControllers);
    controllers.forEach(controller => {
      try {
        controller.cancel();
      } catch (error) {
        // 单个控制器取消失败不影响其它控制器，仅记录日志
        logService.error('取消同步重试控制器失败', error);
      }
    });

    if (controllers.length > 0) {
      logService.warn(`已取消 ${controllers.length} 个进行中的同步重试`);
    }

    return controllers.length;
  }

  /**
   * 当前同步是否已被取消
   * @returns {boolean} 是否已取消
   * @private
   */
  _isRetryCancelled() {
    return this.pendingRetriesCancelled === true;
  }

  /**
   * 设置 Client Reset 备份依赖（realmPath/backupRealmFile）
   * 不注入 backupRealmFile 时懒加载 realmBackupService.backupRealmFile（与 realmConfig.onError 同一实现），
   * 注入后 Jest 下零原生依赖
   * @param {Object} options 备份选项
   */
  setClientResetRecoveryOptions(options = {}) {
    this.clientResetRecoveryOptions = { ...this.clientResetRecoveryOptions, ...(options || {}) };
  }

  /**
   * 获取最近一次 Client Reset 备份状态
   * @returns {Object|null} { backupAt, backupPath, description, operationId, error }
   */
  getClientResetState() {
    return this.clientResetState ? { ...this.clientResetState } : null;
  }

  /**
   * 解析 Realm 文件路径：优先使用注入值，其次 realmService，最后回退 realm.path
   * @returns {Promise<string>} Realm 文件路径
   * @private
   */
  async _resolveRealmPath() {
    const injected = this.clientResetRecoveryOptions?.realmPath;
    if (typeof injected === 'string' && injected.trim().length > 0) {
      return injected.trim();
    }

    if (typeof realmService.getRealmPath === 'function') {
      const resolved = await realmService.getRealmPath();
      if (typeof resolved === 'string' && resolved.trim().length > 0) {
        return resolved.trim();
      }
    }

    const realm = await realmService.getRealm();
    const realmPath = realm && realm.path !== undefined && realm.path !== null
      ? String(realm.path)
      : '';

    if (realmPath.trim().length > 0) {
      return realmPath.trim();
    }

    throw new Error('Client Reset 备份失败：无法确定 Realm 文件路径');
  }

  /**
   * 解析 Client Reset 备份实现
   * 优先使用注入实现；未注入时懒加载 realmBackupService.backupRealmFile，
   * 与 realmConfig.onError 的 Client Reset 回调共用同一备份实现，避免两处实现/命名不一致。
   * 懒加载保证 Jest 下模块导入阶段不会硬依赖 react-native-fs。
   * @returns {Function} backupRealmFile(realmPath) => Promise<{success: boolean, path: string}>
   * @private
   */
  _resolveRealmBackupFile() {
    const injected = this.clientResetRecoveryOptions?.backupRealmFile;
    if (typeof injected === 'function') {
      return injected;
    }

    const recoveryModule = require('../recovery/realmBackupService');
    if (recoveryModule && typeof recoveryModule.backupRealmFile === 'function') {
      return recoveryModule.backupRealmFile;
    }

    throw new Error('Client Reset 备份失败：realmBackupService.backupRealmFile 不可用');
  }

  /**
   * Client Reset 主动备份（同步错误分类兜底路径）
   *
   * 与真实 Realm 回调的关系：
   * - realmConfig.getSyncRealmConfig 的 sync.onError（error.name === 'ClientReset'）是真实回调触发点
   * - 本方法在 classifySyncError 判定 category === 'clientReset' 时兜底触发（realm 20.1.0 无 ClientResetError 导出）
   * - 二者共用同一备份实现 realmBackupService.backupRealmFile（默认懒加载，单测可注入）
   *
   * 同一会话内已成功备份过则跳过重复备份（仅 warn）；备份失败必须显式抛出，绝不静默继续以免丢数据。
   *
   * @param {Object} operation 触发备份的同步操作
   * @param {Error} error 原始错误（用于日志定位）
   * @returns {Promise<Object|null>} { backupPath, description, success }；已去重跳过时返回 null
   * @private
   */
  async _recoverFromClientReset(operation, error) {
    const operationId = operation?._id ? String(operation._id) : null;

    // 同一会话内已有成功备份：只提示不重复备份（若上次备份失败则不跳过，仍需备份保护数据）
    if (this.clientResetState && this.clientResetState.backupPath) {
      logService.warn(`[sync] 本会话已完成 Client Reset 备份（${this.clientResetState.backupPath}），跳过重复备份：操作 ${operationId || 'unknown'}`);
      return null;
    }

    const reason = error && error.message ? error.message : String(error);
    const realmPath = await this._resolveRealmPath();
    const backupRealmFile = this._resolveRealmBackupFile();
    const backupAt = new Date();

    logService.warn(`[sync] 检测到 Client Reset（操作 ${operationId || 'unknown'}）：${reason}，先备份 Realm 文件：${realmPath}`);

    let backupResult;
    try {
      backupResult = await backupRealmFile(realmPath);
    } catch (backupError) {
      // 备份实现抛错：包装为带上下文的错误并显式抛出，避免在未备份的情况下继续重置
      const wrappedError = createClientResetBackupError(describeError(backupError), realmPath, operationId, backupError);
      this.clientResetState = {
        backupAt,
        backupPath: null,
        description: null,
        operationId,
        error: wrappedError,
      };
      logService.error(`[sync] Client Reset 备份失败，已中止操作 ${operationId || 'unknown'} 的重置流程`, wrappedError);
      throw wrappedError;
    }

    // realmBackupFile 可能以 { success: false } 表示失败而不抛错，这里显式判败，避免生成“看似成功”的状态
    const backupPath = backupResult && backupResult.success === true && typeof backupResult.path === 'string' && backupResult.path.trim().length > 0
      ? backupResult.path
      : '';

    if (!backupPath) {
      const invalidResultError = createClientResetBackupError('备份实现未返回有效备份路径', realmPath, operationId, null);
      invalidResultError.backupResult = backupResult;
      this.clientResetState = {
        backupAt,
        backupPath: null,
        description: null,
        operationId,
        error: invalidResultError,
      };
      logService.error(`[sync] Client Reset 备份失败，已中止操作 ${operationId || 'unknown'} 的重置流程`, invalidResultError);
      throw invalidResultError;
    }

    const description = `Client Reset 前备份：${realmPath} -> ${backupPath}`;
    this.clientResetState = {
      backupAt,
      backupPath,
      description,
      operationId,
      error: null,
    };
    logService.warn(`[sync] Client Reset 备份完成：${description}`);

    return { backupPath, description, success: true };
  }

  /**
   * 用 createRetryController 包裹单条操作的执行
   * - 可重试错误按指数退避重试，耗尽后抛出最后一次错误
   * - 不可重试错误（auth/permission/clientReset/unknown 等）短路，不吞错
   * - 取消后立即抛出最后一次错误（不当作成功）
   * - clientReset 分类在短路后先做 Realm 备份，备份失败显式抛出
   * @param {Object} operation 同步操作
   * @param {Object} [options] 本次调用的重试选项（覆盖实例配置）
   * @returns {Promise<*>} 操作执行结果
   * @private
   */
  async _executeOperationWithRetry(operation, options = {}) {
    const retryOptions = { ...this.retryOptions, ...(options || {}) };
    const externalShouldAbort = typeof retryOptions.shouldAbort === 'function' ? retryOptions.shouldAbort : null;

    const controller = createRetryController({
      ...retryOptions,
      // 取消标记优先：cancelPendingRetries() 后立即停止重试
      shouldAbort: () => this._isRetryCancelled() || (externalShouldAbort ? Boolean(externalShouldAbort()) : false),
    });

    this.activeRetryControllers.add(controller);

    let attempts = 0;
    try {
      return await controller.run(() => {
        attempts += 1;
        return this._executePendingOperation(operation);
      });
    } catch (error) {
      // 记录实际尝试次数，便于失败排查（不改变既有失败分支的落库字段）
      if (error && typeof error === 'object' && !Object.isFrozen(error)) {
        try {
          error.syncAttempts = attempts;
        } catch (assignError) {
          // 错误对象不可扩展时忽略，不影响主流程
        }
      }

      const classification = classifySyncError(error);
      if (classification.category === SYNC_ERROR_CATEGORIES.CLIENT_RESET) {
        await this._recoverFromClientReset(operation, error);
      }

      throw error;
    } finally {
      this.activeRetryControllers.delete(controller);
    }
  }

  _normalizeOperation(operation) {
    const collection = String(operation?.collection || '').trim();
    const documentId = String(operation?.documentId || '').trim();
    let data = {};

    try {
      data = typeof operation?.data === 'string'
        ? JSON.parse(operation.data || '{}')
        : (operation?.data || {});
    } catch (e) {
      data = {};
    }

    return {
      collection,
      documentId,
      data,
    };
  }

  async _executePendingOperation(operation) {
    const { collection, documentId, data } = this._normalizeOperation(operation);

    if (!collection) {
      throw new Error('缺少 collection 字段');
    }

    if (operation.type === 'delete') {
      if (!documentId) {
        throw new Error('delete 操作缺少 documentId');
      }
      await mongoDBService.deleteOne(collection, { _id: documentId });
      return;
    }

    if (!documentId && !data?._id) {
      throw new Error(`${operation.type} 操作缺少 documentId/_id`);
    }

    const payload = {
      ...(data || {}),
      _id: documentId || data._id,
      updated_at: new Date(),
    };

    await this._upsertCollectionItems(collection, [payload]);
  }

  async _upsertCollectionItems(collectionName, items = []) {
    if (!Array.isArray(items) || items.length === 0) {
      return [];
    }

    const syncedIds = [];

    for (const item of items) {
      if (!item || !item._id) continue;

      const existsRemote = await mongoDBService.findOne(collectionName, { _id: item._id });

      if (existsRemote) {
        await mongoDBService.updateOne(collectionName, { _id: item._id }, {
          $set: {
            ...item,
            is_synced: true,
            updated_at: new Date(),
          },
        });
      } else {
        await mongoDBService.insertOne(collectionName, {
          ...item,
          _id: item._id,
          is_synced: true,
          created_at: item.created_at || new Date(),
          updated_at: new Date(),
        });
      }

      syncedIds.push(item._id);
    }

    return syncedIds;
  }

  /**
   * 同步笔记
   * @returns {Promise<boolean>} 是否成功
   */
  async syncNotes() {
    try {
      logService.info('开始同步笔记');

      // 获取本地需要同步的笔记
      const realm = await realmService.getRealm();
      const localNotes = realm.objects('Note').filtered('is_synced == false AND is_deleted == false');

      if (localNotes.length === 0) {
        logService.info('没有需要同步的笔记');
        return true;
      }

      logService.info(`发现 ${localNotes.length} 个需要同步的笔记`);

      // 将笔记转换为普通对象
      const notesToSync = Array.from(localNotes).map(note => realmService.realmObjectToPlain(note));

      // 实际同步到远端存储（逐条 upsert）
      const syncedIds = await this._upsertCollectionItems('notes', notesToSync);

      // 更新本地同步状态
      realm.write(() => {
        syncedIds.forEach(id => {
          const note = realm.objectForPrimaryKey('Note', id);
          if (note) {
            note.is_synced = true;
            note.updated_at = new Date();
          }
        });
      });

      logService.info(`成功同步 ${syncedIds.length} 个笔记`);
      return true;
    } catch (error) {
      logService.error('同步笔记失败', error);
      throw error;
    }
  }

  /**
   * 同步标签
   * @returns {Promise<boolean>} 是否成功
   */
  async syncTags() {
    try {
      logService.info('开始同步标签');

      // 获取本地需要同步的标签
      const realm = await realmService.getRealm();
      const localTags = realm.objects('Tag').filtered('is_synced == false AND is_deleted == false');

      if (localTags.length === 0) {
        logService.info('没有需要同步的标签');
        return true;
      }

      logService.info(`发现 ${localTags.length} 个需要同步的标签`);

      // 将标签转换为普通对象
      const tagsToSync = Array.from(localTags).map(tag => realmService.realmObjectToPlain(tag));

      // 实际同步到远端存储（逐条 upsert）
      const syncedIds = await this._upsertCollectionItems('tags', tagsToSync);

      // 更新同步状态
      realm.write(() => {
        syncedIds.forEach(id => {
          const tag = realm.objectForPrimaryKey('Tag', id);
          if (tag) {
            tag.is_synced = true;
            tag.updated_at = new Date();
          }
        });
      });

      logService.info(`成功同步 ${syncedIds.length} 个标签`);
      return true;
    } catch (error) {
      logService.error('同步标签失败', error);
      throw error;
    }
  }

  /**
   * 同步分类
   * @returns {Promise<boolean>} 是否成功
   */
  async syncCategories() {
    try {
      logService.info('开始同步分类');

      // 获取本地需要同步的分类
      const realm = await realmService.getRealm();
      const localCategories = realm.objects('Category').filtered('is_synced == false AND is_deleted == false');

      if (localCategories.length === 0) {
        logService.info('没有需要同步的分类');
        return true;
      }

      logService.info(`发现 ${localCategories.length} 个需要同步的分类`);

      // 将分类转换为普通对象
      const categoriesToSync = Array.from(localCategories).map(category => realmService.realmObjectToPlain(category));

      // 实际同步到远端存储（逐条 upsert）
      const syncedIds = await this._upsertCollectionItems('categories', categoriesToSync);

      // 更新同步状态
      realm.write(() => {
        syncedIds.forEach(id => {
          const category = realm.objectForPrimaryKey('Category', id);
          if (category) {
            category.is_synced = true;
            category.updated_at = new Date();
          }
        });
      });

      logService.info(`成功同步 ${syncedIds.length} 个分类`);
      return true;
    } catch (error) {
      logService.error('同步分类失败', error);
      throw error;
    }
  }

  /**
   * 同步设置
   * @returns {Promise<boolean>} 是否成功
   */
  async syncSettings() {
    try {
      logService.info('开始同步设置');

      // 获取本地设置
      const realm = await realmService.getRealm();
      const settings = realm.objects('StorageItem').filtered('key CONTAINS "settings."');

      if (settings.length === 0) {
        logService.info('没有需要同步的设置');
        return true;
      }

      const settingsToSync = Array.from(settings).map(setting => ({
        _id: String(setting.key),
        key: String(setting.key),
        value: setting.value,
        updated_at: new Date(),
      }));

      await this._upsertCollectionItems('settings', settingsToSync);

      logService.info(`成功同步 ${settingsToSync.length} 个设置项`);
      return true;
    } catch (error) {
      logService.error('同步设置失败', error);
      throw error;
    }
  }

  /**
   * 从服务器拉取数据
   * @param {Object} options 拉取选项
   * @param {boolean} options.force 是否强制拉取所有数据
   * @param {Array<string>} options.collections 要拉取的集合列表
   * @param {number} options.batchSize 每批拉取的数据量
   * @returns {Promise<boolean>} 是否成功
   */
  async pullFromServer(options = {}) {
    try {
      await this.initialize();

      // 检查网络状态
      if (!this.isOnline) {
        logService.warn('无法从服务器拉取数据：网络离线');
        throw new Error('无网络连接，无法从服务器拉取数据，请连接网络后重试');
      }

      // 检查是否已在同步
      if (this.isSyncing) {
        logService.warn('同步已在进行中，无法拉取数据');
        throw new Error('同步已在进行中，请稍后重试');
      }

      const {
        force = false,
        collections = ['notes', 'tags', 'categories'],
        batchSize = 100,
      } = options;

      // 如果不是强制拉取，检查上次同步时间
      if (!force && this.lastSyncTime) {
        const now = new Date();
        const timeSinceLastSync = now.getTime() - this.lastSyncTime.getTime();

        // 如果距离上次同步不到10分钟，跳过拉取
        if (timeSinceLastSync < 10 * 60 * 1000) {
          logService.info(`跳过拉取：距离上次同步不到10分钟 (${Math.round(timeSinceLastSync / 1000)}秒)`);
          return true;
        }
      }

      this.isSyncing = true;
      logService.info(`开始从服务器拉取数据 (${force ? '强制' : '普通'}模式)`);

      try {
        // 获取上次同步时间
        const syncTimestamp = this.lastSyncTime ? this.lastSyncTime.toISOString() : null;
        const incrementalFilter = !force && this.lastSyncTime
          ? {
              $or: [
                { updated_at: { $gt: this.lastSyncTime } },
                { updated_at: { $gt: syncTimestamp } },
                { created_at: { $gt: this.lastSyncTime } },
                { created_at: { $gt: syncTimestamp } },
              ],
            }
          : {};

        // 从远端存储拉取数据（普通模式按更新时间增量，强制模式全量）
        const [notes, tags, categories] = await Promise.all([
          collections.includes('notes') ? mongoDBService.find('notes', incrementalFilter) : Promise.resolve([]),
          collections.includes('tags') ? mongoDBService.find('tags', incrementalFilter) : Promise.resolve([]),
          collections.includes('categories') ? mongoDBService.find('categories', incrementalFilter) : Promise.resolve([]),
        ]);

        const serverData = {
          notes: Array.isArray(notes) ? notes : [],
          tags: Array.isArray(tags) ? tags : [],
          categories: Array.isArray(categories) ? categories : [],
          syncTimestamp,
        };

        // 并行处理各个集合的数据
        const updatePromises = [];

        if (collections.includes('notes') && serverData.notes.length > 0) {
          // 分批处理笔记数据
          for (let i = 0; i < serverData.notes.length; i += batchSize) {
            const batch = serverData.notes.slice(i, i + batchSize);
            updatePromises.push(this._updateLocalNotes(batch));
          }
        }

        if (collections.includes('tags') && serverData.tags.length > 0) {
          updatePromises.push(this._updateLocalTags(serverData.tags));
        }

        if (collections.includes('categories') && serverData.categories.length > 0) {
          updatePromises.push(this._updateLocalCategories(serverData.categories));
        }

        // 等待所有更新完成
        if (updatePromises.length > 0) {
          const results = await Promise.allSettled(updatePromises);
          const failedUpdates = results.filter(result => result.status === 'rejected');

          if (failedUpdates.length > 0) {
            logService.warn(`部分数据更新失败: ${failedUpdates.length}/${results.length}`);
          }
        } else {
          logService.info('没有需要更新的数据');
        }

        // 更新最后同步时间
        this.lastSyncTime = new Date();

        logService.info('从服务器拉取数据完成');
        return true;
      } finally {
        this.isSyncing = false;
      }
    } catch (error) {
      logService.error('从服务器拉取数据失败', error);
      this._classifyAndLogError(error, 'pullFromServer');
      this.isSyncing = false;
      throw error;
    }
  }

  /**
   * 更新本地笔记
   * @param {Array} serverNotes 服务器笔记
   * @returns {Promise<boolean>} 是否成功
   * @private
   */
  async _updateLocalNotes(serverNotes) {
    try {
      const realm = await realmService.getRealm();

      realm.write(() => {
        serverNotes.forEach(serverNote => {
          // 查找本地笔记
          const localNote = realm.objectForPrimaryKey('Note', serverNote._id);

          if (localNote) {
            // 更新现有笔记
            Object.keys(serverNote).forEach(key => {
              if (key !== '_id') {
                localNote[key] = serverNote[key];
              }
            });

            // 标记为已同步
            localNote.is_synced = true;
            localNote.updated_at = new Date();
          } else {
            // 创建新笔记 - 使用'modified'模式以防并发问题
            realm.create('Note', {
              ...serverNote,
              is_synced: true,
              updated_at: new Date(),
            }, 'modified');
          }
        });
      });

      return true;
    } catch (error) {
      logService.error('更新本地笔记失败', error);
      throw error;
    }
  }

  /**
   * 更新本地标签
   * @param {Array} serverTags 服务器标签
   * @returns {Promise<boolean>} 是否成功
   * @private
   */
  async _updateLocalTags(serverTags) {
    try {
      const realm = await realmService.getRealm();

      realm.write(() => {
        serverTags.forEach(serverTag => {
          // 查找本地标签
          const localTag = realm.objectForPrimaryKey('Tag', serverTag._id);

          if (localTag) {
            // 更新现有标签
            Object.keys(serverTag).forEach(key => {
              if (key !== '_id') {
                localTag[key] = serverTag[key];
              }
            });

            // 标记为已同步
            localTag.is_synced = true;
            localTag.updated_at = new Date();
          } else {
            // 创建新标签
            realm.create('Tag', {
              ...serverTag,
              is_synced: true,
              updated_at: new Date(),
            });
          }
        });
      });

      return true;
    } catch (error) {
      logService.error('更新本地标签失败', error);
      throw error;
    }
  }

  /**
   * 更新本地分类
   * @param {Array} serverCategories 服务器分类
   * @returns {Promise<boolean>} 是否成功
   * @private
   */
  async _updateLocalCategories(serverCategories) {
    try {
      const realm = await realmService.getRealm();

      realm.write(() => {
        serverCategories.forEach(serverCategory => {
          // 查找本地分类
          const localCategory = realm.objectForPrimaryKey('Category', serverCategory._id);

          if (localCategory) {
            // 更新现有分类
            Object.keys(serverCategory).forEach(key => {
              if (key !== '_id') {
                localCategory[key] = serverCategory[key];
              }
            });

            // 标记为已同步
            localCategory.is_synced = true;
            localCategory.updated_at = new Date();
          } else {
            // 创建新分类
            realm.create('Category', {
              ...serverCategory,
              is_synced: true,
              updated_at: new Date(),
            });
          }
        });
      });

      return true;
    } catch (error) {
      logService.error('更新本地分类失败', error);
      throw error;
    }
  }
}

export { SyncManager };

// 创建单例实例（延迟初始化，避免导入即注册网络监听导致双重同步入口）
const syncManager = new SyncManager();

export default syncManager;
