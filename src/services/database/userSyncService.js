/**
 * 用户同步服务
 * 负责确保MongoDB和SQLite之间的用户数据同步
 */

import sqliteService, { TABLES } from './sqliteService';
import syncService from './syncService';
import { getCurrentUser } from '../../utils/authUtils';
import uuid from 'react-native-uuid';

class UserSyncService {
  /**
   * 确保用户信息在SQLite中存在
   * 在用户登录或注册后调用此方法
   * @param {Object} userData - 用户数据对象
   * @returns {Promise<boolean>} - 是否成功
   */
  async ensureUserInSQLite(userData) {
    try {
      console.log('确保用户信息在SQLite中存在:', userData.username);

      // 确保SQLite已初始化
      if (!sqliteService.isInitialized) {
        console.log('SQLite未初始化，尝试初始化...');
        await sqliteService.init(60000);
      }

      if (!sqliteService.database) {
        console.error('SQLite数据库未初始化，无法同步用户信息');
        return false;
      }

      // 检查用户表是否存在
      try {
        const tableCheck = await sqliteService.executeSql(
          "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
          [TABLES.USERS]
        );

        if (tableCheck.rows.length === 0) {
          console.log('用户表不存在，创建用户表');
          await this._createUserTable();
        }
      } catch (tableCheckError) {
        console.error('检查用户表失败:', tableCheckError);
        // 尝试创建用户表
        await this._createUserTable();
      }

      // 检查用户是否存在
      const userId = userData.id || userData._id;
      if (!userId) {
        console.error('用户ID不存在，无法同步用户信息');
        return false;
      }

      try {
        const userCheck = await sqliteService.executeSql(
          `SELECT id FROM ${TABLES.USERS} WHERE id = ?`,
          [userId]
        );

        const now = new Date().toISOString();

        if (userCheck.rows.length === 0) {
          console.log('用户不存在，创建用户记录');
          // 插入用户记录
          await this._insertUser(userId, userData, now);
        } else {
          console.log('用户已存在，更新用户记录');
          // 更新用户记录
          await this._updateUser(userId, userData, now);
        }

        console.log('用户信息已同步到SQLite');
        return true;
      } catch (error) {
        console.error('同步用户信息到SQLite失败:', error);
        return false;
      }
    } catch (error) {
      console.error('确保用户存在失败:', error);
      return false;
    }
  }

  /**
   * 创建用户表
   * @private
   */
  async _createUserTable() {
    try {
      await sqliteService.executeSql(`
        CREATE TABLE IF NOT EXISTS ${TABLES.USERS} (
          id TEXT PRIMARY KEY,
          username TEXT NOT NULL UNIQUE,
          email TEXT,
          phone TEXT,
          password TEXT,
          first_name TEXT,
          last_name TEXT,
          nickname TEXT,
          avatar TEXT,
          bio TEXT,
          is_active INTEGER DEFAULT 1,
          is_staff INTEGER DEFAULT 0,
          date_joined TEXT,
          last_login TEXT,
          wechat_openid TEXT,
          wechat_unionid TEXT,
          wechat_avatar TEXT,
          qq_openid TEXT,
          qq_avatar TEXT,
          preferences TEXT,
          created_at TEXT,
          updated_at TEXT,
          version INTEGER DEFAULT 1,
          is_synced INTEGER DEFAULT 0,
          last_sync_at TEXT
        )
      `);
      console.log(`表 ${TABLES.USERS} 创建成功`);
      return true;
    } catch (error) {
      console.error('创建用户表失败:', error);
      throw error;
    }
  }

  /**
   * 插入用户记录
   * @param {string} userId - 用户ID
   * @param {Object} userData - 用户数据
   * @param {string} now - 当前时间
   * @private
   */
  async _insertUser(userId, userData, now) {
    try {
      // 准备用户数据，确保所有字段都有值（避免null）
      const user = {
        id: userId,
        username: userData.username || '',
        email: userData.email || '',
        phone: userData.phone || '',
        password: userData.password || '', // 注意：这里应该存储哈希后的密码
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
        version: 1,
        is_synced: 1,
        last_sync_at: now
      };

      // 插入用户记录
      await sqliteService.executeSql(
        `INSERT INTO ${TABLES.USERS} (
          id, username, email, phone, password, first_name, last_name,
          nickname, avatar, bio, is_active, is_staff, date_joined,
          last_login, wechat_openid, wechat_unionid, wechat_avatar,
          qq_openid, qq_avatar, preferences, created_at, updated_at,
          version, is_synced, last_sync_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          user.id, user.username, user.email, user.phone, user.password,
          user.first_name, user.last_name, user.nickname, user.avatar,
          user.bio, user.is_active, user.is_staff, user.date_joined,
          user.last_login, user.wechat_openid, user.wechat_unionid,
          user.wechat_avatar, user.qq_openid, user.qq_avatar,
          user.preferences, user.created_at, user.updated_at,
          user.version, user.is_synced, user.last_sync_at
        ]
      );

      console.log(`用户 ${userId} 已插入到SQLite`);
      return true;
    } catch (error) {
      console.error(`插入用户记录失败 (ID: ${userId}):`, error);
      throw error;
    }
  }

  /**
   * 更新用户记录
   * @param {string} userId - 用户ID
   * @param {Object} userData - 用户数据
   * @param {string} now - 当前时间
   * @private
   */
  async _updateUser(userId, userData, now) {
    try {
      // 准备更新数据
      const updateData = {
        username: userData.username || '',
        email: userData.email || '',
        phone: userData.phone || '',
        first_name: userData.first_name || '',
        last_name: userData.last_name || '',
        nickname: userData.nickname || '',
        avatar: userData.avatar || '',
        bio: userData.bio || '',
        is_active: userData.is_active || 1,
        is_staff: userData.is_staff || 0,
        wechat_openid: userData.wechat_openid || '',
        wechat_unionid: userData.wechat_unionid || '',
        wechat_avatar: userData.wechat_avatar || '',
        qq_openid: userData.qq_openid || '',
        qq_avatar: userData.qq_avatar || '',
        preferences: JSON.stringify(userData.preferences || {}),
        updated_at: now,
        version: userData.version ? userData.version + 1 : 1,
        is_synced: 1,
        last_sync_at: now
      };

      // 如果有密码更新，也更新密码
      if (userData.password) {
        updateData.password = userData.password;
      }

      // 如果有最后登录时间，也更新
      if (userData.last_login) {
        updateData.last_login = userData.last_login;
      }

      // 更新用户记录
      await sqliteService.executeSql(
        `UPDATE ${TABLES.USERS} SET
          username = ?, email = ?, phone = ?, first_name = ?,
          last_name = ?, nickname = ?, avatar = ?, bio = ?,
          is_active = ?, is_staff = ?, wechat_openid = ?,
          wechat_unionid = ?, wechat_avatar = ?, qq_openid = ?,
          qq_avatar = ?, preferences = ?, updated_at = ?,
          version = ?, is_synced = ?, last_sync_at = ?
          ${userData.password ? ', password = ?' : ''}
          ${userData.last_login ? ', last_login = ?' : ''}
        WHERE id = ?`,
        [
          updateData.username, updateData.email, updateData.phone,
          updateData.first_name, updateData.last_name, updateData.nickname,
          updateData.avatar, updateData.bio, updateData.is_active,
          updateData.is_staff, updateData.wechat_openid, updateData.wechat_unionid,
          updateData.wechat_avatar, updateData.qq_openid, updateData.qq_avatar,
          updateData.preferences, updateData.updated_at, updateData.version,
          updateData.is_synced, updateData.last_sync_at,
          ...(userData.password ? [updateData.password] : []),
          ...(userData.last_login ? [updateData.last_login] : []),
          userId
        ]
      );

      console.log(`用户 ${userId} 已更新到SQLite`);
      return true;
    } catch (error) {
      console.error(`更新用户记录失败 (ID: ${userId}):`, error);
      throw error;
    }
  }
}

export default new UserSyncService();
