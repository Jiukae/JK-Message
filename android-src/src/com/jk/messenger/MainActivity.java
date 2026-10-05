package com.jk.messenger;

import android.Manifest;
import android.annotation.SuppressLint;
import android.app.Activity;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Vibrator;
import android.view.View;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

public class MainActivity extends Activity {
    public static final String NOTIFICATION_CHANNEL_ID = "jk_messenger_messages";
    private static final int PERMISSION_REQUEST_CODE = 1001;
    public static final String DEFAULT_URL = "https://ais-pre-6fuiurcjx4ghd7mhistlsr-647895787720.asia-east1.run.app";

    private WebView webView;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        createNotificationChannel();
        checkAndRequestPermissions();

        // Start background service without persistent status bar notification
        try {
            Intent serviceIntent = new Intent(this, JKNotificationService.class);
            startService(serviceIntent);
        } catch (Exception e) {
            e.printStackTrace();
        }

        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);
        settings.setMediaPlaybackRequiresUserGesture(false);
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
            settings.setMixedContentMode(WebSettings.MIXED_CONTENT_ALWAYS_ALLOW);
        }

        // Bridge for React Web App
        WebAppInterface bridge = new WebAppInterface(this);
        webView.addJavascriptInterface(bridge, "JKAndroidBridge");
        webView.addJavascriptInterface(bridge, "AndroidBridge");

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(PermissionRequest request) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    request.grant(request.getResources());
                }
            }
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url.startsWith("http://") || url.startsWith("https://")) {
                    return false; // Load inside WebView
                }
                try {
                    Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                    startActivity(intent);
                    return true;
                } catch (Exception e) {
                    return false;
                }
            }
        });

        webView.loadUrl(DEFAULT_URL);
    }

    private void checkAndRequestPermissions() {
        if (Build.VERSION.SDK_INT >= 33) {
            if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, PERMISSION_REQUEST_CODE);
            }
        }
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                NOTIFICATION_CHANNEL_ID,
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

            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) {
                nm.createNotificationChannel(channel);
            }
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    @Override
    protected void onPause() {
        super.onPause();
        // Do NOT pause WebView timer to preserve WebSocket connection when user minimizes app!
    }

    public class WebAppInterface {
        private final Context context;

        public WebAppInterface(Context context) {
            this.context = context;
        }

        @JavascriptInterface
        public boolean isNativeApp() {
            return true;
        }

        @JavascriptInterface
        public String getPlatform() {
            return "android_native_apk";
        }

        @JavascriptInterface
        public String getVersion() {
            return "1.0.0 (Native Android APK)";
        }

        @JavascriptInterface
        public void registerUser(final String userId, final String username) {
            try {
                if (userId != null && !userId.trim().isEmpty()) {
                    SharedPreferences prefs = context.getSharedPreferences(JKNotificationService.PREFS_NAME, Context.MODE_PRIVATE);
                    prefs.edit().putString(JKNotificationService.KEY_USER_ID, userId.trim()).apply();

                    Intent serviceIntent = new Intent(context, JKNotificationService.class);
                    serviceIntent.putExtra("userId", userId.trim());
                    context.startService(serviceIntent);
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        }

        @JavascriptInterface
        public void showNotification(String title, String message, String conversationId) {
            try {
                NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
                if (nm == null) return;

                Intent intent = new Intent(context, MainActivity.class);
                intent.setFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
                if (conversationId != null) {
                    intent.putExtra("conversationId", conversationId);
                }

                int flags = PendingIntent.FLAG_UPDATE_CURRENT;
                if (Build.VERSION.SDK_INT >= 23) {
                    flags |= PendingIntent.FLAG_IMMUTABLE;
                }
                PendingIntent pendingIntent = PendingIntent.getActivity(
                    context,
                    (int) (System.currentTimeMillis() % 100000),
                    intent,
                    flags
                );

                Notification.Builder builder;
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                    builder = new Notification.Builder(context, NOTIFICATION_CHANNEL_ID);
                } else {
                    builder = new Notification.Builder(context);
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

        @JavascriptInterface
        public void vibrate(long ms) {
            try {
                Vibrator v = (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
                if (v != null) {
                    v.vibrate(ms > 0 ? ms : 250);
                }
            } catch (Exception ignored) {}
        }

        @JavascriptInterface
        public void playNotificationSound() {
            try {
                Uri notification = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
                android.media.Ringtone r = RingtoneManager.getRingtone(context, notification);
                if (r != null) {
                    r.play();
                }
            } catch (Exception ignored) {}
        }

        @JavascriptInterface
        public void showToast(final String message) {
            runOnUiThread(new Runnable() {
                @Override
                public void run() {
                    Toast.makeText(context, message, Toast.LENGTH_SHORT).show();
                }
            });
        }
    }
}
