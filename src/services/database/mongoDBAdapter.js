/**
 * MongoDB适配器 
 * 将mongoDBService的方法映射到realmService的方法
 * 用于平滑过渡到新的存储架构
 */

import { realmService } from './realmService';


/**
 * MongoDB适配器类
 * 提供与mongoDBService兼容的API，但实际使用realmService实现
 */
class MongoDBAdapter {
  constructor() {
    this.initialized = false;
    this.initializationPromise = null;
  }

  /**
   * 初始化服务
   */
  async initialize() {
    if (this.initialized) return Promise.resolve();

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = new Promise(async (resolve, reject) => {
      try {
        // 初始化Realm服务
        await realmService.initialize();

        this.initialized = true;
        console.info('MongoDB适配器初始化成功');
        resolve();
      } catch (error) {
        console.error('MongoDB适配器初始化失败', error);
        reject(error);
      }
    });

    return this.initializationPromise;
  }

  /**
   * 插入单个文档
   * @param {string} collectionName 集合名称
   * @param {Object} document 文档数据
   * @returns {Promise<string>} 插入的文档ID
   */
  async insertOne(collectionName, document) {
    try {
      await this.initialize();
      const result = await realmService.create(collectionName, document);
      return result._id.toString();
    } catch (error) {
      console.error(`插入文档失败: ${collectionName}`, error);
      throw error;
    }
  }

  /**
   * 插入多个文档
   * @param {string} collectionName 集合名称
   * @param {Array<Object>} documents 文档数据数组
   * @returns {Promise<Array<string>>} 插入的文档ID数组
   */
  async insertMany(collectionName, documents) {
    try {
      await this.initialize();
      const ids = [];
      const realm = await realmService.getRealm();

      realm.write(() => {
        for (const document of documents) {
          const obj = realm.create(collectionName, {
            ...document,
            _id: document._id || new Realm.BSON.ObjectId(),
          });
          ids.push(obj._id.toString());
        }
      });

      return ids;
    } catch (error) {
      console.error(`批量插入文档失败: ${collectionName}`, error);
      throw error;
    }
  }

  /**
   * 更新单个文档
   * @param {string} collectionName 集合名称
   * @param {Object} filter 过滤条件
   * @param {Object} update 更新数据
   * @returns {Promise<boolean>} 是否成功
   */
  async updateOne(collectionName, filter, update) {
    try {
      await this.initialize();
      
      // 查找文档
      const document = await realmService.findOne(collectionName, filter);
      
      if (!document) {
        return false;
      }
      
      // 更新文档
      await realmService.update(collectionName, document._id, update.$set || update);
      
      return true;
    } catch (error) {
      console.error(`更新文档失败: ${collectionName}`, error);
      throw error;
    }
  }

  /**
   * 更新多个文档
   * @param {string} collectionName 集合名称
   * @param {Object} filter 过滤条件
   * @param {Object} update 更新数据
   * @returns {Promise<number>} 更新的文档数数   
   */
  async updateMany(collectionName, filter, update) {
    try {
      await this.initialize();
      
      // 查找文档
      const documents = await realmService.find(collectionName, filter);
      
      if (documents.length === 0) {
        return 0;
      }
      
      // 更新文档
      const realm = await realmService.getRealm();
      const updateData = update.$set || update;
      
      realm.write(() => {
        for (const document of documents) {
          const obj = realm.objectForPrimaryKey(collectionName, document._id);
          if (obj) {
            Object.keys(updateData).forEach(key => {
              if (key !== '_id') {
                obj[key] = updateData[key];
              }
            });
          }
        }
      });
      
      return documents.length;
    } catch (error) {
      console.error(`批量更新文档失败: ${collectionName}`, error);
      throw error;
    }
  }

  /**
   * 删除单个文档
   * @param {string} collectionName 集合名称
   * @param {Object} filter 过滤条件
   * @returns {Promise<boolean>} 是否成功
   */
  async deleteOne(collectionName, filter) {
    try {
      await this.initialize();
      
      // 查找文档
      const document = await realmService.findOne(collectionName, filter);
      
      if (!document) {
        return false;
      }
      
      // 删除文档
      await realmService.delete(collectionName, document._id);
      
      return true;
    } catch (error) {
      console.error(`删除文档失败: ${collectionName}`, error);
      throw error;
    }
  }

  /**
   * 删除多个文档
   * @param {string} collectionName 集合名称
   * @param {Object} filter 过滤条件
   * @returns {Promise<number>} 删除的文档数量
   */
  async deleteMany(collectionName, filter) {
    try {
      await this.initialize();
      
      // 查找文档
      const documents = await realmService.find(collectionName, filter);
      
      if (documents.length === 0) {
        return 0;
      }
      
      // 删除文档
      const realm = await realmService.getRealm();
      
      realm.write(() => {
        for (const document of documents) {
          const obj = realm.objectForPrimaryKey(collectionName, document._id);
          if (obj) {
            realm.delete(obj);
          }
        }
      });
      
      return documents.length;
    } catch (error) {
      console.error(`批量删除文档失败: ${collectionName}`, error);
      throw error;
    }
  }

  /**
   * 查找文档
   * @param {string} collectionName 集合名称
   * @param {Object} filter 过滤条件
   * @param {Object} options 选项
   * @returns {Promise<Array<Object>>} 文档数组
   */
  async find(collectionName, filter = {}, options = {}) {
    try {
      await this.initialize();
      return await realmService.find(collectionName, filter, options);
    } catch (error) {
      console.error(`查询文档失败: ${collectionName}`, error);
      throw error;
    }
  }

  /**
   * 查找单个文档
   * @param {string} collectionName 集合名称
   * @param {Object} filter 过滤条件
   * @param {Object} options 选项
   * @returns {Promise<Object|null>} 文档或null
   */
  async findOne(collectionName, filter = {}, options = {}) {
    try {
      await this.initialize();
      return await realmService.findOne(collectionName, filter);
    } catch (error) {
      console.error(`查询单个文档失败: ${collectionName}`, error);
      throw error;
    }
  }
}

// 创建单例实例
export const mongoDBService = new MongoDBAdapter();

// 初始化MongoDB适配器
mongoDBService.initialize().catch(error => {
  console.error('初始化MongoDB适配器失败', error);
});

export default mongoDBService;

