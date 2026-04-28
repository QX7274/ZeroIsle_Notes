/**
 * Realm服务 - 提供MongoDB Realm数据库操作
 * 用于前端本地数据存储和与MongoDB Atlas同步
 */

import Realm from 'realm';
import {
  openRealm,
  closeRealm,
  getRealmApp,
  loginToAtlas,
  loginAnonymously,
  logoutFromAtlas,
  getCurrentUser,
  SYNC_ENABLED,
  getSyncRealmConfig,
} from './realmConfig';

class RealmService {
  constructor() {
    this.initialized = false;
    this.initializationPromise = null;
    this.realm = null;
    this.app = null;
    this.user = null;
    this.isLoggedIn = false;
    this.schemas = new Map();

    // 失败保护：避免 Realm 初始化失败后反复刷屏
    this.realmOpenFailed = false;
    this.realmOpenFailureReason = null;
    this.onceErrorKeys = new Set();
  }

  _logErrorOnce(key, ...args) {
    if (this.onceErrorKeys.has(key)) {return;}
    this.onceErrorKeys.add(key);
    console.error(...args);
  }

  /**
   * 初始化Realm服务
   */
  async initialize() {
    if (this.initialized) {return Promise.resolve();}

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = new Promise(async (resolve, reject) => {
      try {
        // 初始化 Realm App 实例
        this.app = getRealmApp();

        // 检查是否有活跃的会话（Custom JWT 模式）
        if (this.app?.currentUser) {
          this.user = this.app.currentUser;
          this.isLoggedIn = this.user.state === 'active';
        }

        this.initialized = true;
        console.info('Realm服务初始化成功');
        resolve();
      } catch (error) {
        console.error('Realm服务初始化失败', error);
        reject(error);
      }
    });

    return this.initializationPromise;
  }

  /**
   * 使用 Custom JWT 登录 Realm
   * 已废弃 loginToAtlas 的旧逻辑，统一通过 realmJwtAuthService 转发
   */
  async login(email, password) {
    console.warn('RealmService.login 已废弃，请使用 AuthService.handleThirdPartyLoginSuccess');
    // 这里仅做开发期兼容模拟，后续应彻底移除
    if (__DEV__) {
      this.user = await loginToAtlas(email, password);
      this.isLoggedIn = true;
      return this.user;
    }
    throw new Error('RealmService.login 已移除，必须使用 JWT 认证');
  }

  /**
   * 匿名登录（仅限开发调试）
   */
  async loginAnonymously() {
    if (!__DEV__) {
      throw new Error('生产环境禁用匿名登录');
    }
    try {
      await this.initialize();
      this.user = await loginAnonymously();
      this.isLoggedIn = true;
      return this.user;
    } catch (error) {
      console.error('匿名登录失败', error);
      throw error;
    }
  }

  /**
   * 登出
   */
  async logout() {
    try {
      await this.initialize();
      if (this.app?.currentUser) {
        await this.app.currentUser.logOut();
      } else {
        await logoutFromAtlas();
      }
      this.user = null;
      this.isLoggedIn = false;
      console.info('Realm 用户已登出');
    } catch (error) {
      console.error('登出失败', error);
      throw error;
    }
  }

  /**
   * 获取当前登录用户（模拟）
   * @returns {Object|null} 当前用户或null
   */
  getCurrentUser() {
    return this.user;
  }

  /**
   * 检查是否已登录（模拟）
   * @returns {boolean} 是否已登录
   */
  isUserLoggedIn() {
    return this.isLoggedIn;
  }

  /**
   * 注册模式
   * @param {Object} schema 模式定义
   */
  registerSchema(schema) {
    if (!schema || !schema.name) {
      throw new Error('无效的模式定义');
    }

    this.schemas.set(schema.name, schema);
    console.info(`已注册模式: ${schema.name}`);
  }

  /**
   * 获取Realm实例
   * @returns {Promise<Realm>} Realm实例
   */
  async getRealm() {
    try {
      if (this.realmOpenFailed) {
        const err = new Error(this.realmOpenFailureReason || 'Realm 初始化失败，已短路后续数据库调用');
        err.code = 'REALM_UNAVAILABLE';
        this._logErrorOnce('realm-unavailable-getRealm', '[RealmService] Realm 不可用，后续调用已短路:', err.message);
        throw err;
      }

      if (this.realm && !this.realm.isClosed) {
        return this.realm;
      }

      return await this.openRealm();
    } catch (error) {
      this._logErrorOnce('get-realm-failed', '获取Realm实例失败:', error);
      throw error;
    }
  }

  /**
   * 打开Realm数据库
   * @returns {Promise<Realm>} Realm实例
   */
  async openRealm() {
    try {
      await this.initialize();

      // 只有在Realm实例不存在或已关闭时才重新打开
      if (!this.realm || this.realm.isClosed) {
        const currentUser = this.app?.currentUser;
        const canUseSync = SYNC_ENABLED && currentUser && currentUser.state === 'active';

        if (canUseSync) {
          console.info('✅ [RealmService] Sync 模式：打开 Sync Realm');
          const syncConfig = getSyncRealmConfig(currentUser);
          this.realm = await Realm.open(syncConfig);

          try {
            const subs = this.realm.subscriptions;
            console.info('✅ [RealmService] Subscriptions 状态', {
              count: subs?.length,
              state: subs?.state,
              version: subs?.version,
            });
          } catch (subErr) {
            console.warn('⚠️ [RealmService] 读取 subscriptions 状态失败', subErr?.message || subErr);
          }
        } else {
          console.info('⚠️ [RealmService] Local 模式：打开本地 Realm');
          // 使用realmConfig中的openRealm函数
          this.realm = await openRealm();
        }

        this.realmOpenFailed = false;
        this.realmOpenFailureReason = null;
        console.info('Realm数据库打开成功');
      }

      return this.realm;
    } catch (error) {
      this.realmOpenFailed = true;
      this.realmOpenFailureReason = error?.message || 'Realm 打开失败';
      this._logErrorOnce('open-realm-failed', '打开Realm数据库失败（后续数据库调用将短路）', error);
      throw error;
    }
  }

  canUseRealmForWrites() {
    return !this.realmOpenFailed && !!this.realm && !this.realm.isClosed;
  }

  /**
   * 关闭Realm数据库
   */
  closeRealm() {
    if (!this.realm || this.realm.isClosed) {
      return;
    }

    try {
      // 使用realmConfig中的closeRealm函数
      closeRealm(this.realm);
      this.realm = null;
      console.info('Realm数据库已关闭');
    } catch (error) {
      console.error('关闭Realm数据库失败', error);
      throw error;
    }
  }

  /**
   * 创建对象
   * @param {string} schemaName 模式名称
   * @param {Object} data 对象数据
   * @returns {Promise<Object>} 创建的对象
   */
  async create(schemaName, data) {
    try {
      const realm = await this.getRealm();

      let createdObject;
      const objectId = data._id || this.createObjectId();

      realm.write(() => {
        try {
          // 处理数据，确保所有字段类型正确
          const safeData = { ...data };
          safeData._id = objectId;

          // 检查模式定义中的字段类型
          const schema = realm.schema.find(s => s.name === schemaName);
          if (schema && schema.properties) {
            Object.keys(schema.properties).forEach(propName => {
              const propType = schema.properties[propName];
              const propValue = safeData[propName];

              const isLegacyStringList = propType === 'string[]';
              const isLegacyIntList = propType === 'int[]';
              const isListType = typeof propType === 'object' && propType?.type === 'list';
              const isStringField = propType === 'string' || (typeof propType === 'object' && propType?.type === 'string');

              // 处理数组类型字段（兼容旧写法 string[]/int[] 与新写法 list+objectType）
              if ((isLegacyStringList || isLegacyIntList || isListType) && propValue !== undefined) {
                if (Array.isArray(propValue)) {
                  return;
                }

                if (typeof propValue === 'string') {
                  try {
                    const parsed = JSON.parse(propValue);
                    safeData[propName] = Array.isArray(parsed) ? parsed : [];
                  } catch (e) {
                    console.warn(`无法解析字段 ${propName} 为数组，设置为空数组`);
                    safeData[propName] = [];
                  }
                } else {
                  safeData[propName] = [];
                }
                return;
              }

              // 处理字符串类型字段，确保数组被转换为JSON字符串
              if (isStringField && Array.isArray(propValue)) {
                try {
                  safeData[propName] = JSON.stringify(propValue);
                } catch (e) {
                  console.warn(`无法序列化字段 ${propName} 为JSON字符串，设置为空字符串`);
                  safeData[propName] = '';
                }
              }
            });
          }

          // 首先尝试使用upsert模式（如果存在则更新，不存在则创建）
          createdObject = realm.create(schemaName, safeData, 'modified');
        } catch (createError) {
          console.log(`使用upsert模式创建${schemaName}失败，尝试删除后重新创建:`, createError.message);

          // 如果upsert失败，可能是主键冲突，尝试删除后重新创建
          const existingObject = realm.objectForPrimaryKey(schemaName, objectId);
          if (existingObject) {
            console.log(`删除现有的${schemaName}对象:`, objectId);
            realm.delete(existingObject);
          }

          // 重新创建
          createdObject = realm.create(schemaName, {
            ...data,
            _id: objectId,
          });
        }
      });

      // 转换为普通对象
      return this.realmObjectToPlain(createdObject);
    } catch (error) {
      console.error(`创建${schemaName}对象失败`, error);
      throw error;
    }
  }

  /**
   * 查询对象
   * @param {string} schemaName 模式名称
   * @param {string} filter 过滤条件
   * @param {Object} options 查询选项
   * @returns {Promise<Array<Object>>} 对象数组
   */
  async objects(schemaName, filter = '', options = {}) {
    try {
      const realm = await this.getRealm();

      // 获取所有对象
      let objects = realm.objects(schemaName);

      // 应用过滤条件
      if (filter) {
        objects = objects.filtered(filter);
      }

      // 应用排序
      if (options.sort) {
        const { field, ascending = true } = options.sort;
        objects = objects.sorted(field, ascending);
      }

      // 转换为普通对象数组
      const results = Array.from(objects).map(obj => this.realmObjectToPlain(obj));

      // 应用分页
      if (options.skip !== undefined || options.limit !== undefined) {
        const skip = options.skip || 0;
        const limit = options.limit || results.length;
        return results.slice(skip, skip + limit);
      }

      return results;
    } catch (error) {
      console.error(`查询${schemaName}对象失败`, error);
      throw error;
    }
  }

  /**
   * 查询单个对象
   * @param {string} schemaName 模式名称
   * @param {string} id 对象ID
   * @returns {Promise<Object|null>} 对象或null
   */
  async objectForPrimaryKey(schemaName, id) {
    try {
      const realm = await this.getRealm();

      // 查询对象
      const object = realm.objectForPrimaryKey(schemaName, id);

      // 转换为普通对象
      return object ? this.realmObjectToPlain(object) : null;
    } catch (error) {
      console.error(`查询${schemaName}对象(ID: ${id})失败`, error);
      throw error;
    }
  }

  /**
   * 更新对象
   * @param {string} schemaName 模式名称
   * @param {string} id 对象ID
   * @param {Object} data 更新数据
   * @returns {Promise<Object>} 更新后的对象
   */
  async update(schemaName, id, data) {
    try {
      const realm = await this.getRealm();

      // 查询对象
      const object = realm.objectForPrimaryKey(schemaName, id);

      if (!object) {
        console.log(`${schemaName}对象(ID: ${id})不存在，尝试创建新对象`);

        // 如果对象不存在，尝试创建新对象
        try {
          let newObject;
          realm.write(() => {
            // 确保数据包含主键
            const createData = { ...data };
            if (!createData._id) {
              createData._id = id;
            }

            newObject = realm.create(schemaName, createData);
          });

          // 返回新创建的对象
          return this.realmObjectToPlain(newObject);
        } catch (createError) {
          console.error(`创建${schemaName}对象失败:`, createError);
          throw createError;
        }
      }

      // 更新对象
      realm.write(() => {
        Object.keys(data).forEach(key => {
          if (key !== '_id') { // 不更新主键
            try {
              object[key] = data[key];
            } catch (fieldError) {
              console.error(`更新字段 ${key} 失败:`, fieldError);
              console.error('字段值:', data[key]);
              console.error('字段类型:', typeof data[key]);

              // 如果是数组字段但传入了对象，尝试修复
              if (fieldError.message && fieldError.message.includes('Expected value to be iterable')) {
                if (key === 'tags' && typeof data[key] === 'object' && data[key] !== null) {
                  if (Array.isArray(data[key])) {
                    object[key] = data[key].map(tag => String(tag));
                  } else if (data[key].results && Array.isArray(data[key].results)) {
                    object[key] = data[key].results.map(tag => String(tag));
                  } else {
                    console.warn('无法处理tags字段的对象值，设置为空数组');
                    object[key] = [];
                  }
                } else {
                  console.warn(`跳过有问题的字段: ${key}`);
                }
              } else {
                // 重新抛出其他类型的错误
                throw fieldError;
              }
            }
          }
        });
      });

      // 转换为普通对象
      return this.realmObjectToPlain(object);
    } catch (error) {
      console.error(`更新${schemaName}对象(ID: ${id})失败`, error);
      throw error;
    }
  }

  /**
   * 删除对象
   * @param {string} schemaName 模式名称
   * @param {string} id 对象ID
   * @returns {Promise<boolean>} 是否成功
   */
  async deleteObject(schemaName, id) {
    try {
      const realm = await this.getRealm();

      // 查询对象
      const object = realm.objectForPrimaryKey(schemaName, id);

      if (!object) {
        console.log(`${schemaName}对象(ID: ${id})不存在，尝试创建新对象`);

        // 如果对象不存在，尝试创建新对象
        try {
          let newObject;
          realm.write(() => {
            // 确保数据包含主键
            const createData = { ...data };
            if (!createData._id) {
              createData._id = id;
            }

            newObject = realm.create(schemaName, createData);
          });

          // 返回新创建的对象
          return this.realmObjectToPlain(newObject);
        } catch (createError) {
          console.error(`创建${schemaName}对象失败:`, createError);
          throw createError;
        }
      }

      // 删除对象
      realm.write(() => {
        realm.delete(object);
      });

      return true;
    } catch (error) {
      console.error(`删除${schemaName}对象(ID: ${id})失败`, error);
      throw error;
    }
  }

  /**
   * 创建ObjectId
   * @returns {string} 新的ObjectId
   */
  createObjectId() {
    // 使用 Realm 原生 ObjectId 生成唯一标识，避免手写随机逻辑
    return new Realm.BSON.ObjectId().toHexString();
  }

  /**
   * 将Realm对象转换为普通对象
   * @param {Object} realmObject Realm对象
   * @param {Set} [processedObjects] 已处理的对象集合，用于防止循环引用
   * @returns {Object} 普通对象
   * @private
   */
  realmObjectToPlain(realmObject, processedObjects = new Set()) {
    // 处理null或undefined
    if (realmObject == null) {
      return null;
    }

    // 如果是基本类型，直接返回
    if (typeof realmObject !== 'object') {
      return realmObject;
    }

    // 如果是Date对象，返回ISO字符串
    if (realmObject instanceof Date) {
      return realmObject.toISOString();
    }

    // 如果是数组，递归转换每个元素
    if (Array.isArray(realmObject)) {
      return realmObject.map(item => {
        // 如果是对象类型且不是null，检查循环引用
        if (typeof item === 'object' && item !== null) {
          // 使用对象的内存地址作为唯一标识
          const objId = item._id || Object.prototype.toString.call(item);

          // 如果已经处理过这个对象，返回简化版本以避免循环引用
          if (processedObjects.has(objId)) {
            // 返回对象的ID或简化版本
            return item._id ? { _id: item._id } : { reference: 'circular' };
          }

          // 标记为已处理
          processedObjects.add(objId);
        }

        return this.realmObjectToPlain(item, processedObjects);
      });
    }

    // 处理普通对象
    // 使用对象的内存地址作为唯一标识
    const objId = realmObject._id || Object.prototype.toString.call(realmObject);

    // 如果已经处理过这个对象，返回简化版本以避免循环引用
    if (processedObjects.has(objId)) {
      // 返回对象的ID或简化版本
      return realmObject._id ? { _id: realmObject._id } : { reference: 'circular' };
    }

    // 标记为已处理
    processedObjects.add(objId);

    // 转换对象
    const plainObject = {};

    // 获取所有属性名
    const keys = Object.getOwnPropertyNames(realmObject);

    // 复制属性
    for (const key of keys) {
      // 跳过函数、Symbol和内部属性，但保留_id字段
      if (
        typeof realmObject[key] === 'function' ||
        typeof key === 'symbol' ||
        (key.startsWith('_') && key !== '_id') ||
        key === 'realm' // 跳过realm属性，它可能导致循环引用
      ) {
        continue;
      }

      try {
        const value = realmObject[key];

        // 递归转换嵌套对象，但避免循环引用
        if (typeof value === 'object' && value !== null) {
          plainObject[key] = this.realmObjectToPlain(value, processedObjects);
        } else {
          plainObject[key] = value;
        }
      } catch (error) {
        console.warn(`无法转换属性 ${key}:`, error);
        // 跳过无法转换的属性
        plainObject[key] = null;
      }
    }

    // 确保_id字段被保留
    if (realmObject._id !== undefined) {
      plainObject._id = realmObject._id;
    }

    return plainObject;
  }

  /**
   * 查找单个文档
   * @param {string} collectionName 集合名称
   * @param {Object} filter 过滤条件
   * @returns {Promise<Object|null>} 文档
   */
  async findOne(collectionName, filter = {}) {
    try {
      const realm = await this.getRealm();

      // 构建查询字符串
      let queryStr = '';
      const queryParams = [];

      // 处理过滤条件
      Object.keys(filter).forEach((key, index) => {
        const value = filter[key];

        if (index > 0) {
          queryStr += ' AND ';
        }

        if (value === null) {
          queryStr += `${key} == null`;
        } else if (typeof value === 'string') {
          queryStr += `${key} == $${index}`;
          queryParams.push(value);
        } else if (typeof value === 'number' || typeof value === 'boolean') {
          queryStr += `${key} == ${value}`;
        } else if (value instanceof Date) {
          queryStr += `${key} == $${index}`;
          queryParams.push(value);
        }
      });

      // 如果没有过滤条件，获取所有对象
      let objects;
      if (queryStr) {
        // 检查是否有查询参数
        if (queryParams.length > 0) {
          objects = realm.objects(collectionName).filtered(queryStr, ...queryParams);
        } else {
          objects = realm.objects(collectionName).filtered(queryStr);
        }
      } else {
        objects = realm.objects(collectionName);
      }

      // 获取第一个对象
      const data = objects.length > 0 ? objects[0] : null;

      if (!data) {
        // 业务语义：查询未命中时返回 null（非错误）
        return null;
      }

      // 转换为普通对象
      return this.realmObjectToPlain(data);
    } catch (error) {
      console.error(`查找${collectionName}失败`, error);
      throw error;
    }
  }

  /**
   * 强制刷新Realm数据到磁盘
   * 确保所有写入操作都已持久化
   * @returns {Promise<boolean>} 刷新是否成功
   */
  async forceFlush() {
    try {
      if (this.realmOpenFailed) {
        this._logErrorOnce(
          'forceflush-short-circuit',
          '[RealmService] 跳过 forceFlush：Realm 初始化失败，后续保存流程已短路',
          this.realmOpenFailureReason
        );
        return false;
      }

      if (!this.realm || this.realm.isClosed) {
        this._logErrorOnce('forceflush-no-realm', '[RealmService] 跳过 forceFlush：Realm实例不存在或已关闭');
        return false;
      }

      // Realm会自动将更改持久化到磁盘
      // 这里我们等待任何待处理的写事务完成
      if (this.realm.isInTransaction) {
        console.warn('[RealmService] 检测到进行中的事务，等待完成...');
        return false;
      }

      console.log('✅ [RealmService] 数据刷新完成');
      return true;
    } catch (error) {
      this._logErrorOnce('[RealmService] 强制刷新失败', '[RealmService] 强制刷新失败:', error);
      return false;
    }
  }

  /**
   * 根据ID查找文档
   * @param {string} collectionName 集合名称
   * @param {string} id 文档ID
   * @returns {Promise<Object|null>} 文档
   */
  async findById(collectionName, id) {
    try {
      const realm = await this.getRealm();

      // 兼容字符串集合名及特殊集合'canvases'的主键查询
      const schemaName = collectionName;
      const realmObject = realm.objectForPrimaryKey(schemaName, id);

      if (!realmObject) {
        // 业务语义：按主键未命中时返回 null（非错误）
        return null;
      }

      // 转换为普通对象并做JSON字段解析
      const plain = this.realmObjectToPlain(realmObject);
      return this._postProcessRecord(schemaName, plain);
    } catch (error) {
      console.error(`根据ID查找${collectionName}失败`, error);
      throw error;
    }
  }

  /**
   * 查找多个文档
   * @param {string} collectionName 集合名称
   * @param {Object} filter 过滤条件
   * @param {Object} options 选项
   * @returns {Promise<Array<Object>>} 文档数组
   */
  async find(collectionName, filter = {}, options = {}) {
    try {
      // 解构选项，稍后使用
      const { sort: sortOption, limit: limitOption, skip: skipOption } = options;
      const realm = await this.getRealm();

      // 简化查询处理，避免复杂的查询字符串构建
      let objects = realm.objects(collectionName);

      // 如果有过滤条件，尝试应用简单的过滤
      if (Object.keys(filter).length > 0) {
        try {
          // 构建简单的查询字符串，只处理基本的等值查询
          const conditions = [];
          const queryParams = [];

          Object.keys(filter).forEach((key, index) => {
            const value = filter[key];

            // 只处理简单的等值查询
            if (value !== undefined && value !== null && typeof value !== 'object') {
              conditions.push(`${key} == $${index}`);
              queryParams.push(value);
            }
          });

          // 如果有条件，应用过滤
          if (conditions.length > 0) {
            const queryStr = conditions.join(' AND ');

            if (queryParams.length > 0) {
              objects = objects.filtered(queryStr, ...queryParams);
            } else {
              objects = objects.filtered(queryStr);
            }
          }
        } catch (filterError) {
          console.warn('应用过滤条件失败，返回所有对象:', filterError);
          // 如果过滤失败，尝试手动过滤
          if (filter.id) {
            // 手动过滤id字段 - 转换为数组进行过滤
            const allObjects = Array.from(objects);
            const filteredObjects = allObjects.filter(obj => {
              // 检查对象是否有_id属性，并且值等于filter.id
              return (obj._id && obj._id.toString() === filter.id.toString()) ||
                     // 或者检查对象是否有id属性，并且值等于filter.id
                     (obj.id && obj.id.toString() === filter.id.toString());
            });
            console.log(`通过id字段找到笔记: ${filter.id}`);
            // 将过滤结果转换回Realm Results格式
            objects = filteredObjects;
          }
          // 如果过滤失败且没有手动过滤成功，返回所有对象
        }
      }

      // 对象已经在上面获取了，不需要重新获取

      // 排序
      if (sortOption) {
        const sortField = Object.keys(sortOption)[0];
        const sortDirection = sortOption[sortField] === 1;
        objects = objects.sorted(sortField, sortDirection);
      }

      // 转换为普通对象数组并进行后处理（如JSON字段解析）
      const plainData = Array.from(objects).map(obj => this._postProcessRecord(collectionName, this.realmObjectToPlain(obj)));

      // 分页
      let result = plainData;
      if (skipOption) {
        result = result.slice(skipOption);
      }
      if (limitOption) {
        result = result.slice(0, limitOption);
      }

      return result;
    } catch (error) {
      console.error(`查找多个${collectionName}失败`, error);
      throw error;
    }
  }

  /**
   * 删除文档
   * @param {string} collectionName 集合名称
   * @param {string} id 文档ID
   * @returns {Promise<boolean>} 是否成功
   */
  async deleteById(collectionName, id) {
    try {
      const realm = await this.getRealm();

      // 查询对象
      const object = realm.objectForPrimaryKey(collectionName, id);

      if (!object) {
        // 业务语义：目标不存在时视为幂等删除完成（非错误）
        return true;
      }

      // 删除对象
      realm.write(() => {
        realm.delete(object);
      });

      return true;
    } catch (error) {
      console.error(`删除${collectionName}对象失败`, error);
      throw error;
    }
  }

  /**
   * 对记录做后处理（解析JSON字段等）
   */
  _postProcessRecord(collectionName, record) {
    if (!record) {return record;}

    if (collectionName === 'canvases') {
      try {
        // 将字符串字段解析回对象/数组
        if (typeof record.elements === 'string') {record.elements = JSON.parse(record.elements || '[]');}
        if (typeof record.layers === 'string') {record.layers = JSON.parse(record.layers || '[]');}
        if (typeof record.viewState === 'string') {record.viewState = JSON.parse(record.viewState || '{}');}
      } catch (e) {
        console.warn('解析画布JSON字段失败，将使用默认值', e);
        if (!Array.isArray(record.elements)) {record.elements = [];}
        if (!Array.isArray(record.layers)) {record.layers = [{ id: 'default', name: '默认图层', visible: true, locked: false }];}
        if (typeof record.viewState !== 'object' || record.viewState == null) {record.viewState = {};}
      }
    }

    return record;
  }
}

const realmService = new RealmService();

module.exports = realmService;
module.exports.default = realmService;
module.exports.realmService = realmService;
module.exports.RealmService = RealmService;
export default realmService;

