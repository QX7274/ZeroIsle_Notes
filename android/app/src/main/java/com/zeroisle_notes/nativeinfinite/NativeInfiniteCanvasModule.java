package com.zeroisle_notes.nativeinfinite;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;

/**
 * 原生无限画布模块
 * 提供无限画布相关的原生功能
 */
public class NativeInfiniteCanvasModule extends ReactContextBaseJavaModule {
    
    public NativeInfiniteCanvasModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }
    
    @Override
    public String getName() {
        return "NativeInfiniteCanvasModule";
    }
    
    @ReactMethod
    public void isAvailable(Promise promise) {
        try {
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("INFINITE_CANVAS_MODULE_ERROR", e.getMessage());
        }
    }
    
    @ReactMethod
    public void getVersion(Promise promise) {
        try {
            promise.resolve("1.0.0");
        } catch (Exception e) {
            promise.reject("INFINITE_CANVAS_MODULE_ERROR", e.getMessage());
        }
    }
}
