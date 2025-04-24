import { axiosInstance } from './config';

const voiceApi = {
  /**
   * 语音转文本
   * @param {File|string} audio - 音频文件或base64字符串
   * @param {string|null} noteId - 关联的笔记ID(可选)
   * @returns {Promise} 包含转写结果的Promise
   */
  transcribeAudio: (audio, noteId = null) => {
    const formData = new FormData();
    
    if (audio instanceof File) {
      formData.append('audio', audio);
    } else {
      formData.append('audio', audio);
    }
    
    if (noteId) {
      formData.append('noteId', noteId);
    }
    
    return axiosInstance.post('/voice-transcription', formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
  },

  /**
   * 生成会议纪要
   * @param {string} text - 转写文本
   * @returns {Promise} 包含会议纪要的Promise
   */
  generateMeetingSummary: (text) => {
    return axiosInstance.post('/meeting-summary', { text });
  }
};

export default voiceApi;
