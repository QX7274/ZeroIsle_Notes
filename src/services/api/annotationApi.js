/**
 * 注释API服务
 * 提供PDF注释相关的API调用
 */

import { instance } from './config';
import { API_ENDPOINTS } from '../../utils/constants';
import realmService from '../database/realmService';
import networkService from '../network/networkService';

const resolveNoteId = (annotationData) => annotationData?.note_id || annotationData?.noteId || annotationData?.note?.id;

/**
 * 获取笔记的所有注释
 * @param {string} noteId - 笔记ID
 * @returns {Promise} - 返回注释列表
 */
export const getAnnotationsByNote = async (noteId) => {
  try {
    // 检查网络状态
    const status = await networkService.checkConnection();

    if (!status?.isOnline) {
      // 离线模式：从本地存储获取
      const realm = await realmService.getRealm();
      const item = realm.objects('StorageItem').filtered(`key = "annotations_${noteId}"`);
      const annotations = item.length > 0 ? JSON.parse(item[0].value) : [];

      return {
        success: true,
        data: annotations,
        fromCache: true,
      };
    }

    // 在线模式：从服务器获取
    const response = await instance.get(`${API_ENDPOINTS.NOTES.ANNOTATIONS}/by_note?note_id=${noteId}`);

    // 保存到本地存储
    const realm = await realmService.getRealm();
    realm.write(() => {
      const existingItem = realm.objects('StorageItem').filtered(`key = "annotations_${noteId}"`);
      if (existingItem.length > 0) {
        existingItem[0].value = JSON.stringify(response.data);
        existingItem[0].updated_at = new Date();
      } else {
        realm.create('StorageItem', {
          key: `annotations_${noteId}`,
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
 * 获取笔记特定页面的注释
 * @param {string} noteId - 笔记ID
 * @param {number} page - 页码
 * @returns {Promise} - 返回注释列表
 */
export const getAnnotationsByPage = async (noteId, page) => {
  try {
    // 检查网络状态
    const status = await networkService.checkConnection();

    if (!status?.isOnline) {
      // 离线模式：从本地存储获取
      const realm = await realmService.getRealm();
      const item = realm.objects('StorageItem').filtered(`key = "annotations_${noteId}"`);
      const annotations = item.length > 0 ? JSON.parse(item[0].value) : [];
      const pageAnnotations = annotations.filter(annotation => annotation.page === page);

      return {
        success: true,
        data: pageAnnotations,
        fromCache: true,
      };
    }

    // 在线模式：从服务器获取
    const response = await instance.get(`${API_ENDPOINTS.NOTES.ANNOTATIONS}/by_page?note_id=${noteId}&page=${page}`);

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    throw error;
  }
};

/**
 * 创建注释
 * @param {Object} annotationData - 注释数据
 * @returns {Promise} - 返回创建结果
 */
export const createAnnotation = async (annotationData) => {
  try {
    const noteId = resolveNoteId(annotationData);
    if (!noteId) {
      throw new Error('createAnnotation 缺少 noteId，无法维护本地注释缓存');
    }

    // 检查网络状态
    const status = await networkService.checkConnection();

    if (!status?.isOnline) {
      // 离线模式：添加到待处理操作
      const annotation = { ...annotationData, id: realmService.createObjectId() };

      const realm = await realmService.getRealm();
      realm.write(() => {
        realm.create('OfflineQueue', {
          type: 'create_annotation',
          data: annotation,
          timestamp: new Date().toISOString(),
        });
      });

      // 添加到本地存储
      realm.write(() => {
        const existingItem = realm.objects('StorageItem').filtered(`key = "annotations_${noteId}"`);
        const annotations = existingItem.length > 0 ? JSON.parse(existingItem[0].value) : [];
        annotations.push(annotation);
        if (existingItem.length > 0) {
          existingItem[0].value = JSON.stringify(annotations);
          existingItem[0].updated_at = new Date();
        } else {
          realm.create('StorageItem', {
            key: `annotations_${noteId}`,
            value: JSON.stringify(annotations),
            createdAt: new Date(),
            updated_at: new Date(),
          });
        }
      });

      return {
        success: true,
        data: annotation,
        fromCache: true,
      };
    }

    // 在线模式：发送到服务器
    const response = await instance.post(API_ENDPOINTS.NOTES.ANNOTATIONS, annotationData);

    // 保存到本地存储
    const realm = await realmService.getRealm();
    realm.write(() => {
      const existingItem = realm.objects('StorageItem').filtered(`key = "annotations_${noteId}"`);
      const annotations = existingItem.length > 0 ? JSON.parse(existingItem[0].value) : [];
      annotations.push(response.data);
      if (existingItem.length > 0) {
        existingItem[0].value = JSON.stringify(annotations);
        existingItem[0].updated_at = new Date();
      } else {
        realm.create('StorageItem', {
          key: `annotations_${noteId}`,
          value: JSON.stringify(annotations),
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
 * 更新注释
 * @param {string} id - 注释ID
 * @param {Object} annotationData - 注释数据
 * @returns {Promise} - 返回更新结果
 */
export const updateAnnotation = async (id, annotationData, noteIdParam) => {
  try {
    const noteId = noteIdParam || resolveNoteId(annotationData);
    if (!noteId) {
      throw new Error('updateAnnotation 缺少 noteId，无法维护本地注释缓存');
    }

    // 检查网络状态
    const status = await networkService.checkConnection();

    if (!status?.isOnline) {
      // 离线模式：添加到待处理操作
      const realm = await realmService.getRealm();
      realm.write(() => {
        realm.create('OfflineQueue', {
          type: 'update_annotation',
          id,
          data: annotationData,
          timestamp: new Date().toISOString(),
        });
      });

      // 更新本地存储
      realm.write(() => {
        const existingItem = realm.objects('StorageItem').filtered(`key = "annotations_${noteId}"`);
        const annotations = existingItem.length > 0 ? JSON.parse(existingItem[0].value) : [];
        const index = annotations.findIndex(ann => ann.id === id);
        if (index >= 0) {
          annotations[index] = { ...annotations[index], ...annotationData };
          if (existingItem.length > 0) {
            existingItem[0].value = JSON.stringify(annotations);
            existingItem[0].updated_at = new Date();
          } else {
            realm.create('StorageItem', {
              key: `annotations_${noteId}`,
              value: JSON.stringify(annotations),
              createdAt: new Date(),
              updated_at: new Date(),
            });
          }
        }
      });

      return {
        success: true,
        data: { ...annotationData, id },
        fromCache: true,
      };
    }

    // 在线模式：发送到服务器
    const response = await instance.put(`${API_ENDPOINTS.NOTES.ANNOTATIONS}/${id}`, annotationData);

    // 更新本地存储
    const realm = await realmService.getRealm();
    realm.write(() => {
      const existingItem = realm.objects('StorageItem').filtered(`key = "annotations_${noteId}"`);
      const annotations = existingItem.length > 0 ? JSON.parse(existingItem[0].value) : [];
      const index = annotations.findIndex(ann => ann.id === id);
      if (index >= 0) {
        annotations[index] = { ...annotations[index], ...response.data };
        if (existingItem.length > 0) {
          existingItem[0].value = JSON.stringify(annotations);
          existingItem[0].updated_at = new Date();
        } else {
          realm.create('StorageItem', {
            key: `annotations_${noteId}`,
            value: JSON.stringify(annotations),
            createdAt: new Date(),
            updated_at: new Date(),
          });
        }
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
 * 删除注释
 * @param {string} id - 注释ID
 * @returns {Promise} - 返回删除结果
 */
export const deleteAnnotation = async (id, noteId) => {
  try {
    if (!noteId) {
      throw new Error('deleteAnnotation 缺少 noteId，无法维护本地注释缓存');
    }

    // 检查网络状态
    const status = await networkService.checkConnection();

    if (!status?.isOnline) {
      // 离线模式：添加到待处理操作
      const realm = await realmService.getRealm();
      realm.write(() => {
        realm.create('OfflineQueue', {
          type: 'delete_annotation',
          id,
          timestamp: new Date().toISOString(),
        });
      });

      // 从本地存储删除
      realm.write(() => {
        const existingItem = realm.objects('StorageItem').filtered(`key = "annotations_${noteId}"`);
        const annotations = existingItem.length > 0 ? JSON.parse(existingItem[0].value) : [];
        const filteredAnnotations = annotations.filter(ann => ann.id !== id);
        if (existingItem.length > 0) {
          existingItem[0].value = JSON.stringify(filteredAnnotations);
          existingItem[0].updated_at = new Date();
        } else {
          realm.create('StorageItem', {
            key: `annotations_${noteId}`,
            value: JSON.stringify(filteredAnnotations),
            createdAt: new Date(),
            updated_at: new Date(),
          });
        }
      });

      return {
        success: true,
        fromCache: true,
      };
    }

    // 在线模式：发送到服务器
    await instance.delete(`${API_ENDPOINTS.NOTES.ANNOTATIONS}/${id}`);

    // 从本地存储删除
    const realm = await realmService.getRealm();
    realm.write(() => {
      const existingItem = realm.objects('StorageItem').filtered(`key = "annotations_${noteId}"`);
      const annotations = existingItem.length > 0 ? JSON.parse(existingItem[0].value) : [];
      const filteredAnnotations = annotations.filter(ann => ann.id !== id);
      if (existingItem.length > 0) {
        existingItem[0].value = JSON.stringify(filteredAnnotations);
        existingItem[0].updated_at = new Date();
      } else {
        realm.create('StorageItem', {
          key: `annotations_${noteId}`,
          value: JSON.stringify(filteredAnnotations),
          createdAt: new Date(),
          updated_at: new Date(),
        });
      }
    });

    return {
      success: true,
    };
  } catch (error) {
    throw error;
  }
};

/**
 * 批量创建注释
 * @param {Array} annotations - 注释数组
 * @returns {Promise} - 返回创建结果
 */
export const batchCreateAnnotations = async (annotations) => {
  try {
    const noteId = resolveNoteId(annotations?.[0]);
    if (!noteId) {
      throw new Error('batchCreateAnnotations 缺少 noteId，无法维护本地注释缓存');
    }

    // 检查网络状态
    const status = await networkService.checkConnection();

    if (!status?.isOnline) {
      // 离线模式：添加到待处理操作
      const annotationsWithIds = annotations.map(annotation => ({
        ...annotation,
        id: realmService.createObjectId(),
      }));

      const realm = await realmService.getRealm();
      realm.write(() => {
        realm.create('OfflineQueue', {
          type: 'batch_create_annotations',
          data: annotationsWithIds,
          timestamp: new Date().toISOString(),
        });
      });

      // 添加到本地存储
      await Promise.all(annotationsWithIds.map(async (annotation) => {
        const realm = await realmService.getRealm();
        realm.write(() => {
          const existingItem = realm.objects('StorageItem').filtered(`key = "annotations_${noteId}"`);
          const annotations = existingItem.length > 0 ? JSON.parse(existingItem[0].value) : [];
          annotations.push(annotation);
          if (existingItem.length > 0) {
            existingItem[0].value = JSON.stringify(annotations);
            existingItem[0].updated_at = new Date();
          } else {
            realm.create('StorageItem', {
              key: `annotations_${noteId}`,
              value: JSON.stringify(annotations),
              createdAt: new Date(),
              updated_at: new Date(),
            });
          }
        });
      }));

      return {
        success: true,
        data: annotationsWithIds,
        fromCache: true,
      };
    }

    // 在线模式：发送到服务器
    const response = await instance.post(`${API_ENDPOINTS.NOTES.ANNOTATIONS}/batch`, { annotations });

    // 保存到本地存储
    await Promise.all(response.data.created.map(async (annotation) => {
      const realm = await realmService.getRealm();
      realm.write(() => {
        const existingItem = realm.objects('StorageItem').filtered(`key = "annotations_${noteId}"`);
        const annotations = existingItem.length > 0 ? JSON.parse(existingItem[0].value) : [];
        annotations.push(annotation);
        if (existingItem.length > 0) {
          existingItem[0].value = JSON.stringify(annotations);
          existingItem[0].updated_at = new Date();
        } else {
          realm.create('StorageItem', {
            key: `annotations_${noteId}`,
            value: JSON.stringify(annotations),
            createdAt: new Date(),
            updated_at: new Date(),
          });
        }
      });
    }));

    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    throw error;
  }
};

const annotationApi = {
  getAnnotationsByNote,
  getAnnotationsByPage,
  createAnnotation,
  updateAnnotation,
  deleteAnnotation,
  batchCreateAnnotations,
};

export default annotationApi;
