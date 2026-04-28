/**
 * 文件模型适配器
 * 用于在前端和后端模型之间进行转换
 */

import { File } from '../models';
import realmService from '../services/database/realmService';
import { logService } from '../utils/logService';
import { offlineSyncService } from '../services/offline/offlineSyncService';

/**
 * 将后端文件模型转换为前端文件对象
 * @param {Object} file 后端文件模型
 * @returns {Object} 前端文件对象
 */
export const toFrontendFile = (file) => {
  if (!file) {return null;}

  try {
    return {
      id: file._id,
      name: file.name || '',
      originalName: file.original_name || '',
      path: file.path || '',
      size: file.size || 0,
      mimeType: file.mime_type || '',
      extension: file.extension || '',
      type: file.type || 'other',
      hash: file.hash,
      thumbnailPath: file.thumbnail_path,
      metadata: { ...(file.metadata || {}) },
      storageLocation: file.storage_location || 'local',
      cloudPath: file.cloud_path,
      cloudProvider: file.cloud_provider,
      userId: file.user_id,
      noteId: file.note_id,
      isDeleted: file.is_deleted || false,
      isSynced: file.is_synced || false,
      createdAt: file.created_at ? new Date(file.created_at) : new Date(),
      updatedAt: file.updated_at ? new Date(file.updated_at) : new Date(),
      deletedAt: file.deleted_at ? new Date(file.deleted_at) : null,
      lastAccessedAt: file.last_accessed_at ? new Date(file.last_accessed_at) : null,
      isPublic: file.is_public || false,
      publicUrl: file.public_url,
      expiryDate: file.expiry_date ? new Date(file.expiry_date) : null,
      tags: [...(file.tags || [])],
    };
  } catch (error) {
    logService.error('转换文件模型失败', error);
    return null;
  }
};

/**
 * 将前端文件对象转换为后端文件模型
 * @param {Object} file 前端文件对象
 * @returns {Object} 后端文件模型
 */
export const toBackendFile = (file) => {
  if (!file) {return null;}

  try {
    return {
      _id: file.id,
      name: file.name || '',
      original_name: file.originalName || '',
      path: file.path || '',
      size: file.size || 0,
      mime_type: file.mimeType || '',
      extension: file.extension || '',
      type: file.type || 'other',
      hash: file.hash,
      thumbnail_path: file.thumbnailPath,
      metadata: { ...(file.metadata || {}) },
      storage_location: file.storageLocation || 'local',
      cloud_path: file.cloudPath,
      cloud_provider: file.cloudProvider,
      user_id: file.userId,
      note_id: file.noteId,
      is_deleted: file.isDeleted || false,
      is_synced: file.isSynced || false,
      created_at: file.createdAt || new Date(),
      updated_at: file.updatedAt || new Date(),
      deleted_at: file.deletedAt || null,
      last_accessed_at: file.lastAccessedAt || null,
      is_public: file.isPublic || false,
      public_url: file.publicUrl,
      expiry_date: file.expiryDate || null,
      tags: [...(file.tags || [])],
    };
  } catch (error) {
    logService.error('转换文件对象失败', error);
    return null;
  }
};

/**
 * 创建文件
 * @param {Object} fileData 文件数据
 * @param {string} userId 用户ID
 * @returns {Promise<Object>} 创建的文件
 */
export const createFile = async (fileData, userId) => {
  try {
    // 准备文件数据
    const now = new Date();
    const fileId = realmService.createObjectId();

    const backendFile = {
      _id: fileId,
      name: fileData.name || fileData.originalName || '',
      original_name: fileData.originalName || fileData.name || '',
      path: fileData.path || '',
      size: fileData.size || 0,
      mime_type: fileData.mimeType || '',
      extension: fileData.extension || '',
      type: fileData.type || 'other',
      hash: fileData.hash,
      thumbnail_path: fileData.thumbnailPath,
      metadata: { ...(fileData.metadata || {}) },
      storage_location: fileData.storageLocation || 'local',
      cloud_path: fileData.cloudPath,
      cloud_provider: fileData.cloudProvider,
      user_id: userId,
      note_id: fileData.noteId,
      is_deleted: false,
      is_synced: false,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      last_accessed_at: now,
      is_public: fileData.isPublic || false,
      public_url: fileData.publicUrl,
      expiry_date: fileData.expiryDate,
      tags: [...(fileData.tags || [])],
    };

    // 使用 Realm 创建文件
    const realm = await realmService.getRealm();
    let file;
    realm.write(() => {
      file = realm.create('File', backendFile);
    });

    // 添加到同步队列
    await offlineSyncService.addToSyncQueue({
      entity_id: file._id,
      entity_type: 'file',
      operation: 'create',
      data: file.toJSON(),
      user_id: userId,
    });

    // 返回前端文件对象
    return toFrontendFile(file);
  } catch (error) {
    logService.error('创建文件失败', error);
    throw error;
  }
};

/**
 * 更新文件
 * @param {string} fileId 文件ID
 * @param {Object} fileData 文件数据
 * @returns {Promise<Object>} 更新后的文件
 */
export const updateFile = async (fileId, fileData) => {
  try {
    // 使用 Realm 查找文件
    const realm = await realmService.getRealm();
    const file = realm.objectForPrimaryKey('File', fileId);

    if (!file) {
      throw new Error(`文件不存在: ${fileId}`);
    }

    // 更新文件属性
    realm.write(() => {
      if (fileData.name !== undefined) {file.name = fileData.name;}
      if (fileData.originalName !== undefined) {file.original_name = fileData.originalName;}
      if (fileData.path !== undefined) {file.path = fileData.path;}
      if (fileData.size !== undefined) {file.size = fileData.size;}
      if (fileData.mimeType !== undefined) {file.mime_type = fileData.mimeType;}
      if (fileData.extension !== undefined) {file.extension = fileData.extension;}
      if (fileData.type !== undefined) {file.type = fileData.type;}
      if (fileData.hash !== undefined) {file.hash = fileData.hash;}
      if (fileData.thumbnailPath !== undefined) {file.thumbnail_path = fileData.thumbnailPath;}
      if (fileData.metadata !== undefined) {file.metadata = JSON.stringify(fileData.metadata);}
      if (fileData.storageLocation !== undefined) {file.storage_location = fileData.storageLocation;}
      if (fileData.cloudPath !== undefined) {file.cloud_path = fileData.cloudPath;}
      if (fileData.cloudProvider !== undefined) {file.cloud_provider = fileData.cloudProvider;}
      if (fileData.noteId !== undefined) {file.note_id = fileData.noteId;}
      if (fileData.isPublic !== undefined) {file.is_public = fileData.isPublic;}
      if (fileData.publicUrl !== undefined) {file.public_url = fileData.publicUrl;}
      if (fileData.expiryDate !== undefined) {file.expiry_date = fileData.expiryDate;}
      if (fileData.tags !== undefined) {file.tags = [...fileData.tags];}


      // 更新时间
      file.updated_at = new Date();
      file.is_synced = false;
    });

    // 添加到同步队列
    await offlineSyncService.addToSyncQueue({
      entity_id: file._id,
      entity_type: 'file',
      operation: 'update',
      data: file.toJSON ? file.toJSON() : { ...file },
      user_id: file.user_id,
    });

    // 返回前端文件对象
    return toFrontendFile(file);
  } catch (error) {
    logService.error(`更新文件失败: ${fileId}`, error);
    throw error;
  }
};

/**
 * 删除文件
 * @param {string} fileId 文件ID
 * @param {boolean} permanent 是否永久删除
 * @returns {Promise<boolean>} 是否成功
 */
export const deleteFile = async (fileId, permanent = false) => {
  try {
    // 使用 Realm 查找文件
    const realm = await realmService.getRealm();
    const file = realm.objectForPrimaryKey('File', fileId);

    if (!file) {
      throw new Error(`文件不存在: ${fileId}`);
    }

    if (permanent) {
      // 永久删除
      realm.write(() => {
        realm.delete(file);
      });
    } else {
      // 软删除
      realm.write(() => {
        file.is_deleted = true;
        file.deleted_at = new Date();
        file.updated_at = new Date();
        file.is_synced = false;
      });

      // 添加到同步队列
      await offlineSyncService.addToSyncQueue({
        entity_id: file._id,
        entity_type: 'file',
        operation: 'update',
        data: file.toJSON ? file.toJSON() : { ...file },
        user_id: file.user_id,
      });
    }

    return true;
  } catch (error) {
    logService.error(`删除文件失败: ${fileId}`, error);
    throw error;
  }
};

/**
 * 获取文件列表
 * @param {string} userId 用户ID
 * @param {Object} options 选项
 * @returns {Promise<Array<Object>>} 文件列表
 */
export const getFiles = async (userId, options = {}) => {
  try {
    // 使用 Realm 查找文件
    const realm = await realmService.getRealm();
    let query = `user_id = "${userId}" AND is_deleted = false`;
    if (options.note_id) {
      query += ` AND note_id = "${options.note_id}"`;
    }
    const files = realm.objects('File').filtered(query).sorted('updated_at', true);

    // 转换为前端文件对象
    return Array.from(files).map(toFrontendFile);
  } catch (error) {
    logService.error('获取文件列表失败', error);
    throw error;
  }
};

/**
 * 获取文件详情
 * @param {string} fileId 文件ID
 * @returns {Promise<Object>} 文件详情
 */
export const getFileById = async (fileId) => {
  try {
    // 使用 Realm 查找文件
    const realm = await realmService.getRealm();
    const file = realm.objectForPrimaryKey('File', fileId);

    if (!file) {
      throw new Error(`文件不存在: ${fileId}`);
    }

    // 更新最后访问时间
    file.last_accessed_at = new Date();
    await file.save();

    // 转换为前端文件对象
    return toFrontendFile(file);
  } catch (error) {
    logService.error(`获取文件详情失败: ${fileId}`, error);
    throw error;
  }
};

/**
 * 查找笔记的文件
 * @param {string} noteId 笔记ID
 * @returns {Promise<Array<Object>>} 文件列表
 */
export const findByNote = async (noteId) => {
  try {
    // 使用 Realm 查找文件
    const realm = await realmService.getRealm();
    const files = realm.objects('File').filtered(`note_id = "${noteId}" AND is_deleted = false`);

    // 转换为前端文件对象
    return Array.from(files).map(toFrontendFile);
  } catch (error) {
    logService.error(`查找笔记的文件失败: ${noteId}`, error);
    throw error;
  }
};

/**
 * 搜索文件
 * @param {string} query 搜索关键词
 * @param {string} userId 用户ID
 * @param {Object} options 选项
 * @returns {Promise<Array<Object>>} 文件列表
 */
export const searchFiles = async (query, userId, options = {}) => {
  try {
    // 使用 Realm 搜索文件
    const realm = await realmService.getRealm();
    const searchQuery = `(name CONTAINS[c] "${query}" OR original_name CONTAINS[c] "${query}") AND user_id = "${userId}" AND is_deleted = false`;
    const files = realm.objects('File').filtered(searchQuery).sorted('updated_at', true);

    // 转换为前端文件对象
    return Array.from(files).map(toFrontendFile);
  } catch (error) {
    logService.error(`搜索文件失败: ${query}`, error);
    throw error;
  }
};
