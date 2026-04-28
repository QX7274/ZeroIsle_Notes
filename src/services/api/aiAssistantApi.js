/**
 * AI助手API服务
 */
import instance from './apiClient';
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
      data: response.data,
    };
  } catch (error) {
    throw error;
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
    throw error;
  }
};

/**
 * 生成内容
 * @param {object} generateData - 生成数据
 * @returns {Promise} - 生成结果
 */
export const generateContent = async (generateData) => {
  try {
    // 统一走 /process，组装 payload
    const isString = typeof generateData === 'string';
    const prompt = isString ? generateData : (generateData?.prompt ?? generateData?.text ?? '');
    const payload = {
      tool: 'generate',
      prompt,
      type: isString ? 'text' : (generateData?.type ?? 'text'),
      length: isString ? 'medium' : (generateData?.length ?? 'medium'),
    };

    const response = await instance.post(API_ENDPOINTS.AI_ASSISTANT.PROCESS, payload);
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    throw error;
  }
};

/**
 * 总结文本
 * @param {object} summarizeData - 总结数据
 * @returns {Promise} - 总结结果
 */
export const summarizeText = async (summarizeData) => {
  try {
    const payload = (typeof summarizeData === 'string')
      ? { text: summarizeData, tool: 'summarize' }
      : { ...summarizeData, tool: 'summarize' };

    const response = await instance.post(API_ENDPOINTS.AI_ASSISTANT.PROCESS, payload);
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    throw error;
  }
};

/**
 * 翻译文本
 * @param {object} translateData - 翻译数据
 * @returns {Promise} - 翻译结果
 */
export const translateText = async (translateData) => {
  try {
    const payload = (typeof translateData === 'string')
      ? { text: translateData, tool: 'translate' }
      : { ...translateData, tool: 'translate' };

    const response = await instance.post(API_ENDPOINTS.AI_ASSISTANT.PROCESS, payload);
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    throw error;
  }
};

/**
 * 分析情感（统一走 /process）
 * @param {object|string} sentimentData - 情感数据或文本
 * @returns {Promise} - 分析结果
 */
export const analyzeSentiment = async (sentimentData) => {
  try {
    const payload = (typeof sentimentData === 'string')
      ? { text: sentimentData, tool: 'analyze_sentiment' }
      : { ...sentimentData, tool: 'analyze_sentiment' };

    const response = await instance.post(API_ENDPOINTS.AI_ASSISTANT.PROCESS, payload);
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    throw error;
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
    // 统一使用 'file' 字段名，后端已兼容
    formData.append('file', audioFile);

    const response = await instance.post(API_ENDPOINTS.VOICE.TRANSCRIBE, formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
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
        'Content-Type': 'multipart/form-data',
      },
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
 * 获取可用模型列表
 * @returns {Promise} - 模型列表
 */
export const getAvailableModels = async () => {
  try {
    const response = await instance.get(API_ENDPOINTS.AI_ASSISTANT.MODELS);
    return {
      success: true,
      data: response.data,
    };
  } catch (error) {
    throw error;
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
      data: response.data,
    };
  } catch (error) {
    throw error;
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
  resetSession,
};

export default aiAssistantApi;
