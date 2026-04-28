package com.zeroisle_notes.nativepdf;

import android.os.Handler;
import android.os.Looper;
import android.view.View;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

/**
 * 原生 PDF 模块
 * 提供 PDF 相关的原生功能（Promise API）
 */
public class NativePDFModule extends ReactContextBaseJavaModule {

    public NativePDFModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public String getName() {
        return "NativePDFModule";
    }

    /**
     * 添加事件监听器 - 为NativeEventEmitter提供支持
     */
    @ReactMethod
    public void addListener(String eventName) {}

    /**
     * 移除事件监听器 - 为NativeEventEmitter提供支持
     */
    @ReactMethod
    public void removeListeners(Integer count) {}

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

    /**
     * 本地OCR：识别 PDF 视图中指定矩形区域的文字
     * 与 iOS/Canvas 的 API 对齐：recognizeTextInRegion(reactTag, x,y,w,h)
     */
    @ReactMethod
    public void recognizeTextInRegion(final int viewTag, final double x, final double y, final double width, final double height, final Promise promise) {
        try {
            final ReactApplicationContext reactContext = getReactApplicationContext();
            if (reactContext == null) {
                promise.reject("E_NO_CONTEXT", "React context is null");
                return;
            }

            new Handler(Looper.getMainLooper()).post(new Runnable() {
                @Override
                public void run() {
                    try {
                        View view = reactContext.getCurrentActivity().findViewById(viewTag);
                        if (!(view instanceof NativePDFView)) {
                            promise.reject("E_VIEW_NOT_FOUND", "View not found or is not a NativePDFView");
                            return;
                        }
                        ((NativePDFView) view).recognizeTextInRect((float) x, (float) y, (float) width, (float) height, promise);
                    } catch (Exception e) {
                        promise.reject("E_OCR_FAILED", e.getMessage(), e);
                    }
                }
            });
        } catch (Exception e) {
            promise.reject("E_OCR_FAILED", e.getMessage(), e);
        }
    }
}

