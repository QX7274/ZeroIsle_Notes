/**
 * 分类模型类
 */

import BaseModel from './BaseModel';
import { logService } from '../services/utils/logService';

class CategoryModel extends BaseModel {
  constructor(data = {}) {
    super(data, 'Category');
    
    this.name = data.name || '';
    this.description = data.description || '';
    this.color = data.color || null;
    this.icon = data.icon || null;
    this.parent_id = data.parent_id || null;
    this.is_default = data.is_default || false;
    this.is_deleted = data.is_deleted || false;
    this.is_synced = data.is_synced || false;
    this.created_at = data.created_at || null;
    this.updated_at = data.updated_at || null;
    this.user_id = data.user_id || null;
    this.order = data.order || 0;
  }

  /**
   * 更新名称
   * @param {string} name 名称
   * @returns {CategoryModel} 分类模型
   */
  updateName(name) {
    this.name = name;
    this.isModified = true;
    this.modifiedFields.add('name');
    return this;
  }

  /**
   * 更新描述
   * @param {string} description 描述
   * @returns {CategoryModel} 分类模型
   */
  updateDescription(description) {
    this.description = description;
    this.isModified = true;
    this.modifiedFields.add('description');
    return this;
  }

  /**
   * 设置颜色
   * @param {string} color 颜色
   * @returns {CategoryModel} 分类模型
   */
  setColor(color) {
    this.color = color;
    this.isModified = true;
    this.modifiedFields.add('color');
    return this;
  }

  /**
   * 设置图标
   * @param {string} icon 图标
   * @returns {CategoryModel} 分类模型
   */
  setIcon(icon) {
    this.icon = icon;
    this.isModified = true;
    this.modifiedFields.add('icon');
    return this;
  }

  /**
   * 设置父分类
   * @param {string} parentId 父分类ID
   * @returns {CategoryModel} 分类模型
   */
  setParent(parentId) {
    this.parent_id = parentId;
    this.isModified = true;
    this.modifiedFields.add('parent_id');
    return this;
  }

  /**
   * 设置默认状态
   * @param {boolean} isDefault 是否默认
   * @returns {CategoryModel} 分类模型
   */
  setDefault(isDefault) {
    this.is_default = isDefault;
    this.isModified = true;
    this.modifiedFields.add('is_default');
    return this;
  }

  /**
   * 设置排序
   * @param {number} order 排序
   * @returns {CategoryModel} 分类模型
   */
  setOrder(order) {
    this.order = order;
    this.isModified = true;
    this.modifiedFields.add('order');
    return this;
  }

  /**
   * 查找用户的分类
   * @param {string} userId 用户ID
   * @param {Object} options 选项
   * @returns {Promise<Array<CategoryModel>>} 分类模型数组
   */
  static async findByUser(userId, options = {}) {
    try {
      const {
        limit = 50,
        skip = 0,
        sort = { order: 1, name: 1 },
        is_deleted = false,
        parent_id = null,
      } = options;
      
      const filter = { user_id: userId, is_deleted };
      
      if (parent_id !== undefined) {
        filter.parent_id = parent_id;
      }
      
      return this.find(filter, { sort, limit, skip });
    } catch (error) {
      logService.error('查找用户分类失败', error);
      throw error;
    }
  }

  /**
   * 查找默认分类
   * @param {string} userId 用户ID
   * @returns {Promise<CategoryModel|null>} 分类模型
   */
  static async findDefault(userId) {
    try {
      return this.findOne({
        user_id: userId,
        is_default: true,
        is_deleted: false,
      });
    } catch (error) {
      logService.error('查找默认分类失败', error);
      throw error;
    }
  }

  /**
   * 查找根分类
   * @param {string} userId 用户ID
   * @param {Object} options 选项
   * @returns {Promise<Array<CategoryModel>>} 分类模型数组
   */
  static async findRoots(userId, options = {}) {
    try {
      const {
        limit = 50,
        skip = 0,
        sort = { order: 1, name: 1 },
        is_deleted = false,
      } = options;
      
      const filter = {
        user_id: userId,
        parent_id: null,
        is_deleted,
      };
      
      return this.find(filter, { sort, limit, skip });
    } catch (error) {
      logService.error('查找根分类失败', error);
      throw error;
    }
  }

  /**
   * 查找子分类
   * @param {string} parentId 父分类ID
   * @param {Object} options 选项
   * @returns {Promise<Array<CategoryModel>>} 分类模型数组
   */
  static async findChildren(parentId, options = {}) {
    try {
      const {
        limit = 50,
        skip = 0,
        sort = { order: 1, name: 1 },
        is_deleted = false,
      } = options;
      
      const filter = {
        parent_id: parentId,
        is_deleted,
      };
      
      return this.find(filter, { sort, limit, skip });
    } catch (error) {
      logService.error('查找子分类失败', error);
      throw error;
    }
  }

  /**
   * 根据名称查找分类
   * @param {string} name 分类名称
   * @param {string} userId 用户ID
   * @returns {Promise<CategoryModel|null>} 分类模型
   */
  static async findByName(name, userId) {
    try {
      return this.findOne({
        name,
        user_id: userId,
        is_deleted: false,
      });
    } catch (error) {
      logService.error('根据名称查找分类失败', error);
      throw error;
    }
  }

  /**
   * 获取分类路径
   * @param {string} categoryId 分类ID
   * @returns {Promise<Array<CategoryModel>>} 分类路径
   */
  static async getPath(categoryId) {
    try {
      const path = [];
      let currentCategory = await this.findById(categoryId);
      
      while (currentCategory) {
        path.unshift(currentCategory);
        
        if (!currentCategory.parent_id) {
          break;
        }
        
        currentCategory = await this.findById(currentCategory.parent_id);
      }
      
      return path;
    } catch (error) {
      logService.error('获取分类路径失败', error);
      throw error;
    }
  }

  /**
   * 创建默认分类
   * @param {string} userId 用户ID
   * @returns {Promise<CategoryModel>} 分类模型
   */
  static async createDefault(userId) {
    try {
      // 检查是否已存在默认分类
      const existingDefault = await this.findDefault(userId);
      
      if (existingDefault) {
        return existingDefault;
      }
      
      // 创建默认分类
      return this.create({
        name: '默认分类',
        description: '默认分类',
        color: '#3498db',
        icon: 'folder',
        is_default: true,
        user_id: userId,
        order: 0,
      });
    } catch (error) {
      logService.error('创建默认分类失败', error);
      throw error;
    }
  }

  /**
   * 创建初始分类
   * @param {string} userId 用户ID
   * @returns {Promise<Array<CategoryModel>>} 分类模型数组
   */
  static async createInitialCategories(userId) {
    try {
      const categories = [
        {
          name: '工作',
          description: '工作相关笔记',
          color: '#e74c3c',
          icon: 'briefcase',
          is_default: false,
          user_id: userId,
          order: 1,
        },
        {
          name: '个人',
          description: '个人笔记',
          color: '#2ecc71',
          icon: 'user',
          is_default: false,
          user_id: userId,
          order: 2,
        },
        {
          name: '学习',
          description: '学习笔记',
          color: '#f39c12',
          icon: 'book',
          is_default: false,
          user_id: userId,
          order: 3,
        },
        {
          name: '项目',
          description: '项目笔记',
          color: '#9b59b6',
          icon: 'project-diagram',
          is_default: false,
          user_id: userId,
          order: 4,
        },
      ];
      
      const results = [];
      
      for (const category of categories) {
        // 检查是否已存在同名分类
        const existing = await this.findByName(category.name, userId);
        
        if (existing) {
          results.push(existing);
        } else {
          const newCategory = await this.create(category);
          results.push(newCategory);
        }
      }
      
      // 创建默认分类
      const defaultCategory = await this.createDefault(userId);
      
      // 确保默认分类在结果中
      if (!results.some(cat => cat._id === defaultCategory._id)) {
        results.push(defaultCategory);
      }
      
      return results;
    } catch (error) {
      logService.error('创建初始分类失败', error);
      throw error;
    }
  }

  /**
   * 重新排序分类
   * @param {Array<Object>} categories 分类数组，包含id和order
   * @returns {Promise<boolean>} 是否成功
   */
  static async reorder(categories) {
    try {
      for (const { id, order } of categories) {
        const category = await this.findById(id);
        
        if (category) {
          category.order = order;
          await category.save();
        }
      }
      
      return true;
    } catch (error) {
      logService.error('重新排序分类失败', error);
      throw error;
    }
  }
}

// 设置集合名称
CategoryModel.collectionName = 'Category';

export default CategoryModel;
