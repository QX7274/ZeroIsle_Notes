/**
 * JSON工具函数
 * 提供JSON解析和处理的辅助函数
 */

/**
 * 安全解析JSON字符串
 * 处理可能存在的特殊字符和格式问题
 * @param {string|object} jsonString - 要解析的JSON字符串或对象
 * @param {any} defaultValue - 解析失败时返回的默认值
 * @returns {any} 解析结果或默认值
 */
export const safeParseJSON = (jsonString, defaultValue = null) => {
  // 处理undefined或null值
  if (jsonString === undefined || jsonString === null) {
    console.log('JSON字符串为undefined或null，返回默认值');
    return defaultValue;
  }

  // 如果已经是对象（包括数组），直接返回
  if (typeof jsonString === 'object') {
    console.log('输入已经是对象类型，直接返回');
    return jsonString;
  }

  // 如果不是字符串类型，记录警告并尝试转换
  if (typeof jsonString !== 'string') {
    console.log('JSON输入不是字符串类型:', typeof jsonString);
    try {
      // 尝试将其转换为字符串再解析
      const stringified = String(jsonString);
      if (stringified === '[object Object]') {
        console.warn('无法正确序列化对象，返回默认值');
        return defaultValue;
      }
      return JSON.parse(stringified);
    } catch (conversionError) {
      console.error('类型转换和JSON解析都失败:', conversionError);
      return defaultValue;
    }
  }

  // 处理空字符串
  if (jsonString === '') return defaultValue;

  try {
    // 尝试直接解析
    return JSON.parse(jsonString);
  } catch (error) {
    try {
      // 处理特殊字符
      const cleanedString = cleanJSONString(jsonString);
      if (!cleanedString) return defaultValue;

      return JSON.parse(cleanedString);
    } catch (innerError) {
      console.error('JSON解析失败:', innerError);
      return defaultValue;
    }
  }
};

/**
 * 清理JSON字符串中的特殊字符和格式问题
 * @param {string} jsonString - 要清理的JSON字符串
 * @returns {string} 清理后的JSON字符串
 */
export const cleanJSONString = (jsonString) => {
  // 处理undefined或null值
  if (jsonString === undefined || jsonString === null) {
    console.log('JSON字符串为undefined或null');
    return '';
  }

  // 确保输入是字符串
  if (typeof jsonString !== 'string') {
    console.log('JSON输入不是字符串类型:', typeof jsonString);
    try {
      // 尝试转换为字符串
      jsonString = String(jsonString);
    } catch (e) {
      console.error('无法将输入转换为字符串:', e);
      return '';
    }
  }

  // 处理空字符串
  if (!jsonString) return '';

  try {
    // 移除BOM标记
    let cleaned = jsonString.replace(/^\uFEFF/, '');

    // 处理意外的字符
    cleaned = cleaned.replace(/\u0000/g, ''); // 移除NULL字符

    // 处理不正确的转义
    cleaned = cleaned.replace(/\\"/g, '"').replace(/\\\\/g, '\\');

    // 处理控制字符
    cleaned = cleaned.replace(/[\u0000-\u001F]+/g, '');

    // 处理意外的结束
    if (cleaned.endsWith(',]')) {
      cleaned = cleaned.replace(/,]$/, ']');
    }
    if (cleaned.endsWith(',}')) {
      cleaned = cleaned.replace(/,}$/, '}');
    }

    return cleaned;
  } catch (error) {
    console.error('清理JSON字符串失败:', error);
    return '';
  }
};

/**
 * 安全序列化对象为JSON字符串
 * @param {any} data - 要序列化的数据
 * @param {string} defaultValue - 序列化失败时返回的默认值
 * @returns {string} JSON字符串或默认值
 */
export const safeStringifyJSON = (data, defaultValue = '{}') => {
  try {
    return JSON.stringify(data);
  } catch (error) {
    console.error('JSON序列化失败:', error);
    return defaultValue;
  }
};

export default {
  safeParseJSON,
  cleanJSONString,
  safeStringifyJSON
};
