/**
 * 分类API服务
 * 提供分类相关的API操作
 */

import apiClient from './apiClient';
import { categoryAdapter } from '../../adapters';
import { networkService } from '../network/networkService';
import { logService } from '../utils/logService';

/**
 * 分类API服务
 */
const categoryApi = {
  /**
   * 获取分类列表
   * @param {Object} options 选项
   * @returns {Promise<Array>} 分类列表
   */
  async getCategories(options = {}) {
    try {
      // 检查网络连接
      if (!networkService.isOnline()) {
        // 使用适配器从本地获取分类
        const userId = options.userId || 'current_user';
        const categories = await categoryAdapter.getCategories(userId, options);
        return { data: categories, success: true, isOffline: true };
      }

      // 使用API客户端从服务器获取分类
      const response = await apiClient.get('/api/v1/categories/', { params: options });
      return response.data;
    } catch (error) {
      logService.error('获取分类列表失败', error);

      // 尝试从本地获取分类作为备份
      try {
        const userId = options.userId || 'current_user';
        const categories = await categoryAdapter.getCategories(userId, options);
        return { data: categories, success: true, isOffline: true };
      } catch (offlineError) {
        logService.error('从本地获取分类失败', offlineError);
        throw error;
      }
    }
  },

  /**
   * 创建分类
   * @param {Object} data 分类数据
   * @returns {Promise<Object>} 创建的分类
   */
  async createCategory(data) {
    try {
      // 检查网络连接
      if (!networkService.isOnline()) {
        // 使用适配器在本地创建分类
        const userId = data.userId || 'current_user';
        const category = await categoryAdapter.createCategory(data, userId);
        return { data: category, success: true, isOffline: true };
      }

      // 使用API客户端在服务器创建分类
      const response = await apiClient.post('/api/v1/categories/', data);

      // 同步到本地
      try {
        const userId = data.userId || 'current_user';
        await categoryAdapter.createCategory({
          ...response.data,
          _id: response.data.id,
          user_id: userId,
        }, userId);
      } catch (syncError) {
        logService.warn('同步分类到本地失败', syncError);
      }

      return response.data;
    } catch (error) {
      logService.error('创建分类失败', error);

      // 尝试在本地创建分类作为备份
      try {
        const userId = data.userId || 'current_user';
        const category = await categoryAdapter.createCategory(data, userId);
        return { data: category, success: true, isOffline: true };
      } catch (offlineError) {
        logService.error('在本地创建分类失败', offlineError);
        throw error;
      }
    }
  },

  /**
   * 更新分类
   * @param {string} id 分类ID
   * @param {Object} data 更新数据
   * @returns {Promise<Object>} 更新后的分类
   */
  async updateCategory(id, data) {
    try {
      // 检查网络连接
      if (!networkService.isOnline()) {
        // 使用适配器在本地更新分类
        const category = await categoryAdapter.updateCategory(id, data);
        return { data: category, success: true, isOffline: true };
      }

      // 使用API客户端在服务器更新分类
      const response = await apiClient.put(`/api/v1/categories/${id}/`, data);

      // 同步到本地
      try {
        await categoryAdapter.updateCategory(id, {
          ...response.data,
          _id: response.data.id,
        });
      } catch (syncError) {
        logService.warn('同步分类更新到本地失败', syncError);
      }

      return response.data;
    } catch (error) {
      logService.error(`更新分类(ID: ${id})失败`, error);

      // 尝试在本地更新分类作为备份
      try {
        const category = await categoryAdapter.updateCategory(id, data);
        return { data: category, success: true, isOffline: true };
      } catch (offlineError) {
        logService.error(`在本地更新分类(ID: ${id})失败`, offlineError);
        throw error;
      }
    }
  },

  /**
   * 删除分类
   * @param {string} id 分类ID
   * @returns {Promise<Object>} 删除结果
   */
  async deleteCategory(id) {
    try {
      // 检查网络连接
      if (!networkService.isOnline()) {
        // 使用适配器在本地删除分类
        await categoryAdapter.deleteCategory(id);
        return { success: true, isOffline: true };
      }

      // 使用API客户端在服务器删除分类
      const response = await apiClient.delete(`/api/v1/categories/${id}/`);

      // 同步到本地
      try {
        await categoryAdapter.deleteCategory(id);
      } catch (syncError) {
        logService.warn('同步分类删除到本地失败', syncError);
      }

      return response.data;
    } catch (error) {
      logService.error(`删除分类(ID: ${id})失败`, error);

      // 尝试在本地删除分类作为备份
      try {
        await categoryAdapter.deleteCategory(id);
        return { success: true, isOffline: true };
      } catch (offlineError) {
        logService.error(`在本地删除分类(ID: ${id})失败`, offlineError);
        throw error;
      }
    }
  },

  /**
   * 移动笔记到分类
   * @param {string} id 分类ID
   * @param {Array<string>} noteIds 笔记ID数组
   * @returns {Promise<Object>} 移动结果
   */
  async moveNotes(id, noteIds) {
    try {
      // 检查网络连接
      if (!networkService.isOnline()) {
        // 使用适配器在本地移动笔记
        const { noteAdapter } = require('../../adapters');
        for (const noteId of noteIds) {
          await noteAdapter.updateNote(noteId, { categoryId: id });
        }
        return { success: true, isOffline: true };
      }

      // 使用API客户端在服务器移动笔记
      const response = await apiClient.post(`/api/v1/categories/${id}/move_notes/`, { note_ids: noteIds });

      // 同步到本地
      try {
        const { noteAdapter } = require('../../adapters');
        for (const noteId of noteIds) {
          await noteAdapter.updateNote(noteId, { categoryId: id });
        }
      } catch (syncError) {
        logService.warn('同步笔记移动到本地失败', syncError);
      }

      return response.data;
    } catch (error) {
      logService.error(`移动笔记到分类(ID: ${id})失败`, error);

      // 尝试在本地移动笔记作为备份
      try {
        const { noteAdapter } = require('../../adapters');
        for (const noteId of noteIds) {
          await noteAdapter.updateNote(noteId, { categoryId: id });
        }
        return { success: true, isOffline: true };
      } catch (offlineError) {
        logService.error(`在本地移动笔记到分类(ID: ${id})失败`, offlineError);
        throw error;
      }
    }
  },

  /**
   * 获取分类详情
   * @param {string} id 分类ID
   * @returns {Promise<Object>} 分类详情
   */
  async getCategory(id) {
    try {
      // 检查网络连接
      if (!networkService.isOnline()) {
        // 使用适配器从本地获取分类
        const category = await categoryAdapter.getCategoryById(id);
        return { data: category, success: true, isOffline: true };
      }

      // 使用API客户端从服务器获取分类
      const response = await apiClient.get(`/api/v1/categories/${id}/`);
      return response.data;
    } catch (error) {
      logService.error(`获取分类(ID: ${id})详情失败`, error);

      // 尝试从本地获取分类作为备份
      try {
        const category = await categoryAdapter.getCategoryById(id);
        return { data: category, success: true, isOffline: true };
      } catch (offlineError) {
        logService.error(`从本地获取分类(ID: ${id})详情失败`, offlineError);
        throw error;
      }
    }
  },

  /**
   * 获取分类下的笔记
   * @param {string} id 分类ID
   * @param {Object} options 选项
   * @returns {Promise<Array>} 笔记列表
   */
  async getCategoryNotes(id, options = {}) {
    try {
      // 检查网络连接
      if (!networkService.isOnline()) {
        // 使用适配器从本地获取分类下的笔记
        const { noteAdapter } = require('../../adapters');
        const notes = await noteAdapter.getNotes('current_user', {
          categoryId: id,
          ...options
        });
        return { data: notes, success: true, isOffline: true };
      }

      // 使用API客户端从服务器获取分类下的笔记
      const response = await apiClient.get(`/api/v1/categories/${id}/notes/`, { params: options });
      return response.data;
    } catch (error) {
      logService.error(`获取分类(ID: ${id})下的笔记失败`, error);

      // 尝试从本地获取分类下的笔记作为备份
      try {
        const { noteAdapter } = require('../../adapters');
        const notes = await noteAdapter.getNotes('current_user', {
          categoryId: id,
          ...options
        });
        return { data: notes, success: true, isOffline: true };
      } catch (offlineError) {
        logService.error(`从本地获取分类(ID: ${id})下的笔记失败`, offlineError);
        throw error;
      }
    }
  },

  /**
   * 获取默认分类
   * @returns {Promise<Object>} 默认分类
   */
  async getDefaultCategory() {
    try {
      // 检查网络连接
      if (!networkService.isOnline()) {
        // 使用适配器从本地获取默认分类
        const category = await categoryAdapter.getDefaultCategory('current_user');
        return { data: category, success: true, isOffline: true };
      }

      // 使用API客户端从服务器获取默认分类
      const response = await apiClient.get('/api/v1/categories/default/');
      return response.data;
    } catch (error) {
      logService.error('获取默认分类失败', error);

      // 尝试从本地获取默认分类作为备份
      try {
        const category = await categoryAdapter.getDefaultCategory('current_user');
        return { data: category, success: true, isOffline: true };
      } catch (offlineError) {
        logService.error('从本地获取默认分类失败', offlineError);
        throw error;
      }
    }
  },

  /**
   * 获取分类统计
   * @returns {Promise<Object>} 分类统计
   */
  async getStatistics() {
    try {
      // 检查网络连接
      if (!networkService.isOnline()) {
        // 使用适配器从本地获取分类统计
        const categories = await categoryAdapter.getCategories('current_user');
        const stats = {
          total: categories.length,
          favorites: categories.filter(c => c.isFavorite).length,
          withNotes: 0, // 需要额外查询才能获取
          empty: 0, // 需要额外查询才能获取
        };
        return { data: stats, success: true, isOffline: true };
      }

      // 使用API客户端从服务器获取分类统计
      const response = await apiClient.get('/api/v1/categories/statistics/');
      return response.data;
    } catch (error) {
      logService.error('获取分类统计失败', error);

      // 尝试从本地获取分类统计作为备份
      try {
        const categories = await categoryAdapter.getCategories('current_user');
        const stats = {
          total: categories.length,
          favorites: categories.filter(c => c.isFavorite).length,
          withNotes: 0,
          empty: 0,
        };
        return { data: stats, success: true, isOffline: true };
      } catch (offlineError) {
        logService.error('从本地获取分类统计失败', offlineError);
        throw error;
      }
    }
  },

  /**
   * 获取分类树
   * @returns {Promise<Object>} 分类树
   */
  async getCategoryTree() {
    try {
      // 检查网络连接
      if (!networkService.isOnline()) {
        // 使用适配器从本地获取分类树
        const categories = await categoryAdapter.getCategories('current_user');

        // 构建树形结构
        const buildTree = (items, parentId = null) => {
          return items
            .filter(item => item.parentId === parentId)
            .map(item => ({
              ...item,
              children: buildTree(items, item.id)
            }));
        };

        const tree = buildTree(categories);

        return { data: tree, success: true, isOffline: true };
      }

      // 使用API客户端从服务器获取分类树
      const response = await apiClient.get('/api/v1/categories/tree/');
      return response.data;
    } catch (error) {
      logService.error('获取分类树失败', error);

      // 尝试从本地获取分类树作为备份
      try {
        const categories = await categoryAdapter.getCategories('current_user');

        // 构建树形结构
        const buildTree = (items, parentId = null) => {
          return items
            .filter(item => item.parentId === parentId)
            .map(item => ({
              ...item,
              children: buildTree(items, item.id)
            }));
        };

        const tree = buildTree(categories);

        return { data: tree, success: true, isOffline: true };
      } catch (offlineError) {
        logService.error('从本地获取分类树失败', offlineError);
        throw error;
      }
    }
  },

  /**
   * 合并分类
   * @param {string} id 源分类ID
   * @param {string} targetId 目标分类ID
   * @returns {Promise<Object>} 合并结果
   */
  async mergeCategories(id, targetId) {
    try {
      // 检查网络连接
      if (!networkService.isOnline()) {
        // 使用适配器在本地合并分类
        // 1. 获取源分类下的笔记
        const { noteAdapter } = require('../../adapters');
        const notes = await noteAdapter.getNotes('current_user', { categoryId: id });

        // 2. 将笔记移动到目标分类
        for (const note of notes) {
          await noteAdapter.updateNote(note.id, { categoryId: targetId });
        }

        // 3. 删除源分类
        await categoryAdapter.deleteCategory(id);

        return { success: true, isOffline: true };
      }

      // 使用API客户端在服务器合并分类
      const response = await apiClient.post(`/api/v1/categories/${id}/merge/`, { target_category_id: targetId });

      // 同步到本地
      try {
        // 1. 获取源分类下的笔记
        const { noteAdapter } = require('../../adapters');
        const notes = await noteAdapter.getNotes('current_user', { categoryId: id });

        // 2. 将笔记移动到目标分类
        for (const note of notes) {
          await noteAdapter.updateNote(note.id, { categoryId: targetId });
        }

        // 3. 删除源分类
        await categoryAdapter.deleteCategory(id);
      } catch (syncError) {
        logService.warn('同步分类合并到本地失败', syncError);
      }

      return response.data;
    } catch (error) {
      logService.error(`合并分类(ID: ${id})到分类(ID: ${targetId})失败`, error);

      // 尝试在本地合并分类作为备份
      try {
        // 1. 获取源分类下的笔记
        const { noteAdapter } = require('../../adapters');
        const notes = await noteAdapter.getNotes('current_user', { categoryId: id });

        // 2. 将笔记移动到目标分类
        for (const note of notes) {
          await noteAdapter.updateNote(note.id, { categoryId: targetId });
        }

        // 3. 删除源分类
        await categoryAdapter.deleteCategory(id);

        return { success: true, isOffline: true };
      } catch (offlineError) {
        logService.error(`在本地合并分类(ID: ${id})到分类(ID: ${targetId})失败`, offlineError);
        throw error;
      }
    }
  },

  /**
   * 批量分类
   * @param {Array<string>} noteIds 笔记ID数组
   * @param {string} categoryId 分类ID
   * @returns {Promise<Object>} 批量分类结果
   */
  async batchCategorize(noteIds, categoryId) {
    try {
      // 检查网络连接
      if (!networkService.isOnline()) {
        // 使用适配器在本地批量分类
        const { noteAdapter } = require('../../adapters');
        for (const noteId of noteIds) {
          await noteAdapter.updateNote(noteId, { categoryId });
        }
        return { success: true, isOffline: true };
      }

      // 使用API客户端在服务器批量分类
      const response = await apiClient.post('/api/v1/categories/batch/', {
        note_ids: noteIds,
        category_id: categoryId
      });

      // 同步到本地
      try {
        const { noteAdapter } = require('../../adapters');
        for (const noteId of noteIds) {
          await noteAdapter.updateNote(noteId, { categoryId });
        }
      } catch (syncError) {
        logService.warn('同步批量分类到本地失败', syncError);
      }

      return response.data;
    } catch (error) {
      logService.error('批量分类失败', error);

      // 尝试在本地批量分类作为备份
      try {
        const { noteAdapter } = require('../../adapters');
        for (const noteId of noteIds) {
          await noteAdapter.updateNote(noteId, { categoryId });
        }
        return { success: true, isOffline: true };
      } catch (offlineError) {
        logService.error('在本地批量分类失败', offlineError);
        throw error;
      }
    }
  }
};

export default categoryApi;