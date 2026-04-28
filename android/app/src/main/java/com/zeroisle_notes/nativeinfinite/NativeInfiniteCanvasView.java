package com.zeroisle_notes.nativeinfinite;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Matrix;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.PointF;
import android.util.Log;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.content.ContentResolver;
import java.io.InputStream;
import android.view.MotionEvent;
import android.view.ScaleGestureDetector;
import android.view.View;
import android.view.GestureDetector;
import android.animation.ValueAnimator;

import com.zeroisle_notes.TouchTypeDetectionModule;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.uimanager.events.RCTEventEmitter;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;


import com.facebook.react.bridge.Promise;
import android.graphics.RectF;
import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

// ML Kit
import com.zeroisle_notes.services.AIProcessingService;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.digitalink.DigitalInkRecognition;
import com.google.mlkit.vision.digitalink.DigitalInkRecognitionModel;
import com.google.mlkit.vision.digitalink.DigitalInkRecognitionModelIdentifier;
import com.google.mlkit.vision.digitalink.DigitalInkRecognizer;
import com.google.mlkit.vision.digitalink.DigitalInkRecognizerOptions;
import com.google.mlkit.vision.digitalink.Ink;

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
    private PointF lastStrokePoint;

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
            if (stroke.bitmap != null) {
                android.graphics.RectF dst = new android.graphics.RectF(
                    stroke.x, stroke.y, stroke.x + stroke.w, stroke.y + stroke.h
                );
                canvas.drawBitmap(stroke.bitmap, null, dst, null);
            } else {
                canvas.drawPath(stroke.path, stroke.paint);
            }
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
            if (event.getPointerCount() > 0) {
                lastPressure = event.getPressure(0);
            }
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
        Log.d("NativeInfiniteCanvas", String.format("开始工具操作: %s", currentTool));

        // 根据工具类型处理
        if ("eraser".equals(currentTool)) {
            startErasing(worldPoint);
        } else if ("lasso".equals(currentTool) || "select".equals(currentTool)) {
            startLassoSelection(worldPoint);
        } else if ("shape".equals(currentTool)) {
            startShape(worldPoint);
        } else if ("laser".equals(currentTool)) {
            startLaser(worldPoint);
        } else {
            // 默认绘图工具
            startDefaultDrawing(worldPoint);
        }
    }

    private void startDefaultDrawing(PointF worldPoint) {
        currentPath = new Path();
        currentPath.moveTo(worldPoint.x, worldPoint.y);

        currentPaint = new Paint();
        currentPaint.setColor(currentColor);
        currentPaint.setStrokeWidth(resolveToolBaseStrokeWidth());
        currentPaint.setStyle(Paint.Style.STROKE);
        currentPaint.setStrokeCap(Paint.Cap.ROUND);
        currentPaint.setStrokeJoin(Paint.Join.ROUND);
        currentPaint.setAntiAlias(true);

        if ("highlighter".equals(currentTool)) {
            currentPaint.setAlpha(128);
        } else if ("pencil".equals(currentTool)) {
            currentPaint.setAlpha(179); // 70% opacity
        }

        currentStrokePoints.clear();
        currentStrokePoints.add(worldPoint);
        lastStrokePoint = new PointF(worldPoint.x, worldPoint.y);
        applyDynamicStrokeWidth(1.0f);
        invalidate();
    }

    private float resolveToolBaseStrokeWidth() {
        if ("highlighter".equals(currentTool)) {
            return currentStrokeWidth * 2f;
        } else if ("pencil".equals(currentTool)) {
            return currentStrokeWidth * 0.8f;
        } else if ("brush".equals(currentTool)) {
            return currentStrokeWidth * 1.5f;
        }
        return currentStrokeWidth;
    }

    private void applyDynamicStrokeWidth(float pressure) {
        applyDynamicStrokeWidth(pressure, 0.0f);
    }

    private void applyDynamicStrokeWidth(float pressure, float velocity) {
        if (currentPaint == null) {
            return;
        }
        float baseWidth = resolveToolBaseStrokeWidth();
        float intensity = resolveStrokeIntensity(pressure, velocity);
        currentPaint.setStrokeWidth(baseWidth * intensity);
    }

    private void startErasing(PointF worldPoint) {
        Log.d("NativeInfiniteCanvas", "开始橡皮擦");
        eraseAt(worldPoint);
    }

    private void eraseAt(PointF worldPoint) {
        if (strokes.isEmpty()) return;

        // 橡皮擦半径
        float eraserRadius = currentStrokeWidth * 3;

        // 从后往前检查笔迹，删除与橡皮擦相交的笔迹
        for (int i = strokes.size() - 1; i >= 0; i--) {
            StrokeData stroke = strokes.get(i);

            // 检查笔迹是否与橡皮擦点相交
            boolean shouldErase = false;

            // 方法1: 检查橡皮擦点是否在笔迹附近
            android.graphics.Path path = stroke.path;
            android.graphics.RectF bounds = new android.graphics.RectF();
            path.computeBounds(bounds, true);

            if (bounds.contains(worldPoint.x, worldPoint.y)) {
                // 计算点到路径的最短距离
                float minDistance = Float.MAX_VALUE;
                android.graphics.PathMeasure pathMeasure = new android.graphics.PathMeasure(path, false);
                float[] pos = new float[2];
                float[] tan = new float[2];

                for (float distance = 0; distance < pathMeasure.getLength(); distance += 5) {
                    pathMeasure.getPosTan(distance, pos, tan);
                    float dist = (float) Math.sqrt(
                        Math.pow(worldPoint.x - pos[0], 2) + Math.pow(worldPoint.y - pos[1], 2)
                    );
                    minDistance = Math.min(minDistance, dist);
                }

                if (minDistance <= eraserRadius) {
                    shouldErase = true;
                }
            }

            // 方法2: 检查笔迹边界是否与橡皮擦区域相交
            if (!shouldErase) {
                android.graphics.RectF eraserRect = new android.graphics.RectF(
                    worldPoint.x - eraserRadius, worldPoint.y - eraserRadius,
                    worldPoint.x + eraserRadius, worldPoint.y + eraserRadius
                );

                if (android.graphics.RectF.intersects(bounds, eraserRect)) {
                    // 检查重叠面积
                    android.graphics.RectF intersection = new android.graphics.RectF();
                    intersection.setIntersect(bounds, eraserRect);
                    float intersectionArea = intersection.width() * intersection.height();
                    float strokeArea = bounds.width() * bounds.height();

                    if (intersectionArea > strokeArea * 0.3) { // 30%重叠就删除
                        shouldErase = true;
                    }
                }
            }

            if (shouldErase) {
                StrokeData removedStroke = strokes.remove(i);
                addToUndoStack(new HistoryAction(HistoryAction.Type.REMOVE_STROKE, removedStroke));
                invalidate();
                Log.d("NativeInfiniteCanvas", "擦除笔迹 " + i);
                break; // 每次只擦除一个笔迹
            }
        }
    }

    private void startLassoSelection(PointF worldPoint) {
        Log.d("NativeInfiniteCanvas", "开始套索选择");
        lassoPath = new Path();
        lassoPath.moveTo(worldPoint.x, worldPoint.y);
        lassoPaint = new Paint();
        lassoPaint.setColor(Color.BLUE);
        lassoPaint.setStyle(Paint.Style.STROKE);
        lassoPaint.setStrokeWidth(2);
        lassoPaint.setAntiAlias(true);
    }

    private void startShape(PointF worldPoint) {
        Log.d("NativeInfiniteCanvas", "开始绘制形状: " + currentShape);
        shapeStartPoint = new PointF(worldPoint.x, worldPoint.y);
        currentPath = new Path();
        currentPaint = new Paint();
        currentPaint.setColor(currentStrokeColor);
        currentPaint.setStyle(Paint.Style.STROKE);
        currentPaint.setStrokeWidth(currentStrokeWidth);
        currentPaint.setAntiAlias(true);
        currentPaint.setStrokeCap(Paint.Cap.ROUND);
        currentPaint.setStrokeJoin(Paint.Join.ROUND);
    }

    private void startLaser(PointF worldPoint) {
        Log.d("NativeInfiniteCanvas", "开始激光笔");
        laserPath = new Path();
        laserPath.moveTo(worldPoint.x, worldPoint.y);
        laserPaint = new Paint();
        laserPaint.setColor(Color.RED);
        laserPaint.setStyle(Paint.Style.STROKE);
        laserPaint.setStrokeWidth(currentStrokeWidth * 2);
        laserPaint.setAntiAlias(true);
        laserPaint.setAlpha(204); // 80% alpha
    }

    private void continueLassoSelection(PointF worldPoint) {
        if (lassoPath != null) {
            lassoPath.lineTo(worldPoint.x, worldPoint.y);
            invalidate();
        }
    }

    private void endLassoSelection() {
        if (lassoPath == null) return;

        lassoPath.close();
        Log.d("NativeInfiniteCanvas", "套索选择结束");

        // 查找套索内的笔迹
        List<String> selectedStrokeIds = new ArrayList<>();

        for (StrokeData stroke : strokes) {
            if (isStrokeSelectedByLasso(stroke, lassoPath)) {
                selectedStrokeIds.add(stroke.id);
                Log.d("NativeInfiniteCanvas", "选中笔迹: " + stroke.id);
            }
        }

        Log.d("NativeInfiniteCanvas", "选中 " + selectedStrokeIds.size() + " 个笔迹");

        // 高亮显示选中的笔迹
        if (selectedStrokeIds.size() > 0) {
            lassoPaint.setColor(Color.GREEN);
            lassoPaint.setAlpha(51); // 20% alpha

            // 3秒后清除选择
            postDelayed(() -> {
                lassoPath = null;
                lassoPaint = null;
                invalidate();
            }, 3000);
        } else {
            // 没有选中任何内容，立即清除
            lassoPath = null;
            lassoPaint = null;
            invalidate();
        }
    }

    private boolean isStrokeSelectedByLasso(StrokeData stroke, Path lassoPath) {
        android.graphics.RectF bounds = new android.graphics.RectF();
        stroke.path.computeBounds(bounds, true);

        // 检查笔迹边界是否与套索路径相交
        android.graphics.RectF lassoBounds = new android.graphics.RectF();
        lassoPath.computeBounds(lassoBounds, true);

        if (!android.graphics.RectF.intersects(bounds, lassoBounds)) {
            return false;
        }

        // 检查笔迹中心点是否在套索内
        float centerX = bounds.centerX();
        float centerY = bounds.centerY();

        // 使用Region来检查点是否在路径内
        android.graphics.Region region = new android.graphics.Region();
        android.graphics.Region clip = new android.graphics.Region(
            (int) lassoBounds.left - 1, (int) lassoBounds.top - 1,
            (int) lassoBounds.right + 1, (int) lassoBounds.bottom + 1
        );
        region.setPath(lassoPath, clip);

        return region.contains((int) centerX, (int) centerY);
    }

    private void continueLaser(PointF worldPoint) {
        if (laserPath != null) {
            laserPath.lineTo(worldPoint.x, worldPoint.y);
            invalidate();
        }
    }

    private void endLaser() {
        if (laserPath == null) return;

        Log.d("NativeInfiniteCanvas", "激光笔结束，开始淡出");

        // 创建淡出动画
        ValueAnimator fadeAnimator = ValueAnimator.ofFloat(0.8f, 0.0f);
        fadeAnimator.setDuration(3000);
        fadeAnimator.setInterpolator(new android.view.animation.DecelerateInterpolator());

        fadeAnimator.addUpdateListener(animation -> {
            float alpha = (float) animation.getAnimatedValue();
            if (laserPaint != null) {
                laserPaint.setAlpha((int) (alpha * 255));
                invalidate();
            }
        });

        fadeAnimator.addListener(new android.animation.AnimatorListenerAdapter() {
            @Override
            public void onAnimationEnd(android.animation.Animator animation) {
                laserPath = null;
                laserPaint = null;
                invalidate();
            }
        });

        fadeAnimator.start();
    }

    private void updateShapePath(PointF worldPoint) {
        if (currentPath == null || shapeStartPoint == null) return;

        currentPath.reset();

        if ("line".equals(currentShape)) {
            currentPath.moveTo(shapeStartPoint.x, shapeStartPoint.y);
            currentPath.lineTo(worldPoint.x, worldPoint.y);
        } else if ("rectangle".equals(currentShape)) {
            currentPath.addRect(
                Math.min(shapeStartPoint.x, worldPoint.x),
                Math.min(shapeStartPoint.y, worldPoint.y),
                Math.max(shapeStartPoint.x, worldPoint.x),
                Math.max(shapeStartPoint.y, worldPoint.y),
                Path.Direction.CW
            );
        } else if ("circle".equals(currentShape)) {
            float radius = (float) Math.sqrt(
                Math.pow(worldPoint.x - shapeStartPoint.x, 2) + Math.pow(worldPoint.y - shapeStartPoint.y, 2)
            );
            currentPath.addCircle(shapeStartPoint.x, shapeStartPoint.y, radius, Path.Direction.CW);
        } else if ("arrow".equals(currentShape)) {
            // 箭头
            currentPath.moveTo(shapeStartPoint.x, shapeStartPoint.y);
            currentPath.lineTo(worldPoint.x, worldPoint.y);

            double angle = Math.atan2(worldPoint.y - shapeStartPoint.y, worldPoint.x - shapeStartPoint.x);
            float arrowLength = 15;
            float arrowAngle = (float) (Math.PI / 6);

            currentPath.moveTo(worldPoint.x, worldPoint.y);
            currentPath.lineTo(
                (float) (worldPoint.x - arrowLength * Math.cos(angle - arrowAngle)),
                (float) (worldPoint.y - arrowLength * Math.sin(angle - arrowAngle))
            );
            currentPath.moveTo(worldPoint.x, worldPoint.y);
            currentPath.lineTo(
                (float) (worldPoint.x - arrowLength * Math.cos(angle + arrowAngle)),
                (float) (worldPoint.y - arrowLength * Math.sin(angle + arrowAngle))
            );
        } else if ("triangle".equals(currentShape)) {
            // 三角形
            float midX = (shapeStartPoint.x + worldPoint.x) / 2;
            currentPath.moveTo(midX, shapeStartPoint.y);
            currentPath.lineTo(shapeStartPoint.x, worldPoint.y);
            currentPath.lineTo(worldPoint.x, worldPoint.y);
            currentPath.close();
        } else if ("diamond".equals(currentShape)) {
            // 菱形
            float midX = (shapeStartPoint.x + worldPoint.x) / 2;
            float midY = (shapeStartPoint.y + worldPoint.y) / 2;
            currentPath.moveTo(midX, shapeStartPoint.y);
            currentPath.lineTo(worldPoint.x, midY);
            currentPath.lineTo(midX, worldPoint.y);
            currentPath.lineTo(shapeStartPoint.x, midY);
            currentPath.close();
        } else if ("star".equals(currentShape)) {
            // 五角星
            float centerX = (shapeStartPoint.x + worldPoint.x) / 2;
            float centerY = (shapeStartPoint.y + worldPoint.y) / 2;
            float radius = Math.min(Math.abs(worldPoint.x - shapeStartPoint.x), Math.abs(worldPoint.y - shapeStartPoint.y)) / 2;

            for (int i = 0; i < 5; i++) {
                double angle = i * 2 * Math.PI / 5 - Math.PI / 2; // 从顶部开始
                float pointX = centerX + radius * (float) Math.cos(angle);
                float pointY = centerY + radius * (float) Math.sin(angle);

                if (i == 0) {
                    currentPath.moveTo(pointX, pointY);
                } else {
                    currentPath.lineTo(pointX, pointY);
                }
            }
            currentPath.close();
        } else {
            // 默认直线
            currentPath.moveTo(shapeStartPoint.x, shapeStartPoint.y);
            currentPath.lineTo(worldPoint.x, worldPoint.y);
        }

        invalidate();
    }

    private void endShape() {
        if (currentPath != null && currentPaint != null) {
            // 保存形状
            StrokeData newStroke = new StrokeData(currentPath, currentPaint);
            strokes.add(newStroke);
            addToUndoStack(new HistoryAction(HistoryAction.Type.ADD_STROKE, newStroke));

            // 发送笔迹提交事件
            WritableMap event = Arguments.createMap();
            event.putString("strokeId", newStroke.id);
            event.putString("tool", "shape");
            event.putString("shape", currentShape);
            sendEvent("onStrokeCommitted", event);

            Log.d("NativeInfiniteCanvas", "形状绘制完成: " + currentShape);
        }

        // 清理
        currentPath = null;
        currentPaint = null;
        shapeStartPoint = null;
        invalidate();
    }

    private void continueStroke(PointF worldPoint) {
        if ("eraser".equals(currentTool)) {
            eraseAt(worldPoint);
        } else if ("lasso".equals(currentTool) || "select".equals(currentTool)) {
            continueLassoSelection(worldPoint);
        } else if ("shape".equals(currentTool)) {
            updateShapePath(worldPoint);
        } else if ("laser".equals(currentTool)) {
            continueLaser(worldPoint);
        } else {
            // 默认绘图
            if (currentPath != null) {
                float pressure = 1.0f;
                if (isStylusMode) {
                    pressure = Math.max(0.2f, Math.min(1.8f, lastPressure));
                }
                applyDynamicStrokeWidth(pressure);

                if (lastStrokePoint != null) {
                    float midX = (lastStrokePoint.x + worldPoint.x) / 2f;
                    float midY = (lastStrokePoint.y + worldPoint.y) / 2f;
                    currentPath.quadTo(lastStrokePoint.x, lastStrokePoint.y, midX, midY);
                } else {
                    currentPath.lineTo(worldPoint.x, worldPoint.y);
                }

                currentStrokePoints.add(worldPoint);
                lastStrokePoint = new PointF(worldPoint.x, worldPoint.y);
                invalidate();
            }
        }
    }

    private void endStroke() {
        if ("eraser".equals(currentTool)) {
            Log.d("NativeInfiniteCanvas", "橡皮擦结束");
        } else if ("lasso".equals(currentTool) || "select".equals(currentTool)) {
            endLassoSelection();
        } else if ("shape".equals(currentTool)) {
            endShape();
        } else if ("laser".equals(currentTool)) {
            endLaser();
        } else {
            // 默认绘图结束
            endDefaultDrawing();
        }
    }

    private void endDefaultDrawing() {
        if (currentPath != null && currentStrokePoints.size() > 1) {
            StrokeData newStroke = new StrokeData(currentPath, currentPaint);
            strokes.add(newStroke);

            // 添加到撤销栈
            addToUndoStack(new HistoryAction(HistoryAction.Type.ADD_STROKE, newStroke));

            WritableMap event = Arguments.createMap();
            event.putString("strokeId", UUID.randomUUID().toString());
            event.putString("tool", currentTool);
            sendEvent("onStrokeCommitted", event);

            currentPath = null;
            currentPaint = null;
            currentStrokePoints.clear();
            lastStrokePoint = null;
            lastPressure = 1.0f;
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
    private float currentOpacity = 1.0f;
    private String currentPenProfile = "fountain";
    private float pressureSensitivity = 0.9f;
    private float velocitySensitivity = 0.45f;
    private float taperIn = 0.28f;
    private float taperOut = 0.22f;
    private float smoothing = 0.72f;
    private boolean recognitionEnabled = true;
    private int recognitionDebounceMs = 180;
    private boolean palmRejectionEnabled = true;
    private String fingerMode = "gesture_only";
    private long lastStrokeTimestampMs = 0L;
    private float filteredStrokeVelocity = 0.0f;

    // 触摸类型检测
    private String currentTouchType = TouchTypeDetectionModule.TOUCH_TYPE_UNKNOWN;
    private boolean isStylusMode = false;
    private float lastPressure = 1.0f;

    // 套索选择相关
    private Path lassoPath;
    private Paint lassoPaint;

    // 形状绘制相关
    private String currentShape = "line";
    private PointF shapeStartPoint;
    private int currentStrokeColor = Color.BLACK;

    // 激光笔相关
    private Path laserPath;
    private Paint laserPaint;

    private float clamp(float value, float min, float max) {
        return Math.max(min, Math.min(max, value));
    }

    private float resolveProfileDefault(String profile, String key) {
        if ("pencil".equals(profile)) {
            if ("pressure".equals(key)) { return 0.55f; }
            if ("velocity".equals(key)) { return 0.35f; }
            if ("taperIn".equals(key)) { return 0.08f; }
            if ("taperOut".equals(key)) { return 0.08f; }
            if ("smoothing".equals(key)) { return 0.45f; }
        } else if ("brush".equals(profile)) {
            if ("pressure".equals(key)) { return 1.0f; }
            if ("velocity".equals(key)) { return 0.7f; }
            if ("taperIn".equals(key)) { return 0.32f; }
            if ("taperOut".equals(key)) { return 0.26f; }
            if ("smoothing".equals(key)) { return 0.82f; }
        } else if ("marker".equals(profile)) {
            if ("pressure".equals(key)) { return 0.18f; }
            if ("velocity".equals(key)) { return 0.08f; }
            if ("taperIn".equals(key)) { return 0.0f; }
            if ("taperOut".equals(key)) { return 0.0f; }
            if ("smoothing".equals(key)) { return 0.3f; }
        }

        if ("pressure".equals(key)) { return 0.9f; }
        if ("velocity".equals(key)) { return 0.45f; }
        if ("taperIn".equals(key)) { return 0.28f; }
        if ("taperOut".equals(key)) { return 0.22f; }
        if ("smoothing".equals(key)) { return 0.72f; }
        return 0.0f;
    }

    private String resolvePenProfileForTool(String tool) {
        if ("pencil".equals(tool)) {
            return "pencil";
        }
        if ("brush".equals(tool)) {
            return "brush";
        }
        if ("highlighter".equals(tool)) {
            return "marker";
        }
        return "fountain";
    }

    private int parseColorValue(String colorValue, int fallbackColor) {
        if (colorValue == null) {
            return fallbackColor;
        }

        try {
            String normalized = colorValue.trim();
            if (normalized.startsWith("rgba")) {
                String body = normalized.substring(normalized.indexOf('(') + 1, normalized.lastIndexOf(')'));
                String[] parts = body.split(",");
                if (parts.length == 4) {
                    int red = Math.round(Float.parseFloat(parts[0].trim()));
                    int green = Math.round(Float.parseFloat(parts[1].trim()));
                    int blue = Math.round(Float.parseFloat(parts[2].trim()));
                    float alpha = clamp(Float.parseFloat(parts[3].trim()), 0.0f, 1.0f);
                    return Color.argb(Math.round(alpha * 255f), red, green, blue);
                }
            } else if (normalized.startsWith("rgb")) {
                String body = normalized.substring(normalized.indexOf('(') + 1, normalized.lastIndexOf(')'));
                String[] parts = body.split(",");
                if (parts.length == 3) {
                    int red = Math.round(Float.parseFloat(parts[0].trim()));
                    int green = Math.round(Float.parseFloat(parts[1].trim()));
                    int blue = Math.round(Float.parseFloat(parts[2].trim()));
                    return Color.rgb(red, green, blue);
                }
            }

            return Color.parseColor(normalized);
        } catch (Exception error) {
            Log.w("NativeInfiniteCanvas", "颜色解析失败，使用回退值: " + colorValue, error);
            return fallbackColor;
        }
    }

    private float resolveToolOpacity() {
        if ("highlighter".equals(currentTool) || "marker".equals(currentPenProfile)) {
            return currentOpacity <= 0 ? 0.4f : currentOpacity;
        }
        if ("pencil".equals(currentTool) && currentOpacity >= 1.0f) {
            return 0.7f;
        }
        return currentOpacity;
    }

    private void applyPaintStyle(Paint paint) {
        if (paint == null) {
            return;
        }

        paint.setColor(currentColor);
        paint.setStyle(Paint.Style.STROKE);
        paint.setStrokeCap(Paint.Cap.ROUND);
        paint.setStrokeJoin(Paint.Join.ROUND);
        paint.setAntiAlias(true);
        paint.setDither(true);
        paint.setFilterBitmap(true);
        paint.setAlpha(Math.round(clamp(resolveToolOpacity(), 0.0f, 1.0f) * 255f));
    }

    private float resolveStrokeIntensity(float pressure, float velocity) {
        float safePressure = clamp(pressure, 0.15f, 1.8f);
        float pressureFactor = 0.45f + safePressure * Math.max(0.05f, pressureSensitivity);
        float velocityNorm = clamp(velocity / 2200.0f, 0.0f, 1.0f);
        float velocityFactor = 1.0f - velocityNorm * 0.45f * velocitySensitivity;
        float taperFactor = 1.0f;
        if (currentStrokePoints.size() <= 2) {
            taperFactor = 0.58f + taperIn * 0.42f;
        }
        return clamp(pressureFactor * velocityFactor * taperFactor, 0.22f, 1.95f);
    }

    private void updateStrokeDynamics(PointF worldPoint, float pressure) {
        long now = System.currentTimeMillis();
        float velocity = 0.0f;
        if (lastStrokePoint != null && lastStrokeTimestampMs > 0L) {
            float dx = worldPoint.x - lastStrokePoint.x;
            float dy = worldPoint.y - lastStrokePoint.y;
            float distance = (float) Math.sqrt(dx * dx + dy * dy);
            float deltaMs = Math.max(1f, now - lastStrokeTimestampMs);
            velocity = (distance / deltaMs) * 1000f;
        }

        filteredStrokeVelocity = filteredStrokeVelocity * 0.72f + velocity * 0.28f;
        applyDynamicStrokeWidth(pressure, filteredStrokeVelocity);
        lastStrokeTimestampMs = now;
    }

    private WritableArray createWritableStringArray(List<String> values) {
        WritableArray array = Arguments.createArray();
        for (String value : values) {
            array.pushString(value);
        }
        return array;
    }

    private void sendRecognitionResultEvent(String scope, List<String> sourceStrokeIds, String text, float confidence) {
        WritableMap event = Arguments.createMap();
        if (sourceStrokeIds != null && !sourceStrokeIds.isEmpty()) {
            event.putString("strokeId", sourceStrokeIds.get(0));
            event.putArray("sourceStrokeIds", createWritableStringArray(sourceStrokeIds));
        }
        event.putString("scope", scope != null ? scope : "latest");
        event.putString("text", text != null ? text : "");
        event.putString("recognizedText", text != null ? text : "");
        event.putDouble("confidence", confidence);
        sendEvent("onHandwritingRecognized", event);
    }

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
        this.currentColor = parseColorValue(color, this.currentColor);
    }

    public void setDrawingWidth(float width) {
        this.currentStrokeWidth = width;
    }

    // Manager 调用的方法别名
    public void setCurrentTool(String tool) {
        this.currentTool = tool;
    }

    public void setCurrentColor(String color) {
        this.currentColor = parseColorValue(color, this.currentColor);
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

    public void addImage(String imageUri) {
        Log.d("NativeInfiniteCanvasView", "添加图片: " + imageUri);
        try {
            Bitmap bitmap = null;
            if (imageUri != null && imageUri.startsWith("file://")) {
                String path = imageUri.substring(7);
                bitmap = BitmapFactory.decodeFile(path);
            } else {
                Uri uri = Uri.parse(imageUri);
                ContentResolver resolver = getContext().getContentResolver();
                try (InputStream is = resolver.openInputStream(uri)) {
                    if (is != null) bitmap = BitmapFactory.decodeStream(is);
                }
            }
            if (bitmap == null) {
                Log.e("NativeInfiniteCanvasView", "addImage: 加载位图失败");
                return;
            }
            // 在视口中心加入图片，尺寸为屏宽的40%（在世界坐标中考虑缩放）
            PointF worldCenter = screenToWorld(getWidth() / 2f, getHeight() / 2f);
            float targetW = (getWidth() * 0.4f) / viewportScale;
            float ratio = (float) bitmap.getHeight() / Math.max(1, bitmap.getWidth());
            float targetH = targetW * ratio;
            float left = worldCenter.x - targetW / 2f;
            float top = worldCenter.y - targetH / 2f;
            // 使用图片笔迹封装
            StrokeData imageStroke = StrokeData.image(bitmap, left, top, targetW, targetH);
            strokes.add(imageStroke);
            addToUndoStack(new HistoryAction(HistoryAction.Type.ADD_STROKE, imageStroke));
            invalidate();
        } catch (Exception e) {
            Log.e("NativeInfiniteCanvasView", "addImage 失败", e);
            sendErrorEvent("ADD_IMAGE_FAILED", "添加图片失败: " + e.getMessage());
        }
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
            Log.d("NativeInfiniteCanvasView", "开始导出画布数据...");

            // ✅ 将笔迹数据导出为JSON格式
            org.json.JSONObject canvasData = new org.json.JSONObject();
            canvasData.put("version", "1.0");
            canvasData.put("canvasId", canvasId);
            canvasData.put("viewport", new org.json.JSONObject()
                .put("x", viewportX)
                .put("y", viewportY)
                .put("scale", viewportScale));

            // ✅ 导出所有笔迹数据，包括Path路径信息
            org.json.JSONArray strokesArray = new org.json.JSONArray();
            for (StrokeData stroke : strokes) {
                org.json.JSONObject strokeObj = new org.json.JSONObject();
                strokeObj.put("color", stroke.paint.getColor());
                strokeObj.put("width", stroke.paint.getStrokeWidth());
                strokeObj.put("alpha", stroke.paint.getAlpha());

                // ✅ 序列化Path数据（使用PathMeasure采样点）
                String pathData = serializePathToString(stroke.path);
                strokeObj.put("pathData", pathData);
                strokeObj.put("note", "Path data in world coordinates");

                strokesArray.put(strokeObj);
            }
            canvasData.put("strokes", strokesArray);
            canvasData.put("strokeCount", strokes.size());

            String jsonString = canvasData.toString(2); // 美化输出
            Log.d("NativeInfiniteCanvasView", String.format("画布已导出: %d 个笔迹, JSON大小: %d bytes",
                strokes.size(), jsonString.length()));

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

    /**
     * 将Path序列化为字符串（使用点坐标数组）
     * 与PDF版本相同的实现
     */
    private String serializePathToString(Path path) {
        try {
            android.graphics.PathMeasure pathMeasure = new android.graphics.PathMeasure(path, false);
            float length = pathMeasure.getLength();

            if (length == 0) {
                return "";
            }

            // 采样路径点（每5个像素采样一个点）
            int numPoints = Math.max(2, (int) (length / 5.0f));
            StringBuilder pathData = new StringBuilder();
            float[] pos = new float[2];

            for (int i = 0; i < numPoints; i++) {
                float distance = (length * i) / (numPoints - 1);
                if (pathMeasure.getPosTan(distance, pos, null)) {
                    if (i > 0) {
                        pathData.append(",");
                    }
                    pathData.append(String.format("%.2f,%.2f", pos[0], pos[1]));
                }
            }

            return pathData.toString();
        } catch (Exception e) {
            Log.e("NativeInfiniteCanvasView", "序列化Path失败", e);
            return "";
        }
    }

    /**
     * 从字符串反序列化Path
     */
    private Path deserializePathFromString(String pathData) {
        Path path = new Path();

        if (pathData == null || pathData.isEmpty()) {
            return path;
        }

        try {
            String[] points = pathData.split(",");
            if (points.length >= 2) {
                // 第一个点使用moveTo
                float x = Float.parseFloat(points[0]);
                float y = Float.parseFloat(points[1]);
                path.moveTo(x, y);

                // 后续点使用lineTo
                for (int i = 2; i < points.length; i += 2) {
                    if (i + 1 < points.length) {
                        x = Float.parseFloat(points[i]);
                        y = Float.parseFloat(points[i + 1]);
                        path.lineTo(x, y);
                    }
                }
            }
        } catch (Exception e) {
            Log.e("NativeInfiniteCanvasView", "反序列化Path失败", e);
        }

        return path;
    }

    /**
     * 导入保存的画布数据
     */
    public void importCanvas(String canvasDataJson) {
        try {
            Log.d("NativeInfiniteCanvasView", "开始导入画布数据...");

            // ✅ 检查输入是否为空
            if (canvasDataJson == null || canvasDataJson.trim().isEmpty()) {
                Log.w("NativeInfiniteCanvasView", "画布数据为空，跳过导入");
                return;
            }

            // ✅ 检查是否为空数组
            String trimmed = canvasDataJson.trim();
            if (trimmed.equals("[]") || trimmed.equals("{}")) {
                Log.d("NativeInfiniteCanvasView", "画布数据为空数组/对象，跳过导入");
                return;
            }

            org.json.JSONObject canvasData = null;
            org.json.JSONArray directArray = null;

            // ✅ 尝试解析为对象或数组
            try {
                if (trimmed.startsWith("{")) {
                    canvasData = new org.json.JSONObject(canvasDataJson);
                } else if (trimmed.startsWith("[")) {
                    directArray = new org.json.JSONArray(canvasDataJson);
                } else {
                    Log.w("NativeInfiniteCanvasView", "无法识别的数据格式，跳过导入");
                    return;
                }
            } catch (org.json.JSONException parseError) {
                Log.e("NativeInfiniteCanvasView", "JSON解析失败: " + parseError.getMessage());
                sendErrorEvent("IMPORT_PARSE_ERROR", "JSON解析失败: " + parseError.getMessage());
                return;
            }

            // 清空现有笔迹
            strokes.clear();
            undoStack.clear();
            redoStack.clear();

            // 恢复viewport（如果是对象格式）
            if (canvasData != null && canvasData.has("viewport")) {
                org.json.JSONObject viewport = canvasData.getJSONObject("viewport");
                viewportX = (float) viewport.getDouble("x");
                viewportY = (float) viewport.getDouble("y");
                viewportScale = (float) viewport.getDouble("scale");
                Log.d("NativeInfiniteCanvasView", String.format("恢复viewport: x=%.2f, y=%.2f, scale=%.2f", viewportX, viewportY, viewportScale));
            }

            // 导入所有笔迹
            org.json.JSONArray strokesArray = null;
            if (canvasData != null && canvasData.has("strokes")) {
                strokesArray = canvasData.getJSONArray("strokes");
            } else if (directArray != null) {
                strokesArray = directArray;
            }

            if (strokesArray != null && strokesArray.length() > 0) {
                Log.d("NativeInfiniteCanvasView", "准备导入 " + strokesArray.length() + " 个笔迹");

                for (int i = 0; i < strokesArray.length(); i++) {
                    try {
                        org.json.JSONObject strokeObj = strokesArray.getJSONObject(i);

                        // 重建Paint对象
                        Paint paint = new Paint();
                        paint.setColor(strokeObj.optInt("color", Color.BLACK));
                        paint.setStrokeWidth((float) strokeObj.optDouble("width", 2.0));
                        paint.setAlpha(strokeObj.optInt("alpha", 255));
                        paint.setStyle(Paint.Style.STROKE);
                        paint.setStrokeCap(Paint.Cap.ROUND);
                        paint.setStrokeJoin(Paint.Join.ROUND);
                        paint.setAntiAlias(true);

                        // 重建Path对象
                        String pathData = strokeObj.optString("pathData", "");
                        if (pathData.isEmpty()) {
                            Log.w("NativeInfiniteCanvasView", "笔迹 " + i + " 的pathData为空，跳过");
                            continue;
                        }

                        Path path = deserializePathFromString(pathData);

                        // 添加到笔迹列表
                        StrokeData stroke = new StrokeData(path, paint);
                        strokes.add(stroke);
                    } catch (Exception strokeError) {
                        Log.e("NativeInfiniteCanvasView", "导入笔迹 " + i + " 失败: " + strokeError.getMessage());
                        // 继续处理下一个笔迹
                    }
                }

                Log.d("NativeInfiniteCanvasView", String.format("画布数据导入成功: %d 个笔迹", strokes.size()));
            } else {
                Log.d("NativeInfiniteCanvasView", "没有笔迹数据需要导入");
            }

            // 刷新绘制
            invalidate();

        } catch (Exception e) {
            Log.e("NativeInfiniteCanvasView", "导入画布失败", e);
            Log.e("NativeInfiniteCanvasView", "错误堆栈: ", e);
            sendErrorEvent("IMPORT_FAILED", "导入画布失败: " + e.getMessage());
        }
    }

    static class StrokeData {
        String id;
        Path path;
        Paint paint;
        StrokeData(Path path, Paint paint) {
            this.id = UUID.randomUUID().toString();
            this.path = new Path(path);
            this.paint = new Paint(paint);
        }
        // 简易图片支持
        Bitmap bitmap;
        float x, y, w, h;
        static StrokeData image(Bitmap bitmap, float x, float y, float w, float h) {
            StrokeData s = new StrokeData(new Path(), new Paint(Paint.ANTI_ALIAS_FLAG));
            s.bitmap = bitmap; s.x = x; s.y = y; s.w = w; s.h = h;
            return s;
        }
    }

    static class HistoryAction {
        enum Type {
            ADD_STROKE,
            REMOVE_STROKE,
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

    // ==================== ML Kit 文本识别和手写识别 ====================

    /**
     * 区域OCR：识别指定矩形区域内的文本
     * @param x 区域左上角X坐标（视图坐标）
     * @param y 区域左上角Y坐标（视图坐标）
     * @param width 区域宽度
     * @param height 区域高度
     * @param promise Promise回调
     */
    public void recognizeTextInRect(float x, float y, float width, float height, Promise promise) {
        try {
            int bitmapWidth = (int) width;
            int bitmapHeight = (int) height;

            if (bitmapWidth <= 0 || bitmapHeight <= 0) {
                promise.reject("E_INVALID_RECT", "Invalid region size");
                return;
            }

            Bitmap bitmap = Bitmap.createBitmap(bitmapWidth, bitmapHeight, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(bitmap);

            // Draw the background
            canvas.drawColor(backgroundColor);

            // Apply transformations to draw the strokes as they appear on screen,
            // but shifted so the target region is at the top-left of the bitmap.
            canvas.save();
            canvas.translate(-x, -y);
            canvas.concat(transformMatrix);

            // Draw all strokes onto the new canvas
            for (StrokeData stroke : strokes) {
                if (stroke.bitmap != null) {
                    android.graphics.RectF dst = new android.graphics.RectF(
                        stroke.x, stroke.y, stroke.x + stroke.w, stroke.y + stroke.h
                    );
                    canvas.drawBitmap(stroke.bitmap, null, dst, null);
                } else {
                    canvas.drawPath(stroke.path, stroke.paint);
                }
            }
            canvas.restore();

            // Delegate the ML Kit processing to the centralized service.
            // The service will handle the bitmap recycling.
            AIProcessingService.recognizeTextInBitmap(bitmap, x, y, promise);

        } catch (Exception e) {
            Log.e("NativeInfiniteCanvasView", "Region OCR failed", e);
            promise.reject("E_OCR_ERROR", "Error during region OCR: " + e.getMessage());
        }
    }

    /**
     * 手写识别：识别最近的N笔笔迹
     * @param count 要识别的笔迹数量
     * @param promise Promise回调
     */
    public void recognizeHandwriting(int count, Promise promise) {
        try {
            if (count <= 0) {
                promise.resolve("");
                return;
            }

            List<Path> paths = new ArrayList<>();
            List<Paint> paints = new ArrayList<>();
            int startIndex = Math.max(0, strokes.size() - count);

            for (int i = startIndex; i < strokes.size(); i++) {
                StrokeData stroke = strokes.get(i);
                if (stroke.bitmap == null && stroke.path != null && stroke.paint != null) {
                    paths.add(stroke.path);
                    paints.add(stroke.paint);
                }
            }

            if (paths.isEmpty()) {
                promise.resolve("");
                return;
            }

            AIProcessingService.recognizeHandwriting(paths, paints, promise);

        } catch (Exception e) {
            Log.e("NativeInfiniteCanvasView", "Handwriting recognition error", e);
            promise.reject("E_HANDWRITING_ERROR", "Error during handwriting recognition: " + e.getMessage());
        }
    }
}
