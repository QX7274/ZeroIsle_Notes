/**
 * 分类模型适配器
 * 用于在前端和后端模型之间进行转换
 */

import { CategoryModel } from '../models';
import { logService } from '../services/utils/logService';
import { offlineSyncService } from '../services/offline/offlineSyncService';

/**
 * 将后端分类模型转换为前端分类对象
 * @param {Object} category 后端分类模型
 * @returns {Object} 前端分类对象
 */
export const toFrontendCategory = (category) => {
  if (!category) return null;
  
  try {
    return {
      id: category._id,
      name: category.name || '',
      description: category.description || '',
      color: category.color,
      icon: category.icon,
      parentId: category.parent_id,
      isDefault: category.is_default || false,
      isDeleted: category.is_deleted || false,
      isSynced: category.is_synced || false,
      createdAt: category.created_at ? new Date(category.created_at) : new Date(),
      updatedAt: category.updated_at ? new Date(category.updated_at) : new Date(),
      order: category.order || 0,
    };
  } catch (error) {
    logService.error('转换分类模型失败', error);
    return null;
  }
};

/**
 * 将前端分类对象转换为后端分类模型
 * @param {Object} category 前端分类对象
 * @returns {Object} 后端分类模型
 */
export const toBackendCategory = (category) => {
  if (!category) return null;
  
  try {
    return {
      _id: category.id,
      name: category.name || '',
      description: category.description || '',
      color: category.color,
      icon: category.icon,
      parent_id: category.parentId,
      is_default: category.isDefault || false,
      is_deleted: category.isDeleted || false,
      is_synced: category.isSynced || false,
      created_at: category.createdAt || new Date(),
      updated_at: category.updatedAt || new Date(),
      order: category.order || 0,
    };
  } catch (error) {
    logService.error('转换分类对象失败', error);
    return null;
  }
};

/**
 * 创建分类
 * @param {Object} categoryData 分类数据
 * @param {string} userId 用户ID
 * @returns {Promise<Object>} 创建的分类
 */
export const createCategory = async (categoryData, userId) => {
  try {
    // 准备分类数据
    const now = new Date();
    const categoryId = `category_${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    
    const backendCategory = {
      _id: categoryId,
      name: categoryData.name || '',
      description: categoryData.description || '',
      color: categoryData.color,
      icon: categoryData.icon,
      parent_id: categoryData.parentId,
      is_default: categoryData.isDefault || false,
      is_deleted: false,
      is_synced: false,
      created_at: now,
      updated_at: now,
      user_id: userId,
      order: categoryData.order || 0,
    };
    
    // 创建分类模型
    const category = await CategoryModel.create(backendCategory);
    
    // 添加到同步队列
    await offlineSyncService.addToSyncQueue({
      entity_id: category._id,
      entity_type: 'category',
      operation: 'create',
      data: category.toJSON(),
      user_id: userId,
    });
    
    // 返回前端分类对象
    return toFrontendCategory(category);
  } catch (error) {
    logService.error('创建分类失败', error);
    throw error;
  }
};

/**
 * 更新分类
 * @param {string} categoryId 分类ID
 * @param {Object} categoryData 分类数据
 * @returns {Promise<Object>} 更新后的分类
 */
export const updateCategory = async (categoryId, categoryData) => {
  try {
    // 查找分类
    const category = await CategoryModel.findById(categoryId);
    
    if (!category) {
      throw new Error(`分类不存在: ${categoryId}`);
    }
    
    // 更新分类属性
    if (categoryData.name !== undefined) category.name = categoryData.name;
    if (categoryData.description !== undefined) category.description = categoryData.description;
    if (categoryData.color !== undefined) category.color = categoryData.color;
    if (categoryData.icon !== undefined) category.icon = categoryData.icon;
    if (categoryData.parentId !== undefined) category.parent_id = categoryData.parentId;
    if (categoryData.isDefault !== undefined) category.is_default = categoryData.isDefault;
    if (categoryData.order !== undefined) category.order = categoryData.order;
    
    // 更新时间
    category.updated_at = new Date();
    category.is_synced = false;
    
    // 保存分类
    await category.save();
    
    // 添加到同步队列
    await offlineSyncService.addToSyncQueue({
      entity_id: category._id,
      entity_type: 'category',
      operation: 'update',
      data: category.toJSON(),
      user_id: category.user_id,
    });
    
    // 返回前端分类对象
    return toFrontendCategory(category);
  } catch (error) {
    logService.error(`更新分类失败: ${categoryId}`, error);
    throw error;
  }
};

/**
 * 删除分类
 * @param {string} categoryId 分类ID
 * @param {boolean} permanent 是否永久删除
 * @returns {Promise<boolean>} 是否成功
 */
export const deleteCategory = async (categoryId, permanent = false) => {
  try {
    // 查找分类
    const category = await CategoryModel.findById(categoryId);
    
    if (!category) {
      throw new Error(`分类不存在: ${categoryId}`);
    }
    
    // 检查是否为默认分类
    if (category.is_default) {
      throw new Error('不能删除默认分类');
    }
    
    if (permanent) {
      // 永久删除
      await category.remove({ soft: false });
    } else {
      // 软删除
      category.is_deleted = true;
      category.is_synced = false;
      await category.save();
      
      // 添加到同步队列
      await offlineSyncService.addToSyncQueue({
        entity_id: category._id,
        entity_type: 'category',
        operation: 'update',
        data: category.toJSON(),
        user_id: category.user_id,
      });
    }
    
    return true;
  } catch (error) {
    logService.error(`删除分类失败: ${categoryId}`, error);
    throw error;
  }
};

/**
 * 获取分类列表
 * @param {string} userId 用户ID
 * @param {Object} options 选项
 * @returns {Promise<Array<Object>>} 分类列表
 */
export const getCategories = async (userId, options = {}) => {
  try {
    // 查找分类
    const categories = await CategoryModel.findByUser(userId, options);
    
    // 转换为前端分类对象
    return categories.map(toFrontendCategory);
  } catch (error) {
    logService.error('获取分类列表失败', error);
    throw error;
  }
};

/**
 * 获取分类详情
 * @param {string} categoryId 分类ID
 * @returns {Promise<Object>} 分类详情
 */
export const getCategoryById = async (categoryId) => {
  try {
    // 查找分类
    const category = await CategoryModel.findById(categoryId);
    
    if (!category) {
      throw new Error(`分类不存在: ${categoryId}`);
    }
    
    // 转换为前端分类对象
    return toFrontendCategory(category);
  } catch (error) {
    logService.error(`获取分类详情失败: ${categoryId}`, error);
    throw error;
  }
};

/**
 * 获取默认分类
 * @param {string} userId 用户ID
 * @returns {Promise<Object>} 默认分类
 */
export const getDefaultCategory = async (userId) => {
  try {
    // 查找默认分类
    const category = await CategoryModel.findDefault(userId);
    
    // 如果没有默认分类，创建一个
    if (!category) {
      return toFrontendCategory(await CategoryModel.createDefault(userId));
    }
    
    // 转换为前端分类对象
    return toFrontendCategory(category);
  } catch (error) {
    logService.error('获取默认分类失败', error);
    throw error;
  }
};

/**
 * 创建初始分类
 * @param {string} userId 用户ID
 * @returns {Promise<Array<Object>>} 分类列表
 */
export const createInitialCategories = async (userId) => {
  try {
    // 创建初始分类
    const categories = await CategoryModel.createInitialCategories(userId);
    
    // 转换为前端分类对象
    return categories.map(toFrontendCategory);
  } catch (error) {
    logService.error('创建初始分类失败', error);
    throw error;
  }
};

/**
 * 重新排序分类
 * @param {Array<Object>} categories 分类数组，包含id和order
 * @returns {Promise<boolean>} 是否成功
 */
export const reorderCategories = async (categories) => {
  try {
    // 重新排序分类
    await CategoryModel.reorder(categories);
    
    return true;
  } catch (error) {
    logService.error('重新排序分类失败', error);
    throw error;
  }
};
