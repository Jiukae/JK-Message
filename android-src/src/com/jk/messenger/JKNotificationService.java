package com.jk.messenger;

import android.app.AlarmManager;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.IBinder;
import android.os.SystemClock;

import org.json.JSONObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;

public class JKNotificationService extends Service {
    public static final String PREFS_NAME = "jk_messenger_prefs";
    public static final String KEY_USER_ID = "user_id";
    public static final String SERVER_STREAM_URL = "https://jk-message.onrender.com/api/stream/notifications?userId=";
    public static final String FALLBACK_STREAM_URL = "https://jkmessage1.onrender.com/api/stream/notifications?userId=";
    public static final String CLOUD_RUN_STREAM_URL = "https://ais-pre-6fuiurcjx4ghd7mhistlsr-647895787720.asia-east1.run.app/api/stream/notifications?userId=";

    private volatile boolean isRunning = false;
    private Thread workerThread;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannel();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null && intent.hasExtra("userId")) {
            String uid = intent.getStringExtra("userId");
            if (uid != null && !uid.trim().isEmpty()) {
                SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                prefs.edit().putString(KEY_USER_ID, uid.trim()).apply();
            }
        }

        startListeningThread();

        // Return START_STICKY so the OS restarts this service if killed
        return START_STICKY;
    }

    private synchronized void startListeningThread() {
        if (isRunning && workerThread != null && workerThread.isAlive()) {
            return;
        }

        isRunning = true;
        workerThread = new Thread(new Runnable() {
            @Override
            public void run() {
                while (isRunning) {
                    SharedPreferences prefs = getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                    String userId = prefs.getString(KEY_USER_ID, null);

                    if (userId == null || userId.trim().isEmpty()) {
                        try {
                            Thread.sleep(5000);
                        } catch (InterruptedException ignored) {}
                        continue;
                    }

                    String[] endpoints = {
                        SERVER_STREAM_URL + userId,
                        FALLBACK_STREAM_URL + userId,
                        CLOUD_RUN_STREAM_URL + userId
                    };

                    boolean connectedSuccessfully = false;
                    for (String endpointUrl : endpoints) {
                        if (!isRunning) break;
                        HttpURLConnection conn = null;
                        BufferedReader reader = null;
                        try {
                            URL url = new URL(endpointUrl);
                            conn = (HttpURLConnection) url.openConnection();
                            conn.setRequestMethod("GET");
                            conn.setRequestProperty("Accept", "text/event-stream");
                            conn.setConnectTimeout(8000);
                            conn.setReadTimeout(60000);

                            int responseCode = conn.getResponseCode();
                            if (responseCode == 200) {
                                connectedSuccessfully = true;
                                reader = new BufferedReader(new InputStreamReader(conn.getInputStream()));
                                String line;
                                while (isRunning && (line = reader.readLine()) != null) {
                                    line = line.trim();
                                    if (line.startsWith("data:")) {
                                        String jsonStr = line.substring(5).trim();
                                        handleStreamData(jsonStr);
                                    }
                                }
                                break;
                            }
                        } catch (Exception e) {
                            // Try fallback endpoint
                        } finally {
                            try {
                                if (reader != null) reader.close();
                            } catch (Exception ignored) {}
                            try {
                                if (conn != null) conn.disconnect();
                            } catch (Exception ignored) {}
                        }
                    }

                    if (isRunning) {
                        try {
                            Thread.sleep(3000);
                        } catch (InterruptedException ignored) {}
                    }
                }
            }
        });
        workerThread.setDaemon(true);
        workerThread.start();
    }

    private void handleStreamData(String jsonStr) {
        if (jsonStr == null || jsonStr.isEmpty() || jsonStr.equals("{\"type\":\"connected\"}")) {
            return;
        }

        try {
            JSONObject root = new JSONObject(jsonStr);
            String type = root.optString("type", "");

            if ("message:new".equals(type)) {
                JSONObject payload = root.optJSONObject("payload");
                if (payload != null) {
                    JSONObject msg = payload.optJSONObject("message");
                    if (msg != null) {
                        String text = msg.optString("text", "새 메시지가 도착했습니다.");
                        String convId = msg.optString("conversationId", "");

                        String senderName = "JK Message";
                        JSONObject senderObj = msg.optJSONObject("sender");
                        if (senderObj != null) {
                            senderName = senderObj.optString("name", senderName);
                        }

                        // Check attachment
                        JSONObject attach = msg.optJSONObject("attachment");
                        if (attach != null && (text == null || text.trim().isEmpty())) {
                            String aType = attach.optString("type", "file");
                            text = aType.equals("image") ? "[사진 전송]" : "[파일 첨부]";
                        }

                        showNotification(senderName, text, convId);
                    }
                }
            } else if ("system:broadcast".equals(type)) {
                JSONObject payload = root.optJSONObject("payload");
                if (payload != null) {
                    String title = payload.optString("title", "JK Message 전체 공지");
                    String message = payload.optString("message", "");
                    showNotification(title, message, "");
                }
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void showNotification(String title, String message, String conversationId) {
        try {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;

            Intent intent = new Intent(this, MainActivity.class);
            intent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            if (conversationId != null && !conversationId.isEmpty()) {
                intent.putExtra("conversationId", conversationId);
            }

            int flags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= 23) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }
            PendingIntent pendingIntent = PendingIntent.getActivity(
                this,
                (int) (System.currentTimeMillis() % 100000),
                intent,
                flags
            );

            Notification.Builder builder;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                builder = new Notification.Builder(this, MainActivity.NOTIFICATION_CHANNEL_ID);
            } else {
                builder = new Notification.Builder(this);
            }

            builder.setContentTitle(title)
                   .setContentText(message)
                   .setSmallIcon(R.mipmap.ic_launcher)
                   .setAutoCancel(true)
                   .setContentIntent(pendingIntent)
                   .setPriority(Notification.PRIORITY_MAX)
                   .setDefaults(Notification.DEFAULT_ALL)
                   .setVibrate(new long[]{0, 250, 100, 250});

            int notifId = (int) (System.currentTimeMillis() % 100000);
            nm.notify(notifId, builder.build());
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    @Override
    public void onTaskRemoved(Intent rootIntent) {
        // Automatically restart this service even if the user swipes away the app from recent apps
        try {
            Intent restartServiceIntent = new Intent(getApplicationContext(), JKNotificationService.class);
            restartServiceIntent.setPackage(getPackageName());
            int flags = PendingIntent.FLAG_ONE_SHOT;
            if (Build.VERSION.SDK_INT >= 23) {
                flags |= PendingIntent.FLAG_IMMUTABLE;
            }
            PendingIntent restartPending = PendingIntent.getService(
                getApplicationContext(),
                1,
                restartServiceIntent,
                flags
            );
            AlarmManager alarmService = (AlarmManager) getApplicationContext().getSystemService(Context.ALARM_SERVICE);
            if (alarmService != null) {
                alarmService.set(
                    AlarmManager.ELAPSED_REALTIME,
                    SystemClock.elapsedRealtime() + 1000,
                    restartPending
                );
            }
        } catch (Exception ignored) {}
        super.onTaskRemoved(rootIntent);
    }

    @Override
    public void onDestroy() {
        isRunning = false;
        if (workerThread != null) {
            workerThread.interrupt();
        }
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                MainActivity.NOTIFICATION_CHANNEL_ID,
                "JK Message 새 메시지 알림",
                NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription("1:1 대화 및 그룹 채팅 수신 알림");
            channel.enableLights(true);
            channel.enableVibration(true);
            channel.setVibrationPattern(new long[]{0, 250, 100, 250});

            Uri defaultSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_COMMUNICATION_INSTANT)
                .build();
            channel.setSound(defaultSoundUri, audioAttributes);

            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }
}
