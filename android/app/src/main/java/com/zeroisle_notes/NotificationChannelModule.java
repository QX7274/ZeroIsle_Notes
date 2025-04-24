package com.zeroisle_notes;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
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
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager notificationManager = (NotificationManager) reactContext.getSystemService(Context.NOTIFICATION_SERVICE);

            // 提醒通知通道
            NotificationChannel reminderChannel = new NotificationChannel(
                "reminder_channel",
                "提醒通知",
                NotificationManager.IMPORTANCE_HIGH
            );
            reminderChannel.setDescription("用于提醒和备忘录的通知");
            notificationManager.createNotificationChannel(reminderChannel);

            // 笔记通知通道
            NotificationChannel noteChannel = new NotificationChannel(
                "note_channel",
                "笔记通知",
                NotificationManager.IMPORTANCE_DEFAULT
            );
            noteChannel.setDescription("用于笔记相关的通知");
            notificationManager.createNotificationChannel(noteChannel);

            // 分享通知通道
            NotificationChannel shareChannel = new NotificationChannel(
                "share_channel",
                "分享通知",
                NotificationManager.IMPORTANCE_DEFAULT
            );
            shareChannel.setDescription("用于笔记分享相关的通知");
            notificationManager.createNotificationChannel(shareChannel);
        }
    }

    @ReactMethod
    public void createChannel(String channelId, String channelName, int importance) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager notificationManager = (NotificationManager) reactContext.getSystemService(Context.NOTIFICATION_SERVICE);
            NotificationChannel channel = new NotificationChannel(channelId, channelName, importance);
            notificationManager.createNotificationChannel(channel);
        }
    }
} 