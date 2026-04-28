/**
 * 分类模型适配器
 * 用于在前端和后端模型之间进行转换
 */

import { Category } from '../models';
import realmService from '../services/database/realmService';
import { logService } from '../utils/logService';
import { offlineSyncService } from '../services/offline/offlineSyncService';

/**
 * 将后端分类模型转换为前端分类对象
 * @param {Object} category 后端分类模型
 * @returns {Object} 前端分类对象
 */
export const toFrontendCategory = (category) => {
  if (!category) {return null;}

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
  if (!category) {return null;}

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
    const categoryId = realmService.createObjectId();

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

    // 使用 Realm 创建分类
    const realm = await realmService.getRealm();
    let category;
    realm.write(() => {
      category = realm.create('Category', backendCategory);
    });

    // 添加到同步队列
    await offlineSyncService.addToSyncQueue({
      entity_id: category._id,
      entity_type: 'category',
      operation: 'create',
      data: category.toJSON ? category.toJSON() : { ...backendCategory },
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
    // 使用 Realm 查找分类
    const realm = await realmService.getRealm();
    const category = realm.objectForPrimaryKey('Category', categoryId);

    if (!category) {
      throw new Error(`分类不存在: ${categoryId}`);
    }

    // 更新分类属性
    realm.write(() => {
      if (categoryData.name !== undefined) {category.name = categoryData.name;}
      if (categoryData.description !== undefined) {category.description = categoryData.description;}
      if (categoryData.color !== undefined) {category.color = categoryData.color;}
      if (categoryData.icon !== undefined) {category.icon = categoryData.icon;}
      if (categoryData.parentId !== undefined) {category.parent_id = categoryData.parentId;}
      if (categoryData.isDefault !== undefined) {category.is_default = categoryData.isDefault;}
      if (categoryData.order !== undefined) {category.order = categoryData.order;}


      // 更新时间
      category.updated_at = new Date();
      category.is_synced = false;
    });

    // 添加到同步队列
    await offlineSyncService.addToSyncQueue({
      entity_id: category._id,
      entity_type: 'category',
      operation: 'update',
      data: category.toJSON ? category.toJSON() : { ...category },
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
    // 使用 Realm 查找分类
    const realm = await realmService.getRealm();
    const category = realm.objectForPrimaryKey('Category', categoryId);

    if (!category) {
      throw new Error(`分类不存在: ${categoryId}`);
    }

    // 检查是否为默认分类
    if (category.is_default) {
      throw new Error('不能删除默认分类');
    }

    if (permanent) {
      // 永久删除
      realm.write(() => {
        realm.delete(category);
      });
    } else {
      // 软删除
      realm.write(() => {
        category.is_deleted = true;
        category.updated_at = new Date();
        category.is_synced = false;
      });

      // 添加到同步队列
      await offlineSyncService.addToSyncQueue({
        entity_id: category._id,
        entity_type: 'category',
        operation: 'update',
        data: category.toJSON ? category.toJSON() : { ...category },
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
    // 使用 Realm 查找分类
    const realm = await realmService.getRealm();
    let query = `user_id = "${userId}" AND is_deleted = false`;

    if (options.parent_id !== undefined) {
      query += options.parent_id ? ` AND parent_id = "${options.parent_id}"` : ' AND parent_id = nil';
    }

    let categories = realm.objects('Category').filtered(query);

    // 排序
    categories = categories.sorted('order', false); // 按order升序

    // 转换为前端分类对象
    return Array.from(categories).map(toFrontendCategory);
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
    // 使用 Realm 查找分类
    const realm = await realmService.getRealm();
    const category = realm.objectForPrimaryKey('Category', categoryId);

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
    // 使用 Realm 查找默认分类
    const realm = await realmService.getRealm();
    const categories = realm.objects('Category').filtered(`user_id = "${userId}" AND is_default = true AND is_deleted = false`);
    let category = categories.length > 0 ? categories[0] : null;

    // 如果没有默认分类，创建一个
    if (!category) {
      const now = new Date();
      const categoryId = realmService.createObjectId();

      realm.write(() => {
        category = realm.create('Category', {
          _id: categoryId,
          name: '默认分类',
          description: '默认分类',
          color: '#2196F3',
          icon: 'folder',
          parent_id: null,
          is_default: true,
          is_deleted: false,
          is_synced: false,
          created_at: now,
          updated_at: now,
          user_id: userId,
          order: 0,
        });
      });
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
    // 使用 Realm 创建初始分类
    const realm = await realmService.getRealm();
    const now = new Date();
    const initialCategories = [
      { name: '工作', description: '工作相关笔记', color: '#2196F3', icon: 'briefcase', order: 1 },
      { name: '学习', description: '学习相关笔记', color: '#4CAF50', icon: 'book', order: 2 },
      { name: '生活', description: '生活相关笔记', color: '#FF9800', icon: 'home', order: 3 },
      { name: '其他', description: '其他笔记', color: '#9E9E9E', icon: 'folder', order: 4 },
    ];

    const categories = [];
    realm.write(() => {
      for (const categoryData of initialCategories) {
        const categoryId = realmService.createObjectId();
        const category = realm.create('Category', {
          _id: categoryId,
          name: categoryData.name,
          description: categoryData.description,
          color: categoryData.color,
          icon: categoryData.icon,
          parent_id: null,
          is_default: false,
          is_deleted: false,
          is_synced: false,
          created_at: now,
          updated_at: now,
          user_id: userId,
          order: categoryData.order,
        });
        categories.push(category);
      }
    });

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
    // 使用 Realm 重新排序分类
    const realm = await realmService.getRealm();

    realm.write(() => {
      for (const categoryData of categories) {
        const category = realm.objectForPrimaryKey('Category', categoryData.id);
        if (category) {
          category.order = categoryData.order;
          category.updated_at = new Date();
        }
      }
    });

    return true;
  } catch (error) {
    logService.error('重新排序分类失败', error);
    throw error;
  }
};
