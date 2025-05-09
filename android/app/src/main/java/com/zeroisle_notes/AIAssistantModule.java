package com.zeroisle_notes;

import android.util.Log;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReadableMap;

import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

/**
 * AI助手模块
 * 提供多种大模型选择和调用功能
 */
public class AIAssistantModule extends ReactContextBaseJavaModule {
    private static final String TAG = "AIAssistant";
    private final ReactApplicationContext reactContext;
    private String sessionId;
    private Map<String, String> conversationHistory;

    // 当前选择的模型
    private String currentModel = "local";

    public AIAssistantModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
        this.sessionId = UUID.randomUUID().toString();
        this.conversationHistory = new HashMap<>();
    }

    @Override
    public String getName() {
        return "AIAssistant";
    }

    @Override
    public Map<String, Object> getConstants() {
        final Map<String, Object> constants = new HashMap<>();

        // 引擎类型常量
        constants.put("ENGINE_BAIDU", "baidu");
        constants.put("ENGINE_XUNFEI", "xunfei");
        constants.put("ENGINE_ZHIPU", "zhipu");
        constants.put("ENGINE_QIANFAN", "qianfan");
        constants.put("ENGINE_MOONSHOT", "moonshot");

        // 模型常量
        constants.put("MODEL_ERNIE_BOT", "ernie_bot");
        constants.put("MODEL_ERNIE_BOT_TURBO", "ernie_bot_turbo");
        constants.put("MODEL_SPARK_DESK", "spark_desk");
        constants.put("MODEL_SPARK_DESK_V3", "spark_desk_v3");
        constants.put("MODEL_CHATGLM_TURBO", "chatglm_turbo");
        constants.put("MODEL_CHATGLM_PRO", "chatglm_pro");
        constants.put("MODEL_QIANFAN_BLOOMZ", "qianfan_bloomz");
        constants.put("MODEL_QIANFAN_LLAMA", "qianfan_llama");
        constants.put("MODEL_MOONSHOT_V1", "moonshot_v1");

        return constants;
    }

    @ReactMethod
    public void sendMessage(String message, String engine, Promise promise) {
        try {
            // 保存用户消息到历史记录
            conversationHistory.put("user_" + System.currentTimeMillis(), message);

            String response;
            if ("baidu".equals(engine)) {
                response = "请先配置百度AI引擎";
            } else if ("xunfei".equals(engine)) {
                response = "请先配置讯飞AI引擎";
            } else if ("zhipu".equals(engine)) {
                response = "请先配置智谱AI引擎";
            } else if ("qianfan".equals(engine)) {
                response = "请先配置千帆AI引擎";
            } else if ("moonshot".equals(engine)) {
                response = "请先配置Moonshot AI引擎";
            } else {
                // 默认响应
                response = "请先配置AI引擎";
            }

            // 保存助手回复到历史记录
            conversationHistory.put("assistant_" + System.currentTimeMillis(), response);

            WritableMap result = Arguments.createMap();
            result.putString("text", response);
            promise.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "Error in sendMessage", e);
            promise.reject("ERROR", "AI助手响应失败: " + e.getMessage());
        }
    }

    @ReactMethod
    public void sendMessageWithModel(String message, String engine, String model, Promise promise) {
        try {
            // 保存用户消息到历史记录
            conversationHistory.put("user_" + System.currentTimeMillis(), message);

            String response;
            if ("baidu".equals(engine)) {
                if ("ernie_bot".equals(model)) {
                    response = "使用百度文心一言(ERNIE Bot)回复: 这是一个模拟回复，请先配置百度AI引擎";
                } else if ("ernie_bot_turbo".equals(model)) {
                    response = "使用百度文心一言(ERNIE Bot Turbo)回复: 这是一个模拟回复，请先配置百度AI引擎";
                } else {
                    response = "使用百度AI引擎(" + model + ")回复: 这是一个模拟回复，请先配置百度AI引擎";
                }
            } else if ("xunfei".equals(engine)) {
                if ("spark_desk".equals(model)) {
                    response = "使用讯飞星火认知大模型回复: 这是一个模拟回复，请先配置讯飞AI引擎";
                } else if ("spark_desk_v3".equals(model)) {
                    response = "使用讯飞星火认知大模型V3回复: 这是一个模拟回复，请先配置讯飞AI引擎";
                } else {
                    response = "使用讯飞AI引擎(" + model + ")回复: 这是一个模拟回复，请先配置讯飞AI引擎";
                }
            } else if ("zhipu".equals(engine)) {
                if ("chatglm_turbo".equals(model)) {
                    response = "使用智谱ChatGLM-Turbo回复: 这是一个模拟回复，请先配置智谱AI引擎";
                } else if ("chatglm_pro".equals(model)) {
                    response = "使用智谱ChatGLM-Pro回复: 这是一个模拟回复，请先配置智谱AI引擎";
                } else {
                    response = "使用智谱AI引擎(" + model + ")回复: 这是一个模拟回复，请先配置智谱AI引擎";
                }
            } else if ("qianfan".equals(engine)) {
                response = "使用千帆AI引擎(" + model + ")回复: 这是一个模拟回复，请先配置千帆AI引擎";
            } else if ("moonshot".equals(engine)) {
                response = "使用Moonshot AI引擎(" + model + ")回复: 这是一个模拟回复，请先配置Moonshot AI引擎";
            } else {
                // 默认响应
                response = "请先配置AI引擎";
            }

            // 保存当前使用的模型
            this.currentModel = model;

            // 保存助手回复到历史记录
            conversationHistory.put("assistant_" + System.currentTimeMillis(), response);

            WritableMap result = Arguments.createMap();
            result.putString("text", response);
            promise.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "Error in sendMessageWithModel", e);
            promise.reject("ERROR", "AI助手响应失败: " + e.getMessage());
        }
    }

    @ReactMethod
    public void resetSession() {
        sessionId = UUID.randomUUID().toString();
        conversationHistory.clear();
    }

    @ReactMethod
    public void setModel(String model, Promise promise) {
        try {
            this.currentModel = model;
            WritableMap result = Arguments.createMap();
            result.putString("model", model);
            result.putBoolean("success", true);
            promise.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "Error setting model", e);
            promise.reject("ERROR", "设置模型失败: " + e.getMessage());
        }
    }

    @ReactMethod
    public void getCurrentModel(Promise promise) {
        try {
            WritableMap result = Arguments.createMap();
            result.putString("model", this.currentModel);
            promise.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "Error getting current model", e);
            promise.reject("ERROR", "获取当前模型失败: " + e.getMessage());
        }
    }


}
