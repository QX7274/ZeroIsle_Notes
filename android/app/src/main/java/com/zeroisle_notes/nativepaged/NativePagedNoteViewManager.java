package com.zeroisle_notes.nativepaged;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.common.MapBuilder;
import com.facebook.react.uimanager.SimpleViewManager;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.annotations.ReactProp;

import java.util.Map;

public class NativePagedNoteViewManager extends SimpleViewManager<NativePagedNoteView> {
    
    public static final String REACT_CLASS = "NativePagedNoteView";
    
    @Override
    public String getName() {
        return REACT_CLASS;
    }
    
    @Override
    protected NativePagedNoteView createViewInstance(ThemedReactContext reactContext) {
        return new NativePagedNoteView(reactContext);
    }
    
    @ReactProp(name = "noteId")
    public void setNoteId(NativePagedNoteView view, String noteId) {
        view.setNoteId(noteId);
    }
    
    @ReactProp(name = "styleConfig")
    public void setStyleConfig(NativePagedNoteView view, ReadableMap config) {
        view.setStyleConfig(config);
    }
    
    @ReactProp(name = "currentTool")
    public void setCurrentTool(NativePagedNoteView view, String tool) {
        view.setCurrentTool(tool);
    }
    
    @ReactProp(name = "currentColor")
    public void setCurrentColor(NativePagedNoteView view, String color) {
        view.setCurrentColor(color);
    }
    
    @ReactProp(name = "currentStrokeWidth")
    public void setCurrentStrokeWidth(NativePagedNoteView view, float width) {
        view.setCurrentStrokeWidth(width);
    }
    
    // MARK: - Commands
    
    @Nullable
    @Override
    public Map<String, Integer> getCommandsMap() {
        return MapBuilder.<String, Integer>builder()
            .put("recognizeHandwriting", 1)
            .put("insertText", 2)
            .put("exportNote", 3)
            .put("undo", 4)
            .put("redo", 5)
            .put("clear", 6)
            .put("setCurrentPage", 7)
            .put("setCurrentTool", 8)
            .put("setCurrentColor", 9)
            .put("setCurrentStrokeWidth", 10)
            .put("addNewPage", 11)
            .put("importNote", 12) // 导入笔记数据
            .put("setToolConfig", 15)
            .build();
    }
    
    @Override
    public void receiveCommand(@NonNull NativePagedNoteView root, int commandId, @Nullable ReadableArray args) {
        switch (commandId) {
            case 1: // recognizeHandwriting
                if (args != null && args.size() > 0) {
                    root.recognizeHandwriting(args.getString(0));
                }
                break;
            case 2: // insertText
                if (args != null && args.size() > 0) {
                    root.insertText(args.getString(0));
                }
                break;
            case 3: // exportNote
                if (args != null && args.size() > 0) {
                    root.exportNote(args.getString(0));
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
            case 7: // setCurrentPage
                if (args != null && args.size() > 0) {
                    root.setCurrentPage(args.getInt(0));
                }
                break;
            case 8: // setCurrentTool
                if (args != null && args.size() > 0) {
                    root.setCurrentTool(args.getString(0));
                }
                break;
            case 9: // setCurrentColor
                if (args != null && args.size() > 0) {
                    root.setCurrentColor(args.getString(0));
                }
                break;
            case 10: // setCurrentStrokeWidth
                if (args != null && args.size() > 0) {
                    root.setCurrentStrokeWidth((float) args.getDouble(0));
                }
                break;
            case 11: // addNewPage
                root.addNewPage();
                break;
            case 12: // importNote
                if (args != null && args.size() > 0) {
                    root.importNote(args.getString(0));
                }
                break;
            case 15: // setToolConfig
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
            .put("onStrokeCommitted", MapBuilder.of("registrationName", "onStrokeCommitted"))
            .put("onPageChange", MapBuilder.of("registrationName", "onPageChange"))
            .put("onPageAdded", MapBuilder.of("registrationName", "onPageAdded"))
            .put("onZoomChange", MapBuilder.of("registrationName", "onZoomChange"))
            .put("onHandwritingRecognized", MapBuilder.of("registrationName", "onHandwritingRecognized"))
            .put("onExportComplete", MapBuilder.of("registrationName", "onExportComplete"))
            .put("onMetrics", MapBuilder.of("registrationName", "onMetrics"))
            .build();
    }
}



