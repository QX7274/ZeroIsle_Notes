package com.zeroisle_notes;

import android.content.Context;
import android.os.Environment;
import android.util.Log;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import com.facebook.react.bridge.WritableMap;
import com.facebook.react.bridge.WritableArray;
import com.facebook.react.modules.core.DeviceEventManagerModule;

import org.json.JSONObject;
import org.json.JSONArray;
import org.json.JSONException;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.nio.channels.FileChannel;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.text.SimpleDateFormat;
import java.util.Date;
import java.util.Iterator;
import java.util.Locale;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * 永久存储原生模块
 * 提供高性能的本地存储和备份功能
 */
public class PermanentStorageModule extends ReactContextBaseJavaModule {
    private static final String TAG = "PermanentStorageModule";
    private static final String MODULE_NAME = "PermanentStorageModule";
    
    private ReactApplicationContext reactContext;
    private ExecutorService executorService;
    private File storageDir;
    private File backupDir;
    private int listenerCount = 0;

    public PermanentStorageModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
        this.executorService = Executors.newFixedThreadPool(4);
        initializeDirectories();
    }

    @Override
    public String getName() {
        return MODULE_NAME;
    }

    @ReactMethod
    public void addListener(String eventName) {
        listenerCount += 1;
        Log.d(TAG, "addListener event=" + eventName + ", listenerCount=" + listenerCount);
    }

    @ReactMethod
    public void removeListeners(Integer count) {
        int removeCount = count != null ? count : 0;
        listenerCount = Math.max(0, listenerCount - removeCount);
        Log.d(TAG, "removeListeners count=" + removeCount + ", listenerCount=" + listenerCount);
    }

    /**
     * 初始化目录
     */
    private void initializeDirectories() {
        try {
            Context context = reactContext.getApplicationContext();
            
            // 创建存储目录
            storageDir = new File(context.getFilesDir(), "permanent_storage");
            if (!storageDir.exists()) {
                storageDir.mkdirs();
            }
            
            // 创建备份目录
            backupDir = new File(context.getFilesDir(), "backups");
            if (!backupDir.exists()) {
                backupDir.mkdirs();
            }
            
            Log.i(TAG, "存储目录初始化完成: " + storageDir.getAbsolutePath());
        } catch (Exception e) {
            Log.e(TAG, "初始化目录失败", e);
        }
    }

    /**
     * 初始化模块
     */
    @ReactMethod
    public void initialize(Promise promise) {
        try {
            Log.i(TAG, "初始化永久存储模块");
            
            // 检查存储空间
            long availableSpace = getAvailableSpace();
            if (availableSpace < 100 * 1024 * 1024) { // 100MB
                Log.w(TAG, "可用存储空间不足: " + availableSpace / 1024 / 1024 + "MB");
            }
            
            // 清理旧备份
            cleanupOldBackups();
            
            WritableMap result = Arguments.createMap();
            result.putBoolean("success", true);
            result.putString("message", "模块初始化成功");
            result.putDouble("availableSpace", availableSpace);
            
            promise.resolve(result);
        } catch (Exception e) {
            Log.e(TAG, "初始化失败", e);
            promise.reject("INIT_ERROR", "初始化失败: " + e.getMessage());
        }
    }

    /**
     * 创建笔记
     */
    @ReactMethod
    public void createNote(ReadableMap noteData, Promise promise) {
        executorService.execute(() -> {
            try {
                Log.i(TAG, "创建笔记: " + noteData.getString("title"));
                
                // 生成笔记ID
                String noteId = generateNoteId();
                
                // 创建笔记文件
                File noteFile = new File(storageDir, noteId + ".json");
                JSONObject noteJson = convertReadableMapToJson(noteData);
                noteJson.put("_id", noteId);
                noteJson.put("created_at", new Date().getTime());
                noteJson.put("updated_at", new Date().getTime());
                
                // 生成数据哈希
                String dataHash = generateDataHash(noteJson.toString());
                noteJson.put("dataHash", dataHash);
                
                // 保存到文件
                saveJsonToFile(noteFile, noteJson);
                
                // 创建备份
                createBackup(noteId, noteJson);
                
                WritableMap result = Arguments.createMap();
                result.putString("_id", noteId);
                result.putString("dataHash", dataHash);
                result.putBoolean("success", true);
                
                promise.resolve(result);
                
                // 发送事件
                sendEvent("StorageStatusChanged", createStatusMap("note_created", noteId));
                
            } catch (Exception e) {
                Log.e(TAG, "创建笔记失败", e);
                promise.reject("CREATE_ERROR", "创建笔记失败: " + e.getMessage());
            }
        });
    }

    /**
     * 更新笔记
     */
    @ReactMethod
    public void updateNote(String noteId, ReadableMap updateData, Promise promise) {
        executorService.execute(() -> {
            try {
                Log.i(TAG, "更新笔记: " + noteId);
                
                File noteFile = new File(storageDir, noteId + ".json");
                if (!noteFile.exists()) {
                    promise.reject("NOT_FOUND", "笔记不存在: " + noteId);
                    return;
                }
                
                // 读取现有笔记
                JSONObject noteJson = readJsonFromFile(noteFile);
                
                // 更新数据
                JSONObject updateJson = convertReadableMapToJson(updateData);
                Iterator<String> keys = updateJson.keys();
                while (keys.hasNext()) {
                    String key = keys.next();
                    noteJson.put(key, updateJson.get(key));
                }
                
                noteJson.put("updated_at", new Date().getTime());
                
                // 重新生成数据哈希
                String dataHash = generateDataHash(noteJson.toString());
                noteJson.put("dataHash", dataHash);
                
                // 保存更新
                saveJsonToFile(noteFile, noteJson);
                
                // 创建备份
                createBackup(noteId, noteJson);
                
                WritableMap result = Arguments.createMap();
                result.putString("_id", noteId);
                result.putString("dataHash", dataHash);
                result.putBoolean("success", true);
                
                promise.resolve(result);
                
                // 发送事件
                sendEvent("StorageStatusChanged", createStatusMap("note_updated", noteId));
                
            } catch (Exception e) {
                Log.e(TAG, "更新笔记失败", e);
                promise.reject("UPDATE_ERROR", "更新笔记失败: " + e.getMessage());
            }
        });
    }

    /**
     * 获取笔记
     */
    @ReactMethod
    public void getNote(String noteId, Promise promise) {
        executorService.execute(() -> {
            try {
                Log.i(TAG, "获取笔记: " + noteId);
                
                File noteFile = new File(storageDir, noteId + ".json");
                if (!noteFile.exists()) {
                    promise.resolve(null);
                    return;
                }
                
                JSONObject noteJson = readJsonFromFile(noteFile);
                WritableMap result = convertJsonToWritableMap(noteJson);
                
                promise.resolve(result);
                
            } catch (Exception e) {
                Log.e(TAG, "获取笔记失败", e);
                promise.reject("GET_ERROR", "获取笔记失败: " + e.getMessage());
            }
        });
    }

    /**
     * 执行备份
     */
    @ReactMethod
    public void performBackup(Promise promise) {
        executorService.execute(() -> {
            try {
                Log.i(TAG, "开始执行备份");
                
                String timestamp = new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(new Date());
                File backupFile = new File(backupDir, "backup_" + timestamp + ".zip");
                
                // 创建备份文件
                createFullBackup(backupFile);
                
                // 清理旧备份
                cleanupOldBackups();
                
                WritableMap result = Arguments.createMap();
                result.putBoolean("success", true);
                result.putString("backupPath", backupFile.getAbsolutePath());
                result.putLong("backupSize", backupFile.length());
                result.putString("timestamp", timestamp);
                
                promise.resolve(result);
                
                // 发送事件
                sendEvent("BackupCompleted", result);
                
            } catch (Exception e) {
                Log.e(TAG, "备份失败", e);
                promise.reject("BACKUP_ERROR", "备份失败: " + e.getMessage());
            }
        });
    }

    /**
     * 执行恢复
     */
    @ReactMethod
    public void performRecovery(String backupId, Promise promise) {
        executorService.execute(() -> {
            try {
                Log.i(TAG, "开始执行恢复: " + backupId);
                
                File backupFile = new File(backupDir, backupId);
                if (!backupFile.exists()) {
                    promise.reject("NOT_FOUND", "备份文件不存在: " + backupId);
                    return;
                }
                
                // 恢复数据
                restoreFromBackup(backupFile);
                
                WritableMap result = Arguments.createMap();
                result.putBoolean("success", true);
                result.putString("message", "恢复完成");
                result.putString("backupId", backupId);
                
                promise.resolve(result);
                
                // 发送事件
                sendEvent("RecoveryCompleted", result);
                
            } catch (Exception e) {
                Log.e(TAG, "恢复失败", e);
                promise.reject("RECOVERY_ERROR", "恢复失败: " + e.getMessage());
            }
        });
    }

    /**
     * 获取存储统计
     */
    @ReactMethod
    public void getStorageStats(Promise promise) {
        executorService.execute(() -> {
            try {
                WritableMap stats = Arguments.createMap();
                
                // 计算笔记数量
                File[] noteFiles = storageDir.listFiles((dir, name) -> name.endsWith(".json"));
                int noteCount = noteFiles != null ? noteFiles.length : 0;
                
                // 计算总大小
                long totalSize = 0;
                if (noteFiles != null) {
                    for (File file : noteFiles) {
                        totalSize += file.length();
                    }
                }
                
                // 计算备份数量
                File[] backupFiles = backupDir.listFiles();
                int backupCount = backupFiles != null ? backupFiles.length : 0;
                
                // 计算可用空间
                long availableSpace = getAvailableSpace();
                
                stats.putInt("noteCount", noteCount);
                stats.putDouble("totalSize", totalSize);
                stats.putInt("backupCount", backupCount);
                stats.putDouble("availableSpace", availableSpace);
                stats.putString("storagePath", storageDir.getAbsolutePath());
                stats.putString("backupPath", backupDir.getAbsolutePath());
                
                promise.resolve(stats);
                
            } catch (Exception e) {
                Log.e(TAG, "获取存储统计失败", e);
                promise.reject("STATS_ERROR", "获取存储统计失败: " + e.getMessage());
            }
        });
    }

    /**
     * 检查存储健康状态
     */
    @ReactMethod
    public void checkStorageHealth(Promise promise) {
        executorService.execute(() -> {
            try {
                WritableMap health = Arguments.createMap();
                
                // 检查存储空间
                long availableSpace = getAvailableSpace();
                boolean spaceOk = availableSpace > 100 * 1024 * 1024; // 100MB
                
                // 检查文件完整性
                int corruptedFiles = 0;
                File[] noteFiles = storageDir.listFiles((dir, name) -> name.endsWith(".json"));
                if (noteFiles != null) {
                    for (File file : noteFiles) {
                        try {
                            JSONObject noteJson = readJsonFromFile(file);
                            String storedHash = noteJson.optString("dataHash", "");
                            String calculatedHash = generateDataHash(noteJson.toString());
                            if (!storedHash.equals(calculatedHash)) {
                                corruptedFiles++;
                            }
                        } catch (Exception e) {
                            corruptedFiles++;
                        }
                    }
                }
                
                health.putBoolean("spaceOk", spaceOk);
                health.putInt("corruptedFiles", corruptedFiles);
                health.putDouble("availableSpace", availableSpace);
                health.putBoolean("healthy", spaceOk && corruptedFiles == 0);
                
                promise.resolve(health);
                
            } catch (Exception e) {
                Log.e(TAG, "检查存储健康状态失败", e);
                promise.reject("HEALTH_ERROR", "检查存储健康状态失败: " + e.getMessage());
            }
        });
    }

    /**
     * 优化存储
     */
    @ReactMethod
    public void optimizeStorage(Promise promise) {
        executorService.execute(() -> {
            try {
                Log.i(TAG, "开始优化存储");
                
                // 清理临时文件
                cleanupTempFiles();
                
                // 压缩旧备份
                compressOldBackups();
                
                // 重建索引
                rebuildIndex();
                
                WritableMap result = Arguments.createMap();
                result.putBoolean("success", true);
                result.putString("message", "存储优化完成");
                
                promise.resolve(result);
                
            } catch (Exception e) {
                Log.e(TAG, "优化存储失败", e);
                promise.reject("OPTIMIZE_ERROR", "优化存储失败: " + e.getMessage());
            }
        });
    }

    /**
     * 清理缓存
     */
    @ReactMethod
    public void clearCache(Promise promise) {
        executorService.execute(() -> {
            try {
                Log.i(TAG, "开始清理缓存");
                
                // 清理临时文件
                cleanupTempFiles();
                
                // 清理旧日志
                cleanupOldLogs();
                
                WritableMap result = Arguments.createMap();
                result.putBoolean("success", true);
                result.putString("message", "缓存清理完成");
                
                promise.resolve(result);
                
            } catch (Exception e) {
                Log.e(TAG, "清理缓存失败", e);
                promise.reject("CLEAR_ERROR", "清理缓存失败: " + e.getMessage());
            }
        });
    }

    // 辅助方法

    private String generateNoteId() {
        return "note_" + System.currentTimeMillis() + "_" + (int)(Math.random() * 1000);
    }

    private String generateDataHash(String data) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] hash = md.digest(data.getBytes());
            StringBuilder hexString = new StringBuilder();
            for (byte b : hash) {
                String hex = Integer.toHexString(0xff & b);
                if (hex.length() == 1) {
                    hexString.append('0');
                }
                hexString.append(hex);
            }
            return hexString.toString();
        } catch (NoSuchAlgorithmException e) {
            Log.e(TAG, "生成数据哈希失败", e);
            return "";
        }
    }

    private void saveJsonToFile(File file, JSONObject json) throws IOException {
        try (FileOutputStream fos = new FileOutputStream(file)) {
            fos.write(json.toString().getBytes());
        }
    }

    private JSONObject readJsonFromFile(File file) throws IOException, JSONException {
        try (FileInputStream fis = new FileInputStream(file)) {
            byte[] buffer = new byte[(int) file.length()];
            fis.read(buffer);
            return new JSONObject(new String(buffer));
        }
    }

    private JSONObject convertReadableMapToJson(ReadableMap map) throws JSONException {
        // 使用 toHashMap 递归转换为标准 JSONObject
        java.util.Map<String, Object> raw = map.toHashMap();
        return mapToJson(raw);
    }

    @SuppressWarnings("unchecked")
    private JSONObject mapToJson(java.util.Map<String, Object> raw) throws JSONException {
        JSONObject obj = new JSONObject();
        for (java.util.Map.Entry<String, Object> entry : raw.entrySet()) {
            String key = entry.getKey();
            Object value = entry.getValue();
            if (value == null) {
                obj.put(key, JSONObject.NULL);
            } else if (value instanceof java.util.Map) {
                obj.put(key, mapToJson((java.util.Map<String, Object>) value));
            } else if (value instanceof java.util.List) {
                obj.put(key, listToJsonArray((java.util.List<Object>) value));
            } else if (value instanceof Boolean) {
                obj.put(key, (Boolean) value);
            } else if (value instanceof Number) {
                // RN 数字统一为 Double，直接写入即可
                obj.put(key, (Number) value);
            } else if (value instanceof String) {
                obj.put(key, (String) value);
            } else {
                obj.put(key, String.valueOf(value));
            }
        }
        return obj;
    }

    private org.json.JSONArray listToJsonArray(java.util.List<Object> list) throws JSONException {
        org.json.JSONArray array = new org.json.JSONArray();
        for (Object item : list) {
            if (item == null) {
                array.put(JSONObject.NULL);
            } else if (item instanceof java.util.Map) {
                array.put(mapToJson((java.util.Map<String, Object>) item));
            } else if (item instanceof java.util.List) {
                array.put(listToJsonArray((java.util.List<Object>) item));
            } else if (item instanceof Boolean || item instanceof Number || item instanceof String) {
                array.put(item);
            } else {
                array.put(String.valueOf(item));
            }
        }
        return array;
    }

    private WritableMap convertJsonToWritableMap(JSONObject json) {
        WritableMap map = Arguments.createMap();
        java.util.Iterator<String> keys = json.keys();
        while (keys.hasNext()) {
            String key = keys.next();
            Object value = json.opt(key);
            if (value == null || value == JSONObject.NULL) {
                map.putNull(key);
            } else if (value instanceof JSONObject) {
                map.putMap(key, convertJsonToWritableMap((JSONObject) value));
            } else if (value instanceof org.json.JSONArray) {
                map.putArray(key, convertJsonArrayToWritableArray((org.json.JSONArray) value));
            } else if (value instanceof Boolean) {
                map.putBoolean(key, (Boolean) value);
            } else if (value instanceof Integer) {
                map.putInt(key, (Integer) value);
            } else if (value instanceof Long) {
                map.putDouble(key, ((Long) value).doubleValue());
            } else if (value instanceof Double || value instanceof Float) {
                map.putDouble(key, ((Number) value).doubleValue());
            } else {
                map.putString(key, String.valueOf(value));
            }
        }
        return map;
    }

    private WritableArray convertJsonArrayToWritableArray(org.json.JSONArray jsonArray) {
        WritableArray array = Arguments.createArray();
        for (int i = 0; i < jsonArray.length(); i++) {
            Object value = jsonArray.opt(i);
            if (value == null || value == JSONObject.NULL) {
                array.pushNull();
            } else if (value instanceof JSONObject) {
                array.pushMap(convertJsonToWritableMap((JSONObject) value));
            } else if (value instanceof org.json.JSONArray) {
                array.pushArray(convertJsonArrayToWritableArray((org.json.JSONArray) value));
            } else if (value instanceof Boolean) {
                array.pushBoolean((Boolean) value);
            } else if (value instanceof Integer) {
                array.pushInt((Integer) value);
            } else if (value instanceof Long) {
                array.pushDouble(((Long) value).doubleValue());
            } else if (value instanceof Double || value instanceof Float) {
                array.pushDouble(((Number) value).doubleValue());
            } else {
                array.pushString(String.valueOf(value));
            }
        }
        return array;
    }

    private void createBackup(String noteId, JSONObject noteJson) {
        try {
            String timestamp = new SimpleDateFormat("yyyyMMdd_HHmmss", Locale.getDefault()).format(new Date());
            File backupFile = new File(backupDir, noteId + "_" + timestamp + ".json");
            saveJsonToFile(backupFile, noteJson);
        } catch (Exception e) {
            Log.e(TAG, "创建备份失败", e);
        }
    }

    private void createFullBackup(File backupFile) throws IOException {
        // 这里需要实现完整的备份逻辑
        // 包括压缩和加密
        Log.i(TAG, "创建完整备份: " + backupFile.getAbsolutePath());
    }

    private void restoreFromBackup(File backupFile) throws IOException {
        // 这里需要实现从备份恢复的逻辑
        Log.i(TAG, "从备份恢复: " + backupFile.getAbsolutePath());
    }

    private void cleanupOldBackups() {
        try {
            File[] backupFiles = backupDir.listFiles();
            if (backupFiles != null && backupFiles.length > 10) {
                // 保留最新的10个备份
                // 这里需要实现清理逻辑
                Log.i(TAG, "清理旧备份");
            }
        } catch (Exception e) {
            Log.e(TAG, "清理旧备份失败", e);
        }
    }

    private void cleanupTempFiles() {
        // 清理临时文件
        Log.i(TAG, "清理临时文件");
    }

    private void compressOldBackups() {
        // 压缩旧备份
        Log.i(TAG, "压缩旧备份");
    }

    private void rebuildIndex() {
        // 重建索引
        Log.i(TAG, "重建索引");
    }

    private void cleanupOldLogs() {
        // 清理旧日志
        Log.i(TAG, "清理旧日志");
    }

    private long getAvailableSpace() {
        return storageDir.getFreeSpace();
    }

    private WritableMap createStatusMap(String status, String noteId) {
        WritableMap map = Arguments.createMap();
        map.putString("status", status);
        map.putString("noteId", noteId);
        // WritableMap 在当前 RN 版本无 putLong，统一使用 double 传递时间戳
        map.putDouble("timestamp", (double) System.currentTimeMillis());
        return map;
    }

    private void sendEvent(String eventName, WritableMap params) {
        reactContext
            .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter.class)
            .emit(eventName, params);
    }

    @Override
    public void invalidate() {
        super.invalidate();
        if (executorService != null && !executorService.isShutdown()) {
            executorService.shutdown();
        }
    }
}


