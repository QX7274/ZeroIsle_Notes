/**
 * 笔记模型适配器
 * 用于在前端和后端模型之间进行转换
 */

import { Note } from '../models';
import realmService from '../services/database/realmService';
import { logService } from '../utils/logService';
import { offlineSyncService } from '../services/offline/offlineSyncService';

/**
 * 将后端笔记模型转换为前端笔记对象
 * @param {Object} note 后端笔记模型
 * @returns {Object} 前端笔记对象
 */
export const toFrontendNote = (note) => {
  if (!note) {return null;}

  try {
    return {
      id: note._id,
      title: note.title || '',
      content: note.content || '',
      type: note.type || 'text',
      tags: [...(note.tags || [])],
      categoryId: note.category_id,
      color: note.color,
      isFavorite: note.is_favorite || false,
      isArchived: note.is_archived || false,
      isDeleted: note.is_deleted || false,
      isSynced: note.is_synced || false,
      createdAt: note.created_at ? new Date(note.created_at) : new Date(),
      updatedAt: note.updated_at ? new Date(note.updated_at) : new Date(),
      deletedAt: note.deleted_at ? new Date(note.deleted_at) : null,
      filePath: note.file_path,
      fileSize: note.file_size,
      fileType: note.file_type,
      thumbnailPath: note.thumbnail_path,
      parentId: note.parent_id,
      metadata: { ...(note.metadata || {}) },
    };
  } catch (error) {
    logService.error('转换笔记模型失败', error);
    return null;
  }
};

/**
 * 将前端笔记对象转换为后端笔记模型
 * @param {Object} note 前端笔记对象
 * @returns {Object} 后端笔记模型
 */
export const toBackendNote = (note) => {
  if (!note) {return null;}

  try {
    return {
      _id: note.id,
      title: note.title || '',
      content: note.content || '',
      type: note.type || 'text',
      tags: [...(note.tags || [])],
      category_id: note.categoryId,
      color: note.color,
      is_favorite: note.isFavorite || false,
      is_archived: note.isArchived || false,
      is_deleted: note.isDeleted || false,
      is_synced: note.isSynced || false,
      created_at: note.createdAt || new Date(),
      updated_at: note.updatedAt || new Date(),
      deleted_at: note.deletedAt || null,
      file_path: note.filePath,
      file_size: note.fileSize,
      file_type: note.fileType,
      thumbnail_path: note.thumbnailPath,
      parent_id: note.parentId,
      metadata: { ...(note.metadata || {}) },
    };
  } catch (error) {
    logService.error('转换笔记对象失败', error);
    return null;
  }
};

/**
 * 创建笔记
 * @param {Object} noteData 笔记数据
 * @param {string} userId 用户ID
 * @returns {Promise<Object>} 创建的笔记
 */
export const createNote = async (noteData, userId) => {
  try {
    // 准备笔记数据
    const now = new Date();
    const noteId = realmService.createObjectId();

    const backendNote = {
      _id: noteId, // 使用字符串，Realm 会自动转换为 ObjectId
      title: noteData.title || '',
      content: noteData.content || '',
      type: noteData.type || 'text',
      tags: [...(noteData.tags || [])],
      category_id: noteData.categoryId,
      color: noteData.color,
      is_favorite: noteData.isFavorite || false,
      is_archived: noteData.isArchived || false,
      is_deleted: false,
      is_synced: false,
      created_at: now,
      updated_at: now,
      deleted_at: null,
      user_id: userId,
      file_path: noteData.filePath,
      file_size: noteData.fileSize,
      file_type: noteData.fileType,
      thumbnail_path: noteData.thumbnailPath,
      parent_id: noteData.parentId,
      metadata: { ...(noteData.metadata || {}) },
    };

    // 使用 Realm 创建笔记
    const realm = await realmService.getRealm();
    let note;
    realm.write(() => {
      // 使用'modified'模式：如果Note已存在则更新，不存在则创建
      note = realm.create('Note', backendNote, 'modified');
    });

    // 添加到同步队列
    await offlineSyncService.addToSyncQueue({
      entity_id: note._id,
      entity_type: 'note',
      operation: 'create',
      data: note.toJSON ? note.toJSON() : { ...backendNote },
      user_id: userId,
    });

    // 返回前端笔记对象
    return toFrontendNote(note);
  } catch (error) {
    logService.error('创建笔记失败', error);
    throw error;
  }
};

/**
 * 更新笔记
 * @param {string} noteId 笔记ID
 * @param {Object} noteData 笔记数据
 * @returns {Promise<Object>} 更新后的笔记
 */
export const updateNote = async (noteId, noteData) => {
  try {
    // 使用 Realm 查找笔记
    const realm = await realmService.getRealm();
    const note = realm.objectForPrimaryKey('Note', noteId);

    if (!note) {
      throw new Error(`笔记不存在: ${noteId}`);
    }

    // 更新笔记属性
    realm.write(() => {
      if (noteData.title !== undefined) {note.title = noteData.title;}
      if (noteData.content !== undefined) {note.content = noteData.content;}
      if (noteData.type !== undefined) {note.type = noteData.type;}
      if (noteData.tags !== undefined) {note.tags = [...noteData.tags];}
      if (noteData.categoryId !== undefined) {note.category_id = noteData.categoryId;}
      if (noteData.color !== undefined) {note.color = noteData.color;}
      if (noteData.isFavorite !== undefined) {note.is_favorite = noteData.isFavorite;}
      if (noteData.isArchived !== undefined) {note.is_archived = noteData.isArchived;}
      if (noteData.filePath !== undefined) {note.file_path = noteData.filePath;}
      if (noteData.fileSize !== undefined) {note.file_size = noteData.fileSize;}
      if (noteData.fileType !== undefined) {note.file_type = noteData.fileType;}
      if (noteData.thumbnailPath !== undefined) {note.thumbnail_path = noteData.thumbnailPath;}
      if (noteData.parentId !== undefined) {note.parent_id = noteData.parentId;}
      if (noteData.metadata !== undefined) {note.metadata = JSON.stringify(noteData.metadata);}

      // 更新时间
      note.updated_at = new Date();
      note.is_synced = false;
    });

    // 添加到同步队列
    await offlineSyncService.addToSyncQueue({
      entity_id: note._id,
      entity_type: 'note',
      operation: 'update',
      data: note.toJSON ? note.toJSON() : { ...note },
      user_id: note.user_id,
    });

    // 返回前端笔记对象
    return toFrontendNote(note);
  } catch (error) {
    logService.error(`更新笔记失败: ${noteId}`, error);
    throw error;
  }
};

/**
 * 删除笔记
 * @param {string} noteId 笔记ID
 * @param {boolean} permanent 是否永久删除
 * @returns {Promise<boolean>} 是否成功
 */
export const deleteNote = async (noteId, permanent = false) => {
  try {
    // 使用 Realm 查找笔记
    const realm = await realmService.getRealm();
    const note = realm.objectForPrimaryKey('Note', noteId);

    if (!note) {
      throw new Error(`笔记不存在: ${noteId}`);
    }

    if (permanent) {
      // 永久删除
      realm.write(() => {
        realm.delete(note);
      });
    } else {
      // 软删除
      realm.write(() => {
        note.is_deleted = true;
        note.deleted_at = new Date();
        note.updated_at = new Date();
        note.is_synced = false;
      });

      // 添加到同步队列
      await offlineSyncService.addToSyncQueue({
        entity_id: note._id,
        entity_type: 'note',
        operation: 'update',
        data: note.toJSON ? note.toJSON() : { ...note },
        user_id: note.user_id,
      });
    }

    return true;
  } catch (error) {
    logService.error(`删除笔记失败: ${noteId}`, error);
    throw error;
  }
};

/**
 * 恢复笔记
 * @param {string} noteId 笔记ID
 * @returns {Promise<Object>} 恢复后的笔记
 */
export const restoreNote = async (noteId) => {
  try {
    // 使用 Realm 查找笔记
    const realm = await realmService.getRealm();
    const note = realm.objectForPrimaryKey('Note', noteId);

    if (!note) {
      throw new Error(`笔记不存在: ${noteId}`);
    }

    // 恢复笔记
    realm.write(() => {
      note.is_deleted = false;
      note.deleted_at = null;
      note.updated_at = new Date();
      note.is_synced = false;
    });

    // 添加到同步队列
    await offlineSyncService.addToSyncQueue({
      entity_id: note._id,
      entity_type: 'note',
      operation: 'update',
      data: note.toJSON ? note.toJSON() : { ...note },
      user_id: note.user_id,
    });

    // 返回前端笔记对象
    return toFrontendNote(note);
  } catch (error) {
    logService.error(`恢复笔记失败: ${noteId}`, error);
    throw error;
  }
};

/**
 * 获取笔记列表
 * @param {string} userId 用户ID
 * @param {Object} options 选项
 * @returns {Promise<Array<Object>>} 笔记列表
 */
export const getNotes = async (userId, options = {}) => {
  try {
    // 使用 Realm 查找笔记
    const realm = await realmService.getRealm();
    let query = `user_id = "${userId}"`;

    if (options.is_deleted !== undefined) {
      query += ` AND is_deleted = ${options.is_deleted}`;
    } else {
      query += ' AND is_deleted = false';
    }

    if (options.is_favorite !== undefined) {
      query += ` AND is_favorite = ${options.is_favorite}`;
    }

    if (options.is_archived !== undefined) {
      query += ` AND is_archived = ${options.is_archived}`;
    }

    if (options.category_id) {
      query += ` AND category_id = "${options.category_id}"`;
    }

    let notes = realm.objects('Note').filtered(query);

    // 排序
    if (options.sort) {
      const sortField = Object.keys(options.sort)[0];
      const sortOrder = options.sort[sortField] === -1 ? true : false;
      notes = notes.sorted(sortField, sortOrder);
    } else {
      notes = notes.sorted('updated_at', true); // 默认按更新时间降序
    }

    // 转换为前端笔记对象
    return Array.from(notes).map(toFrontendNote);
  } catch (error) {
    logService.error('获取笔记列表失败', error);
    throw error;
  }
};

/**
 * 获取笔记详情
 * @param {string} noteId 笔记ID
 * @returns {Promise<Object>} 笔记详情
 */
export const getNoteById = async (noteId) => {
  try {
    // 使用 Realm 查找笔记
    const realm = await realmService.getRealm();
    const note = realm.objectForPrimaryKey('Note', noteId);

    if (!note) {
      throw new Error(`笔记不存在: ${noteId}`);
    }

    // 转换为前端笔记对象
    return toFrontendNote(note);
  } catch (error) {
    logService.error(`获取笔记详情失败: ${noteId}`, error);
    throw error;
  }
};

/**
 * 搜索笔记
 * @param {string} query 搜索关键词
 * @param {string} userId 用户ID
 * @param {Object} options 选项
 * @returns {Promise<Array<Object>>} 笔记列表
 */
export const searchNotes = async (query, userId, options = {}) => {
  try {
    // 使用 Realm 搜索笔记
    const realm = await realmService.getRealm();
    const searchQuery = `(title CONTAINS[c] "${query}" OR content CONTAINS[c] "${query}") AND user_id = "${userId}" AND is_deleted = false`;
    const notes = realm.objects('Note').filtered(searchQuery).sorted('updated_at', true);

    // 转换为前端笔记对象
    return Array.from(notes).map(toFrontendNote);
  } catch (error) {
    logService.error(`搜索笔记失败: ${query}`, error);
    throw error;
  }
};
