/**
 * 绘图路径API服务
 * 提供绘图路径相关的API调用
 */

import { instance } from './config';
import { API_ENDPOINTS } from '../../utils/constants';
import notesApi from './notesApi';
import realmService from '../database/realmService';
// 已移除 offlineStorageService 导入，现在直接使用 realmService

/**
 * 获取笔记的所有绘图路径
 * @param {string} noteId - 笔记ID
 * @returns {Promise} - 返回绘图路径列表
 */
export const getDrawingPathsByNote = async (noteId) => {
  try {
    // 检查网络状态
    // 已移除 offlineStorageService 调用，现在直接使用 realmService
    const status = await notesApi.checkNetwork();

    if (!status.isConnected) {
      // 离线模式：从本地存储获取
      const realm = await realmService.getRealm();
      const item = realm.objects('StorageItem').filtered(`key = "drawing_paths_${noteId}"`);
      const paths = item.length > 0 ? JSON.parse(item[0].value) : [];

      return {
        success: true,
        data: paths,
        fromCache: true
      };
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
    // 已移除 offlineStorageService 调用，现在直接使用 realmService
    const status = await notesApi.checkNetwork();

    if (!status.isConnected) {
      // 离线模式：从本地存储获取
      const realm = await realmService.getRealm();
      const item = realm.objects('StorageItem').filtered(`key = "drawing_paths_${canvasId}"`);
      const paths = item.length > 0 ? JSON.parse(item[0].value) : [];

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
    // 已移除 offlineStorageService 调用，现在直接使用 realmService
    const status = await notesApi.checkNetwork();

    if (!status.isConnected) {
      // 离线模式：添加到待处理操作
      const tempId = Date.now().toString();
      const path = { ...pathData, id: tempId };

      const realm = await realmService.getRealm();
      realm.write(() => {
        realm.create('OfflineQueue', {
          type: 'create_drawing_path',
          data: path,
          timestamp: new Date().toISOString()
        });
      });

      // 添加到本地存储
      const localRealm = await realmService.getRealm();
      localRealm.write(() => {
        const existingItem = localRealm.objects('StorageItem').filtered(`key = "drawing_paths_${noteId}"`);
        const paths = existingItem.length > 0 ? JSON.parse(existingItem[0].value) : [];
        paths.push(path);
        if (existingItem.length > 0) {
          existingItem[0].value = JSON.stringify(paths);
          existingItem[0].updated_at = new Date();
        } else {
          localRealm.create('StorageItem', {
            key: `drawing_paths_${noteId}`,
            value: JSON.stringify(paths),
            createdAt: new Date(),
            updated_at: new Date(),
          });
        }
      });

      return {
        success: true,
        data: path,
        fromCache: true
      };
    }

    // 在线模式：发送到服务器
    const response = await instance.post(API_ENDPOINTS.NOTES.DRAWING_PATHS, pathData);

    // 保存到本地存储
    const realm = await realmService.getRealm();
    realm.write(() => {
      const existingItem = realm.objects('StorageItem').filtered(`key = "drawing_paths_${noteId}"`);
      const paths = existingItem.length > 0 ? JSON.parse(existingItem[0].value) : [];
      paths.push(response.data);
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
    });

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
    // 已移除 offlineStorageService 调用，现在直接使用 realmService
    const status = await notesApi.checkNetwork();

    if (!status.isConnected) {
      // 离线模式：添加到待处理操作
      const realm = await realmService.getRealm();
      realm.write(() => {
        realm.create('OfflineQueue', {
          type: 'update_drawing_path',
          id,
          data: pathData,
          timestamp: new Date().toISOString()
        });
      });

      // 更新本地存储
      const localRealm = await realmService.getRealm();
      localRealm.write(() => {
        const existingItem = localRealm.objects('StorageItem').filtered(`key = "drawing_paths_${noteId}"`);
        const paths = existingItem.length > 0 ? JSON.parse(existingItem[0].value) : [];
        const index = paths.findIndex(path => path.id === id);
        if (index >= 0) {
          paths[index] = { ...paths[index], ...pathData };
          if (existingItem.length > 0) {
            existingItem[0].value = JSON.stringify(paths);
            existingItem[0].updated_at = new Date();
          } else {
            localRealm.create('StorageItem', {
              key: `drawing_paths_${noteId}`,
              value: JSON.stringify(paths),
              createdAt: new Date(),
              updated_at: new Date(),
            });
          }
        }
      });

      return {
        success: true,
        data: { ...pathData, id },
        fromCache: true
      };
    }

    // 在线模式：发送到服务器
    const response = await instance.put(`${API_ENDPOINTS.NOTES.DRAWING_PATHS}/${id}`, pathData);

    // 更新本地存储
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
          realm.create('StorageItem', {
            key: `drawing_paths_${noteId}`,
            value: JSON.stringify(paths),
            createdAt: new Date(),
            updated_at: new Date(),
          });
        }
      }
    });

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
    // 已移除 offlineStorageService 调用，现在直接使用 realmService
    const status = await notesApi.checkNetwork();

    if (!status.isConnected) {
      // 离线模式：添加到待处理操作和本地存储删除
      const realm = await realmService.getRealm();
      realm.write(() => {
        // 添加到离线队列
        realm.create('OfflineQueue', {
          type: 'delete_drawing_path',
          id,
          timestamp: new Date().toISOString()
        });

        // 从本地存储删除
        const existingItem = realm.objects('StorageItem').filtered(`key = "drawing_paths_${noteId}"`);
        const paths = existingItem.length > 0 ? JSON.parse(existingItem[0].value) : [];
        const filteredPaths = paths.filter(path => path.id !== id);
        if (existingItem.length > 0) {
          existingItem[0].value = JSON.stringify(filteredPaths);
          existingItem[0].updated_at = new Date();
        } else {
          realm.create('StorageItem', {
            key: `drawing_paths_${noteId}`,
            value: JSON.stringify(filteredPaths),
            createdAt: new Date(),
            updated_at: new Date(),
          });
        }
      });

      return {
        success: true,
        fromCache: true
      };
    }

    // 在线模式：发送到服务器
    await instance.delete(`${API_ENDPOINTS.NOTES.DRAWING_PATHS}/${id}`);

    // 从本地存储删除
    const deleteRealm = await realmService.getRealm();
    deleteRealm.write(() => {
      const existingItem = deleteRealm.objects('StorageItem').filtered(`key = "drawing_paths_${noteId}"`);
      const paths = existingItem.length > 0 ? JSON.parse(existingItem[0].value) : [];
      const filteredPaths = paths.filter(path => path.id !== id);
      if (existingItem.length > 0) {
        existingItem[0].value = JSON.stringify(filteredPaths);
        existingItem[0].updated_at = new Date();
      } else {
        deleteRealm.create('StorageItem', {
          key: `drawing_paths_${noteId}`,
          value: JSON.stringify(filteredPaths),
          createdAt: new Date(),
          updated_at: new Date(),
        });
      }
    });

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
    // 已移除 offlineStorageService 调用，现在直接使用 realmService
    const status = await notesApi.checkNetwork();

    if (!status.isConnected) {
      // 离线模式：添加到待处理操作
      const pathsWithIds = paths.map(path => ({
        ...path,
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9)
      }));

      const realm = await realmService.getRealm();
      realm.write(() => {
        realm.create('OfflineQueue', {
          type: 'batch_create_drawing_paths',
          data: pathsWithIds,
          timestamp: new Date().toISOString()
        });
      });

      // 添加到本地存储
      await Promise.all(pathsWithIds.map(async (path) => {
        const realm = await realmService.getRealm();
        realm.write(() => {
          const existingItem = realm.objects('StorageItem').filtered(`key = "drawing_paths_${noteId}"`);
          const paths = existingItem.length > 0 ? JSON.parse(existingItem[0].value) : [];
          paths.push(path);
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
      }));

      return {
        success: true,
        data: pathsWithIds,
        fromCache: true
      };
    }

    // 在线模式：发送到服务器
    const response = await instance.post(`${API_ENDPOINTS.NOTES.DRAWING_PATHS}/batch_create`, { paths });

    // 保存到本地存储
    await Promise.all(response.data.created.map(async (path) => {
      const realm = await realmService.getRealm();
      realm.write(() => {
        const existingItem = realm.objects('StorageItem').filtered(`key = "drawing_paths_${noteId}"`);
        const paths = existingItem.length > 0 ? JSON.parse(existingItem[0].value) : [];
        paths.push(path);
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
    }));

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
    // 已移除 offlineStorageService 调用，现在直接使用 realmService
    const status = await notesApi.checkNetwork();

    if (!status.isConnected) {
      // 离线模式：添加到待处理操作
      const realm = await realmService.getRealm();
      realm.write(() => {
        realm.create('OfflineQueue', {
          type: 'batch_delete_drawing_paths',
          data: { path_ids: pathIds },
          timestamp: new Date().toISOString()
        });
      });

      // 从本地存储删除
      await Promise.all(pathIds.map(async (id) => {
        const realm = await realmService.getRealm();
        realm.write(() => {
          const existingItem = realm.objects('StorageItem').filtered(`key = "drawing_paths_${noteId}"`);
          const paths = existingItem.length > 0 ? JSON.parse(existingItem[0].value) : [];
          const filteredPaths = paths.filter(path => path.id !== id);
          if (existingItem.length > 0) {
            existingItem[0].value = JSON.stringify(filteredPaths);
            existingItem[0].updated_at = new Date();
          } else {
            realm.create('StorageItem', {
              key: `drawing_paths_${noteId}`,
              value: JSON.stringify(filteredPaths),
              createdAt: new Date(),
              updated_at: new Date(),
            });
          }
        });
      }));

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
    await Promise.all(pathIds.map(async (id) => {
      const realm = await realmService.getRealm();
      realm.write(() => {
        const existingItem = realm.objects('StorageItem').filtered(`key = "drawing_paths_${noteId}"`);
        const paths = existingItem.length > 0 ? JSON.parse(existingItem[0].value) : [];
        const filteredPaths = paths.filter(path => path.id !== id);
        if (existingItem.length > 0) {
          existingItem[0].value = JSON.stringify(filteredPaths);
          existingItem[0].updated_at = new Date();
        } else {
          realm.create('StorageItem', {
            key: `drawing_paths_${noteId}`,
            value: JSON.stringify(filteredPaths),
            createdAt: new Date(),
            updated_at: new Date(),
          });
        }
      });
    }));

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
