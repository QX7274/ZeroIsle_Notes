package com.zeroisle_notes;

import android.view.MotionEvent;
import android.util.Log;

/**
 * 简化的触摸类型检测工具类
 * 用于原生PDF、分页笔记和无限画布
 */
public class TouchTypeDetectionModule {
    private static final String TAG = "TouchTypeDetection";
    
    // 触摸类型常量
    public static final String TOUCH_TYPE_FINGER = "finger";
    public static final String TOUCH_TYPE_STYLUS = "stylus";
    public static final String TOUCH_TYPE_UNKNOWN = "unknown";
    
    /**
     * 检测触摸事件类型（简化版）
     * 直接基于 Android MotionEvent 的 toolType
     */
    public static String detectTouchTypeFromMotionEvent(MotionEvent event, int pointerIndex) {
        try {
            int toolType = event.getToolType(pointerIndex);
            
            switch (toolType) {
                case MotionEvent.TOOL_TYPE_STYLUS:
                case MotionEvent.TOOL_TYPE_ERASER:
                    return TOUCH_TYPE_STYLUS;
                    
                case MotionEvent.TOOL_TYPE_FINGER:
                    return TOUCH_TYPE_FINGER;
                    
                case MotionEvent.TOOL_TYPE_UNKNOWN:
                default:
                    // 未知类型：通过压力判断
                    float pressure = event.getPressure(pointerIndex);
                    float size = event.getSize(pointerIndex);
                    
                    // 手写笔通常压力>0且面积小
                    if (pressure > 0.05f && size < 0.5f) {
                        return TOUCH_TYPE_STYLUS;
                    } else {
                        return TOUCH_TYPE_FINGER;
                    }
            }
        } catch (Exception e) {
            Log.e(TAG, "检测触摸类型失败", e);
            return TOUCH_TYPE_UNKNOWN;
        }
    }
    
    /**
     * 判断是否是手写笔
     */
    public static boolean isStylus(MotionEvent event, int pointerIndex) {
        return TOUCH_TYPE_STYLUS.equals(detectTouchTypeFromMotionEvent(event, pointerIndex));
    }
    
    /**
     * 判断是否是手指
     */
    public static boolean isFinger(MotionEvent event, int pointerIndex) {
        return TOUCH_TYPE_FINGER.equals(detectTouchTypeFromMotionEvent(event, pointerIndex));
    }
}






