/**
 * SQLite数据库服务
 * 提供SQLite数据库的初始化、表的创建和基本的CRUD操作
 */
import SQLite from 'react-native-sqlite-storage';
import { Platform } from 'react-native';
import RNFS from 'react-native-fs';

// 启用Promise
SQLite.enablePromise(true);

// 数据库名称
const DB_NAME = 'zeroislenotes.db';
// 数据库位置
const DB_LOCATION = Platform.OS === 'ios' ? 'Library' : 'default';

// 表名
export const TABLES = {
  USERS: 'users',
  NOTES: 'notes',
  CATEGORIES: 'categories',
  TAGS: 'tags',
  NOTE_TAGS: 'note_tags',
  REMINDERS: 'reminders',
  SETTINGS: 'settings',
  SYNC_INFO: 'sync_info',
  OFFLINE_QUEUE: 'offline_queue',
  FILES: 'files',
};

/**
 * SQLite数据库服务
 */
class SQLiteService {
  constructor() {
    this.database = null;
    this.isInitialized = false;
    this.DB_VERSION = 1; // 当前数据库版本
  }

  /**
   * 初始化数据库
   * @returns {Promise<SQLite.SQLiteDatabase>} 数据库实例
   */
  async init() {
    if (this.isInitialized && this.database) {
      return this.database;
    }

    try {
      // 打开数据库
      this.database = await SQLite.openDatabase({
        name: DB_NAME,
        location: DB_LOCATION,
        createFromLocation: 0,
      });

      console.log('SQLite数据库初始化成功');

      // 检查并升级数据库结构
      await this.checkAndUpgradeSchema();

      // 创建表
      await this.createTables();

      // 创建索引
      await this.createIndexes();

      // 优化数据库
      await this.optimizeDatabase();

      this.isInitialized = true;
      return this.database;
    } catch (error) {
      console.error('SQLite数据库初始化失败:', error);
      throw error;
    }
  }

  /**
   * 检查并升级数据库结构
   * @returns {Promise<void>}
   */
  async checkAndUpgradeSchema() {
    try {
      // 获取当前版本
      const result = await this.executeSql("PRAGMA user_version;");
      const currentVersion = result.rows.item(0).user_version;

      if (currentVersion < this.DB_VERSION) {
        console.log(`升级数据库架构: ${currentVersion} -> ${this.DB_VERSION}`);

        // 执行升级脚本
        await this.upgradeSchema(currentVersion, this.DB_VERSION);

        // 更新版本号
        await this.executeSql(`PRAGMA user_version = ${this.DB_VERSION};`);
        console.log('数据库架构升级完成');
      }
    } catch (error) {
      console.error('检查或升级数据库架构失败:', error);
      throw error;
    }
  }

  /**
   * 升级数据库结构
   * @param {number} fromVersion - 起始版本
   * @param {number} toVersion - 目标版本
   * @returns {Promise<void>}
   */
  async upgradeSchema(fromVersion, toVersion) {
    // 根据版本差异执行不同的升级脚本
    if (fromVersion === 0 && toVersion >= 1) {
      // 初始版本到版本1的升级
      // 这里不需要做什么，因为createTables会处理初始表创建
    }

    // 未来版本升级可以在这里添加
    // if (fromVersion === 1 && toVersion >= 2) { ... }
  }

  /**
   * 优化数据库
   * @returns {Promise<void>}
   */
  async optimizeDatabase() {
    try {
      // 执行VACUUM操作以优化数据库大小
      await this.executeSql("VACUUM;");

      // 分析数据库以优化查询性能
      await this.executeSql("ANALYZE;");

      console.log('数据库优化完成');
    } catch (error) {
      console.error('数据库优化失败:', error);
      // 不抛出异常，因为这不是关键操作
    }
  }

  /**
   * 创建表
   * @returns {Promise<void>}
   */
  async createTables() {
    try {
      // 用户表
      await this.database.executeSql(`
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

      // 分类表
      await this.database.executeSql(`
        CREATE TABLE IF NOT EXISTS ${TABLES.CATEGORIES} (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          parent_id TEXT,
          color TEXT,
          icon TEXT,
          sort_order INTEGER DEFAULT 0,
          is_deleted INTEGER DEFAULT 0,
          created_at TEXT,
          updated_at TEXT,
          version INTEGER DEFAULT 1,
          is_synced INTEGER DEFAULT 0,
          last_sync_at TEXT,
          FOREIGN KEY (user_id) REFERENCES ${TABLES.USERS} (id),
          FOREIGN KEY (parent_id) REFERENCES ${TABLES.CATEGORIES} (id)
        )
      `);

      // 标签表
      await this.database.executeSql(`
        CREATE TABLE IF NOT EXISTS ${TABLES.TAGS} (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          name TEXT NOT NULL,
          color TEXT,
          usage_count INTEGER DEFAULT 0,
          created_at TEXT,
          updated_at TEXT,
          version INTEGER DEFAULT 1,
          is_synced INTEGER DEFAULT 0,
          last_sync_at TEXT,
          FOREIGN KEY (user_id) REFERENCES ${TABLES.USERS} (id)
        )
      `);

      // 笔记表
      await this.database.executeSql(`
        CREATE TABLE IF NOT EXISTS ${TABLES.NOTES} (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          title TEXT NOT NULL,
          content TEXT,
          summary TEXT,
          category_id TEXT,
          is_favorite INTEGER DEFAULT 0,
          is_encrypted INTEGER DEFAULT 0,
          encryption_key TEXT,
          is_public INTEGER DEFAULT 0,
          is_deleted INTEGER DEFAULT 0,
          view_count INTEGER DEFAULT 0,
          edit_count INTEGER DEFAULT 0,
          last_viewed_at TEXT,
          created_at TEXT,
          updated_at TEXT,
          version INTEGER DEFAULT 1,
          is_synced INTEGER DEFAULT 0,
          last_sync_at TEXT,
          FOREIGN KEY (user_id) REFERENCES ${TABLES.USERS} (id),
          FOREIGN KEY (category_id) REFERENCES ${TABLES.CATEGORIES} (id)
        )
      `);

      // 笔记标签关联表
      await this.database.executeSql(`
        CREATE TABLE IF NOT EXISTS ${TABLES.NOTE_TAGS} (
          note_id TEXT,
          tag_id TEXT,
          created_at TEXT,
          version INTEGER DEFAULT 1,
          is_synced INTEGER DEFAULT 0,
          last_sync_at TEXT,
          PRIMARY KEY (note_id, tag_id),
          FOREIGN KEY (note_id) REFERENCES ${TABLES.NOTES} (id),
          FOREIGN KEY (tag_id) REFERENCES ${TABLES.TAGS} (id)
        )
      `);

      // 提醒表
      await this.database.executeSql(`
        CREATE TABLE IF NOT EXISTS ${TABLES.REMINDERS} (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          title TEXT NOT NULL,
          description TEXT,
          due_date TEXT,
          is_completed INTEGER DEFAULT 0,
          is_enabled INTEGER DEFAULT 1,
          priority INTEGER DEFAULT 0,
          category_id TEXT,
          note_id TEXT,
          frequency TEXT,
          repeat_interval INTEGER,
          repeat_end_date TEXT,
          notification_id TEXT,
          created_at TEXT,
          updated_at TEXT,
          version INTEGER DEFAULT 1,
          is_synced INTEGER DEFAULT 0,
          last_sync_at TEXT,
          FOREIGN KEY (user_id) REFERENCES ${TABLES.USERS} (id),
          FOREIGN KEY (category_id) REFERENCES ${TABLES.CATEGORIES} (id),
          FOREIGN KEY (note_id) REFERENCES ${TABLES.NOTES} (id)
        )
      `);

      // 设置表
      await this.database.executeSql(`
        CREATE TABLE IF NOT EXISTS ${TABLES.SETTINGS} (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          key TEXT NOT NULL,
          value TEXT,
          created_at TEXT,
          updated_at TEXT,
          version INTEGER DEFAULT 1,
          is_synced INTEGER DEFAULT 0,
          last_sync_at TEXT,
          FOREIGN KEY (user_id) REFERENCES ${TABLES.USERS} (id)
        )
      `);

      // 同步信息表
      await this.database.executeSql(`
        CREATE TABLE IF NOT EXISTS ${TABLES.SYNC_INFO} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          table_name TEXT NOT NULL,
          last_sync_time TEXT,
          sync_status TEXT,
          error_message TEXT,
          created_at TEXT,
          updated_at TEXT
        )
      `);

      // 离线队列表
      await this.database.executeSql(`
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

      // 文件表
      await this.database.executeSql(`
        CREATE TABLE IF NOT EXISTS ${TABLES.FILES} (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL,
          note_id TEXT,
          name TEXT NOT NULL,
          path TEXT NOT NULL,
          type TEXT NOT NULL,
          size INTEGER,
          mime_type TEXT,
          is_uploaded INTEGER DEFAULT 0,
          remote_url TEXT,
          created_at TEXT,
          updated_at TEXT,
          version INTEGER DEFAULT 1,
          is_synced INTEGER DEFAULT 0,
          last_sync_at TEXT,
          FOREIGN KEY (user_id) REFERENCES ${TABLES.USERS} (id),
          FOREIGN KEY (note_id) REFERENCES ${TABLES.NOTES} (id)
        )
      `);

      console.log('SQLite表创建成功');
    } catch (error) {
      console.error('创建表失败:', error);
      throw error;
    }
  }

  /**
   * 创建索引以提高查询性能
   * @returns {Promise<void>}
   */
  async createIndexes() {
    try {
      // 用户表索引
      await this.database.executeSql(`CREATE INDEX IF NOT EXISTS idx_users_username ON ${TABLES.USERS} (username)`);
      await this.database.executeSql(`CREATE INDEX IF NOT EXISTS idx_users_email ON ${TABLES.USERS} (email)`);

      // 笔记表索引
      await this.database.executeSql(`CREATE INDEX IF NOT EXISTS idx_notes_user_id ON ${TABLES.NOTES} (user_id)`);
      await this.database.executeSql(`CREATE INDEX IF NOT EXISTS idx_notes_category_id ON ${TABLES.NOTES} (category_id)`);
      await this.database.executeSql(`CREATE INDEX IF NOT EXISTS idx_notes_is_deleted ON ${TABLES.NOTES} (is_deleted)`);
      await this.database.executeSql(`CREATE INDEX IF NOT EXISTS idx_notes_is_favorite ON ${TABLES.NOTES} (is_favorite)`);
      await this.database.executeSql(`CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON ${TABLES.NOTES} (updated_at)`);

      // 分类表索引
      await this.database.executeSql(`CREATE INDEX IF NOT EXISTS idx_categories_user_id ON ${TABLES.CATEGORIES} (user_id)`);
      await this.database.executeSql(`CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON ${TABLES.CATEGORIES} (parent_id)`);

      // 标签表索引
      await this.database.executeSql(`CREATE INDEX IF NOT EXISTS idx_tags_user_id ON ${TABLES.TAGS} (user_id)`);
      await this.database.executeSql(`CREATE INDEX IF NOT EXISTS idx_tags_name ON ${TABLES.TAGS} (name)`);

      // 提醒表索引
      await this.database.executeSql(`CREATE INDEX IF NOT EXISTS idx_reminders_user_id ON ${TABLES.REMINDERS} (user_id)`);
      await this.database.executeSql(`CREATE INDEX IF NOT EXISTS idx_reminders_due_date ON ${TABLES.REMINDERS} (due_date)`);

      // 设置表索引
      await this.database.executeSql(`CREATE INDEX IF NOT EXISTS idx_settings_user_id_key ON ${TABLES.SETTINGS} (user_id, key)`);

      // 文件表索引
      await this.database.executeSql(`CREATE INDEX IF NOT EXISTS idx_files_user_id ON ${TABLES.FILES} (user_id)`);
      await this.database.executeSql(`CREATE INDEX IF NOT EXISTS idx_files_note_id ON ${TABLES.FILES} (note_id)`);

      console.log('SQLite索引创建成功');
    } catch (error) {
      console.error('创建索引失败:', error);
      throw error;
    }
  }

  /**
   * 执行SQL查询
   * @param {string} query - SQL查询语句
   * @param {Array} params - 查询参数
   * @returns {Promise<Array>} 查询结果
   */
  async executeSql(query, params = []) {
    if (!this.isInitialized) {
      await this.init();
    }

    try {
      const [results] = await this.database.executeSql(query, params);
      return results;
    } catch (error) {
      console.error('执行SQL查询失败:', error);
      throw error;
    }
  }

  /**
   * 关闭数据库
   * @returns {Promise<void>}
   */
  async close() {
    if (this.database) {
      await this.database.close();
      this.database = null;
      this.isInitialized = false;
      console.log('SQLite数据库已关闭');
    }
  }

  /**
   * 获取数据库路径
   * @returns {Promise<string>} 数据库路径
   */
  async getDatabasePath() {
    if (Platform.OS === 'android') {
      return `${RNFS.DocumentDirectoryPath}/${DB_NAME}`;
    } else {
      return `${RNFS.LibraryDirectoryPath}/${DB_NAME}`;
    }
  }

  /**
   * 备份数据库
   * @param {string} backupPath - 备份路径
   * @returns {Promise<string>} 备份文件路径
   */
  async backupDatabase(backupPath) {
    try {
      const dbPath = await this.getDatabasePath();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupFilePath = `${backupPath}/zeroislenotes_backup_${timestamp}.db`;

      await RNFS.copyFile(dbPath, backupFilePath);
      console.log('数据库备份成功:', backupFilePath);

      return backupFilePath;
    } catch (error) {
      console.error('数据库备份失败:', error);
      throw error;
    }
  }

  /**
   * 恢复数据库
   * @param {string} backupFilePath - 备份文件路径
   * @returns {Promise<boolean>} 是否成功
   */
  async restoreDatabase(backupFilePath) {
    try {
      // 关闭当前数据库连接
      await this.close();

      const dbPath = await this.getDatabasePath();

      // 复制备份文件到数据库路径
      await RNFS.copyFile(backupFilePath, dbPath);

      // 重新初始化数据库
      await this.init();

      console.log('数据库恢复成功');
      return true;
    } catch (error) {
      console.error('数据库恢复失败:', error);
      throw error;
    }
  }
}

// 创建单例
const sqliteService = new SQLiteService();

export default sqliteService;
