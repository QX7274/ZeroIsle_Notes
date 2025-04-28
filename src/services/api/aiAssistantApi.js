/**
 * AI助手API服务
 */
import instance from './interceptor';
import { API_ENDPOINTS } from '../../config/api';
import AIAssistantModule from '../../native/AIAssistantModule';

/**
 * 发送聊天消息
 * @param {object} chatData - 聊天数据
 * @returns {Promise} - 聊天结果
 */
export const sendChatMessage = async (chatData) => {
  try {
    const response = await instance.post(API_ENDPOINTS.AI_ASSISTANT.CHAT, chatData);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '发送消息失败',
      error
    };
  }
};

/**
 * 发送流式聊天消息
 * @param {object} chatData - 聊天数据
 * @param {Function} onMessage - 消息回调
 * @param {Function} onComplete - 完成回调
 * @param {Function} onError - 错误回调
 * @returns {object} - 控制器对象，可用于取消请求
 */
export const sendStreamChatMessage = (chatData, onMessage, onComplete, onError) => {
  try {
    // 使用原生模块的流式响应
    const streamController = AIAssistantModule.sendMessageStream(
      chatData.message,
      chatData.engine || 'local',
      chatData.history || []
    );

    // 设置回调
    streamController
      .onMessage((content, fullText) => {
        onMessage && onMessage(content, fullText);
      })
      .onComplete((fullText) => {
        onComplete && onComplete(fullText);
      })
      .onError((error) => {
        onError && onError(new Error(error));
      });

    // 启动流式响应
    streamController.start();

    return {
      controller: streamController,
      cancel: () => streamController.stop(),
    };
  } catch (error) {
    onError && onError(error);
    return {
      controller: null,
      cancel: () => {},
    };
  }
};

/**
 * 生成内容
 * @param {object} generateData - 生成数据
 * @returns {Promise} - 生成结果
 */
export const generateContent = async (generateData) => {
  try {
    const response = await instance.post(API_ENDPOINTS.AI_ASSISTANT.GENERATE, generateData);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '生成内容失败',
      error
    };
  }
};

/**
 * 总结文本
 * @param {object} summarizeData - 总结数据
 * @returns {Promise} - 总结结果
 */
export const summarizeText = async (summarizeData) => {
  try {
    const response = await instance.post(API_ENDPOINTS.AI_ASSISTANT.SUMMARIZE, summarizeData);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '总结文本失败',
      error
    };
  }
};

/**
 * 翻译文本
 * @param {object} translateData - 翻译数据
 * @returns {Promise} - 翻译结果
 */
export const translateText = async (translateData) => {
  try {
    const response = await instance.post(API_ENDPOINTS.AI_ASSISTANT.TRANSLATE, translateData);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '翻译文本失败',
      error
    };
  }
};

/**
 * 分析情感
 * @param {object} sentimentData - 情感数据
 * @returns {Promise} - 分析结果
 */
export const analyzeSentiment = async (sentimentData) => {
  try {
    const response = await instance.post(API_ENDPOINTS.AI_ASSISTANT.ANALYZE_SENTIMENT, sentimentData);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '分析情感失败',
      error
    };
  }
};

/**
 * 语音转文字
 * @param {File} audioFile - 音频文件
 * @returns {Promise} - 转录结果
 */
export const transcribeAudio = async (audioFile) => {
  try {
    const formData = new FormData();
    formData.append('audio', audioFile);

    const response = await instance.post(API_ENDPOINTS.VOICE.TRANSCRIBE, formData, {
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
      message: error.message || '语音转文字失败',
      error
    };
  }
};

/**
 * 图片分析
 * @param {File} imageFile - 图片文件
 * @returns {Promise} - 分析结果
 */
export const analyzeImage = async (imageFile) => {
  try {
    const formData = new FormData();
    formData.append('image', imageFile);

    const response = await instance.post(API_ENDPOINTS.AI_ASSISTANT.BASE + 'analyze-image/', formData, {
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
      message: error.message || '图片分析失败',
      error
    };
  }
};

/**
 * 获取可用模型列表
 * @returns {Promise} - 模型列表
 */
export const getAvailableModels = async () => {
  try {
    const response = await instance.get(API_ENDPOINTS.AI_ASSISTANT.MODELS);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '获取可用模型失败',
      error
    };
  }
};

/**
 * 重置会话
 * @returns {Promise} - 重置结果
 */
export const resetSession = async () => {
  try {
    const response = await instance.post(API_ENDPOINTS.AI_ASSISTANT.RESET_SESSION);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '重置会话失败',
      error
    };
  }
};

const aiAssistantApi = {
  sendChatMessage,
  sendStreamChatMessage,
  generateContent,
  summarizeText,
  translateText,
  analyzeSentiment,
  transcribeAudio,
  analyzeImage,
  getAvailableModels,
  resetSession
};

export default aiAssistantApi;
