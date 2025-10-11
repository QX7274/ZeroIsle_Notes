/**
 * 语音API服务
 */
import instance from './apiClient';
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

/**
 * 从录音转写文本
 * @param {string} audioBase64 - 音频Base64数据
 * @param {string|null} noteId - 关联的笔记ID(可选)
 * @returns {Promise} - 转写结果
 */
export const transcribeFromRecording = async (audioBase64, noteId = null) => {
  try {
    const data = {
      audio_base64: audioBase64
    };

    if (noteId) {
      data.note_id = noteId;
    }

    const response = await instance.post(API_ENDPOINTS.VOICE.TRANSCRIBE, data);
    return {
      success: true,
      text: response.data.text,
      language: response.data.language,
      id: response.data.id
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
 * 保存转写文本到笔记
 * @param {string} text - 转写文本
 * @param {string} noteId - 笔记ID
 * @returns {Promise} - 保存结果
 */
export const saveTranscribedTextToNote = async (text, noteId) => {
  try {
    const response = await instance.post(`/notes/${noteId}/append/`, {
      content: text
    });
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '保存转写文本失败',
      error
    };
  }
};

/**
 * 获取语音服务状态
 * @returns {Promise} - 服务状态
 */
export const getServiceStatus = async () => {
  try {
    const response = await instance.get(API_ENDPOINTS.VOICE.SERVICE_STATUS);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '获取语音服务状态失败',
      error
    };
  }
};

/**
 * 获取离线模型列表
 * @returns {Promise} - 离线模型列表
 */
export const getOfflineModels = async () => {
  try {
    const response = await instance.get(API_ENDPOINTS.VOICE.OFFLINE_MODELS);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '获取离线模型列表失败',
      error
    };
  }
};

/**
 * 下载离线模型
 * @param {string} modelName - 模型名称
 * @returns {Promise} - 下载结果
 */
export const downloadOfflineModel = async (modelName) => {
  try {
    const response = await instance.post(API_ENDPOINTS.VOICE.DOWNLOAD_MODEL, { model_name: modelName });
    return {
      success: true,
      message: response.data.message
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '下载离线模型失败',
      error
    };
  }
};

/**
 * 删除离线模型
 * @param {string} modelName - 模型名称
 * @returns {Promise} - 删除结果
 */
export const deleteOfflineModel = async (modelName) => {
  try {
    const response = await instance.post(API_ENDPOINTS.VOICE.DELETE_MODEL, { model_name: modelName });
    return {
      success: true,
      message: response.data.message
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '删除离线模型失败',
      error
    };
  }
};

/**
 * 更改当前使用的离线模型
 * @param {string} modelName - 模型名称
 * @returns {Promise} - 更改结果
 */
export const changeOfflineModel = async (modelName) => {
  try {
    const response = await instance.post(API_ENDPOINTS.VOICE.CHANGE_MODEL, { model_name: modelName });
    return {
      success: true,
      message: response.data.message
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '更改离线模型失败',
      error
    };
  }
};

/**
 * 切换服务模式（在线/离线）
 * @param {string} mode - 模式，可选值：auto, online, offline
 * @returns {Promise} - 切换结果
 */
export const toggleServiceMode = async (mode) => {
  try {
    const response = await instance.post(API_ENDPOINTS.VOICE.TOGGLE_MODE, { mode });
    return {
      success: true,
      message: response.data.message,
      currentMode: response.data.current_mode
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '切换服务模式失败',
      error
    };
  }
};

/**
 * 处理说话人分离
 * @param {string} transcriptionId - 转录ID
 * @param {string|null} mode - 模式，可选值：online, offline
 * @returns {Promise} - 处理结果
 */
export const processDiarization = async (transcriptionId, mode = null) => {
  try {
    const data = {
      transcription_id: transcriptionId
    };

    if (mode) {
      data.mode = mode;
    }

    const response = await instance.post('/voice-recognition/diarization/', data);
    return {
      success: true,
      message: response.data.message,
      transcriptionId: response.data.transcription_id,
      isSpeakerDiarization: response.data.is_speaker_diarization,
      segmentsCount: response.data.segments_count
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '处理说话人分离失败',
      error
    };
  }
};

/**
 * 获取说话人分离服务状态
 * @returns {Promise} - 服务状态
 */
export const getDiarizationStatus = async () => {
  try {
    const response = await instance.get('/voice-recognition/diarization-status/');
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '获取说话人分离服务状态失败',
      error
    };
  }
};

/**
 * 获取用户的所有说话人
 * @returns {Promise} - 说话人列表
 */
export const getSpeakers = async () => {
  try {
    const response = await instance.get('/voice-recognition/speakers/');
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '获取说话人列表失败',
      error
    };
  }
};

/**
 * 重命名说话人
 * @param {string} speakerId - 说话人ID
 * @param {string} newName - 新名称
 * @param {string|null} transcriptionId - 转录ID，可选
 * @returns {Promise} - 处理结果
 */
export const renameSpeaker = async (speakerId, newName, transcriptionId = null) => {
  try {
    const data = {
      speaker_id: speakerId,
      new_name: newName
    };

    if (transcriptionId) {
      data.transcription_id = transcriptionId;
    }

    const response = await instance.put('/voice-recognition/speakers/rename/', data);
    return {
      success: true,
      message: response.data.message,
      speaker: response.data.speaker
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '重命名说话人失败',
      error
    };
  }
};

/**
 * 合并多个说话人
 * @param {Array<string>} speakerIds - 说话人ID列表
 * @param {string|null} newName - 合并后的名称，可选
 * @param {string|null} transcriptionId - 转录ID，可选
 * @returns {Promise} - 处理结果
 */
export const mergeSpeakers = async (speakerIds, newName = null, transcriptionId = null) => {
  try {
    const data = {
      speaker_ids: speakerIds
    };

    if (newName) {
      data.new_name = newName;
    }

    if (transcriptionId) {
      data.transcription_id = transcriptionId;
    }

    const response = await instance.post('/voice-recognition/speakers/merge/', data);
    return {
      success: true,
      message: response.data.message,
      speaker: response.data.speaker
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '合并说话人失败',
      error
    };
  }
};

/**
 * 创建实时转写会话
 * @param {string} language - 语言代码，如'zh'、'en'等
 * @returns {Promise} - 会话ID
 */
export const createRealtimeSession = async (language = 'zh') => {
  try {
    const response = await instance.post('/voice-recognition/realtime/create-session/', { language });
    return {
      success: true,
      sessionId: response.data.session_id,
      message: response.data.message
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '创建实时转写会话失败',
      error
    };
  }
};

/**
 * 添加音频块
 * @param {string} sessionId - 会话ID
 * @param {string} audioChunk - 音频数据块（base64编码的字符串）
 * @returns {Promise} - 处理结果
 */
export const addRealtimeAudioChunk = async (sessionId, audioChunk) => {
  try {
    const response = await instance.post('/voice-recognition/realtime/add-audio/', {
      session_id: sessionId,
      audio_chunk: audioChunk
    });
    return {
      success: true,
      message: response.data.message
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '添加音频块失败',
      error
    };
  }
};

/**
 * 获取实时转写结果
 * @param {string} sessionId - 会话ID
 * @returns {Promise} - 转写结果
 */
export const getRealtimeResults = async (sessionId) => {
  try {
    const response = await instance.get(`/voice-recognition/realtime/get-results/?session_id=${sessionId}`);
    return {
      success: true,
      results: response.data.results,
      count: response.data.count
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '获取转写结果失败',
      error
    };
  }
};

/**
 * 结束实时转写会话
 * @param {string} sessionId - 会话ID
 * @returns {Promise} - 最终结果
 */
export const finishRealtimeSession = async (sessionId) => {
  try {
    const response = await instance.post('/voice-recognition/realtime/finish-session/', {
      session_id: sessionId
    });
    return {
      success: true,
      message: response.data.message,
      finalResult: response.data.final_result
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '结束会话失败',
      error
    };
  }
};

/**
 * 获取实时转写会话状态
 * @param {string} sessionId - 会话ID
 * @returns {Promise} - 会话状态
 */
export const getRealtimeSessionStatus = async (sessionId) => {
  try {
    const response = await instance.get(`/voice-recognition/realtime/session-status/?session_id=${sessionId}`);
    return {
      success: true,
      data: response.data
    };
  } catch (error) {
    return {
      success: false,
      message: error.message || '获取会话状态失败',
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
  createNoteFromTranscription,
  transcribeFromRecording,
  saveTranscribedTextToNote,
  getServiceStatus,
  getOfflineModels,
  downloadOfflineModel,
  deleteOfflineModel,
  changeOfflineModel,
  toggleServiceMode,
  processDiarization,
  getDiarizationStatus,
  getSpeakers,
  renameSpeaker,
  mergeSpeakers,
  createRealtimeSession,
  addRealtimeAudioChunk,
  getRealtimeResults,
  finishRealtimeSession,
  getRealtimeSessionStatus
};

export default voiceApi;
