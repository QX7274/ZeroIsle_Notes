package com.zeroisle_notes;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.graphics.Color;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class NotificationChannelModule extends ReactContextBaseJavaModule {
    private static final String MODULE_NAME = "NotificationChannel";
    private final ReactApplicationContext reactContext;

    public NotificationChannelModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
        createNotificationChannels();
    }

    @Override
    public String getName() {
        return MODULE_NAME;
    }

    private void createNotificationChannels() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                NotificationManager notificationManager = (NotificationManager) reactContext.getSystemService(Context.NOTIFICATION_SERVICE);

                if (notificationManager == null) {
                    android.util.Log.e(MODULE_NAME, "无法获取NotificationManager");
                    return;
                }

                try {
                    // 提醒通知通道
                    NotificationChannel reminderChannel = new NotificationChannel(
                        "reminder_channel",
                        "提醒通知",
                        NotificationManager.IMPORTANCE_HIGH
                    );
                    reminderChannel.setDescription("用于提醒和备忘录的通知");
                    notificationManager.createNotificationChannel(reminderChannel);
                    android.util.Log.i(MODULE_NAME, "提醒通知通道创建成功");
                } catch (Exception e) {
                    android.util.Log.e(MODULE_NAME, "创建提醒通知通道失败: " + e.getMessage());
                }

                try {
                    // 笔记通知通道
                    NotificationChannel noteChannel = new NotificationChannel(
                        "note_channel",
                        "笔记通知",
                        NotificationManager.IMPORTANCE_DEFAULT
                    );
                    noteChannel.setDescription("用于笔记相关的通知");
                    notificationManager.createNotificationChannel(noteChannel);
                    android.util.Log.i(MODULE_NAME, "笔记通知通道创建成功");
                } catch (Exception e) {
                    android.util.Log.e(MODULE_NAME, "创建笔记通知通道失败: " + e.getMessage());
                }

                try {
                    // 分享通知通道
                    NotificationChannel shareChannel = new NotificationChannel(
                        "share_channel",
                        "分享通知",
                        NotificationManager.IMPORTANCE_DEFAULT
                    );
                    shareChannel.setDescription("用于笔记分享相关的通知");
                    notificationManager.createNotificationChannel(shareChannel);
                    android.util.Log.i(MODULE_NAME, "分享通知通道创建成功");
                } catch (Exception e) {
                    android.util.Log.e(MODULE_NAME, "创建分享通知通道失败: " + e.getMessage());
                }

                android.util.Log.i(MODULE_NAME, "通知渠道创建完成");
            } else {
                android.util.Log.i(MODULE_NAME, "当前Android版本不支持通知渠道");
            }
        } catch (Exception e) {
            android.util.Log.e(MODULE_NAME, "创建通知渠道失败: " + e.getMessage());
        }
    }

    @ReactMethod
    public void createChannel(String channelId, String channelName, int importance) {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                android.util.Log.i(MODULE_NAME, "创建通知渠道: " + channelId + ", " + channelName + ", 重要性: " + importance);

                NotificationManager notificationManager = (NotificationManager) reactContext.getSystemService(Context.NOTIFICATION_SERVICE);
                if (notificationManager == null) {
                    android.util.Log.e(MODULE_NAME, "无法获取NotificationManager，可能是权限问题");
                    return;
                }

                // 检查渠道是否已存在
                NotificationChannel existingChannel = notificationManager.getNotificationChannel(channelId);
                if (existingChannel != null) {
                    android.util.Log.i(MODULE_NAME, "通知渠道已存在: " + channelId + "，无需重新创建");
                    return;
                }

                try {
                    NotificationChannel channel = new NotificationChannel(channelId, channelName, importance);
                    // 添加更多配置
                    channel.setDescription("零屿笔记应用通知渠道: " + channelName);
                    channel.enableLights(true);
                    channel.setLightColor(Color.BLUE);
                    channel.enableVibration(true);

                    notificationManager.createNotificationChannel(channel);
                    android.util.Log.i(MODULE_NAME, "通知渠道创建成功: " + channelId);
                } catch (Exception innerEx) {
                    android.util.Log.e(MODULE_NAME, "创建通知渠道对象失败: " + innerEx.getMessage());
                    android.util.Log.e(MODULE_NAME, "错误堆栈: ", innerEx);
                }
            } else {
                android.util.Log.i(MODULE_NAME, "当前Android版本(" + Build.VERSION.SDK_INT + ")不支持通知渠道，需要Android 8.0(API 26)及以上");
            }
        } catch (Exception e) {
            android.util.Log.e(MODULE_NAME, "创建通知渠道过程中发生异常: " + e.getMessage());
            android.util.Log.e(MODULE_NAME, "错误堆栈: ", e);
        }
    }
}