package com.zeroisle_notes.nativepdf;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;

/**
 * 原生 PDF 模块
 * 提供 PDF 相关的原生功能
 */
public class NativePDFModule extends ReactContextBaseJavaModule {
    
    public NativePDFModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }
    
    @Override
    public String getName() {
        return "NativePDFModule";
    }
    
    @ReactMethod
    public void isAvailable(Promise promise) {
        try {
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("PDF_MODULE_ERROR", e.getMessage());
        }
    }
    
    @ReactMethod
    public void getVersion(Promise promise) {
        try {
            promise.resolve("1.0.0");
        } catch (Exception e) {
            promise.reject("PDF_MODULE_ERROR", e.getMessage());
        }
    }
}
