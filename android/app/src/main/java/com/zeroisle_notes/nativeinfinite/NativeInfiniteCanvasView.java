package com.zeroisle_notes.nativeinfinite;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Matrix;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.PointF;
import android.util.Log;
import android.view.MotionEvent;
import android.view.ScaleGestureDetector;
import android.view.View;
import android.view.GestureDetector;

import com.zeroisle_notes.TouchTypeDetectionModule;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.uimanager.events.RCTEventEmitter;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * 无限画布视图 - 支持任意方向平移和缩放
 */
public class NativeInfiniteCanvasView extends View {
    
    private static final float WORLD_SIZE = 100000f;
    private static final float MIN_SCALE = 0.1f;
    private static final float MAX_SCALE = 10f;
    
    private String canvasId;
    private float viewportX = 0;
    private float viewportY = 0;
    private float viewportScale = 1.0f;
    private boolean isInitialViewportSet = false;
    
    private List<StrokeData> strokes;
    private Path currentPath;
    private Paint currentPaint;
    private List<PointF> currentStrokePoints;
    
    // 撤销/重做历史栈
    private List<HistoryAction> undoStack;
    private List<HistoryAction> redoStack;
    private static final int MAX_HISTORY_SIZE = 100;
    
    // 画布样式配置
    private String backgroundStyle = "white";
    private int backgroundColor = Color.WHITE;
    private boolean hasPattern = false;
    private String patternType = null;
    
    private Matrix transformMatrix;
    private ScaleGestureDetector scaleDetector;
    private GestureDetector gestureDetector;
    
    // 平移手势状态
    private boolean isPanning = false;
    private float lastPanX = 0;
    private float lastPanY = 0;
    
    // viewport事件节流
    private long lastViewportEventTime = 0;
    private static final long VIEWPORT_EVENT_THROTTLE_MS = 50; // 50ms节流
    
    public NativeInfiniteCanvasView(Context context) {
        super(context);
        initialize();
    }
    
    private void initialize() {
        strokes = new ArrayList<>();
        currentStrokePoints = new ArrayList<>();
        transformMatrix = new Matrix();
        
        // 初始化历史栈
        undoStack = new ArrayList<>();
        redoStack = new ArrayList<>();
        
        // 缩放手势检测器
        scaleDetector = new ScaleGestureDetector(getContext(), new ScaleGestureDetector.SimpleOnScaleGestureListener() {
            @Override
            public boolean onScale(ScaleGestureDetector detector) {
                float scaleFactor = detector.getScaleFactor();
                float focusX = detector.getFocusX();
                float focusY = detector.getFocusY();
                
                // 保存当前变换
                float[] values = new float[9];
                transformMatrix.getValues(values);
                float currentScale = values[0];
                
                // 计算新的缩放比例
                float newScale = currentScale * scaleFactor;
                newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));
                scaleFactor = newScale / currentScale;
                
                // 以焦点为中心缩放
                transformMatrix.postScale(scaleFactor, scaleFactor, focusX, focusY);
                
                invalidate();
                
                // 发送视口变化事件
                sendViewportChangeEvent();
                
                return true;
            }
        });
        
        // 手势检测器（用于双击等）
        gestureDetector = new GestureDetector(getContext(), new GestureDetector.SimpleOnGestureListener() {
            @Override
            public boolean onDoubleTap(MotionEvent e) {
                // 双击重置视图
                resetViewport();
                return true;
            }
        });
        
        setWillNotDraw(false);
        applyBackgroundStyle();
        
        // 确保视图可以接收触摸事件
        setClickable(true);
        setFocusable(true);
        setFocusableInTouchMode(true);
        
        Log.d("NativeInfiniteCanvasView", "初始化完成，触摸事件设置: clickable=true, focusable=true");
        
        // 延迟初始化变换矩阵，等待视图尺寸确定
        post(new Runnable() {
            @Override
            public void run() {
                // 初始化变换：将原点放在屏幕中心
                transformMatrix.reset();
                transformMatrix.postTranslate(getWidth() / 2f, getHeight() / 2f);
                invalidate();
                sendReadyEvent();
            }
        });
    }
    
    private void resetViewport() {
        transformMatrix.reset();
        transformMatrix.postTranslate(getWidth() / 2f, getHeight() / 2f);
        invalidate();
        sendViewportChangeEvent();
    }
    
    private void sendViewportChangeEvent() {
        long now = System.currentTimeMillis();
        if (now - lastViewportEventTime < VIEWPORT_EVENT_THROTTLE_MS) {
            return; // 跳过太频繁的事件
        }
        lastViewportEventTime = now;
        
        float[] values = new float[9];
        transformMatrix.getValues(values);
        
        WritableMap event = Arguments.createMap();
        event.putDouble("translateX", values[Matrix.MTRANS_X]);
        event.putDouble("translateY", values[Matrix.MTRANS_Y]);
        event.putDouble("scale", values[Matrix.MSCALE_X]);
        
        sendEvent("onViewportChange", event);
    }
    
    private void sendReadyEvent() {
        WritableMap event = Arguments.createMap();
        event.putBoolean("ready", true);
        sendEvent("onReady", event);
        Log.d("NativeInfiniteCanvasView", "无限画布已就绪");
    }
    
    private void sendErrorEvent(String code, String message) {
        WritableMap event = Arguments.createMap();
        event.putString("code", code);
        event.putString("message", message);
        sendEvent("onError", event);
        Log.e("NativeInfiniteCanvasView", "错误: " + code + " - " + message);
    }

    private void updateTransform() {
        if (getWidth() == 0 || getHeight() == 0) {
            return; // 视图尺寸还未确定
        }
        
        transformMatrix.reset();
        transformMatrix.postScale(viewportScale, viewportScale);
        transformMatrix.postTranslate(
            getWidth() / 2f - viewportX * viewportScale,
            getHeight() / 2f - viewportY * viewportScale
        );
        invalidate();
    }
    
    @Override
    protected void onDraw(Canvas canvas) {
        super.onDraw(canvas);
        
        canvas.save();
        
        // 应用变换矩阵
        canvas.setMatrix(transformMatrix);
        
        // 在变换后的坐标系中绘制背景（世界坐标系）
        drawGridBackground(canvas);
        
        // 绘制所有笔迹
        for (StrokeData stroke : strokes) {
            canvas.drawPath(stroke.path, stroke.paint);
        }
        
        // 绘制当前笔迹
        if (currentPath != null && currentPaint != null) {
            canvas.drawPath(currentPath, currentPaint);
        }
        
        canvas.restore();
    }
    
    @Override
    public boolean onTouchEvent(MotionEvent event) {
        // 先让手势检测器处理
        gestureDetector.onTouchEvent(event);
        scaleDetector.onTouchEvent(event);
        
        float x = event.getX();
        float y = event.getY();
        
        // 检测触摸类型
        if (event.getAction() == MotionEvent.ACTION_DOWN) {
            currentTouchType = TouchTypeDetectionModule.detectTouchTypeFromMotionEvent(event, 0);
            isStylusMode = TouchTypeDetectionModule.TOUCH_TYPE_STYLUS.equals(currentTouchType);
            Log.d("NativeInfiniteCanvas", String.format("触摸类型: %s, 手写笔模式: %s, 工具: %s", 
                currentTouchType, isStylusMode, currentTool));
        }
        
        // 多指手势：缩放
        if (event.getPointerCount() >= 2) {
            isPanning = false;
            Log.d("NativeInfiniteCanvas", "双指缩放手势");
            return true;
        }
        
        // 单指操作
        if (isStylusMode) {
            // 手写笔：绘制
            PointF worldPoint = screenToWorld(x, y);
            switch (event.getAction()) {
                case MotionEvent.ACTION_DOWN:
                    Log.d("NativeInfiniteCanvas", "手写笔绘制开始");
                    startStroke(worldPoint);
                    return true;
                case MotionEvent.ACTION_MOVE:
                    continueStroke(worldPoint);
                    return true;
                case MotionEvent.ACTION_UP:
                    Log.d("NativeInfiniteCanvas", "手写笔绘制结束");
                    endStroke();
                    return true;
            }
        } else {
            // 手指：平移
            switch (event.getAction()) {
                case MotionEvent.ACTION_DOWN:
                    isPanning = true;
                    lastPanX = x;
                    lastPanY = y;
                    Log.d("NativeInfiniteCanvas", "手指平移开始");
                    return true;
                    
                case MotionEvent.ACTION_MOVE:
                    if (isPanning) {
                        float dx = x - lastPanX;
                        float dy = y - lastPanY;
                        
                        transformMatrix.postTranslate(dx, dy);
                        invalidate();
                        
                        lastPanX = x;
                        lastPanY = y;
                        
                        sendViewportChangeEvent();
                    }
                    return true;
                    
                case MotionEvent.ACTION_UP:
                case MotionEvent.ACTION_CANCEL:
                    Log.d("NativeInfiniteCanvas", "手指平移结束");
                    isPanning = false;
                    return true;
            }
        }
        
        return super.onTouchEvent(event);
    }
    
    
    // 确保视口在合理范围内
    private void ensureViewportBounds() {
        float[] values = new float[9];
        transformMatrix.getValues(values);
        
        // 限制缩放范围
        float scale = values[Matrix.MSCALE_X];
        if (scale < MIN_SCALE) {
            float factor = MIN_SCALE / scale;
            transformMatrix.postScale(factor, factor, getWidth() / 2f, getHeight() / 2f);
        } else if (scale > MAX_SCALE) {
            float factor = MAX_SCALE / scale;
            transformMatrix.postScale(factor, factor, getWidth() / 2f, getHeight() / 2f);
        }
    }
    
    // 发送事件到React Native
    private void sendEvent(String eventName, WritableMap params) {
        ReactContext reactContext = (ReactContext) getContext();
        reactContext.getJSModule(RCTEventEmitter.class).receiveEvent(getId(), eventName, params);
    }
    
    private PointF screenToWorld(float screenX, float screenY) {
        float[] pts = {screenX, screenY};
        Matrix inverse = new Matrix();
        if (transformMatrix.invert(inverse)) {
            inverse.mapPoints(pts);
        }
        return new PointF(pts[0], pts[1]);
    }

    private void startStroke(PointF worldPoint) {
        currentPath = new Path();
        currentPath.moveTo(worldPoint.x, worldPoint.y);
        
        currentPaint = new Paint();
        currentPaint.setColor(currentColor);
        currentPaint.setStrokeWidth(currentStrokeWidth);
        currentPaint.setStyle(Paint.Style.STROKE);
        currentPaint.setStrokeCap(Paint.Cap.ROUND);
        currentPaint.setStrokeJoin(Paint.Join.ROUND);
        currentPaint.setAntiAlias(true);
        
        currentStrokePoints.clear();
        currentStrokePoints.add(worldPoint);
        invalidate();
    }
    
    private void continueStroke(PointF worldPoint) {
        if (currentPath != null) {
            currentPath.lineTo(worldPoint.x, worldPoint.y);
            currentStrokePoints.add(worldPoint);
            invalidate();
        }
    }
    
    private void endStroke() {
        if (currentPath != null && currentStrokePoints.size() > 1) {
            StrokeData newStroke = new StrokeData(currentPath, currentPaint);
            strokes.add(newStroke);
            
            // 添加到撤销栈
            addToUndoStack(new HistoryAction(HistoryAction.Type.ADD_STROKE, newStroke));
            
            WritableMap event = Arguments.createMap();
            event.putString("strokeId", UUID.randomUUID().toString());
            sendEvent("onStrokeCommitted", event);
            
            currentPath = null;
            currentPaint = null;
            currentStrokePoints.clear();
            invalidate();
        }
    }
    
    public void setCanvasId(String canvasId) { this.canvasId = canvasId; }
    public void setViewport(ReadableMap viewport) {
        if (viewport.hasKey("x")) viewportX = (float) viewport.getDouble("x");
        if (viewport.hasKey("y")) viewportY = (float) viewport.getDouble("y");
        if (viewport.hasKey("scale")) viewportScale = (float) viewport.getDouble("scale");
        
        // 只在首次设置时应用变换，避免覆盖用户手势操作
        if (!isInitialViewportSet && getWidth() > 0 && getHeight() > 0) {
            updateTransform();
            invalidate();
            isInitialViewportSet = true;
            Log.d("NativeInfiniteCanvasView", "初始viewport已应用: x=" + viewportX + ", y=" + viewportY + ", scale=" + viewportScale);
        }
    }
    
    public void setStyleConfig(ReadableMap config) {
        if (config != null && config.hasKey("background")) {
            backgroundStyle = config.getString("background");
            applyBackgroundStyle();
            Log.d("NativeInfiniteCanvasView", "画布样式已设置: " + backgroundStyle);
        }
    }
    
    private void applyBackgroundStyle() {
        switch (backgroundStyle) {
            case "white":
                backgroundColor = Color.WHITE;
                hasPattern = false;
                patternType = null;
                break;
            case "yellow":
                backgroundColor = Color.parseColor("#FFF8DC");
                hasPattern = false;
                patternType = null;
                break;
            case "grid":
                backgroundColor = Color.WHITE;
                hasPattern = true;
                patternType = "grid";
                break;
            case "lines":
                backgroundColor = Color.WHITE;
                hasPattern = true;
                patternType = "lines";
                break;
            default:
                backgroundColor = Color.WHITE;
                hasPattern = false;
                patternType = null;
        }
        setBackgroundColor(backgroundColor);
        invalidate();
    }
    
    // 工具相关字段
    private String currentTool = "pen";
    private int currentColor = Color.BLACK;
    private float currentStrokeWidth = 2.0f;
    
    // 触摸类型检测
    private String currentTouchType = TouchTypeDetectionModule.TOUCH_TYPE_UNKNOWN;
    private boolean isStylusMode = false;
    
    private void drawGridBackground(Canvas canvas) {
        // 先填充整个画布背景色
        canvas.drawColor(backgroundColor);
        
        // 只在有图案时绘制网格或线条
        if (hasPattern && patternType != null) {
            Paint paint = new Paint();
            paint.setColor(Color.LTGRAY);
            paint.setStrokeWidth(1);
            paint.setAlpha(80);
            
            // 固定网格大小（世界坐标）
            float gridSize = 50f;
            
            // 计算当前可见的世界坐标范围（添加扩展边距确保覆盖）
            float[] corners = {
                0, 0,
                getWidth(), getHeight(),
                getWidth(), 0,
                0, getHeight()
            };
            Matrix inverse = new Matrix();
            if (transformMatrix.invert(inverse)) {
                inverse.mapPoints(corners);
            }
            
            float visibleLeft = Math.min(Math.min(corners[0], corners[2]), Math.min(corners[4], corners[6]));
            float visibleRight = Math.max(Math.max(corners[0], corners[2]), Math.max(corners[4], corners[6]));
            float visibleTop = Math.min(Math.min(corners[1], corners[3]), Math.min(corners[5], corners[7]));
            float visibleBottom = Math.max(Math.max(corners[1], corners[3]), Math.max(corners[5], corners[7]));
            
            // 添加大量边距确保完全覆盖
            float margin = gridSize * 10;
            float startX = (float) (Math.floor((visibleLeft - margin) / gridSize) * gridSize);
            float endX = (float) (Math.ceil((visibleRight + margin) / gridSize) * gridSize);
            float startY = (float) (Math.floor((visibleTop - margin) / gridSize) * gridSize);
            float endY = (float) (Math.ceil((visibleBottom + margin) / gridSize) * gridSize);
            
            // 根据图案类型绘制
            if ("grid".equals(patternType)) {
                // 绘制垂直线
                for (float x = startX; x <= endX; x += gridSize) {
                    canvas.drawLine(x, startY, x, endY, paint);
                }
                
                // 绘制水平线
                for (float y = startY; y <= endY; y += gridSize) {
                    canvas.drawLine(startX, y, endX, y, paint);
                }
            } else if ("lines".equals(patternType)) {
                // 只绘制水平线
                for (float y = startY; y <= endY; y += gridSize) {
                    canvas.drawLine(startX, y, endX, y, paint);
                }
            }
        }
        
        // 绘制原点标记
        Paint centerPaint = new Paint();
        centerPaint.setColor(Color.RED);
        centerPaint.setStrokeWidth(3);
        centerPaint.setAlpha(150);
        canvas.drawLine(-20, 0, 20, 0, centerPaint);
        canvas.drawLine(0, -20, 0, 20, centerPaint);
    }
    
    // 工具设置方法
    public void setDrawingTool(String tool) {
        this.currentTool = tool;
        // 更新绘制模式
        if ("pen".equals(tool)) {
            setEnabled(true);
        } else if ("highlighter".equals(tool)) {
            setEnabled(true);
        } else if ("eraser".equals(tool)) {
            setEnabled(true);
        }
    }
    
    public void setDrawingColor(String color) {
        this.currentColor = Color.parseColor(color);
    }
    
    public void setDrawingWidth(float width) {
        this.currentStrokeWidth = width;
    }
    
    // Manager 调用的方法别名
    public void setCurrentTool(String tool) {
        this.currentTool = tool;
    }
    
    public void setCurrentColor(String color) {
        this.currentColor = Color.parseColor(color);
    }
    
    public void setCurrentStrokeWidth(float width) {
        this.currentStrokeWidth = width;
    }
    
    public void setToolConfig(String configJson) {
        Log.d("NativeInfiniteCanvas", "Tool config received: " + configJson);
        // Tool configuration can be parsed and applied here if needed
    }
    
    public void setViewport(float x, float y, float scale) {
        this.viewportX = x;
        this.viewportY = y;
        this.viewportScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale));
        invalidate();
    }
    
    public void undo() {
        if (!undoStack.isEmpty()) {
            HistoryAction action = undoStack.remove(undoStack.size() - 1);
            
            switch (action.type) {
                case ADD_STROKE:
                    // 撤销添加笔迹
                    if (!strokes.isEmpty()) {
                        StrokeData removedStroke = strokes.remove(strokes.size() - 1);
                        action.strokeData = removedStroke; // 保存以便重做
                    }
                    break;
                case CLEAR:
                    // 撤销清除：恢复所有笔迹
                    strokes.addAll(action.clearedStrokes);
                    break;
            }
            
            // 添加到重做栈
            redoStack.add(action);
            invalidate();
            Log.d("NativeInfiniteCanvasView", "撤销操作完成");
        } else {
            Log.d("NativeInfiniteCanvasView", "没有可撤销的操作");
        }
    }
    
    public void redo() {
        if (!redoStack.isEmpty()) {
            HistoryAction action = redoStack.remove(redoStack.size() - 1);
            
            switch (action.type) {
                case ADD_STROKE:
                    // 重做添加笔迹
                    if (action.strokeData != null) {
                        strokes.add(action.strokeData);
                    }
                    break;
                case CLEAR:
                    // 重做清除
                    strokes.clear();
                    break;
            }
            
            // 添加回撤销栈
            undoStack.add(action);
            invalidate();
            Log.d("NativeInfiniteCanvasView", "重做操作完成");
        } else {
            Log.d("NativeInfiniteCanvasView", "没有可重做的操作");
        }
    }
    
    public void clear() {
        // 保存当前笔迹以便撤销
        List<StrokeData> clearedStrokes = new ArrayList<>(strokes);
        strokes.clear();
        
        // 添加到撤销栈
        addToUndoStack(new HistoryAction(HistoryAction.Type.CLEAR, clearedStrokes));
        
        invalidate();
        Log.d("NativeInfiniteCanvasView", "已清除所有笔迹");
    }
    
    private void addToUndoStack(HistoryAction action) {
        undoStack.add(action);
        
        // 清空重做栈（新操作会使重做栈失效）
        redoStack.clear();
        
        // 限制历史栈大小
        if (undoStack.size() > MAX_HISTORY_SIZE) {
            undoStack.remove(0);
        }
    }
    
    public void recognizeHandwriting(String strokeId) {
        // TODO: 实现手写识别
        Log.d("NativeInfiniteCanvasView", "recognizeHandwriting 尚未实现: " + strokeId);
    }
    
    public void addTextElement(String text) {
        if (text == null || text.isEmpty()) {
            Log.w("NativeInfiniteCanvasView", "添加的文本为空");
            return;
        }
        
        try {
            // 在视口中心位置添加文本元素
            // 将屏幕中心点转换为世界坐标
            PointF worldCenter = screenToWorld(getWidth() / 2f, getHeight() / 2f);
            float textSize = 40f / viewportScale; // 根据缩放调整文本大小
            
            Paint textPaint = new Paint();
            textPaint.setColor(currentColor);
            textPaint.setTextSize(textSize);
            textPaint.setAntiAlias(true);
            textPaint.setStyle(Paint.Style.FILL);
            
            Path textPath = new Path();
            textPaint.getTextPath(text, 0, text.length(), worldCenter.x, worldCenter.y, textPath);
            
            StrokeData textStroke = new StrokeData(textPath, textPaint);
            strokes.add(textStroke);
            
            // 添加到撤销栈
            addToUndoStack(new HistoryAction(HistoryAction.Type.ADD_STROKE, textStroke));
            
            invalidate();
            Log.d("NativeInfiniteCanvasView", "已添加文本元素: " + text + " at (" + worldCenter.x + ", " + worldCenter.y + ")");
            
        } catch (Exception e) {
            Log.e("NativeInfiniteCanvasView", "添加文本元素失败", e);
            sendErrorEvent("TEXT_ELEMENT_FAILED", "添加文本元素失败: " + e.getMessage());
        }
    }
    
    public void exportCanvas(String canvasId) {
        try {
            // 将笔迹数据导出为JSON格式
            org.json.JSONObject canvasData = new org.json.JSONObject();
            canvasData.put("canvasId", canvasId);
            canvasData.put("viewport", new org.json.JSONObject()
                .put("x", viewportX)
                .put("y", viewportY)
                .put("scale", viewportScale));
            
            org.json.JSONArray strokesArray = new org.json.JSONArray();
            for (StrokeData stroke : strokes) {
                org.json.JSONObject strokeObj = new org.json.JSONObject();
                strokeObj.put("color", stroke.paint.getColor());
                strokeObj.put("width", stroke.paint.getStrokeWidth());
                strokeObj.put("alpha", stroke.paint.getAlpha());
                
                // 注意：无限画布的路径是在世界坐标系中的
                strokeObj.put("note", "Path data in world coordinates");
                
                strokesArray.put(strokeObj);
            }
            canvasData.put("strokes", strokesArray);
            canvasData.put("strokeCount", strokes.size());
            
            String jsonString = canvasData.toString(2); // 美化输出
            Log.d("NativeInfiniteCanvasView", "画布已导出为JSON: " + jsonString.substring(0, Math.min(200, jsonString.length())) + "...");
            
            // 发送导出完成事件
            WritableMap event = Arguments.createMap();
            event.putString("canvasId", canvasId);
            event.putString("data", jsonString);
            event.putBoolean("success", true);
            sendEvent("onExportComplete", event);
            
        } catch (Exception e) {
            Log.e("NativeInfiniteCanvasView", "导出画布失败", e);
            sendErrorEvent("EXPORT_FAILED", "导出画布失败: " + e.getMessage());
            
            // 发送导出失败事件
            WritableMap event = Arguments.createMap();
            event.putString("canvasId", canvasId);
            event.putBoolean("success", false);
            event.putString("error", e.getMessage());
            sendEvent("onExportComplete", event);
        }
    }
    
    static class StrokeData {
        Path path;
        Paint paint;
        StrokeData(Path path, Paint paint) {
            this.path = new Path(path);
            this.paint = new Paint(paint);
        }
    }
    
    static class HistoryAction {
        enum Type {
            ADD_STROKE,
            CLEAR
        }
        
        Type type;
        StrokeData strokeData;
        List<StrokeData> clearedStrokes;
        
        HistoryAction(Type type, StrokeData strokeData) {
            this.type = type;
            this.strokeData = strokeData;
        }
        
        HistoryAction(Type type, List<StrokeData> clearedStrokes) {
            this.type = type;
            this.clearedStrokes = clearedStrokes;
        }
    }
}
