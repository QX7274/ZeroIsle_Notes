/**
 * Realm模型基类
 * 提供通用的模型方法
 */

import Realm from 'realm';
import { realmService } from '../services/database/realmService';
import { logService } from '../services/utils/logService';
import { offlineSyncService } from '../services/offline/offlineSyncService';
import { networkService } from '../services/network/networkService';

class BaseModel {
  constructor(data = {}, collectionName = '') {
    this._id = data._id || null;
    this.collectionName = collectionName;
    this.isNew = !data._id;
    this.isModified = false;
    this.modifiedFields = new Set();
    this._originalData = { ...data };
  }

  /**
   * 设置属性值
   * @param {string} key 属性名
   * @param {*} value 属性值
   */
  set(key, value) {
    if (this[key] !== value) {
      this[key] = value;
      this.isModified = true;
      this.modifiedFields.add(key);
    }
    return this;
  }

  /**
   * 获取属性值
   * @param {string} key 属性名
   * @returns {*} 属性值
   */
  get(key) {
    return this[key];
  }

  /**
   * 保存模型
   * @param {Object} options 选项
   * @returns {Promise<BaseModel>} 保存后的模型
   */
  async save(options = {}) {
    try {
      const { sync = true } = options;

      // 如果没有修改，直接返回
      if (!this.isNew && !this.isModified) {
        return this;
      }

      // 设置更新时间
      if (!this.created_at && this.isNew) {
        this.created_at = new Date();
      }
      this.updated_at = new Date();

      // 转换为普通对象
      const data = this.toJSON();

      // 获取Realm实例
      const realm = await realmService.getRealm();

      // 保存到本地数据库
      realm.write(() => {
        if (this.isNew) {
          // 创建新文档
          if (!data._id) {
            data._id = new Realm.BSON.ObjectId().toHexString();
          }

          const realmObject = realm.create(this.collectionName, data);
          this._id = realmObject._id;
          this.isNew = false;
        } else {
          // 更新现有文档
          const realmObject = realm.objectForPrimaryKey(this.collectionName, this._id);

          if (realmObject) {
            // 更新所有属性
            Object.keys(data).forEach(key => {
              if (key !== '_id') { // 不更新主键
                realmObject[key] = data[key];
              }
            });
          } else {
            throw new Error(`${this.collectionName}对象(ID: ${this._id})不存在`);
          }
        }
      });

      // 同步到服务器
      if (sync && networkService.isOnline()) {
        const operation = this.isNew ? 'create' : 'update';
        await offlineSyncService.addToSyncQueue({
          id: this._id,
          entity_id: this._id,
          entity_type: this.collectionName.toLowerCase(),
          operation,
          data,
        });
      }

      // 重置修改状态
      this.isModified = false;
      this.modifiedFields.clear();
      this._originalData = { ...data };

      return this;
    } catch (error) {
      logService.error(`保存${this.collectionName}失败`, error);
      throw error;
    }
  }

  /**
   * 删除模型
   * @param {Object} options 选项
   * @returns {Promise<boolean>} 是否成功
   */
  async remove(options = {}) {
    try {
      const { sync = true, soft = true } = options;

      if (!this._id) {
        return false;
      }

      if (soft) {
        // 软删除
        this.is_deleted = true;
        this.deleted_at = new Date();
        return this.save({ sync });
      } else {
        // 硬删除
        const realm = await realmService.getRealm();

        realm.write(() => {
          const realmObject = realm.objectForPrimaryKey(this.collectionName, this._id);

          if (realmObject) {
            realm.delete(realmObject);
          } else {
            throw new Error(`${this.collectionName}对象(ID: ${this._id})不存在`);
          }
        });

        // 同步到服务器
        if (sync && networkService.isOnline()) {
          await offlineSyncService.addToSyncQueue({
            id: this._id,
            entity_id: this._id,
            entity_type: this.collectionName.toLowerCase(),
            operation: 'delete',
            data: { _id: this._id },
          });
        }

        return true;
      }
    } catch (error) {
      logService.error(`删除${this.collectionName}失败`, error);
      throw error;
    }
  }

  /**
   * 恢复已删除的模型
   * @returns {Promise<BaseModel>} 恢复后的模型
   */
  async restore() {
    if (!this.is_deleted) {
      return this;
    }

    this.is_deleted = false;
    this.deleted_at = null;

    return this.save();
  }

  /**
   * 转换为JSON对象
   * @returns {Object} JSON对象
   */
  toJSON() {
    const json = {};

    // 复制所有非函数属性
    for (const key in this) {
      if (
        Object.prototype.hasOwnProperty.call(this, key) &&
        !key.startsWith('_') &&
        key !== 'isNew' &&
        key !== 'isModified' &&
        key !== 'modifiedFields' &&
        key !== 'collectionName' &&
        typeof this[key] !== 'function'
      ) {
        json[key] = this[key];
      }
    }

    return json;
  }

  /**
   * 查找单个文档
   * @param {Object} filter 过滤条件
   * @param {Object} options 选项
   * @returns {Promise<BaseModel|null>} 模型实例
   */
  static async findOne(filter = {}, options = {}) {
    try {
      const realm = await realmService.getRealm();

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
        objects = realm.objects(this.collectionName).filtered(queryStr, ...queryParams);
      } else {
        objects = realm.objects(this.collectionName);
      }

      // 获取第一个对象
      const data = objects.length > 0 ? objects[0] : null;

      if (!data) {
        return null;
      }

      // 转换为普通对象
      const plainData = realmService.realmObjectToPlain(data);

      return new this(plainData);
    } catch (error) {
      logService.error(`查找${this.collectionName}失败`, error);
      throw error;
    }
  }

  /**
   * 根据ID查找文档
   * @param {string} id 文档ID
   * @returns {Promise<BaseModel|null>} 模型实例
   */
  static async findById(id) {
    if (!id) {
      return null;
    }

    try {
      const realm = await realmService.getRealm();

      // 使用主键查询
      const realmObject = realm.objectForPrimaryKey(this.collectionName, id);

      if (!realmObject) {
        return null;
      }

      // 转换为普通对象
      const plainData = realmService.realmObjectToPlain(realmObject);

      return new this(plainData);
    } catch (error) {
      logService.error(`根据ID查找${this.collectionName}失败`, error);
      throw error;
    }
  }

  /**
   * 查找多个文档
   * @param {Object} filter 过滤条件
   * @param {Object} options 选项
   * @returns {Promise<Array<BaseModel>>} 模型实例数组
   */
  static async find(filter = {}, options = {}) {
    try {
      const { sort, limit, skip } = options;
      const realm = await realmService.getRealm();

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
        } else if (typeof value === 'object' && value.$in) {
          // 处理 $in 操作符
          const inValues = value.$in;
          if (Array.isArray(inValues) && inValues.length > 0) {
            const inConditions = inValues.map((val, i) => {
              const paramIndex = index + i;
              queryParams.push(val);
              return `${key} == $${paramIndex}`;
            });
            queryStr += `(${inConditions.join(' OR ')})`;
          }
        }
      });

      // 获取对象
      let objects;
      if (queryStr) {
        objects = realm.objects(this.collectionName).filtered(queryStr, ...queryParams);
      } else {
        objects = realm.objects(this.collectionName);
      }

      // 排序
      if (sort) {
        const sortField = Object.keys(sort)[0];
        const sortDirection = sort[sortField] === 1;
        objects = objects.sorted(sortField, sortDirection);
      }

      // 转换为普通对象数组
      const plainData = Array.from(objects).map(obj => realmService.realmObjectToPlain(obj));

      // 分页
      let result = plainData;
      if (skip) {
        result = result.slice(skip);
      }
      if (limit) {
        result = result.slice(0, limit);
      }

      return result.map(item => new this(item));
    } catch (error) {
      logService.error(`查找多个${this.collectionName}失败`, error);
      throw error;
    }
  }

  /**
   * 创建文档
   * @param {Object} data 文档数据
   * @param {Object} options 选项
   * @returns {Promise<BaseModel>} 模型实例
   */
  static async create(data, options = {}) {
    const model = new this(data);
    await model.save(options);
    return model;
  }

  /**
   * 更新文档
   * @param {Object} filter 过滤条件
   * @param {Object} update 更新数据
   * @param {Object} options 选项
   * @returns {Promise<Object>} 更新结果
   */
  static async updateOne(filter, update, options = {}) {
    try {
      const model = await this.findOne(filter);

      if (!model) {
        return { matchedCount: 0, modifiedCount: 0 };
      }

      // 应用更新
      for (const key in update) {
        if (key !== '_id') {
          model[key] = update[key];
        }
      }

      await model.save(options);

      return { matchedCount: 1, modifiedCount: 1 };
    } catch (error) {
      logService.error(`更新${this.collectionName}失败`, error);
      throw error;
    }
  }

  /**
   * 更新多个文档
   * @param {Object} filter 过滤条件
   * @param {Object} update 更新数据
   * @param {Object} options 选项
   * @returns {Promise<Object>} 更新结果
   */
  static async updateMany(filter, update, options = {}) {
    try {
      const models = await this.find(filter);

      if (models.length === 0) {
        return { matchedCount: 0, modifiedCount: 0 };
      }

      let modifiedCount = 0;

      for (const model of models) {
        // 应用更新
        for (const key in update) {
          if (key !== '_id') {
            model[key] = update[key];
          }
        }

        await model.save(options);
        modifiedCount++;
      }

      return { matchedCount: models.length, modifiedCount };
    } catch (error) {
      logService.error(`更新多个${this.collectionName}失败`, error);
      throw error;
    }
  }

  /**
   * 删除文档
   * @param {Object} filter 过滤条件
   * @param {Object} options 选项
   * @returns {Promise<Object>} 删除结果
   */
  static async deleteOne(filter, options = {}) {
    try {
      const model = await this.findOne(filter);

      if (!model) {
        return { deletedCount: 0 };
      }

      await model.remove(options);

      return { deletedCount: 1 };
    } catch (error) {
      logService.error(`删除${this.collectionName}失败`, error);
      throw error;
    }
  }

  /**
   * 删除多个文档
   * @param {Object} filter 过滤条件
   * @param {Object} options 选项
   * @returns {Promise<Object>} 删除结果
   */
  static async deleteMany(filter, options = {}) {
    try {
      const models = await this.find(filter);

      if (models.length === 0) {
        return { deletedCount: 0 };
      }

      let deletedCount = 0;

      for (const model of models) {
        await model.remove(options);
        deletedCount++;
      }

      return { deletedCount };
    } catch (error) {
      logService.error(`删除多个${this.collectionName}失败`, error);
      throw error;
    }
  }

  /**
   * 计数文档
   * @param {Object} filter 过滤条件
   * @returns {Promise<number>} 文档数量
   */
  static async count(filter = {}) {
    try {
      const realm = await realmService.getRealm();

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

      // 获取对象
      let objects;
      if (queryStr) {
        objects = realm.objects(this.collectionName).filtered(queryStr, ...queryParams);
      } else {
        objects = realm.objects(this.collectionName);
      }

      return objects.length;
    } catch (error) {
      logService.error(`计数${this.collectionName}失败`, error);
      throw error;
    }
  }
}

export default BaseModel;
