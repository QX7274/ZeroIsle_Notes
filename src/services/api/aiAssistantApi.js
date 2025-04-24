import { axiosInstance } from './config';

const aiAssistantApi = {
  /**
   * AI聊天对话
   * @param {string} prompt - 用户输入的提示
   */
  chat: (prompt) => axiosInstance.post('/ai/chat/', { prompt }),

  /**
   * 语音转文字
   * @param {File} audioFile - 音频文件
   */
  transcribe: (audioFile) => {
    const formData = new FormData();
    formData.append('audio', audioFile);
    return axiosInstance.post('/ai/transcribe/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  },

  /**
   * 文本处理
   * @param {string} text - 待处理文本
   * @param {string} action - 处理类型 (translate|summarize|check)
   * @param {string} [targetLang] - 目标语言(翻译时使用)
   */
  processText: (text, action, targetLang) => 
    axiosInstance.post('/ai/process-text/', { 
      text, 
      action, 
      target_lang: targetLang 
    }),

  /**
   * 图片分析
   * @param {File} imageFile - 图片文件
   */
  analyzeImage: (imageFile) => {
    const formData = new FormData();
    formData.append('image', imageFile);
    return axiosInstance.post('/ai/analyze-image/', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  }
};

export default aiAssistantApi;
