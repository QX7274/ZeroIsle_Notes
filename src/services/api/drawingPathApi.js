/**
 * 绘图路径API服务
 * 提供绘图路径相关的API调用
 */

import { instance } from './config';
import { API_ENDPOINTS } from '../../utils/constants';
import { offlineStorageService } from '../offlineStorage';

/**
 * 获取笔记的所有绘图路径
 * @param {string} noteId - 笔记ID
 * @returns {Promise} - 返回绘图路径列表
 */
export const getDrawingPathsByNote = async (noteId) => {
  try {
    // 检查网络状态
    const status = offlineStorageService.getStatus();
    
    if (!status.isOnline) {
      // 离线模式：从本地存储获取
      const paths = await offlineStorageService.getDrawingPaths(noteId);
      
      return {
        success: true,
        data: paths,
        fromCache: true
      };
    }
    
    // 在线模式：从服务器获取
    const response = await instance.get(`${API_ENDPOINTS.NOTES.DRAWING_PATHS}/by_note?note_id=${noteId}`);
    
    // 保存到本地存储
    await offlineStorageService.saveDrawingPaths(noteId, response.data);
    
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '获取绘图路径失败',
      error
    };
  }
};

/**
 * 获取画布的所有绘图路径
 * @param {string} canvasId - 画布ID
 * @returns {Promise} - 返回绘图路径列表
 */
export const getDrawingPathsByCanvas = async (canvasId) => {
  try {
    // 检查网络状态
    const status = offlineStorageService.getStatus();
    
    if (!status.isOnline) {
      // 离线模式：从本地存储获取
      const paths = await offlineStorageService.getDrawingPathsByCanvas(canvasId);
      
      return {
        success: true,
        data: paths,
        fromCache: true
      };
    }
    
    // 在线模式：从服务器获取
    const response = await instance.get(`${API_ENDPOINTS.NOTES.DRAWING_PATHS}/by_canvas?canvas_id=${canvasId}`);
    
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '获取画布绘图路径失败',
      error
    };
  }
};

/**
 * 创建绘图路径
 * @param {Object} pathData - 绘图路径数据
 * @returns {Promise} - 返回创建结果
 */
export const createDrawingPath = async (pathData) => {
  try {
    // 检查网络状态
    const status = offlineStorageService.getStatus();
    
    if (!status.isOnline) {
      // 离线模式：添加到待处理操作
      const tempId = Date.now().toString();
      const path = { ...pathData, id: tempId };
      
      await offlineStorageService.addPendingOperation({
        type: 'create_drawing_path',
        data: path,
        timestamp: new Date().toISOString()
      });
      
      // 添加到本地存储
      await offlineStorageService.addDrawingPath(path);
      
      return {
        success: true,
        data: path,
        fromCache: true
      };
    }
    
    // 在线模式：发送到服务器
    const response = await instance.post(API_ENDPOINTS.NOTES.DRAWING_PATHS, pathData);
    
    // 保存到本地存储
    await offlineStorageService.addDrawingPath(response.data);
    
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '创建绘图路径失败',
      error
    };
  }
};

/**
 * 更新绘图路径
 * @param {string} id - 绘图路径ID
 * @param {Object} pathData - 绘图路径数据
 * @returns {Promise} - 返回更新结果
 */
export const updateDrawingPath = async (id, pathData) => {
  try {
    // 检查网络状态
    const status = offlineStorageService.getStatus();
    
    if (!status.isOnline) {
      // 离线模式：添加到待处理操作
      await offlineStorageService.addPendingOperation({
        type: 'update_drawing_path',
        id,
        data: pathData,
        timestamp: new Date().toISOString()
      });
      
      // 更新本地存储
      await offlineStorageService.updateDrawingPath(id, pathData);
      
      return {
        success: true,
        data: { ...pathData, id },
        fromCache: true
      };
    }
    
    // 在线模式：发送到服务器
    const response = await instance.put(`${API_ENDPOINTS.NOTES.DRAWING_PATHS}/${id}`, pathData);
    
    // 更新本地存储
    await offlineStorageService.updateDrawingPath(id, response.data);
    
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '更新绘图路径失败',
      error
    };
  }
};

/**
 * 删除绘图路径
 * @param {string} id - 绘图路径ID
 * @returns {Promise} - 返回删除结果
 */
export const deleteDrawingPath = async (id) => {
  try {
    // 检查网络状态
    const status = offlineStorageService.getStatus();
    
    if (!status.isOnline) {
      // 离线模式：添加到待处理操作
      await offlineStorageService.addPendingOperation({
        type: 'delete_drawing_path',
        id,
        timestamp: new Date().toISOString()
      });
      
      // 从本地存储删除
      await offlineStorageService.deleteDrawingPath(id);
      
      return {
        success: true,
        fromCache: true
      };
    }
    
    // 在线模式：发送到服务器
    await instance.delete(`${API_ENDPOINTS.NOTES.DRAWING_PATHS}/${id}`);
    
    // 从本地存储删除
    await offlineStorageService.deleteDrawingPath(id);
    
    return {
      success: true
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '删除绘图路径失败',
      error
    };
  }
};

/**
 * 批量创建绘图路径
 * @param {Array} paths - 绘图路径数组
 * @returns {Promise} - 返回创建结果
 */
export const batchCreateDrawingPaths = async (paths) => {
  try {
    // 检查网络状态
    const status = offlineStorageService.getStatus();
    
    if (!status.isOnline) {
      // 离线模式：添加到待处理操作
      const pathsWithIds = paths.map(path => ({
        ...path,
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9)
      }));
      
      await offlineStorageService.addPendingOperation({
        type: 'batch_create_drawing_paths',
        data: pathsWithIds,
        timestamp: new Date().toISOString()
      });
      
      // 添加到本地存储
      await Promise.all(pathsWithIds.map(path => 
        offlineStorageService.addDrawingPath(path)
      ));
      
      return {
        success: true,
        data: pathsWithIds,
        fromCache: true
      };
    }
    
    // 在线模式：发送到服务器
    const response = await instance.post(`${API_ENDPOINTS.NOTES.DRAWING_PATHS}/batch_create`, { paths });
    
    // 保存到本地存储
    await Promise.all(response.data.created.map(path => 
      offlineStorageService.addDrawingPath(path)
    ));
    
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '批量创建绘图路径失败',
      error
    };
  }
};

/**
 * 批量删除绘图路径
 * @param {Array} pathIds - 绘图路径ID数组
 * @returns {Promise} - 返回删除结果
 */
export const batchDeleteDrawingPaths = async (pathIds) => {
  try {
    // 检查网络状态
    const status = offlineStorageService.getStatus();
    
    if (!status.isOnline) {
      // 离线模式：添加到待处理操作
      await offlineStorageService.addPendingOperation({
        type: 'batch_delete_drawing_paths',
        data: { path_ids: pathIds },
        timestamp: new Date().toISOString()
      });
      
      // 从本地存储删除
      await Promise.all(pathIds.map(id => 
        offlineStorageService.deleteDrawingPath(id)
      ));
      
      return {
        success: true,
        fromCache: true
      };
    }
    
    // 在线模式：发送到服务器
    const response = await instance.delete(`${API_ENDPOINTS.NOTES.DRAWING_PATHS}/batch_delete`, {
      data: { path_ids: pathIds }
    });
    
    // 从本地存储删除
    await Promise.all(pathIds.map(id => 
      offlineStorageService.deleteDrawingPath(id)
    ));
    
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '批量删除绘图路径失败',
      error
    };
  }
};

const drawingPathApi = {
  getDrawingPathsByNote,
  getDrawingPathsByCanvas,
  createDrawingPath,
  updateDrawingPath,
  deleteDrawingPath,
  batchCreateDrawingPaths,
  batchDeleteDrawingPaths
};

export default drawingPathApi;
