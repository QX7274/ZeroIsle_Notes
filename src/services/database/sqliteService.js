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
    this.DB_VERSION = 1; // 当前数据库版本
  }

  /**
   * 初始化数据库
   * @param {number} timeout - 初始化超时时间（毫秒）
   * @returns {Promise<SQLite.SQLiteDatabase>} 数据库实例
   */
  async init(timeout = 60000) { // 增加默认超时时间到60秒
    // 防止重复初始化
    if (this.isInitialized && this.database) {
      console.log('SQLite数据库已经初始化，跳过重复初始化');
      return this.database;
    }

    // 防止并发初始化
    if (this._initPromise) {
      console.log('SQLite数据库正在初始化中，等待完成...');
      return this._initPromise;
    }

    console.log(`开始SQLite数据库初始化，超时时间: ${timeout}ms`);

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

    // 创建初始化Promise
    this._initPromise = (async () => {
      try {
        const startTime = Date.now();

        // 简化初始化过程，只做最基本的操作

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

        // 2. 打开数据库 - 简单直接
        console.log('尝试打开数据库...');
        this.database = await SQLite.openDatabase({
          name: DB_NAME,
          location: DB_LOCATION,
          createFromLocation: 0,
        });
        console.log(`SQLite数据库打开成功，耗时: ${Date.now() - startTime}ms`);

        // 3. 执行简单查询验证连接
        try {
          await this.database.executeSql('SELECT 1');
          console.log('数据库连接验证成功');
        } catch (testError) {
          console.error('数据库连接测试失败，尝试创建基本表结构:', testError);
        }

        // 4. 确保sync_info表存在 - 这是最关键的表
        try {
          console.log('确保sync_info表存在...');
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
          console.log('sync_info表创建或验证成功');

          // 检查表是否有记录
          const result = await this.database.executeSql(`SELECT COUNT(*) as count FROM ${TABLES.SYNC_INFO}`);
          const count = result[0].rows.item(0).count;

          if (count === 0) {
            console.log('sync_info表为空，初始化基本记录');
            const now = new Date().toISOString();
            const tables = ['users', 'notes', 'categories', 'tags'];

            // 单条插入，避免事务复杂性
            for (const table of tables) {
              try {
                const safeParams = [
                  table || '',
                  '',
                  'pending',
                  now || new Date().toISOString(),
                  now || new Date().toISOString()
                ];

                await this.database.executeSql(
                  `INSERT OR IGNORE INTO ${TABLES.SYNC_INFO} (table_name, last_sync_time, sync_status, created_at, updated_at)
                   VALUES (?, ?, ?, ?, ?)`,
                  safeParams
                );
              } catch (insertError) {
                console.warn(`插入${table}记录失败:`, insertError);
                // 继续处理其他表
              }
            }
          } else {
            console.log(`sync_info表已有${count}条记录`);
          }
        } catch (syncTableError) {
          console.error('创建sync_info表失败:', syncTableError);
          // 这是关键错误，但我们仍然标记为初始化成功，让应用能继续运行
        }

        // 标记为初始化成功
        this.isInitialized = true;
        console.log(`SQLite数据库基本初始化成功，总耗时: ${Date.now() - startTime}ms`);

        // 在后台继续完成其他表的创建
        setTimeout(() => {
          this.completeInitializationInBackground().catch(error => {
            console.warn('后台完成初始化失败:', error);
          });
        }, 1000);

        return this.database;
      } catch (error) {
        console.error('SQLite数据库初始化失败:', error);
        this.isInitialized = false;
        this.database = null;
        throw error;
      } finally {
        // 清除初始化Promise
        this._initPromise = null;
      }
    })();

    // 添加超时控制，但更宽松
    const timeoutPromise = new Promise((resolve) => {
      setTimeout(() => {
        console.warn(`SQLite数据库初始化超过${timeout}ms，但将继续在后台完成`);
        // 不再拒绝Promise，而是返回当前数据库状态
        if (this.database && this.isInitialized) {
          resolve(this.database);
        } else {
          // 标记为降级模式，但仍然返回可能的部分初始化数据库
          this._initTimedOut = true;
          this.isInitialized = true; // 标记为已初始化，即使是降级模式
          resolve(this.database || null);
        }
      }, timeout);
    });

    try {
      // 使用Promise.race，但两个Promise都不会reject
      const result = await Promise.race([this._initPromise, timeoutPromise]);
      return result;
    } catch (error) {
      console.error('SQLite初始化出错，应用将以降级模式运行:', error);
      this._initTimedOut = true;
      this.isInitialized = true; // 标记为已初始化，即使是降级模式

      // 返回null而不是抛出异常，让应用可以继续运行
      return this.database || null;
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
      console.log('开始在后台完成数据库初始化...');

      if (!this.database) {
        console.error('数据库实例不存在，无法完成后台初始化');
        return;
      }

      // 1. 创建用户表 - 确保用户表首先被创建
      try {
        console.log('在后台创建用户表...');

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
      } catch (userTableError) {
        console.error('创建用户表失败:', userTableError);
        // 继续执行其他初始化步骤
      }

      // 2. 创建离线队列表
      try {
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
        console.log('离线队列表创建成功');
      } catch (queueTableError) {
        console.error('创建离线队列表失败:', queueTableError);
      }

      // 3. 创建其他基本表
      try {
        console.log('在后台创建其他必要的表...');

        const basicTables = [
          {
            name: TABLES.NOTES,
            sql: `
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
                last_sync_at TEXT
              )
            `
          },
          {
            name: TABLES.TAGS,
            sql: `
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
                last_sync_at TEXT
              )
            `
          },
          {
            name: TABLES.CATEGORIES,
            sql: `
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
                last_sync_at TEXT
              )
            `
          },
          {
            name: TABLES.SETTINGS,
            sql: `
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
            `
          },
          {
            name: TABLES.FILES,
            sql: `
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
            `
          },
          {
            name: TABLES.NOTE_TAGS,
            sql: `
              CREATE TABLE IF NOT EXISTS ${TABLES.NOTE_TAGS} (
                note_id TEXT,
                tag_id TEXT,
                created_at TEXT,
                version INTEGER DEFAULT 1,
                is_synced INTEGER DEFAULT 0,
                last_sync_at TEXT,
                PRIMARY KEY (note_id, tag_id)
              )
            `
          },
          // 知识图谱节点表
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
          // 知识图谱边表
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
          // 知识图谱表
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
          },
          // AI助手对话表
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
          // AI助手消息表
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
          },
          // 社区帖子表
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
          // 社区评论表
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
          },
          // 搜索历史表
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
          // 搜索索引表
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
        ];

        for (const table of basicTables) {
          try {
            await this.database.executeSql(table.sql);
            console.log(`表 ${table.name} 创建成功`);
          } catch (tableError) {
            console.warn(`创建表 ${table.name} 失败:`, tableError);
            // 继续创建其他表
          }
        }
      } catch (tablesError) {
        console.error('在后台创建表失败:', tablesError);
        // 继续执行其他初始化步骤
      }

      // 4. 创建基本索引
      try {
        console.log('在后台创建基本索引...');

        const basicIndexes = [
          `CREATE INDEX IF NOT EXISTS idx_users_username ON ${TABLES.USERS} (username)`,
          `CREATE INDEX IF NOT EXISTS idx_users_email ON ${TABLES.USERS} (email)`,
          `CREATE INDEX IF NOT EXISTS idx_users_phone ON ${TABLES.USERS} (phone)`,
          `CREATE INDEX IF NOT EXISTS idx_notes_user_id ON ${TABLES.NOTES} (user_id)`,
          `CREATE INDEX IF NOT EXISTS idx_notes_is_deleted ON ${TABLES.NOTES} (is_deleted)`,
          `CREATE INDEX IF NOT EXISTS idx_tags_user_id ON ${TABLES.TAGS} (user_id)`,
          `CREATE INDEX IF NOT EXISTS idx_categories_user_id ON ${TABLES.CATEGORIES} (user_id)`,
          `CREATE INDEX IF NOT EXISTS idx_settings_user_id ON ${TABLES.SETTINGS} (user_id)`,
          `CREATE INDEX IF NOT EXISTS idx_settings_key ON ${TABLES.SETTINGS} (key)`,
          `CREATE INDEX IF NOT EXISTS idx_files_user_id ON ${TABLES.FILES} (user_id)`,
          `CREATE INDEX IF NOT EXISTS idx_files_note_id ON ${TABLES.FILES} (note_id)`
        ];

        for (const indexSql of basicIndexes) {
          try {
            await this.database.executeSql(indexSql);
          } catch (indexError) {
            console.warn('创建索引失败:', indexError);
            // 继续创建其他索引
          }
        }
      } catch (indexesError) {
        console.error('在后台创建索引失败:', indexesError);
      }

      // 5. 检查数据库表是否都创建成功
      try {
        const tables = await this.database.executeSql("SELECT name FROM sqlite_master WHERE type='table'");
        const tableNames = [];
        for (let i = 0; i < tables[0].rows.length; i++) {
          tableNames.push(tables[0].rows.item(i).name);
        }
        console.log('数据库中的表:', tableNames.join(', '));
      } catch (checkError) {
        console.error('检查数据库表失败:', checkError);
      }

      console.log('后台数据库初始化完成');
    } catch (error) {
      console.error('后台完成数据库初始化失败:', error);
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
   * @param {number} timeout - 查询超时时间（毫秒）
   * @param {number} retryCount - 重试次数
   * @returns {Promise<Array>} 查询结果
   */
  async executeSql(query, params = [], timeout = 30000, retryCount = 3) {
    // 如果数据库未初始化，尝试初始化
    if (!this.isInitialized || !this.database) {
      console.warn('数据库未初始化，尝试初始化数据库');
      try {
        await this.init(timeout);

        // 如果初始化后仍未成功，尝试创建一个新的数据库连接
        if (!this.isInitialized || !this.database) {
          console.warn('初始化失败，尝试直接创建数据库连接');

          try {
            const SQLite = require('react-native-sqlite-storage');
            SQLite.enablePromise(true);

            this.database = await SQLite.openDatabase({
              name: 'zeroislenotes.db',
              location: Platform.OS === 'ios' ? 'Library' : 'default',
              createFromLocation: 0,
            });

            this.isInitialized = true;
            console.log('直接创建数据库连接成功');
          } catch (directOpenError) {
            console.error('直接创建数据库连接失败:', directOpenError);
            throw new Error('数据库未初始化且无法自动初始化');
          }
        }
      } catch (error) {
        console.error('自动初始化数据库失败:', error);

        // 如果是sync_info表查询，尝试创建表
        if (query.includes('sync_info') && query.includes('SELECT')) {
          console.warn('查询sync_info表失败，尝试创建表');

          try {
            // 直接使用SQLite API创建表
            const SQLite = require('react-native-sqlite-storage');
            SQLite.enablePromise(true);

            const db = await SQLite.openDatabase({
              name: 'zeroislenotes.db',
              location: Platform.OS === 'ios' ? 'Library' : 'default',
              createFromLocation: 0,
            });

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

            console.log('直接创建sync_info表成功');

            // 使用创建的连接
            this.database = db;
            this.isInitialized = true;
          } catch (createTableError) {
            console.error('直接创建sync_info表失败:', createTableError);
            throw new Error('数据库未初始化且无法创建必要的表');
          }
        } else {
          throw new Error('数据库未初始化且无法自动初始化');
        }
      }
    }

    if (!this.database) {
      throw new Error('数据库实例不存在');
    }

    // 处理参数，确保没有undefined或null值导致绑定错误
    const safeParams = [];

    // 检查参数数量是否匹配查询中的占位符数量
    const placeholderCount = (query.match(/\?/g) || []).length;

    // 预处理所有参数，确保没有null值
    const processedParams = params.map(param => {
      if (param === null || param === undefined) {
        // 对于数字类型字段，使用0代替null
        if (query.includes('INTEGER') || query.includes('REAL') || query.includes('NUMERIC')) {
          return 0;
        }
        // 对于其他类型，使用空字符串代替null
        return '';
      }
      return param;
    });

    if (placeholderCount > 0 && (!params || params.length === 0)) {
      console.warn(`查询包含${placeholderCount}个占位符，但未提供参数`);
      // 填充空参数
      for (let i = 0; i < placeholderCount; i++) {
        safeParams.push('');
      }
    } else if (placeholderCount > 0 && processedParams.length < placeholderCount) {
      console.warn(`查询包含${placeholderCount}个占位符，但只提供了${processedParams.length}个参数`);
      // 复制提供的参数
      for (let i = 0; i < processedParams.length; i++) {
        safeParams.push(processedParams[i]);
      }
      // 填充剩余的空参数
      for (let i = processedParams.length; i < placeholderCount; i++) {
        safeParams.push('');
      }
    } else {
      // 使用处理后的参数
      safeParams.push(...processedParams);
    }

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
        const [results] = await Promise.race([queryPromise, timeoutPromise]);
        return results;
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

            // 创建新的参数数组，确保没有null值
            const fixedParams = safeParams.map(param => param === null ? '' : param);

            try {
              console.log('使用修复后的参数重试查询');
              console.log('修复后的参数:', JSON.stringify(fixedParams));
              const [results] = await this.database.executeSql(query, fixedParams);
              return results;
            } catch (retryError) {
              console.error('使用修复后的参数重试失败:', retryError);
              // 继续外层重试循环
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
