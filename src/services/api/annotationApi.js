/**
 * 注释API服务
 * 提供PDF注释相关的API调用
 */

import { instance } from './config';
import { API_ENDPOINTS } from '../../utils/constants';
import { offlineStorageService } from '../../services/offline/offlineStorage';

/**
 * 获取笔记的所有注释
 * @param {string} noteId - 笔记ID
 * @returns {Promise} - 返回注释列表
 */
export const getAnnotationsByNote = async (noteId) => {
  try {
    // 检查网络状态
    const status = offlineStorageService.getStatus();
    
    if (!status.isOnline) {
      // 离线模式：从本地存储获取
      const annotations = await offlineStorageService.getAnnotations(noteId);
      
      return {
        success: true,
        data: annotations,
        fromCache: true
      };
    }
    
    // 在线模式：从服务器获取
    const response = await instance.get(`${API_ENDPOINTS.NOTES.ANNOTATIONS}/by_note?note_id=${noteId}`);
    
    // 保存到本地存储
    await offlineStorageService.saveAnnotations(noteId, response.data);
    
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '获取注释失败',
      error
    };
  }
};

/**
 * 获取笔记特定页面的注释
 * @param {string} noteId - 笔记ID
 * @param {number} page - 页码
 * @returns {Promise} - 返回注释列表
 */
export const getAnnotationsByPage = async (noteId, page) => {
  try {
    // 检查网络状态
    const status = offlineStorageService.getStatus();
    
    if (!status.isOnline) {
      // 离线模式：从本地存储获取
      const annotations = await offlineStorageService.getAnnotations(noteId);
      const pageAnnotations = annotations.filter(annotation => annotation.page === page);
      
      return {
        success: true,
        data: pageAnnotations,
        fromCache: true
      };
    }
    
    // 在线模式：从服务器获取
    const response = await instance.get(`${API_ENDPOINTS.NOTES.ANNOTATIONS}/by_page?note_id=${noteId}&page=${page}`);
    
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '获取页面注释失败',
      error
    };
  }
};

/**
 * 创建注释
 * @param {Object} annotationData - 注释数据
 * @returns {Promise} - 返回创建结果
 */
export const createAnnotation = async (annotationData) => {
  try {
    // 检查网络状态
    const status = offlineStorageService.getStatus();
    
    if (!status.isOnline) {
      // 离线模式：添加到待处理操作
      const tempId = Date.now().toString();
      const annotation = { ...annotationData, id: tempId };
      
      await offlineStorageService.addPendingOperation({
        type: 'create_annotation',
        data: annotation,
        timestamp: new Date().toISOString()
      });
      
      // 添加到本地存储
      await offlineStorageService.addAnnotation(annotation);
      
      return {
        success: true,
        data: annotation,
        fromCache: true
      };
    }
    
    // 在线模式：发送到服务器
    const response = await instance.post(API_ENDPOINTS.NOTES.ANNOTATIONS, annotationData);
    
    // 保存到本地存储
    await offlineStorageService.addAnnotation(response.data);
    
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '创建注释失败',
      error
    };
  }
};

/**
 * 更新注释
 * @param {string} id - 注释ID
 * @param {Object} annotationData - 注释数据
 * @returns {Promise} - 返回更新结果
 */
export const updateAnnotation = async (id, annotationData) => {
  try {
    // 检查网络状态
    const status = offlineStorageService.getStatus();
    
    if (!status.isOnline) {
      // 离线模式：添加到待处理操作
      await offlineStorageService.addPendingOperation({
        type: 'update_annotation',
        id,
        data: annotationData,
        timestamp: new Date().toISOString()
      });
      
      // 更新本地存储
      await offlineStorageService.updateAnnotation(id, annotationData);
      
      return {
        success: true,
        data: { ...annotationData, id },
        fromCache: true
      };
    }
    
    // 在线模式：发送到服务器
    const response = await instance.put(`${API_ENDPOINTS.NOTES.ANNOTATIONS}/${id}`, annotationData);
    
    // 更新本地存储
    await offlineStorageService.updateAnnotation(id, response.data);
    
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '更新注释失败',
      error
    };
  }
};

/**
 * 删除注释
 * @param {string} id - 注释ID
 * @returns {Promise} - 返回删除结果
 */
export const deleteAnnotation = async (id) => {
  try {
    // 检查网络状态
    const status = offlineStorageService.getStatus();
    
    if (!status.isOnline) {
      // 离线模式：添加到待处理操作
      await offlineStorageService.addPendingOperation({
        type: 'delete_annotation',
        id,
        timestamp: new Date().toISOString()
      });
      
      // 从本地存储删除
      await offlineStorageService.deleteAnnotation(id);
      
      return {
        success: true,
        fromCache: true
      };
    }
    
    // 在线模式：发送到服务器
    await instance.delete(`${API_ENDPOINTS.NOTES.ANNOTATIONS}/${id}`);
    
    // 从本地存储删除
    await offlineStorageService.deleteAnnotation(id);
    
    return {
      success: true
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '删除注释失败',
      error
    };
  }
};

/**
 * 批量创建注释
 * @param {Array} annotations - 注释数组
 * @returns {Promise} - 返回创建结果
 */
export const batchCreateAnnotations = async (annotations) => {
  try {
    // 检查网络状态
    const status = offlineStorageService.getStatus();
    
    if (!status.isOnline) {
      // 离线模式：添加到待处理操作
      const annotationsWithIds = annotations.map(annotation => ({
        ...annotation,
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9)
      }));
      
      await offlineStorageService.addPendingOperation({
        type: 'batch_create_annotations',
        data: annotationsWithIds,
        timestamp: new Date().toISOString()
      });
      
      // 添加到本地存储
      await Promise.all(annotationsWithIds.map(annotation => 
        offlineStorageService.addAnnotation(annotation)
      ));
      
      return {
        success: true,
        data: annotationsWithIds,
        fromCache: true
      };
    }
    
    // 在线模式：发送到服务器
    const response = await instance.post(`${API_ENDPOINTS.NOTES.ANNOTATIONS}/batch`, { annotations });
    
    // 保存到本地存储
    await Promise.all(response.data.created.map(annotation => 
      offlineStorageService.addAnnotation(annotation)
    ));
    
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '批量创建注释失败',
      error
    };
  }
};

const annotationApi = {
  getAnnotationsByNote,
  getAnnotationsByPage,
  createAnnotation,
  updateAnnotation,
  deleteAnnotation,
  batchCreateAnnotations
};

export default annotationApi;
