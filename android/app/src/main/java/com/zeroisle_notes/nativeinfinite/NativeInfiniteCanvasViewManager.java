package com.zeroisle_notes.nativeinfinite;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.common.MapBuilder;
import com.facebook.react.uimanager.SimpleViewManager;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.annotations.ReactProp;

import java.util.Map;

public class NativeInfiniteCanvasViewManager extends SimpleViewManager<NativeInfiniteCanvasView> {
    
    public static final String REACT_CLASS = "NativeInfiniteCanvasView";
    
    @Override
    public String getName() {
        return REACT_CLASS;
    }
    
    @Override
    protected NativeInfiniteCanvasView createViewInstance(ThemedReactContext reactContext) {
        return new NativeInfiniteCanvasView(reactContext);
    }
    
    @ReactProp(name = "canvasId")
    public void setCanvasId(NativeInfiniteCanvasView view, String canvasId) {
        view.setCanvasId(canvasId);
    }
    
    @ReactProp(name = "viewport")
    public void setViewport(NativeInfiniteCanvasView view, ReadableMap viewport) {
        view.setViewport(viewport);
    }
    
    @ReactProp(name = "styleConfig")
    public void setStyleConfig(NativeInfiniteCanvasView view, ReadableMap config) {
        view.setStyleConfig(config);
    }
    
    // MARK: - Commands
    
    @Nullable
    @Override
    public Map<String, Integer> getCommandsMap() {
        return MapBuilder.<String, Integer>builder()
            .put("recognizeHandwriting", 1)
            .put("addTextElement", 2)
            .put("exportCanvas", 3)
            .put("undo", 4)
            .put("redo", 5)
            .put("clear", 6)
            .put("setCurrentTool", 7)
            .put("setCurrentColor", 8)
            .put("setCurrentStrokeWidth", 9)
            .put("setToolConfig", 10)
            .build();
    }
    
    @Override
    public void receiveCommand(@NonNull NativeInfiniteCanvasView root, int commandId, @Nullable ReadableArray args) {
        switch (commandId) {
            case 1: // recognizeHandwriting
                if (args != null && args.size() > 0) {
                    root.recognizeHandwriting(args.getString(0));
                }
                break;
            case 2: // addTextElement
                if (args != null && args.size() > 0) {
                    root.addTextElement(args.getString(0));
                }
                break;
            case 3: // exportCanvas
                if (args != null && args.size() > 0) {
                    root.exportCanvas(args.getString(0));
                }
                break;
            case 4: // undo
                root.undo();
                break;
            case 5: // redo
                root.redo();
                break;
            case 6: // clear
                root.clear();
                break;
            case 7: // setCurrentTool
                if (args != null && args.size() > 0) {
                    root.setCurrentTool(args.getString(0));
                }
                break;
            case 8: // setCurrentColor
                if (args != null && args.size() > 0) {
                    root.setCurrentColor(args.getString(0));
                }
                break;
            case 9: // setCurrentStrokeWidth
                if (args != null && args.size() > 0) {
                    root.setCurrentStrokeWidth((float) args.getDouble(0));
                }
                break;
            case 10: // setToolConfig
                if (args != null && args.size() > 0) {
                    root.setToolConfig(args.getString(0));
                }
                break;
        }
    }
    
    @Override
    public Map<String, Object> getExportedCustomDirectEventTypeConstants() {
        return MapBuilder.<String, Object>builder()
            .put("onReady", MapBuilder.of("registrationName", "onReady"))
            .put("onError", MapBuilder.of("registrationName", "onError"))
            .put("onViewportChange", MapBuilder.of("registrationName", "onViewportChange"))
            .put("onStrokeCommitted", MapBuilder.of("registrationName", "onStrokeCommitted"))
            .put("onHandwritingRecognized", MapBuilder.of("registrationName", "onHandwritingRecognized"))
            .put("onExportComplete", MapBuilder.of("registrationName", "onExportComplete"))
            .put("onMetrics", MapBuilder.of("registrationName", "onMetrics"))
            .build();
    }
}



