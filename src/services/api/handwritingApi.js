/**
 * 手写识别API服务
 * 提供手写识别相关的API调用，包括手写文字识别、手写形状识别等功能
 */
import instance from './interceptor';
import { API_ENDPOINTS } from '../../config/api';
import { offlineStorageService } from '../offline/offlineStorage';
import { STORAGE_KEYS } from '../../utils/constants/config';

/**
 * 手写文字识别
 * @param {Object} data - 手写数据
 * @param {string} data.image - 图像数据（Base64编码）
 * @param {string} data.language - 语言代码，如 'zh-CN', 'en-US'
 * @param {string} data.noteId - 笔记ID（可选）
 * @returns {Promise} - 识别结果
 */
export const recognizeHandwriting = async (data) => {
  try {
    // 检查网络状态
    const status = offlineStorageService.getStatus();
    
    if (!status.isOnline) {
      return {
        success: false,
        message: '离线模式下无法进行手写识别',
        error: new Error('Offline mode')
      };
    }
    
    // 在线模式：发送到服务器
    const response = await instance.post(API_ENDPOINTS.HANDWRITING.RECOGNIZE, data);
    
    return {
      success: true,
      text: response.data.text,
      confidence: response.data.confidence
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '手写识别失败',
      error
    };
  }
};

/**
 * 手写形状识别
 * @param {Object} data - 手写数据
 * @param {string} data.image - 图像数据（Base64编码）
 * @returns {Promise} - 识别结果
 */
export const recognizeShape = async (data) => {
  try {
    // 检查网络状态
    const status = offlineStorageService.getStatus();
    
    if (!status.isOnline) {
      return {
        success: false,
        message: '离线模式下无法进行形状识别',
        error: new Error('Offline mode')
      };
    }
    
    // 在线模式：发送到服务器
    const response = await instance.post(API_ENDPOINTS.HANDWRITING.RECOGNIZE_SHAPE, data);
    
    return {
      success: true,
      shapes: response.data.shapes,
      confidence: response.data.confidence
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '形状识别失败',
      error
    };
  }
};

/**
 * 从图像识别文字
 * @param {Object} data - 图像数据
 * @param {string} data.image - 图像数据（Base64编码）
 * @param {string} data.language - 语言代码，如 'zh-CN', 'en-US'
 * @param {boolean} data.detectOrientation - 是否检测方向
 * @returns {Promise} - 识别结果
 */
export const recognizeTextFromImage = async (data) => {
  try {
    // 检查网络状态
    const status = offlineStorageService.getStatus();
    
    if (!status.isOnline) {
      return {
        success: false,
        message: '离线模式下无法进行图像文字识别',
        error: new Error('Offline mode')
      };
    }
    
    // 在线模式：发送到服务器
    const response = await instance.post(API_ENDPOINTS.HANDWRITING.OCR, data);
    
    return {
      success: true,
      text: response.data.text,
      regions: response.data.regions,
      orientation: response.data.orientation
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '图像文字识别失败',
      error
    };
  }
};

/**
 * 保存手写图像
 * @param {Object} data - 手写数据
 * @param {string} data.image - 图像数据（Base64编码）
 * @param {string} data.noteId - 笔记ID
 * @param {string} data.title - 图像标题（可选）
 * @returns {Promise} - 保存结果
 */
export const saveHandwritingImage = async (data) => {
  try {
    // 检查网络状态
    const status = offlineStorageService.getStatus();
    
    if (!status.isOnline) {
      // 离线模式：添加到待处理操作
      await offlineStorageService.addPendingOperation({
        type: 'save_handwriting_image',
        data,
        timestamp: new Date().toISOString()
      });
      
      return {
        success: true,
        message: '图像已保存到离线队列',
        fromCache: true
      };
    }
    
    // 在线模式：发送到服务器
    const response = await instance.post(API_ENDPOINTS.HANDWRITING.SAVE_IMAGE, data);
    
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '保存手写图像失败',
      error
    };
  }
};

/**
 * 获取手写识别历史
 * @param {Object} params - 查询参数
 * @returns {Promise} - 历史记录
 */
export const getHandwritingHistory = async (params = {}) => {
  try {
    // 检查网络状态
    const status = offlineStorageService.getStatus();
    
    if (!status.isOnline) {
      // 离线模式：从缓存获取
      const cachedHistory = await offlineStorageService.getCachedData('handwriting_history') || [];
      
      return {
        success: true,
        data: cachedHistory,
        fromCache: true
      };
    }
    
    // 在线模式：从服务器获取
    const response = await instance.get(API_ENDPOINTS.HANDWRITING.HISTORY, { params });
    
    // 缓存数据
    await offlineStorageService.cacheData('handwriting_history', response.data);
    
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '获取手写识别历史失败',
      error
    };
  }
};

/**
 * 获取支持的语言列表
 * @returns {Promise} - 语言列表
 */
export const getSupportedLanguages = async () => {
  try {
    // 检查网络状态
    const status = offlineStorageService.getStatus();
    
    if (!status.isOnline) {
      // 离线模式：从缓存获取
      const cachedLanguages = await offlineStorageService.getCachedData('handwriting_languages') || [];
      
      if (cachedLanguages.length > 0) {
        return {
          success: true,
          data: cachedLanguages,
          fromCache: true
        };
      } else {
        // 如果缓存中没有数据，返回默认语言列表
        const defaultLanguages = [
          { code: 'zh-CN', name: '中文（简体）' },
          { code: 'en-US', name: '英语（美国）' },
          { code: 'ja-JP', name: '日语' },
          { code: 'ko-KR', name: '韩语' },
          { code: 'fr-FR', name: '法语' },
          { code: 'de-DE', name: '德语' },
          { code: 'es-ES', name: '西班牙语' },
          { code: 'ru-RU', name: '俄语' }
        ];
        
        return {
          success: true,
          data: defaultLanguages,
          fromCache: true
        };
      }
    }
    
    // 在线模式：从服务器获取
    const response = await instance.get(API_ENDPOINTS.HANDWRITING.LANGUAGES);
    
    // 缓存数据
    await offlineStorageService.cacheData('handwriting_languages', response.data);
    
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    // 如果请求失败，返回默认语言列表
    const defaultLanguages = [
      { code: 'zh-CN', name: '中文（简体）' },
      { code: 'en-US', name: '英语（美国）' },
      { code: 'ja-JP', name: '日语' },
      { code: 'ko-KR', name: '韩语' },
      { code: 'fr-FR', name: '法语' },
      { code: 'de-DE', name: '德语' },
      { code: 'es-ES', name: '西班牙语' },
      { code: 'ru-RU', name: '俄语' }
    ];
    
    return {
      success: true,
      data: defaultLanguages,
      fromDefault: true
    };
  }
};

/**
 * 获取支持的模型列表
 * @returns {Promise} - 模型列表
 */
export const getSupportedModels = async () => {
  try {
    // 检查网络状态
    const status = offlineStorageService.getStatus();
    
    if (!status.isOnline) {
      // 离线模式：从缓存获取
      const cachedModels = await offlineStorageService.getCachedData('handwriting_models') || [];
      
      if (cachedModels.length > 0) {
        return {
          success: true,
          data: cachedModels,
          fromCache: true
        };
      } else {
        // 如果缓存中没有数据，返回默认模型列表
        const defaultModels = [
          { id: 'default', name: '默认模型', description: '通用手写识别模型' },
          { id: 'chinese', name: '中文优化', description: '针对中文手写进行优化的模型' },
          { id: 'english', name: '英文优化', description: '针对英文手写进行优化的模型' },
          { id: 'math', name: '数学公式', description: '专门用于识别数学公式的模型' }
        ];
        
        return {
          success: true,
          data: defaultModels,
          fromCache: true
        };
      }
    }
    
    // 在线模式：从服务器获取
    const response = await instance.get(API_ENDPOINTS.HANDWRITING.MODELS);
    
    // 缓存数据
    await offlineStorageService.cacheData('handwriting_models', response.data);
    
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    // 如果请求失败，返回默认模型列表
    const defaultModels = [
      { id: 'default', name: '默认模型', description: '通用手写识别模型' },
      { id: 'chinese', name: '中文优化', description: '针对中文手写进行优化的模型' },
      { id: 'english', name: '英文优化', description: '针对英文手写进行优化的模型' },
      { id: 'math', name: '数学公式', description: '专门用于识别数学公式的模型' }
    ];
    
    return {
      success: true,
      data: defaultModels,
      fromDefault: true
    };
  }
};

const handwritingApi = {
  recognizeHandwriting,
  recognizeShape,
  recognizeTextFromImage,
  saveHandwritingImage,
  getHandwritingHistory,
  getSupportedLanguages,
  getSupportedModels
};

export default handwritingApi;
