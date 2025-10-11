package com.zeroisle_notes.nativepdf;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Color;
import android.graphics.Paint;
import android.graphics.Path;
import android.graphics.PorterDuff;
import android.graphics.PorterDuffXfermode;
import android.util.Log;
import android.view.MotionEvent;
import android.view.ScaleGestureDetector;
import android.view.View;
import android.view.View.OnScrollChangeListener;
import android.widget.FrameLayout;

import androidx.annotation.NonNull;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.ReactContext;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.uimanager.events.RCTEventEmitter;

import com.github.barteksc.pdfviewer.PDFView;
import com.github.barteksc.pdfviewer.listener.OnDrawListener;
import com.github.barteksc.pdfviewer.listener.OnErrorListener;
import com.github.barteksc.pdfviewer.listener.OnLoadCompleteListener;
import com.github.barteksc.pdfviewer.listener.OnPageChangeListener;
import com.github.barteksc.pdfviewer.listener.OnPageScrollListener;
import com.github.barteksc.pdfviewer.listener.OnTapListener;
import com.github.barteksc.pdfviewer.util.FitPolicy;

import com.zeroisle_notes.TouchTypeDetectionModule;

import org.json.JSONException;
import org.json.JSONObject;

import java.io.File;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * 原生 PDF 视图 - 使用 AndroidPdfViewer + 智能手写层架构
 * 
 * 核心特性：
 * 1. AndroidPdfViewer - 整体PDF渲染，支持硬件加速
 * 2. DrawingOverlay - 透明手写层，与PDF完美同步
 * 3. 智能触摸识别 - 复用现有的 TouchTypeDetectionModule
 * 4. 流畅缩放体验 - 整体一致的缩放效果
 */
public class NativePDFView extends FrameLayout {
    
    private static final String TAG = "NativePDFView";
    
    // 核心组件
    private PDFView pdfView;              // AndroidPdfViewer 主视图
    private DrawingOverlay drawingOverlay; // 智能手写层
    
    // PDF 状态
    private int currentPage = 0;
    private int totalPages = 0;
    private float currentZoom = 1.0f;
    
    // 缩放限制
    private static final float MIN_ZOOM = 0.5f;  // 最小缩放50%
    private static final float MAX_ZOOM = 4.0f;  // 最大缩放400%
    
    // 缩放事件优化 - 更频繁的报告以提高响应性
    private float lastReportedZoom = 1.0f;
    private static final float ZOOM_REPORT_THRESHOLD = 0.02f; // 2%变化就报告，提高响应性
    
    // 缩放检查与限制
    private Runnable zoomCheckRunnable = null;
    private boolean isAdjustingZoom = false;
    
    // 缩放状态跟踪
    private boolean isScaling = false;
    private long lastZoomTime = 0;
    private static final long ZOOM_END_DELAY = 150; // 150ms后认为缩放结束
    
    // 绘图工具配置
    private String currentTool = "pen";
    private int currentColor = Color.BLACK;
    private float currentStrokeWidth = 2.0f;
    private JSONObject currentToolConfig = new JSONObject();
    
    // 笔迹数据存储（按页面索引）
    private List<List<StrokeData>> pageStrokes = new ArrayList<>();
    
    public NativePDFView(@NonNull Context context) {
        super(context);
        Log.d(TAG, "初始化 NativePDFView (重构版本)");
        initialize();
    }
    
    private void initialize() {
        // 1. 创建 AndroidPdfViewer
        pdfView = new PDFView(getContext(), null);
        pdfView.setBackgroundColor(Color.WHITE);
        
        // 启用硬件加速
        pdfView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        
        // 配置 PDF 显示参数
        // 注意：android-pdf-viewer 3.2.0-beta.1 的API配置在fromFile()时设置
        // 这里只进行基础配置
        pdfView.setBackgroundColor(Color.WHITE);
        
        // 添加到容器
        addView(pdfView, new FrameLayout.LayoutParams(
            LayoutParams.MATCH_PARENT,
            LayoutParams.MATCH_PARENT
        ));
        
        // 2. 创建智能手写层
        drawingOverlay = new DrawingOverlay(getContext());
        addView(drawingOverlay, new FrameLayout.LayoutParams(
            LayoutParams.MATCH_PARENT,
            LayoutParams.MATCH_PARENT
        ));
        
        // 3. 添加PDFView滚动监听器，确保笔迹实时跟随
        pdfView.setOnScrollChangeListener(new OnScrollChangeListener() {
            @Override
            public void onScrollChange(View v, int scrollX, int scrollY, int oldScrollX, int oldScrollY) {
                // PDF滚动时强制刷新手写层
                if (drawingOverlay != null) {
                    drawingOverlay.forceRefresh();
                }
            }
        });
        
        Log.d(TAG, "NativePDFView 初始化完成 - 已启用硬件加速和滚动同步");
    }
    
    /**
     * 从文件路径加载 PDF
     */
    public void loadPDFFromPath(String path) {
        Log.d(TAG, "========================================");
        Log.d(TAG, "开始加载PDF: " + path);
        long startTime = System.currentTimeMillis();
        
        try {
            File file = new File(path);
            if (!file.exists()) {
                Log.e(TAG, "PDF文件不存在: " + path);
                sendErrorEvent("FILE_NOT_FOUND", "PDF文件不存在: " + path);
                return;
            }
            
            long fileSize = file.length();
            Log.d(TAG, String.format("文件存在，大小: %d bytes (%.2f MB)", 
                fileSize, fileSize / 1024.0 / 1024.0));
            
            // 使用 AndroidPdfViewer 加载 PDF
            pdfView.fromFile(file)
                .defaultPage(currentPage)
                .enableSwipe(true)              // 启用滑动
                .swipeHorizontal(false)         // 垂直滑动
                .enableDoubletap(true)          // 启用双击缩放
                .spacing(10)                    // 页面间距
                .enableAnnotationRendering(false) // 禁用注释渲染
                .password(null)                 // 无密码
                .scrollHandle(null)             // 无滚动条
                .enableAntialiasing(true)       // 启用抗锯齿
                .pageFitPolicy(FitPolicy.WIDTH) // 适应宽度
                // Note: minZoom/maxZoom not available in this version
                // Zoom limiting is handled in onDraw callback instead
                .onLoad(new OnLoadCompleteListener() {
                    @Override
                    public void loadComplete(int nbPages) {
            long loadTime = System.currentTimeMillis() - startTime;
                        totalPages = nbPages;
                        Log.d(TAG, String.format("PDF加载完成，总页数: %d，耗时: %dms", totalPages, loadTime));
            
            // 初始化笔迹列表
            pageStrokes.clear();
            for (int i = 0; i < totalPages; i++) {
                pageStrokes.add(new ArrayList<StrokeData>());
            }
            
                        // 通知手写层PDF已加载
                        drawingOverlay.onPDFLoaded(totalPages);
            
                        // 设置初始缩放100%（居中显示）
            post(new Runnable() {
                @Override
                public void run() {
                                pdfView.zoomTo(1.0f);
                                currentZoom = 1.0f;
                                Log.d(TAG, "PDF已设置为100%缩放（居中显示）");
                            }
                        });
                        
                        // 发送就绪事件
                        sendReadyEvent(totalPages);
                    }
                })
                .onPageChange(new OnPageChangeListener() {
                    @Override
                    public void onPageChanged(int page, int pageCount) {
                        currentPage = page;
                        Log.d(TAG, String.format("页面切换: %d/%d", page, pageCount));
                        
                        // 通知手写层页面变化
                        drawingOverlay.onPageChanged(page);
                        
                        sendPageChangeEvent(page);
                    }
                })
                .onPageScroll(new OnPageScrollListener() {
                    @Override
                    public void onPageScrolled(int page, float positionOffset) {
                        // PDF滚动时同步手写层
                        // 更新当前页面（可能正在滚动到新页面）
                        if (page != currentPage) {
                            currentPage = page;
                            drawingOverlay.onPageChanged(page);
                        }
                        // 强制重绘以跟随滚动
                        drawingOverlay.invalidate();
                        Log.d(TAG, String.format("PDF滚动: 页面=%d, 偏移=%.2f", page, positionOffset));
                    }
                })
                .onError(new OnErrorListener() {
                    @Override
                    public void onError(Throwable t) {
                        Log.e(TAG, "加载PDF失败", t);
                        sendErrorEvent("LOAD_FAILED", "加载PDF失败: " + t.getMessage());
                    }
                })
                .onDraw(new OnDrawListener() {
                    @Override
                    public void onLayerDrawn(Canvas canvas, float pageWidth, float pageHeight, int displayedPage) {
                        // PDF绘制时同步缩放信息
                        float zoom = pdfView.getZoom();
                        
                        // 检查是否需要限制缩放（但不在绘制过程中调整）
                        if (!isAdjustingZoom && (zoom < MIN_ZOOM || zoom > MAX_ZOOM)) {
                            // 延迟调整缩放，避免在绘制过程中修改状态
                            final float currentZoomValue = zoom;
                            if (zoomCheckRunnable != null) {
                                removeCallbacks(zoomCheckRunnable);
                            }
                            zoomCheckRunnable = new Runnable() {
                                @Override
                                public void run() {
                                    float clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, currentZoomValue));
                                    isAdjustingZoom = true;
                                    pdfView.zoomTo(clampedZoom);
                                    currentZoom = clampedZoom;
                                    drawingOverlay.onZoomChanged(clampedZoom);
                                    drawingOverlay.forceRefresh(); // ✅ 强制刷新笔迹
                                    isAdjustingZoom = false;
                                    Log.d(TAG, String.format("缩放已限制: %.0f%% -> %.0f%%", 
                                        currentZoomValue * 100, clampedZoom * 100));
                                }
                            };
                            postDelayed(zoomCheckRunnable, 50); // 50ms延迟
                        }
                        
                        // 始终更新内部缩放值，确保笔迹实时跟随
                        boolean zoomChanged = Math.abs(currentZoom - zoom) > 0.001f;
                        currentZoom = zoom;
                        drawingOverlay.onZoomChanged(zoom);
                        
                        // ✅ 如果缩放真的发生了变化，强制刷新笔迹层
                        if (zoomChanged) {
                            drawingOverlay.forceRefresh();
                            Log.d(TAG, String.format("缩放实时更新: %.0f%% -> 笔迹已同步", zoom * 100));
                        }
                        
                        // 检查缩放变化并更新状态
                        boolean zoomReportChanged = Math.abs(zoom - lastReportedZoom) > ZOOM_REPORT_THRESHOLD;
                        if (zoomReportChanged) {
                            lastReportedZoom = zoom;
                            lastZoomTime = System.currentTimeMillis();
                            
                            // 如果之前没有在缩放，现在开始缩放
                            if (!isScaling) {
                                isScaling = true;
                                sendZoomChangeEvent(zoom, true); // 发送缩放开始事件
                                Log.d(TAG, String.format("缩放开始: %.0f%%", zoom * 100));
                            } else {
                                // 正在缩放中，发送缩放进行中事件
                                sendZoomChangeEvent(zoom, true);
                                Log.d(TAG, String.format("缩放进行中: %.0f%%", zoom * 100));
                            }
                        }
                        
                        // 检查缩放是否结束（延迟检查）
                        if (isScaling && (System.currentTimeMillis() - lastZoomTime) > ZOOM_END_DELAY) {
                            isScaling = false;
                            sendZoomChangeEvent(zoom, false); // 发送缩放结束事件
                            Log.d(TAG, String.format("缩放结束: %.0f%%", zoom * 100));
                        }
                    }
                })
                .load();
                
            Log.d(TAG, "========================================");
            
            } catch (Exception e) {
            Log.e(TAG, "加载PDF时发生错误", e);
            sendErrorEvent("UNKNOWN_ERROR", "未知错误: " + e.getMessage());
        }
    }
    
    /**
     * 从 URI 加载 PDF
     */
    public void loadPDFFromURI(String uri) {
        if (uri.startsWith("file://")) {
            loadPDFFromPath(uri.substring(7));
        } else {
            sendErrorEvent("UNSUPPORTED_URI", "只支持 file:// URIs");
        }
    }
    
    /**
     * 跳转到指定页面
     */
    public void setCurrentPage(int page) {
        if (page >= 0 && page < totalPages) {
            currentPage = page;
            pdfView.jumpTo(page, false);
            Log.d(TAG, String.format("跳转到页面: %d", page));
        }
    }
    
    /**
     * 设置缩放级别（带限制）
     */
    public void setZoom(float zoom) {
        float clampedZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, zoom));
        if (Math.abs(zoom - clampedZoom) > 0.01f) {
            Log.d(TAG, String.format("缩放请求被限制: %.0f%% -> %.0f%%", 
                zoom * 100, clampedZoom * 100));
        }
        pdfView.zoomTo(clampedZoom);
        currentZoom = clampedZoom;
        Log.d(TAG, String.format("设置缩放: %.0f%%", clampedZoom * 100));
    }
    
    /**
     * 获取当前缩放级别
     */
    public float getZoom() {
        return currentZoom;
    }
    
    /**
     * 获取最小缩放级别
     */
    public float getMinZoom() {
        return MIN_ZOOM;
    }
    
    /**
     * 获取最大缩放级别
     */
    public float getMaxZoom() {
        return MAX_ZOOM;
    }
    
    // ==================== 绘图工具设置 ====================
    
    public void setDrawingTool(String tool) {
        this.currentTool = tool;
        drawingOverlay.setCurrentTool(tool);
        Log.d(TAG, "设置绘图工具: " + tool);
    }
    
    public void setDrawingColor(String color) {
        this.currentColor = Color.parseColor(color);
        drawingOverlay.setCurrentColor(currentColor);
        Log.d(TAG, "设置绘图颜色: " + color);
    }
    
    public void setDrawingWidth(float width) {
        this.currentStrokeWidth = width;
        drawingOverlay.setCurrentStrokeWidth(width);
        Log.d(TAG, "设置绘图宽度: " + width);
    }
    
    public void setToolConfig(String configJson) {
        try {
            JSONObject config = new JSONObject(configJson);
            this.currentToolConfig = config;
            drawingOverlay.setToolConfig(config);
            Log.d(TAG, "设置工具配置: " + configJson);
        } catch (JSONException e) {
            Log.e(TAG, "解析工具配置失败", e);
        }
    }
    
    // ==================== 其他功能 ====================
    
    public void recognizeHandwriting(String strokeId) {
        Log.d(TAG, "recognizeHandwriting 尚未实现: " + strokeId);
    }
    
    public void addTextAnnotation(String text) {
        Log.d(TAG, "addTextAnnotation: " + text);
    }
    
    public void exportPDF(String outputPath) {
        try {
            JSONObject pdfData = new JSONObject();
            pdfData.put("outputPath", outputPath);
            pdfData.put("totalPages", totalPages);
            
            WritableMap event = Arguments.createMap();
            event.putString("outputPath", outputPath);
            event.putString("data", pdfData.toString());
            event.putBoolean("success", true);
            sendEvent("onExportComplete", event);
            
        } catch (Exception e) {
            Log.e(TAG, "导出PDF失败", e);
            sendErrorEvent("EXPORT_FAILED", "导出PDF失败: " + e.getMessage());
        }
    }
    
    public void setPendingPath(String path) {
        Log.d(TAG, "设置待加载路径: " + path);
        post(() -> {
            loadPDFFromPath(path);
        });
    }
    
    public void cleanup() {
        if (pdfView != null) {
            pdfView.recycle();
        }
        if (drawingOverlay != null) {
            drawingOverlay.cleanup();
        }
    }
    
    // ==================== 事件发送 ====================

    private void sendReadyEvent(int totalPages) {
        WritableMap event = Arguments.createMap();
        event.putInt("totalPages", totalPages);
        sendEvent("onReady", event);
    }
    
    private void sendErrorEvent(String code, String message) {
        WritableMap event = Arguments.createMap();
        event.putString("code", code);
        event.putString("message", message);
        sendEvent("onError", event);
    }
    
    private void sendPageChangeEvent(int page) {
        WritableMap event = Arguments.createMap();
        event.putInt("page", page);
        sendEvent("onPageChange", event);
    }
    
    private void sendZoomChangeEvent(float zoom, boolean isScaling) {
        WritableMap event = Arguments.createMap();
        event.putDouble("zoom", zoom);
        event.putBoolean("isScaling", isScaling);
        sendEvent("onZoomChange", event);
    }
    
    private void sendStrokeCommittedEvent(String strokeId) {
        WritableMap event = Arguments.createMap();
        event.putString("strokeId", strokeId);
        sendEvent("onStrokeCommitted", event);
    }
    
    private void sendEvent(String eventName, WritableMap params) {
        try {
            ReactContext reactContext = (ReactContext) getContext();
            if (reactContext != null) {
                reactContext.getJSModule(RCTEventEmitter.class)
                    .receiveEvent(getId(), eventName, params);
            }
        } catch (Exception e) {
            Log.e(TAG, "发送事件失败: " + eventName, e);
        }
    }
    
    // ==================== 智能手写层 ====================
    
    /**
     * 智能手写层 - 透明Canvas，叠加在PDF上方
     * 
     * 核心特性：
     * 1. 透明背景，不影响PDF显示
     * 2. 智能触摸识别（复用 TouchTypeDetectionModule）
     * 3. 与PDF缩放完美同步
     * 4. 硬件加速绘制
     */
    private class DrawingOverlay extends View {
        
        // 当前绘制状态
        private Path currentPath;
        private Paint currentPaint;
        private String currentStrokeId;
        
        // 触摸类型检测
        private String currentTouchType = TouchTypeDetectionModule.TOUCH_TYPE_UNKNOWN;
        private boolean isStylusMode = false;
        
        // PDF 同步状态
        private int pdfTotalPages = 0;
        private int pdfCurrentPage = 0;
        private float pdfZoom = 1.0f;
        
        // ✅ 缩放手势检测器
        private ScaleGestureDetector scaleDetector;
        
        public DrawingOverlay(Context context) {
            super(context);
            setWillNotDraw(false);
            setBackgroundColor(Color.TRANSPARENT);
            
            // 启用硬件加速
            setLayerType(View.LAYER_TYPE_HARDWARE, null);
            
            // ✅ 初始化缩放手势检测器
            scaleDetector = new ScaleGestureDetector(context, new ScaleGestureDetector.SimpleOnScaleGestureListener() {
                @Override
                public boolean onScale(ScaleGestureDetector detector) {
                    // 缩放时强制刷新绘制
                    invalidate();
                    Log.d(TAG, String.format("DrawingOverlay检测到缩放手势: 缩放因子=%.2f", detector.getScaleFactor()));
                    return true;
                }
                
                @Override
                public boolean onScaleBegin(ScaleGestureDetector detector) {
                    Log.d(TAG, "DrawingOverlay缩放手势开始");
                    return true;
                }
                
                @Override
                public void onScaleEnd(ScaleGestureDetector detector) {
                    Log.d(TAG, "DrawingOverlay缩放手势结束");
                    // 缩放结束时强制刷新，确保笔迹完全同步
                    invalidate();
                }
            });
            
            Log.d(TAG, "DrawingOverlay 初始化完成 - 已启用硬件加速和缩放检测");
        }
        
        public void onPDFLoaded(int totalPages) {
            this.pdfTotalPages = totalPages;
            Log.d(TAG, "DrawingOverlay: PDF已加载，总页数: " + totalPages);
        }
        
        public void onPageChanged(int page) {
            this.pdfCurrentPage = page;
            invalidate(); // 刷新显示当前页面的笔迹
        }
        
        public void onZoomChanged(float zoom) {
            // ✅ 只在缩放真正变化时才刷新和记录日志
            if (Math.abs(this.pdfZoom - zoom) > 0.001f) {
                float oldZoom = this.pdfZoom;
                this.pdfZoom = zoom;
                invalidate(); // 刷新以同步缩放
                
                // 详细日志：每10%缩放变化打印一次，避免日志过多
                if (Math.abs(oldZoom - zoom) > 0.1f) {
                    Log.d(TAG, String.format("DrawingOverlay缩放已更新: %.0f%% -> %.0f%%", 
                        oldZoom * 100, zoom * 100));
                }
            }
        }
        
        /**
         * 强制刷新绘制 - 用于滚动和缩放时的实时同步
         */
        public void forceRefresh() {
                invalidate();
        }
        
        @Override
        protected void onDraw(Canvas canvas) {
            super.onDraw(canvas);
            
            // 绘制当前页面的所有笔迹
            if (pdfCurrentPage >= 0 && pdfCurrentPage < pageStrokes.size()) {
                List<StrokeData> strokes = pageStrokes.get(pdfCurrentPage);
                
                canvas.save();
                
                try {
                    // ✅ 获取实时缩放值，确保与PDF完全同步
                    float realTimeZoom = pdfView.getZoom();
                    
                    // 获取PDF在视图中的偏移量（PDFView已经包含了所有位置信息）
                    float currentXOffset = pdfView.getCurrentXOffset();
                    float currentYOffset = pdfView.getCurrentYOffset();
                    
                    // ✅ 直接使用PDFView的偏移量作为页面位置
                    // currentXOffset/currentYOffset 已经是页面在屏幕上的完整位置
                    // 不需要额外计算居中偏移
                    canvas.translate(currentXOffset, currentYOffset);
                    canvas.scale(realTimeZoom, realTimeZoom);
                    
                    // 绘制所有已保存的笔迹（这些笔迹存储在PDF坐标空间）
                    for (StrokeData stroke : strokes) {
                        canvas.drawPath(stroke.path, stroke.paint);
                    }
                    
                    // 绘制当前正在绘制的笔迹
                    if (currentPath != null && currentPaint != null) {
                        canvas.drawPath(currentPath, currentPaint);
                    }
                    
                    // 调试日志（偶尔输出）
                    if (strokes.size() > 0 && Math.random() < 0.01) { // 1%概率打印
                        Log.d(TAG, String.format("绘制笔迹 - 页面:%d, 笔迹数:%d, 缩放:%.2f, 偏移:(%.1f,%.1f)", 
                            pdfCurrentPage, strokes.size(), realTimeZoom, currentXOffset, currentYOffset));
                    }
                    
                } catch (Exception e) {
                    Log.e(TAG, "绘制笔迹时发生错误", e);
                    // 降级到简化绘制（只应用缩放，不考虑偏移）
                    float fallbackZoom = pdfView.getZoom();
                    float fallbackXOffset = pdfView.getCurrentXOffset();
                    float fallbackYOffset = pdfView.getCurrentYOffset();
                    canvas.translate(fallbackXOffset, fallbackYOffset);
                    canvas.scale(fallbackZoom, fallbackZoom);
                    for (StrokeData stroke : strokes) {
                        canvas.drawPath(stroke.path, stroke.paint);
                    }
                    if (currentPath != null && currentPaint != null) {
                        canvas.drawPath(currentPath, currentPaint);
                    }
                }
                
                canvas.restore();
            }
        }
        
        @Override
        public boolean onTouchEvent(MotionEvent event) {
            // ✅ 先让缩放检测器处理事件（用于检测双指缩放）
            boolean scaleHandled = scaleDetector.onTouchEvent(event);
            
            int pointerCount = event.getPointerCount();
            
            // 多指手势 - 交给PDFView处理缩放
            if (pointerCount >= 2) {
                Log.d(TAG, "多指手势 -> PDF缩放");
                return scaleHandled || false; // 让PDFView和scaleDetector协同处理
            }
            
            // 单指手势 - 检测触摸类型
            int action = event.getActionMasked();
            
            if (action == MotionEvent.ACTION_DOWN) {
                // 智能触摸识别（复用现有模块）
                currentTouchType = TouchTypeDetectionModule.detectTouchTypeFromMotionEvent(event, 0);
                isStylusMode = TouchTypeDetectionModule.TOUCH_TYPE_STYLUS.equals(currentTouchType);
                
                Log.d(TAG, String.format("触摸开始 - 类型: %s, 手写笔: %s, 工具: %s", 
                    currentTouchType, isStylusMode, currentTool));
                
                // 只有手写笔才能绘制
                if (isStylusMode) {
                    startDrawing(event.getX(), event.getY());
                    getParent().requestDisallowInterceptTouchEvent(true);
                    return true;
                } else {
                    // 手指操作交给PDFView处理滚动
                    return false;
                }
            } else if (isStylusMode) {
                // 手写笔继续绘制
                switch (action) {
                case MotionEvent.ACTION_MOVE:
                        continueDrawing(event.getX(), event.getY());
                    return true;
                    
                case MotionEvent.ACTION_UP:
                case MotionEvent.ACTION_CANCEL:
                    endDrawing();
                    getParent().requestDisallowInterceptTouchEvent(false);
                    return true;
                }
            }
            
            return super.onTouchEvent(event);
        }
        
        private void startDrawing(float x, float y) {
            // 转换为PDF坐标空间
            float[] pdfCoords = screenToPDFCoords(x, y);
            
            currentStrokeId = UUID.randomUUID().toString();
            currentPath = new Path();
            currentPath.moveTo(pdfCoords[0], pdfCoords[1]);
            
            currentPaint = new Paint();
            currentPaint.setColor(currentColor);
            currentPaint.setStrokeWidth(currentStrokeWidth);
            currentPaint.setStyle(Paint.Style.STROKE);
            currentPaint.setStrokeCap(Paint.Cap.ROUND);
            currentPaint.setStrokeJoin(Paint.Join.ROUND);
            currentPaint.setAntiAlias(true);
            
            // 应用工具特定配置
            if ("highlighter".equals(currentTool)) {
                currentPaint.setAlpha(128);
                currentPaint.setStrokeWidth(currentStrokeWidth * 2);
            }
            
            Log.d(TAG, String.format("开始绘制 - PDF坐标: (%.1f, %.1f)", pdfCoords[0], pdfCoords[1]));
            invalidate();
        }
        
        private void continueDrawing(float x, float y) {
            if (currentPath != null) {
                float[] pdfCoords = screenToPDFCoords(x, y);
                currentPath.lineTo(pdfCoords[0], pdfCoords[1]);
                invalidate();
            }
        }
        
        private void endDrawing() {
            if (currentPath != null && currentPaint != null) {
                // 保存笔迹
                StrokeData stroke = new StrokeData(
                    currentPath, 
                    currentPaint, 
                    currentStrokeId,
                    currentTool
                );
                
                pageStrokes.get(pdfCurrentPage).add(stroke);
                
                Log.d(TAG, String.format("笔迹已保存 - 页面: %d, ID: %s", pdfCurrentPage, currentStrokeId));
                
                // 发送事件
                sendStrokeCommittedEvent(currentStrokeId);
                
                currentPath = null;
                currentPaint = null;
                currentStrokeId = null;
                
                invalidate();
            }
        }
        
        /**
         * 将屏幕坐标转换为PDF坐标空间
         * 使用与onDraw完全相同的变换逻辑，确保坐标转换的一致性
         */
        private float[] screenToPDFCoords(float screenX, float screenY) {
            try {
                // ✅ 获取实时缩放值和偏移量，确保与PDF完全同步
                float realTimeZoom = pdfView.getZoom();
                float currentXOffset = pdfView.getCurrentXOffset();
                float currentYOffset = pdfView.getCurrentYOffset();
                
                // 获取当前页面的实际尺寸（用于边界检查）
                float pageWidth = pdfView.getPageSize(pdfCurrentPage).getWidth();
                float pageHeight = pdfView.getPageSize(pdfCurrentPage).getHeight();
                
                // ✅ 逆向应用变换（与onDraw中的 translate + scale 对应）
                // 先减去偏移量，再除以缩放
                float pdfX = (screenX - currentXOffset) / realTimeZoom;
                float pdfY = (screenY - currentYOffset) / realTimeZoom;
                
                // 边界检查，确保坐标在页面范围内
                pdfX = Math.max(0, Math.min(pdfX, pageWidth));
                pdfY = Math.max(0, Math.min(pdfY, pageHeight));
                
                // 调试日志（详细模式）
                if (Math.random() < 0.05) { // 5%概率打印，避免日志过多
                    Log.d(TAG, String.format("坐标转换: 屏幕(%.1f,%.1f) -> PDF(%.1f,%.1f), 缩放:%.2f, 偏移:(%.1f,%.1f)", 
                        screenX, screenY, pdfX, pdfY, realTimeZoom, currentXOffset, currentYOffset));
                }
                
                return new float[]{pdfX, pdfY};
            
            } catch (Exception e) {
                Log.e(TAG, "坐标转换失败，使用简化方法", e);
                // 降级到简化方法
                float fallbackZoom = pdfView.getZoom();
                float fallbackXOffset = pdfView.getCurrentXOffset();
                float fallbackYOffset = pdfView.getCurrentYOffset();
                float pdfX = (screenX - fallbackXOffset) / fallbackZoom;
                float pdfY = (screenY - fallbackYOffset) / fallbackZoom;
                return new float[]{pdfX, pdfY};
            }
        }
        
        public void setCurrentTool(String tool) {
            // 工具已更新
        }
        
        public void setCurrentColor(int color) {
            // 颜色已更新
        }
        
        public void setCurrentStrokeWidth(float width) {
            // 宽度已更新
        }
        
        public void setToolConfig(JSONObject config) {
            // 配置已更新
    }
    
    public void cleanup() {
            currentPath = null;
            currentPaint = null;
        }
    }
    
    // ==================== 数据结构 ====================
    
    /**
     * 笔迹数据
     */
    private static class StrokeData {
        Path path;
        Paint paint;
        String id;
        String toolType;
        
        StrokeData(Path path, Paint paint, String id, String toolType) {
            this.path = new Path(path);
            this.paint = new Paint(paint);
            this.id = id;
            this.toolType = toolType;
        }
    }
}
