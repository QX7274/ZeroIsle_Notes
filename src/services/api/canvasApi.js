/**
 * 画布API服务
 */
import instance from './interceptor';
import { API_ENDPOINTS } from '../../config/api';

/**
 * 获取所有画布
 * @param {object} params - 查询参数
 * @returns {Promise} - 画布列表
 */
export const getAllCanvases = async (params = {}) => {
  try {
    const response = await instance.get(API_ENDPOINTS.CANVAS.BASE, { params });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '获取画布列表失败',
      error
    };
  }
};

/**
 * 获取画布详情
 * @param {string} id - 画布ID
 * @returns {Promise} - 画布详情
 */
export const getCanvasById = async (id) => {
  try {
    const response = await instance.get(API_ENDPOINTS.CANVAS.DETAIL(id));
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '获取画布详情失败',
      error
    };
  }
};

/**
 * 创建画布
 * @param {object} canvasData - 画布数据
 * @returns {Promise} - 创建结果
 */
export const createCanvas = async (canvasData) => {
  try {
    const response = await instance.post(API_ENDPOINTS.CANVAS.BASE, canvasData);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '创建画布失败',
      error
    };
  }
};

/**
 * 更新画布
 * @param {string} id - 画布ID
 * @param {object} canvasData - 画布数据
 * @returns {Promise} - 更新结果
 */
export const updateCanvas = async (id, canvasData) => {
  try {
    const response = await instance.put(API_ENDPOINTS.CANVAS.DETAIL(id), canvasData);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '更新画布失败',
      error
    };
  }
};

/**
 * 删除画布
 * @param {string} id - 画布ID
 * @returns {Promise} - 删除结果
 */
export const deleteCanvas = async (id) => {
  try {
    await instance.delete(API_ENDPOINTS.CANVAS.DETAIL(id));
    return {
      success: true
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '删除画布失败',
      error
    };
  }
};

/**
 * 获取画布元素
 * @param {string} canvasId - 画布ID
 * @param {object} params - 查询参数
 * @returns {Promise} - 元素列表
 */
export const getCanvasElements = async (canvasId, params = {}) => {
  try {
    const response = await instance.get(API_ENDPOINTS.CANVAS.ELEMENTS, {
      params: {
        canvas_id: canvasId,
        ...params
      }
    });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '获取画布元素失败',
      error
    };
  }
};

/**
 * 获取画布元素详情
 * @param {string} id - 元素ID
 * @returns {Promise} - 元素详情
 */
export const getElementById = async (id) => {
  try {
    const response = await instance.get(API_ENDPOINTS.CANVAS.ELEMENT_DETAIL(id));
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '获取元素详情失败',
      error
    };
  }
};

/**
 * 创建画布元素
 * @param {object} elementData - 元素数据
 * @returns {Promise} - 创建结果
 */
export const createElement = async (elementData) => {
  try {
    const response = await instance.post(API_ENDPOINTS.CANVAS.ELEMENTS, elementData);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '创建元素失败',
      error
    };
  }
};

/**
 * 批量创建画布元素
 * @param {Array<object>} elementsData - 元素数据数组
 * @returns {Promise} - 创建结果
 */
export const createElements = async (elementsData) => {
  try {
    const response = await instance.post(`${API_ENDPOINTS.CANVAS.ELEMENTS}/batch/`, {
      elements: elementsData
    });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '批量创建元素失败',
      error
    };
  }
};

/**
 * 更新画布元素
 * @param {string} id - 元素ID
 * @param {object} elementData - 元素数据
 * @returns {Promise} - 更新结果
 */
export const updateElement = async (id, elementData) => {
  try {
    const response = await instance.put(API_ENDPOINTS.CANVAS.ELEMENT_DETAIL(id), elementData);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '更新元素失败',
      error
    };
  }
};

/**
 * 批量更新画布元素
 * @param {Array<object>} elementsData - 元素数据数组
 * @returns {Promise} - 更新结果
 */
export const updateElements = async (elementsData) => {
  try {
    const response = await instance.put(`${API_ENDPOINTS.CANVAS.ELEMENTS}/batch/`, {
      elements: elementsData
    });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '批量更新元素失败',
      error
    };
  }
};

/**
 * 删除画布元素
 * @param {string} id - 元素ID
 * @returns {Promise} - 删除结果
 */
export const deleteElement = async (id) => {
  try {
    await instance.delete(API_ENDPOINTS.CANVAS.ELEMENT_DETAIL(id));
    return {
      success: true
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '删除元素失败',
      error
    };
  }
};

/**
 * 批量删除画布元素
 * @param {Array<string>} elementIds - 元素ID数组
 * @returns {Promise} - 删除结果
 */
export const deleteElements = async (elementIds) => {
  try {
    await instance.delete(`${API_ENDPOINTS.CANVAS.ELEMENTS}/batch/`, {
      data: {
        element_ids: elementIds
      }
    });
    return {
      success: true
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '批量删除元素失败',
      error
    };
  }
};

/**
 * 导出画布
 * @param {string} id - 画布ID
 * @param {string} format - 导出格式
 * @returns {Promise} - 导出结果
 */
export const exportCanvas = async (id, format) => {
  try {
    const response = await instance.get(`${API_ENDPOINTS.CANVAS.EXPORT(id)}?format=${format}`, {
      responseType: 'blob'
    });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '导出画布失败',
      error
    };
  }
};

/**
 * 导入画布
 * @param {FormData} formData - 包含文件的表单数据
 * @returns {Promise} - 导入结果
 */
export const importCanvas = async (formData) => {
  try {
    const response = await instance.post(API_ENDPOINTS.CANVAS.IMPORT, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '导入画布失败',
      error
    };
  }
};

const canvasApi = {
  getAllCanvases,
  getCanvasById,
  createCanvas,
  updateCanvas,
  deleteCanvas,
  getCanvasElements,
  getElementById,
  createElement,
  createElements,
  updateElement,
  updateElements,
  deleteElement,
  deleteElements,
  exportCanvas,
  importCanvas
};

export default canvasApi;
