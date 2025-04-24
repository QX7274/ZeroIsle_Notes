package com.zeroisle_notes;

import android.app.AlarmManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.ReadableMap;
import java.util.Calendar;

public class ReminderModule extends ReactContextBaseJavaModule {
    private static final String MODULE_NAME = "ReminderModule";
    private final ReactApplicationContext reactContext;
    private final AlarmManager alarmManager;
    private final NotificationManagerCompat notificationManager;

    public ReminderModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
        this.alarmManager = (AlarmManager) reactContext.getSystemService(Context.ALARM_SERVICE);
        this.notificationManager = NotificationManagerCompat.from(reactContext);
    }

    @Override
    public String getName() {
        return MODULE_NAME;
    }

    @ReactMethod
    public void scheduleReminder(ReadableMap reminder) {
        String title = reminder.getString("title");
        String description = reminder.getString("description");
        long timestamp = (long) reminder.getDouble("timestamp");
        int id = reminder.getInt("id");

        // 创建通知
        NotificationCompat.Builder builder = new NotificationCompat.Builder(reactContext, "reminder_channel")
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(title)
                .setContentText(description)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setAutoCancel(true);

        // 创建PendingIntent
        Intent intent = new Intent(reactContext, ReminderReceiver.class);
        intent.putExtra("title", title);
        intent.putExtra("description", description);
        intent.putExtra("id", id);
        PendingIntent pendingIntent = PendingIntent.getBroadcast(
                reactContext,
                id,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        // 设置闹钟
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            alarmManager.setExactAndAllowWhileIdle(
                    AlarmManager.RTC_WAKEUP,
                    timestamp,
                    pendingIntent
            );
        } else {
            alarmManager.setExact(
                    AlarmManager.RTC_WAKEUP,
                    timestamp,
                    pendingIntent
            );
        }
    }

    @ReactMethod
    public void cancelReminder(int id) {
        Intent intent = new Intent(reactContext, ReminderReceiver.class);
        PendingIntent pendingIntent = PendingIntent.getBroadcast(
                reactContext,
                id,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );
        alarmManager.cancel(pendingIntent);
    }
} 