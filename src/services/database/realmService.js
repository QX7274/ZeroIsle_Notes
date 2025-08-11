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
  getCurrentUser
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
  }

  /**
   * 初始化Realm服务
   */
  async initialize() {
    if (this.initialized) return Promise.resolve();

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = new Promise(async (resolve, reject) => {
      try {
        // 初始化本地Realm数据库
        this.app = getRealmApp();

        // 使用本地模式，不连接MongoDB Atlas
        console.info('Realm将使用本地模式，不连接MongoDB Atlas');

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
   * 用户认证方法（模拟）
   * 这些方法仅用于保持API兼容性，不实际连接MongoDB Atlas
   * 实际的用户认证应该使用前后端已实现的系统
   */

  /**
   * 使用邮箱和密码登录（模拟）
   * @param {string} email 用户邮箱
   * @param {string} password 用户密码
   * @returns {Promise<Object>} 模拟的用户对象
   */
  async login(email, password) {
    try {
      // 确保已初始化
      await this.initialize();

      // 使用模拟登录
      this.user = await loginToAtlas(email, password);
      this.isLoggedIn = true;

      console.info('使用本地模式，不连接MongoDB Atlas进行登录');

      return this.user;
    } catch (error) {
      console.error('登录失败', error);
      throw error;
    }
  }

  /**
   * 匿名登录（模拟）
   * @returns {Promise<Object>} 模拟的匿名用户对象
   */
  async loginAnonymously() {
    try {
      // 确保已初始化
      await this.initialize();

      // 使用模拟匿名登录
      this.user = await loginAnonymously();
      this.isLoggedIn = true;

      console.info('使用本地模式，不连接MongoDB Atlas进行匿名登录');

      return this.user;
    } catch (error) {
      console.error('匿名登录失败', error);
      throw error;
    }
  }

  /**
   * 登出（模拟）
   * @returns {Promise<void>}
   */
  async logout() {
    try {
      // 关闭所有打开的Realm实例
      this.closeRealm();

      // 重置用户状态
      this.user = null;
      this.isLoggedIn = false;

      console.info('使用本地模式，不连接MongoDB Atlas进行登出');
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
    if (this.realm && !this.realm.isClosed) {
      return this.realm;
    }

    return this.openRealm();
  }

  /**
   * 打开Realm数据库
   * @returns {Promise<Realm>} Realm实例
   */
  async openRealm() {
    try {
      await this.initialize();

      // 关闭现有的Realm实例
      this.closeRealm();

      // 使用realmConfig中的openRealm函数 - 不再需要同步选项
      this.realm = await openRealm();
      console.info('Realm数据库打开成功');

      return this.realm;
    } catch (error) {
      console.error('打开Realm数据库失败', error);
      throw error;
    }
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

      realm.write(() => {
        createdObject = realm.create(schemaName, {
          ...data,
          _id: data._id || this.createObjectId(),
        });
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
        throw new Error(`${schemaName}对象(ID: ${id})不存在`);
      }

      // 更新对象
      realm.write(() => {
        Object.keys(data).forEach(key => {
          if (key !== '_id') { // 不更新主键
            try {
              object[key] = data[key];
            } catch (fieldError) {
              console.error(`更新字段 ${key} 失败:`, fieldError);
              console.error(`字段值:`, data[key]);
              console.error(`字段类型:`, typeof data[key]);

              // 如果是数组字段但传入了对象，尝试修复
              if (fieldError.message && fieldError.message.includes('Expected value to be iterable')) {
                if (key === 'tags' && typeof data[key] === 'object' && data[key] !== null) {
                  if (Array.isArray(data[key])) {
                    object[key] = data[key].map(tag => String(tag));
                  } else if (data[key].results && Array.isArray(data[key].results)) {
                    object[key] = data[key].results.map(tag => String(tag));
                  } else {
                    console.warn(`无法处理tags字段的对象值，设置为空数组`);
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
        throw new Error(`${schemaName}对象(ID: ${id})不存在`);
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
    // 生成一个随机的24位十六进制字符串作为ObjectId
    const timestamp = Math.floor(new Date().getTime() / 1000).toString(16).padStart(8, '0');
    const machineId = Math.floor(Math.random() * 16777216).toString(16).padStart(6, '0');
    const processId = Math.floor(Math.random() * 65536).toString(16).padStart(4, '0');
    const counter = Math.floor(Math.random() * 16777216).toString(16).padStart(6, '0');

    return timestamp + machineId + processId + counter;
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
          // 如果过滤失败，返回所有对象
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
        return false;
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
    if (!record) return record;

    if (collectionName === 'canvases') {
      try {
        // 将字符串字段解析回对象/数组
        if (typeof record.elements === 'string') record.elements = JSON.parse(record.elements || '[]');
        if (typeof record.layers === 'string') record.layers = JSON.parse(record.layers || '[]');
        if (typeof record.viewState === 'string') record.viewState = JSON.parse(record.viewState || '{}');
      } catch (e) {
        console.warn('解析画布JSON字段失败，将使用默认值', e);
        if (!Array.isArray(record.elements)) record.elements = [];
        if (!Array.isArray(record.layers)) record.layers = [{ id: 'default', name: '默认图层', visible: true, locked: false }];
        if (typeof record.viewState !== 'object' || record.viewState == null) record.viewState = {};
      }
    }

    return record;
  }
}

export const realmService = new RealmService();

