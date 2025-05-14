/**
 * 思维导图模板API服务
 */
import apiClient from './apiClient';
import NetInfo from '@react-native-community/netinfo';

// 定义API端点
const API_ENDPOINTS = {
  TEMPLATES: '/mind-map/templates/',
  USE_TEMPLATE: (id) => `/mind-map/templates/${id}/use_template/`
};

// 示例模板数据
const EXAMPLE_TEMPLATES = [
  {
    id: 'template-1',
    title: '学习计划',
    description: '用于规划学习目标和进度',
    type: 'study',
    thumbnail_url: null,
    node_count: 10,
    created_at: '2023-01-01T00:00:00Z',
    updated_at: '2023-01-01T00:00:00Z'
  },
  {
    id: 'template-2',
    title: '项目管理',
    description: '用于项目规划和任务分配',
    type: 'project',
    thumbnail_url: null,
    node_count: 15,
    created_at: '2023-01-02T00:00:00Z',
    updated_at: '2023-01-02T00:00:00Z'
  },
  {
    id: 'template-3',
    title: '头脑风暴',
    description: '用于创意发散和想法整理',
    type: 'brainstorm',
    thumbnail_url: null,
    node_count: 8,
    created_at: '2023-01-03T00:00:00Z',
    updated_at: '2023-01-03T00:00:00Z'
  },
  {
    id: 'template-4',
    title: '知识体系',
    description: '用于构建知识框架',
    type: 'general',
    thumbnail_url: null,
    node_count: 12,
    created_at: '2023-01-04T00:00:00Z',
    updated_at: '2023-01-04T00:00:00Z'
  }
];

/**
 * 获取思维导图模板列表
 * @param {object} params - 查询参数
 * @returns {Promise} - 思维导图模板列表
 */
export const getTemplates = async (params = {}) => {
  try {
    // 检查网络连接
    const netInfo = await NetInfo.fetch();
    if (!netInfo.isConnected) {
      console.log('思维导图模板API: 网络未连接');
      return {
        success: false,
        message: '网络未连接，请检查网络设置',
        error: new Error('网络未连接'),
        isNetworkError: true,
        data: {
          results: filterTemplates(EXAMPLE_TEMPLATES, params),
          count: EXAMPLE_TEMPLATES.length
        }
      };
    }

    console.log('思维导图模板API: 开始获取模板列表');
    const response = await apiClient.get(API_ENDPOINTS.TEMPLATES, { params });

    console.log('思维导图模板API: 获取模板列表成功');
    
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
      console.warn('思维导图模板API: 响应数据格式不正确');
      return {
        success: true,
        data: {
          results: filterTemplates(EXAMPLE_TEMPLATES, params),
          count: EXAMPLE_TEMPLATES.length
        }
      };
    }
  } catch (error) {
    console.error('思维导图模板API: 获取模板列表失败:', error);
    console.log('思维导图模板API: 错误详情:', error.message);
    console.log('思维导图模板API: 错误状态码:', error.response?.status);
    
    // 使用示例数据
    console.log('使用示例思维导图模板数据');
    return {
      success: false,
      message: error.message || '获取思维导图模板列表失败',
      error,
      statusCode: error.response?.status,
      data: {
        results: filterTemplates(EXAMPLE_TEMPLATES, params),
        count: EXAMPLE_TEMPLATES.length
      }
    };
  }
};

/**
 * 使用思维导图模板
 * @param {string} id - 模板ID
 * @returns {Promise} - 创建结果
 */
export const useTemplate = async (id) => {
  try {
    const response = await apiClient.post(API_ENDPOINTS.USE_TEMPLATE(id));
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    console.error('思维导图模板API: 使用模板失败:', error);
    
    // 创建一个新的思维导图ID作为返回
    const newMindMapId = `new-mind-map-${Date.now()}`;
    
    return {
      success: false,
      message: error.message || '使用思维导图模板失败',
      error,
      data: {
        id: newMindMapId
      }
    };
  }
};

/**
 * 根据参数过滤模板
 * @param {Array} templates - 模板数组
 * @param {Object} params - 过滤参数
 * @returns {Array} - 过滤后的模板数组
 */
const filterTemplates = (templates, params) => {
  let filtered = [...templates];
  
  // 按类型过滤
  if (params.type && params.type !== 'all') {
    filtered = filtered.filter(template => template.type === params.type);
  }
  
  // 按搜索关键词过滤
  if (params.search) {
    const searchLower = params.search.toLowerCase();
    filtered = filtered.filter(template => 
      template.title.toLowerCase().includes(searchLower) || 
      template.description.toLowerCase().includes(searchLower)
    );
  }
  
  return filtered;
};

// 导出API服务
const mindMapTemplateApi = {
  getTemplates,
  useTemplate
};

export default mindMapTemplateApi;
