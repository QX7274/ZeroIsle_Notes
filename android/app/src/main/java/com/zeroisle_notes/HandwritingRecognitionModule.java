package com.zeroisle_notes;

import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.util.Base64;
import android.util.Log;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

/**
 * 手写识别模块
 * 提供手写识别功能，支持识别手写文字和图形
 */
public class HandwritingRecognitionModule extends ReactContextBaseJavaModule {
    private static final String TAG = "HandwritingRecognition";
    private final ReactApplicationContext reactContext;

    public HandwritingRecognitionModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @Override
    public String getName() {
        return "ZeroIsleHandwritingRecognition";
    }

    @Override
    public Map<String, Object> getConstants() {
        final Map<String, Object> constants = new HashMap<>();
        constants.put("RECOGNITION_LANGUAGES", new String[]{"zh-CN", "en-US"});
        return constants;
    }

    /**
     * 识别手写文字
     * @param imageBase64 图像的Base64编码
     * @param options 识别选项
     * @param promise Promise对象
     */
    @ReactMethod
    public void recognizeText(String imageBase64, ReadableMap options, Promise promise) {
        try {
            // 解码Base64图像
            byte[] decodedString = Base64.decode(imageBase64, Base64.DEFAULT);
            Bitmap bitmap = BitmapFactory.decodeByteArray(decodedString, 0, decodedString.length);
            
            if (bitmap == null) {
                promise.reject("INVALID_IMAGE", "Failed to decode image");
                return;
            }
            
            // 获取识别选项
            String language = options.hasKey("language") ? options.getString("language") : "zh-CN";
            boolean detectLines = options.hasKey("detectLines") && options.getBoolean("detectLines");
            
            // 这里应该集成实际的手写识别库，如百度OCR、讯飞OCR等
            // 由于实际集成需要API密钥和更复杂的实现，这里仅作示例
            
            // 模拟识别结果
            WritableMap result = Arguments.createMap();
            result.putString("text", "这是识别出的文字示例");
            result.putDouble("confidence", 0.95);
            
            promise.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "Error recognizing handwriting", e);
            promise.reject("RECOGNITION_ERROR", e.getMessage(), e);
        }
    }
    
    /**
     * 保存手写图像
     * @param imageBase64 图像的Base64编码
     * @param filePath 保存路径
     * @param promise Promise对象
     */
    @ReactMethod
    public void saveHandwritingImage(String imageBase64, String filePath, Promise promise) {
        try {
            // 解码Base64图像
            byte[] decodedString = Base64.decode(imageBase64, Base64.DEFAULT);
            Bitmap bitmap = BitmapFactory.decodeByteArray(decodedString, 0, decodedString.length);
            
            if (bitmap == null) {
                promise.reject("INVALID_IMAGE", "Failed to decode image");
                return;
            }
            
            // 创建目录
            File file = new File(filePath);
            File parentDir = file.getParentFile();
            if (parentDir != null && !parentDir.exists()) {
                parentDir.mkdirs();
            }
            
            // 保存图像
            FileOutputStream fos = new FileOutputStream(file);
            bitmap.compress(Bitmap.CompressFormat.PNG, 100, fos);
            fos.flush();
            fos.close();
            
            promise.resolve(filePath);
        } catch (Exception e) {
            Log.e(TAG, "Error saving handwriting image", e);
            promise.reject("SAVE_ERROR", e.getMessage(), e);
        }
    }
    
    /**
     * 识别手写图形
     * @param imageBase64 图像的Base64编码
     * @param options 识别选项
     * @param promise Promise对象
     */
    @ReactMethod
    public void recognizeShape(String imageBase64, ReadableMap options, Promise promise) {
        try {
            // 解码Base64图像
            byte[] decodedString = Base64.decode(imageBase64, Base64.DEFAULT);
            Bitmap bitmap = BitmapFactory.decodeByteArray(decodedString, 0, decodedString.length);
            
            if (bitmap == null) {
                promise.reject("INVALID_IMAGE", "Failed to decode image");
                return;
            }
            
            // 这里应该集成实际的图形识别库
            // 由于实际集成需要更复杂的实现，这里仅作示例
            
            // 模拟识别结果
            WritableMap result = Arguments.createMap();
            result.putString("shape", "rectangle");
            result.putDouble("confidence", 0.92);
            
            promise.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "Error recognizing shape", e);
            promise.reject("RECOGNITION_ERROR", e.getMessage(), e);
        }
    }
    
    /**
     * 清理临时文件
     * @param promise Promise对象
     */
    @ReactMethod
    public void cleanupTempFiles(Promise promise) {
        try {
            File cacheDir = reactContext.getCacheDir();
            File[] files = cacheDir.listFiles();
            
            if (files != null) {
                for (File file : files) {
                    if (file.getName().startsWith("handwriting_")) {
                        file.delete();
                    }
                }
            }
            
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "Error cleaning up temp files", e);
            promise.reject("CLEANUP_ERROR", e.getMessage(), e);
        }
    }
}
