/**
 * 语音API服务
 */
import instance from './interceptor';
import { API_ENDPOINTS } from '../../config/api';

/**
 * 语音转文字
 * @param {File|string} audio - 音频文件或base64字符串
 * @param {string|null} noteId - 关联的笔记ID(可选)
 * @param {object} params - 转录参数
 * @returns {Promise} - 转录结果
 */
export const transcribeAudio = async (audio, noteId = null, params = {}) => {
  try {
    const formData = new FormData();

    if (audio instanceof File) {
      formData.append('audio', audio);
    } else {
      formData.append('audio_base64', audio);
    }

    if (noteId) {
      formData.append('note_id', noteId);
    }

    // 添加其他参数
    Object.keys(params).forEach(key => {
      formData.append(key, params[key]);
    });

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
 * 语音命令
 * @param {File|string} audio - 音频文件或base64字符串
 * @returns {Promise} - 命令结果
 */
export const processVoiceCommand = async (audio) => {
  try {
    const formData = new FormData();

    if (audio instanceof File) {
      formData.append('audio', audio);
    } else {
      formData.append('audio_base64', audio);
    }

    const response = await instance.post(API_ENDPOINTS.VOICE.COMMAND, formData, {
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
      message: error.message || '处理语音命令失败',
      error
    };
  }
};

/**
 * 会议记录
 * @param {File|string} audio - 音频文件或base64字符串
 * @param {object} params - 会议参数
 * @returns {Promise} - 会议记录结果
 */
export const processMeetingAudio = async (audio, params = {}) => {
  try {
    const formData = new FormData();

    if (audio instanceof File) {
      formData.append('audio', audio);
    } else {
      formData.append('audio_base64', audio);
    }

    // 添加其他参数
    Object.keys(params).forEach(key => {
      formData.append(key, params[key]);
    });

    const response = await instance.post(API_ENDPOINTS.VOICE.MEETING, formData, {
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
      message: error.message || '处理会议记录失败',
      error
    };
  }
};

/**
 * 生成会议纪要
 * @param {string} text - 转写文本
 * @returns {Promise} - 会议纪要结果
 */
export const generateMeetingSummary = async (text) => {
  try {
    const response = await instance.post('/voice-recognition/meeting-summary/', { text });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '生成会议纪要失败',
      error
    };
  }
};

/**
 * 获取支持的语言
 * @returns {Promise} - 语言列表
 */
export const getSupportedLanguages = async () => {
  try {
    const response = await instance.get('/voice-recognition/languages/');
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '获取支持的语言失败',
      error
    };
  }
};

/**
 * 获取转录历史
 * @param {object} params - 查询参数
 * @returns {Promise} - 转录历史列表
 */
export const getTranscriptionHistory = async (params = {}) => {
  try {
    const response = await instance.get('/voice-recognition/history/', { params });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '获取转录历史失败',
      error
    };
  }
};

/**
 * 获取转录详情
 * @param {string} id - 转录ID
 * @returns {Promise} - 转录详情
 */
export const getTranscriptionById = async (id) => {
  try {
    const response = await instance.get(`/voice-recognition/transcriptions/${id}/`);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '获取转录详情失败',
      error
    };
  }
};

/**
 * 删除转录
 * @param {string} id - 转录ID
 * @returns {Promise} - 删除结果
 */
export const deleteTranscription = async (id) => {
  try {
    await instance.delete(`/voice-recognition/transcriptions/${id}/`);
    return {
      success: true
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '删除转录失败',
      error
    };
  }
};

/**
 * 创建笔记从转录
 * @param {string} id - 转录ID
 * @param {object} noteData - 笔记数据
 * @returns {Promise} - 创建结果
 */
export const createNoteFromTranscription = async (id, noteData) => {
  try {
    const response = await instance.post(`/voice-recognition/transcriptions/${id}/create-note/`, noteData);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '从转录创建笔记失败',
      error
    };
  }
};

const voiceApi = {
  transcribeAudio,
  processVoiceCommand,
  processMeetingAudio,
  generateMeetingSummary,
  getSupportedLanguages,
  getTranscriptionHistory,
  getTranscriptionById,
  deleteTranscription,
  createNoteFromTranscription
};

export default voiceApi;
