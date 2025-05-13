/**
 * 文件API服务
 * 提供文件相关的API操作
 */

import apiClient from './apiClient';
import { fileAdapter } from '../../adapters';
import { networkService } from '../network/networkService';
import { logService } from '../utils/logService';

/**
 * 文件API服务
 */
const fileApi = {
  /**
   * 获取文件列表
   * @param {Object} options 选项
   * @returns {Promise<Array>} 文件列表
   */
  async getFiles(options = {}) {
    try {
      // 检查网络连接
      if (!networkService.isOnline()) {
        // 使用适配器从本地获取文件
        const userId = options.userId || 'current_user';
        const files = await fileAdapter.getFiles(userId, options);
        return { data: files, success: true, isOffline: true };
      }

      // 使用API客户端从服务器获取文件
      const response = await apiClient.get('/api/v1/files/', { params: options });
      return response.data;
    } catch (error) {
      logService.error('获取文件列表失败', error);
      
      // 尝试从本地获取文件作为备份
      try {
        const userId = options.userId || 'current_user';
        const files = await fileAdapter.getFiles(userId, options);
        return { data: files, success: true, isOffline: true };
      } catch (offlineError) {
        logService.error('从本地获取文件失败', offlineError);
        throw error;
      }
    }
  },
  
  /**
   * 获取文件详情
   * @param {string} id 文件ID
   * @returns {Promise<Object>} 文件详情
   */
  async getFile(id) {
    try {
      // 检查网络连接
      if (!networkService.isOnline()) {
        // 使用适配器从本地获取文件
        const file = await fileAdapter.getFileById(id);
        return { data: file, success: true, isOffline: true };
      }

      // 使用API客户端从服务器获取文件
      const response = await apiClient.get(`/api/v1/files/${id}/`);
      return response.data;
    } catch (error) {
      logService.error(`获取文件(ID: ${id})详情失败`, error);
      
      // 尝试从本地获取文件作为备份
      try {
        const file = await fileAdapter.getFileById(id);
        return { data: file, success: true, isOffline: true };
      } catch (offlineError) {
        logService.error(`从本地获取文件(ID: ${id})详情失败`, offlineError);
        throw error;
      }
    }
  },
  
  /**
   * 上传文件
   * @param {Object} data 文件数据
   * @returns {Promise<Object>} 上传结果
   */
  async uploadFile(data) {
    try {
      // 检查网络连接
      if (!networkService.isOnline()) {
        // 使用适配器在本地保存文件
        const userId = data.userId || 'current_user';
        const file = await fileAdapter.createFile(data, userId);
        return { data: file, success: true, isOffline: true };
      }

      // 创建FormData
      const formData = new FormData();
      
      // 添加文件
      if (data.file) {
        formData.append('file', data.file);
      }
      
      // 添加其他数据
      if (data.name) formData.append('name', data.name);
      if (data.noteId) formData.append('note_id', data.noteId);
      if (data.type) formData.append('type', data.type);
      if (data.tags) formData.append('tags', JSON.stringify(data.tags));
      
      // 使用API客户端上传文件
      const response = await apiClient.post('/api/v1/files/upload/', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      // 同步到本地
      try {
        const userId = data.userId || 'current_user';
        await fileAdapter.createFile({
          ...response.data,
          _id: response.data.id,
          user_id: userId,
        }, userId);
      } catch (syncError) {
        logService.warn('同步文件到本地失败', syncError);
      }
      
      return response.data;
    } catch (error) {
      logService.error('上传文件失败', error);
      
      // 尝试在本地保存文件作为备份
      try {
        const userId = data.userId || 'current_user';
        const file = await fileAdapter.createFile(data, userId);
        return { data: file, success: true, isOffline: true };
      } catch (offlineError) {
        logService.error('在本地保存文件失败', offlineError);
        throw error;
      }
    }
  },
  
  /**
   * 更新文件
   * @param {string} id 文件ID
   * @param {Object} data 更新数据
   * @returns {Promise<Object>} 更新后的文件
   */
  async updateFile(id, data) {
    try {
      // 检查网络连接
      if (!networkService.isOnline()) {
        // 使用适配器在本地更新文件
        const file = await fileAdapter.updateFile(id, data);
        return { data: file, success: true, isOffline: true };
      }

      // 使用API客户端更新文件
      const response = await apiClient.put(`/api/v1/files/${id}/`, data);
      
      // 同步到本地
      try {
        await fileAdapter.updateFile(id, {
          ...response.data,
          _id: response.data.id,
        });
      } catch (syncError) {
        logService.warn('同步文件更新到本地失败', syncError);
      }
      
      return response.data;
    } catch (error) {
      logService.error(`更新文件(ID: ${id})失败`, error);
      
      // 尝试在本地更新文件作为备份
      try {
        const file = await fileAdapter.updateFile(id, data);
        return { data: file, success: true, isOffline: true };
      } catch (offlineError) {
        logService.error(`在本地更新文件(ID: ${id})失败`, offlineError);
        throw error;
      }
    }
  },
  
  /**
   * 删除文件
   * @param {string} id 文件ID
   * @returns {Promise<Object>} 删除结果
   */
  async deleteFile(id) {
    try {
      // 检查网络连接
      if (!networkService.isOnline()) {
        // 使用适配器在本地删除文件
        await fileAdapter.deleteFile(id);
        return { success: true, isOffline: true };
      }

      // 使用API客户端删除文件
      const response = await apiClient.delete(`/api/v1/files/${id}/`);
      
      // 同步到本地
      try {
        await fileAdapter.deleteFile(id);
      } catch (syncError) {
        logService.warn('同步文件删除到本地失败', syncError);
      }
      
      return response.data;
    } catch (error) {
      logService.error(`删除文件(ID: ${id})失败`, error);
      
      // 尝试在本地删除文件作为备份
      try {
        await fileAdapter.deleteFile(id);
        return { success: true, isOffline: true };
      } catch (offlineError) {
        logService.error(`在本地删除文件(ID: ${id})失败`, offlineError);
        throw error;
      }
    }
  },
  
  /**
   * 下载文件
   * @param {string} id 文件ID
   * @returns {Promise<Object>} 下载结果
   */
  async downloadFile(id) {
    try {
      // 检查网络连接
      if (!networkService.isOnline()) {
        // 使用适配器从本地获取文件
        const file = await fileAdapter.getFileById(id);
        
        if (!file || !file.path) {
          throw new Error('文件不存在或路径无效');
        }
        
        return { data: { path: file.path }, success: true, isOffline: true };
      }

      // 使用API客户端下载文件
      const response = await apiClient.get(`/api/v1/files/${id}/download/`, {
        responseType: 'blob',
      });
      
      return response.data;
    } catch (error) {
      logService.error(`下载文件(ID: ${id})失败`, error);
      
      // 尝试从本地获取文件作为备份
      try {
        const file = await fileAdapter.getFileById(id);
        
        if (!file || !file.path) {
          throw new Error('文件不存在或路径无效');
        }
        
        return { data: { path: file.path }, success: true, isOffline: true };
      } catch (offlineError) {
        logService.error(`从本地获取文件(ID: ${id})失败`, offlineError);
        throw error;
      }
    }
  },
  
  /**
   * 获取笔记的文件
   * @param {string} noteId 笔记ID
   * @returns {Promise<Array>} 文件列表
   */
  async getNoteFiles(noteId) {
    try {
      // 检查网络连接
      if (!networkService.isOnline()) {
        // 使用适配器从本地获取笔记的文件
        const files = await fileAdapter.findByNote(noteId);
        return { data: files, success: true, isOffline: true };
      }

      // 使用API客户端从服务器获取笔记的文件
      const response = await apiClient.get(`/api/v1/notes/${noteId}/files/`);
      return response.data;
    } catch (error) {
      logService.error(`获取笔记(ID: ${noteId})的文件失败`, error);
      
      // 尝试从本地获取笔记的文件作为备份
      try {
        const files = await fileAdapter.findByNote(noteId);
        return { data: files, success: true, isOffline: true };
      } catch (offlineError) {
        logService.error(`从本地获取笔记(ID: ${noteId})的文件失败`, offlineError);
        throw error;
      }
    }
  }
};

export default fileApi;
