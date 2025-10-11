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
            .put("setToolConfig", 10)
            .put("setZoom", 11)
            .build();
    }
    
    @Override
    public void receiveCommand(@NonNull NativePDFView root, int commandId, @Nullable ReadableArray args) {
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
            case 10: // setToolConfig
                if (args != null && args.size() > 0) {
                    root.setToolConfig(args.getString(0));
                }
                break;
            case 11: // setZoom
                if (args != null && args.size() > 0) {
                    root.setZoom((float) args.getDouble(0));
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
            .put("onHandwritingRecognized", MapBuilder.of("registrationName", "onHandwritingRecognized"))
            .put("onExportComplete", MapBuilder.of("registrationName", "onExportComplete"))
            .put("onMetrics", MapBuilder.of("registrationName", "onMetrics"))
            .build();
    }
    
}

