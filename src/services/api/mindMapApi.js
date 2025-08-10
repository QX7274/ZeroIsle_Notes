/**
 * 思维导图API服务
 */
import apiClient from './apiClient';
import NetInfo from '@react-native-community/netinfo';
import { EXAMPLE_MIND_MAPS } from '../../constants/examples/mindMapExamples';
import { authService } from '../auth/authService';

// 定义API端点
const API_ENDPOINTS = {
  MIND_MAP: {
    MAPS: '/mind-map/maps/',
    BASE: '/mind-map/',
    DETAIL: (id) => `/mind-map/maps/${id}/`
  }
};

/**
 * 获取思维导图列表
 * @param {object} params - 查询参数
 * @returns {Promise} - 思维导图列表
 */
export const getMindMaps = async (params = {}) => {
  try {
    // 检查网络连接
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      console.log('思维导图API: 网络未连接');
      return {
        success: false,
        message: '网络未连接，请检查网络设置',
        error: new Error('网络未连接'),
        isNetworkError: true,
        data: {
          results: EXAMPLE_MIND_MAPS,
          count: EXAMPLE_MIND_MAPS.length
        }
      };
    }

    // 打印请求头中的令牌内容
    if (!authService) {
      console.error('authService未初始化');
      throw new Error('authService未初始化');
    }
    if (!authService.initialized) {
      await authService.initialize();
    }
    const token = await authService.getAuthToken();
    console.log('请求头中的令牌:', token);
    console.log('完整的Authorization头:', `Bearer ${token}`);

    console.log('思维导图API: 开始获取思维导图列表');
    const response = await apiClient.get(API_ENDPOINTS.MIND_MAP.MAPS, { params });

    console.log('思维导图API: 获取思维导图列表成功');

    // 检查响应数据格式
    if (response && response.data) {
      // 检查是否已经有results字段，如果没有，则添加
      if (!response.data.results && Array.isArray(response.data)) {
        return {
          success: true,
          data: {
            results: response.data,
            count: response.data.length
          }
        };
      } else {
        return {
          success: true,
          data: response.data
        };
      }
    } else {
      console.warn('思维导图API: 响应数据格式不正确');
      return {
        success: true,
        data: {
          results: EXAMPLE_MIND_MAPS,
          count: EXAMPLE_MIND_MAPS.length
        }
      };
    }
  } catch (error) {
    console.error('思维导图API: 获取思维导图列表失败:', error);
    console.log('思维导图API: 错误详情:', error.message);
    console.log('思维导图API: 错误状态码:', error.response?.status);

    // 使用示例数据
    console.log('使用示例思维导图数据');
    return {
      success: false,
      message: error.message || '获取思维导图列表失败',
      error,
      statusCode: error.response?.status,
      data: {
        results: EXAMPLE_MIND_MAPS,
        count: EXAMPLE_MIND_MAPS.length
      }
    };
  }
};

/**
 * 获取思维导图详情
 * @param {string} id - 思维导图ID
 * @returns {Promise} - 思维导图详情
 */
export const getMindMapById = async (id) => {
  try {
    const response = await apiClient.get(`${API_ENDPOINTS.MIND_MAP.MAPS}${id}/`);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '获取思维导图详情失败',
      error
    };
  }
};

/**
 * 创建思维导图
 * @param {object} data - 思维导图数据
 * @returns {Promise} - 创建结果
 */
export const createMindMap = async (data) => {
  try {
    const response = await apiClient.post(API_ENDPOINTS.MIND_MAP.MAPS, data);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '创建思维导图失败',
      error
    };
  }
};

/**
 * 更新思维导图
 * @param {string} id - 思维导图ID
 * @param {object} data - 思维导图数据
 * @returns {Promise} - 更新结果
 */
export const updateMindMap = async (id, data) => {
  try {
    const response = await apiClient.put(`${API_ENDPOINTS.MIND_MAP.MAPS}${id}/`, data);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '更新思维导图失败',
      error
    };
  }
};

/**
 * 删除思维导图
 * @param {string} id - 思维导图ID
 * @returns {Promise} - 删除结果
 */
export const deleteMindMap = async (id) => {
  try {
    await apiClient.delete(`${API_ENDPOINTS.MIND_MAP.MAPS}${id}/`);
    return {
      success: true
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '删除思维导图失败',
      error
    };
  }
};

// 导出API服务
const mindMapApi = {
  getMindMaps,
  getMindMapById,
  createMindMap,
  updateMindMap,
  deleteMindMap
};

export default mindMapApi;
