package com.zeroisle_notes;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.os.Build;
import android.util.Log;

import androidx.core.app.NotificationCompat;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;

import java.util.HashMap;
import java.util.Map;

/**
 * 通知模块
 * 提供本地通知功能，支持创建、更新和取消通知
 */
public class NotificationModule extends ReactContextBaseJavaModule {
    private static final String TAG = "NotificationModule";
    private final ReactApplicationContext reactContext;
    private static final String CHANNEL_ID = "ZeroIsleNotesChannel";
    private static final String CHANNEL_NAME = "零屿笔记通知";

    public NotificationModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
        createNotificationChannel();
    }

    @Override
    public String getName() {
        return "ZeroIsleNotification";
    }

    @Override
    public Map<String, Object> getConstants() {
        final Map<String, Object> constants = new HashMap<>();
        constants.put("IMPORTANCE_DEFAULT", NotificationManager.IMPORTANCE_DEFAULT);
        constants.put("IMPORTANCE_HIGH", NotificationManager.IMPORTANCE_HIGH);
        constants.put("IMPORTANCE_LOW", NotificationManager.IMPORTANCE_LOW);
        return constants;
    }

    /**
     * 创建通知渠道
     */
    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                CHANNEL_ID,
                CHANNEL_NAME,
                NotificationManager.IMPORTANCE_DEFAULT
            );
            channel.setDescription("零屿笔记应用通知");
            channel.enableLights(true);
            channel.setLightColor(Color.BLUE);
            channel.enableVibration(true);
            
            NotificationManager notificationManager = (NotificationManager) reactContext.getSystemService(Context.NOTIFICATION_SERVICE);
            notificationManager.createNotificationChannel(channel);
        }
    }

    /**
     * 显示通知
     * @param id 通知ID
     * @param options 通知选项
     * @param promise Promise对象
     */
    @ReactMethod
    public void showNotification(int id, ReadableMap options, Promise promise) {
        try {
            String title = options.hasKey("title") ? options.getString("title") : "零屿笔记";
            String message = options.hasKey("message") ? options.getString("message") : "";
            int importance = options.hasKey("importance") ? options.getInt("importance") : NotificationManager.IMPORTANCE_DEFAULT;
            boolean autoCancel = !options.hasKey("autoCancel") || options.getBoolean("autoCancel");
            
            // 创建通知
            NotificationCompat.Builder builder = new NotificationCompat.Builder(reactContext, CHANNEL_ID)
                .setContentTitle(title)
                .setContentText(message)
                .setSmallIcon(R.drawable.ic_notification)
                .setPriority(importance)
                .setAutoCancel(autoCancel);
            
            // 设置点击意图
            Intent intent = new Intent(reactContext, MainActivity.class);
            intent.setFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TASK);
            PendingIntent pendingIntent = PendingIntent.getActivity(
                reactContext,
                0,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
            builder.setContentIntent(pendingIntent);
            
            // 显示通知
            NotificationManager notificationManager = (NotificationManager) reactContext.getSystemService(Context.NOTIFICATION_SERVICE);
            notificationManager.notify(id, builder.build());
            
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "Error showing notification", e);
            promise.reject("NOTIFICATION_ERROR", e.getMessage(), e);
        }
    }

    /**
     * 取消通知
     * @param id 通知ID
     * @param promise Promise对象
     */
    @ReactMethod
    public void cancelNotification(int id, Promise promise) {
        try {
            NotificationManager notificationManager = (NotificationManager) reactContext.getSystemService(Context.NOTIFICATION_SERVICE);
            notificationManager.cancel(id);
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "Error canceling notification", e);
            promise.reject("CANCEL_ERROR", e.getMessage(), e);
        }
    }

    /**
     * 取消所有通知
     * @param promise Promise对象
     */
    @ReactMethod
    public void cancelAllNotifications(Promise promise) {
        try {
            NotificationManager notificationManager = (NotificationManager) reactContext.getSystemService(Context.NOTIFICATION_SERVICE);
            notificationManager.cancelAll();
            promise.resolve(true);
        } catch (Exception e) {
            Log.e(TAG, "Error canceling all notifications", e);
            promise.reject("CANCEL_ALL_ERROR", e.getMessage(), e);
        }
    }

    /**
     * 检查通知权限
     * @param promise Promise对象
     */
    @ReactMethod
    public void checkNotificationPermission(Promise promise) {
        try {
            NotificationManager notificationManager = (NotificationManager) reactContext.getSystemService(Context.NOTIFICATION_SERVICE);
            
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.N) {
                promise.resolve(notificationManager.areNotificationsEnabled());
            } else {
                // 在API级别24之前，无法直接检查通知权限
                promise.resolve(true);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error checking notification permission", e);
            promise.reject("PERMISSION_ERROR", e.getMessage(), e);
        }
    }
}
