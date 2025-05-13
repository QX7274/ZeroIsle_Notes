/**
 * 标签API服务
 * 提供标签相关的API操作
 */

import api from './apiClient';
import { tagAdapter } from '../../adapters';
import { networkService } from '../network/networkService';
import { logService } from '../utils/logService';

/**
 * 标签API服务
 */
const tagApi = {
  /**
   * 获取标签列表
   * @param {Object} options 选项
   * @returns {Promise<Array>} 标签列表
   */
  async getTags(options = {}) {
    try {
      // 检查网络连接
      if (!networkService.isOnline()) {
        // 使用适配器从本地获取标签
        const userId = options.userId || 'current_user';
        const tags = await tagAdapter.getTags(userId, options);
        return { data: tags, success: true };
      }

      // 使用API客户端从服务器获取标签
      const response = await api.get('/api/v1/tags/', { params: options });
      return response.data;
    } catch (error) {
      logService.error('获取标签列表失败', error);

      // 尝试从本地获取标签作为备份
      try {
        const userId = options.userId || 'current_user';
        const tags = await tagAdapter.getTags(userId, options);
        return { data: tags, success: true, isOffline: true };
      } catch (offlineError) {
        logService.error('从本地获取标签失败', offlineError);
        throw error;
      }
    }
  },

  /**
   * 创建标签
   * @param {Object} data 标签数据
   * @returns {Promise<Object>} 创建的标签
   */
  async createTag(data) {
    try {
      // 检查网络连接
      if (!networkService.isOnline()) {
        // 使用适配器在本地创建标签
        const userId = data.userId || 'current_user';
        const tag = await tagAdapter.createTag(data, userId);
        return { data: tag, success: true, isOffline: true };
      }

      // 使用API客户端在服务器创建标签
      const response = await api.post('/api/v1/tags/', data);

      // 同步到本地
      try {
        const userId = data.userId || 'current_user';
        await tagAdapter.findOrCreateTag(response.data.name, userId, {
          color: response.data.color,
          _id: response.data.id
        });
      } catch (syncError) {
        logService.warn('同步标签到本地失败', syncError);
      }

      return response.data;
    } catch (error) {
      logService.error('创建标签失败', error);

      // 尝试在本地创建标签作为备份
      try {
        const userId = data.userId || 'current_user';
        const tag = await tagAdapter.createTag(data, userId);
        return { data: tag, success: true, isOffline: true };
      } catch (offlineError) {
        logService.error('在本地创建标签失败', offlineError);
        throw error;
      }
    }
  },

  /**
   * 更新标签
   * @param {string} id 标签ID
   * @param {Object} data 更新数据
   * @returns {Promise<Object>} 更新后的标签
   */
  async updateTag(id, data) {
    try {
      // 检查网络连接
      if (!networkService.isOnline()) {
        // 使用适配器在本地更新标签
        const tag = await tagAdapter.updateTag(id, data);
        return { data: tag, success: true, isOffline: true };
      }

      // 使用API客户端在服务器更新标签
      const response = await api.put(`/api/v1/tags/${id}/`, data);

      // 同步到本地
      try {
        await tagAdapter.updateTag(id, {
          name: response.data.name,
          color: response.data.color
        });
      } catch (syncError) {
        logService.warn('同步标签更新到本地失败', syncError);
      }

      return response.data;
    } catch (error) {
      logService.error(`更新标签(ID: ${id})失败`, error);

      // 尝试在本地更新标签作为备份
      try {
        const tag = await tagAdapter.updateTag(id, data);
        return { data: tag, success: true, isOffline: true };
      } catch (offlineError) {
        logService.error(`在本地更新标签(ID: ${id})失败`, offlineError);
        throw error;
      }
    }
  },

  /**
   * 删除标签
   * @param {string} id 标签ID
   * @returns {Promise<Object>} 删除结果
   */
  async deleteTag(id) {
    try {
      // 检查网络连接
      if (!networkService.isOnline()) {
        // 使用适配器在本地删除标签
        await tagAdapter.deleteTag(id);
        return { success: true, isOffline: true };
      }

      // 使用API客户端在服务器删除标签
      const response = await api.delete(`/api/v1/tags/${id}/`);

      // 同步到本地
      try {
        await tagAdapter.deleteTag(id);
      } catch (syncError) {
        logService.warn('同步标签删除到本地失败', syncError);
      }

      return response.data;
    } catch (error) {
      logService.error(`删除标签(ID: ${id})失败`, error);

      // 尝试在本地删除标签作为备份
      try {
        await tagAdapter.deleteTag(id);
        return { success: true, isOffline: true };
      } catch (offlineError) {
        logService.error(`在本地删除标签(ID: ${id})失败`, offlineError);
        throw error;
      }
    }
  },

  /**
   * 获取标签下的笔记
   * @param {string} id 标签ID
   * @param {Object} options 选项
   * @returns {Promise<Array>} 笔记列表
   */
  async getTagNotes(id, options = {}) {
    try {
      // 检查网络连接
      if (!networkService.isOnline()) {
        // 使用适配器从本地获取标签下的笔记
        const { noteAdapter } = require('../../adapters');
        const notes = await noteAdapter.getNotes('current_user', {
          tags: [id],
          ...options
        });
        return { data: notes, success: true, isOffline: true };
      }

      // 使用API客户端从服务器获取标签下的笔记
      const response = await api.get(`/api/v1/tags/${id}/notes/`, { params: options });
      return response.data;
    } catch (error) {
      logService.error(`获取标签(ID: ${id})下的笔记失败`, error);

      // 尝试从本地获取标签下的笔记作为备份
      try {
        const { noteAdapter } = require('../../adapters');
        const notes = await noteAdapter.getNotes('current_user', {
          tags: [id],
          ...options
        });
        return { data: notes, success: true, isOffline: true };
      } catch (offlineError) {
        logService.error(`从本地获取标签(ID: ${id})下的笔记失败`, offlineError);
        throw error;
      }
    }
  },

  /**
   * 获取标签统计
   * @returns {Promise<Object>} 标签统计
   */
  async getStatistics() {
    try {
      // 检查网络连接
      if (!networkService.isOnline()) {
        // 使用适配器从本地获取标签统计
        const userId = 'current_user';
        const tags = await tagAdapter.getPopularTags(userId, 20);
        return { data: { tags, total: tags.length }, success: true, isOffline: true };
      }

      // 使用API客户端从服务器获取标签统计
      const response = await api.get('/api/v1/tags/statistics/');
      return response.data;
    } catch (error) {
      logService.error('获取标签统计失败', error);

      // 尝试从本地获取标签统计作为备份
      try {
        const userId = 'current_user';
        const tags = await tagAdapter.getPopularTags(userId, 20);
        return { data: { tags, total: tags.length }, success: true, isOffline: true };
      } catch (offlineError) {
        logService.error('从本地获取标签统计失败', offlineError);
        throw error;
      }
    }
  },

  /**
   * 搜索标签
   * @param {string} query 搜索关键词
   * @returns {Promise<Array>} 标签列表
   */
  async searchTags(query) {
    try {
      // 检查网络连接
      if (!networkService.isOnline()) {
        // 使用适配器从本地搜索标签
        const userId = 'current_user';
        const tags = await tagAdapter.getTags(userId, { search: query });
        return { data: tags, success: true, isOffline: true };
      }

      // 使用API客户端从服务器搜索标签
      const response = await api.get('/api/v1/tags/search/', { params: { q: query } });
      return response.data;
    } catch (error) {
      logService.error(`搜索标签(关键词: ${query})失败`, error);

      // 尝试从本地搜索标签作为备份
      try {
        const userId = 'current_user';
        const tags = await tagAdapter.getTags(userId, { search: query });
        return { data: tags, success: true, isOffline: true };
      } catch (offlineError) {
        logService.error(`从本地搜索标签(关键词: ${query})失败`, offlineError);
        throw error;
      }
    }
  },

  /**
   * 批量创建标签
   * @param {Array<string>} names 标签名称数组
   * @returns {Promise<Array>} 创建的标签数组
   */
  async createBatchTags(names) {
    try {
      // 检查网络连接
      if (!networkService.isOnline()) {
        // 使用适配器在本地批量创建标签
        const userId = 'current_user';
        const tags = await tagAdapter.createBatchTags(names, userId);
        return { data: tags, success: true, isOffline: true };
      }

      // 使用API客户端在服务器批量创建标签
      const response = await api.post('/api/v1/tags/batch/', { names });

      // 同步到本地
      try {
        const userId = 'current_user';
        await tagAdapter.createBatchTags(names, userId);
      } catch (syncError) {
        logService.warn('同步批量标签到本地失败', syncError);
      }

      return response.data;
    } catch (error) {
      logService.error('批量创建标签失败', error);

      // 尝试在本地批量创建标签作为备份
      try {
        const userId = 'current_user';
        const tags = await tagAdapter.createBatchTags(names, userId);
        return { data: tags, success: true, isOffline: true };
      } catch (offlineError) {
        logService.error('在本地批量创建标签失败', offlineError);
        throw error;
      }
    }
  }
};

export default tagApi;