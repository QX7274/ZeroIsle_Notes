/**
 * 数据存储服务
 * 提供各种数据模型的CRUD操作
 */
import uuid from 'react-native-uuid';
import sqliteService, { TABLES } from './sqliteService';
import syncService from './syncService';
import NetInfo from '@react-native-community/netinfo';
import { apiService } from '../api';
import apiClient from '../api/apiClient';
import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * 数据存储服务
 */
class DataService {
  constructor() {
    this.isInitialized = false;
    this.currentUser = null;
  }

  /**
   * 获取SQLite服务实例
   * @returns {object} SQLite服务实例
   */
  getSqliteService() {
    return sqliteService;
  }

  /**
   * 初始化数据服务
   * @returns {Promise<void>}
   */
  async init() {
    // 防止重复初始化
    if (this.isInitialized) {
      console.log('数据服务已经初始化，跳过重复初始化');
      return;
    }

    // 防止并发初始化
    if (this._initPromise) {
      console.log('数据服务正在初始化中，等待完成...');
      return this._initPromise;
    }

    // 创建初始化Promise
    this._initPromise = (async () => {
      try {
        console.log('开始初始化数据服务...');

        // 设置超时，确保初始化不会一直等待
        const timeoutPromise = new Promise(resolve => {
          setTimeout(() => {
            console.log('数据服务初始化超时，以降级模式继续');
            resolve({ timeout: true });
          }, 30000); // 30秒超时，增加超时时间
        });

        // 尝试初始化SQLite服务，但不等待太久
        const sqlitePromise = (async () => {
          try {
            const db = await sqliteService.init();
            return { db };
          } catch (error) {
            console.error('SQLite服务初始化失败:', error);
            return { error };
          }
        })();

        // 使用Promise.race确保不会一直等待
        const result = await Promise.race([sqlitePromise, timeoutPromise]);

        if (result.timeout) {
          console.warn('SQLite服务初始化超时，数据服务将以降级模式运行');
          // 即使SQLite初始化失败，也标记数据服务为已初始化
          this.isInitialized = true;
        } else if (result.error) {
          console.warn('SQLite服务初始化失败，数据服务将以降级模式运行');
          // 即使SQLite初始化失败，也标记数据服务为已初始化
          this.isInitialized = true;
        } else {
          console.log('SQLite服务初始化成功');

          // 尝试初始化同步服务，但不等待太久
          try {
            const syncTimeoutPromise = new Promise(resolve => {
              setTimeout(() => {
                console.log('同步服务初始化超时，以降级模式继续');
                resolve();
              }, 5000); // 5秒超时
            });

            // 使用Promise.race确保不会一直等待
            await Promise.race([syncService.init(), syncTimeoutPromise]);
          } catch (syncError) {
            console.warn('同步服务初始化失败，但不影响数据服务:', syncError);
          }

          this.isInitialized = true;
        }

        console.log('数据服务初始化完成，状态:', this.isInitialized ? '成功' : '降级模式');
      } catch (error) {
        console.error('数据服务初始化过程中出现未处理的错误:', error);
        // 即使出现错误，也标记为已初始化，避免应用卡住
        this.isInitialized = true;
        console.log('数据服务将以降级模式运行');
      } finally {
        // 清除初始化Promise
        this._initPromise = null;
      }
    })();

    return this._initPromise;
  }

  /**
   * 设置当前用户
   * @param {object} user - 用户对象
   */
  setCurrentUser(user) {
    this.currentUser = user;

    // 记录当前活跃用户
    if (user && user.id) {
      this.saveActiveUser(user.id);
    }
  }

  /**
   * 保存活跃用户ID
   * @param {string} userId - 用户ID
   */
  async saveActiveUser(userId) {
    try {
      await AsyncStorage.setItem('active_user_id', userId);
    } catch (error) {
      console.error('保存活跃用户ID失败:', error);
    }
  }

  /**
   * 获取活跃用户ID
   * @returns {Promise<string>} 用户ID
   */
  async getActiveUserId() {
    try {
      return await AsyncStorage.getItem('active_user_id');
    } catch (error) {
      console.error('获取活跃用户ID失败:', error);
      return null;
    }
  }

  /**
   * 获取当前用户ID
   * @returns {string} 用户ID
   */
  getCurrentUserId() {
    return this.currentUser?.id;
  }

  /**
   * 检查网络连接
   * @returns {Promise<boolean>} 是否连接
   */
  async isConnected() {
    const netInfo = await NetInfo.fetch();
    return netInfo.isConnected && netInfo.isInternetReachable;
  }

  /**
   * 创建用户
   * @param {object} userData - 用户数据
   * @returns {Promise<object>} 创建的用户
   */
  async createUser(userData) {
    try {
      await this.init();

      const now = new Date().toISOString();
      const userId = userData.id || uuid.v4();

      const user = {
        id: userId,
        username: userData.username,
        email: userData.email || '',
        phone: userData.phone || '',
        password: userData.password || '',
        first_name: userData.first_name || '',
        last_name: userData.last_name || '',
        nickname: userData.nickname || '',
        avatar: userData.avatar || '',
        bio: userData.bio || '',
        is_active: userData.is_active || 1,
        is_staff: userData.is_staff || 0,
        date_joined: userData.date_joined || now,
        last_login: userData.last_login || now,
        wechat_openid: userData.wechat_openid || '',
        wechat_unionid: userData.wechat_unionid || '',
        wechat_avatar: userData.wechat_avatar || '',
        qq_openid: userData.qq_openid || '',
        qq_avatar: userData.qq_avatar || '',
        preferences: JSON.stringify(userData.preferences || {}),
        created_at: now,
        updated_at: now,
        is_synced: 0
      };

      // 保存到本地数据库
      const columns = Object.keys(user);
      const placeholders = columns.map(() => '?').join(', ');
      const values = columns.map(col => user[col]);

      await sqliteService.executeSql(
        `INSERT INTO ${TABLES.USERS} (${columns.join(', ')}) VALUES (${placeholders})`,
        values
      );

      // 尝试同步到服务器
      const isConnected = await this.isConnected();
      if (isConnected) {
        try {
          // 直接调用API创建用户
          const response = await apiService.post('/users', userData);

          // 更新本地记录为已同步
          await sqliteService.executeSql(
            `UPDATE ${TABLES.USERS} SET is_synced = 1 WHERE id = ?`,
            [userId]
          );

          return response.data;
        } catch (error) {
          console.error('同步用户到服务器失败:', error);
          // 添加到离线队列
          await syncService.addOfflineOperation('insert', TABLES.USERS, userId, user);
        }
      } else {
        // 添加到离线队列
        await syncService.addOfflineOperation('insert', TABLES.USERS, userId, user);
      }

      // 返回本地创建的用户
      return { ...user, preferences: JSON.parse(user.preferences) };
    } catch (error) {
      console.error('创建用户失败:', error);
      throw error;
    }
  }

  /**
   * 获取用户
   * @param {string} userId - 用户ID
   * @returns {Promise<object>} 用户对象
   */
  async getUser(userId) {
    try {
      await this.init();

      // 从本地数据库获取
      const result = await sqliteService.executeSql(
        `SELECT * FROM ${TABLES.USERS} WHERE id = ?`,
        [userId]
      );

      if (result.rows.length === 0) {
        throw new Error(`找不到用户: ${userId}`);
      }

      const user = result.rows.item(0);

      // 解析JSON字段
      return {
        ...user,
        preferences: JSON.parse(user.preferences || '{}')
      };
    } catch (error) {
      console.error(`获取用户失败 (ID: ${userId}):`, error);
      throw error;
    }
  }

  /**
   * 更新用户
   * @param {string} userId - 用户ID
   * @param {object} userData - 用户数据
   * @returns {Promise<object>} 更新后的用户
   */
  async updateUser(userId, userData) {
    try {
      await this.init();

      // 检查用户是否存在
      const existingUser = await this.getUser(userId);
      if (!existingUser) {
        throw new Error(`找不到用户: ${userId}`);
      }

      const now = new Date().toISOString();

      // 准备更新数据
      const updateData = { ...userData, updated_at: now, is_synced: 0 };

      // 处理JSON字段
      if (updateData.preferences) {
        updateData.preferences = JSON.stringify(updateData.preferences);
      }

      // 构建更新语句
      const columns = Object.keys(updateData);
      const setClause = columns.map(col => `${col} = ?`).join(', ');
      const values = [...columns.map(col => updateData[col]), userId];

      // 更新本地数据库
      await sqliteService.executeSql(
        `UPDATE ${TABLES.USERS} SET ${setClause} WHERE id = ?`,
        values
      );

      // 尝试同步到服务器
      const isConnected = await this.isConnected();
      if (isConnected) {
        try {
          // 直接调用API更新用户
          const response = await apiService.put(`/users/${userId}`, userData);

          // 更新本地记录为已同步
          await sqliteService.executeSql(
            `UPDATE ${TABLES.USERS} SET is_synced = 1 WHERE id = ?`,
            [userId]
          );

          return response.data;
        } catch (error) {
          console.error('同步用户更新到服务器失败:', error);
          // 添加到离线队列
          await syncService.addOfflineOperation('update', TABLES.USERS, userId, updateData);
        }
      } else {
        // 添加到离线队列
        await syncService.addOfflineOperation('update', TABLES.USERS, userId, updateData);
      }

      // 返回更新后的用户
      return await this.getUser(userId);
    } catch (error) {
      console.error(`更新用户失败 (ID: ${userId}):`, error);
      throw error;
    }
  }

  /**
   * 创建笔记
   * @param {object} noteData - 笔记数据
   * @returns {Promise<object>} 创建的笔记
   */
  async createNote(noteData) {
    try {
      await this.init();

      const userId = this.getCurrentUserId();
      if (!userId) {
        throw new Error('未设置当前用户');
      }

      const now = new Date().toISOString();
      const noteId = noteData.id || uuid.v4();

      // 限制内容长度，避免超时
      let content = noteData.content || '';
      if (content.length > 5000) {
        console.log('内容过长，截断为5000字符');
        content = content.substring(0, 5000);
      }

      const note = {
        id: noteId,
        user_id: userId,
        title: noteData.title,
        content: content,
        category_id: noteData.category_id || '',
        is_favorite: noteData.is_favorite || 0,
        is_encrypted: noteData.is_encrypted || 0,
        encryption_key: noteData.encryption_key || '',
        is_public: noteData.is_public || 0,
        is_deleted: noteData.is_deleted || 0,
        created_at: now,
        updated_at: now,
        is_synced: 0
      };

      // 使用事务保存到本地数据库，提高性能和可靠性
      try {
        // 开始事务
        await sqliteService.executeSql('BEGIN TRANSACTION;', [], 60000);

        // 保存笔记
        const columns = Object.keys(note);
        const placeholders = columns.map(() => '?').join(', ');
        const values = columns.map(col => note[col]);

        await sqliteService.executeSql(
          `INSERT INTO ${TABLES.NOTES} (${columns.join(', ')}) VALUES (${placeholders})`,
          values,
          60000 // 增加超时时间到60秒
        );

        // 处理标签
        if (noteData.tags && Array.isArray(noteData.tags)) {
          for (const tagId of noteData.tags) {
            await sqliteService.executeSql(
              `INSERT INTO ${TABLES.NOTE_TAGS} (note_id, tag_id, created_at, is_synced) VALUES (?, ?, ?, ?)`,
              [noteId, tagId, now, 0],
              30000 // 30秒超时
            );
          }
        }

        // 提交事务
        await sqliteService.executeSql('COMMIT;', [], 60000);
        console.log('笔记创建事务已提交');
      } catch (transactionError) {
        // 回滚事务
        console.error('笔记创建事务失败，回滚:', transactionError);
        try {
          await sqliteService.executeSql('ROLLBACK;', [], 30000);
        } catch (rollbackError) {
          console.error('事务回滚失败:', rollbackError);
        }
        throw transactionError;
      }

      // 添加到离线队列，无论是否在线
      try {
        await syncService.addOfflineOperation('insert', TABLES.NOTES, noteId, note);
      } catch (syncError) {
        console.warn('添加到离线队列失败，但本地保存成功:', syncError);
      }

      // 在后台尝试同步到服务器，不阻塞当前操作
      setTimeout(async () => {
        try {
          // 检查网络状态，但不阻塞创建过程
          let isOnline = false;
          try {
            const networkStatus = await NetInfo.fetch();
            isOnline = networkStatus.isConnected && networkStatus.isInternetReachable;
            console.log('网络状态:', isOnline ? '在线' : '离线');
          } catch (netError) {
            console.warn('检查网络状态失败，默认为离线模式:', netError);
          }

          if (isOnline) {
            try {
              console.log('尝试在后台同步笔记到服务器:', noteId);

              // 设置请求头，标记为离线模式，这样即使请求失败也不会影响用户体验
              const headers = { 'X-Offline-Mode': 'true' };

              // 使用apiClient而不是apiService，以便利用我们的离线错误处理
              const response = await apiClient.post('/notes', {
                ...noteData,
                id: noteId,
                user_id: userId
              }, { headers });

              // 只有在确认成功后才更新本地记录
              if (response && !response.offline) {
                try {
                  // 开始事务
                  await sqliteService.executeSql('BEGIN TRANSACTION;', [], 30000);

                  // 更新本地记录为已同步
                  await sqliteService.executeSql(
                    `UPDATE ${TABLES.NOTES} SET is_synced = 1 WHERE id = ?`,
                    [noteId],
                    30000
                  );

                  // 更新标签关联为已同步
                  if (noteData.tags && Array.isArray(noteData.tags)) {
                    await sqliteService.executeSql(
                      `UPDATE ${TABLES.NOTE_TAGS} SET is_synced = 1 WHERE note_id = ?`,
                      [noteId],
                      30000
                    );
                  }

                  // 提交事务
                  await sqliteService.executeSql('COMMIT;', [], 30000);
                  console.log('笔记已成功同步到服务器:', noteId);
                } catch (updateError) {
                  // 回滚事务
                  console.error('更新同步状态失败，回滚:', updateError);
                  try {
                    await sqliteService.executeSql('ROLLBACK;', [], 30000);
                  } catch (rollbackError) {
                    console.error('事务回滚失败:', rollbackError);
                  }
                }
              } else {
                console.log('服务器返回离线响应，笔记将在下次联网时同步');
              }
            } catch (error) {
              // 不要显示错误，只记录日志
              console.warn('后台同步笔记失败，将在下次联网时重试:', error);
            }
          } else {
            console.log('当前离线，笔记将在下次联网时同步');
          }
        } catch (error) {
          // 不要显示错误，只记录日志
          console.warn('后台同步过程出错:', error);
        }
      }, 0);

      // 返回本地创建的笔记
      return note;
    } catch (error) {
      console.error('创建笔记失败:', error);
      throw error;
    }
  }

  /**
   * 获取笔记
   * @param {string} noteId - 笔记ID
   * @param {number} timeout - 查询超时时间（毫秒）
   * @returns {Promise<object>} 笔记对象
   */
  async getNote(noteId, timeout = 15000) {
    try {
      console.log(`开始获取笔记 (ID: ${noteId})`);
      const startTime = Date.now();

      // 确保数据库已初始化
      await this.init();
      console.log(`数据库初始化检查完成，耗时: ${Date.now() - startTime}ms`);

      // 检查数据库连接状态
      if (!sqliteService.isInitialized || !sqliteService.database) {
        console.warn('数据库未初始化或连接不可用，尝试重新初始化');
        await sqliteService.init(timeout);

        // 如果仍然未初始化，抛出错误
        if (!sqliteService.isInitialized || !sqliteService.database) {
          throw new Error('数据库连接不可用，无法获取笔记');
        }
      }

      // 从本地数据库获取笔记 - 使用更长的超时时间
      console.log(`开始查询笔记数据 (ID: ${noteId})`);
      const queryStartTime = Date.now();
      const result = await sqliteService.executeSql(
        `SELECT * FROM ${TABLES.NOTES} WHERE id = ?`,
        [noteId],
        timeout
      );
      console.log(`笔记数据查询完成，耗时: ${Date.now() - queryStartTime}ms`);

      if (result.rows.length === 0) {
        throw new Error(`找不到笔记: ${noteId}`);
      }

      const note = result.rows.item(0);

      // 获取标签 - 使用单独的超时设置
      console.log(`开始查询笔记标签 (ID: ${noteId})`);
      const tagsStartTime = Date.now();
      const tagsResult = await sqliteService.executeSql(
        `SELECT tag_id FROM ${TABLES.NOTE_TAGS} WHERE note_id = ?`,
        [noteId],
        5000 // 标签查询使用较短的超时时间
      );
      console.log(`笔记标签查询完成，耗时: ${Date.now() - tagsStartTime}ms`);

      const tags = [];
      for (let i = 0; i < tagsResult.rows.length; i++) {
        tags.push(tagsResult.rows.item(i).tag_id);
      }

      console.log(`笔记获取成功 (ID: ${noteId})，总耗时: ${Date.now() - startTime}ms`);
      return { ...note, tags };
    } catch (error) {
      console.error(`获取笔记失败 (ID: ${noteId}):`, error);

      // 如果是超时错误，提供更详细的诊断信息
      if (error.message && error.message.includes('超时')) {
        console.error('笔记加载超时，可能的原因：数据库文件过大、查询复杂或设备资源不足');

        // 尝试执行简单查询来检查数据库连接
        try {
          await sqliteService.executeSql('SELECT 1', [], 3000);
          console.log('数据库连接仍然有效，但笔记查询超时');
        } catch (testError) {
          console.error('数据库连接测试失败，可能需要重新初始化数据库:', testError);
          // 标记数据库需要重新初始化
          sqliteService.isInitialized = false;
        }
      }

      throw error;
    }
  }

  /**
   * 获取用户的所有笔记
   * @param {object} options - 查询选项
   * @returns {Promise<Array>} 笔记列表
   */
  async getNotes(options = {}) {
    try {
      console.log('开始获取笔记列表...');
      const startTime = Date.now();

      // 确保数据库已初始化
      await this.init();
      console.log(`数据库初始化检查完成，耗时: ${Date.now() - startTime}ms`);

      const userId = options.userId || this.getCurrentUserId();
      if (!userId) {
        throw new Error('未设置用户ID');
      }

      // 使用更简单的查询，只获取必要字段，避免超时
      // 不获取content字段，减少数据传输量
      let query = `SELECT id, title, category_id, is_favorite, created_at, updated_at
                  FROM ${TABLES.NOTES}
                  WHERE user_id = ? AND is_deleted = 0`;
      const params = [userId];

      if (options.categoryId) {
        query += ' AND category_id = ?';
        params.push(options.categoryId);
      }

      if (options.isFavorite) {
        query += ' AND is_favorite = 1';
      }

      // 排序
      query += ' ORDER BY updated_at DESC';

      // 分页 - 添加默认限制，避免返回太多数据
      const limit = options.limit || 30; // 默认限制为30条，减少数据量
      query += ' LIMIT ?';
      params.push(limit);

      if (options.offset) {
        query += ' OFFSET ?';
        params.push(options.offset);
      }

      console.log('执行笔记查询:', query);
      console.log('查询参数:', params);

      // 设置较短的超时时间，避免长时间等待
      const queryStartTime = Date.now();
      const result = await sqliteService.executeSql(query, params, 15000);
      console.log(`笔记查询完成，耗时: ${Date.now() - queryStartTime}ms，返回 ${result.rows.length} 条笔记`);

      // 处理结果 - 不再为每个笔记单独查询标签，而是一次性获取所有标签
      const notes = [];
      const noteIds = [];

      // 先收集所有笔记ID和基本信息
      for (let i = 0; i < result.rows.length; i++) {
        const note = result.rows.item(i);
        noteIds.push(note.id);
        notes.push({
          ...note,
          // 添加一个简短的内容预览，而不是完整内容
          content: note.content ? (note.content.substring(0, 100) + (note.content.length > 100 ? '...' : '')) : '',
          tags: [] // 初始化空标签数组
        });
      }

      // 如果有笔记，尝试获取标签，但不阻塞主流程
      if (noteIds.length > 0) {
        // 使用Promise.race和超时机制，确保标签查询不会阻塞太久
        const tagsPromise = (async () => {
          try {
            // 构建IN查询的参数占位符
            const placeholders = noteIds.map(() => '?').join(',');
            const tagsQuery = `SELECT note_id, tag_id FROM ${TABLES.NOTE_TAGS} WHERE note_id IN (${placeholders})`;

            // 执行标签查询，设置较短的超时时间
            const tagsStartTime = Date.now();
            const tagsResult = await sqliteService.executeSql(tagsQuery, noteIds, 5000);
            console.log(`标签查询完成，耗时: ${Date.now() - tagsStartTime}ms`);

            // 创建笔记ID到索引的映射，方便快速查找
            const noteIdToIndex = {};
            notes.forEach((note, index) => {
              noteIdToIndex[note.id] = index;
            });

            // 将标签分配给对应的笔记
            for (let j = 0; j < tagsResult.rows.length; j++) {
              const { note_id, tag_id } = tagsResult.rows.item(j);
              const noteIndex = noteIdToIndex[note_id];
              if (noteIndex !== undefined) {
                notes[noteIndex].tags.push(tag_id);
              }
            }

            return true;
          } catch (tagsError) {
            console.warn('获取标签失败，返回没有标签的笔记:', tagsError);
            return false;
          }
        })();

        // 设置标签查询超时
        const tagsTimeoutPromise = new Promise(resolve => {
          setTimeout(() => {
            console.log('标签查询超时，返回没有标签的笔记');
            resolve(false);
          }, 5000); // 5秒超时
        });

        // 使用Promise.race，不等待太久
        await Promise.race([tagsPromise, tagsTimeoutPromise]);
      }

      console.log(`笔记列表获取成功，总耗时: ${Date.now() - startTime}ms`);
      return notes;
    } catch (error) {
      console.error('获取笔记列表失败:', error);

      // 返回空数组，而不是测试数据
      console.log('返回空数组，避免显示虚假数据');
      return [];
    }
  }

  /**
   * 更新笔记
   * @param {string} noteId - 笔记ID
   * @param {object} noteData - 笔记数据
   * @returns {Promise<object>} 更新后的笔记
   */
  async updateNote(noteId, noteData) {
    try {
      await this.init();

      // 准备更新数据
      const now = new Date().toISOString();
      const updateData = { ...noteData, updated_at: now, is_synced: 0 };
      delete updateData.id; // 不更新ID
      delete updateData.user_id; // 不更新用户ID
      delete updateData.created_at; // 不更新创建时间
      delete updateData.tags; // 单独处理标签

      // 构建更新语句
      const columns = Object.keys(updateData);
      const setClause = columns.map(col => `${col} = ?`).join(', ');
      const values = [...columns.map(col => updateData[col]), noteId];

      // 设置较长的超时时间
      const timeout = 60000; // 60秒

      // 使用事务更新本地数据库，提高可靠性
      try {
        // 开始事务
        await sqliteService.executeSql('BEGIN TRANSACTION;', [], timeout);

        // 更新笔记
        await sqliteService.executeSql(
          `UPDATE ${TABLES.NOTES} SET ${setClause} WHERE id = ?`,
          values,
          timeout
        );

        // 处理标签
        if (noteData.tags && Array.isArray(noteData.tags)) {
          // 删除现有标签关联
          await sqliteService.executeSql(
            `DELETE FROM ${TABLES.NOTE_TAGS} WHERE note_id = ?`,
            [noteId],
            timeout
          );

          // 添加新标签关联
          for (const tagId of noteData.tags) {
            await sqliteService.executeSql(
              `INSERT INTO ${TABLES.NOTE_TAGS} (note_id, tag_id, created_at, is_synced) VALUES (?, ?, ?, ?)`,
              [noteId, tagId, now, 0],
              timeout
            );
          }
        }

        // 提交事务
        await sqliteService.executeSql('COMMIT;', [], timeout);
        console.log('笔记更新事务已提交');
      } catch (transactionError) {
        // 回滚事务
        console.error('笔记更新事务失败，回滚:', transactionError);
        try {
          await sqliteService.executeSql('ROLLBACK;', [], timeout);
        } catch (rollbackError) {
          console.error('事务回滚失败:', rollbackError);
        }
        throw transactionError;
      }

      // 添加到离线队列，在后台处理
      try {
        await syncService.addOfflineOperation('update', TABLES.NOTES, noteId, {
          ...updateData,
          tags: noteData.tags
        });
        console.log('笔记更新已添加到离线队列');
      } catch (syncError) {
        console.warn('添加到离线队列失败，但本地更新成功:', syncError);
      }

      // 在后台尝试同步到服务器，不阻塞当前操作
      setTimeout(async () => {
        try {
          const isConnected = await this.isConnected();
          if (isConnected) {
            try {
              // 直接调用API更新笔记
              const response = await apiService.put(`/notes/${noteId}`, {
                ...noteData,
                id: noteId
              });

              // 更新本地记录为已同步
              await sqliteService.executeSql(
                `UPDATE ${TABLES.NOTES} SET is_synced = 1 WHERE id = ?`,
                [noteId],
                timeout
              );

              // 更新标签关联为已同步
              if (noteData.tags && Array.isArray(noteData.tags)) {
                await sqliteService.executeSql(
                  `UPDATE ${TABLES.NOTE_TAGS} SET is_synced = 1 WHERE note_id = ?`,
                  [noteId],
                  timeout
                );
              }

              console.log('笔记已同步到服务器');
            } catch (error) {
              console.error('同步笔记更新到服务器失败:', error);
            }
          } else {
            console.log('当前离线，笔记将在下次联网时同步');
          }
        } catch (error) {
          console.warn('后台同步过程出错:', error);
        }
      }, 0);

      // 直接返回更新后的笔记对象，不查询数据库
      return {
        success: true,
        data: {
          ...noteData,
          id: noteId,
          updated_at: now
        }
      };
    } catch (error) {
      console.error(`更新笔记失败 (ID: ${noteId}):`, error);

      // 即使出错，也返回一个基本的结果，避免UI卡住
      return {
        success: false,
        message: error.message || '更新笔记失败',
        error
      };
    }
  }

  /**
   * 删除笔记（软删除）
   * @param {string} noteId - 笔记ID
   * @returns {Promise<boolean>} 是否成功
   */
  async deleteNote(noteId) {
    try {
      await this.init();

      const now = new Date().toISOString();

      // 软删除（更新is_deleted标志）
      await sqliteService.executeSql(
        `UPDATE ${TABLES.NOTES} SET is_deleted = 1, updated_at = ?, is_synced = 0 WHERE id = ?`,
        [now, noteId]
      );

      // 尝试同步到服务器
      const isConnected = await this.isConnected();
      if (isConnected) {
        try {
          // 直接调用API删除笔记
          await apiService.delete(`/notes/${noteId}`);

          // 更新本地记录为已同步
          await sqliteService.executeSql(
            `UPDATE ${TABLES.NOTES} SET is_synced = 1 WHERE id = ?`,
            [noteId]
          );
        } catch (error) {
          console.error('同步笔记删除到服务器失败:', error);
          // 添加到离线队列
          await syncService.addOfflineOperation('delete', TABLES.NOTES, noteId);
        }
      } else {
        // 添加到离线队列
        await syncService.addOfflineOperation('delete', TABLES.NOTES, noteId);
      }

      return true;
    } catch (error) {
      console.error(`删除笔记失败 (ID: ${noteId}):`, error);
      throw error;
    }
  }

  /**
   * 切换用户
   * @param {object} newUser - 新用户对象
   * @returns {Promise<boolean>} 是否成功
   */
  async switchUser(newUser) {
    try {
      await this.init();

      // 设置当前用户
      this.setCurrentUser(newUser);

      // 预加载用户数据
      await this.preloadUserData(newUser.id);

      console.log(`已切换到用户: ${newUser.username} (${newUser.id})`);
      return true;
    } catch (error) {
      console.error('切换用户失败:', error);
      throw error;
    }
  }

  /**
   * 预加载用户数据
   * @param {string} userId - 用户ID
   * @returns {Promise<void>}
   */
  async preloadUserData(userId) {
    try {
      // 预加载常用数据以提高性能
      const preloadPromises = [
        this.getCategories({ userId }),
        this.getTags({ userId }),
        this.getSettings({ userId }),
        // 可以添加其他需要预加载的数据
      ];

      await Promise.all(preloadPromises);
      console.log(`用户 ${userId} 数据预加载完成`);
    } catch (error) {
      console.error(`预加载用户数据失败 (ID: ${userId}):`, error);
      // 不抛出异常，因为这不是关键操作
    }
  }

  /**
   * 获取分类列表
   * @param {object} options - 查询选项
   * @returns {Promise<Array>} 分类列表
   */
  async getCategories(options = {}) {
    try {
      await this.init();

      const userId = options.userId || this.getCurrentUserId();
      if (!userId) {
        throw new Error('未设置用户ID');
      }

      // 构建查询条件
      let query = `SELECT * FROM ${TABLES.CATEGORIES} WHERE user_id = ? AND is_deleted = 0`;
      const params = [userId];

      if (options.parentId) {
        query += ' AND parent_id = ?';
        params.push(options.parentId);
      } else if (options.parentId === null) {
        query += ' AND parent_id IS NULL';
      }

      // 排序
      query += ' ORDER BY sort_order ASC, name ASC';

      // 执行查询
      const result = await sqliteService.executeSql(query, params);

      // 处理结果
      const categories = [];
      for (let i = 0; i < result.rows.length; i++) {
        categories.push(result.rows.item(i));
      }

      return categories;
    } catch (error) {
      console.error('获取分类列表失败:', error);
      throw error;
    }
  }

  /**
   * 获取标签列表
   * @param {object} options - 查询选项
   * @returns {Promise<Array>} 标签列表
   */
  async getTags(options = {}) {
    try {
      await this.init();

      const userId = options.userId || this.getCurrentUserId();
      if (!userId) {
        throw new Error('未设置用户ID');
      }

      // 构建查询条件
      let query = `SELECT * FROM ${TABLES.TAGS} WHERE user_id = ?`;
      const params = [userId];

      if (options.search) {
        query += ' AND name LIKE ?';
        params.push(`%${options.search}%`);
      }

      // 排序
      query += ' ORDER BY usage_count DESC, name ASC';

      // 分页
      if (options.limit) {
        query += ' LIMIT ?';
        params.push(options.limit);

        if (options.offset) {
          query += ' OFFSET ?';
          params.push(options.offset);
        }
      }

      // 执行查询
      const result = await sqliteService.executeSql(query, params);

      // 处理结果
      const tags = [];
      for (let i = 0; i < result.rows.length; i++) {
        tags.push(result.rows.item(i));
      }

      return tags;
    } catch (error) {
      console.error('获取标签列表失败:', error);
      throw error;
    }
  }

  /**
   * 获取设置列表
   * @param {object} options - 查询选项
   * @returns {Promise<object>} 设置对象
   */
  async getSettings(options = {}) {
    try {
      await this.init();

      const userId = options.userId || this.getCurrentUserId();
      if (!userId) {
        throw new Error('未设置用户ID');
      }

      // 构建查询条件
      let query = `SELECT * FROM ${TABLES.SETTINGS} WHERE user_id = ?`;
      const params = [userId];

      if (options.key) {
        query += ' AND key = ?';
        params.push(options.key);
      }

      // 执行查询
      const result = await sqliteService.executeSql(query, params);

      // 处理结果
      const settings = {};
      for (let i = 0; i < result.rows.length; i++) {
        const setting = result.rows.item(i);
        settings[setting.key] = setting.value;
      }

      return settings;
    } catch (error) {
      console.error('获取设置失败:', error);
      throw error;
    }
  }

  /**
   * 清理用户数据
   * @param {string} userId - 用户ID
   * @returns {Promise<boolean>} 是否成功
   */
  async cleanUserData(userId) {
    try {
      await this.init();

      // 开始事务
      await sqliteService.executeSql('BEGIN TRANSACTION');

      // 删除用户的所有数据
      await sqliteService.executeSql(`DELETE FROM ${TABLES.NOTES} WHERE user_id = ?`, [userId]);
      await sqliteService.executeSql(`DELETE FROM ${TABLES.CATEGORIES} WHERE user_id = ?`, [userId]);
      await sqliteService.executeSql(`DELETE FROM ${TABLES.TAGS} WHERE user_id = ?`, [userId]);
      await sqliteService.executeSql(`DELETE FROM ${TABLES.REMINDERS} WHERE user_id = ?`, [userId]);
      await sqliteService.executeSql(`DELETE FROM ${TABLES.SETTINGS} WHERE user_id = ?`, [userId]);
      await sqliteService.executeSql(`DELETE FROM ${TABLES.FILES} WHERE user_id = ?`, [userId]);

      // 删除用户本身
      await sqliteService.executeSql(`DELETE FROM ${TABLES.USERS} WHERE id = ?`, [userId]);

      // 提交事务
      await sqliteService.executeSql('COMMIT');

      console.log(`用户 ${userId} 数据清理完成`);
      return true;
    } catch (error) {
      // 回滚事务
      await sqliteService.executeSql('ROLLBACK');
      console.error(`清理用户数据失败 (ID: ${userId}):`, error);
      throw error;
    }
  }

  /**
   * 同步笔记
   * @param {Array} serverNotes - 服务器笔记数据
   * @returns {Promise<boolean>} 是否成功
   */
  async syncNotes(serverNotes) {
    try {
      await this.init();

      if (!Array.isArray(serverNotes) || serverNotes.length === 0) {
        console.log('没有服务器笔记数据需要同步');
        return true;
      }

      console.log(`开始同步${serverNotes.length}条服务器笔记数据`);

      const now = new Date().toISOString();
      const userId = this.getCurrentUserId();

      for (const serverNote of serverNotes) {
        try {
          // 检查笔记是否已存在
          const existingNoteResult = await sqliteService.executeSql(
            `SELECT * FROM ${TABLES.NOTES} WHERE id = ?`,
            [serverNote.id]
          );

          if (existingNoteResult.rows.length > 0) {
            // 笔记已存在，更新
            const existingNote = existingNoteResult.rows.item(0);

            // 比较版本号和更新时间，只有服务器版本更新才更新本地
            const localVersion = existingNote.version || 1;
            const serverVersion = serverNote.version || 1;
            const localUpdatedAt = new Date(existingNote.updated_at);
            const serverUpdatedAt = new Date(serverNote.updated_at);

            if (serverVersion > localVersion || (serverVersion === localVersion && serverUpdatedAt > localUpdatedAt)) {
              console.log(`服务器笔记更新，同步笔记 ID: ${serverNote.id}`);

              // 准备更新数据
              const updateData = {
                title: serverNote.title,
                content: serverNote.content,
                summary: serverNote.summary,
                category_id: serverNote.category_id,
                is_favorite: serverNote.is_favorite || 0,
                is_encrypted: serverNote.is_encrypted || 0,
                encryption_key: serverNote.encryption_key,
                is_public: serverNote.is_public || 0,
                view_count: serverNote.view_count || 0,
                edit_count: serverNote.edit_count || 0,
                last_viewed_at: serverNote.last_viewed_at,
                updated_at: serverNote.updated_at,
                version: serverVersion,
                is_synced: 1,
                last_sync_at: now
              };

              // 构建更新语句
              const columns = Object.keys(updateData);
              const setClause = columns.map(col => `${col} = ?`).join(', ');
              const values = [...columns.map(col => updateData[col]), serverNote.id];

              // 更新笔记
              await sqliteService.executeSql(
                `UPDATE ${TABLES.NOTES} SET ${setClause} WHERE id = ?`,
                values
              );

              // 处理标签
              if (serverNote.tags && Array.isArray(serverNote.tags)) {
                // 删除现有标签关联
                await sqliteService.executeSql(
                  `DELETE FROM ${TABLES.NOTE_TAGS} WHERE note_id = ?`,
                  [serverNote.id]
                );

                // 添加新标签关联
                for (const tagId of serverNote.tags) {
                  await sqliteService.executeSql(
                    `INSERT INTO ${TABLES.NOTE_TAGS} (note_id, tag_id, created_at, version, is_synced, last_sync_at) VALUES (?, ?, ?, ?, ?, ?)`,
                    [serverNote.id, tagId, now, 1, 1, now]
                  );
                }
              }
            } else {
              console.log(`本地笔记更新，不同步服务器数据 ID: ${serverNote.id}`);
            }
          } else {
            // 笔记不存在，创建新笔记
            console.log(`创建新笔记 ID: ${serverNote.id}`);

            const note = {
              id: serverNote.id,
              user_id: userId,
              title: serverNote.title,
              content: serverNote.content || '',
              summary: serverNote.summary || '',
              category_id: serverNote.category_id || null,
              is_favorite: serverNote.is_favorite || 0,
              is_encrypted: serverNote.is_encrypted || 0,
              encryption_key: serverNote.encryption_key || null,
              is_public: serverNote.is_public || 0,
              is_deleted: serverNote.is_deleted || 0,
              view_count: serverNote.view_count || 0,
              edit_count: serverNote.edit_count || 0,
              last_viewed_at: serverNote.last_viewed_at || null,
              created_at: serverNote.created_at || now,
              updated_at: serverNote.updated_at || now,
              version: serverNote.version || 1,
              is_synced: 1,
              last_sync_at: now
            };

            // 保存到本地数据库
            const columns = Object.keys(note);
            const placeholders = columns.map(() => '?').join(', ');
            const values = columns.map(col => note[col]);

            await sqliteService.executeSql(
              `INSERT INTO ${TABLES.NOTES} (${columns.join(', ')}) VALUES (${placeholders})`,
              values
            );

            // 处理标签
            if (serverNote.tags && Array.isArray(serverNote.tags)) {
              for (const tagId of serverNote.tags) {
                await sqliteService.executeSql(
                  `INSERT INTO ${TABLES.NOTE_TAGS} (note_id, tag_id, created_at, version, is_synced, last_sync_at) VALUES (?, ?, ?, ?, ?, ?)`,
                  [serverNote.id, tagId, now, 1, 1, now]
                );
              }
            }
          }
        } catch (noteError) {
          console.error(`同步笔记失败 ID: ${serverNote.id}:`, noteError);
          // 继续处理下一条笔记
        }
      }

      console.log('笔记同步完成');
      return true;
    } catch (error) {
      console.error('同步笔记失败:', error);
      return false;
    }
  }
}

// 创建单例
const dataService = new DataService();

export default dataService;
