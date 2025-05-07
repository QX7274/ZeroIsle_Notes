/**
 * AI助手状态切片
 */
import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { aiAssistantApi } from '../../services/api';
import AsyncStorage from '@react-native-async-storage/async-storage';

// 存储键
const STORAGE_KEYS = {
  AI_ENGINE: 'ai_engine',
  AI_MODEL: 'ai_model',
  CHAT_HISTORY: 'ai_chat_history',
  STREAM_RESPONSE: 'stream_response',
  VOICE_ENABLED: 'voice_enabled',
  MARKDOWN_ENABLED: 'markdown_enabled',
};

// 选择器
export const selectMessages = (state) => state.aiAssistant.messages;
export const selectIsLoading = (state) => state.aiAssistant.isLoading;
export const selectError = (state) => state.aiAssistant.error;
export const selectAiEngine = (state) => state.aiAssistant.aiEngine;
export const selectAiModel = (state) => state.aiAssistant.aiModel;
export const selectAvailableModels = (state) => state.aiAssistant.availableModels;
export const selectStreamEnabled = (state) => state.aiAssistant.streamEnabled;
export const selectVoiceEnabled = (state) => state.aiAssistant.voiceEnabled;
export const selectMarkdownEnabled = (state) => state.aiAssistant.markdownEnabled;


// 初始状态
const initialState = {
  messages: [],
  isLoading: false,
  error: null,
  aiEngine: 'local', // local, openai, baidu, xunfei, zhipu
  aiModel: '',
  availableModels: [],
  streamEnabled: true,
  voiceEnabled: true,
  markdownEnabled: true,
  currentStreamController: null,
};

// 异步操作：发送消息
export const sendMessage = createAsyncThunk(
  'aiAssistant/sendMessage',
  async ({ message, history }, { getState, dispatch, rejectWithValue }) => {
    try {
      const { aiEngine, aiModel, streamEnabled } = getState().aiAssistant;

      // 创建用户消息
      const userMessage = {
        id: Date.now().toString(),
        text: message,
        sender: 'user',
        timestamp: new Date().toISOString(),
      };

      // 添加用户消息到历史
      dispatch(addMessage(userMessage));

      // 创建初始助手消息
      const assistantMessageId = (Date.now() + 1).toString();
      const initialAssistantMessage = {
        id: assistantMessageId,
        text: streamEnabled ? '' : '...',
        sender: 'assistant',
        timestamp: new Date().toISOString(),
        isStreaming: streamEnabled,
      };

      // 添加初始助手消息
      dispatch(addMessage(initialAssistantMessage));

      // 准备聊天数据
      const chatData = {
        message,
        history: history || [],
        engine: aiEngine,
        model: aiModel,
      };

      if (streamEnabled) {
        // 使用流式响应
        const streamResponse = aiAssistantApi.sendStreamChatMessage(
          chatData,
          // 消息回调
          (content, fullText) => {
            dispatch(updateStreamingMessage({
              id: assistantMessageId,
              text: fullText,
            }));
          },
          // 完成回调
          (fullText) => {
            dispatch(completeStreamingMessage({
              id: assistantMessageId,
              text: fullText,
            }));
          },
          // 错误回调
          (error) => {
            dispatch(setStreamingMessageError({
              id: assistantMessageId,
              error: error.message || '发送消息失败',
            }));
          }
        );

        // 保存流控制器
        dispatch(setCurrentStreamController(streamResponse.controller));

        // 返回空对象，因为实际响应会通过回调处理
        return {};
      } else {
        // 使用普通响应
        const response = await aiAssistantApi.sendChatMessage(chatData);

        if (response.success) {
          // 更新助手消息
          const assistantMessage = {
            id: assistantMessageId,
            text: response.data.response,
            sender: 'assistant',
            timestamp: new Date().toISOString(),
          };

          return assistantMessage;
        } else {
          return rejectWithValue(response.message || '发送消息失败');
        }
      }
    } catch (error) {
      return rejectWithValue(error.message || '发送消息失败');
    }
  }
);

// 异步操作：获取可用模型
export const fetchAvailableModels = createAsyncThunk(
  'aiAssistant/fetchAvailableModels',
  async (_, { rejectWithValue }) => {
    try {
      const response = await aiAssistantApi.getAvailableModels();

      if (response.success) {
        return response.data.models;
      } else {
        return rejectWithValue(response.message || '获取可用模型失败');
      }
    } catch (error) {
      return rejectWithValue(error.message || '获取可用模型失败');
    }
  }
);

// 异步操作：重置会话
export const resetSession = createAsyncThunk(
  'aiAssistant/resetSession',
  async (_, { rejectWithValue }) => {
    try {
      const response = await aiAssistantApi.resetSession();

      if (response.success) {
        return response.data;
      } else {
        return rejectWithValue(response.message || '重置会话失败');
      }
    } catch (error) {
      return rejectWithValue(error.message || '重置会话失败');
    }
  }
);

// 异步操作：加载设置
export const loadSettings = createAsyncThunk(
  'aiAssistant/loadSettings',
  async (_, { dispatch }) => {
    try {
      const settings = {};

      // 加载AI引擎
      const savedEngine = await AsyncStorage.getItem(STORAGE_KEYS.AI_ENGINE);
      if (savedEngine) {
        settings.aiEngine = savedEngine;
      }

      // 加载AI模型
      const savedModel = await AsyncStorage.getItem(STORAGE_KEYS.AI_MODEL);
      if (savedModel) {
        settings.aiModel = savedModel;
      }

      // 加载流式响应设置
      const savedStreamEnabled = await AsyncStorage.getItem(STORAGE_KEYS.STREAM_RESPONSE);
      if (savedStreamEnabled !== null) {
        settings.streamEnabled = savedStreamEnabled === 'true';
      }

      // 加载语音设置
      const savedVoiceEnabled = await AsyncStorage.getItem(STORAGE_KEYS.VOICE_ENABLED);
      if (savedVoiceEnabled !== null) {
        settings.voiceEnabled = savedVoiceEnabled === 'true';
      }

      // 加载Markdown设置
      const savedMarkdownEnabled = await AsyncStorage.getItem(STORAGE_KEYS.MARKDOWN_ENABLED);
      if (savedMarkdownEnabled !== null) {
        settings.markdownEnabled = savedMarkdownEnabled === 'true';
      }

      return settings;
    } catch (error) {
      console.error('加载AI设置失败:', error);
      return {};
    }
  }
);

// 异步操作：保存设置
export const saveSettings = createAsyncThunk(
  'aiAssistant/saveSettings',
  async (settings, { getState }) => {
    try {
      const state = getState().aiAssistant;
      const newSettings = { ...state, ...settings };

      // 保存AI引擎
      if (settings.aiEngine !== undefined) {
        await AsyncStorage.setItem(STORAGE_KEYS.AI_ENGINE, newSettings.aiEngine);
      }

      // 保存AI模型
      if (settings.aiModel !== undefined) {
        await AsyncStorage.setItem(STORAGE_KEYS.AI_MODEL, newSettings.aiModel);
      }

      // 保存流式响应设置
      if (settings.streamEnabled !== undefined) {
        await AsyncStorage.setItem(STORAGE_KEYS.STREAM_RESPONSE, String(newSettings.streamEnabled));
      }

      // 保存语音设置
      if (settings.voiceEnabled !== undefined) {
        await AsyncStorage.setItem(STORAGE_KEYS.VOICE_ENABLED, String(newSettings.voiceEnabled));
      }

      // 保存Markdown设置
      if (settings.markdownEnabled !== undefined) {
        await AsyncStorage.setItem(STORAGE_KEYS.MARKDOWN_ENABLED, String(newSettings.markdownEnabled));
      }

      return settings;
    } catch (error) {
      console.error('保存AI设置失败:', error);
      return {};
    }
  }
);

// 异步操作：加载聊天历史
export const loadChatHistory = createAsyncThunk(
  'aiAssistant/loadChatHistory',
  async (_, { rejectWithValue }) => {
    try {
      const savedHistory = await AsyncStorage.getItem(STORAGE_KEYS.CHAT_HISTORY);

      if (savedHistory) {
        return JSON.parse(savedHistory);
      } else {
        // 添加欢迎消息
        const welcomeMessage = {
          id: Date.now().toString(),
          text: '你好！我是零屿笔记的AI助手，有什么可以帮助你的吗？',
          sender: 'assistant',
          timestamp: new Date().toISOString(),
        };

        await AsyncStorage.setItem(STORAGE_KEYS.CHAT_HISTORY, JSON.stringify([welcomeMessage]));
        return [welcomeMessage];
      }
    } catch (error) {
      return rejectWithValue(error.message || '加载聊天历史失败');
    }
  }
);

// 异步操作：保存聊天历史
export const saveChatHistory = createAsyncThunk(
  'aiAssistant/saveChatHistory',
  async (_, { getState, rejectWithValue }) => {
    try {
      const { messages } = getState().aiAssistant;
      await AsyncStorage.setItem(STORAGE_KEYS.CHAT_HISTORY, JSON.stringify(messages));
      return messages;
    } catch (error) {
      return rejectWithValue(error.message || '保存聊天历史失败');
    }
  }
);

// 创建切片
const aiAssistantSlice = createSlice({
  name: 'aiAssistant',
  initialState,
  reducers: {
    // 添加消息
    addMessage: (state, action) => {
      state.messages.push(action.payload);
    },
    // 更新流式消息
    updateStreamingMessage: (state, action) => {
      const { id, text } = action.payload;
      const messageIndex = state.messages.findIndex(msg => msg.id === id);

      if (messageIndex !== -1) {
        state.messages[messageIndex].text = text;
      }
    },
    // 完成流式消息
    completeStreamingMessage: (state, action) => {
      const { id, text } = action.payload;
      const messageIndex = state.messages.findIndex(msg => msg.id === id);

      if (messageIndex !== -1) {
        state.messages[messageIndex].text = text;
        state.messages[messageIndex].isStreaming = false;
      }

      state.isLoading = false;
      state.currentStreamController = null;
    },
    // 设置流式消息错误
    setStreamingMessageError: (state, action) => {
      const { id, error } = action.payload;
      const messageIndex = state.messages.findIndex(msg => msg.id === id);

      if (messageIndex !== -1) {
        state.messages[messageIndex].text = `抱歉，我遇到了一些问题: ${error}`;
        state.messages[messageIndex].isStreaming = false;
        state.messages[messageIndex].isError = true;
      }

      state.isLoading = false;
      state.error = error;
      state.currentStreamController = null;
    },
    // 设置当前流控制器
    setCurrentStreamController: (state, action) => {
      state.currentStreamController = action.payload;
    },
    // 取消当前流
    cancelCurrentStream: (state) => {
      if (state.currentStreamController) {
        state.currentStreamController.cancel();
        state.currentStreamController = null;
      }
    },
    // 清空消息
    clearMessages: (state) => {
      // 添加欢迎消息
      const welcomeMessage = {
        id: Date.now().toString(),
        text: '你好！我是零屿笔记的AI助手，有什么可以帮助你的吗？',
        sender: 'assistant',
        timestamp: new Date().toISOString(),
      };

      state.messages = [welcomeMessage];
    },
    // 设置AI引擎
    setAiEngine: (state, action) => {
      state.aiEngine = action.payload;
    },
    // 设置AI模型
    setAiModel: (state, action) => {
      state.aiModel = action.payload;
    },
    // 设置流式响应
    setStreamEnabled: (state, action) => {
      state.streamEnabled = action.payload;
    },
    // 设置语音启用
    setVoiceEnabled: (state, action) => {
      state.voiceEnabled = action.payload;
    },
    // 设置Markdown启用
    setMarkdownEnabled: (state, action) => {
      state.markdownEnabled = action.payload;
    },
    // 清除错误
    clearError: (state) => {
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    // 发送消息
    builder
      .addCase(sendMessage.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(sendMessage.fulfilled, (state, action) => {
        // 如果是流式响应，不需要在这里处理
        if (!state.streamEnabled && action.payload.id) {
          const messageIndex = state.messages.findIndex(msg => msg.id === action.payload.id);

          if (messageIndex !== -1) {
            state.messages[messageIndex] = action.payload;
          }

          state.isLoading = false;
        }
      })
      .addCase(sendMessage.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || '发送消息失败';
      });

    // 获取可用模型
    builder
      .addCase(fetchAvailableModels.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(fetchAvailableModels.fulfilled, (state, action) => {
        state.isLoading = false;
        state.availableModels = action.payload;
      })
      .addCase(fetchAvailableModels.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || '获取可用模型失败';
      });

    // 重置会话
    builder
      .addCase(resetSession.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(resetSession.fulfilled, (state) => {
        state.isLoading = false;
        // 清空消息
        const welcomeMessage = {
          id: Date.now().toString(),
          text: '你好！我是零屿笔记的AI助手，有什么可以帮助你的吗？',
          sender: 'assistant',
          timestamp: new Date().toISOString(),
        };
        state.messages = [welcomeMessage];
      })
      .addCase(resetSession.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || '重置会话失败';
      });

    // 加载设置
    builder
      .addCase(loadSettings.fulfilled, (state, action) => {
        const settings = action.payload;

        if (settings.aiEngine) {
          state.aiEngine = settings.aiEngine;
        }

        if (settings.aiModel) {
          state.aiModel = settings.aiModel;
        }

        if (settings.streamEnabled !== undefined) {
          state.streamEnabled = settings.streamEnabled;
        }

        if (settings.voiceEnabled !== undefined) {
          state.voiceEnabled = settings.voiceEnabled;
        }

        if (settings.markdownEnabled !== undefined) {
          state.markdownEnabled = settings.markdownEnabled;
        }
      });

    // 保存设置
    builder
      .addCase(saveSettings.fulfilled, (state, action) => {
        const settings = action.payload;

        if (settings.aiEngine !== undefined) {
          state.aiEngine = settings.aiEngine;
        }

        if (settings.aiModel !== undefined) {
          state.aiModel = settings.aiModel;
        }

        if (settings.streamEnabled !== undefined) {
          state.streamEnabled = settings.streamEnabled;
        }

        if (settings.voiceEnabled !== undefined) {
          state.voiceEnabled = settings.voiceEnabled;
        }

        if (settings.markdownEnabled !== undefined) {
          state.markdownEnabled = settings.markdownEnabled;
        }
      });

    // 加载聊天历史
    builder
      .addCase(loadChatHistory.pending, (state) => {
        state.isLoading = true;
        state.error = null;
      })
      .addCase(loadChatHistory.fulfilled, (state, action) => {
        state.isLoading = false;
        state.messages = action.payload;
      })
      .addCase(loadChatHistory.rejected, (state, action) => {
        state.isLoading = false;
        state.error = action.payload || '加载聊天历史失败';

        // 添加欢迎消息
        const welcomeMessage = {
          id: Date.now().toString(),
          text: '你好！我是零屿笔记的AI助手，有什么可以帮助你的吗？',
          sender: 'assistant',
          timestamp: new Date().toISOString(),
        };

        state.messages = [welcomeMessage];
      });
  },
});

// 导出操作
export const {
  addMessage,
  updateStreamingMessage,
  completeStreamingMessage,
  setStreamingMessageError,
  setCurrentStreamController,
  cancelCurrentStream,
  clearMessages,
  setAiEngine,
  setAiModel,
  setStreamEnabled,
  setVoiceEnabled,
  setMarkdownEnabled,
  clearError,
} = aiAssistantSlice.actions;

// 导出切片
export default aiAssistantSlice.reducer;
