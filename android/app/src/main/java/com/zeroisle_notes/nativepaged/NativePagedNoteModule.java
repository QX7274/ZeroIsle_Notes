package com.zeroisle_notes.nativepaged;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.Promise;
import android.os.Handler;
import android.os.Looper;
import android.view.View;

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

    @ReactMethod
    public void recognizeTextInRegion(final int viewTag, final double x, final double y, final double width, final double height, final Promise promise) {
        final ReactApplicationContext reactContext = getReactApplicationContext();
        if (reactContext == null) {
            promise.reject("E_NO_CONTEXT", "React context is null");
            return;
        }

        new Handler(Looper.getMainLooper()).post(() -> {
            try {
                if (reactContext.getCurrentActivity() == null) {
                    promise.reject("E_NO_ACTIVITY", "Current activity is null");
                    return;
                }

                View view = reactContext.getCurrentActivity().findViewById(viewTag);
                if (!(view instanceof NativePagedNoteView)) {
                    promise.reject("E_VIEW_NOT_FOUND", "View not found or is not a NativePagedNoteView");
                    return;
                }

                ((NativePagedNoteView) view).recognizeTextInRect((float) x, (float) y, (float) width, (float) height, promise);
            } catch (Exception e) {
                promise.reject("E_OCR_FAILED", e.getMessage(), e);
            }
        });
    }

    @ReactMethod
    public void recognizeHandwriting(final int viewTag, final int count, final Promise promise) {
        final ReactApplicationContext reactContext = getReactApplicationContext();
        if (reactContext == null) {
            promise.reject("E_NO_CONTEXT", "React context is null");
            return;
        }

        new Handler(Looper.getMainLooper()).post(() -> {
            try {
                if (reactContext.getCurrentActivity() == null) {
                    promise.reject("E_NO_ACTIVITY", "Current activity is null");
                    return;
                }

                View view = reactContext.getCurrentActivity().findViewById(viewTag);
                if (!(view instanceof NativePagedNoteView)) {
                    promise.reject("E_VIEW_NOT_FOUND", "View not found or is not a NativePagedNoteView");
                    return;
                }

                ((NativePagedNoteView) view).recognizeHandwriting(count, promise);
            } catch (Exception e) {
                promise.reject("E_HANDWRITING_FAILED", e.getMessage(), e);
            }
        });
    }
}
