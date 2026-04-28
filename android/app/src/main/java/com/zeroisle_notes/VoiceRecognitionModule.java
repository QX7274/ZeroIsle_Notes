package com.zeroisle_notes;

import android.content.Intent;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.WritableNativeArray;
import com.facebook.react.bridge.WritableNativeMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;
import java.util.ArrayList;
import java.util.Locale;

public class VoiceRecognitionModule extends ReactContextBaseJavaModule {
    private static final String MODULE_NAME = "VoiceRecognitionModule";
    private final ReactApplicationContext reactContext;
    private SpeechRecognizer speechRecognizer;

    public VoiceRecognitionModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
        // 不在构造函数中创建SpeechRecognizer，延迟到使用时创建
        this.speechRecognizer = null;
    }
    
    private void ensureSpeechRecognizer() {
        if (speechRecognizer == null) {
            // 在主线程创建SpeechRecognizer
            reactContext.runOnUiQueueThread(() -> {
                if (speechRecognizer == null) {
                    speechRecognizer = SpeechRecognizer.createSpeechRecognizer(reactContext);
                }
            });
        }
    }

    @Override
    public String getName() {
        return MODULE_NAME;
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

    @ReactMethod
    public void startListening(Promise promise) {
        try {
            ensureSpeechRecognizer();
            
            // 等待SpeechRecognizer创建完成
            reactContext.runOnUiQueueThread(() -> {
                try {
                    if (speechRecognizer == null) {
                        promise.reject("ERROR", "语音识别器初始化失败");
                        return;
                    }
                    
                    Intent intent = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
                    intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
                    intent.putExtra(RecognizerIntent.EXTRA_LANGUAGE, Locale.getDefault());
                    intent.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
                    intent.putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true);

                    speechRecognizer.setRecognitionListener(new RecognitionListener() {
                @Override
                public void onReadyForSpeech(android.os.Bundle params) {}

                @Override
                public void onBeginningOfSpeech() {}

                @Override
                public void onRmsChanged(float rmsdB) {}

                @Override
                public void onBufferReceived(byte[] buffer) {}

                @Override
                public void onEndOfSpeech() {}

                @Override
                public void onError(int error) {
                    promise.reject("ERROR", "语音识别错误: " + error);
                }

                @Override
                public void onResults(android.os.Bundle results) {
                    ArrayList<String> matches = results.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    if (matches != null && !matches.isEmpty()) {
                        WritableNativeMap result = new WritableNativeMap();
                        result.putString("text", matches.get(0));
                        promise.resolve(result);
                    } else {
                        promise.reject("ERROR", "未识别到语音");
                    }
                }

                @Override
                public void onPartialResults(android.os.Bundle partialResults) {
                    ArrayList<String> matches = partialResults.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    if (matches != null && !matches.isEmpty()) {
                        WritableNativeMap result = new WritableNativeMap();
                        result.putString("text", matches.get(0));
                        promise.resolve(result);
                    }
                }

                @Override
                public void onEvent(int eventType, android.os.Bundle params) {}
                    });

                    speechRecognizer.startListening(intent);
                } catch (Exception e) {
                    promise.reject("ERROR", "启动语音识别失败: " + e.getMessage());
                }
            });
        } catch (Exception e) {
            promise.reject("ERROR", "启动语音识别失败: " + e.getMessage());
        }
    }

    @ReactMethod
    public void stopListening() {
        reactContext.runOnUiQueueThread(() -> {
            if (speechRecognizer != null) {
                speechRecognizer.stopListening();
            }
        });
    }

    @ReactMethod
    public void destroy() {
        reactContext.runOnUiQueueThread(() -> {
            if (speechRecognizer != null) {
                speechRecognizer.destroy();
                speechRecognizer = null;
            }
        });
    }
} 