package com.zeroisle_notes;

import android.view.MotionEvent;
import android.view.View;
import android.util.Log;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import java.util.HashMap;
import java.util.Map;

/**
 * 触摸类型检测模块
 * 用于识别手指触摸和手写笔触摸
 */
public class TouchTypeDetectionModule extends ReactContextBaseJavaModule {
    private static final String TAG = "TouchTypeDetection";
    private static final String MODULE_NAME = "TouchTypeDetection";
    
    // 触摸类型常量
    public static final String TOUCH_TYPE_FINGER = "finger";
    public static final String TOUCH_TYPE_STYLUS = "stylus";
    public static final String TOUCH_TYPE_UNKNOWN = "unknown";
    
    // 事件名称
    private static final String EVENT_TOUCH_TYPE_DETECTED = "TouchTypeDetected";
    
    private final ReactApplicationContext reactContext;
    private boolean isListening = false;

    public TouchTypeDetectionModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @Override
    public String getName() {
        return MODULE_NAME;
    }

    @Override
    public Map<String, Object> getConstants() {
        final Map<String, Object> constants = new HashMap<>();
        constants.put("TOUCH_TYPE_FINGER", TOUCH_TYPE_FINGER);
        constants.put("TOUCH_TYPE_STYLUS", TOUCH_TYPE_STYLUS);
        constants.put("TOUCH_TYPE_UNKNOWN", TOUCH_TYPE_UNKNOWN);
        constants.put("EVENT_TOUCH_TYPE_DETECTED", EVENT_TOUCH_TYPE_DETECTED);
        return constants;
    }

    // RN 0.65+ NativeEventEmitter 需要的空实现，避免警告
    @ReactMethod
    public void addListener(String eventName) {
        // 留空：JS 侧添加事件监听时会调用
        Log.d(TAG, "addListener called for: " + eventName);
    }

    @ReactMethod
    public void removeListeners(Integer count) {
        // 留空：JS 侧移除事件监听时会调用
        Log.d(TAG, "removeListeners called, count=" + count);
    }

    /**
     * 开始监听触摸类型
     */
    @ReactMethod
    public void startListening(Promise promise) {
        try {
            isListening = true;
            Log.d(TAG, "开始监听触摸类型");
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "启动触摸监听失败", e);
            promise.reject("START_LISTENING_ERROR", e.getMessage());
        }
    }

    /**
     * 停止监听触摸类型
     */
    @ReactMethod
    public void stopListening(Promise promise) {
        try {
            isListening = false;
            Log.d(TAG, "停止监听触摸类型");
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "停止触摸监听失败", e);
            promise.reject("STOP_LISTENING_ERROR", e.getMessage());
        }
    }

    /**
     * 检测触摸事件类型
     */
    @ReactMethod
    public void detectTouchType(float x, float y, float pressure, float size, int toolType, Promise promise) {
        try {
            String touchType = determineTouchType(toolType, pressure, size);
            
            WritableMap result = Arguments.createMap();
            result.putString("touchType", touchType);
            result.putDouble("x", x);
            result.putDouble("y", y);
            result.putDouble("pressure", pressure);
            result.putDouble("size", size);
            result.putInt("toolType", toolType);
            result.putDouble("timestamp", System.currentTimeMillis());
            
            promise.resolve(result);
            
            // 如果正在监听，发送事件
            if (isListening) {
                sendTouchTypeEvent(result);
            }
            
        } catch (Exception e) {
            Log.e(TAG, "检测触摸类型失败", e);
            promise.reject("DETECT_TOUCH_TYPE_ERROR", e.getMessage());
        }
    }

    /**
     * 批量检测多个触摸点
     */
    @ReactMethod
    public void detectMultiTouchTypes(ReadableArray touchPoints, Promise promise) {
        try {
            WritableArray results = Arguments.createArray();

            for (int i = 0; i < touchPoints.size(); i++) {
                ReadableMap touchPoint = touchPoints.getMap(i);
                if (touchPoint != null) {
                    float x = (float) touchPoint.getDouble("x");
                    float y = (float) touchPoint.getDouble("y");
                    float pressure = (float) touchPoint.getDouble("pressure");
                    float size = (float) touchPoint.getDouble("size");
                    int toolType = touchPoint.getInt("toolType");
                    
                    String touchType = determineTouchType(toolType, pressure, size);
                    
                    WritableMap result = Arguments.createMap();
                    result.putString("touchType", touchType);
                    result.putDouble("x", x);
                    result.putDouble("y", y);
                    result.putDouble("pressure", pressure);
                    result.putDouble("size", size);
                    result.putInt("toolType", toolType);
                    result.putDouble("timestamp", System.currentTimeMillis());
                    result.putInt("pointerId", i);
                    
                    results.pushMap(result);
                }
            }
            
            promise.resolve(results);
            
        } catch (Exception e) {
            Log.e(TAG, "批量检测触摸类型失败", e);
            promise.reject("DETECT_MULTI_TOUCH_ERROR", e.getMessage());
        }
    }

    /**
     * 获取设备支持的触摸类型
     */
    @ReactMethod
    public void getSupportedTouchTypes(Promise promise) {
        try {
            WritableArray supportedTypes = Arguments.createArray();
            supportedTypes.pushString(TOUCH_TYPE_FINGER);
            supportedTypes.pushString(TOUCH_TYPE_STYLUS);
            
            WritableMap result = Arguments.createMap();
            result.putArray("supportedTypes", supportedTypes);
            result.putBoolean("hasStylus", true); // Android设备通常支持手写笔
            result.putBoolean("hasPressure", true);
            result.putBoolean("hasSize", true);
            
            promise.resolve(result);
            
        } catch (Exception e) {
            Log.e(TAG, "获取支持的触摸类型失败", e);
            promise.reject("GET_SUPPORTED_TYPES_ERROR", e.getMessage());
        }
    }

    /**
     * 根据工具类型、压力和大小判断触摸类型 - 改进版本
     */
    private String determineTouchType(int toolType, float pressure, float size) {
        Log.d(TAG, "检测触摸类型: toolType=" + toolType + ", pressure=" + pressure + ", size=" + size);
        
        // 基于Android MotionEvent的工具类型判断
        switch (toolType) {
            case MotionEvent.TOOL_TYPE_STYLUS:
                Log.d(TAG, "检测到手写笔 (TOOL_TYPE_STYLUS)");
                return TOUCH_TYPE_STYLUS;
            case MotionEvent.TOOL_TYPE_ERASER:
                Log.d(TAG, "检测到橡皮擦 (TOOL_TYPE_ERASER)");
                return TOUCH_TYPE_STYLUS;
            case MotionEvent.TOOL_TYPE_FINGER:
                Log.d(TAG, "检测到手指 (TOOL_TYPE_FINGER)");
                return TOUCH_TYPE_FINGER;
            case MotionEvent.TOOL_TYPE_UNKNOWN:
            default:
                // 如果工具类型未知，尝试通过压力和大小判断
                String detectedType = determineTouchTypeByPressureAndSize(pressure, size);
                Log.d(TAG, "通过压力/大小检测: " + detectedType);
                return detectedType;
        }
    }

    /**
     * 通过压力和大小判断触摸类型 - 改进版本
     */
    private String determineTouchTypeByPressureAndSize(float pressure, float size) {
        Log.d(TAG, "压力/大小检测: pressure=" + pressure + ", size=" + size);
        
        // 手写笔通常有更高的压力精度和更小的接触面积
        // 调整阈值以提高检测准确性
        if (pressure > 0.05f && size < 0.4f) {
            Log.d(TAG, "判断为手写笔: 压力=" + pressure + ", 大小=" + size);
            return TOUCH_TYPE_STYLUS;
        } else if (size > 0.3f || pressure < 0.1f) {
            Log.d(TAG, "判断为手指: 压力=" + pressure + ", 大小=" + size);
            return TOUCH_TYPE_FINGER;
        } else {
            Log.d(TAG, "无法确定类型: 压力=" + pressure + ", 大小=" + size);
            return TOUCH_TYPE_UNKNOWN;
        }
    }

    /**
     * 发送触摸类型检测事件
     */
    private void sendTouchTypeEvent(WritableMap touchData) {
        if (reactContext.hasActiveCatalystInstance()) {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit(EVENT_TOUCH_TYPE_DETECTED, touchData);
        }
    }

    /**
     * 处理原生触摸事件（供其他模块调用）
     */
    public static String detectTouchTypeFromMotionEvent(MotionEvent event, int pointerIndex) {
        int toolType = event.getToolType(pointerIndex);
        float pressure = event.getPressure(pointerIndex);
        float size = event.getSize(pointerIndex);
        
        Log.d(TAG, "原生触摸事件检测: toolType=" + toolType + ", pressure=" + pressure + ", size=" + size);
        
        switch (toolType) {
            case MotionEvent.TOOL_TYPE_STYLUS:
            case MotionEvent.TOOL_TYPE_ERASER:
                Log.d(TAG, "检测到手写笔: " + TOUCH_TYPE_STYLUS);
                return TOUCH_TYPE_STYLUS;
            case MotionEvent.TOOL_TYPE_FINGER:
                Log.d(TAG, "检测到手指: " + TOUCH_TYPE_FINGER);
                return TOUCH_TYPE_FINGER;
            case MotionEvent.TOOL_TYPE_UNKNOWN:
            default:
                // 通过压力和大小判断
                if (pressure > 0.1f && size < 0.3f) {
                    Log.d(TAG, "通过压力/大小检测到手写笔: " + TOUCH_TYPE_STYLUS);
                    return TOUCH_TYPE_STYLUS;
                } else if (size > 0.5f) {
                    Log.d(TAG, "通过大小检测到手指: " + TOUCH_TYPE_FINGER);
                    return TOUCH_TYPE_FINGER;
                } else {
                    Log.d(TAG, "无法确定触摸类型: " + TOUCH_TYPE_UNKNOWN);
                    return TOUCH_TYPE_UNKNOWN;
                }
        }
    }

    /**
     * 创建触摸数据对象（供其他模块调用）
     */
    public static WritableMap createTouchData(MotionEvent event, int pointerIndex) {
        WritableMap touchData = Arguments.createMap();
        
        touchData.putString("touchType", detectTouchTypeFromMotionEvent(event, pointerIndex));
        touchData.putDouble("x", event.getX(pointerIndex));
        touchData.putDouble("y", event.getY(pointerIndex));
        touchData.putDouble("pressure", event.getPressure(pointerIndex));
        touchData.putDouble("size", event.getSize(pointerIndex));
        touchData.putInt("toolType", event.getToolType(pointerIndex));
        touchData.putDouble("timestamp", event.getEventTime());
        touchData.putInt("pointerId", event.getPointerId(pointerIndex));
        
        return touchData;
    }

    /**
     * 处理触摸事件并自动发送检测结果
     */
    public static void handleTouchEvent(MotionEvent event, int pointerIndex, ReactApplicationContext context) {
        String touchType = detectTouchTypeFromMotionEvent(event, pointerIndex);
        
        WritableMap touchData = Arguments.createMap();
        touchData.putString("touchType", touchType);
        touchData.putDouble("x", event.getX(pointerIndex));
        touchData.putDouble("y", event.getY(pointerIndex));
        touchData.putDouble("pressure", event.getPressure(pointerIndex));
        touchData.putDouble("size", event.getSize(pointerIndex));
        touchData.putInt("toolType", event.getToolType(pointerIndex));
        touchData.putDouble("timestamp", event.getEventTime());
        touchData.putInt("pointerId", event.getPointerId(pointerIndex));
        
        Log.d(TAG, "发送触摸检测结果: " + touchType);
        
        // 发送事件到JavaScript层
        if (context.hasActiveCatalystInstance()) {
            context
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit(EVENT_TOUCH_TYPE_DETECTED, touchData);
        }
    }

    /**
     * 直接检测触摸类型（供JavaScript调用）
     */
    @ReactMethod
    public void detectTouchTypeDirect(double x, double y, double pressure, double size, int toolType, Promise promise) {
        try {
            String touchType = determineTouchType((int)toolType, (float)pressure, (float)size);
            
            WritableMap result = Arguments.createMap();
            result.putString("touchType", touchType);
            result.putDouble("x", x);
            result.putDouble("y", y);
            result.putDouble("pressure", pressure);
            result.putDouble("size", size);
            result.putInt("toolType", (int)toolType);
            result.putDouble("timestamp", System.currentTimeMillis());
            
            Log.d(TAG, "直接检测触摸类型: " + touchType);
            promise.resolve(result);
            
        } catch (Exception e) {
            Log.e(TAG, "直接检测触摸类型失败", e);
            promise.reject("DETECT_TOUCH_TYPE_DIRECT_ERROR", e.getMessage());
        }
    }

    /**
     * 开始全局触摸监听
     */
    @ReactMethod
    public void startGlobalTouchListener(Promise promise) {
        try {
            // 这里可以实现全局触摸监听
            // 由于React Native的限制，我们需要通过其他方式实现
            Log.d(TAG, "开始全局触摸监听");
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "开始全局触摸监听失败", e);
            promise.reject("START_GLOBAL_TOUCH_LISTENER_ERROR", e.getMessage());
        }
    }

    /**
     * 停止全局触摸监听
     */
    @ReactMethod
    public void stopGlobalTouchListener(Promise promise) {
        try {
            Log.d(TAG, "停止全局触摸监听");
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "停止全局触摸监听失败", e);
            promise.reject("STOP_GLOBAL_TOUCH_LISTENER_ERROR", e.getMessage());
        }
    }
}
