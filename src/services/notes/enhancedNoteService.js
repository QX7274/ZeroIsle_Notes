/**
 * 增强笔记服务 - 确保所有类型笔记的永久存储
 * 提供数据完整性保护、多重备份和错误恢复机制
 */

import { Alert } from 'react-native';
import { mongoDBService } from '../database/mongoDBAdapter';
import realmService from '../database/realmService';
import { networkService } from '../network/networkService';
import { logService } from '../../utils/logService';
import { OfflineQueue, SearchIndex } from '../../models';
import { fileService } from '../files/fileService';
import offlineDataService from '../storage/offlineDataService';
import { deviceIdentityService } from '../app/deviceIdentityService';
import crypto from 'crypto-js';

class EnhancedNoteService {
  constructor() {
    this.initialized = false;
    this.initializationPromise = null;
    this.collection = 'notes';
    this.maxRetries = 3;
    this.backupInterval = 5 * 60 * 1000; // 5分钟自动备份
    this.backupTimer = null;

    this.SYNC_STATUS = {
      PENDING: 'pending',
      SYNCING: 'syncing',
      SYNCED: 'synced',
      FAILED: 'failed',
      OFFLINE: 'offline',
      EMERGENCY: 'emergency',
    };
  }

_generateClientOpId() {
    try {
      return `op_${realmService.createObjectId()}`;
    } catch (e) {
      return `op_${Date.now()}`;
    }
  }

  async _upsertNoteSearchIndex(note) {
    try {
      const realm = await realmService.getRealm();
      const title = String(note.title || '未命名笔记');
      const content = String(note.content || '');

      // 避免索引膨胀：仅截取前 4000 字符用于离线检索
      const clippedContent = content.length > 4000 ? content.slice(0, 4000) : content;

      const tags = Array.isArray(note.tags) ? note.tags.map(String) : [];
      const keywords = title.split(/\s+/).filter(w => w.length >= 2).slice(0, 30);

      SearchIndex.createOrUpdate(realm, {
        entity_id: String(note._id),
        entity_type: 'note',
        user_id: String(note.user_id || 'local_user'),
        title,
        content: clippedContent,
        keywords,
        tags,
        category: note.category_id ? String(note.category_id) : null,
        metadata: {
          source: 'enhancedNoteService',
        },
        relevance_score: 1.0,
        language: 'zh-CN',
      });
    } catch (e) {
      logService.warn('[SearchIndex] 写入/更新索引失败，将忽略', e?.message || e);
    }
  }

  _mergeNoteFields(existingNote, updateData) {
    const merged = {
      ...existingNote,
      ...updateData,
    };

    // 文本字段：字段级更新，避免并发覆盖
    if (updateData.title !== undefined) {
      merged.title = String(updateData.title || '');
    }
    if (updateData.content !== undefined) {
      merged.content = String(updateData.content || '');
    }

    // tags：union 去重
    if (updateData.tags !== undefined) {
      const base = Array.isArray(existingNote.tags) ? existingNote.tags : [];
      const incoming = Array.isArray(updateData.tags) ? updateData.tags : [];
      merged.tags = Array.from(new Set([...base.map(String), ...incoming.map(String)]));
    }

    // attachments：union（按 _id）
    if (updateData.attachments !== undefined) {
      const baseArr = Array.isArray(existingNote.attachments) ? existingNote.attachments : [];
      const incomingArr = Array.isArray(updateData.attachments) ? updateData.attachments : [];
      const map = new Map();

      baseArr.forEach(a => {
        if (a && a._id) {map.set(String(a._id), a);}
      });
      incomingArr.forEach(a => {
        if (a && a._id) {
          const key = String(a._id);
          const prev = map.get(key) || {};
          map.set(key, { ...prev, ...a });
        }
      });

      merged.attachments = Array.from(map.values());
    }

    return merged;
  }
  async _writeSyncInfo({ entityId, entityType, operation, data, userId, deviceId, clientOpId, status = this.SYNC_STATUS.PENDING, error = null }) {
    try {
      const realm = await realmService.getRealm();
      const now = new Date();
      const record = {
        _id: `sync_${entityType}_${entityId}_${clientOpId || Date.now()}`,
        entity_id: String(entityId),
        entity_type: String(entityType),
        operation: String(operation),
        data: data ? JSON.stringify(data) : null,
        status: String(status),
        error: error ? String(error) : null,
        created_at: now,
        updated_at: now,
        updatedAt: now,
        user_id: userId ? String(userId) : null,
        device_id: deviceId ? String(deviceId) : null,
        deviceId: deviceId ? String(deviceId) : null,
        clientOpId: clientOpId ? String(clientOpId) : null,
        priority: 0,
      };

      realm.write(() => {
        realm.create('SyncInfo', record, 'modified');
      });

      return true;
    } catch (e) {
      logService.warn('写入SyncInfo失败，将忽略', e?.message || e);
      return false;
    }
  }

  _detectMergeConflicts(existingNote, updateData) {
    const conflicts = [];

    if (updateData.tags !== undefined && Array.isArray(existingNote.tags) && Array.isArray(updateData.tags)) {
      const baseSet = new Set(existingNote.tags.map(String));
      const incomingSet = new Set(updateData.tags.map(String));
      const overlap = [...incomingSet].some(t => baseSet.has(t));
      if (!overlap && existingNote.tags.length > 0 && updateData.tags.length > 0) {
        conflicts.push({ field: 'tags', type: 'set_union' });
      }
    }

    if (updateData.attachments !== undefined && Array.isArray(existingNote.attachments) && Array.isArray(updateData.attachments)) {
      const baseIds = new Set(existingNote.attachments.filter(a => a && a._id).map(a => String(a._id)));
      const incomingIds = new Set(updateData.attachments.filter(a => a && a._id).map(a => String(a._id)));
      const hasIntersection = [...incomingIds].some(id => baseIds.has(id));
      if (hasIntersection) {
        conflicts.push({ field: 'attachments', type: 'same_item_merge' });
      }
    }

    return conflicts;
  }

  /**
   * 初始化增强笔记服务
   */
  async initialize() {
    if (this.initialized) {return Promise.resolve();}

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = new Promise(async (resolve, reject) => {
      try {
        // 确保MongoDB服务已初始化（带错误处理）
        try {
          await mongoDBService.initialize();
        } catch (mongoError) {
          logService.warn('MongoDB服务初始化失败，将使用本地存储:', mongoError.message);
        }

        // 确保离线数据服务已初始化（带错误处理）
        try {
          await offlineDataService.initialize();
        } catch (offlineError) {
          logService.warn('离线数据服务初始化失败，将使用基础功能:', offlineError.message);
        }

        // 启动自动备份
        this.startAutoBackup();

        this.initialized = true;
        logService.info('增强笔记服务初始化成功');
        resolve();
      } catch (error) {
        logService.error('增强笔记服务初始化失败', error);
        reject(error);
      }
    });

    return this.initializationPromise;
  }

  /**
   * 创建笔记 - 增强版本
   * @param {Object} noteData 笔记数据
   * @returns {Promise<Object>} 创建的笔记对象
   */
  async createNote(noteData) {
    try {
      await this.initialize();

      const now = new Date();
      const noteId = noteData._id || realmService.createObjectId();

      // 生成数据完整性哈希
      const dataHash = this.generateDataHash(noteData);

      // 构建完整的笔记对象
      const clientOpId = noteData.clientOpId || this._generateClientOpId();
      const deviceId = await deviceIdentityService.getDeviceId();

      const note = {
        _id: noteId,
        title: String(noteData.title || ''),
        content: String(noteData.content || ''),
        type: String(noteData.type || 'text'),
        updatedAt: now,
        deviceId,
        device_id: deviceId,
        clientOpId,
        tags: Array.isArray(noteData.tags) ? noteData.tags.map(tag => String(tag)) : [],
        category_id: noteData.category_id ? String(noteData.category_id) : null,
        is_deleted: false,
        created_at: now,
        updated_at: now,
        is_synced: networkService.isOnline(),
        user_id: noteData.user_id ? String(noteData.user_id) : (realmService.getCurrentUser()?.id ? String(realmService.getCurrentUser().id) : null),

        // 文件相关字段
        file_path: noteData.file_uri || noteData.file_path || noteData.path || noteData.uri || null,
        file_uri: noteData.file_uri || noteData.uri || null,
        file_name: noteData.file_name || null,
        file_size: Number.isFinite(noteData.file_size) ? noteData.file_size : 0,
        file_type: noteData.file_type || noteData.type || null,
        file_hash: noteData.file_hash || null,
        thumbnail_path: noteData.thumbnail_path || null,

        // 画布相关字段
        strokeData: noteData.strokeData ? String(noteData.strokeData) : null,
        viewport: noteData.viewport ? String(noteData.viewport) : null,
        canvasStyle: noteData.canvasStyle ? String(noteData.canvasStyle) : null,
        paths: noteData.paths ? String(noteData.paths) : null,
        images: noteData.images ? String(noteData.images) : null,
        canvasVersion: Number.isFinite(noteData.canvasVersion) ? noteData.canvasVersion : 1,

        // 分页笔记字段（与 Realm int/double 非空字段保持一致）
        currentPage: Number.isFinite(noteData.currentPage) ? noteData.currentPage : 1,
        totalPages: Number.isFinite(noteData.totalPages) ? noteData.totalPages : 1,
        pageStyle: noteData.pageStyle ? String(noteData.pageStyle) : null,
        pages: noteData.pages ? String(noteData.pages) : null,
        scale: Number.isFinite(noteData.scale) ? noteData.scale : 1.0,

        // PDF相关字段
        pdfPath: noteData.pdfPath ? String(noteData.pdfPath) : null,
        pdfCurrentPage: noteData.pdfCurrentPage || null,
        pdfTotalPages: noteData.pdfTotalPages || null,
        pdfScale: noteData.pdfScale || null,
        pdfAnnotations: noteData.pdfAnnotations ? String(noteData.pdfAnnotations) : null,
        pdfScrollPosition: noteData.pdfScrollPosition || null,
        pdfBookmarks: noteData.pdfBookmarks ? String(noteData.pdfBookmarks) : null,

        // 音频/视频字段
        audioPath: noteData.audioPath ? String(noteData.audioPath) : null,
        videoPath: noteData.videoPath ? String(noteData.videoPath) : null,
        duration: noteData.duration || null,
        audioTranscription: noteData.audioTranscription ? String(noteData.audioTranscription) : null,
        videoThumbnails: noteData.videoThumbnails ? String(noteData.videoThumbnails) : null,

        // 图片字段
        imagePath: noteData.imagePath ? String(noteData.imagePath) : null,
        imageWidth: noteData.imageWidth || null,
        imageHeight: noteData.imageHeight || null,
        imageFormat: noteData.imageFormat ? String(noteData.imageFormat) : null,

        // Word文档字段
        wordPath: noteData.wordPath ? String(noteData.wordPath) : null,
        wordContent: noteData.wordContent ? String(noteData.wordContent) : null,
        wordMetadata: noteData.wordMetadata ? String(noteData.wordMetadata) : null,

        // 数据完整性保护字段
        dataHash: dataHash,
        backupCount: 0,
        lastBackupAt: null,
        syncStatus: networkService.isOnline() ? this.SYNC_STATUS.PENDING : this.SYNC_STATUS.OFFLINE,
        syncError: null,
        retryCount: 0,
        lastRetryAt: null,

        // 元数据
        metadata: typeof noteData.metadata === 'object' ?
                JSON.stringify(noteData.metadata) :
                typeof noteData.metadata === 'string' ?
                noteData.metadata : '{}',
      };

      // 多重存储策略
      const results = await Promise.allSettled([
        this.saveToRealm(note),
        this.saveToBackup(note),
        this.saveToOfflineQueue(note),
      ]);

      // 检查存储结果
      const realmResult = results[0];
      const backupResult = results[1];
      const queueResult = results[2];

      if (realmResult.status === 'fulfilled') {
        logService.info(`笔记创建成功(ID: ${noteId})`);

        // 异步更新搜索索引（不阻塞主流程）
        this._upsertNoteSearchIndex(note).catch(err => {
          logService.warn('[SearchIndex] 异步更新索引失败', err);
        });

        // 如果在线，尝试同步
        if (networkService.isOnline()) {
          this.syncNoteToServer(noteId).catch(error => {
            logService.error(`同步笔记失败(ID: ${noteId})`, error);
          });
        }

        return realmResult.value;
      } else {
        throw new Error(`笔记创建失败: ${realmResult.reason}`);
      }

    } catch (error) {
      logService.error('创建笔记失败', error);

      // 尝试紧急恢复
      try {
        return await this.emergencyRecovery(noteData);
      } catch (recoveryError) {
        logService.error('紧急恢复失败', recoveryError);
        throw error;
      }
    }
  }

  /**
   * 更新笔记 - 增强版本
   * @param {string} noteId 笔记ID
   * @param {Object} updateData 更新数据
   * @returns {Promise<Object>} 更新后的笔记对象
   */
  async updateNote(noteId, updateData, options = {}) {
    try {
      await this.initialize();

      // 获取现有笔记
      const existingNote = await this.getNoteById(noteId);
      if (!existingNote) {
        throw new Error(`笔记不存在(ID: ${noteId})`);
      }

      // 生成幂等操作ID
      const clientOpId = updateData.clientOpId || this._generateClientOpId();
      const now = new Date();

      // 字段级合并：避免并发覆盖
      const mergedNote = this._mergeNoteFields(existingNote, updateData);

      // 冲突审计：检测字段级合并的潜在冲突并记录 SyncInfo
      try {
        const deviceId = mergedNote.deviceId || mergedNote.device_id || updateData.deviceId || updateData.device_id || null;
        const conflicts = this._detectMergeConflicts(existingNote, updateData);
        if (conflicts && conflicts.length > 0) {
          await this._writeSyncInfo({
            entityId: noteId,
            entityType: 'note',
            operation: 'conflict',
            data: {
              conflicts,
              fields: Object.keys(updateData || {}),
            },
            userId: mergedNote.user_id || updateData.user_id || null,
            deviceId,
            clientOpId,
            status: 'conflict',
          });
        }
      } catch (auditErr) {
        logService.warn('冲突审计写入失败，将忽略', auditErr?.message || auditErr);
      }

      const resolvedDeviceId = await deviceIdentityService.getDeviceId();

      const shouldUpdateSyncFields = options.updateSyncFields !== false;

      const updatedNote = {
        ...mergedNote,
        updated_at: now,
        updatedAt: mergedNote.updatedAt || now,
        deviceId: resolvedDeviceId,
        device_id: resolvedDeviceId,
        clientOpId,
        canvasVersion: (existingNote.canvasVersion || 1) + 1,
      };

      if (shouldUpdateSyncFields) {
        updatedNote.syncStatus = networkService.isOnline() ? this.SYNC_STATUS.PENDING : this.SYNC_STATUS.OFFLINE;
        updatedNote.retryCount = 0;
        updatedNote.lastRetryAt = null;
      }

      // 重新生成数据哈希
      updatedNote.dataHash = this.generateDataHash(updatedNote);

      // 多重存储策略
      const results = await Promise.allSettled([
        this.saveToRealm(updatedNote),
        this.saveToBackup(updatedNote),
        this.saveToOfflineQueue(updatedNote),
      ]);

      const realmResult = results[0];
      if (realmResult.status === 'fulfilled') {
        logService.info(`笔记更新成功(ID: ${noteId})`);

        // 如果在线，尝试同步
        if (networkService.isOnline()) {
          this.syncNoteToServer(noteId).catch(error => {
            logService.error(`同步笔记失败(ID: ${noteId})`, error);
          });
        }

        return realmResult.value;
      } else {
        throw new Error(`笔记更新失败: ${realmResult.reason}`);
      }

    } catch (error) {
      logService.error(`更新笔记失败(ID: ${noteId})`, error);
      throw error;
    }
  }

  /**
   * 保存到Realm数据库
   * @private
   */
  async saveToRealm(note) {
    try {
      const realm = await realmService.getRealm();
      let savedNote;

      realm.write(() => {
        // 检查是否已存在
        const existingNote = realm.objectForPrimaryKey('Note', note._id);
        if (existingNote) {
          // 更新现有笔记，但不修改主键
          const { _id, ...updateData } = note; // 排除主键
          Object.assign(existingNote, updateData);
          savedNote = existingNote;
        } else {
          // 使用'modified'模式：如果Note已存在则更新，不存在则创建
          savedNote = realm.create('Note', note, 'modified');
        }
      });

      return savedNote;
    } catch (error) {
      logService.error('保存到Realm失败', error);
      throw error;
    }
  }

  /**
   * 保存到备份存储
   * @private
   */
  async saveToBackup(note) {
    try {
      // 创建备份记录，使用正确的NoteBackup结构
      const backupNote = {
        _id: realmService.createObjectId(),
        note_id: note._id, // 关联的笔记ID
        backup_data: JSON.stringify(note), // 将笔记数据序列化为JSON字符串
        backup_type: 'auto', // 自动备份
        created_at: new Date(),
        lastBackupAt: new Date(),
        size: JSON.stringify(note).length, // 备份数据大小
        user_id: note.user_id || null,
        metadata: JSON.stringify({
          backupCount: (note.backupCount || 0) + 1,
          originalType: note.type,
          originalTitle: note.title,
        }),
      };

      // 保存到备份存储
      const realm = await realmService.getRealm();
      realm.write(() => {
        realm.create('NoteBackup', backupNote);
      });

      logService.info(`笔记备份成功(ID: ${note._id})`);
      return backupNote;
    } catch (error) {
      logService.error('保存到备份失败', error);
      // 备份失败不应该影响主流程
      return null;
    }
  }

  /**
   * 保存到离线队列 - 增强版本 (使用 Realm OfflineQueue)
   * @private
   */
  async saveToOfflineQueue(note) {
    try {
      const realm = await realmService.getRealm();
      const clientOpId = note.clientOpId;
      const deviceId = note.deviceId || note.device_id;
      const userId = note.user_id;

      if (!clientOpId) {
        logService.warn('缺失 clientOpId，跳过离线队列保存');
        return note;
      }

      // 1. 幂等检查：如果已存在相同 clientOpId 的待处理项，则跳过
      const existing = realm.objects('OfflineQueue').filtered(
        'clientOpId == $0 AND deviceId == $1 AND status != "synced"',
        clientOpId,
        deviceId
      );

      if (existing.length > 0) {
        logService.info(`[OfflineQueue] 幂等触发：操作 ${clientOpId} 已在队列中`);
        return note;
      }

      // 2. 写入 Realm OfflineQueue
      const now = new Date();
      realm.write(() => {
        realm.create('OfflineQueue', {
          _id: realmService.createObjectId(),
          entity_id: note._id,
          entity_type: 'Note',
          operation: note.is_deleted ? 'delete' : 'update', // 简化判定，create 也是一种 update
          data: JSON.stringify(note),
          user_id: userId,
          status: this.SYNC_STATUS.PENDING,
          retry_count: 0,
          created_at: now,
          updated_at: now,
          deviceId,
          clientOpId,
          priority: 0,
        }, 'modified');
      });

      logService.info(`[OfflineQueue] 笔记操作已入队: ${clientOpId}`);
      return note;
    } catch (error) {
      logService.error('保存到离线队列失败', error);
      // 离线队列失败不应该影响主流程
      return null;
    }
  }

  /**
   * 生成数据完整性哈希
   * @private
   */
  generateDataHash(noteData) {
    try {
      // 创建用于哈希的数据副本
      const hashData = {
        title: noteData.title,
        content: noteData.content,
        type: noteData.type,
        strokeData: noteData.strokeData,
        viewport: noteData.viewport,
        pdfAnnotations: noteData.pdfAnnotations,
        audioTranscription: noteData.audioTranscription,
        wordContent: noteData.wordContent,
      };

      const hashString = JSON.stringify(hashData);
      return crypto.SHA256(hashString).toString();
    } catch (error) {
      logService.error('生成数据哈希失败', error);
      return null;
    }
  }

  /**
   * 验证数据完整性
   * @param {Object} note 笔记对象
   * @returns {boolean} 是否完整
   */
  validateDataIntegrity(note) {
    try {
      if (!note.dataHash) {
        return false;
      }

      const currentHash = this.generateDataHash(note);
      return currentHash === note.dataHash;
    } catch (error) {
      logService.error('验证数据完整性失败', error);
      return false;
    }
  }

  /**
   * 转换为可同步到远端的安全白名单字段
   * @private
   */
  _toPlainRemoteNote(note) {
    const plain = {
      _id: String(note?._id || ''),
      title: String(note?.title || ''),
      content: String(note?.content || ''),
      type: String(note?.type || 'text'),
      user_id: note?.user_id ? String(note.user_id) : null,
      category_id: note?.category_id ? String(note.category_id) : null,
      tags: Array.isArray(note?.tags) ? note.tags.map(t => String(t)) : [],
      is_deleted: !!note?.is_deleted,
      is_synced: true,
      syncError: null,
      syncStatus: this.SYNC_STATUS.SYNCED,
      deviceId: note?.deviceId ? String(note.deviceId) : (note?.device_id ? String(note.device_id) : null),
      device_id: note?.device_id ? String(note.device_id) : (note?.deviceId ? String(note.deviceId) : null),
      clientOpId: note?.clientOpId ? String(note.clientOpId) : null,
      created_at: note?.created_at ? new Date(note.created_at) : new Date(),
      updated_at: new Date(),
      updatedAt: note?.updatedAt ? new Date(note.updatedAt) : new Date(),
      dataHash: note?.dataHash ? String(note.dataHash) : null,
      metadata: typeof note?.metadata === 'string' ? note.metadata : JSON.stringify(note?.metadata || {}),
      attachments: Array.isArray(note?.attachments)
        ? note.attachments.map(a => ({
            _id: a?._id ? String(a._id) : realmService.createObjectId(),
            name: a?.name ? String(a.name) : '',
            type: a?.type ? String(a.type) : 'unknown',
            url: a?.url ? String(a.url) : null,
            local_path: a?.local_path ? String(a.local_path) : null,
            size: typeof a?.size === 'number' ? a.size : null,
            created_at: a?.created_at ? new Date(a.created_at) : new Date(),
            updated_at: new Date(),
            note_id: note?._id ? String(note._id) : null,
            user_id: note?.user_id ? String(note.user_id) : null,
          }))
        : [],
    };

    return plain;
  }

  /**
   * 通用重试（指数退避）
   * @private
   */
  _isRetryableSyncError(error) {
    const message = String(error?.message || '').toLowerCase();
    const code = String(error?.code || '').toLowerCase();

    const retryableKeywords = [
      'network',
      'timeout',
      'econnreset',
      'econnrefused',
      'etimedout',
      'socket hang up',
      'temporarily unavailable',
      '503',
      '502',
      '504',
    ];

    if (retryableKeywords.some(k => message.includes(k) || code.includes(k))) {
      return true;
    }

    if (error?.isAxiosError && !error?.response) {
      return true;
    }

    const status = Number(error?.response?.status || 0);
    return [429, 502, 503, 504].includes(status);
  }

  async _retryWithBackoff(task, maxRetries = 3, baseDelayMs = 500) {
    let attempt = 0;
    let lastError = null;

    while (attempt <= maxRetries) {
      try {
        return await task();
      } catch (error) {
        lastError = error;

        // 非网络类/不可重试错误，直接抛出
        if (!this._isRetryableSyncError(error)) {
          throw error;
        }

        if (attempt >= maxRetries) break;
        const delay = baseDelayMs * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
        attempt += 1;
      }
    }

    throw lastError || new Error('retry_with_backoff_failed');
  }

  async syncNoteToServer(noteId) {
    let note = null;

    try {
      note = await this.getNoteById(noteId);
      if (!note) {
        throw new Error(`笔记不存在(ID: ${noteId})`);
      }

      // 更新同步状态
      await this.updateNote(noteId, { syncStatus: this.SYNC_STATUS.SYNCING }, { updateSyncFields: false });

      // 实际同步：优先更新，若不存在则创建
      const remotePayload = this._toPlainRemoteNote(note);
      const existsRemote = await mongoDBService.findOne(this.collection, { _id: noteId });

      if (existsRemote) {
        await this._retryWithBackoff(async () => {
          await mongoDBService.updateOne(this.collection, { _id: noteId }, {
            $set: {
              ...remotePayload,
              updated_at: new Date(),
            },
          });
        }, 2, 400);
      } else {
        await this._retryWithBackoff(async () => {
          await mongoDBService.insertOne(this.collection, {
            ...remotePayload,
            _id: noteId,
            created_at: remotePayload.created_at || new Date(),
            updated_at: new Date(),
          });
        }, 2, 400);
      }

      await this.updateNote(noteId, {
        syncStatus: this.SYNC_STATUS.SYNCED,
        is_synced: true,
        syncError: null,
      }, { updateSyncFields: false });

      logService.info(`笔记同步成功(ID: ${noteId})`);
    } catch (error) {
      const safeRetryCount = Number(note?.retryCount || 0) + 1;
      const retryable = this._isRetryableSyncError(error);

      logService.error(`笔记同步失败(ID: ${noteId})`, {
        message: error?.message || String(error),
        code: error?.code || null,
        httpStatus: error?.response?.status || null,
        retryable,
        retryCount: safeRetryCount,
        maxRetries: this.maxRetries,
      });

      // 更新同步状态为失败（失败路径不应再次抛出未定义变量错误）
      await this.updateNote(noteId, {
        syncStatus: this.SYNC_STATUS.FAILED,
        syncError: error.message,
        retryCount: safeRetryCount,
        lastRetryAt: new Date(),
      }, { updateSyncFields: false });

      throw error;
    }
  }

  /**
   * 紧急恢复机制
   * @private
   */
  async emergencyRecovery(noteData) {
    try {
      logService.warn('启动紧急恢复机制');

      // 尝试从备份恢复
      const backupNote = await this.getLatestBackup(noteData._id);
      if (backupNote) {
        logService.info('从备份恢复笔记成功');
        return backupNote;
      }

      // 如果备份不存在，禁止创建最小化笔记（避免伪流程）
      throw new Error('紧急恢复失败：未找到可用备份，禁止生成最小化笔记');
    } catch (error) {
      logService.error('紧急恢复失败', error);
      throw error;
    }
  }

  /**
   * 获取最新备份
   * @private
   */
  async getLatestBackup(noteId) {
    try {
      const realm = await realmService.getRealm();
      const backups = realm.objects('NoteBackup')
        .filtered('_id == $0', noteId)
        .sorted('lastBackupAt', true);

      return backups.length > 0 ? backups[0] : null;
    } catch (error) {
      logService.error('获取备份失败', error);
      return null;
    }
  }

  /**
   * 启动自动备份
   * @private
   */
  startAutoBackup() {
    if (this.backupTimer) {
      clearInterval(this.backupTimer);
    }

    this.backupTimer = setInterval(async () => {
      try {
        await this.performAutoBackup();
      } catch (error) {
        logService.error('自动备份失败', error);
      }
    }, this.backupInterval);
  }

  /**
   * 执行自动备份
   * @private
   */
  async performAutoBackup() {
    try {
      const realm = await realmService.getRealm();
      const notes = realm.objects('Note').filtered('is_deleted == false');

      let backupCount = 0;
      for (const note of notes) {
        try {
          await this.saveToBackup(note);
          backupCount++;
        } catch (error) {
          logService.error(`备份笔记失败(ID: ${note._id})`, error);
        }
      }

      logService.info(`自动备份完成，备份了 ${backupCount} 个笔记`);
    } catch (error) {
      logService.error('执行自动备份失败', error);
    }
  }

  /**
   * 获取笔记
   */
  async getNoteById(noteId) {
    try {
      await this.initialize();

      const realm = await realmService.getRealm();
      const note = realm.objectForPrimaryKey('Note', noteId);

      if (!note) {
        return null;
      }

      // 验证数据完整性
      if (!this.validateDataIntegrity(note)) {
        logService.warn(`笔记数据完整性验证失败(ID: ${noteId})`);

        // 尝试从备份恢复
        const backupNote = await this.getLatestBackup(noteId);
        if (backupNote) {
          logService.info(`从备份恢复笔记(ID: ${noteId})`);
          return backupNote;
        }
      }

      return note;
    } catch (error) {
      logService.error(`获取笔记失败(ID: ${noteId})`, error);
      throw error;
    }
  }

  /**
   * 获取所有笔记
   */
  async getNotes(options = {}) {
    try {
      await this.initialize();

      const {
        filter = {},
        sort = { updated_at: -1 },
        limit = 100,
        skip = 0,
        lite = true,
      } = options;

      const realm = await realmService.getRealm();
      let notes = realm.objects('Note').filtered('is_deleted == false');

      // 应用排序
      if (sort && Object.keys(sort).length > 0) {
        const sortField = Object.keys(sort)[0];
        const sortDirection = sort[sortField] === -1;
        notes = notes.sorted(sortField, sortDirection);
      }

      // 应用过滤（目前仅支持简单字段过滤，避免复杂查询导致的性能与注入问题）
      if (filter && typeof filter === 'object') {
        Object.keys(filter).forEach((k) => {
          const v = filter[k];
          if (v === undefined) return;
          try {
            if (typeof v === 'string') {
              notes = notes.filtered(`${k} == $0`, String(v));
            } else if (typeof v === 'number') {
              notes = notes.filtered(`${k} == $0`, v);
            } else if (typeof v === 'boolean') {
              notes = notes.filtered(`${k} == $0`, v);
            }
          } catch (e) {
            logService.warn(`[Performance] 跳过无法应用的过滤条件: ${k}`, e?.message || e);
          }
        });
      }

      const start = skip || 0;
      const safeLimit = Number.isFinite(limit) && limit > 0 ? limit : 100;
      const end = start + safeLimit;

      const page = notes.slice(start, end);

      // 字段裁剪：列表默认返回 lite 版，避免加载大字段造成掉帧/爆内存
      // 注意：Realm 对象访问属性会触发加载，因此这里构造轻量对象
      const results = Array.from(page).map(n => {
        if (!lite) return n;
        return {
          _id: n._id,
          title: n.title,
          type: n.type,
          updated_at: n.updated_at,
          updatedAt: n.updatedAt,
          created_at: n.created_at,
          user_id: n.user_id,
          category_id: n.category_id,
          tags: Array.isArray(n.tags) ? Array.from(n.tags) : [],
          is_deleted: n.is_deleted,
          is_synced: n.is_synced,
          syncStatus: n.syncStatus,
          deviceId: n.deviceId,
          clientOpId: n.clientOpId,
          attachments: Array.isArray(n.attachments) ? n.attachments.map(a => ({
            _id: a?._id,
            name: a?.name,
            type: a?.type,
            url: a?.url,
            local_path: a?.local_path,
            size: a?.size,
          })) : [],
        };
      });

      return results;
    } catch (error) {
      logService.error('获取笔记列表失败', error);
      throw error;
    }
  }

  /**
   * 删除笔记（软删除）
   */
  async deleteNote(noteId) {
    try {
      await this.initialize();

      const update = {
        is_deleted: true,
        deleted_at: new Date(),
        updated_at: new Date(),
        syncStatus: networkService.isOnline() ? this.SYNC_STATUS.PENDING : this.SYNC_STATUS.OFFLINE,
      };

      return await this.updateNote(noteId, update);
    } catch (error) {
      logService.error(`删除笔记失败(ID: ${noteId})`, error);
      throw error;
    }
  }

  /**
   * 永久删除笔记
   */
  async permanentlyDeleteNote(noteId) {
    try {
      await this.initialize();

      const realm = await realmService.getRealm();
      realm.write(() => {
        const note = realm.objectForPrimaryKey('Note', noteId);
        if (note) {
          realm.delete(note);
        }
      });

      logService.info(`笔记永久删除成功(ID: ${noteId})`);
      return true;
    } catch (error) {
      logService.error(`永久删除笔记失败(ID: ${noteId})`, error);
      throw error;
    }
  }

  /**
   * 销毁服务
   */
  destroy() {
    if (this.backupTimer) {
      clearInterval(this.backupTimer);
      this.backupTimer = null;
    }

    this.initialized = false;
    this.initializationPromise = null;
  }
}

// 创建单例实例
const enhancedNoteService = new EnhancedNoteService();

export default enhancedNoteService;
export { EnhancedNoteService };




