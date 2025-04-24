package com.zeroisle_notes;

import android.content.Context;
import android.content.Intent;
import android.net.Uri;
import android.os.Environment;
import android.util.Log;
import androidx.core.content.FileProvider;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;

import java.io.File;
import java.io.FileOutputStream;
import java.io.IOException;
import java.util.HashMap;
import java.util.Map;

/**
 * 零屿笔记工具模块
 * 提供文件操作、分享等原生功能
 */
public class ZeroIsleUtilsModule extends ReactContextBaseJavaModule {
    private static final String TAG = "ZeroIsleUtilsModule";
    private final ReactApplicationContext reactContext;

    public ZeroIsleUtilsModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @Override
    public String getName() {
        return "ZeroIsleUtils";
    }

    @Override
    public Map<String, Object> getConstants() {
        final Map<String, Object> constants = new HashMap<>();
        constants.put("DOCUMENT_DIRECTORY", getDocumentDirectory());
        return constants;
    }

    /**
     * 获取文档目录
     */
    private String getDocumentDirectory() {
        File dir = reactContext.getExternalFilesDir(Environment.DIRECTORY_DOCUMENTS);
        if (dir != null) {
            return dir.getAbsolutePath();
        }
        return reactContext.getFilesDir().getAbsolutePath();
    }

    /**
     * 分享文件
     * @param filePath 文件路径
     * @param mimeType 文件类型
     * @param title 分享标题
     * @param promise Promise对象
     */
    @ReactMethod
    public void shareFile(String filePath, String mimeType, String title, Promise promise) {
        try {
            File file = new File(filePath);
            if (!file.exists()) {
                promise.reject("FILE_NOT_FOUND", "File does not exist: " + filePath);
                return;
            }

            Uri contentUri = FileProvider.getUriForFile(
                reactContext,
                reactContext.getPackageName() + ".fileprovider",
                file
            );

            Intent intent = new Intent(Intent.ACTION_SEND);
            intent.setType(mimeType);
            intent.putExtra(Intent.EXTRA_STREAM, contentUri);
            intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);

            Intent chooser = Intent.createChooser(intent, title);
            chooser.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);

            reactContext.startActivity(chooser);
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "Error sharing file", e);
            promise.reject("SHARE_ERROR", e.getMessage(), e);
        }
    }

    /**
     * 保存文本到文件
     * @param text 文本内容
     * @param filePath 文件路径
     * @param promise Promise对象
     */
    @ReactMethod
    public void saveTextToFile(String text, String filePath, Promise promise) {
        try {
            File file = new File(filePath);
            File parentDir = file.getParentFile();
            if (parentDir != null && !parentDir.exists()) {
                parentDir.mkdirs();
            }

            FileOutputStream fos = new FileOutputStream(file);
            fos.write(text.getBytes());
            fos.close();

            promise.resolve(filePath);
        } catch (IOException e) {
            Log.e(TAG, "Error saving text to file", e);
            promise.reject("SAVE_ERROR", e.getMessage(), e);
        }
    }

    /**
     * 检查文件是否存在
     * @param filePath 文件路径
     * @param promise Promise对象
     */
    @ReactMethod
    public void fileExists(String filePath, Promise promise) {
        try {
            File file = new File(filePath);
            promise.resolve(file.exists());
        } catch (Exception e) {
            Log.e(TAG, "Error checking file existence", e);
            promise.reject("FILE_CHECK_ERROR", e.getMessage(), e);
        }
    }

    /**
     * 获取文件信息
     * @param filePath 文件路径
     * @param promise Promise对象
     */
    @ReactMethod
    public void getFileInfo(String filePath, Promise promise) {
        try {
            File file = new File(filePath);
            if (!file.exists()) {
                promise.reject("FILE_NOT_FOUND", "File does not exist: " + filePath);
                return;
            }

            Map<String, Object> fileInfo = new HashMap<>();
            fileInfo.put("path", file.getAbsolutePath());
            fileInfo.put("size", file.length());
            fileInfo.put("lastModified", file.lastModified());
            fileInfo.put("name", file.getName());
            fileInfo.put("isDirectory", file.isDirectory());

            promise.resolve(fileInfo);
        } catch (Exception e) {
            Log.e(TAG, "Error getting file info", e);
            promise.reject("FILE_INFO_ERROR", e.getMessage(), e);
        }
    }
}
