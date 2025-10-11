package com.zeroisle_notes.nativepaged;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;

/**
 * 原生分页笔记模块
 * 提供分页笔记相关的原生功能
 */
public class NativePagedNoteModule extends ReactContextBaseJavaModule {
    
    public NativePagedNoteModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }
    
    @Override
    public String getName() {
        return "NativePagedNoteModule";
    }
    
    @ReactMethod
    public void isAvailable(Promise promise) {
        try {
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("PAGED_NOTE_MODULE_ERROR", e.getMessage());
        }
    }
    
    @ReactMethod
    public void getVersion(Promise promise) {
        try {
            promise.resolve("1.0.0");
        } catch (Exception e) {
            promise.reject("PAGED_NOTE_MODULE_ERROR", e.getMessage());
        }
    }
}
