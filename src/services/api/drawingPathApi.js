/**
 * 绘图路径API服务
 * 提供绘图路径相关的API调用
 */

import { instance } from './config';
import { API_ENDPOINTS } from '../../utils/constants';
import realmService from '../database/realmService';
import networkService from '../network/networkService';

/**
 * 获取笔记的所有绘图路径
 * @param {string} noteId - 笔记ID
 * @returns {Promise} - 返回绘图路径列表
 */
export const getDrawingPathsByNote = async (noteId) => {
  try {
    // 检查网络状态
    const status = await networkService.checkConnectionState();

    if (!status?.isOnline) {
      throw new Error('离线模式下无法获取笔记绘图路径，请连接网络后重试');
    }

    // 在线模式：从服务器获取
    const response = await instance.get(`${API_ENDPOINTS.NOTES.DRAWING_PATHS}/by_note?note_id=${noteId}`);

    // 保存到本地存储
    const realm = await realmService.getRealm();
    realm.write(() => {
      const existingItem = realm.objects('StorageItem').filtered(`key = "drawing_paths_${noteId}"`);
      if (existingItem.length > 0) {
        existingItem[0].value = JSON.stringify(response.data);
        existingItem[0].updated_at = new Date();
      } else {
        realm.create('StorageItem', {
          key: `drawing_paths_${noteId}`,
          value: JSON.stringify(response.data),
          createdAt: new Date(),
          updated_at: new Date(),
        });
      }
    });

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    throw error;
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
    const status = await networkService.checkConnectionState();

    if (!status?.isOnline) {
      throw new Error('离线模式下无法获取画布绘图路径，请连接网络后重试');
    }

    // 在线模式：从服务器获取
    const response = await instance.get(`${API_ENDPOINTS.NOTES.DRAWING_PATHS}/by_canvas?canvas_id=${canvasId}`);

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    throw error;
  }
};

/**
 * 创建绘图路径
 * @param {Object} pathData - 绘图路径数据
 * @returns {Promise} - 返回创建结果
 */
export const createDrawingPath = async (pathData) => {
  try {
    const status = await networkService.checkConnectionState();
    if (!status?.isOnline) {
      throw new Error('离线模式下无法创建绘图路径，请连接网络后重试');
    }

    const response = await instance.post(API_ENDPOINTS.NOTES.DRAWING_PATHS, pathData);

    const noteId = pathData?.note_id || pathData?.noteId;
    if (noteId) {
      const realm = await realmService.getRealm();
      realm.write(() => {
        const existingItem = realm.objects('StorageItem').filtered(`key = "drawing_paths_${noteId}"`);
        const paths = existingItem.length > 0 ? JSON.parse(existingItem[0].value) : [];
        paths.push(response.data);
        if (existingItem.length > 0) {
          existingItem[0].value = JSON.stringify(paths);
          existingItem[0].updated_at = new Date();
        } else {
          realm.create('StorageItem', {
            key: `drawing_paths_${noteId}`,
            value: JSON.stringify(paths),
            createdAt: new Date(),
            updated_at: new Date(),
          });
        }
      });
    }

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    throw error;
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
    const status = await networkService.checkConnectionState();
    if (!status?.isOnline) {
      throw new Error('离线模式下无法更新绘图路径，请连接网络后重试');
    }

    const response = await instance.put(`${API_ENDPOINTS.NOTES.DRAWING_PATHS}/${id}`, pathData);

    const noteId = pathData?.note_id || pathData?.noteId;
    if (noteId) {
      const updateRealm = await realmService.getRealm();
      updateRealm.write(() => {
        const existingItem = updateRealm.objects('StorageItem').filtered(`key = "drawing_paths_${noteId}"`);
        const paths = existingItem.length > 0 ? JSON.parse(existingItem[0].value) : [];
        const index = paths.findIndex(path => path.id === id);
        if (index >= 0) {
          paths[index] = { ...paths[index], ...response.data };
          if (existingItem.length > 0) {
            existingItem[0].value = JSON.stringify(paths);
            existingItem[0].updated_at = new Date();
          } else {
            updateRealm.create('StorageItem', {
              key: `drawing_paths_${noteId}`,
              value: JSON.stringify(paths),
              createdAt: new Date(),
              updated_at: new Date(),
            });
          }
        }
      });
    }

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    throw error;
  }
};

/**
 * 删除绘图路径
 * @param {string} id - 绘图路径ID
 * @returns {Promise} - 返回删除结果
 */
export const deleteDrawingPath = async (id) => {
  try {
    const status = await networkService.checkConnectionState();
    if (!status?.isOnline) {
      throw new Error('离线模式下无法删除绘图路径，请连接网络后重试');
    }

    const response = await instance.delete(`${API_ENDPOINTS.NOTES.DRAWING_PATHS}/${id}`);

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    throw error;
  }
};

/**
 * 批量创建绘图路径
 * @param {Array} paths - 绘图路径数组
 * @returns {Promise} - 返回创建结果
 */
export const batchCreateDrawingPaths = async (paths) => {
  try {
    const status = await networkService.checkConnectionState();
    if (!status?.isOnline) {
      throw new Error('离线模式下无法批量创建绘图路径，请连接网络后重试');
    }

    const response = await instance.post(`${API_ENDPOINTS.NOTES.DRAWING_PATHS}/batch_create`, { paths });

    const createdPaths = response?.data?.created;
    if (Array.isArray(createdPaths) && createdPaths.length > 0) {
      const groupedByNoteId = createdPaths.reduce((acc, path) => {
        const noteId = path?.note_id || path?.noteId;
        if (!noteId) {
          return acc;
        }
        if (!acc[noteId]) {
          acc[noteId] = [];
        }
        acc[noteId].push(path);
        return acc;
      }, {});

      const realm = await realmService.getRealm();
      realm.write(() => {
        Object.entries(groupedByNoteId).forEach(([noteId, notePaths]) => {
          const existingItem = realm.objects('StorageItem').filtered(`key = "drawing_paths_${noteId}"`);
          const currentPaths = existingItem.length > 0 ? JSON.parse(existingItem[0].value) : [];
          const mergedPaths = [...currentPaths, ...notePaths];
          if (existingItem.length > 0) {
            existingItem[0].value = JSON.stringify(mergedPaths);
            existingItem[0].updated_at = new Date();
          } else {
            realm.create('StorageItem', {
              key: `drawing_paths_${noteId}`,
              value: JSON.stringify(mergedPaths),
              createdAt: new Date(),
              updated_at: new Date(),
            });
          }
        });
      });
    }

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    throw error;
  }
};

/**
 * 批量删除绘图路径
 * @param {Array} pathIds - 绘图路径ID数组
 * @returns {Promise} - 返回删除结果
 */
export const batchDeleteDrawingPaths = async (pathIds) => {
  try {
    const status = await networkService.checkConnectionState();
    if (!status?.isOnline) {
      throw new Error('离线模式下无法批量删除绘图路径，请连接网络后重试');
    }

    const response = await instance.delete(`${API_ENDPOINTS.NOTES.DRAWING_PATHS}/batch_delete`, {
      data: { path_ids: pathIds },
    });

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    throw error;
  }
};

const drawingPathApi = {
  getDrawingPathsByNote,
  getDrawingPathsByCanvas,
  createDrawingPath,
  updateDrawingPath,
  deleteDrawingPath,
  batchCreateDrawingPaths,
  batchDeleteDrawingPaths,
};

export default drawingPathApi;
