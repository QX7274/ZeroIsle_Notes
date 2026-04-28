package com.zeroisle_notes.nativepdf;

import android.content.Context;
import android.graphics.Canvas;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.net.Uri;
import android.content.ContentResolver;
import java.io.InputStream;
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

import com.facebook.react.bridge.Promise;
import android.graphics.RectF;

// ML Kit
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.chinese.ChineseTextRecognizerOptions;


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
                        sendHistoryStateChangeEvent(false, false);
                    }
                })
                .onPageChange(new OnPageChangeListener() {
                    @Override
                    public void onPageChanged(int page, int pageCount) {
                        currentPage = page;
                        Log.d(TAG, String.format("页面切换: %d/%d", page, pageCount));

                        // ✅ 确保页面索引同步到DrawingOverlay
                        drawingOverlay.onPageChanged(page);

                        sendPageChangeEvent(page);
                        emitHistoryStateChangeFromOverlay();
                    }
                })
                .onPageScroll(new OnPageScrollListener() {
                    @Override
                    public void onPageScrolled(int page, float positionOffset) {
                        // PDF滚动时同步手写层
                        // ✅ 更新当前页面索引并同步到DrawingOverlay
                        // 当positionOffset > 0.5时，认为用户已经切换到下一页
                        int displayPage = positionOffset > 0.5f ? page + 1 : page;
                        if (displayPage != currentPage && displayPage >= 0 && displayPage < totalPages) {
                            currentPage = displayPage;
                            drawingOverlay.onPageChanged(displayPage);
                            Log.d(TAG, String.format("页面切换确认: %d -> %d (偏移=%.2f)", page, displayPage, positionOffset));
                        }
                        // 强制重绘以跟随滚动
                        drawingOverlay.invalidate();
                        Log.d(TAG, String.format("PDF滚动: 页面=%d, 偏移=%.2f, 当前页=%d", page, positionOffset, currentPage));
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

    /**
     * 导入保存的注释数据
     */
    public void importAnnotations(String annotationsJson) {
        try {
            Log.d(TAG, "开始导入PDF笔迹数据...");
            Log.d(TAG, "接收到的JSON数据长度: " + annotationsJson.length());
            Log.d(TAG, "接收到的JSON数据预览: " + annotationsJson.substring(0, Math.min(200, annotationsJson.length())) + "...");

            JSONObject annotationsData = new JSONObject(annotationsJson);
            int savedTotalPages = annotationsData.getInt("totalPages");
            Log.d(TAG, "解析的totalPages: " + savedTotalPages + ", 当前PDF总页数: " + totalPages);

            if (savedTotalPages != totalPages) {
                Log.w(TAG, String.format("警告: 保存的页数(%d)与当前PDF页数(%d)不匹配",
                    savedTotalPages, totalPages));
            }

            org.json.JSONArray pagesArray = annotationsData.getJSONArray("pages");
            int importedStrokes = 0;

            for (int i = 0; i < pagesArray.length(); i++) {
                org.json.JSONObject pageData = pagesArray.getJSONObject(i);
                int pageIndex = pageData.getInt("page");

                if (pageIndex >= 0 && pageIndex < totalPages) {
                    org.json.JSONArray strokesArray = pageData.getJSONArray("strokes");
                    List<StrokeData> pageStrokesList = pageStrokes.get(pageIndex);

                    for (int j = 0; j < strokesArray.length(); j++) {
                        org.json.JSONObject strokeObj = strokesArray.getJSONObject(j);

                        // 重建Paint对象
                        Paint paint = new Paint();
                        paint.setColor(strokeObj.getInt("color"));
                        paint.setStrokeWidth((float) strokeObj.getDouble("strokeWidth"));
                        paint.setAlpha(strokeObj.getInt("alpha"));
                        paint.setStyle(Paint.Style.STROKE);
                        paint.setStrokeCap(Paint.Cap.ROUND);
                        paint.setStrokeJoin(Paint.Join.ROUND);
                        paint.setAntiAlias(true);

                        // 重建Path对象
                        String pathData = strokeObj.getString("pathData");
                        Path path = deserializePathFromString(pathData);

                        // 创建StrokeData并添加到列表
                        StrokeData stroke = new StrokeData(
                            path,
                            paint,
                            strokeObj.getString("id"),
                            strokeObj.getString("toolType")
                        );

                        pageStrokesList.add(stroke);
                        importedStrokes++;
                    }

                    Log.d(TAG, String.format("页面 %d: 导入 %d 个笔迹",
                        pageIndex, strokesArray.length()));
                }
            }

            // 刷新绘制
            if (drawingOverlay != null) {
                drawingOverlay.invalidate();
            }

            Log.d(TAG, String.format("PDF笔迹数据导入成功，总计导入 %d 个笔迹", importedStrokes));

        } catch (Exception e) {
            Log.e(TAG, "导入PDF注释失败", e);
            sendErrorEvent("IMPORT_FAILED", "导入PDF注释失败: " + e.getMessage());
        }
    }

    public void exportPDF(String outputPath) {
        try {
            Log.d(TAG, "开始导出PDF笔迹数据...");

            // ✅ 序列化所有页面的笔迹数据
            JSONObject annotationsData = new JSONObject();
            annotationsData.put("version", "1.0");
            annotationsData.put("totalPages", totalPages);

            org.json.JSONArray pagesArray = new org.json.JSONArray();
            for (int pageIndex = 0; pageIndex < totalPages; pageIndex++) {
                org.json.JSONObject pageData = new org.json.JSONObject();
                pageData.put("page", pageIndex);

                List<StrokeData> strokes = pageStrokes.get(pageIndex);
                org.json.JSONArray strokesArray = new org.json.JSONArray();

                for (StrokeData stroke : strokes) {
                    org.json.JSONObject strokeObj = new org.json.JSONObject();
                    strokeObj.put("id", stroke.id);
                    strokeObj.put("toolType", stroke.toolType);
                    strokeObj.put("color", stroke.paint.getColor());
                    strokeObj.put("strokeWidth", stroke.paint.getStrokeWidth());
                    strokeObj.put("alpha", stroke.paint.getAlpha());

                    // 序列化Path数据（简化版 - 只保存关键点）
                    strokeObj.put("pathData", serializePathToString(stroke.path));

                    strokesArray.put(strokeObj);
                }

                pageData.put("strokes", strokesArray);
                pageData.put("strokeCount", strokes.size());
                pagesArray.put(pageData);

                Log.d(TAG, String.format("页面 %d: %d 个笔迹", pageIndex, strokes.size()));
            }

            annotationsData.put("pages", pagesArray);

            // 发送导出完成事件，包含序列化的笔迹数据
            WritableMap event = Arguments.createMap();
            event.putString("outputPath", outputPath);
            event.putString("annotationsData", annotationsData.toString());
            event.putBoolean("success", true);
            sendEvent("onExportComplete", event);

            Log.d(TAG, "PDF笔迹数据导出成功，总计 " + annotationsData.getJSONArray("pages").length() + " 页");

        } catch (Exception e) {
            Log.e(TAG, "导出PDF失败", e);
            sendErrorEvent("EXPORT_FAILED", "导出PDF失败: " + e.getMessage());
        }
    }

    /**
     * 将Path序列化为字符串（使用点坐标数组）
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
            Log.e(TAG, "序列化Path失败", e);
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
            Log.e(TAG, "反序列化Path失败", e);
        }

        return path;
    }

    public void setPendingPath(String path) {
        Log.d(TAG, "设置待加载路径: " + path);
        post(() -> {
            loadPDFFromPath(path);
        });
    }

    // ==================== 撤销/重做/清除功能 ====================

    public void undo() {
        if (drawingOverlay != null) {
            drawingOverlay.undo();
            emitHistoryStateChangeFromOverlay();
        }
    }

    public void redo() {
        if (drawingOverlay != null) {
            drawingOverlay.redo();
            emitHistoryStateChangeFromOverlay();
        }
    }

    public void clear(String clearType) {
        if (drawingOverlay != null) {
            drawingOverlay.clear(clearType);
            emitHistoryStateChangeFromOverlay();
        }
    }

    public void lassoSelect(String selectionData) {
        if (drawingOverlay != null) {
            drawingOverlay.lassoSelect(selectionData);
        }
    }

    public void lassoComplete(String completionData) {
        if (drawingOverlay != null) {
            drawingOverlay.lassoComplete(completionData);
        }
    }

    public void addImage(String imageUri) {
        if (drawingOverlay != null) {
            drawingOverlay.addImage(imageUri);
        }
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

    private void sendHistoryStateChangeEvent(boolean canUndo, boolean canRedo) {
        WritableMap event = Arguments.createMap();
        event.putBoolean("canUndo", canUndo);
        event.putBoolean("canRedo", canRedo);
        sendEvent("onHistoryStateChange", event);
    }

    private void emitHistoryStateChangeFromOverlay() {
        if (drawingOverlay != null) {
            sendHistoryStateChangeEvent(drawingOverlay.canUndo(), drawingOverlay.canRedo());
        }
    }

    private void sendStrokeCommittedEvent(String strokeId) {
        WritableMap event = Arguments.createMap();
        event.putString("strokeId", strokeId);

        // ✅ 添加完整的笔迹数据，以便 JavaScript 端可以保存
        try {
            // 从当前页面的笔迹列表中找到对应的笔迹
            if (currentPage >= 0 && currentPage < pageStrokes.size()) {
                List<StrokeData> strokes = pageStrokes.get(currentPage);
                for (StrokeData stroke : strokes) {
                    if (stroke.id.equals(strokeId)) {
                        // 序列化笔迹数据
                        event.putString("pathData", serializePathToString(stroke.path));
                        event.putInt("color", stroke.paint.getColor());
                        event.putDouble("strokeWidth", stroke.paint.getStrokeWidth());
                        event.putInt("alpha", stroke.paint.getAlpha());
                        event.putString("toolType", stroke.toolType);
                        break;
                    }
                }
            }
        } catch (Exception e) {
            Log.w(TAG, "添加笔迹数据到事件失败", e);
        }

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
        private float lastPressure = 1.0f;
        private float lastPdfX = Float.NaN;
        private float lastPdfY = Float.NaN;

        // 触摸类型检测
        private String currentTouchType = TouchTypeDetectionModule.TOUCH_TYPE_UNKNOWN;
        private boolean isStylusMode = false;

        // PDF 同步状态
        private int pdfTotalPages = 0;
        private int pdfCurrentPage = 0;
        private float pdfZoom = 1.0f;
        // 每页重做栈
        private List<List<StrokeData>> redoStacks = new ArrayList<>();

        // ✅ 缩放手势检测器
        private ScaleGestureDetector scaleDetector;

        // 橡皮擦相关
        private List<String> erasedStrokeIds = new ArrayList<>();

        // 套索选择相关
        private Path lassoPath;
        private Paint lassoPaint;
        private List<String> selectedStrokeIds = new ArrayList<>();

        // 形状工具相关
        private float shapeStartX, shapeStartY;
        private String currentShape = "line";

        // 激光笔相关
        private Path laserPath;
        private Paint laserPaint;
        private android.os.Handler laserHandler = new android.os.Handler();

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
            // 初始化重做栈
            redoStacks.clear();
            for (int i = 0; i < totalPages; i++) {
                redoStacks.add(new ArrayList<StrokeData>());
            }
        }

        public void onPageChanged(int page) {
            this.pdfCurrentPage = page;

            // ✅ 页面切换时清理当前绘制状态，避免跨页面绘制问题
            if (currentPath != null) {
                Log.d(TAG, "页面切换时清理当前绘制状态");
                currentPath = null;
                currentPaint = null;
                currentStrokeId = null;
            }

            // ✅ 确保页面索引有效且与主视图同步
            if (page >= 0 && page < pageStrokes.size()) {
                Log.d(TAG, String.format("DrawingOverlay页面切换: %d/%d, 该页面笔迹数: %d",
                    page, pdfTotalPages, pageStrokes.get(page).size()));
            } else {
                Log.w(TAG, String.format("DrawingOverlay页面切换异常 - 页面: %d, 总页面: %d, 笔迹列表大小: %d",
                    page, pdfTotalPages, pageStrokes.size()));
            }

            // ✅ 强制刷新以确保笔迹正确显示
            invalidate();
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

            // ✅ 确保页面索引有效且笔迹列表已初始化
            if (pdfCurrentPage >= 0 && pdfCurrentPage < pageStrokes.size() && pageStrokes.size() > 0) {
                List<StrokeData> strokes = pageStrokes.get(pdfCurrentPage);

                canvas.save();

                try {
                    // ✅ 获取实时缩放值，确保与PDF完全同步
                    float realTimeZoom = pdfView.getZoom();

                    // 获取PDF在视图中的偏移量（PDFView已经包含了所有位置信息）
                    float currentXOffset = pdfView.getCurrentXOffset();
                    float currentYOffset = pdfView.getCurrentYOffset();

                    // ✅ 计算当前页面在整个PDF文档中的偏移量
                    // 考虑前面所有页面的高度和页面间距
                    float pageOffsetY = 0;
                    for (int i = 0; i < pdfCurrentPage; i++) {
                        pageOffsetY += pdfView.getPageSize(i).getHeight() * realTimeZoom;
                        pageOffsetY += 10 * realTimeZoom; // 页面间距 (spacing = 10)
                    }

                    // ✅ 应用变换：全局偏移 + 页面偏移 + 缩放
                    canvas.translate(currentXOffset, currentYOffset + pageOffsetY);
                    canvas.scale(realTimeZoom, realTimeZoom);

                    // 绘制所有已保存的笔迹（这些笔迹存储在PDF坐标空间）
                    for (StrokeData stroke : strokes) {
                        if ("image".equals(stroke.toolType) && stroke.bitmap != null) {
                            android.graphics.RectF dst = new android.graphics.RectF(
                                stroke.imageX, stroke.imageY,
                                stroke.imageX + stroke.imageW, stroke.imageY + stroke.imageH
                            );
                            canvas.drawBitmap(stroke.bitmap, null, dst, null);
                        } else if (stroke.path != null && stroke.paint != null) {
                            canvas.drawPath(stroke.path, stroke.paint);
                        }
                    }

                    // 绘制当前正在绘制的笔迹
                    if (currentPath != null && currentPaint != null) {
                        canvas.drawPath(currentPath, currentPaint);
                    }

                    // 绘制套索选择路径
                    if (lassoPath != null && lassoPaint != null) {
                        canvas.drawPath(lassoPath, lassoPaint);
                    }

                    // 绘制激光笔路径
                    if (laserPath != null && laserPaint != null) {
                        canvas.drawPath(laserPath, laserPaint);
                    }

                    // ✅ 增强调试日志，帮助诊断页面切换问题
                    if (strokes.size() > 0 && Math.random() < 0.02) { // 2%概率打印
                        Log.d(TAG, String.format("绘制笔迹 - 页面:%d/%d, 笔迹数:%d, 缩放:%.2f, 全局偏移:(%.1f,%.1f), 页面偏移:%.1f, 总页面数:%d",
                            pdfCurrentPage, pdfTotalPages, strokes.size(), realTimeZoom, currentXOffset, currentYOffset, pageOffsetY, pageStrokes.size()));
                    }

                } catch (Exception e) {
                    Log.e(TAG, "绘制笔迹时发生错误", e);
                    // 降级到简化绘制
                    float fallbackZoom = pdfView.getZoom();
                    float fallbackXOffset = pdfView.getCurrentXOffset();
                    float fallbackYOffset = pdfView.getCurrentYOffset();

                    // 计算页面偏移
                    float pageOffsetY = 0;
                    try {
                        for (int i = 0; i < pdfCurrentPage; i++) {
                            pageOffsetY += pdfView.getPageSize(i).getHeight() * fallbackZoom;
                            pageOffsetY += 10 * fallbackZoom;
                        }
                    } catch (Exception ex) {
                        Log.e(TAG, "计算页面偏移失败", ex);
                    }

                    canvas.translate(fallbackXOffset, fallbackYOffset + pageOffsetY);
                    canvas.scale(fallbackZoom, fallbackZoom);
                    for (StrokeData stroke : strokes) {
                        canvas.drawPath(stroke.path, stroke.paint);
                    }
                    if (currentPath != null && currentPaint != null) {
                        canvas.drawPath(currentPath, currentPaint);
                    }
                }

                canvas.restore();
            } else {
                // ✅ 添加调试信息，帮助诊断页面索引问题
                if (Math.random() < 0.01) { // 1%概率打印
                    Log.w(TAG, String.format("无法绘制笔迹 - 页面:%d, 总页面:%d, 笔迹列表大小:%d",
                        pdfCurrentPage, pdfTotalPages, pageStrokes.size()));
                }
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
                if (event.getPointerCount() > 0) {
                    lastPressure = event.getPressure(0);
                }

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
                if (event.getPointerCount() > 0) {
                    lastPressure = event.getPressure(0);
                }
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

            Log.d(TAG, String.format("开始绘制 - 工具:%s, PDF坐标: (%.1f, %.1f)", currentTool, pdfCoords[0], pdfCoords[1]));

            // 根据工具类型处理
            if ("eraser".equals(currentTool)) {
                startErasing(pdfCoords[0], pdfCoords[1]);
            } else if ("lasso".equals(currentTool) || "select".equals(currentTool)) {
                startLassoSelection(pdfCoords[0], pdfCoords[1]);
            } else if ("shape".equals(currentTool)) {
                startShape(pdfCoords[0], pdfCoords[1]);
            } else if ("laser".equals(currentTool)) {
                startLaser(pdfCoords[0], pdfCoords[1]);
            } else {
                // 默认绘图工具：pen, pencil, brush, highlighter等
                startDefaultDrawing(pdfCoords[0], pdfCoords[1]);
            }
        }

        private void startDefaultDrawing(float pdfX, float pdfY) {
            currentStrokeId = UUID.randomUUID().toString();
            currentPath = new Path();
            currentPath.moveTo(pdfX, pdfY);

            currentPaint = new Paint();
            currentPaint.setColor(currentColor);
            currentPaint.setStrokeWidth(resolveToolBaseStrokeWidth());
            currentPaint.setStyle(Paint.Style.STROKE);
            currentPaint.setStrokeCap(Paint.Cap.ROUND);
            currentPaint.setStrokeJoin(Paint.Join.ROUND);
            currentPaint.setAntiAlias(true);

            // 应用工具特定配置
            if ("highlighter".equals(currentTool)) {
                currentPaint.setAlpha(128);
            } else if ("pencil".equals(currentTool)) {
                currentPaint.setAlpha(179); // 70% opacity
            }

            lastPdfX = pdfX;
            lastPdfY = pdfY;
            applyDynamicStrokeWidth(Math.max(0.2f, Math.min(1.8f, lastPressure)));
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
            if (currentPaint == null) {
                return;
            }
            float baseWidth = resolveToolBaseStrokeWidth();
            float safePressure = Math.max(0.2f, Math.min(1.8f, pressure));
            currentPaint.setStrokeWidth(baseWidth * safePressure);
        }

        private void startErasing(float pdfX, float pdfY) {
            erasedStrokeIds.clear();
            eraseAt(pdfX, pdfY);
        }

        private void eraseAt(float pdfX, float pdfY) {
            float eraserRadius = currentStrokeWidth * 3;
            List<StrokeData> strokes = pageStrokes.get(pdfCurrentPage);

            for (int i = strokes.size() - 1; i >= 0; i--) {
                StrokeData stroke = strokes.get(i);

                // 避免重复删除
                if (erasedStrokeIds.contains(stroke.id)) {
                    continue;
                }

                // 检查笔迹是否与橡皮擦点相交
                boolean shouldErase = false;

                // 方法1: 检查橡皮擦点是否在笔迹附近
                android.graphics.Path path = stroke.path;
                android.graphics.RectF bounds = new android.graphics.RectF();
                path.computeBounds(bounds, true);

                if (bounds.contains(pdfX, pdfY)) {
                    // 计算点到路径的最短距离
                    float minDistance = Float.MAX_VALUE;
                    android.graphics.PathMeasure pathMeasure = new android.graphics.PathMeasure(path, false);
                    float[] pos = new float[2];
                    float[] tan = new float[2];

                    for (float distance = 0; distance < pathMeasure.getLength(); distance += 5) {
                        pathMeasure.getPosTan(distance, pos, tan);
                        float dist = (float) Math.sqrt(
                            Math.pow(pdfX - pos[0], 2) + Math.pow(pdfY - pos[1], 2)
                        );
                        minDistance = Math.min(minDistance, dist);
                    }

                    if (minDistance <= eraserRadius) {
                        shouldErase = true;
                    }
                }

                // 方法2: 如果笔迹边界与橡皮擦区域相交，也考虑删除
                if (!shouldErase) {
                    android.graphics.RectF eraserRect = new android.graphics.RectF(
                        pdfX - eraserRadius, pdfY - eraserRadius,
                        pdfX + eraserRadius, pdfY + eraserRadius
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
                    erasedStrokeIds.add(stroke.id);
                    strokes.remove(i);
                    Log.d(TAG, "擦除笔迹: " + stroke.id);
                    break; // 每次只擦除一个笔迹
                }
            }
            invalidate();
        }

        private void startLassoSelection(float pdfX, float pdfY) {
            lassoPath = new Path();
            lassoPath.moveTo(pdfX, pdfY);

            lassoPaint = new Paint();
            lassoPaint.setColor(Color.BLUE);
            lassoPaint.setStrokeWidth(2);
            lassoPaint.setStyle(Paint.Style.STROKE);
            lassoPaint.setPathEffect(new android.graphics.DashPathEffect(new float[]{10, 5}, 0));
            lassoPaint.setAntiAlias(true);

            selectedStrokeIds.clear();
            invalidate();
        }

        private void startShape(float pdfX, float pdfY) {
            shapeStartX = pdfX;
            shapeStartY = pdfY;

            currentPath = new Path();
            currentPaint = new Paint();
            currentPaint.setColor(currentColor);
            currentPaint.setStrokeWidth(currentStrokeWidth);
            currentPaint.setStyle(Paint.Style.STROKE);
            currentPaint.setStrokeCap(Paint.Cap.ROUND);
            currentPaint.setAntiAlias(true);

            // 从toolConfig获取形状类型
            try {
                if (currentToolConfig.has("shape")) {
                    currentShape = currentToolConfig.getString("shape");
                }
            } catch (JSONException e) {
                currentShape = "line";
            }

            invalidate();
        }

        private void startLaser(float pdfX, float pdfY) {
            laserPath = new Path();
            laserPath.moveTo(pdfX, pdfY);

            laserPaint = new Paint();
            laserPaint.setColor(Color.RED);
            laserPaint.setStrokeWidth(currentStrokeWidth * 2);
            laserPaint.setStyle(Paint.Style.STROKE);
            laserPaint.setStrokeCap(Paint.Cap.ROUND);
            laserPaint.setStrokeJoin(Paint.Join.ROUND);
            laserPaint.setAlpha(204); // 80% opacity
            laserPaint.setAntiAlias(true);

            invalidate();
        }

        private void continueDrawing(float x, float y) {
            float[] pdfCoords = screenToPDFCoords(x, y);

            if ("eraser".equals(currentTool)) {
                eraseAt(pdfCoords[0], pdfCoords[1]);
            } else if ("lasso".equals(currentTool) || "select".equals(currentTool)) {
                if (lassoPath != null) {
                    lassoPath.lineTo(pdfCoords[0], pdfCoords[1]);
                    invalidate();
                }
            } else if ("shape".equals(currentTool)) {
                // 更新形状预览
                updateShapePath(pdfCoords[0], pdfCoords[1]);
                invalidate();
            } else if ("laser".equals(currentTool)) {
                if (laserPath != null) {
                    laserPath.lineTo(pdfCoords[0], pdfCoords[1]);
                    invalidate();
                }
            } else {
                // 默认绘图
                if (currentPath != null) {
                    applyDynamicStrokeWidth(Math.max(0.2f, Math.min(1.8f, lastPressure)));
                    if (!Float.isNaN(lastPdfX) && !Float.isNaN(lastPdfY)) {
                        float midX = (lastPdfX + pdfCoords[0]) / 2f;
                        float midY = (lastPdfY + pdfCoords[1]) / 2f;
                        currentPath.quadTo(lastPdfX, lastPdfY, midX, midY);
                    } else {
                        currentPath.lineTo(pdfCoords[0], pdfCoords[1]);
                    }
                    lastPdfX = pdfCoords[0];
                    lastPdfY = pdfCoords[1];
                    invalidate();
                }
            }
        }

        private void endDrawing() {
            if ("eraser".equals(currentTool)) {
                erasedStrokeIds.clear();
                Log.d(TAG, "橡皮擦结束");
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
            if (currentPath != null && currentPaint != null) {
                // ✅ 确保页面索引有效且笔迹列表已初始化
                if (pdfCurrentPage >= 0 && pdfCurrentPage < pageStrokes.size()) {
                    // 保存笔迹
                    StrokeData stroke = new StrokeData(
                        currentPath,
                        currentPaint,
                        currentStrokeId,
                        currentTool
                    );

                    pageStrokes.get(pdfCurrentPage).add(stroke);
                    // 新操作清空当前页重做栈
                    if (pdfCurrentPage < redoStacks.size()) {
                        redoStacks.get(pdfCurrentPage).clear();
                    }

                    Log.d(TAG, String.format("笔迹已保存 - 页面: %d/%d, ID: %s, 工具: %s, 该页面笔迹总数: %d",
                        pdfCurrentPage, pdfTotalPages, currentStrokeId, currentTool, pageStrokes.get(pdfCurrentPage).size()));

                    // 发送事件
                    sendStrokeCommittedEvent(currentStrokeId);
                    emitHistoryStateChangeFromOverlay();
                } else {
                    Log.e(TAG, String.format("无法保存笔迹 - 页面索引无效: %d, 总页面: %d, 笔迹列表大小: %d",
                        pdfCurrentPage, pdfTotalPages, pageStrokes.size()));
                }

                currentPath = null;
                currentPaint = null;
                currentStrokeId = null;
                lastPdfX = Float.NaN;
                lastPdfY = Float.NaN;
                lastPressure = 1.0f;

                invalidate();
            }
        }

        private void endLassoSelection() {
            if (lassoPath == null) return;

            lassoPath.close();
            Log.d(TAG, "套索选择结束");

            // 查找套索内的笔迹
            List<StrokeData> strokes = pageStrokes.get(pdfCurrentPage);
            List<String> selectedStrokeIds = new ArrayList<>();

            for (StrokeData stroke : strokes) {
                if (isStrokeSelectedByLasso(stroke, lassoPath)) {
                    selectedStrokeIds.add(stroke.id);
                    Log.d(TAG, "选中笔迹: " + stroke.id);
                }
            }

            Log.d(TAG, "选中 " + selectedStrokeIds.size() + " 个笔迹");

            // 高亮显示选中的笔迹
            if (selectedStrokeIds.size() > 0) {
                lassoPaint.setColor(Color.GREEN);
                lassoPaint.setAlpha(51); // 20% alpha

                // 3秒后清除选择
                laserHandler.postDelayed(() -> {
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

        private void updateShapePath(float pdfX, float pdfY) {
            if (currentPath == null) return;

            currentPath.reset();

            if ("line".equals(currentShape)) {
                currentPath.moveTo(shapeStartX, shapeStartY);
                currentPath.lineTo(pdfX, pdfY);
            } else if ("rectangle".equals(currentShape)) {
                currentPath.addRect(
                    Math.min(shapeStartX, pdfX),
                    Math.min(shapeStartY, pdfY),
                    Math.max(shapeStartX, pdfX),
                    Math.max(shapeStartY, pdfY),
                    Path.Direction.CW
                );
            } else if ("circle".equals(currentShape)) {
                float radius = (float) Math.sqrt(
                    Math.pow(pdfX - shapeStartX, 2) + Math.pow(pdfY - shapeStartY, 2)
                );
                currentPath.addCircle(shapeStartX, shapeStartY, radius, Path.Direction.CW);
            } else if ("arrow".equals(currentShape)) {
                // 箭头
                currentPath.moveTo(shapeStartX, shapeStartY);
                currentPath.lineTo(pdfX, pdfY);

                double angle = Math.atan2(pdfY - shapeStartY, pdfX - shapeStartX);
                float arrowLength = 15;
                float arrowAngle = (float) (Math.PI / 6);

                currentPath.moveTo(pdfX, pdfY);
                currentPath.lineTo(
                    (float) (pdfX - arrowLength * Math.cos(angle - arrowAngle)),
                    (float) (pdfY - arrowLength * Math.sin(angle - arrowAngle))
                );
                currentPath.moveTo(pdfX, pdfY);
                currentPath.lineTo(
                    (float) (pdfX - arrowLength * Math.cos(angle + arrowAngle)),
                    (float) (pdfY - arrowLength * Math.sin(angle + arrowAngle))
                );
            } else if ("triangle".equals(currentShape)) {
                // 三角形
                float midX = (shapeStartX + pdfX) / 2;
                currentPath.moveTo(midX, shapeStartY);
                currentPath.lineTo(shapeStartX, pdfY);
                currentPath.lineTo(pdfX, pdfY);
                currentPath.close();
            } else if ("diamond".equals(currentShape)) {
                // 菱形
                float midX = (shapeStartX + pdfX) / 2;
                float midY = (shapeStartY + pdfY) / 2;
                currentPath.moveTo(midX, shapeStartY);
                currentPath.lineTo(pdfX, midY);
                currentPath.lineTo(midX, pdfY);
                currentPath.lineTo(shapeStartX, midY);
                currentPath.close();
            } else if ("star".equals(currentShape)) {
                // 五角星
                float centerX = (shapeStartX + pdfX) / 2;
                float centerY = (shapeStartY + pdfY) / 2;
                float radius = Math.min(Math.abs(pdfX - shapeStartX), Math.abs(pdfY - shapeStartY)) / 2;

                for (int i = 0; i < 5; i++) {
                    double angle = i * 2 * Math.PI / 5 - Math.PI / 2; // 从顶部开始
                    float x = centerX + radius * (float) Math.cos(angle);
                    float y = centerY + radius * (float) Math.sin(angle);

                    if (i == 0) {
                        currentPath.moveTo(x, y);
                    } else {
                        currentPath.lineTo(x, y);
                    }
                }
                currentPath.close();
            } else {
                // 默认直线
                currentPath.moveTo(shapeStartX, shapeStartY);
                currentPath.lineTo(pdfX, pdfY);
            }
        }

        private void endShape() {
            if (currentPath != null && currentPaint != null) {
                // 保存形状
                currentStrokeId = UUID.randomUUID().toString();
                StrokeData stroke = new StrokeData(
                    currentPath,
                    currentPaint,
                    currentStrokeId,
                    "shape"
                );

                pageStrokes.get(pdfCurrentPage).add(stroke);
                Log.d(TAG, String.format("形状已保存 - 类型: %s, ID: %s", currentShape, currentStrokeId));

                sendStrokeCommittedEvent(currentStrokeId);
                emitHistoryStateChangeFromOverlay();

                currentPath = null;
                currentPaint = null;

                invalidate();
            }
        }

        private void endLaser() {
            if (laserPath != null && laserPaint != null) {
                Log.d(TAG, "激光笔结束，开始淡出动画");

                // 创建淡出动画
                final Path fadingPath = new Path(laserPath);
                final Paint fadingPaint = new Paint(laserPaint);

                laserPath = null;
                laserPaint = null;

                // 3秒淡出
                final int fadeDuration = 3000;
                final int fadeSteps = 30;
                final int stepDuration = fadeDuration / fadeSteps;

                for (int i = 0; i < fadeSteps; i++) {
                    final int alpha = 204 * (fadeSteps - i) / fadeSteps;
                    laserHandler.postDelayed(() -> {
                        fadingPaint.setAlpha(alpha);
                        invalidate();
                    }, i * stepDuration);
                }

                // 最后清除
                laserHandler.postDelayed(() -> {
                    invalidate();
                }, fadeDuration);
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

                // ✅ 计算当前页面在整个PDF文档中的偏移量
                // 考虑前面所有页面的高度和页面间距
                float pageOffsetY = 0;
                for (int i = 0; i < pdfCurrentPage; i++) {
                    pageOffsetY += pdfView.getPageSize(i).getHeight() * realTimeZoom;
                    pageOffsetY += 10 * realTimeZoom; // 页面间距 (spacing = 10)
                }

                // ✅ 逆向应用变换（与onDraw中的 translate + scale 对应）
                // 先减去全局偏移量，再减去页面偏移，最后除以缩放
                float pdfX = (screenX - currentXOffset) / realTimeZoom;
                float pdfY = (screenY - currentYOffset - pageOffsetY) / realTimeZoom;

                // 边界检查，确保坐标在页面范围内
                pdfX = Math.max(0, Math.min(pdfX, pageWidth));
                pdfY = Math.max(0, Math.min(pdfY, pageHeight));

                // 调试日志（详细模式）
                if (Math.random() < 0.05) { // 5%概率打印，避免日志过多
                    Log.d(TAG, String.format("坐标转换: 屏幕(%.1f,%.1f) -> PDF(%.1f,%.1f), 页面:%d, 缩放:%.2f, 全局偏移:(%.1f,%.1f), 页面偏移:%.1f",
                        screenX, screenY, pdfX, pdfY, pdfCurrentPage, realTimeZoom, currentXOffset, currentYOffset, pageOffsetY));
                }

                return new float[]{pdfX, pdfY};

            } catch (Exception e) {
                Log.e(TAG, "坐标转换失败，使用简化方法", e);
                // 降级到简化方法
                float fallbackZoom = pdfView.getZoom();
                float fallbackXOffset = pdfView.getCurrentXOffset();
                float fallbackYOffset = pdfView.getCurrentYOffset();

                // 计算页面偏移
                float pageOffsetY = 0;
                try {
                    for (int i = 0; i < pdfCurrentPage; i++) {
                        pageOffsetY += pdfView.getPageSize(i).getHeight() * fallbackZoom;
                        pageOffsetY += 10 * fallbackZoom;
                    }
                } catch (Exception ex) {
                    Log.e(TAG, "计算页面偏移失败", ex);
                }

                float pdfX = (screenX - fallbackXOffset) / fallbackZoom;
                float pdfY = (screenY - fallbackYOffset - pageOffsetY) / fallbackZoom;
                return new float[]{pdfX, pdfY};
            }
        }

        public void setCurrentTool(String tool) {
            Log.d(TAG, "DrawingOverlay: 工具切换到 " + tool);
            // 工具切换时清理之前的状态
            cleanup();
        }

        public void setCurrentColor(int color) {
            Log.d(TAG, "DrawingOverlay: 颜色更新");
        }

        public void setCurrentStrokeWidth(float width) {
            Log.d(TAG, "DrawingOverlay: 线宽更新");
        }

        public void setToolConfig(JSONObject config) {
            Log.d(TAG, "DrawingOverlay: 配置更新 - " + config.toString());
            // 更新形状类型等配置
            try {
                if (config.has("shape")) {
                    currentShape = config.getString("shape");
                }
            } catch (JSONException e) {
                Log.e(TAG, "解析工具配置失败", e);
            }
        }

        // ==================== 撤销/重做/清除功能（在 DrawingOverlay 内实现） ====================
        public void undo() {
            if (pdfCurrentPage >= 0 && pdfCurrentPage < pageStrokes.size()) {
                List<StrokeData> strokes = pageStrokes.get(pdfCurrentPage);
                if (!strokes.isEmpty()) {
                    StrokeData last = strokes.remove(strokes.size() - 1);
                    if (pdfCurrentPage < redoStacks.size()) {
                        redoStacks.get(pdfCurrentPage).add(last);
                    }
                    invalidate();
                    Log.d(TAG, "撤销操作完成，当前页面笔迹数: " + strokes.size());
                } else {
                    Log.d(TAG, "当前页面没有可撤销的笔迹");
                }
            }
        }

        public void redo() {
            if (pdfCurrentPage >= 0 && pdfCurrentPage < pageStrokes.size() && pdfCurrentPage < redoStacks.size()) {
                List<StrokeData> redo = redoStacks.get(pdfCurrentPage);
                if (!redo.isEmpty()) {
                    StrokeData s = redo.remove(redo.size() - 1);
                    pageStrokes.get(pdfCurrentPage).add(s);
                    invalidate();
                    Log.d(TAG, "重做操作完成，当前页面笔迹数: " + pageStrokes.get(pdfCurrentPage).size());
                } else {
                    Log.d(TAG, "当前页面没有可重做的笔迹");
                }
            }
        }

        public void clear(String clearType) {
            if (pdfCurrentPage >= 0 && pdfCurrentPage < pageStrokes.size()) {
                List<StrokeData> strokes = pageStrokes.get(pdfCurrentPage);

                switch (clearType) {
                    case "current_page":
                        strokes.clear();
                        invalidate();
                        Log.d(TAG, "清除当前页面笔迹");
                        break;
                    case "entire_document":
                        for (List<StrokeData> pageStrokesList : pageStrokes) {
                            pageStrokesList.clear();
                        }
                        invalidate();
                        Log.d(TAG, "清除整个文档笔迹");
                        break;
                    case "selected":
                        // 清除选中的笔迹（可在此实现）
                        Log.d(TAG, "清除选中笔迹功能尚未实现");
                        break;
                    default:
                        Log.w(TAG, "未知的清除类型: " + clearType);
                }
            }
        }

        public boolean canUndo() {
            if (pdfCurrentPage < 0 || pdfCurrentPage >= pageStrokes.size()) {
                return false;
            }
            return !pageStrokes.get(pdfCurrentPage).isEmpty();
        }

        public boolean canRedo() {
            if (pdfCurrentPage < 0 || pdfCurrentPage >= redoStacks.size()) {
                return false;
            }
            return !redoStacks.get(pdfCurrentPage).isEmpty();
        }

        public void lassoSelect(String selectionData) {
            Log.d(TAG, "套索选择: " + selectionData);
            // 可在此解析 selectionData 并更新 lassoPath
        }

        public void lassoComplete(String completionData) {
            Log.d(TAG, "套索完成: " + completionData);
            // 可在此处理套索完成逻辑
        }

        public void addImage(String imageUri) {
            Log.d(TAG, "添加图片: " + imageUri);
            try {
                if (pdfCurrentPage < 0 || pdfCurrentPage >= pageStrokes.size()) {
                    Log.w(TAG, "addImage: 页面索引无效");
                    return;
                }
                Bitmap bitmap = null;
                if (imageUri != null && imageUri.startsWith("file://")) {
                    String path = imageUri.substring(7);
                    bitmap = BitmapFactory.decodeFile(path);
                } else {
                    Uri uri = Uri.parse(imageUri);
                    ContentResolver resolver = getContext().getContentResolver();
                    try (InputStream is = resolver.openInputStream(uri)) {
                        if (is != null) {
                            bitmap = BitmapFactory.decodeStream(is);
                        }
                    }
                }
                if (bitmap == null) {
                    Log.e(TAG, "addImage: 加载位图失败");
                    return;
                }
                float pageW = pdfView.getPageSize(pdfCurrentPage).getWidth();
                float pageH = pdfView.getPageSize(pdfCurrentPage).getHeight();
                float targetW = pageW * 0.6f;
                float ratio = (float) bitmap.getHeight() / Math.max(1, bitmap.getWidth());
                float targetH = targetW * ratio;
                float x = (pageW - targetW) / 2f;
                float y = (pageH - targetH) / 2f;
                StrokeData imageStroke = new StrokeData(bitmap, x, y, targetW, targetH, UUID.randomUUID().toString());
                pageStrokes.get(pdfCurrentPage).add(imageStroke);
                if (pdfCurrentPage < redoStacks.size()) {
                    redoStacks.get(pdfCurrentPage).clear();
                }
                invalidate();
                emitHistoryStateChangeFromOverlay();
                Log.d(TAG, "addImage: 已添加图像");
            } catch (Exception e) {
                Log.e(TAG, "addImage 失败", e);
            }
        }

        public void cleanup() {
            currentPath = null;
            currentPaint = null;
        }
    }

    // ==================== ML Kit 文本识别 ====================

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
            // 1. 创建指定区域的位图
            int bitmapWidth = (int) width;
            int bitmapHeight = (int) height;

            if (bitmapWidth <= 0 || bitmapHeight <= 0) {
                promise.reject("E_INVALID_RECT", "无效的区域尺寸");
                return;
            }

            // 2. 创建一个与视图大小相同的位图来绘制完整内容
            Bitmap viewBitmap = Bitmap.createBitmap(getWidth(), getHeight(), Bitmap.Config.ARGB_8888);
            Canvas viewCanvas = new Canvas(viewBitmap);
            draw(viewCanvas); // 绘制整个 NativePDFView (包括 pdfView 和 drawingOverlay)

            // 3. 从完整视图位图中裁剪出所需区域
            int cropX = Math.max(0, (int) x);
            int cropY = Math.max(0, (int) y);

            if (cropX + bitmapWidth > viewBitmap.getWidth()) {
                bitmapWidth = viewBitmap.getWidth() - cropX;
            }
            if (cropY + bitmapHeight > viewBitmap.getHeight()) {
                bitmapHeight = viewBitmap.getHeight() - cropY;
            }

            if (bitmapWidth <= 0 || bitmapHeight <= 0) {
                promise.resolve("");
                viewBitmap.recycle();
                return;
            }

            Bitmap croppedBitmap = Bitmap.createBitmap(viewBitmap, cropX, cropY, bitmapWidth, bitmapHeight);
            viewBitmap.recycle(); // 释放大位图

            // 4. 使用ML Kit识别文本
            InputImage image = InputImage.fromBitmap(croppedBitmap, 0);
            TextRecognizer recognizer = TextRecognition.getClient(new ChineseTextRecognizerOptions.Builder().build());

            recognizer.process(image)
                .addOnSuccessListener(visionText -> {
                    String recognizedText = visionText.getText();
                    Log.d(TAG, "PDF OCR识别成功: " + recognizedText);
                    promise.resolve(recognizedText);
                    croppedBitmap.recycle();
                })
                .addOnFailureListener(e -> {
                    Log.e(TAG, "PDF OCR识别失败", e);
                    promise.reject("E_OCR_FAILED", "文本识别失败: " + e.getMessage());
                    croppedBitmap.recycle();
                });

        } catch (Exception e) {
            Log.e(TAG, "PDF OCR处理异常", e);
            promise.reject("E_OCR_ERROR", "OCR处理异常: " + e.getMessage());
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
        // 图像支持
        Bitmap bitmap;
        float imageX;
        float imageY;
        float imageW;
        float imageH;

        StrokeData(Path path, Paint paint, String id, String toolType) {
            this.path = new Path(path);
            this.paint = new Paint(paint);
            this.id = id;
            this.toolType = toolType;
        }

        StrokeData(Bitmap bitmap, float x, float y, float w, float h, String id) {
            this.bitmap = bitmap;
            this.imageX = x;
            this.imageY = y;
            this.imageW = w;
            this.imageH = h;
            this.id = id;
            this.toolType = "image";
            // 为了统一接口，提供一个透明画笔
            this.paint = new Paint(Paint.ANTI_ALIAS_FLAG);
        }
    }
}
