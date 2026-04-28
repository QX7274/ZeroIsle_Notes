package com.zeroisle_notes.nativeinfinite;

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

    @ReactProp(name = "currentTool")
    public void setCurrentTool(NativeInfiniteCanvasView view, String tool) {
        android.util.Log.d("NativeInfiniteCanvasViewManager", "设置当前工具: " + tool);
        view.setCurrentTool(tool);
    }

    @ReactProp(name = "currentColor")
    public void setCurrentColor(NativeInfiniteCanvasView view, String color) {
        android.util.Log.d("NativeInfiniteCanvasViewManager", "设置当前颜色: " + color);
        view.setCurrentColor(color);
    }

    @ReactProp(name = "currentStrokeWidth")
    public void setCurrentStrokeWidth(NativeInfiniteCanvasView view, float width) {
        android.util.Log.d("NativeInfiniteCanvasViewManager", "设置当前笔触粗细: " + width);
        view.setCurrentStrokeWidth(width);
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
            .put("importCanvas", 11) // ✅ 添加导入画布命令
            .put("setCurrentTool", 7)
            .put("setCurrentColor", 8)
            .put("setCurrentStrokeWidth", 9)
            .put("setToolConfig", 10)
            .put("addImage", 15)    // 新增图片上传
            .build();
    }

    @Override
    public void receiveCommand(@NonNull NativeInfiniteCanvasView root, int commandId, @Nullable ReadableArray args) {
        switch (commandId) {
            case 1: // recognizeHandwriting
                if (args != null && args.size() > 0) {
                    int count = args.getInt(0);
                    // Promise-based method is preferred
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
            case 11: // importCanvas
                if (args != null && args.size() > 0) {
                    root.importCanvas(args.getString(0));
                }
                break;
            case 15: // addImage
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
            .put("onViewportChange", MapBuilder.of("registrationName", "onViewportChange"))
            .put("onStrokeCommitted", MapBuilder.of("registrationName", "onStrokeCommitted"))
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
                        if (view instanceof NativeInfiniteCanvasView) {
                            ((NativeInfiniteCanvasView) view).recognizeHandwriting(count, promise);
                        } else {
                            promise.reject("E_VIEW_NOT_FOUND", "View not found or is not a NativeInfiniteCanvasView");
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



