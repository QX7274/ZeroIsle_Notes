package com.zeroisle_notes;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Log;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableArray;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.bridge.WritableMap;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.HashMap;
import java.util.Map;

/**
 * 文件系统模块
 * 提供文件操作功能，包括读写、复制、移动、删除等
 */
public class FileSystemModule extends ReactContextBaseJavaModule {
    private static final String TAG = "FileSystemModule";
    private final ReactApplicationContext reactContext;

    public FileSystemModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @Override
    public String getName() {
        return "ZeroIsleFileSystem";
    }

    @Override
    public Map<String, Object> getConstants() {
        final Map<String, Object> constants = new HashMap<>();
        constants.put("DocumentDirectory", getDocumentDirectory());
        constants.put("CacheDirectory", getCacheDirectory());
        constants.put("ExternalDirectory", getExternalDirectory());
        constants.put("DownloadDirectory", getDownloadDirectory());
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
     * 获取缓存目录
     */
    private String getCacheDirectory() {
        return reactContext.getCacheDir().getAbsolutePath();
    }

    /**
     * 获取外部存储目录
     */
    private String getExternalDirectory() {
        File dir = reactContext.getExternalFilesDir(null);
        if (dir != null) {
            return dir.getAbsolutePath();
        }
        return reactContext.getFilesDir().getAbsolutePath();
    }

    /**
     * 获取下载目录
     */
    private String getDownloadDirectory() {
        File dir = reactContext.getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS);
        if (dir != null) {
            return dir.getAbsolutePath();
        }
        return reactContext.getFilesDir().getAbsolutePath();
    }

    /**
     * 读取文件内容
     * @param filePath 文件路径
     * @param encoding 编码方式
     * @param promise Promise对象
     */
    @ReactMethod
    public void readFile(String filePath, String encoding, Promise promise) {
        try {
            File file = new File(filePath);
            if (!file.exists()) {
                promise.reject("FILE_NOT_FOUND", "File does not exist: " + filePath);
                return;
            }

            FileInputStream fis = new FileInputStream(file);
            byte[] data = new byte[(int) file.length()];
            fis.read(data);
            fis.close();

            if (encoding.equalsIgnoreCase("base64")) {
                String base64 = android.util.Base64.encodeToString(data, android.util.Base64.DEFAULT);
                promise.resolve(base64);
            } else {
                // 默认使用UTF-8编码
                promise.resolve(new String(data, "UTF-8"));
            }
        } catch (Exception e) {
            Log.e(TAG, "Error reading file", e);
            promise.reject("READ_ERROR", e.getMessage(), e);
        }
    }

    /**
     * 写入文件内容
     * @param filePath 文件路径
     * @param content 文件内容
     * @param encoding 编码方式
     * @param promise Promise对象
     */
    @ReactMethod
    public void writeFile(String filePath, String content, String encoding, Promise promise) {
        try {
            File file = new File(filePath);
            File parentDir = file.getParentFile();
            if (parentDir != null && !parentDir.exists()) {
                parentDir.mkdirs();
            }

            FileOutputStream fos = new FileOutputStream(file);

            if (encoding.equalsIgnoreCase("base64")) {
                byte[] data = android.util.Base64.decode(content, android.util.Base64.DEFAULT);
                fos.write(data);
            } else {
                // 默认使用UTF-8编码
                fos.write(content.getBytes("UTF-8"));
            }

            fos.close();
            promise.resolve(filePath);
        } catch (Exception e) {
            Log.e(TAG, "Error writing file", e);
            promise.reject("WRITE_ERROR", e.getMessage(), e);
        }
    }

    /**
     * 删除文件
     * @param filePath 文件路径
     * @param promise Promise对象
     */
    @ReactMethod
    public void deleteFile(String filePath, Promise promise) {
        try {
            File file = new File(filePath);
            if (!file.exists()) {
                promise.reject("FILE_NOT_FOUND", "File does not exist: " + filePath);
                return;
            }

            boolean deleted = file.delete();
            promise.resolve(deleted);
        } catch (Exception e) {
            Log.e(TAG, "Error deleting file", e);
            promise.reject("DELETE_ERROR", e.getMessage(), e);
        }
    }

    /**
     * 创建目录
     * @param dirPath 目录路径
     * @param promise Promise对象
     */
    @ReactMethod
    public void mkdir(String dirPath, Promise promise) {
        try {
            File dir = new File(dirPath);
            boolean created = dir.mkdirs();
            promise.resolve(created);
        } catch (Exception e) {
            Log.e(TAG, "Error creating directory", e);
            promise.reject("MKDIR_ERROR", e.getMessage(), e);
        }
    }

    /**
     * 列出目录内容
     * @param dirPath 目录路径
     * @param promise Promise对象
     */
    @ReactMethod
    public void readDir(String dirPath, Promise promise) {
        try {
            File dir = new File(dirPath);
            if (!dir.exists() || !dir.isDirectory()) {
                promise.reject("DIR_NOT_FOUND", "Directory does not exist: " + dirPath);
                return;
            }

            File[] files = dir.listFiles();
            WritableArray result = Arguments.createArray();

            if (files != null) {
                for (File file : files) {
                    WritableMap fileMap = Arguments.createMap();
                    fileMap.putString("name", file.getName());
                    fileMap.putString("path", file.getAbsolutePath());
                    fileMap.putDouble("size", file.length());
                    fileMap.putDouble("lastModified", file.lastModified());
                    fileMap.putBoolean("isDirectory", file.isDirectory());
                    result.pushMap(fileMap);
                }
            }

            promise.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "Error reading directory", e);
            promise.reject("READDIR_ERROR", e.getMessage(), e);
        }
    }

    /**
     * 复制文件
     * @param sourcePath 源文件路径
     * @param targetPath 目标文件路径
     * @param promise Promise对象
     */
    @ReactMethod
    public void copyFile(String sourcePath, String targetPath, Promise promise) {
        try {
            File sourceFile = new File(sourcePath);
            if (!sourceFile.exists()) {
                promise.reject("SOURCE_NOT_FOUND", "Source file does not exist: " + sourcePath);
                return;
            }

            File targetFile = new File(targetPath);
            File targetDir = targetFile.getParentFile();
            if (targetDir != null && !targetDir.exists()) {
                targetDir.mkdirs();
            }

            try (InputStream in = new FileInputStream(sourceFile);
                 OutputStream out = new FileOutputStream(targetFile)) {

                byte[] buffer = new byte[1024];
                int length;
                while ((length = in.read(buffer)) > 0) {
                    out.write(buffer, 0, length);
                }
            }

            promise.resolve(targetPath);
        } catch (Exception e) {
            Log.e(TAG, "Error copying file", e);
            promise.reject("COPY_ERROR", e.getMessage(), e);
        }
    }

    /**
     * 移动文件
     * @param sourcePath 源文件路径
     * @param targetPath 目标文件路径
     * @param promise Promise对象
     */
    @ReactMethod
    public void moveFile(String sourcePath, String targetPath, Promise promise) {
        try {
            File sourceFile = new File(sourcePath);
            if (!sourceFile.exists()) {
                promise.reject("SOURCE_NOT_FOUND", "Source file does not exist: " + sourcePath);
                return;
            }

            File targetFile = new File(targetPath);
            File targetDir = targetFile.getParentFile();
            if (targetDir != null && !targetDir.exists()) {
                targetDir.mkdirs();
            }

            boolean success = sourceFile.renameTo(targetFile);
            if (success) {
                promise.resolve(targetPath);
            } else {
                // 如果重命名失败，尝试复制后删除
                // 使用匿名内部类实现 Promise 接口
                Promise copyPromise = new Promise() {
                    @Override
                    public void resolve(Object value) {
                        sourceFile.delete();
                        promise.resolve(targetPath);
                    }

                    @Override
                    public void reject(String code, String message) {
                        promise.reject(code, message);
                    }

                    @Override
                    public void reject(String code, Throwable throwable) {
                        promise.reject(code, throwable);
                    }

                    @Override
                    public void reject(String code, String message, Throwable throwable) {
                        promise.reject(code, message, throwable);
                    }

                    @Override
                    public void reject(Throwable throwable) {
                        promise.reject(throwable);
                    }

                    @Override
                    public void reject(String message) {
                        promise.reject(message);
                    }

                    // 这个方法不是接口中定义的，移除 @Override 注解
                    public void reject(Throwable throwable, String message) {
                        promise.reject("ERROR", message, throwable);
                    }

                    @Override
                    public void reject(Throwable throwable, WritableMap userInfo) {
                        promise.reject("ERROR", throwable);
                    }

                    @Override
                    public void reject(String code, WritableMap userInfo) {
                        promise.reject(code, userInfo);
                    }

                    @Override
                    public void reject(String code, Throwable throwable, WritableMap userInfo) {
                        promise.reject(code, throwable, userInfo);
                    }

                    @Override
                    public void reject(String code, String message, WritableMap userInfo) {
                        promise.reject(code, message, userInfo);
                    }

                    @Override
                    public void reject(String code, String message, Throwable throwable, WritableMap userInfo) {
                        promise.reject(code, message, throwable, userInfo);
                    }
                };

                copyFile(sourcePath, targetPath, copyPromise);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error moving file", e);
            promise.reject("MOVE_ERROR", e.getMessage(), e);
        }
    }

    /**
     * 获取文件信息
     * @param filePath 文件路径
     * @param promise Promise对象
     */
    @ReactMethod
    public void stat(String filePath, Promise promise) {
        try {
            File file = new File(filePath);
            if (!file.exists()) {
                promise.reject("FILE_NOT_FOUND", "File does not exist: " + filePath);
                return;
            }

            WritableMap result = Arguments.createMap();
            result.putString("path", file.getAbsolutePath());
            result.putDouble("size", file.length());
            result.putDouble("lastModified", file.lastModified());
            result.putBoolean("isDirectory", file.isDirectory());
            result.putBoolean("exists", true);

            promise.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "Error getting file stats", e);
            promise.reject("STAT_ERROR", e.getMessage(), e);
        }
    }
}
