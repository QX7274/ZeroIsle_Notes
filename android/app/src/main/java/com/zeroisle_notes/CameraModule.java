package com.zeroisle_notes;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;

/**
 * 注意：这个模块已经被注释掉，因为我们现在使用 react-native-camera 库
 * 这个文件只是一个占位符，以避免编译错误
 */
public class CameraModule extends ReactContextBaseJavaModule {
    private final ReactApplicationContext reactContext;

    public CameraModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @Override
    public String getName() {
        return "Camera";
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
    public void captureImage(Promise promise) {
        promise.reject("ERROR", "This method is deprecated. Please use react-native-camera instead.");
    }

    @ReactMethod
    public void startCamera() {
        // 空实现
    }

    @ReactMethod
    public void stopCamera() {
        // 空实现
    }
}