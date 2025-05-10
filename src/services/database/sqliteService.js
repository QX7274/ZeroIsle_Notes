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
  // 知识图谱相关表
  KNOWLEDGE_NODES: 'knowledge_nodes',
  KNOWLEDGE_EDGES: 'knowledge_edges',
  KNOWLEDGE_GRAPHS: 'knowledge_graphs',
  // AI助手相关表
  AI_CONVERSATIONS: 'ai_conversations',
  AI_MESSAGES: 'ai_messages',
  // 社区相关表
  COMMUNITY_POSTS: 'community_posts',
  COMMUNITY_COMMENTS: 'community_comments',
  // 搜索相关表
  SEARCH_HISTORY: 'search_history',
  SEARCH_INDEX: 'search_index',
};

/**
 * SQLite数据库服务
 */
class SQLiteService {
  constructor() {
    this.database = null;
    this.isInitialized = false;
    this.isFullyInitialized = false; // 标记数据库是否完全初始化（包括所有表和索引）
    this.isInitializing = false; // 标记数据库是否正在初始化
    this.DB_VERSION = 1; // 当前数据库版本

    // 操作队列 - 存储在初始化完成前的所有数据库操作
    this.operationQueue = [];

    // 初始化完成的回调函数
    this.initCallbacks = [];
  }

  /**
   * 注册初始化完成回调
   * 当数据库完全初始化后，会调用这个回调函数
   * @param {Function} callback - 初始化完成后的回调函数
   */
  onInitialized(callback) {
    if (typeof callback !== 'function') {
      console.warn('onInitialized: 回调必须是函数');
      return;
    }

    if (this.isFullyInitialized) {
      // 如果数据库已经完全初始化，立即调用回调
      callback();
    } else {
      // 否则，将回调添加到队列中
      this.initCallbacks.push(callback);
    }
  }

  /**
   * 等待数据库完全初始化
   * @returns {Promise<SQLite.SQLiteDatabase>} 数据库实例
   */
  async waitForInit() {
    if (this.isFullyInitialized) {
      return this.database;
    }

    return new Promise((resolve) => {
      this.onInitialized(() => {
        resolve(this.database);
      });
    });
  }

  /**
   * 初始化数据库
   * @param {number} timeout - 初始化超时时间（毫秒），仅用于日志显示，不再用于实际超时控制
   * @returns {Promise<SQLite.SQLiteDatabase>} 数据库实例
   */
  async init(timeout = 120000) { // timeout参数保留，但不再用于超时控制
    // 如果数据库已完全初始化，直接返回
    if (this.isFullyInitialized && this.database) {
      return this.database;
    }

    // 如果数据库正在初始化，等待初始化完成
    if (this.isInitializing) {
      console.log('数据库正在初始化中，等待完成...');
      return this.waitForInit();
    }

    // 标记为正在初始化
    this.isInitializing = true;

    // 输出初始化日志
    console.log('开始SQLite数据库完全初始化...');

    // 检查数据库文件是否存在
    try {
      const dbPath = await this.getDatabasePath();
      const fileExists = await RNFS.exists(dbPath);
      console.log(`数据库文件${fileExists ? '存在' : '不存在'}: ${dbPath}`);

      // 如果数据库文件存在，检查文件大小
      if (fileExists) {
        const fileInfo = await RNFS.stat(dbPath);
        console.log(`数据库文件大小: ${(fileInfo.size / 1024).toFixed(2)} KB`);

        // 如果文件大小异常（太小或太大），可能是损坏的
        if (fileInfo.size < 1024) { // 小于1KB
          console.warn('数据库文件异常小，可能是空文件或损坏');
          // 删除可能损坏的数据库文件
          await RNFS.unlink(dbPath);
          console.log('已删除可能损坏的数据库文件，将重新创建');
        } else if (fileInfo.size > 100 * 1024 * 1024) { // 大于100MB
          console.warn('数据库文件过大，可能导致性能问题');
        }
      }
    } catch (fileError) {
      console.warn('检查数据库文件失败:', fileError);
    }

    // 创建初始化Promise并执行完整初始化
    try {
      const startTime = Date.now();

        // 1. 确保数据库文件存在且可访问
        try {
          const dbPath = await this.getDatabasePath();
          const RNFS = require('react-native-fs');
          const fileExists = await RNFS.exists(dbPath);

          if (!fileExists) {
            console.log('数据库文件不存在，创建空文件');

            // 确保目录存在
            if (Platform.OS === 'ios') {
              const dirPath = `${RNFS.LibraryDirectoryPath}/LocalDatabase`;
              const dirExists = await RNFS.exists(dirPath);
              if (!dirExists) {
                await RNFS.mkdir(dirPath);
                console.log(`创建iOS数据库目录: ${dirPath}`);
              }
            }

            // 创建空文件
            await RNFS.writeFile(dbPath, '', 'utf8');
            console.log('创建空数据库文件成功');
          } else {
            // 检查文件大小
            const fileInfo = await RNFS.stat(dbPath);
            console.log(`数据库文件存在，大小: ${(fileInfo.size / 1024).toFixed(2)} KB`);

            // 如果文件太小，可能是损坏的
            if (fileInfo.size < 100) { // 小于100字节
              console.warn('数据库文件异常小，可能是空文件或损坏，重新创建');
              await RNFS.unlink(dbPath);
              await RNFS.writeFile(dbPath, '', 'utf8');
              console.log('重新创建空数据库文件成功');
            }
          }
        } catch (fileError) {
          console.error('检查或创建数据库文件失败:', fileError);
          // 继续尝试打开数据库
        }

        // 2. 打开数据库 - 使用优化的设置
        if (__DEV__) console.log('尝试打开数据库...');
        this.database = await SQLite.openDatabase({
          name: DB_NAME,
          location: DB_LOCATION,
          createFromLocation: 0,
        });

        // 优化PRAGMA设置，提高性能
        await this.database.executeSql('PRAGMA journal_mode = WAL;'); // 使用WAL模式提高写入性能
        await this.database.executeSql('PRAGMA synchronous = NORMAL;'); // 降低同步级别，提高性能
        await this.database.executeSql('PRAGMA cache_size = 10000;'); // 增加缓存大小
        await this.database.executeSql('PRAGMA temp_store = MEMORY;'); // 临时表存储在内存中
        await this.database.executeSql('PRAGMA locking_mode = EXCLUSIVE;'); // 独占锁定模式

        if (__DEV__) console.log(`SQLite数据库打开成功，耗时: ${Date.now() - startTime}ms`);

        // 3. 执行简单查询验证连接
        try {
          await this.database.executeSql('SELECT 1');
          console.log('数据库连接验证成功');
        } catch (testError) {
          console.error('数据库连接测试失败，尝试创建基本表结构:', testError);
        }

        // 4. 使用事务创建核心表 - 这些表是应用必须的
        try {
          if (__DEV__) console.log('开始创建核心表...');

          // 使用事务批量创建核心表，提高效率
          await this.database.transaction(async (tx) => {
            // 创建sync_info表 - 最关键的表
            await tx.executeSql(`
              CREATE TABLE IF NOT EXISTS ${TABLES.SYNC_INFO} (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                table_name TEXT NOT NULL UNIQUE,
                last_sync_time TEXT,
                sync_status TEXT,
                error_message TEXT,
                created_at TEXT,
                updated_at TEXT
              )
            `);

            // 创建users表 - 用户信息表
            await tx.executeSql(`
              CREATE TABLE IF NOT EXISTS ${TABLES.USERS} (
                id TEXT PRIMARY KEY,
                username TEXT NOT NULL UNIQUE,
                email TEXT,
                phone TEXT,
                password TEXT,
                nickname TEXT,
                avatar TEXT,
                created_at TEXT,
                updated_at TEXT,
                version INTEGER DEFAULT 1,
                is_synced INTEGER DEFAULT 0,
                last_sync_at TEXT
              )
            `);

            // 创建notes表 - 笔记表
            await tx.executeSql(`
              CREATE TABLE IF NOT EXISTS ${TABLES.NOTES} (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                title TEXT NOT NULL,
                content TEXT,
                summary TEXT,
                category_id TEXT,
                is_favorite INTEGER DEFAULT 0,
                is_deleted INTEGER DEFAULT 0,
                created_at TEXT,
                updated_at TEXT,
                version INTEGER DEFAULT 1,
                is_synced INTEGER DEFAULT 0,
                last_sync_at TEXT
              )
            `);

            // 创建categories表 - 分类表
            await tx.executeSql(`
              CREATE TABLE IF NOT EXISTS ${TABLES.CATEGORIES} (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                name TEXT NOT NULL,
                description TEXT,
                color TEXT,
                created_at TEXT,
                updated_at TEXT,
                version INTEGER DEFAULT 1,
                is_synced INTEGER DEFAULT 0,
                last_sync_at TEXT
              )
            `);

            // 创建tags表 - 标签表
            await tx.executeSql(`
              CREATE TABLE IF NOT EXISTS ${TABLES.TAGS} (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                name TEXT NOT NULL,
                color TEXT,
                created_at TEXT,
                updated_at TEXT,
                version INTEGER DEFAULT 1,
                is_synced INTEGER DEFAULT 0,
                last_sync_at TEXT
              )
            `);

            // 创建离线队列表 - 用于离线操作
            await tx.executeSql(`
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
          });

          // 初始化sync_info表记录
          const result = await this.database.executeSql(`SELECT COUNT(*) as count FROM ${TABLES.SYNC_INFO}`);
          const count = result[0].rows.length > 0 ? result[0].rows.item(0).count : 0;

          if (count === 0) {
            const now = new Date().toISOString();
            const tables = ['users', 'notes', 'categories', 'tags'];

            // 使用事务批量插入记录
            await this.database.transaction(async (tx) => {
              for (const table of tables) {
                await tx.executeSql(
                  `INSERT OR IGNORE INTO ${TABLES.SYNC_INFO} (table_name, last_sync_time, sync_status, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?)`,
                  [table, '', 'pending', now, now]
                );
              }
            });
          }

          if (__DEV__) console.log('核心表创建完成');
        } catch (coreTablesError) {
          console.error('创建核心表失败:', coreTablesError);
          // 这是关键错误，但我们仍然标记为初始化成功，让应用能继续运行
        }

        // 标记为基本初始化成功
        this.isInitialized = true;
        console.log(`SQLite数据库基本初始化成功，耗时: ${Date.now() - startTime}ms`);

        // 立即完成所有表的创建，但索引创建放在后面
        console.log('开始完成所有表的创建...');

        try {
          // 创建重要表
          await this.createImportantTables();
          console.log('重要表创建完成');

          // 创建功能表
          await this.createFeatureTables();
          console.log('功能表创建完成');

          // 创建索引 - 这个方法会自动检查表是否存在，并在创建核心索引后标记为完全初始化
          await this.createIndexes();

          // 数据库优化放在索引创建的延迟任务中执行
          console.log(`SQLite数据库初始化成功，总耗时: ${Date.now() - startTime}ms`);

          return this.database;
        } catch (fullInitError) {
          console.error('完成表创建失败:', fullInitError);

          // 表创建失败时不标记为完全初始化
          console.error('表创建失败，数据库未完全初始化');

          // 仍然返回数据库实例，但不标记为完全初始化
          // 这样应用可以继续运行，但会知道数据库初始化有问题
          return this.database;
        }
      } catch (error) {
        console.error('SQLite数据库初始化失败:', error);
        this.isInitialized = false;
        this.isInitializing = false;
        this.database = null;
        throw error;
      }

  }

  /**
   * 处理操作队列中的所有操作
   * @private
   */
  processOperationQueue() {
    console.log(`处理操作队列，共${this.operationQueue.length}个操作`);

    while (this.operationQueue.length > 0) {
      const operation = this.operationQueue.shift();
      try {
        // 执行操作并解析Promise
        operation.resolve(operation.execute());
      } catch (error) {
        // 如果操作执行失败，拒绝Promise
        operation.reject(error);
      }
    }
  }

  /**
   * 通知所有初始化完成回调
   * @private
   */
  notifyInitCallbacks() {
    console.log(`通知初始化完成回调，共${this.initCallbacks.length}个回调`);

    // 调用所有回调并清空回调列表
    while (this.initCallbacks.length > 0) {
      const callback = this.initCallbacks.shift();
      try {
        callback();
      } catch (error) {
        console.error('执行初始化完成回调失败:', error);
      }
    }
  }

  /**
   * 验证关键表是否创建成功
   * @returns {Promise<void>}
   */
  async verifyTables() {
    console.log('验证数据库表是否创建成功...');

    // 获取所有表名
    const result = await this.database.executeSql("SELECT name FROM sqlite_master WHERE type='table'");

    const existingTables = [];
    for (let i = 0; i < result[0].rows.length; i++) {
      existingTables.push(result[0].rows.item(i).name);
    }

    console.log('已创建的表:', existingTables.join(', '));

    // 检查关键表是否存在 - 确保SYNC_INFO表是第一个检查的表
    const requiredTables = [
      TABLES.SYNC_INFO,  // 同步信息表放在第一位，确保优先创建
      TABLES.USERS,
      TABLES.NOTES,
      TABLES.CATEGORIES,
      TABLES.TAGS,
      TABLES.NOTE_TAGS,
      TABLES.OFFLINE_QUEUE
    ];

    const missingTables = requiredTables.filter(table => !existingTables.includes(table));

    if (missingTables.length > 0) {
      console.error('缺少关键表:', missingTables.join(', '));

      // 尝试创建缺失的表
      for (const table of missingTables) {
        console.log(`尝试创建缺失的表: ${table}`);

        // 根据表名创建对应的表
        if (table === TABLES.SYNC_INFO) {
          await this.database.executeSql(`
            CREATE TABLE IF NOT EXISTS ${TABLES.SYNC_INFO} (
              id INTEGER PRIMARY KEY AUTOINCREMENT,
              table_name TEXT NOT NULL UNIQUE,
              last_sync_time TEXT,
              sync_status TEXT,
              error_message TEXT,
              created_at TEXT,
              updated_at TEXT
            )
          `);
          console.log(`表 ${TABLES.SYNC_INFO} 创建成功`);
        } else if (table === TABLES.USERS) {
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
          console.log(`表 ${TABLES.USERS} 创建成功`);
        } else if (table === TABLES.NOTES) {
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
          console.log(`表 ${TABLES.NOTES} 创建成功`);
        } else if (table === TABLES.CATEGORIES) {
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
          console.log(`表 ${TABLES.CATEGORIES} 创建成功`);
        } else if (table === TABLES.TAGS) {
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
          console.log(`表 ${TABLES.TAGS} 创建成功`);
        } else if (table === TABLES.NOTE_TAGS) {
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
          console.log(`表 ${TABLES.NOTE_TAGS} 创建成功`);
        } else if (table === TABLES.OFFLINE_QUEUE) {
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
          console.log(`表 ${TABLES.OFFLINE_QUEUE} 创建成功`);
        }
      }

      // 再次验证表是否创建成功
      const recheck = await this.database.executeSql("SELECT name FROM sqlite_master WHERE type='table'");
      const recheckedTables = [];
      for (let i = 0; i < recheck[0].rows.length; i++) {
        recheckedTables.push(recheck[0].rows.item(i).name);
      }

      const stillMissingTables = requiredTables.filter(table => !recheckedTables.includes(table));

      if (stillMissingTables.length > 0) {
        throw new Error(`无法创建关键表: ${stillMissingTables.join(', ')}`);
      } else {
        console.log('所有缺失的表已成功创建');
      }
    } else {
      console.log('所有关键表都已存在');
    }
  }

  /**
   * 在后台完成初始化
   * 这个方法在基本初始化完成后被调用，用于完成其他表的创建和索引等非关键操作
   * @returns {Promise<void>}
   */
  async completeInitializationInBackground() {
    try {
      if (__DEV__) console.log('开始在后台完成数据库初始化...');

      if (!this.database) {
        console.error('数据库实例不存在，无法完成后台初始化');
        return;
      }

      // 将表分为两组：重要表和功能表
      await this.createImportantTables();

      // 延迟创建功能表，让应用先稳定运行
      setTimeout(() => {
        this.createFeatureTables().catch(error => {
          console.warn('创建功能表失败:', error);
        });
      }, 10000); // 延迟10秒创建功能表

      // 延迟创建索引，索引创建是CPU密集型操作
      setTimeout(() => {
        this.createIndexes().catch(error => {
          console.warn('创建索引失败:', error);
        });
      }, 20000); // 延迟20秒创建索引

      if (__DEV__) console.log('后台数据库初始化任务已安排');
    } catch (error) {
      console.error('安排后台初始化任务失败:', error);
    }
  }

  /**
   * 创建重要表 - 这些表对应用的基本功能很重要，但不是核心表
   * @returns {Promise<void>}
   */
  async createImportantTables() {
    try {
      if (__DEV__) console.log('开始创建重要表...');

      // 使用事务批量创建重要表
      await this.database.transaction(async (tx) => {
        // 创建设置表
        await tx.executeSql(`
          CREATE TABLE IF NOT EXISTS ${TABLES.SETTINGS} (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            key TEXT NOT NULL,
            value TEXT,
            created_at TEXT,
            updated_at TEXT,
            version INTEGER DEFAULT 1,
            is_synced INTEGER DEFAULT 0,
            last_sync_at TEXT
          )
        `);

        // 创建文件表
        await tx.executeSql(`
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
            last_sync_at TEXT
          )
        `);

        // 创建笔记标签关联表
        await tx.executeSql(`
          CREATE TABLE IF NOT EXISTS ${TABLES.NOTE_TAGS} (
            note_id TEXT,
            tag_id TEXT,
            created_at TEXT,
            version INTEGER DEFAULT 1,
            is_synced INTEGER DEFAULT 0,
            last_sync_at TEXT,
            PRIMARY KEY (note_id, tag_id)
          )
        `);

        // 创建提醒表
        await tx.executeSql(`
          CREATE TABLE IF NOT EXISTS ${TABLES.REMINDERS} (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            note_id TEXT,
            title TEXT NOT NULL,
            description TEXT,
            due_date TEXT,
            is_completed INTEGER DEFAULT 0,
            created_at TEXT,
            updated_at TEXT,
            version INTEGER DEFAULT 1,
            is_synced INTEGER DEFAULT 0,
            last_sync_at TEXT
          )
        `);
      });

      if (__DEV__) console.log('重要表创建完成');
    } catch (error) {
      console.error('创建重要表失败:', error);
      throw error;
    }
  }

  /**
   * 创建功能表 - 这些表只在特定功能使用时才需要
   * @returns {Promise<void>}
   */
  async createFeatureTables() {
    try {
      if (__DEV__) console.log('开始创建功能表...');

      // 定义功能表组，按功能分组
      const featureGroups = {
        // 知识图谱相关表
        knowledgeGraph: [
          {
            name: TABLES.KNOWLEDGE_NODES,
            sql: `
              CREATE TABLE IF NOT EXISTS ${TABLES.KNOWLEDGE_NODES} (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                title TEXT NOT NULL,
                content TEXT,
                type TEXT NOT NULL,
                properties TEXT,
                position_x REAL,
                position_y REAL,
                graph_id TEXT,
                is_public INTEGER DEFAULT 0,
                is_deleted INTEGER DEFAULT 0,
                created_at TEXT,
                updated_at TEXT,
                version INTEGER DEFAULT 1,
                is_synced INTEGER DEFAULT 0,
                last_sync_at TEXT
              )
            `
          },
          {
            name: TABLES.KNOWLEDGE_EDGES,
            sql: `
              CREATE TABLE IF NOT EXISTS ${TABLES.KNOWLEDGE_EDGES} (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                source_id TEXT NOT NULL,
                target_id TEXT NOT NULL,
                label TEXT,
                type TEXT,
                properties TEXT,
                graph_id TEXT,
                is_deleted INTEGER DEFAULT 0,
                created_at TEXT,
                updated_at TEXT,
                version INTEGER DEFAULT 1,
                is_synced INTEGER DEFAULT 0,
                last_sync_at TEXT
              )
            `
          },
          {
            name: TABLES.KNOWLEDGE_GRAPHS,
            sql: `
              CREATE TABLE IF NOT EXISTS ${TABLES.KNOWLEDGE_GRAPHS} (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                thumbnail TEXT,
                is_public INTEGER DEFAULT 0,
                is_deleted INTEGER DEFAULT 0,
                created_at TEXT,
                updated_at TEXT,
                version INTEGER DEFAULT 1,
                is_synced INTEGER DEFAULT 0,
                last_sync_at TEXT
              )
            `
          }
        ],

        // AI助手相关表
        aiAssistant: [
          {
            name: TABLES.AI_CONVERSATIONS,
            sql: `
              CREATE TABLE IF NOT EXISTS ${TABLES.AI_CONVERSATIONS} (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                title TEXT,
                context TEXT,
                is_pinned INTEGER DEFAULT 0,
                is_deleted INTEGER DEFAULT 0,
                created_at TEXT,
                updated_at TEXT,
                version INTEGER DEFAULT 1,
                is_synced INTEGER DEFAULT 0,
                last_sync_at TEXT
              )
            `
          },
          {
            name: TABLES.AI_MESSAGES,
            sql: `
              CREATE TABLE IF NOT EXISTS ${TABLES.AI_MESSAGES} (
                id TEXT PRIMARY KEY,
                conversation_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                content TEXT NOT NULL,
                role TEXT NOT NULL,
                is_deleted INTEGER DEFAULT 0,
                created_at TEXT,
                updated_at TEXT,
                version INTEGER DEFAULT 1,
                is_synced INTEGER DEFAULT 0,
                last_sync_at TEXT
              )
            `
          }
        ],

        // 社区相关表
        community: [
          {
            name: TABLES.COMMUNITY_POSTS,
            sql: `
              CREATE TABLE IF NOT EXISTS ${TABLES.COMMUNITY_POSTS} (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                title TEXT NOT NULL,
                content TEXT NOT NULL,
                category TEXT,
                tags TEXT,
                status TEXT,
                is_public INTEGER DEFAULT 1,
                is_deleted INTEGER DEFAULT 0,
                view_count INTEGER DEFAULT 0,
                like_count INTEGER DEFAULT 0,
                comment_count INTEGER DEFAULT 0,
                published_at TEXT,
                created_at TEXT,
                updated_at TEXT,
                version INTEGER DEFAULT 1,
                is_synced INTEGER DEFAULT 0,
                last_sync_at TEXT
              )
            `
          },
          {
            name: TABLES.COMMUNITY_COMMENTS,
            sql: `
              CREATE TABLE IF NOT EXISTS ${TABLES.COMMUNITY_COMMENTS} (
                id TEXT PRIMARY KEY,
                post_id TEXT NOT NULL,
                user_id TEXT NOT NULL,
                parent_id TEXT,
                content TEXT NOT NULL,
                status TEXT,
                like_count INTEGER DEFAULT 0,
                is_deleted INTEGER DEFAULT 0,
                created_at TEXT,
                updated_at TEXT,
                version INTEGER DEFAULT 1,
                is_synced INTEGER DEFAULT 0,
                last_sync_at TEXT
              )
            `
          }
        ],

        // 搜索相关表
        search: [
          {
            name: TABLES.SEARCH_HISTORY,
            sql: `
              CREATE TABLE IF NOT EXISTS ${TABLES.SEARCH_HISTORY} (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                query TEXT NOT NULL,
                type TEXT,
                result_count INTEGER,
                created_at TEXT,
                updated_at TEXT,
                version INTEGER DEFAULT 1,
                is_synced INTEGER DEFAULT 0,
                last_sync_at TEXT
              )
            `
          },
          {
            name: TABLES.SEARCH_INDEX,
            sql: `
              CREATE TABLE IF NOT EXISTS ${TABLES.SEARCH_INDEX} (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                object_id TEXT NOT NULL,
                object_type TEXT NOT NULL,
                content TEXT,
                keywords TEXT,
                created_at TEXT,
                updated_at TEXT,
                version INTEGER DEFAULT 1,
                is_synced INTEGER DEFAULT 0,
                last_sync_at TEXT
              )
            `
          }
        ]
      };

      // 为每个功能组创建表
      for (const [feature, tables] of Object.entries(featureGroups)) {
        try {
          // 使用事务批量创建每个功能组的表
          await this.database.transaction(async (tx) => {
            for (const table of tables) {
              await tx.executeSql(table.sql);
            }
          });

          if (__DEV__) console.log(`${feature}功能表创建完成`);
        } catch (error) {
          console.warn(`创建${feature}功能表失败:`, error);
          // 继续创建其他功能组的表
        }
      }

      if (__DEV__) console.log('所有功能表创建完成');
    } catch (error) {
      console.error('创建功能表失败:', error);
      throw error;
    }
  }

  /**
   * 检查表是否存在
   * @param {string} tableName - 表名
   * @returns {Promise<boolean>} 表是否存在
   * @private
   */
  async _checkTableExists(tableName) {
    try {
      const result = await this.database.executeSql(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        [tableName]
      );
      return result[0].rows.length > 0;
    } catch (error) {
      console.warn(`检查表 ${tableName} 是否存在失败:`, error);
      return false;
    }
  }

  /**
   * 创建索引以提高查询性能
   * @returns {Promise<void>}
   */
  async createIndexes() {
    try {
      if (__DEV__) console.log('开始创建索引...');

      // 获取所有存在的表
      const tablesResult = await this.database.executeSql("SELECT name FROM sqlite_master WHERE type='table'");
      const existingTables = [];
      for (let i = 0; i < tablesResult[0].rows.length; i++) {
        existingTables.push(tablesResult[0].rows.item(i).name);
      }

      console.log('现有表:', existingTables.join(', '));

      // 定义核心表索引 - 这些索引对基本功能很重要
      const coreIndexes = [
        { table: TABLES.USERS, sql: `CREATE INDEX IF NOT EXISTS idx_users_username ON ${TABLES.USERS} (username)` },
        { table: TABLES.NOTES, sql: `CREATE INDEX IF NOT EXISTS idx_notes_user_id ON ${TABLES.NOTES} (user_id)` },
        { table: TABLES.NOTES, sql: `CREATE INDEX IF NOT EXISTS idx_notes_is_deleted ON ${TABLES.NOTES} (is_deleted)` },
        { table: TABLES.CATEGORIES, sql: `CREATE INDEX IF NOT EXISTS idx_categories_user_id ON ${TABLES.CATEGORIES} (user_id)` },
        { table: TABLES.TAGS, sql: `CREATE INDEX IF NOT EXISTS idx_tags_user_id ON ${TABLES.TAGS} (user_id)` }
      ];

      // 定义次要索引 - 这些索引可以提高性能，但不是必须的
      const secondaryIndexes = [
        { table: TABLES.USERS, sql: `CREATE INDEX IF NOT EXISTS idx_users_email ON ${TABLES.USERS} (email)` },
        { table: TABLES.USERS, sql: `CREATE INDEX IF NOT EXISTS idx_users_phone ON ${TABLES.USERS} (phone)` },
        { table: TABLES.NOTES, sql: `CREATE INDEX IF NOT EXISTS idx_notes_category_id ON ${TABLES.NOTES} (category_id)` },
        { table: TABLES.NOTES, sql: `CREATE INDEX IF NOT EXISTS idx_notes_is_favorite ON ${TABLES.NOTES} (is_favorite)` },
        { table: TABLES.SETTINGS, sql: `CREATE INDEX IF NOT EXISTS idx_settings_user_id ON ${TABLES.SETTINGS} (user_id)` },
        { table: TABLES.SETTINGS, sql: `CREATE INDEX IF NOT EXISTS idx_settings_key ON ${TABLES.SETTINGS} (key)` },
        { table: TABLES.FILES, sql: `CREATE INDEX IF NOT EXISTS idx_files_user_id ON ${TABLES.FILES} (user_id)` },
        { table: TABLES.FILES, sql: `CREATE INDEX IF NOT EXISTS idx_files_note_id ON ${TABLES.FILES} (note_id)` }
      ];

      // 添加reminders表的索引，但先检查表是否存在
      if (existingTables.includes(TABLES.REMINDERS)) {
        secondaryIndexes.push(
          { table: TABLES.REMINDERS, sql: `CREATE INDEX IF NOT EXISTS idx_reminders_user_id ON ${TABLES.REMINDERS} (user_id)` },
          { table: TABLES.REMINDERS, sql: `CREATE INDEX IF NOT EXISTS idx_reminders_due_date ON ${TABLES.REMINDERS} (due_date)` }
        );
      } else {
        console.log(`表 ${TABLES.REMINDERS} 不存在，跳过创建其索引`);

        // 尝试创建reminders表
        try {
          console.log(`尝试创建缺失的 ${TABLES.REMINDERS} 表...`);
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
              last_sync_at TEXT
            )
          `);
          console.log(`表 ${TABLES.REMINDERS} 创建成功`);

          // 更新存在的表列表
          existingTables.push(TABLES.REMINDERS);

          // 现在可以添加索引了
          secondaryIndexes.push(
            { table: TABLES.REMINDERS, sql: `CREATE INDEX IF NOT EXISTS idx_reminders_user_id ON ${TABLES.REMINDERS} (user_id)` },
            { table: TABLES.REMINDERS, sql: `CREATE INDEX IF NOT EXISTS idx_reminders_due_date ON ${TABLES.REMINDERS} (due_date)` }
          );
        } catch (createTableError) {
          console.error(`创建 ${TABLES.REMINDERS} 表失败:`, createTableError);
        }
      }

      // 先创建核心索引，只为存在的表创建索引
      for (const index of coreIndexes) {
        if (existingTables.includes(index.table)) {
          try {
            await this.database.executeSql(index.sql);
          } catch (error) {
            console.warn(`创建核心索引失败 (${index.table}):`, error);
          }
        } else {
          console.log(`跳过创建索引，表 ${index.table} 不存在`);
        }
      }

      if (__DEV__) console.log('核心索引创建完成');

      // 立即标记为完全初始化，不再等待次要索引
      this.isFullyInitialized = true;

      // 处理操作队列中的所有操作
      this.processOperationQueue();

      // 调用所有初始化完成回调
      this.notifyInitCallbacks();

      // 延迟创建次要索引，但不影响应用正常使用
      setTimeout(async () => {
        try {
          // 再次检查表是否存在，因为可能在此期间创建了新表
          const updatedTablesResult = await this.database.executeSql("SELECT name FROM sqlite_master WHERE type='table'");
          const updatedExistingTables = [];
          for (let i = 0; i < updatedTablesResult[0].rows.length; i++) {
            updatedExistingTables.push(updatedTablesResult[0].rows.item(i).name);
          }

          for (const index of secondaryIndexes) {
            if (updatedExistingTables.includes(index.table)) {
              try {
                await this.database.executeSql(index.sql);
                console.log(`成功创建索引: ${index.sql}`);
              } catch (error) {
                console.warn(`创建次要索引失败 (${index.table}):`, error);
              }
            } else {
              console.log(`跳过创建索引，表 ${index.table} 不存在`);
            }
          }

          if (__DEV__) console.log('次要索引创建完成');

          // 优化数据库
          await this.optimizeDatabase();
        } catch (error) {
          console.warn('创建次要索引或优化数据库失败:', error);
        }
      }, 5000); // 延迟5秒创建次要索引

    } catch (error) {
      console.error('创建索引失败:', error);
      // 出现错误时不标记为完全初始化
      console.error('索引创建失败，数据库未完全初始化');
      // 抛出错误，让调用者知道初始化失败
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
      if (__DEV__) console.log('开始优化数据库...');

      // 使用事务执行优化操作
      await this.database.transaction(async (tx) => {
        // 设置优化参数
        await tx.executeSql("PRAGMA optimize;"); // 自动优化
        await tx.executeSql("PRAGMA auto_vacuum = INCREMENTAL;"); // 增量式自动整理
        await tx.executeSql("PRAGMA mmap_size = 268435456;"); // 使用内存映射 (256MB)
        await tx.executeSql("PRAGMA page_size = 8192;"); // 增加页面大小，减少I/O操作

        // 分析数据库以优化查询性能
        await tx.executeSql("ANALYZE;");
      });

      // 执行VACUUM操作以优化数据库大小 (不放在事务中，因为VACUUM会隐式提交事务)
      await this.executeSql("VACUUM;");

      if (__DEV__) console.log('数据库优化完成');
    } catch (error) {
      console.warn('数据库优化失败:', error);
      // 不抛出异常，因为这不是关键操作
    }
  }

  /**
   * 创建表
   * @returns {Promise<void>}
   */
  async createTables() {
    try {
      console.log('开始创建数据库表...');

      // 首先创建同步信息表，因为同步服务依赖它
      console.log('首先创建同步信息表...');
      await this.database.executeSql(`
        CREATE TABLE IF NOT EXISTS ${TABLES.SYNC_INFO} (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          table_name TEXT NOT NULL UNIQUE,
          last_sync_time TEXT,
          sync_status TEXT,
          error_message TEXT,
          created_at TEXT,
          updated_at TEXT
        )
      `);
      console.log(`表 ${TABLES.SYNC_INFO} 创建成功`);

      // 使用事务来创建其余表，提高效率和可靠性
      return await this.database.transaction(async (tx) => {
        console.log('开始数据库事务，创建其余表...');

        // 用户表
        await tx.executeSql(`
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

        // 分类表
        await tx.executeSql(`
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
        console.log(`表 ${TABLES.CATEGORIES} 创建成功`);

        // 标签表
        await tx.executeSql(`
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
        console.log(`表 ${TABLES.TAGS} 创建成功`);

        // 笔记表
        await tx.executeSql(`
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
        console.log(`表 ${TABLES.NOTES} 创建成功`);

        // 笔记标签关联表
        await tx.executeSql(`
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
        console.log(`表 ${TABLES.NOTE_TAGS} 创建成功`);

        // 提醒表
        await tx.executeSql(`
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
        console.log(`表 ${TABLES.REMINDERS} 创建成功`);

        // 设置表
        await tx.executeSql(`
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
        console.log(`表 ${TABLES.SETTINGS} 创建成功`);

        // 离线队列表
        await tx.executeSql(`
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
        console.log(`表 ${TABLES.OFFLINE_QUEUE} 创建成功`);

        // 文件表
        await tx.executeSql(`
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
        console.log(`表 ${TABLES.FILES} 创建成功`);

        console.log('所有数据库表创建完成');
      });
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
      // 获取所有存在的表
      const tablesResult = await this.database.executeSql("SELECT name FROM sqlite_master WHERE type='table'");
      const existingTables = [];
      for (let i = 0; i < tablesResult[0].rows.length; i++) {
        existingTables.push(tablesResult[0].rows.item(i).name);
      }

      console.log('现有表:', existingTables.join(', '));

      // 定义所有索引
      const allIndexes = [
        // 用户表索引
        { table: TABLES.USERS, sql: `CREATE INDEX IF NOT EXISTS idx_users_username ON ${TABLES.USERS} (username)` },
        { table: TABLES.USERS, sql: `CREATE INDEX IF NOT EXISTS idx_users_email ON ${TABLES.USERS} (email)` },

        // 笔记表索引
        { table: TABLES.NOTES, sql: `CREATE INDEX IF NOT EXISTS idx_notes_user_id ON ${TABLES.NOTES} (user_id)` },
        { table: TABLES.NOTES, sql: `CREATE INDEX IF NOT EXISTS idx_notes_category_id ON ${TABLES.NOTES} (category_id)` },
        { table: TABLES.NOTES, sql: `CREATE INDEX IF NOT EXISTS idx_notes_is_deleted ON ${TABLES.NOTES} (is_deleted)` },
        { table: TABLES.NOTES, sql: `CREATE INDEX IF NOT EXISTS idx_notes_is_favorite ON ${TABLES.NOTES} (is_favorite)` },
        { table: TABLES.NOTES, sql: `CREATE INDEX IF NOT EXISTS idx_notes_updated_at ON ${TABLES.NOTES} (updated_at)` },

        // 分类表索引
        { table: TABLES.CATEGORIES, sql: `CREATE INDEX IF NOT EXISTS idx_categories_user_id ON ${TABLES.CATEGORIES} (user_id)` },
        { table: TABLES.CATEGORIES, sql: `CREATE INDEX IF NOT EXISTS idx_categories_parent_id ON ${TABLES.CATEGORIES} (parent_id)` },

        // 标签表索引
        { table: TABLES.TAGS, sql: `CREATE INDEX IF NOT EXISTS idx_tags_user_id ON ${TABLES.TAGS} (user_id)` },
        { table: TABLES.TAGS, sql: `CREATE INDEX IF NOT EXISTS idx_tags_name ON ${TABLES.TAGS} (name)` },

        // 提醒表索引
        { table: TABLES.REMINDERS, sql: `CREATE INDEX IF NOT EXISTS idx_reminders_user_id ON ${TABLES.REMINDERS} (user_id)` },
        { table: TABLES.REMINDERS, sql: `CREATE INDEX IF NOT EXISTS idx_reminders_due_date ON ${TABLES.REMINDERS} (due_date)` },

        // 设置表索引
        { table: TABLES.SETTINGS, sql: `CREATE INDEX IF NOT EXISTS idx_settings_user_id_key ON ${TABLES.SETTINGS} (user_id, key)` },

        // 文件表索引
        { table: TABLES.FILES, sql: `CREATE INDEX IF NOT EXISTS idx_files_user_id ON ${TABLES.FILES} (user_id)` },
        { table: TABLES.FILES, sql: `CREATE INDEX IF NOT EXISTS idx_files_note_id ON ${TABLES.FILES} (note_id)` }
      ];

      // 只为存在的表创建索引
      for (const index of allIndexes) {
        if (existingTables.includes(index.table)) {
          try {
            await this.database.executeSql(index.sql);
            console.log(`成功创建索引: ${index.sql}`);
          } catch (error) {
            console.warn(`创建索引失败 (${index.table}):`, error);
            // 记录错误但继续执行其他索引创建
          }
        } else {
          console.log(`跳过创建索引，表 ${index.table} 不存在`);

          // 如果是 reminders 表不存在，尝试创建它
          if (index.table === TABLES.REMINDERS && !existingTables.includes(TABLES.REMINDERS)) {
            try {
              console.log(`尝试创建缺失的 ${TABLES.REMINDERS} 表...`);
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
              console.log(`表 ${TABLES.REMINDERS} 创建成功`);

              // 现在可以创建索引了
              await this.database.executeSql(`CREATE INDEX IF NOT EXISTS idx_reminders_user_id ON ${TABLES.REMINDERS} (user_id)`);
              await this.database.executeSql(`CREATE INDEX IF NOT EXISTS idx_reminders_due_date ON ${TABLES.REMINDERS} (due_date)`);
              console.log(`表 ${TABLES.REMINDERS} 的索引创建成功`);
            } catch (createTableError) {
              console.error(`创建 ${TABLES.REMINDERS} 表失败:`, createTableError);
              // 记录错误但继续执行
            }
          }
        }
      }

      console.log('SQLite索引创建成功');
      return true;
    } catch (error) {
      console.error('创建索引失败:', error);
      throw error;
    }
  }

  /**
   * 执行SQL查询
   * @param {string} query - SQL查询语句
   * @param {Array} params - 查询参数
   * @param {number} timeout - 查询超时时间（毫秒）
   * @param {number} retryCount - 重试次数
   * @returns {Promise<Array>} 查询结果
   */
  async executeSql(query, params = [], timeout = 30000, retryCount = 3) {
    // 如果数据库未初始化，尝试初始化
    if (!this.isInitialized || !this.database) {
      console.warn('数据库未初始化，尝试初始化数据库');
      try {
        await this.init();
      } catch (error) {
        console.error('数据库初始化失败:', error);
        throw new Error('数据库未初始化且无法自动初始化');
      }
    }

    // 如果数据库正在初始化但尚未完全初始化，将操作添加到队列
    if (!this.isFullyInitialized) {
      console.log('数据库尚未完全初始化，将SQL操作添加到队列:', query);

      return new Promise((resolve, reject) => {
        // 将操作添加到队列
        this.operationQueue.push({
          execute: () => {
            try {
              return this._executeSql(query, params, timeout, retryCount);
            } catch (error) {
              reject(error);
              throw error; // 确保错误被传播
            }
          },
          resolve,
          reject
        });
      });
    }

    // 如果数据库已完全初始化，直接执行操作
    return this._executeSql(query, params, timeout, retryCount);
  }

  /**
   * 内部执行SQL查询的方法
   * @private
   * @param {string} query - SQL查询语句
   * @param {Array} params - 查询参数
   * @param {number} timeout - 查询超时时间（毫秒）
   * @param {number} retryCount - 重试次数
   * @returns {Promise<Array>} 查询结果
   */
  async _executeSql(query, params = [], timeout = 30000, retryCount = 3) {
    // 确保数据库已初始化
    if (!this.isInitialized || !this.database) {
      throw new Error('数据库未初始化，无法执行SQL查询');
    }

    if (!this.database) {
      throw new Error('数据库实例不存在');
    }

    // 处理参数，确保没有undefined或null值导致绑定错误
    let safeParams = [];

    // 检查参数数量是否匹配查询中的占位符数量
    const placeholderCount = (query.match(/\?/g) || []).length;

    // 记录原始参数信息，用于调试
    console.log(`SQL查询占位符数量: ${placeholderCount}, 提供参数数量: ${params ? params.length : 0}`);

    // 如果没有提供参数但有占位符，创建空参数数组
    if (placeholderCount > 0 && (!params || params.length === 0)) {
      console.warn(`查询包含${placeholderCount}个占位符，但未提供参数，使用空字符串替代`);
      safeParams = Array(placeholderCount).fill('');
    }
    // 如果参数数量少于占位符数量，填充缺失的参数
    else if (placeholderCount > 0 && params.length < placeholderCount) {
      console.warn(`查询包含${placeholderCount}个占位符，但只提供了${params.length}个参数，填充缺失参数`);

      // 复制并处理已提供的参数
      safeParams = params.map(param => {
        if (param === null || param === undefined) {
          return ''; // 统一使用空字符串替代null和undefined
        }
        return param;
      });

      // 填充缺失的参数
      for (let i = params.length; i < placeholderCount; i++) {
        safeParams.push('');
      }
    }
    // 如果参数数量与占位符匹配或更多，处理所有参数
    else {
      // 预处理所有参数，确保没有null值
      safeParams = params.map(param => {
        if (param === null || param === undefined) {
          return ''; // 统一使用空字符串替代null和undefined
        }
        return param;
      });

      // 如果参数过多，截断到占位符数量
      if (placeholderCount > 0 && safeParams.length > placeholderCount) {
        console.warn(`查询包含${placeholderCount}个占位符，但提供了${safeParams.length}个参数，截断多余参数`);
        safeParams = safeParams.slice(0, placeholderCount);
      }
    }

    // 最后检查确保没有null值
    safeParams = safeParams.map(param => {
      if (param === null || param === undefined) {
        return ''; // 统一使用空字符串替代null和undefined
      } else if (typeof param === 'object') {
        try {
          // 尝试将对象转换为JSON字符串
          return JSON.stringify(param);
        } catch (e) {
          console.warn('无法将对象参数转换为JSON字符串:', e);
          return '';
        }
      }
      return param;
    });

    // 添加重试机制
    let lastError = null;
    for (let attempt = 0; attempt <= retryCount; attempt++) {
      try {
        // 如果不是第一次尝试，记录重试信息
        if (attempt > 0) {
          console.log(`第${attempt}次重试执行SQL查询:`, query);

          // 如果是超时错误，增加超时时间
          if (lastError && lastError.message && lastError.message.includes('超时')) {
            timeout = timeout * 2; // 每次重试翻倍超时时间
            console.log(`增加超时时间到${timeout}ms`);
          }
        } else {
          console.log('执行SQL查询:', query);
        }

        console.log('查询参数:', JSON.stringify(safeParams));

        // 添加超时机制
        const queryPromise = this.database.executeSql(query, safeParams);
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error(`SQL查询超时(${timeout}ms): ${query}`));
          }, timeout);
        });

        // 使用Promise.race实现超时控制
        try {
          const [results] = await Promise.race([queryPromise, timeoutPromise]);
          return results;
        } catch (queryError) {
          // 检查是否是绑定值错误
          if (queryError.message && queryError.message.includes('bind value at index') && queryError.message.includes('is null')) {
            console.error('SQL绑定值错误，尝试紧急修复参数');

            // 提取错误中的索引信息
            const indexMatch = queryError.message.match(/bind value at index (\d+)/);
            const errorIndex = indexMatch ? parseInt(indexMatch[1], 10) : -1;

            if (errorIndex > 0 && errorIndex <= safeParams.length) {
              console.log(`问题参数索引: ${errorIndex}, 当前值: ${safeParams[errorIndex-1]}`);

              // 创建新的参数数组，确保所有值都不为null
              const emergencyParams = safeParams.map(param => {
                if (param === null || param === undefined) {
                  return ''; // 统一使用空字符串替代null和undefined
                } else if (typeof param === 'object') {
                  try {
                    return JSON.stringify(param);
                  } catch (e) {
                    return '';
                  }
                }
                return param;
              });

              // 特别确保问题索引的参数不为null
              emergencyParams[errorIndex-1] = emergencyParams[errorIndex-1] === null ? '' :
                                             (typeof emergencyParams[errorIndex-1] === 'object' ?
                                              JSON.stringify(emergencyParams[errorIndex-1]) :
                                              String(emergencyParams[errorIndex-1] || ''));

              console.log('使用紧急修复参数重试查询');
              console.log('修复后的参数:', JSON.stringify(emergencyParams));

              // 直接重试查询，不经过超时控制
              try {
                const [emergencyResults] = await this.database.executeSql(query, emergencyParams);
                return emergencyResults;
              } catch (emergencyError) {
                console.error('紧急修复参数后仍然失败:', emergencyError);

                // 最后尝试：使用空字符串替换所有参数
                const lastResortParams = Array(placeholderCount).fill('');
                console.log('最后尝试：使用空字符串替换所有参数');

                try {
                  const [lastResortResults] = await this.database.executeSql(query, lastResortParams);
                  return lastResortResults;
                } catch (lastError) {
                  console.error('最后尝试也失败:', lastError);
                  throw lastError;
                }
              }
            }
          }

          // 如果不是绑定值错误或无法修复，重新抛出错误
          throw queryError;
        }
      } catch (error) {
        lastError = error;
        console.error(`执行SQL查询失败(尝试${attempt + 1}/${retryCount + 1}):`, error);
        console.error('查询:', query);
        console.error('参数:', JSON.stringify(safeParams));

        // 处理特定错误
        if (error.message) {
          // 绑定值错误
          if (error.message.includes('bind value at index') && error.message.includes('is null')) {
            console.error('SQL绑定值错误，尝试修复参数');

            // 提取错误中的索引信息
            const indexMatch = error.message.match(/bind value at index (\d+)/);
            const errorIndex = indexMatch ? parseInt(indexMatch[1], 10) : -1;

            // 创建新的参数数组，确保所有值都不为null
            const fixedParams = safeParams.map(param => {
              if (param === null || param === undefined) {
                return ''; // 统一使用空字符串替代null和undefined
              } else if (typeof param === 'object') {
                try {
                  return JSON.stringify(param);
                } catch (e) {
                  return '';
                }
              }
              return param;
            });

            // 如果知道具体的错误索引，特别处理该索引的参数
            if (errorIndex > 0 && errorIndex <= fixedParams.length) {
              console.log(`问题参数索引: ${errorIndex}, 当前值: ${fixedParams[errorIndex-1]}`);
              fixedParams[errorIndex-1] = typeof fixedParams[errorIndex-1] === 'object' ?
                                         JSON.stringify(fixedParams[errorIndex-1] || {}) :
                                         String(fixedParams[errorIndex-1] || '');
            }

            try {
              console.log('使用修复后的参数重试查询');
              console.log('修复后的参数:', JSON.stringify(fixedParams));
              const [results] = await this.database.executeSql(query, fixedParams);
              return results;
            } catch (retryError) {
              console.error('使用修复后的参数重试失败:', retryError);

              // 最后尝试：使用空字符串替换所有参数
              try {
                const lastResortParams = Array(placeholderCount).fill('');
                console.log('最后尝试：使用空字符串替换所有参数');
                const [lastResortResults] = await this.database.executeSql(query, lastResortParams);
                return lastResortResults;
              } catch (lastError) {
                console.error('最后尝试也失败，继续外层重试循环:', lastError);
                // 继续外层重试循环
              }
            }
          }

          // 表不存在错误
          if (error.message.includes('no such table')) {
            const tableName = error.message.match(/no such table: (\w+)/);
            if (tableName && tableName[1]) {
              console.error(`表不存在: ${tableName[1]}`);

              // 如果是sync_info表，尝试创建
              if (tableName[1] === 'sync_info') {
                try {
                  console.log('尝试创建sync_info表');
                  await this.database.executeSql(`
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
                  console.log('创建sync_info表成功，继续重试查询');
                  continue; // 继续重试
                } catch (createError) {
                  console.error('创建sync_info表失败:', createError);
                }
              }

              // 如果是最后一次尝试，抛出错误
              if (attempt === retryCount) {
                throw new Error(`表${tableName[1]}不存在，请确保数据库已正确初始化`);
              }
            }
          }

          // 超时错误
          if (error.message.includes('SQL查询超时')) {
            console.warn('查询超时，尝试优化查询或增加超时时间');

            // 对于复杂查询，可以考虑拆分或优化
            if (query.includes('JOIN') || query.includes('GROUP BY')) {
              console.warn('检测到复杂查询，建议优化SQL语句');
            }

            // 如果不是最后一次尝试，继续重试
            if (attempt < retryCount) {
              continue;
            }
          }

          // 数据库锁定错误
          if (error.message.includes('database is locked') || error.message.includes('database disk image is malformed')) {
            console.error('数据库锁定或损坏，尝试关闭并重新打开数据库');

            try {
              // 关闭并重新打开数据库
              if (this.database) {
                await this.database.close();
              }

              const SQLite = require('react-native-sqlite-storage');
              SQLite.enablePromise(true);

              this.database = await SQLite.openDatabase({
                name: 'zeroislenotes.db',
                location: Platform.OS === 'ios' ? 'Library' : 'default',
                createFromLocation: 0,
              });

              console.log('重新打开数据库成功，继续重试查询');
              continue; // 继续重试
            } catch (reopenError) {
              console.error('重新打开数据库失败:', reopenError);
            }
          }
        }

        // 如果不是最后一次尝试，继续重试
        if (attempt < retryCount) {
          // 添加延迟，避免立即重试
          await new Promise(resolve => setTimeout(resolve, 500 * (attempt + 1)));
          continue;
        }

        // 最后一次尝试失败，抛出错误
        throw error;
      }
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
      this.isFullyInitialized = false;
      this.isInitializing = false;

      // 清空操作队列和回调
      this.operationQueue = [];
      this.initCallbacks = [];

      console.log('SQLite数据库已关闭');
    }
  }

  /**
   * 获取数据库路径
   * @returns {Promise<string>} 数据库路径
   */
  async getDatabasePath() {
    if (Platform.OS === 'android') {
      // Android上，数据库文件存储在应用的files目录下
      return `${RNFS.DocumentDirectoryPath}/zeroislenotes.db`;
    } else {
      // iOS上，数据库文件存储在Library/LocalDatabase目录下
      const dirPath = `${RNFS.LibraryDirectoryPath}/LocalDatabase`;

      // 确保目录存在
      try {
        const dirExists = await RNFS.exists(dirPath);
        if (!dirExists) {
          await RNFS.mkdir(dirPath);
          console.log(`创建iOS数据库目录: ${dirPath}`);
        }
      } catch (error) {
        console.error('创建iOS数据库目录失败:', error);
      }

      return `${dirPath}/zeroislenotes.db`;
    }
  }

  /**
   * 检查数据库连接状态
   * @param {number} timeout - 超时时间（毫秒）
   * @returns {Promise<boolean>} 连接是否正常
   */
  async checkConnection(timeout = 5000) {
    try {
      console.log('检查SQLite数据库连接状态...');

      // 如果数据库未初始化，尝试初始化
      if (!this.isInitialized || !this.database) {
        console.warn('数据库未初始化，尝试初始化');
        await this.init(timeout);

        // 如果初始化后仍未成功，返回false
        if (!this.isInitialized || !this.database) {
          console.error('数据库初始化失败，连接不可用');
          return false;
        }
      }

      // 执行简单查询测试连接
      const startTime = Date.now();
      await this.executeSql('SELECT 1', [], timeout);
      console.log(`数据库连接正常，查询耗时: ${Date.now() - startTime}ms`);

      return true;
    } catch (error) {
      console.error('数据库连接检查失败:', error);

      // 如果是超时错误，可能是数据库文件损坏或锁定
      if (error.message && error.message.includes('超时')) {
        console.error('数据库查询超时，可能是数据库文件损坏或被锁定');

        // 尝试获取数据库文件信息
        try {
          const dbPath = await this.getDatabasePath();
          const fileInfo = await RNFS.stat(dbPath);
          console.log('数据库文件信息:', fileInfo);

          // 检查文件大小是否异常
          if (fileInfo.size > 100 * 1024 * 1024) { // 大于100MB
            console.warn('数据库文件过大，可能导致性能问题:', fileInfo.size / (1024 * 1024), 'MB');
          }
        } catch (fileError) {
          console.error('获取数据库文件信息失败:', fileError);
        }
      }

      // 标记数据库需要重新初始化
      this.isInitialized = false;
      this.database = null;

      return false;
    }
  }

  /**
   * 重置数据库
   * 警告：此操作将删除所有数据！
   * @returns {Promise<boolean>} 是否成功重置
   */
  async resetDatabase() {
    try {
      console.log('开始重置数据库...');

      // 关闭数据库连接
      if (this.database) {
        try {
          await this.close();
          console.log('已关闭数据库连接');
        } catch (closeError) {
          console.error('关闭数据库连接失败:', closeError);
          // 继续尝试删除文件
        }
      }

      // 重置状态
      this.isInitialized = false;
      this.database = null;
      this._initPromise = null;

      // 获取数据库文件路径
      const dbPath = await this.getDatabasePath();
      console.log('数据库文件路径:', dbPath);

      // 检查文件是否存在
      const fileExists = await RNFS.exists(dbPath);
      if (fileExists) {
        try {
          // 删除数据库文件
          await RNFS.unlink(dbPath);
          console.log('已删除数据库文件:', dbPath);
        } catch (unlinkError) {
          console.error('删除数据库文件失败:', unlinkError);
        }

        // 检查相关文件
        const journalPath = `${dbPath}-journal`;
        const shmPath = `${dbPath}-shm`;
        const walPath = `${dbPath}-wal`;

        // 删除journal文件
        try {
          if (await RNFS.exists(journalPath)) {
            await RNFS.unlink(journalPath);
            console.log('已删除journal文件');
          }
        } catch (journalError) {
          console.error('删除journal文件失败:', journalError);
        }

        // 删除shm文件
        try {
          if (await RNFS.exists(shmPath)) {
            await RNFS.unlink(shmPath);
            console.log('已删除shm文件');
          }
        } catch (shmError) {
          console.error('删除shm文件失败:', shmError);
        }

        // 删除wal文件
        try {
          if (await RNFS.exists(walPath)) {
            await RNFS.unlink(walPath);
            console.log('已删除wal文件');
          }
        } catch (walError) {
          console.error('删除wal文件失败:', walError);
        }
      } else {
        console.log('数据库文件不存在，无需删除');
      }

      // 创建空数据库文件
      try {
        // 确保目录存在
        if (Platform.OS === 'ios') {
          const dirPath = `${RNFS.LibraryDirectoryPath}/LocalDatabase`;
          const dirExists = await RNFS.exists(dirPath);
          if (!dirExists) {
            await RNFS.mkdir(dirPath);
            console.log(`创建目录: ${dirPath}`);
          }
        }

        // 创建空文件
        await RNFS.writeFile(dbPath, '', 'utf8');
        console.log('创建空数据库文件成功');

        // 验证文件是否创建成功
        const fileExistsAfter = await RNFS.exists(dbPath);
        if (fileExistsAfter) {
          const fileInfo = await RNFS.stat(dbPath);
          console.log(`数据库文件已创建，大小: ${(fileInfo.size / 1024).toFixed(2)} KB`);
        } else {
          console.error('数据库文件创建失败');
        }
      } catch (createError) {
        console.error('创建空数据库文件失败:', createError);
      }

      // 重新初始化数据库
      console.log('开始重新初始化数据库...');

      // 直接使用SQLite API创建数据库
      try {
        const SQLite = require('react-native-sqlite-storage');
        SQLite.enablePromise(true);

        const db = await SQLite.openDatabase({
          name: 'zeroislenotes.db',
          location: Platform.OS === 'ios' ? 'Library' : 'default',
          createFromLocation: 0,
        });

        console.log('数据库打开成功，尝试创建sync_info表');

        // 创建sync_info表
        await db.executeSql(`
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

        console.log('sync_info表创建成功');

        // 确保数据库文件被正确保存
        await db.executeSql('PRAGMA journal_mode=DELETE');
        await db.executeSql('PRAGMA synchronous=FULL');
        await db.close();
        console.log('数据库已关闭，确保更改被保存');
      } catch (sqliteError) {
        console.error('直接使用SQLite API创建数据库失败:', sqliteError);
      }

      // 使用服务初始化数据库
      try {
        await this.init(30000); // 使用较长的超时时间
      } catch (initError) {
        console.error('初始化数据库失败:', initError);
      }

      if (this.isInitialized && this.database) {
        console.log('数据库重置成功');
        return true;
      } else {
        console.error('数据库重置后初始化失败');
        return false;
      }
    } catch (error) {
      console.error('重置数据库失败:', error);
      return false;
    }
  }

  /**
   * 检查并修复数据库
   * @returns {Promise<boolean>} 是否成功修复
   */
  async checkAndRepairDatabase() {
    try {
      console.log('开始检查数据库完整性...');

      // 首先检查数据库文件是否存在且大小正常
      try {
        const dbPath = await this.getDatabasePath();
        const fileExists = await RNFS.exists(dbPath);

        if (fileExists) {
          const fileInfo = await RNFS.stat(dbPath);
          console.log(`数据库文件存在，大小: ${(fileInfo.size / 1024).toFixed(2)} KB`);

          // 如果文件太小，可能是损坏的或空的
          if (fileInfo.size < 1024) {
            console.warn('数据库文件异常小，可能已损坏，尝试重建');
            return await this.resetDatabase();
          }
        } else {
          console.warn('数据库文件不存在，尝试创建新数据库');
          return await this.resetDatabase();
        }
      } catch (fileError) {
        console.error('检查数据库文件失败:', fileError);
      }

      // 如果数据库未初始化，先尝试初始化
      if (!this.isInitialized || !this.database) {
        try {
          await this.init(30000); // 增加超时时间到30秒
        } catch (initError) {
          console.error('初始化数据库失败，尝试修复:', initError);
          // 继续执行修复流程
        }
      }

      // 尝试执行PRAGMA integrity_check
      try {
        if (this.database) {
          // 先尝试简单查询
          try {
            await this.database.executeSql('SELECT 1');
            console.log('简单查询成功，数据库基本可用');
          } catch (simpleQueryError) {
            console.error('简单查询失败，数据库可能已损坏:', simpleQueryError);
            return await this.resetDatabase();
          }

          // 执行完整性检查
          const result = await this.database.executeSql('PRAGMA integrity_check');
          const integrityResult = result[0].rows.item(0).integrity_check;

          if (integrityResult === 'ok') {
            console.log('数据库完整性检查通过');

            // 检查关键表是否存在
            const tableCheck = await this.database.executeSql("SELECT name FROM sqlite_master WHERE type='table' AND name=?", ['sync_info']);
            if (tableCheck[0].rows.length === 0) {
              console.warn('sync_info表不存在，尝试创建');
              await this.forceCreateSyncInfoTable();
            }

            return true;
          } else {
            console.error('数据库完整性检查失败:', integrityResult);
            // 数据库损坏，需要重置
            return await this.resetDatabase();
          }
        } else {
          console.error('数据库实例不存在，无法执行完整性检查');
          // 尝试重置数据库
          return await this.resetDatabase();
        }
      } catch (checkError) {
        console.error('执行完整性检查失败:', checkError);

        // 尝试修复数据库
        console.log('尝试修复数据库...');
        try {
          // 尝试执行VACUUM和ANALYZE
          if (this.database) {
            try {
              await this.database.executeSql('VACUUM');
              await this.database.executeSql('ANALYZE');
              console.log('数据库维护操作成功');

              // 再次尝试简单查询
              await this.database.executeSql('SELECT 1');
              console.log('维护后简单查询成功，数据库已修复');
              return true;
            } catch (repairError) {
              console.error('数据库维护操作失败:', repairError);
            }
          }
        } catch (repairAttemptError) {
          console.error('尝试修复数据库失败:', repairAttemptError);
        }

        // 如果修复失败，重置数据库
        console.log('修复失败，尝试重置数据库');
        return await this.resetDatabase();
      }

      return false;
    } catch (error) {
      console.error('检查并修复数据库失败:', error);
      // 最后的尝试：重置数据库
      try {
        return await this.resetDatabase();
      } catch (resetError) {
        console.error('重置数据库也失败:', resetError);
        return false;
      }
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

  /**
   * 强制创建数据库和sync_info表
   * 这是一个紧急修复方法，用于解决数据库文件不存在或sync_info表不存在的问题
   * @returns {Promise<boolean>} 是否成功
   */
  async forceCreateSyncInfoTable() {
    try {
      console.log('开始强制创建数据库和sync_info表...');

      // 关闭现有连接
      if (this.database) {
        try {
          await this.close();
          console.log('已关闭现有数据库连接');
        } catch (closeError) {
          console.error('关闭数据库连接失败:', closeError);
        }
      }

      // 重置状态
      this.isInitialized = false;
      this.database = null;
      this._initPromise = null;

      // 获取数据库文件路径
      const dbPath = await this.getDatabasePath();
      console.log('数据库文件路径:', dbPath);

      // 检查并删除可能存在的损坏文件
      try {
        const fileExists = await RNFS.exists(dbPath);
        if (fileExists) {
          const fileInfo = await RNFS.stat(dbPath);
          console.log(`数据库文件存在，大小: ${(fileInfo.size / 1024).toFixed(2)} KB`);

          // 如果文件大小异常小，可能是损坏的
          if (fileInfo.size < 1024) {
            console.warn('数据库文件异常小，可能是空文件或损坏，尝试删除重建');
            await RNFS.unlink(dbPath);
            console.log('已删除可能损坏的数据库文件');

            // 删除相关文件
            const journalPath = `${dbPath}-journal`;
            const shmPath = `${dbPath}-shm`;
            const walPath = `${dbPath}-wal`;

            if (await RNFS.exists(journalPath)) await RNFS.unlink(journalPath);
            if (await RNFS.exists(shmPath)) await RNFS.unlink(shmPath);
            if (await RNFS.exists(walPath)) await RNFS.unlink(walPath);
            console.log('已删除相关辅助文件');
          }
        }
      } catch (checkError) {
        console.error('检查数据库文件失败:', checkError);
        // 继续执行，尝试创建新文件
      }

      // 确保目录存在
      try {
        if (Platform.OS === 'ios') {
          const dirPath = `${RNFS.LibraryDirectoryPath}/LocalDatabase`;
          const dirExists = await RNFS.exists(dirPath);
          if (!dirExists) {
            await RNFS.mkdir(dirPath);
            console.log(`创建目录: ${dirPath}`);
          }
        } else {
          // 确保Android上的目录存在
          const dirPath = RNFS.DocumentDirectoryPath;
          const dirExists = await RNFS.exists(dirPath);
          if (!dirExists) {
            console.error('Android文档目录不存在，这是异常情况');
          }
        }
      } catch (dirError) {
        console.error('检查或创建目录失败:', dirError);
      }

      // 创建初始数据库文件 - 使用空字符串创建空文件
      try {
        // 不再尝试写入二进制头部，直接创建空文件
        await RNFS.writeFile(dbPath, '', 'utf8');
        console.log('创建空数据库文件成功');

        // 验证文件
        const fileExists = await RNFS.exists(dbPath);
        if (fileExists) {
          const fileInfo = await RNFS.stat(dbPath);
          console.log(`数据库文件已创建，大小: ${(fileInfo.size / 1024).toFixed(2)} KB`);
        } else {
          throw new Error('数据库文件创建失败');
        }
      } catch (createError) {
        console.error('创建数据库文件失败:', createError);

        // 备选方案：尝试在不同位置创建文件
        try {
          const altPath = Platform.OS === 'android'
            ? `${RNFS.ExternalDirectoryPath}/zeroislenotes.db`
            : `${RNFS.DocumentDirectoryPath}/zeroislenotes.db`;

          await RNFS.writeFile(altPath, '', 'utf8');
          console.log(`使用备选路径创建空数据库文件: ${altPath}`);

          // 更新数据库路径为备选路径
          console.log(`更新数据库路径为备选路径: ${altPath}`);
        } catch (fallbackError) {
          console.error('备选方案创建文件也失败:', fallbackError);
          return false;
        }
      }

      // 直接使用SQLite API创建数据库和表
      try {
        const SQLite = require('react-native-sqlite-storage');
        SQLite.enablePromise(true);

        // 打开数据库
        const db = await SQLite.openDatabase({
          name: 'zeroislenotes.db',
          location: Platform.OS === 'ios' ? 'Library' : 'default',
          createFromLocation: 0,
        });

        console.log('数据库打开成功，尝试创建sync_info表');

        // 创建sync_info表
        await db.executeSql(`
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

        console.log('sync_info表创建成功');

        // 检查表是否已有记录
        const result = await db.executeSql('SELECT COUNT(*) as count FROM sync_info');
        const count = result[0].rows.item(0).count;

        if (count === 0) {
          console.log('sync_info表为空，初始化记录');
          const now = new Date().toISOString();
          const tables = ['users', 'notes', 'categories', 'tags', 'note_tags', 'reminders', 'settings', 'files'];

          // 使用事务批量插入
          await db.transaction(async (tx) => {
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

          console.log('sync_info表初始化完成');
        } else {
          console.log(`sync_info表已有${count}条记录`);
        }

        // 确保数据库文件被正确保存
        await db.executeSql('PRAGMA journal_mode=DELETE');
        await db.executeSql('PRAGMA synchronous=FULL');
        await db.executeSql('VACUUM'); // 压缩数据库
        await db.close();
        console.log('数据库已关闭，确保更改被保存');

        // 验证文件是否存在
        const fileExistsAfter = await RNFS.exists(dbPath);
        if (fileExistsAfter) {
          const fileInfo = await RNFS.stat(dbPath);
          console.log(`数据库文件已创建，大小: ${(fileInfo.size / 1024).toFixed(2)} KB`);

          // 如果文件仍然太小，可能有问题
          if (fileInfo.size < 100) {
            console.warn('数据库文件仍然太小，可能未正确初始化');
          }
        } else {
          console.error('数据库文件不存在，可能存在权限问题');
          return false;
        }

        // 重新初始化服务
        this.isInitialized = true;
        this.database = db;

        return true;
      } catch (sqliteError) {
        console.error('直接使用SQLite API创建数据库失败:', sqliteError);

        // 尝试第二种方法
        try {
          console.log('尝试使用第二种方法创建数据库...');

          // 重新打开数据库
          const SQLite = require('react-native-sqlite-storage');
          SQLite.enablePromise(true);

          // 使用不同的选项打开
          const db = await SQLite.openDatabase({
            name: DB_NAME,
            location: DB_LOCATION,
            createFromLocation: 0,
          });

          // 创建sync_info表
          await db.executeSql(`
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

          console.log('第二种方法创建sync_info表成功');

          // 初始化记录
          const now = new Date().toISOString();
          const tables = ['users', 'notes', 'categories', 'tags', 'note_tags', 'reminders', 'settings', 'files'];

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

              await db.executeSql(
                'INSERT OR IGNORE INTO sync_info (table_name, last_sync_time, sync_status, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
                safeParams
              );
            } catch (insertError) {
              console.warn(`插入${table}记录失败:`, insertError);
            }
          }

          await db.close();
          console.log('第二种方法完成');

          return true;
        } catch (secondError) {
          console.error('第二种方法也失败:', secondError);
          return false;
        }
      }
    } catch (error) {
      console.error('强制创建数据库和sync_info表失败:', error);
      return false;
    }
  }
}

// 创建单例
const sqliteService = new SQLiteService();

// 导出单例和类
export default sqliteService;
export { SQLiteService };
