package com.zeroisle_notes;

import android.util.Log;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReadableMap;

import org.json.JSONObject;
import org.json.JSONArray;
import org.json.JSONException;

import java.io.BufferedReader;
import java.io.DataOutputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import android.util.Base64;

/**
 * 智谱AI助手模块
 * 使用智谱AI的ChatGLM大模型
 */
public class ZhipuAIAssistantModule extends ReactContextBaseJavaModule {
    private static final String TAG = "ZhipuAIAssistant";
    private final ReactApplicationContext reactContext;
    private String sessionId;
    
    // 智谱API配置
    private String apiKey = "";
    
    // 当前使用的模型
    private String currentModel = "chatglm_turbo";

    public ZhipuAIAssistantModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
        this.sessionId = UUID.randomUUID().toString();
    }

    @Override
    public String getName() {
        return "ZhipuAIAssistant";
    }

    /**
     * 添加事件监听器 - 为NativeEventEmitter提供支持
     */
    @ReactMethod
    public void addListener(String eventName) {
        // 为NativeEventEmitter提供支持，实际事件处理在JS端
        // 这里只是满足NativeEventEmitter的要求
    }

    /**
     * 移除事件监听器 - 为NativeEventEmitter提供支持
     */
    @ReactMethod
    public void removeListeners(Integer count) {
        // 为NativeEventEmitter提供支持，实际事件处理在JS端
        // 这里只是满足NativeEventEmitter的要求
    }
    
    @Override
    public Map<String, Object> getConstants() {
        final Map<String, Object> constants = new HashMap<>();
        constants.put("MODEL_CHATGLM_TURBO", "chatglm_turbo");
        constants.put("MODEL_CHATGLM_PRO", "chatglm_pro");
        constants.put("MODEL_CHATGLM_STD", "chatglm_std");
        constants.put("MODEL_CHATGLM_LITE", "chatglm_lite");
        return constants;
    }

    @ReactMethod
    public void configure(ReadableMap config, Promise promise) {
        try {
            if (config.hasKey("apiKey")) {
                this.apiKey = config.getString("apiKey");
            }
            
            if (config.hasKey("model")) {
                this.currentModel = config.getString("model");
            }
            
            // 验证配置是否有效
            if (apiKey.isEmpty()) {
                promise.reject("INVALID_CONFIG", "智谱AI配置无效，请提供apiKey");
                return;
            }
            
            WritableMap result = Arguments.createMap();
            result.putBoolean("success", true);
            result.putString("model", currentModel);
            promise.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "Error configuring Zhipu AI", e);
            promise.reject("CONFIG_ERROR", "配置智谱AI失败: " + e.getMessage());
        }
    }

    @ReactMethod
    public void sendMessage(String message, Promise promise) {
        sendMessageWithModel(message, this.currentModel, promise);
    }
    
    @ReactMethod
    public void sendMessageWithModel(String message, String model, Promise promise) {
        try {
            if (apiKey.isEmpty()) {
                promise.reject("NOT_CONFIGURED", "请先配置智谱AI的apiKey");
                return;
            }
            
            sendChatRequest(message, model, promise);
        } catch (Exception e) {
            Log.e(TAG, "Error in sendMessage", e);
            promise.reject("ERROR", "智谱AI助手响应失败: " + e.getMessage());
        }
    }

    @ReactMethod
    public void resetSession() {
        sessionId = UUID.randomUUID().toString();
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
     * 生成JWT令牌
     */
    private String generateJwtToken(String apiKey) {
        try {
            // 解析API Key
            String[] parts = apiKey.split("\\.");
            if (parts.length != 2) {
                Log.e(TAG, "Invalid API Key format");
                return "";
            }
            
            String id = parts[0];
            String secret = parts[1];
            
            // 构建JWT头部
            JSONObject header = new JSONObject();
            header.put("alg", "HS256");
            header.put("typ", "JWT");
            String headerBase64 = Base64.encodeToString(header.toString().getBytes(), Base64.NO_WRAP | Base64.URL_SAFE);
            
            // 构建JWT载荷
            JSONObject payload = new JSONObject();
            long now = System.currentTimeMillis() / 1000;
            payload.put("api_key", id);
            payload.put("exp", now + 3600); // 1小时过期
            payload.put("timestamp", now);
            String payloadBase64 = Base64.encodeToString(payload.toString().getBytes(), Base64.NO_WRAP | Base64.URL_SAFE);
            
            // 生成签名
            String signatureInput = headerBase64 + "." + payloadBase64;
            Mac mac = Mac.getInstance("HmacSHA256");
            SecretKeySpec secretKeySpec = new SecretKeySpec(secret.getBytes(), "HmacSHA256");
            mac.init(secretKeySpec);
            byte[] signatureBytes = mac.doFinal(signatureInput.getBytes());
            String signature = Base64.encodeToString(signatureBytes, Base64.NO_WRAP | Base64.URL_SAFE);
            
            // 组合JWT
            return headerBase64 + "." + payloadBase64 + "." + signature;
        } catch (Exception e) {
            Log.e(TAG, "Error generating JWT token", e);
            return "";
        }
    }
    
    /**
     * 发送聊天请求到智谱AI
     */
    private void sendChatRequest(String message, String model, Promise promise) {
        new Thread(() -> {
            try {
                // 生成JWT令牌
                String jwtToken = generateJwtToken(apiKey);
                if (jwtToken.isEmpty()) {
                    promise.reject("AUTH_ERROR", "生成认证令牌失败");
                    return;
                }
                
                // 根据模型选择不同的API端点
                String apiUrl = "https://open.bigmodel.cn/api/paas/v4/chat/completions";
                
                // 根据模型ID映射到实际模型名称
                String actualModel;
                if ("chatglm_pro".equals(model)) {
                    actualModel = "glm-4";
                } else if ("chatglm_std".equals(model)) {
                    actualModel = "glm-3-turbo";
                } else if ("chatglm_lite".equals(model)) {
                    actualModel = "glm-3-lite";
                } else {
                    // 默认使用ChatGLM Turbo
                    actualModel = "glm-4";
                }
                
                URL url = new URL(apiUrl);
                HttpURLConnection connection = (HttpURLConnection) url.openConnection();
                connection.setRequestMethod("POST");
                connection.setRequestProperty("Content-Type", "application/json");
                connection.setRequestProperty("Authorization", "Bearer " + jwtToken);
                connection.setDoOutput(true);
                
                // 构建请求体
                JSONObject requestBody = new JSONObject();
                requestBody.put("model", actualModel);
                
                JSONArray messages = new JSONArray();
                JSONObject userMessage = new JSONObject();
                userMessage.put("role", "user");
                userMessage.put("content", message);
                messages.put(userMessage);
                
                requestBody.put("messages", messages);
                requestBody.put("temperature", 0.7);
                requestBody.put("stream", false);
                
                DataOutputStream out = new DataOutputStream(connection.getOutputStream());
                out.writeBytes(requestBody.toString());
                out.flush();
                out.close();
                
                int responseCode = connection.getResponseCode();
                if (responseCode == HttpURLConnection.HTTP_OK) {
                    BufferedReader in = new BufferedReader(new InputStreamReader(connection.getInputStream()));
                    String inputLine;
                    StringBuilder response = new StringBuilder();
                    
                    while ((inputLine = in.readLine()) != null) {
                        response.append(inputLine);
                    }
                    in.close();
                    
                    JSONObject jsonResponse = new JSONObject(response.toString());
                    JSONArray choices = jsonResponse.getJSONArray("choices");
                    JSONObject choice = choices.getJSONObject(0);
                    JSONObject message_obj = choice.getJSONObject("message");
                    String responseText = message_obj.getString("content");
                    
                    WritableMap result = Arguments.createMap();
                    result.putString("text", responseText);
                    result.putString("model", model);
                    
                    promise.resolve(result);
                } else {
                    // 如果请求失败，尝试读取错误信息
                    BufferedReader in = new BufferedReader(new InputStreamReader(connection.getErrorStream()));
                    String inputLine;
                    StringBuilder response = new StringBuilder();
                    
                    while ((inputLine = in.readLine()) != null) {
                        response.append(inputLine);
                    }
                    in.close();
                    
                    promise.reject("API_ERROR", "请求失败，状态码: " + responseCode + ", 错误: " + response.toString());
                }
            } catch (Exception e) {
                Log.e(TAG, "Error sending chat request", e);
                promise.reject("API_ERROR", "发送聊天请求失败: " + e.getMessage());
            }
        }).start();
    }
}
