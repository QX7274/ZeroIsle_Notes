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
        constants.put("ENGINE_LOCAL", "local");
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
                // 默认使用本地引擎
                response = getLocalResponse(message);
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
                // 默认使用本地引擎
                response = getLocalResponse(message);
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
    
    /**
     * 获取本地响应
     * 基于简单的规则匹配，实际应用中可以使用更复杂的算法或本地模型
     */
    private String getLocalResponse(String message) {
        message = message.toLowerCase();
        
        if (message.contains("你好") || message.contains("hello") || message.contains("hi")) {
            return "你好！我是零屿笔记的AI助手，有什么可以帮助你的吗？";
        } else if (message.contains("谢谢") || message.contains("thank")) {
            return "不客气，随时为您服务！";
        } else if (message.contains("再见") || message.contains("bye")) {
            return "再见！有需要随时呼叫我。";
        } else if (message.contains("功能") || message.contains("help") || message.contains("帮助")) {
            return "我可以帮助你创建笔记、整理知识、回答问题等。请尝试具体的指令，如'创建一个关于机器学习的笔记'。";
        } else if (message.contains("模型") || message.contains("大模型") || message.contains("model")) {
            return "零屿笔记支持多种大模型，包括百度文心一言、讯飞星火、智谱ChatGLM等。您可以在设置中选择您喜欢的模型。";
        } else if (message.contains("笔记") || message.contains("note")) {
            if (message.contains("创建") || message.contains("新建") || message.contains("create")) {
                return "要创建新笔记，请点击主界面右下角的加号按钮，然后输入笔记内容。";
            } else if (message.contains("编辑") || message.contains("修改") || message.contains("edit")) {
                return "要编辑笔记，请在笔记列表中点击要编辑的笔记，然后进行修改。";
            } else if (message.contains("删除") || message.contains("remove")) {
                return "要删除笔记，请在笔记列表中长按要删除的笔记，然后点击删除按钮。";
            } else {
                return "零屿笔记支持文本笔记、手写笔记、语音笔记等多种形式，还可以添加标签和分类进行管理。";
            }
        } else if (message.contains("知识图谱") || message.contains("knowledge graph")) {
            return "知识图谱功能可以帮助你可视化知识结构，建立概念之间的联系。在知识图谱页面，你可以创建节点和连接，形成自己的知识网络。";
        } else if (message.contains("手写") || message.contains("handwriting")) {
            return "手写识别功能可以将你的手写内容转换为文本。点击笔记编辑界面的手写按钮，即可使用此功能。";
        } else if (message.contains("语音") || message.contains("voice")) {
            return "语音转文本功能可以将你的语音内容转换为文本。点击笔记编辑界面的麦克风按钮，即可使用此功能。";
        } else if (message.contains("设置") || message.contains("setting")) {
            return "在设置页面，你可以调整应用主题、字体大小、自动保存等选项，还可以管理你的账户信息和选择AI大模型。";
        } else if (message.contains("同步") || message.contains("sync")) {
            return "零屿笔记支持云同步功能，你的笔记可以在多个设备之间同步。请确保你已登录账户并开启了同步选项。";
        } else if (message.contains("备份") || message.contains("backup")) {
            return "要备份你的笔记，请前往设置-数据管理-备份，选择备份位置后点击开始备份。";
        } else if (message.contains("恢复") || message.contains("restore")) {
            return "要恢复备份的笔记，请前往设置-数据管理-恢复，选择备份文件后点击开始恢复。";
        } else if (message.contains("分享") || message.contains("share")) {
            return "要分享笔记，请在笔记查看界面点击右上角的分享按钮，选择分享方式即可。";
        } else if (message.contains("导出") || message.contains("export")) {
            return "零屿笔记支持将笔记导出为PDF、Word、Markdown等格式。在笔记查看界面点击右上角的更多按钮，选择导出即可。";
        } else if (message.contains("导入") || message.contains("import")) {
            return "要导入笔记，请前往设置-数据管理-导入，选择要导入的文件即可。";
        } else if (message.contains("标签") || message.contains("tag")) {
            return "标签功能可以帮助你更好地组织笔记。在笔记编辑界面，点击标签按钮即可添加或管理标签。";
        } else if (message.contains("搜索") || message.contains("search")) {
            return "要搜索笔记，请点击主界面顶部的搜索框，输入关键词即可。支持按标题、内容、标签等条件搜索。";
        } else if (message.contains("提醒") || message.contains("reminder")) {
            return "零屿笔记支持为笔记设置提醒功能。在笔记编辑界面，点击闹钟图标即可设置提醒时间。";
        } else {
            return "抱歉，我目前只能提供简单的回复。如果你有更复杂的问题，可以尝试在设置中选择其他AI大模型。";
        }
    }
}
