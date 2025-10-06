package com.zeroisle_notes;

import android.content.Context;
import android.util.Log;
import android.view.MotionEvent;
import android.view.ViewGroup;
import android.widget.FrameLayout;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.modules.core.DeviceEventManagerModule;

/**
 * 触摸检测View
 * 直接拦截原生触摸事件并发送检测结果
 */
public class TouchDetectorView extends FrameLayout {
    private static final String TAG = "TouchDetectorView";
    private ReactApplicationContext reactContext;
    private String currentTouchType = "unknown";  // 当前触摸类型
    private long lastMoveEventTime = 0;  // 上次MOVE事件时间
    private static final long MOVE_EVENT_THROTTLE_MS = 8;  // MOVE事件节流间隔（约120fps）

    public TouchDetectorView(Context context) {
        super(context);
        if (context instanceof ReactApplicationContext) {
            this.reactContext = (ReactApplicationContext) context;
        } else if (context instanceof ThemedReactContext) {
            ThemedReactContext themed = (ThemedReactContext) context;
            if (themed.getReactApplicationContext() instanceof ReactApplicationContext) {
                this.reactContext = (ReactApplicationContext) themed.getReactApplicationContext();
            }
        }
        
        // 确保可以接收触摸事件
        setClickable(true);  // 必须true才能接收onTouchEvent
        setFocusable(true);
        
        Log.d(TAG, "TouchDetectorView 创建完成");
    }

    @Override
    public boolean onInterceptTouchEvent(MotionEvent event) {
        // 永远不拦截，让子组件正常接收事件
        // 我们只在这里检测类型，不改变事件流
        int pointerCount = event.getPointerCount();
        
        if (pointerCount >= 2) {
            Log.d(TAG, "检测到" + pointerCount + "指触摸，跳过检测");
            return false;
        }
        
        if (event.getActionMasked() == MotionEvent.ACTION_DOWN) {
            currentTouchType = TouchTypeDetectionModule.detectTouchTypeFromMotionEvent(event, 0);
            Log.d(TAG, "DOWN事件检测到触摸类型: " + currentTouchType);
        }
        
        return false;  // 永远不拦截
    }
    
    @Override
    public boolean onTouchEvent(MotionEvent event) {
        int action = event.getActionMasked();
        int pointerCount = event.getPointerCount();
        
        // 双指触摸：不处理
        if (pointerCount >= 2) {
            return false;
        }
        
        int pointerIndex = 0;
        
        // 处理所有单指触摸事件
        if (action == MotionEvent.ACTION_DOWN) {
            currentTouchType = TouchTypeDetectionModule.detectTouchTypeFromMotionEvent(event, pointerIndex);
            Log.d(TAG, "onTouchEvent DOWN: " + currentTouchType);
            sendTouchEvent(event, "down", currentTouchType, pointerIndex);
            
            // 触控笔：返回true继续接收事件
            // 手指：返回false让ScrollView处理
            return "stylus".equals(currentTouchType);
            
        } else if (action == MotionEvent.ACTION_MOVE) {
            // 只有触控笔模式才处理MOVE
            if ("stylus".equals(currentTouchType)) {
                long currentTime = System.currentTimeMillis();
                if (currentTime - lastMoveEventTime >= MOVE_EVENT_THROTTLE_MS) {
                    Log.d(TAG, "onTouchEvent MOVE: " + currentTouchType);
                    sendTouchEvent(event, "move", currentTouchType, pointerIndex);
                    lastMoveEventTime = currentTime;
                }
                return true;
            }
            return false;
            
        } else if (action == MotionEvent.ACTION_UP || action == MotionEvent.ACTION_CANCEL) {
            if ("stylus".equals(currentTouchType)) {
                Log.d(TAG, "onTouchEvent UP: " + currentTouchType);
                sendTouchEvent(event, "up", currentTouchType, pointerIndex);
                currentTouchType = "unknown";
                lastMoveEventTime = 0;
                return true;
            }
            return false;
        }
        
        return false;
    }
    
    private void sendTouchEvent(MotionEvent event, String eventType, String touchType, int pointerIndex) {
        WritableMap touchData = Arguments.createMap();
        touchData.putString("touchType", touchType);
        touchData.putString("eventType", eventType);
        touchData.putDouble("x", event.getX(pointerIndex));
        touchData.putDouble("y", event.getY(pointerIndex));
        touchData.putDouble("pressure", event.getPressure(pointerIndex));
        touchData.putDouble("size", event.getSize(pointerIndex));
        touchData.putInt("toolType", event.getToolType(pointerIndex));
        touchData.putDouble("timestamp", event.getEventTime());
        touchData.putInt("pointerId", event.getPointerId(pointerIndex));
        
        Log.d(TAG, "✅ 发送触摸事件: " + touchType + " (" + eventType + ")");
        
        if (reactContext != null && reactContext.hasActiveCatalystInstance()) {
            reactContext
                .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
                .emit("NativeTouchDetected", touchData);
        }
    }

}

