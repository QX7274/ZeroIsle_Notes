package com.zeroisle_notes;

import android.util.Log;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

/**
 * 开发态诊断日志桥。
 * 用于在 JS console 链路不稳定时，仍能把关键诊断直接写入 Android Logcat。
 */
public class DebugLogModule extends ReactContextBaseJavaModule {
    private static final String MODULE_NAME = "DebugLogModule";
    private static final String DEFAULT_TAG = "ZeroIsleDebug";

    public DebugLogModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @NonNull
    @Override
    public String getName() {
        return MODULE_NAME;
    }

    @ReactMethod
    public void log(String level, String tag, String message) {
        final String safeLevel = level == null ? "info" : level.trim().toLowerCase();
        final String safeTag = sanitizeTag(tag);
        final String safeMessage = message == null ? "" : message;

        switch (safeLevel) {
            case "error":
                Log.e(safeTag, safeMessage);
                break;
            case "warn":
                Log.w(safeTag, safeMessage);
                break;
            case "debug":
                Log.d(safeTag, safeMessage);
                break;
            case "verbose":
                Log.v(safeTag, safeMessage);
                break;
            case "info":
            default:
                Log.i(safeTag, safeMessage);
                break;
        }
    }

    private String sanitizeTag(String tag) {
        if (tag == null) {
            return DEFAULT_TAG;
        }

        final String trimmed = tag.trim();
        if (trimmed.isEmpty()) {
            return DEFAULT_TAG;
        }

        return trimmed.length() > 23 ? trimmed.substring(0, 23) : trimmed;
    }
}
