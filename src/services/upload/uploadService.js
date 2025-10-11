/**
 * 上传服务
 * 提供数据上传功能
 */

import realmService from '../database/realmService';
import { logService } from '../../utils/logService';
import { networkService } from '../network/networkService';
import STORAGE_KEYS from '../../constants/storageKeys';
import { API_ENDPOINTS } from '../../config/api';
import axios from 'axios';
import { Platform } from 'react-native';
import RNFS from 'react-native-fs';

class UploadService {
  constructor() {
    this.initialized = false;
    this.initializationPromise = null;
    this.apiClient = null;
    this.uploadQueue = [];
    this.isUploading = false;
  }

  /**
   * 初始化上传服务
   */
  async initialize() {
    if (this.initialized) return Promise.resolve();

    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = new Promise(async (resolve, reject) => {
      try {
        // 创建API客户端
        this.apiClient = axios.create({
          baseURL: API_ENDPOINTS.BASE_URL,
          timeout: 30000, // 上传可能需要更长时间
        });

        // 加载上传队列
        await this.loadUploadQueue();

        this.initialized = true;
        logService.info('上传服务初始化成功');
        resolve();
      } catch (error) {
        logService.error('上传服务初始化失败', error);
        reject(error);
      }
    });

    return this.initializationPromise;
  }

  /**
   * 加载上传队列
   * @private
   */
  async loadUploadQueue() {
    try {
      // 从存储中获取上传队列
      const realm = await realmService.getRealm();
      const item = realm.objects('StorageItem').filtered(`key = "${STORAGE_KEYS.UPLOAD_QUEUE}"`);
      const queue = item.length > 0 ? JSON.parse(item[0].value) : [];
      this.uploadQueue = queue || [];
    } catch (error) {
      logService.error('加载上传队列失败', error);
      this.uploadQueue = [];
    }
  }

  /**
   * 保存上传队列
   * @private
   */
  async saveUploadQueue() {
    try {
      const realm = await realmService.getRealm();
      realm.write(() => {
        const existingItem = realm.objects('StorageItem').filtered(`key = "${STORAGE_KEYS.UPLOAD_QUEUE}"`);
        if (existingItem.length > 0) {
          existingItem[0].value = JSON.stringify(this.uploadQueue);
          existingItem[0].updated_at = new Date();
        } else {
          realm.create('StorageItem', {
            key: STORAGE_KEYS.UPLOAD_QUEUE,
            value: JSON.stringify(this.uploadQueue),
            createdAt: new Date(),
            updated_at: new Date(),
          });
        }
      });
    } catch (error) {
      logService.error('保存上传队列失败', error);
    }
  }

  /**
   * 上传数据
   * @param {string} collection 集合名称
   * @param {string} id 记录ID
   * @param {Object} data 数据
   * @param {boolean} immediate 是否立即上传
   * @returns {Promise<Object>} 上传结果
   */
  async uploadData(collection, id, data, immediate = true) {
    await this.initialize();

    // 创建上传项
    const uploadItem = {
      id: `${collection}_${id}_${Date.now()}`,
      collection,
      recordId: id,
      data,
      timestamp: new Date().toISOString(),
      retryCount: 0,
      status: 'pending'
    };

    // 添加到上传队列
    this.uploadQueue.push(uploadItem);
    await this.saveUploadQueue();

    // 如果要求立即上传且在线，立即处理
    if (immediate && networkService.isOnline() && !this.isUploading) {
      return this.processUploadQueue();
    }

    return { 
      success: true, 
      message: '数据已添加到上传队列',
      queueId: uploadItem.id
    };
  }

  /**
   * 上传文件
   * @param {string} filePath 文件路径
   * @param {string} collection 集合名称
   * @param {string} id 记录ID
   * @param {Object} metadata 元数据
   * @param {Function} onProgress 进度回调
   * @returns {Promise<Object>} 上传结果
   */
  async uploadFile(filePath, collection, id, metadata = {}, onProgress = null) {
    await this.initialize();

    if (!networkService.isOnline()) {
      // 添加到上传队列
      const uploadItem = {
        id: `file_${collection}_${id}_${Date.now()}`,
        type: 'file',
        collection,
        recordId: id,
        filePath,
        metadata,
        timestamp: new Date().toISOString(),
        retryCount: 0,
        status: 'pending'
      };

      this.uploadQueue.push(uploadItem);
      await this.saveUploadQueue();

      return { 
        success: true, 
        message: '文件已添加到上传队列',
        queueId: uploadItem.id
      };
    }

    try {
      // 获取认证令牌
      const realm = await realmService.getRealm();
      const item = realm.objects('StorageItem').filtered(`key = "${STORAGE_KEYS.AUTH_TOKEN}"`);
      const token = item.length > 0 ? item[0].value : null;
      
      if (!token) {
        return { success: false, message: '未登录，无法上传文件' };
      }

      // 检查文件是否存在
      const fileExists = await RNFS.exists(filePath);
      if (!fileExists) {
        return { success: false, message: '文件不存在' };
      }

      // 创建FormData
      const formData = new FormData();
      
      // 添加文件
      const fileStats = await RNFS.stat(filePath);
      const fileName = filePath.split('/').pop();
      
      formData.append('file', {
        uri: Platform.OS === 'android' ? filePath : `file://${filePath}`,
        name: fileName,
        type: metadata.mimeType || 'application/octet-stream',
        size: fileStats.size
      });
      
      // 添加元数据
      Object.keys(metadata).forEach(key => {
        formData.append(key, metadata[key]);
      });
      
      // 添加集合和ID
      formData.append('collection', collection);
      formData.append('recordId', id);

      // 上传文件
      const response = await this.apiClient.post(`/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
          'Authorization': `Bearer ${token}`
        },
        onUploadProgress: onProgress ? (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          onProgress(percentCompleted);
        } : undefined
      });

      return { success: true, data: response.data };
    } catch (error) {
      logService.error(`上传文件失败: ${filePath}`, error);
      
      // 添加到上传队列
      const uploadItem = {
        id: `file_${collection}_${id}_${Date.now()}`,
        type: 'file',
        collection,
        recordId: id,
        filePath,
        metadata,
        timestamp: new Date().toISOString(),
        retryCount: 0,
        status: 'failed',
        error: error.message
      };

      this.uploadQueue.push(uploadItem);
      await this.saveUploadQueue();
      
      return { 
        success: false, 
        message: error.response?.data?.message || '上传文件失败',
        error,
        queueId: uploadItem.id
      };
    }
  }

  /**
   * 处理上传队列
   * @returns {Promise<Object>} 处理结果
   */
  async processUploadQueue() {
    if (!networkService.isOnline() || this.isUploading || this.uploadQueue.length === 0) {
      return { 
        success: false, 
        message: !networkService.isOnline() ? '离线状态无法上传' : 
                 this.isUploading ? '上传已在进行中' : '上传队列为空'
      };
    }

    try {
      this.isUploading = true;
      logService.info(`开始处理上传队列，共 ${this.uploadQueue.length} 项`);

      const results = {
        success: true,
        total: this.uploadQueue.length,
        succeeded: 0,
        failed: 0,
        items: []
      };

      // 获取认证令牌
      const realm = await realmService.getRealm();
      const item = realm.objects('StorageItem').filtered(`key = "${STORAGE_KEYS.AUTH_TOKEN}"`);
      const token = item.length > 0 ? item[0].value : null;
      
      if (!token) {
        this.isUploading = false;
        return { success: false, message: '未登录，无法上传数据' };
      }

      // 处理队列中的每一项
      const newQueue = [];
      
      for (const item of this.uploadQueue) {
        try {
          if (item.type === 'file') {
            // 处理文件上传
            const fileExists = await RNFS.exists(item.filePath);
            if (!fileExists) {
              results.failed++;
              results.items.push({
                id: item.id,
                success: false,
                message: '文件不存在'
              });
              continue;
            }

            // 创建FormData
            const formData = new FormData();
            
            // 添加文件
            const fileStats = await RNFS.stat(item.filePath);
            const fileName = item.filePath.split('/').pop();
            
            formData.append('file', {
              uri: Platform.OS === 'android' ? item.filePath : `file://${item.filePath}`,
              name: fileName,
              type: item.metadata.mimeType || 'application/octet-stream',
              size: fileStats.size
            });
            
            // 添加元数据
            Object.keys(item.metadata || {}).forEach(key => {
              formData.append(key, item.metadata[key]);
            });
            
            // 添加集合和ID
            formData.append('collection', item.collection);
            formData.append('recordId', item.recordId);

            // 上传文件
            await this.apiClient.post(`/upload`, formData, {
              headers: {
                'Content-Type': 'multipart/form-data',
                'Authorization': `Bearer ${token}`
              }
            });
          } else {
            // 处理数据上传
            await this.apiClient.post(`/${item.collection}/${item.recordId}/upload`, item.data, {
              headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
              }
            });
          }

          // 上传成功
          results.succeeded++;
          results.items.push({
            id: item.id,
            success: true
          });
        } catch (error) {
          // 上传失败，增加重试次数
          item.retryCount = (item.retryCount || 0) + 1;
          item.status = 'failed';
          item.error = error.message;
          
          // 如果重试次数小于3，保留在队列中
          if (item.retryCount < 3) {
            newQueue.push(item);
          }
          
          results.failed++;
          results.items.push({
            id: item.id,
            success: false,
            message: error.response?.data?.message || '上传失败',
            error: error.message
          });
          
          logService.error(`上传项 ${item.id} 失败`, error);
        }
      }

      // 更新上传队列
      this.uploadQueue = newQueue;
      await this.saveUploadQueue();

      this.isUploading = false;
      return results;
    } catch (error) {
      logService.error('处理上传队列失败', error);
      this.isUploading = false;
      return { 
        success: false, 
        message: '处理上传队列失败',
        error: error.message
      };
    }
  }

  /**
   * 获取上传队列
   * @returns {Promise<Array>} 上传队列
   */
  async getUploadQueue() {
    await this.initialize();
    return [...this.uploadQueue];
  }

  /**
   * 清空上传队列
   * @returns {Promise<boolean>} 是否成功
   */
  async clearUploadQueue() {
    await this.initialize();
    this.uploadQueue = [];
    await this.saveUploadQueue();
    return true;
  }

  /**
   * 从上传队列中移除项目
   * @param {string} id 上传项ID
   * @returns {Promise<boolean>} 是否成功
   */
  async removeFromUploadQueue(id) {
    await this.initialize();
    const index = this.uploadQueue.findIndex(item => item.id === id);
    if (index !== -1) {
      this.uploadQueue.splice(index, 1);
      await this.saveUploadQueue();
      return true;
    }
    return false;
  }
}

// 创建单例实例
const uploadService = new UploadService();

// 初始化
uploadService.initialize().catch(error => {
  logService.error('初始化上传服务失败', error);
});

export default uploadService;
