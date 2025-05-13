/**
 * 分类服务 - 提供笔记分类的管理功能
 */

import { mongoDBService } from '../database/mongoDBAdapter';
import { offlineStorageService } from '../offline/offlineStorageService';
import { networkService } from '../network/networkService';

class CategoryService {
  constructor() {
    this.initialized = false;
    this.initializationPromise = null;
    this.collection = 'categories';
  }

  /**
   * 初始化分类服务
   */
  async initialize() {
    if (this.initialized) return Promise.resolve();

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = new Promise(async (resolve, reject) => {
      try {
        // 确保MongoDB服务已初始化
        await mongoDBService.initialize();

        // 设置已初始化标志
        this.initialized = true;
        console.log('分类服务初始化成功');
        resolve();
      } catch (error) {
        console.error('分类服务初始化失败:', error);
        reject(error);
      }
    });

    return this.initializationPromise;
  }

  /**
   * 创建新分类
   * @param {Object} categoryData 分类数据
   * @returns {Promise<Object>} 创建的分类对象
   */
  async createCategory(categoryData) {
    try {
      await this.initialize();

      // 添加创建时间和更新时间
      const now = new Date();
      const category = {
        ...categoryData,
        created_at: now,
        updated_at: now,
        is_deleted: false,
        is_synced: false,
      };

      // 在线模式：直接保存到MongoDB
      if (networkService.isOnline()) {
        const result = await mongoDBService.insertOne(this.collection, category);
        category._id = result.insertedId;
        category.is_synced = true;

        // 同时保存到本地存储以便离线访问
        await offlineStorageService.saveCategory(category);

        return category;
      }

      // 离线模式：保存到本地存储
      category._id = await offlineStorageService.saveCategory(category);

      return category;
    } catch (error) {
      console.error('创建分类失败:', error);
      throw error;
    }
  }

  /**
   * 获取所有分类
   * @param {Object} options 查询选项
   * @returns {Promise<Array>} 分类列表
   */
  async getCategories(options = {}) {
    try {
      await this.initialize();

      const { filter = {}, sort = { name: 1 }, limit = 0, skip = 0 } = options;

      // 默认不显示已删除的分类
      const defaultFilter = { is_deleted: false, ...filter };

      // 在线模式：从MongoDB获取
      if (networkService.isOnline()) {
        const categories = await mongoDBService.find(
          this.collection,
          defaultFilter,
          { sort, limit, skip }
        );

        // 更新本地缓存
        await offlineStorageService.saveCategories(categories);

        return categories;
      }

      // 离线模式：从本地存储获取
      return offlineStorageService.getCategories(defaultFilter, sort, limit, skip);
    } catch (error) {
      console.error('获取分类列表失败:', error);
      throw error;
    }
  }

  /**
   * 根据ID获取分类
   * @param {string} categoryId 分类ID
   * @returns {Promise<Object>} 分类对象
   */
  async getCategoryById(categoryId) {
    try {
      await this.initialize();

      // 在线模式：从MongoDB获取
      if (networkService.isOnline()) {
        const category = await mongoDBService.findOne(this.collection, { _id: categoryId });

        // 更新本地缓存
        if (category) {
          await offlineStorageService.saveCategory(category);
        }

        return category;
      }

      // 离线模式：从本地存储获取
      return offlineStorageService.getCategoryById(categoryId);
    } catch (error) {
      console.error(`获取分类(ID: ${categoryId})失败:`, error);
      throw error;
    }
  }

  /**
   * 更新分类
   * @param {string} categoryId 分类ID
   * @param {Object} updateData 更新数据
   * @returns {Promise<Object>} 更新后的分类对象
   */
  async updateCategory(categoryId, updateData) {
    try {
      await this.initialize();

      // 添加更新时间
      const update = {
        ...updateData,
        updated_at: new Date(),
        is_synced: false,
      };

      // 在线模式：更新MongoDB
      if (networkService.isOnline()) {
        await mongoDBService.updateOne(
          this.collection,
          { _id: categoryId },
          { $set: update }
        );

        update.is_synced = true;
      }

      // 更新本地存储
      const updatedCategory = await offlineStorageService.updateCategory(categoryId, update);

      return updatedCategory;
    } catch (error) {
      console.error(`更新分类(ID: ${categoryId})失败:`, error);
      throw error;
    }
  }

  /**
   * 删除分类（软删除）
   * @param {string} categoryId 分类ID
   * @returns {Promise<boolean>} 是否成功
   */
  async deleteCategory(categoryId) {
    try {
      await this.initialize();

      const update = {
        is_deleted: true,
        updated_at: new Date(),
        is_synced: false,
      };

      // 在线模式：更新MongoDB
      if (networkService.isOnline()) {
        await mongoDBService.updateOne(
          this.collection,
          { _id: categoryId },
          { $set: update }
        );

        update.is_synced = true;
      }

      // 更新本地存储
      await offlineStorageService.updateCategory(categoryId, update);

      return true;
    } catch (error) {
      console.error(`删除分类(ID: ${categoryId})失败:`, error);
      throw error;
    }
  }

  /**
   * 永久删除分类
   * @param {string} categoryId 分类ID
   * @returns {Promise<boolean>} 是否成功
   */
  async permanentlyDeleteCategory(categoryId) {
    try {
      await this.initialize();

      // 在线模式：从MongoDB删除
      if (networkService.isOnline()) {
        await mongoDBService.deleteOne(this.collection, { _id: categoryId });
      }

      // 从本地存储删除
      await offlineStorageService.deleteCategory(categoryId);

      return true;
    } catch (error) {
      console.error(`永久删除分类(ID: ${categoryId})失败:`, error);
      throw error;
    }
  }

  /**
   * 获取分类下的笔记数量
   * @param {string} categoryId 分类ID
   * @returns {Promise<number>} 笔记数量
   */
  async getNoteCountByCategory(categoryId) {
    try {
      await this.initialize();

      // 在线模式：从MongoDB获取
      if (networkService.isOnline()) {
        const count = await mongoDBService.count(
          'notes',
          { category_id: categoryId, is_deleted: false }
        );

        return count;
      }

      // 离线模式：从本地存储获取
      return offlineStorageService.getNoteCountByCategory(categoryId);
    } catch (error) {
      console.error(`获取分类(ID: ${categoryId})下的笔记数量失败:`, error);
      throw error;
    }
  }

  /**
   * 获取默认分类
   * @returns {Promise<Object>} 默认分类对象
   */
  async getDefaultCategory() {
    try {
      await this.initialize();

      // 查找默认分类
      const defaultCategory = await this.getCategoryByName('默认分类');

      // 如果默认分类不存在，则创建
      if (!defaultCategory) {
        return this.createCategory({
          name: '默认分类',
          color: '#2196F3',
          icon: 'folder',
          is_default: true,
        });
      }

      return defaultCategory;
    } catch (error) {
      console.error('获取默认分类失败:', error);
      throw error;
    }
  }

  /**
   * 根据名称获取分类
   * @param {string} name 分类名称
   * @returns {Promise<Object>} 分类对象
   */
  async getCategoryByName(name) {
    try {
      await this.initialize();

      // 在线模式：从MongoDB获取
      if (networkService.isOnline()) {
        const category = await mongoDBService.findOne(
          this.collection,
          { name, is_deleted: false }
        );

        // 更新本地缓存
        if (category) {
          await offlineStorageService.saveCategory(category);
        }

        return category;
      }

      // 离线模式：从本地存储获取
      return offlineStorageService.getCategoryByName(name);
    } catch (error) {
      console.error(`获取分类(名称: ${name})失败:`, error);
      throw error;
    }
  }
}

export const categoryService = new CategoryService();
