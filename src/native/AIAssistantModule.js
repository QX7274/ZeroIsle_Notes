import { NativeModules, Platform } from 'react-native';
import axios from 'axios';

const { AIAssistantModule, BaiduAIAssistantModule } = NativeModules;

// 引擎类型常量
const ENGINE_LOCAL = AIAssistantModule?.ENGINE_LOCAL || 'local';
const ENGINE_BAIDU = AIAssistantModule?.ENGINE_BAIDU || 'baidu';
const ENGINE_XUNFEI = AIAssistantModule?.ENGINE_XUNFEI || 'xunfei';
const ENGINE_ZHIPU = AIAssistantModule?.ENGINE_ZHIPU || 'zhipu';
const ENGINE_QIANFAN = AIAssistantModule?.ENGINE_QIANFAN || 'qianfan';
const ENGINE_MOONSHOT = AIAssistantModule?.ENGINE_MOONSHOT || 'moonshot';

// 模型常量
const MODEL_ERNIE_BOT = AIAssistantModule?.MODEL_ERNIE_BOT || 'ernie_bot';
const MODEL_ERNIE_BOT_TURBO = AIAssistantModule?.MODEL_ERNIE_BOT_TURBO || 'ernie_bot_turbo';
const MODEL_SPARK_DESK = AIAssistantModule?.MODEL_SPARK_DESK || 'spark_desk';
const MODEL_SPARK_DESK_V3 = AIAssistantModule?.MODEL_SPARK_DESK_V3 || 'spark_desk_v3';
const MODEL_CHATGLM_TURBO = AIAssistantModule?.MODEL_CHATGLM_TURBO || 'chatglm_turbo';
const MODEL_CHATGLM_PRO = AIAssistantModule?.MODEL_CHATGLM_PRO || 'chatglm_pro';
const MODEL_QIANFAN_BLOOMZ = AIAssistantModule?.MODEL_QIANFAN_BLOOMZ || 'qianfan_bloomz';
const MODEL_QIANFAN_LLAMA = AIAssistantModule?.MODEL_QIANFAN_LLAMA || 'qianfan_llama';
const MODEL_MOONSHOT_V1 = AIAssistantModule?.MODEL_MOONSHOT_V1 || 'moonshot_v1';

// API基础URL
const API_BASE_URL = 'http://localhost:8000/api';

// 获取API URL
const getApiUrl = (endpoint) => `${API_BASE_URL}/${endpoint}`;

export default {
    // 引擎类型
    ENGINE_LOCAL,
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
     * @param {string} engine - 使用的引擎类型，默认为本地引擎
     * @returns {Promise<Object>} - 包含AI回复的Promise
     */
    sendMessage: (message, engine = ENGINE_LOCAL) => {
        // 如果是本地引擎，使用原生模块
        if (engine === ENGINE_LOCAL && AIAssistantModule) {
            return new Promise((resolve, reject) => {
                AIAssistantModule.sendMessage(message, engine)
                    .then(result => resolve(result))
                    .catch(error => reject(error));
            });
        }

        // 如果是其他引擎，使用后端 API
        return axios.post(getApiUrl('ai-assistant/chat/'), {
            prompt: message,
            engine: engine,
            stream: false
        })
        .then(response => {
            return { text: response.data.response };
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
    sendMessageStream: (message, engine = ENGINE_LOCAL, history = []) => {
        // 创建回调函数
        let onMessageCallback = () => {};
        let onCompleteCallback = () => {};
        let onErrorCallback = () => {};
        let intervalId = null;
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
                // 如果是本地引擎，使用模拟流式响应
                if (engine === ENGINE_LOCAL) {
                    let fullText = '';
                    const mockResponse = '我是零屿笔记的AI助手，可以帮助你管理笔记、知识和任务。你可以问我任何问题，我会尽力提供帮助。';

                    // 模拟流式响应
                    let index = 0;
                    intervalId = setInterval(() => {
                        if (index < mockResponse.length) {
                            const char = mockResponse[index];
                            fullText += char;
                            onMessageCallback(char, fullText);
                            index++;
                        } else {
                            clearInterval(intervalId);
                            intervalId = null;
                            onCompleteCallback(fullText);
                        }
                    }, 50);

                    return controller;
                }

                // 使用XMLHttpRequest连接后端流式响应
                const url = getApiUrl('ai-assistant/chat/');

                // 使用axios发送POST请求并获取流式响应
                xhr = new XMLHttpRequest();
                xhr.open('POST', url);
                xhr.setRequestHeader('Content-Type', 'application/json');
                xhr.setRequestHeader('Accept', 'text/event-stream');

                // 添加认证头
                // TODO: 添加实际的认证头

                xhr.onreadystatechange = function() {
                    if (xhr.readyState === 3) {
                        // 流式响应中
                        const newData = xhr.responseText;

                        // 处理SSE格式的数据
                        const events = newData.split('\n\n');
                        let fullText = '';

                        for (const event of events) {
                            if (event.startsWith('data: ')) {
                                try {
                                    const jsonData = JSON.parse(event.substring(6));

                                    if (jsonData.error) {
                                        onErrorCallback(jsonData.error);
                                        return;
                                    }

                                    if (jsonData.done) {
                                        onCompleteCallback(jsonData.full_text);
                                        return;
                                    }

                                    fullText = jsonData.full_text;
                                    onMessageCallback(jsonData.content, fullText);
                                } catch (e) {
                                    console.error('解析SSE数据失败:', e);
                                }
                            }
                        }
                    } else if (xhr.readyState === 4) {
                        // 请求完成
                        if (xhr.status !== 200) {
                            onErrorCallback(`请求失败: ${xhr.status}`);
                        }
                    }
                };

                xhr.onerror = function() {
                    onErrorCallback('连接错误');
                };

                // 发送请求
                xhr.send(JSON.stringify({
                    prompt: message,
                    engine: engine,
                    history: history,
                    stream: true
                }));

                return controller;
            },
            stop: () => {
                if (intervalId) {
                    clearInterval(intervalId);
                    intervalId = null;
                }
                if (xhr) {
                    xhr.abort();
                    xhr = null;
                }
            }
        };

        return controller;
    },

    /**
     * 重置会话
     */
    resetSession: () => {
        AIAssistantModule.resetSession();
        if (BaiduAIAssistantModule) {
            BaiduAIAssistantModule.resetSession();
        }
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
        return new Promise((resolve, reject) => {
            AIAssistantModule.sendMessageWithModel(message, engine, model)
                .then(result => resolve(result))
                .catch(error => reject(error));
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
};