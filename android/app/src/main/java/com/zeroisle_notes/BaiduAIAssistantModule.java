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
import org.json.JSONException;

import java.io.BufferedReader;
import java.io.DataOutputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import android.util.Base64;

/**
 * 百度AI助手模块
 * 使用百度AI平台的自然语言处理能力
 */
public class BaiduAIAssistantModule extends ReactContextBaseJavaModule {
    private static final String TAG = "BaiduAIAssistant";
    private final ReactApplicationContext reactContext;
    private String sessionId;
    private String accessToken;

    // 默认API密钥（实际应用中应从配置文件或安全存储中获取）
    private String apiKey = "";
    private String secretKey = "";

    // 当前使用的模型
    private String currentModel = "ernie_bot";

    public BaiduAIAssistantModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
        this.sessionId = UUID.randomUUID().toString();
    }

    @Override
    public String getName() {
        return "BaiduAIAssistant";
    }

    @Override
    public Map<String, Object> getConstants() {
        final Map<String, Object> constants = new HashMap<>();
        constants.put("MODEL_ERNIE_BOT", "ernie_bot");
        constants.put("MODEL_ERNIE_BOT_TURBO", "ernie_bot_turbo");
        constants.put("MODEL_ERNIE_BOT_4", "ernie_bot_4");
        return constants;
    }

    @ReactMethod
    public void configure(ReadableMap config, Promise promise) {
        try {
            if (config.hasKey("apiKey")) {
                this.apiKey = config.getString("apiKey");
            }

            if (config.hasKey("secretKey")) {
                this.secretKey = config.getString("secretKey");
            }

            if (config.hasKey("model")) {
                this.currentModel = config.getString("model");
            }

            // 获取访问令牌
            getAccessToken(promise);
        } catch (Exception e) {
            Log.e(TAG, "Error configuring Baidu AI", e);
            promise.reject("CONFIG_ERROR", "配置百度AI失败: " + e.getMessage());
        }
    }

    @ReactMethod
    public void sendMessage(String message, Promise promise) {
        sendMessageWithModel(message, this.currentModel, promise);
    }

    @ReactMethod
    public void sendMessageWithModel(String message, String model, Promise promise) {
        try {
            if (apiKey.isEmpty() || secretKey.isEmpty()) {
                promise.reject("NOT_CONFIGURED", "请先配置百度AI的API密钥");
                return;
            }

            if (accessToken == null || accessToken.isEmpty()) {
                // 使用匿名内部类实现 Promise 接口
                Promise tokenPromise = new Promise() {
                    @Override
                    public void resolve(Object value) {
                        // 获取令牌成功后发送消息
                        sendChatRequest(message, model, promise);
                    }

                    @Override
                    public void reject(String code, String message) {
                        promise.reject(code, message);
                    }

                    @Override
                    public void reject(String code, Throwable throwable) {
                        promise.reject(code, throwable);
                    }

                    @Override
                    public void reject(String code, String message, Throwable throwable) {
                        promise.reject(code, message, throwable);
                    }

                    @Override
                    public void reject(Throwable throwable) {
                        promise.reject(throwable);
                    }

                    @Override
                    public void reject(String message) {
                        promise.reject(message);
                    }

                    // 这个方法不是接口中定义的，移除 @Override 注解
                    public void reject(Throwable throwable, String message) {
                        promise.reject("ERROR", message, throwable);
                    }

                    @Override
                    public void reject(Throwable throwable, WritableMap userInfo) {
                        promise.reject("ERROR", throwable);
                    }

                    @Override
                    public void reject(String code, WritableMap userInfo) {
                        promise.reject(code, userInfo);
                    }

                    @Override
                    public void reject(String code, Throwable throwable, WritableMap userInfo) {
                        promise.reject(code, throwable, userInfo);
                    }

                    @Override
                    public void reject(String code, String message, WritableMap userInfo) {
                        promise.reject(code, message, userInfo);
                    }

                    @Override
                    public void reject(String code, String message, Throwable throwable, WritableMap userInfo) {
                        promise.reject(code, message, throwable, userInfo);
                    }
                };

                getAccessToken(tokenPromise);
            } else {
                sendChatRequest(message, model, promise);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error in sendMessage", e);
            promise.reject("ERROR", "百度AI助手响应失败: " + e.getMessage());
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
     * 获取百度AI访问令牌
     */
    private void getAccessToken(Promise promise) {
        new Thread(() -> {
            try {
                String authUrl = "https://aip.baidubce.com/oauth/2.0/token";
                String params = "grant_type=client_credentials" +
                                "&client_id=" + apiKey +
                                "&client_secret=" + secretKey;

                URL url = new URL(authUrl);
                HttpURLConnection connection = (HttpURLConnection) url.openConnection();
                connection.setRequestMethod("POST");
                connection.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
                connection.setDoOutput(true);

                DataOutputStream out = new DataOutputStream(connection.getOutputStream());
                out.writeBytes(params);
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
                    accessToken = jsonResponse.getString("access_token");

                    WritableMap result = Arguments.createMap();
                    result.putString("accessToken", accessToken);
                    result.putInt("expiresIn", jsonResponse.getInt("expires_in"));

                    promise.resolve(result);
                } else {
                    promise.reject("AUTH_ERROR", "获取访问令牌失败，状态码: " + responseCode);
                }
            } catch (Exception e) {
                Log.e(TAG, "Error getting access token", e);
                promise.reject("AUTH_ERROR", "获取访问令牌失败: " + e.getMessage());
            }
        }).start();
    }

    /**
     * 发送聊天请求到百度AI
     */
    private void sendChatRequest(String message, String model, Promise promise) {
        new Thread(() -> {
            try {
                // 根据模型选择不同的API端点
                String apiUrl;
                if ("ernie_bot_4".equals(model)) {
                    apiUrl = "https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions_pro";
                } else if ("ernie_bot_turbo".equals(model)) {
                    apiUrl = "https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/eb-instant";
                } else {
                    // 默认使用文心一言标准版
                    apiUrl = "https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions";
                }

                URL url = new URL(apiUrl + "?access_token=" + accessToken);

                HttpURLConnection connection = (HttpURLConnection) url.openConnection();
                connection.setRequestMethod("POST");
                connection.setRequestProperty("Content-Type", "application/json");
                connection.setDoOutput(true);

                // 构建请求体
                JSONObject requestBody = new JSONObject();
                requestBody.put("messages", "[{\"role\":\"user\",\"content\":\"" + message + "\"}]");
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
                    String responseText = jsonResponse.getJSONObject("result").getString("content");

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
