package com.zeroisle_notes.nativepdf;

import android.graphics.Color;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.common.MapBuilder;
import com.facebook.react.uimanager.SimpleViewManager;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.annotations.ReactProp;
import com.facebook.react.uimanager.annotations.ReactPropGroup;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.uimanager.UIManagerModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.WritableNativeMap;
import android.graphics.Bitmap;
import android.view.View;
import android.os.Handler;
import android.os.Looper;
import android.graphics.Rect;
import android.graphics.Canvas;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.chinese.ChineseTextRecognizerOptions;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 原生 PDF 视图管理器
 * 负责桥接 RN 与原生 PDF 视图
 */
public class NativePDFViewManager extends SimpleViewManager<NativePDFView> {

    public static final String REACT_CLASS = "NativePDFView";

    @NonNull
    @Override
    public String getName() {
        return REACT_CLASS;
    }



    @NonNull
    @Override
    protected NativePDFView createViewInstance(@NonNull ThemedReactContext reactContext) {
        android.util.Log.d("NativePDFViewManager", "创建 NativePDFView 实例");
        return new NativePDFView(reactContext);
    }

    // MARK: - Props

    @ReactProp(name = "source")
    public void setSource(NativePDFView view, @Nullable ReadableMap source) {
        android.util.Log.d("NativePDFViewManager", "setSource 被调用");
        if (source != null) {
            android.util.Log.d("NativePDFViewManager", "source keys: " + source.toHashMap().keySet());
            if (source.hasKey("path")) {
                String path = source.getString("path");
                android.util.Log.d("NativePDFViewManager", "从path加载PDF: " + path);
                view.setPendingPath(path);
            } else if (source.hasKey("uri")) {
                String uri = source.getString("uri");
                android.util.Log.d("NativePDFViewManager", "从uri加载PDF: " + uri);
                if (uri.startsWith("file://")) {
                    view.setPendingPath(uri.substring(7));
                } else {
                    view.loadPDFFromURI(uri);
                }
            } else {
                android.util.Log.w("NativePDFViewManager", "source对象没有path或uri键");
            }
        } else {
            android.util.Log.w("NativePDFViewManager", "source为null");
        }
    }

    @ReactProp(name = "initialPage", defaultInt = 0)
    public void setInitialPage(NativePDFView view, int page) {
        view.setCurrentPage(page);
    }

    @ReactProp(name = "currentTool")
    public void setCurrentTool(NativePDFView view, String tool) {
        android.util.Log.d("NativePDFViewManager", "设置当前工具: " + tool);
        view.setDrawingTool(tool);
    }

    @ReactProp(name = "currentColor")
    public void setCurrentColor(NativePDFView view, String color) {
        android.util.Log.d("NativePDFViewManager", "设置当前颜色: " + color);
        view.setDrawingColor(color);
    }

    @ReactProp(name = "currentStrokeWidth")
    public void setCurrentStrokeWidth(NativePDFView view, float width) {
        android.util.Log.d("NativePDFViewManager", "设置当前笔触粗细: " + width);
        view.setDrawingWidth(width);
    }

    // MARK: - Commands

    @Nullable
    @Override
    public Map<String, Integer> getCommandsMap() {
        return MapBuilder.<String, Integer>builder()
            .put("goToPage", 1)
            .put("setDrawingTool", 2)
            .put("setDrawingColor", 3)
            .put("setDrawingWidth", 4)
            .put("recognizeHandwriting", 5)
            .put("addTextAnnotation", 6)
            .put("exportPDF", 7)
            .put("importAnnotations", 8)  // ✅ 添加导入注释命令
            .put("undo", 9)              // 新增
            .put("redo", 10)             // 新增
            .put("setZoom", 11)
            .put("setToolConfig", 12)    // 从10改为12
            .put("clear", 13)            // 新增
            .put("lassoSelect", 14)      // 从11改为14
            .put("lassoComplete", 15)    // 从12改为15
            .put("addImage", 16)         // 新增图片上传
            .build();
    }

    @Override
    public void receiveCommand(@NonNull NativePDFView root, int commandId, @Nullable ReadableArray args) {
        android.util.Log.d("NativePDFViewManager", "收到命令: " + commandId + ", 参数数量: " + (args != null ? args.size() : 0));
        switch (commandId) {
            case 1: // goToPage
                if (args != null && args.size() > 0) {
                    root.setCurrentPage(args.getInt(0));
                }
                break;
            case 2: // setDrawingTool
                if (args != null && args.size() > 0) {
                    root.setDrawingTool(args.getString(0));
                }
                break;
            case 3: // setDrawingColor
                if (args != null && args.size() > 0) {
                    root.setDrawingColor(args.getString(0));
                }
                break;
            case 4: // setDrawingWidth
                if (args != null && args.size() > 0) {
                    root.setDrawingWidth((float) args.getDouble(0));
                }
                break;
            case 5: // recognizeHandwriting
                if (args != null && args.size() > 0) {
                    root.recognizeHandwriting(args.getString(0));
                }
                break;
            case 6: // addTextAnnotation
                if (args != null && args.size() > 0) {
                    root.addTextAnnotation(args.getString(0));
                }
                break;
            case 7: // exportPDF
                if (args != null && args.size() > 0) {
                    root.exportPDF(args.getString(0));
                }
                break;
            case 8: // importAnnotations
                android.util.Log.d("NativePDFViewManager", "收到importAnnotations命令，参数数量: " + (args != null ? args.size() : 0));
                if (args != null && args.size() > 0) {
                    String annotationsJson = args.getString(0);
                    android.util.Log.d("NativePDFViewManager", "注释数据长度: " + (annotationsJson != null ? annotationsJson.length() : 0));
                    root.importAnnotations(annotationsJson);
                } else {
                    android.util.Log.e("NativePDFViewManager", "importAnnotations命令缺少参数！");
                }
                break;
            case 9: // undo
                root.undo();
                break;
            case 10: // redo
                root.redo();
                break;
            case 11: // setZoom
                if (args != null && args.size() > 0) {
                    root.setZoom((float) args.getDouble(0));
                }
                break;
            case 12: // setToolConfig
                if (args != null && args.size() > 0) {
                    root.setToolConfig(args.getString(0));
                }
                break;
            case 13: // clear
                if (args != null && args.size() > 0) {
                    root.clear(args.getString(0));
                }
                break;
            case 14: // lassoSelect
                if (args != null && args.size() > 0) {
                    root.lassoSelect(args.getString(0));
                }
                break;
            case 15: // lassoComplete
                if (args != null && args.size() > 0) {
                    root.lassoComplete(args.getString(0));
                }
                break;
            case 16: // addImage
                if (args != null && args.size() > 0) {
                    root.addImage(args.getString(0));
                }
                break;
        }
    }

    // MARK: - Events

    @Nullable
    @Override
    public Map<String, Object> getExportedCustomDirectEventTypeConstants() {
        return MapBuilder.<String, Object>builder()
            .put("onReady", MapBuilder.of("registrationName", "onReady"))
            .put("onError", MapBuilder.of("registrationName", "onError"))
            .put("onPageChange", MapBuilder.of("registrationName", "onPageChange"))
            .put("onZoomChange", MapBuilder.of("registrationName", "onZoomChange"))
            .put("onStrokeCommitted", MapBuilder.of("registrationName", "onStrokeCommitted"))
            .put("onHistoryStateChange", MapBuilder.of("registrationName", "onHistoryStateChange"))
            .put("onHandwritingRecognized", MapBuilder.of("registrationName", "onHandwritingRecognized"))
            .put("onExportComplete", MapBuilder.of("registrationName", "onExportComplete"))
            .put("onMetrics", MapBuilder.of("registrationName", "onMetrics"))
            .build();
    }

    // Promise API: 识别选区文本（ML Kit 本地 OCR）
    @ReactMethod
    public void recognizeTextInRegion(final int viewTag, double x, double y, double width, double height, final Promise promise) {
        try {
            final ReactApplicationContext reactContext = this.getReactApplicationContext();
            if (reactContext == null) {
                promise.reject("E_NO_CONTEXT", "React context is null");
                return;
            }

            new Handler(Looper.getMainLooper()).post(new Runnable() {
                @Override
                public void run() {
                    try {
                        View view = reactContext.getCurrentActivity().findViewById(viewTag);
                        if (view instanceof NativePDFView) {
                            ((NativePDFView) view).recognizeTextInRect((float)x, (float)y, (float)width, (float)height, promise);
                        } else {
                            promise.reject("E_VIEW_NOT_FOUND", "View not found or is not a NativePDFView");
                        }
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

