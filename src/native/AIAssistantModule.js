
import { NativeModules, NativeEventEmitter } from 'react-native';
const { AIAssistant } = NativeModules;
import apiClient from '../services/api/apiClient';
import tokenService from '../services/auth/tokenService';

// 引擎类型常量
const ENGINE_BAIDU = 'baidu';
const ENGINE_XUNFEI = 'xunfei';
const ENGINE_ZHIPU = 'zhipu';
const ENGINE_QIANFAN = 'qianfan';
const ENGINE_MOONSHOT = 'moonshot';

// 模型常量
const MODEL_ERNIE_BOT = 'ernie_bot';
const MODEL_ERNIE_BOT_TURBO = 'ernie_bot_turbo';
const MODEL_SPARK_DESK = 'spark_desk';
const MODEL_SPARK_DESK_V3 = 'spark_desk_v3';
const MODEL_CHATGLM_TURBO = 'chatglm_turbo';
const MODEL_CHATGLM_PRO = 'chatglm_pro';
const MODEL_QIANFAN_BLOOMZ = 'qianfan_bloomz';
const MODEL_QIANFAN_LLAMA = 'qianfan_llama';
const MODEL_MOONSHOT_V1 = 'moonshot_v1';

// API基础URL
import { API_URL, API_VERSION } from '../config';
const API_BASE_URL = `${API_URL}/api/${API_VERSION}`;

// 获取API URL
const getApiUrl = (endpoint) => `${API_BASE_URL}/${endpoint}`;

export default {
    // 引擎类型
    ENGINE_BAIDU,
    ENGINE_XUNFEI,
    ENGINE_ZHIPU,
    ENGINE_QIANFAN,
    ENGINE_MOONSHOT,

    // 模型常量
    MODEL_ERNIE_BOT,
    MODEL_ERNIE_BOT_TURBO,
    MODEL_SPARK_DESK,
    MODEL_SPARK_DESK_V3,
    MODEL_CHATGLM_TURBO,
    MODEL_CHATGLM_PRO,
    MODEL_QIANFAN_BLOOMZ,
    MODEL_QIANFAN_LLAMA,
    MODEL_MOONSHOT_V1,

    /**
     * 获取API URL
     * @param {string} endpoint - API端点
     * @returns {string} - 完整的API URL
     */
    getApiUrl: getApiUrl,

    /**
     * 发送消息到AI助手
     * @param {string} message - 用户消息
     * @param {string} engine - 使用的引擎类型
     * @returns {Promise<Object>} - 包含AI回复的Promise
     */
    sendMessage: (message, engine = ENGINE_BAIDU) => {
        // 使用 apiClient 以注入认证令牌
        return apiClient.post('ai-assistant/chat/', {
            prompt: message,
            engine: engine,
            stream: false,
        })
            .then(response => {
                // apiClient 可能已经解包了 data，取决于其拦截器配置
                const responseData = response.data || response;
                return { text: responseData.response };
            })
            .catch(error => {
                console.error('API请求失败:', error);
                throw new Error(error.response?.data?.error || error.message);
            });
    },

    /**
     * 使用流式响应发送消息到AI助手
     * @param {string} message - 用户消息
     * @param {string} engine - 使用的引擎类型
     * @param {Array} history - 历史消息
     * @returns {Object} - 包含流式响应控制器
     */
    sendMessageStream: (message, options = {}) => {
        const {
            engine = ENGINE_BAIDU,
            model = null,
            history = [],
            prompt = null, // Custom system prompt
        } = options;

        // 创建回调函数
        let onMessageCallback = () => { };
        let onCompleteCallback = () => { };
        let onErrorCallback = () => { };
        let xhr = null;

        // 创建流式响应控制器
        const controller = {
            onMessage: (callback) => {
                onMessageCallback = callback;
                return controller;
            },
            onComplete: (callback) => {
                onCompleteCallback = callback;
                return controller;
            },
            onError: (callback) => {
                onErrorCallback = callback;
                return controller;
            },
            start: () => {
                const url = getApiUrl('ai-assistant/chat/');
                xhr = new XMLHttpRequest();
                xhr.open('POST', url);
                xhr.setRequestHeader('Content-Type', 'application/json');
                xhr.setRequestHeader('Accept', 'text/event-stream');

                let lastResponseLength = 0;
                xhr.onprogress = function () {
                    const newData = xhr.responseText.substring(lastResponseLength);
                    lastResponseLength = xhr.responseText.length;

                    const events = newData.split('\n\n');
                    for (const event of events) {
                        if (event.startsWith('data: ')) {
                            try {
                                const eventData = event.substring(6);
                                if (eventData.trim() === '[DONE]') {
                                    onCompleteCallback();
                                    return;
                                }
                                const jsonData = JSON.parse(eventData);
                                if (jsonData.error) {
                                    onErrorCallback(jsonData.error);
                                    return;
                                }
                                onMessageCallback(jsonData.content, jsonData.full_text);
                            } catch (e) {
                                // Ignore parsing errors for incomplete data chunks
                            }
                        }
                    }
                };

                xhr.onload = function () {
                    if (xhr.status !== 200) {
                        onErrorCallback(`Request failed with status: ${xhr.status}`);
                    }
                    onCompleteCallback();
                };

                xhr.onerror = function () {
                    onErrorCallback('Connection error');
                };

                const startAsync = async () => {
                    const tokenData = await tokenService.getAccessToken();
                    const authToken = tokenData ? tokenData.token : null;

                    if (authToken) {
                        xhr.setRequestHeader('Authorization', `Bearer ${authToken}`);
                    }

                    const payload = {
                        prompt: message,
                        engine: engine,
                        history: history,
                        stream: true,
                    };

                    if (model) {payload.model = model;}
                    if (prompt) {payload.system_prompt = prompt;}

                    xhr.send(JSON.stringify(payload));
                };

                startAsync();
                return controller;
            },
            stop: () => {
                if (xhr) {
                    xhr.abort();
                    xhr = null;
                }
            },
        };

        return controller;
    },

    /**
     * 重置会话
     */
    resetSession: () => {
        // 使用 apiClient 以注入认证令牌
        return apiClient.post('ai-assistant/reset-session/')
            .then(() => ({ success: true }))
            .catch(error => {
                console.error('重置会话失败:', error);
                throw new Error(error.response?.data?.error || error.message);
            });
    },

    /**
     * 配置百度AI
     * @param {Object} config - 配置对象，包含apiKey和secretKey
     * @returns {Promise<Object>} - 包含访问令牌的Promise
     */
    configureBaiduAI: (config) => {
        if (!BaiduAIAssistantModule) {
            return Promise.reject(new Error('百度AI模块不可用'));
        }

        return new Promise((resolve, reject) => {
            BaiduAIAssistantModule.configure(config)
                .then(result => resolve(result))
                .catch(error => reject(error));
        });
    },

    /**
     * 直接使用百度AI发送消息
     * @param {string} message - 用户消息
     * @returns {Promise<Object>} - 包含AI回复的Promise
     */
    sendMessageWithBaiduAI: (message) => {
        if (!BaiduAIAssistantModule) {
            return Promise.reject(new Error('百度AI模块不可用'));
        }

        return new Promise((resolve, reject) => {
            BaiduAIAssistantModule.sendMessage(message)
                .then(result => resolve(result))
                .catch(error => reject(error));
        });
    },

    /**
     * 使用指定模型发送消息到AI助手
     * @param {string} message - 用户消息
     * @param {string} engine - 使用的引擎类型
     * @param {string} model - 使用的模型类型
     * @returns {Promise<Object>} - 包含AI回复的Promise
     */
    sendMessageWithModel: (message, engine, model) => {
        // 使用 apiClient 以注入认证令牌
        return apiClient.post('ai-assistant/chat/', {
            prompt: message,
            engine: engine,
            model: model,
            stream: false,
        })
            .then(response => {
                const responseData = response.data || response;
                return { text: responseData.response };
            })
            .catch(error => {
                console.error('API请求失败:', error);
                throw new Error(error.response?.data?.error || error.message);
            });
    },

    /**
     * 配置讯飞AI
     * @param {Object} config - 配置对象，包含appId、apiKey和apiSecret
     * @returns {Promise<Object>} - 包含配置结果的Promise
     */
    configureXunfeiAI: (config) => {
        return new Promise((resolve, reject) => {
            if (!AIAssistantModule) {
                reject(new Error('AI助手模块不可用'));
                return;
            }

            // 这里应该调用讯飞AI配置模块，目前简单返回成功
            resolve({ success: true });
        });
    },

    /**
     * 配置智谱AI
     * @param {Object} config - 配置对象，包含apiKey
     * @returns {Promise<Object>} - 包含配置结果的Promise
     */
    configureZhipuAI: (config) => {
        return new Promise((resolve, reject) => {
            if (!AIAssistantModule) {
                reject(new Error('AI助手模块不可用'));
                return;
            }

            // 这里应该调用智谱AI配置模块，目前简单返回成功
            resolve({ success: true });
        });
    },

    /**
     * 配置千帆AI
     * @param {Object} config - 配置对象，包含apiKey和secretKey
     * @returns {Promise<Object>} - 包含配置结果的Promise
     */
    configureQianfanAI: (config) => {
        return new Promise((resolve, reject) => {
            if (!AIAssistantModule) {
                reject(new Error('AI助手模块不可用'));
                return;
            }

            // 这里应该调用千帆AI配置模块，目前简单返回成功
            resolve({ success: true });
        });
    },

    /**
     * 配置Moonshot AI
     * @param {Object} config - 配置对象，包含apiKey
     * @returns {Promise<Object>} - 包含配置结果的Promise
     */
    configureMoonshotAI: (config) => {
        return new Promise((resolve, reject) => {
            if (!AIAssistantModule) {
                reject(new Error('AI助手模块不可用'));
                return;
            }

            // 这里应该调用Moonshot AI配置模块，目前简单返回成功
            resolve({ success: true });
        });
    },

    sendNativeStreamingMessage: (message, options = {}) => {
        const {
            engine = 'default',
            model = 'default',
            prompt = '',
        } = options;

        const aiAssistantEmitter = new NativeEventEmitter(AIAssistant);
        let onMessageCallback = () => { };
        let onCompleteCallback = () => { };
        let onErrorCallback = () => { };
        let subscription = null;

        const controller = {
            onMessage: (callback) => {
                onMessageCallback = callback;
                return controller;
            },
            onComplete: (callback) => {
                onCompleteCallback = callback;
                return controller;
            },
            onError: (callback) => {
                onErrorCallback = callback;
                return controller;
            },
            start: () => {
                if (subscription) {
                    subscription.remove();
                }

                let fullText = '';
                subscription = aiAssistantEmitter.addListener('onAiStreamChunk', (event) => {
                    if (event.error) {
                        onErrorCallback(event.error);
                        controller.stop();
                        return;
                    }

                    fullText += event.chunk;
                    onMessageCallback(event.chunk, fullText);

                    if (event.isFinal) {
                        onCompleteCallback(fullText);
                        controller.stop();
                    }
                });

                AIAssistant.sendStreamingMessage(message, engine, model, { prompt });
                return controller;
            },
            stop: () => {
                if (subscription) {
                    subscription.remove();
                    subscription = null;
                }
            },
        };

        return controller;
    },
};
