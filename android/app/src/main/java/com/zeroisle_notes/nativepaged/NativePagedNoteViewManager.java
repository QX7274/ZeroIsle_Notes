package com.zeroisle_notes.nativepaged;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;

import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.common.MapBuilder;
import com.facebook.react.uimanager.SimpleViewManager;
import com.facebook.react.uimanager.ThemedReactContext;
import com.facebook.react.uimanager.annotations.ReactProp;
import com.facebook.react.bridge.ReactApplicationContext;
import android.graphics.Bitmap;
import android.graphics.Canvas;
import android.graphics.Rect;
import android.os.Handler;
import android.os.Looper;
import android.view.View;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.chinese.ChineseTextRecognizerOptions;

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
            .put("addImage", 18)    // 新增图片上传
            .build();
    }

    @Override
    public void receiveCommand(@NonNull NativePagedNoteView root, int commandId, @Nullable ReadableArray args) {
        switch (commandId) {
            case 1: // recognizeHandwriting
                if (args != null && args.size() > 0) {
                    String strokeId = args.getString(0);
                    root.recognizeHandwriting(strokeId);
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
            case 18: // addImage
                if (args != null && args.size() > 0) {
                    root.addImage(args.getString(0));
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

    // Promise API: 识别选区文本（ML Kit 本地 OCR）
    @ReactMethod
    public void recognizeTextInRegion(final int viewTag, double x, double y, double width, double height, final Promise promise) {
        try {
            final ReactApplicationContext reactContext = this.getReactApplicationContext();
            if (reactContext == null) {
                promise.reject("E_NO_CONTEXT", "React context is null");
                return;
            }

            final Rect region = new Rect((int)x, (int)y, (int)(x + width), (int)(y + height));

            new Handler(Looper.getMainLooper()).post(new Runnable() {
                @Override
                public void run() {
                    try {
                        View view = reactContext.getCurrentActivity().findViewById(viewTag);
                        if (view == null) {
                            promise.reject("E_VIEW_NOT_FOUND", "View not found");
                            return;
                        }

                        // 渲染视图为位图
                        Bitmap fullBitmap = Bitmap.createBitmap(view.getWidth(), view.getHeight(), Bitmap.Config.ARGB_8888);
                        Canvas canvas = new Canvas(fullBitmap);
                        view.draw(canvas);

                        // 裁剪选区
                        int cropX = Math.max(0, region.left);
                        int cropY = Math.max(0, region.top);
                        int cropW = Math.min(region.width(), fullBitmap.getWidth() - cropX);
                        int cropH = Math.min(region.height(), fullBitmap.getHeight() - cropY);

                        if (cropW <= 0 || cropH <= 0) {
                            promise.resolve("");
                            return;
                        }

                        Bitmap croppedBitmap = Bitmap.createBitmap(fullBitmap, cropX, cropY, cropW, cropH);
                        fullBitmap.recycle();

                        // 使用 ML Kit 中文识别
                        TextRecognizer recognizer = TextRecognition.getClient(new ChineseTextRecognizerOptions.Builder().build());
                        InputImage image = InputImage.fromBitmap(croppedBitmap, 0);

                        recognizer.process(image)
                            .addOnSuccessListener(visionText -> {
                                String text = visionText.getText();
                                promise.resolve(text != null ? text : "");
                                croppedBitmap.recycle();
                            })
                            .addOnFailureListener(e -> {
                                promise.reject("E_OCR_FAILED", e.getMessage(), e);
                                croppedBitmap.recycle();
                            });

                    } catch (Exception e) {
                        promise.reject("E_OCR_FAILED", e.getMessage(), e);
                    }
                }
            });
        } catch (Exception e) {
            promise.reject("E_OCR_FAILED", e.getMessage(), e);
        }
    }

    @ReactMethod
    public void recognizeHandwriting(final int viewTag, final int count, final Promise promise) {
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
                        if (view instanceof NativePagedNoteView) {
                            ((NativePagedNoteView) view).recognizeHandwriting(count, promise);
                        } else {
                            promise.reject("E_VIEW_NOT_FOUND", "View not found or is not a NativePagedNoteView");
                        }
                    } catch (Exception e) {
                        promise.reject("E_HANDWRITING_FAILED", e.getMessage(), e);
                    }
                }
            });
        } catch (Exception e) {
            promise.reject("E_HANDWRITING_FAILED", e.getMessage(), e);
        }
    }
}



