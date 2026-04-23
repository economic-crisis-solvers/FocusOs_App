package com.sarthak.focusos.monitor;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.Service;
import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.Handler;
import android.os.IBinder;
import android.os.Looper;
import android.os.PowerManager;
import android.util.Log;

import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.SortedMap;
import java.util.TreeMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

/**
 * Foreground Service that monitors phone app usage even when the React Native
 * app is in the background. Polls every 30 seconds, fires warning notifications,
 * toggles DND, and sends distraction data to the backend.
 */
public class PhoneMonitorService extends Service {
    private static final String TAG = "FocusOS:Monitor";
    private static final String CHANNEL_ID = "focusos_monitor";
    private static final String ALERT_CHANNEL_ID = "focusos_alerts";
    private static final int NOTIFICATION_ID = 9001;
    private static final int ALERT_NOTIFICATION_ID = 9002;
    private static final long POLL_INTERVAL_MS = 30_000;

    private Handler handler;
    private Runnable pollRunnable;
    private ExecutorService executor;

    // Config passed from JS
    private String authToken;
    private String apiUrl;

    // Tracking state — STATIC so PhoneMonitorModule can read from JS on app resume
    static String currentDistractionPkg = null;
    static long distractionStartTime = 0;
    static String currentDistractionCategory = null;
    private String lastSentPkg = null;
    private long lastSentTime = 0;
    private boolean dndEnabledByUs = false;
    private boolean alertFired = false;

    // App category map
    private static final Map<String, String> APP_CATEGORIES = new HashMap<>();
    static {
        // Social
        APP_CATEGORIES.put("com.instagram.android", "social");
        APP_CATEGORIES.put("com.facebook.katana", "social");
        APP_CATEGORIES.put("com.facebook.orca", "social");
        APP_CATEGORIES.put("com.twitter.android", "social");
        APP_CATEGORIES.put("com.snapchat.android", "social");
        APP_CATEGORIES.put("com.linkedin.android", "social");
        APP_CATEGORIES.put("com.pinterest", "social");
        APP_CATEGORIES.put("com.reddit.frontpage", "social");
        APP_CATEGORIES.put("org.telegram.messenger", "social");
        APP_CATEGORIES.put("com.discord", "social");
        APP_CATEGORIES.put("com.whatsapp", "social");
        APP_CATEGORIES.put("com.whatsapp.w4b", "social");
        APP_CATEGORIES.put("com.viber.voip", "social");
        APP_CATEGORIES.put("com.tumblr", "social");

        // Entertainment
        APP_CATEGORIES.put("com.google.android.youtube", "entertainment");
        APP_CATEGORIES.put("com.netflix.mediaclient", "entertainment");
        APP_CATEGORIES.put("com.amazon.avod.thirdpartyclient", "entertainment");
        APP_CATEGORIES.put("in.startv.hotstar", "entertainment");
        APP_CATEGORIES.put("com.spotify.music", "entertainment");
        APP_CATEGORIES.put("tv.twitch.android.app", "entertainment");
        APP_CATEGORIES.put("com.zhiliaoapp.musically", "entertainment");
        APP_CATEGORIES.put("com.ss.android.ugc.trill", "entertainment");
        APP_CATEGORIES.put("com.mxtech.videoplayer", "entertainment");
        APP_CATEGORIES.put("com.amazon.mShop.android.shopping", "entertainment");
        APP_CATEGORIES.put("com.flipkart.android", "entertainment");
        APP_CATEGORIES.put("com.myntra.android", "entertainment");

        // Gaming
        APP_CATEGORIES.put("com.supercell.clashofclans", "entertainment");
        APP_CATEGORIES.put("com.kiloo.subwaysurf", "entertainment");
        APP_CATEGORIES.put("com.mojang.minecraftpe", "entertainment");
        APP_CATEGORIES.put("com.activision.callofduty.shooter", "entertainment");
        APP_CATEGORIES.put("com.pubg.imobile", "entertainment");
        APP_CATEGORIES.put("com.dts.freefireth", "entertainment");

        // Work (whitelist)
        APP_CATEGORIES.put("com.google.android.gm", "work");
        APP_CATEGORIES.put("com.microsoft.office.outlook", "work");
        APP_CATEGORIES.put("com.slack", "work");
        APP_CATEGORIES.put("com.microsoft.teams", "work");
        APP_CATEGORIES.put("com.google.android.apps.docs", "work");
        APP_CATEGORIES.put("com.notion.id", "work");
        APP_CATEGORIES.put("com.todoist", "work");
        APP_CATEGORIES.put("com.google.android.keep", "work");
        APP_CATEGORIES.put("com.google.android.calendar", "work");

        // Educational
        APP_CATEGORIES.put("com.duolingo", "educational");
        APP_CATEGORIES.put("us.zoom.videomeetings", "educational");
        APP_CATEGORIES.put("com.udemy.android", "educational");
        APP_CATEGORIES.put("org.coursera.android", "educational");
    }

    @Override
    public void onCreate() {
        super.onCreate();
        handler = new Handler(Looper.getMainLooper());
        executor = Executors.newSingleThreadExecutor();
        createNotificationChannels();
        Log.d(TAG, "Service created");
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent != null) {
            String newToken = intent.getStringExtra("authToken");
            String newUrl = intent.getStringExtra("apiUrl");
            if (newToken != null && !newToken.isEmpty()) authToken = newToken;
            if (newUrl != null && !newUrl.isEmpty()) apiUrl = newUrl;
        }

        Notification notification = buildMonitorNotification("Monitoring focus...");
        if (Build.VERSION.SDK_INT >= 34) {
            startForeground(NOTIFICATION_ID, notification,
                ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
        } else {
            startForeground(NOTIFICATION_ID, notification);
        }

        startPolling();
        Log.d(TAG, "Service started with API: " + apiUrl);
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        stopPolling();
        if (dndEnabledByUs) setDND(false);
        clearAlertNotification();
        if (executor != null) executor.shutdown();
        Log.d(TAG, "Service destroyed");
        super.onDestroy();
    }

    @Override
    public IBinder onBind(Intent intent) { return null; }

    // ── Polling ───────────────────────────────────────────────────

    private void startPolling() {
        stopPolling();
        pollRunnable = new Runnable() {
            @Override
            public void run() {
                checkForegroundApp();
                handler.postDelayed(this, POLL_INTERVAL_MS);
            }
        };
        handler.postDelayed(pollRunnable, 5000);
    }

    private void stopPolling() {
        if (pollRunnable != null) {
            handler.removeCallbacks(pollRunnable);
            pollRunnable = null;
        }
    }

    private void checkForegroundApp() {
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null && !pm.isInteractive()) {
                if (currentDistractionPkg != null) clearDistraction();
                return;
            }

            UsageStatsManager usm = (UsageStatsManager) getSystemService(Context.USAGE_STATS_SERVICE);
            if (usm == null) return;

            long now = System.currentTimeMillis();
            List<UsageStats> stats = usm.queryUsageStats(
                UsageStatsManager.INTERVAL_BEST, now - 30_000, now);
            if (stats == null || stats.isEmpty()) return;

            SortedMap<Long, UsageStats> sorted = new TreeMap<>();
            for (UsageStats s : stats) {
                if (s.getLastTimeUsed() > 0) sorted.put(s.getLastTimeUsed(), s);
            }
            if (sorted.isEmpty()) return;

            UsageStats recent = sorted.get(sorted.lastKey());
            String pkg = recent.getPackageName();

            if (pkg.equals(getPackageName()) || pkg.contains("launcher") ||
                pkg.equals("com.android.systemui")) {
                if (currentDistractionPkg != null) clearDistraction();
                return;
            }

            String category = categorizeApp(pkg);
            boolean isDistraction = "social".equals(category) || "entertainment".equals(category);

            if (isDistraction) {
                boolean isNewDistraction = !pkg.equals(currentDistractionPkg);

                if (isNewDistraction) {
                    currentDistractionPkg = pkg;
                    distractionStartTime = now;
                    currentDistractionCategory = category;
                    alertFired = false;
                    Log.d(TAG, "📱 Distraction detected: " + pkg + " (" + category + ")");
                }

                double minutesOnApp = (now - distractionStartTime) / 60_000.0;
                String appLabel = getAppLabel(pkg);

                // 1. FIRST: Fire warning notification (BEFORE DND so user sees it)
                if (!alertFired) {
                    fireAlertNotification(appLabel, category);
                    alertFired = true;
                }

                // 2. THEN: Enable DND
                if (!dndEnabledByUs) {
                    setDND(true);
                    dndEnabledByUs = true;
                }

                // 3. Calculate live decaying score
                int liveScore = calculateDecayScore(category, now - distractionStartTime);

                // 4. Update notification with LIVE SCORE (visible even on Instagram)
                updateMonitorNotification("⚠ " + appLabel + " — " +
                    String.format("%.0f", minutesOnApp) + "m | Focus: " + liveScore);

                // 5. Send to backend EVERY poll (30s) so dashboard updates live
                if (now - lastSentTime > 25_000 || isNewDistraction) {
                    sendPhoneActivity(pkg, category, Math.max(0.5, minutesOnApp), liveScore);
                    lastSentPkg = pkg;
                    lastSentTime = now;
                }
            } else {
                if (currentDistractionPkg != null) clearDistraction();
            }
        } catch (Exception e) {
            Log.e(TAG, "Poll error: " + e.getMessage());
        }
    }

    private void clearDistraction() {
        Log.d(TAG, "📱 Distraction cleared");
        currentDistractionPkg = null;
        distractionStartTime = 0;
        currentDistractionCategory = null;
        alertFired = false;
        if (dndEnabledByUs) {
            setDND(false);
            dndEnabledByUs = false;
        }
        clearAlertNotification();
        updateMonitorNotification("✓ Focus restored — monitoring...");
        // Short delay then reset to neutral
        handler.postDelayed(() -> updateMonitorNotification("Monitoring focus..."), 5000);
    }

    // ── Alert Notification ────────────────────────────────────────

    private void fireAlertNotification(String appLabel, String category) {
        try {
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm == null) return;

            String emoji = "social".equals(category) ? "💬" : "🎬";
            Notification alert = new Notification.Builder(this, ALERT_CHANNEL_ID)
                .setContentTitle("⚠ Focus Dropping — " + appLabel)
                .setContentText(emoji + " Phone distraction detected! Your score is dropping.")
                .setSmallIcon(android.R.drawable.ic_dialog_alert)
                .setAutoCancel(true)
                .setCategory(Notification.CATEGORY_ALARM)
                .build();

            nm.notify(ALERT_NOTIFICATION_ID, alert);
            Log.d(TAG, "🔔 Alert notification fired for " + appLabel);
        } catch (Exception e) {
            Log.e(TAG, "Alert notification error: " + e.getMessage());
        }
    }

    private void clearAlertNotification() {
        try {
            NotificationManager nm = getSystemService(NotificationManager.class);
            if (nm != null) nm.cancel(ALERT_NOTIFICATION_ID);
        } catch (Exception ignored) {}
    }

    // ── DND control ───────────────────────────────────────────────

    private void setDND(boolean enable) {
        try {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null || !nm.isNotificationPolicyAccessGranted()) return;

            if (enable) {
                // PRIORITY mode: blocks most notifications but allows our alarm-priority alerts through
                nm.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_PRIORITY);
                Log.d(TAG, "DND PRIORITY enabled (background)");
            } else {
                nm.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_ALL);
                Log.d(TAG, "DND disabled (background)");
            }
        } catch (Exception e) {
            Log.e(TAG, "DND error: " + e.getMessage());
        }
    }

    // ── Backend communication ─────────────────────────────────────

    private void sendPhoneActivity(String appPackage, String appCategory, double minutes, int score) {
        if (authToken == null || apiUrl == null) return;

        executor.execute(() -> {
            HttpURLConnection conn = null;
            try {
                URL url = new URL(apiUrl + "/api/phone-activity");
                conn = (HttpURLConnection) url.openConnection();
                conn.setRequestMethod("POST");
                conn.setRequestProperty("Content-Type", "application/json");
                conn.setRequestProperty("Authorization", "Bearer " + authToken);
                conn.setDoOutput(true);
                conn.setConnectTimeout(10_000);
                conn.setReadTimeout(10_000);

                String json = String.format(
                    "{\"appPackage\":\"%s\",\"appCategory\":\"%s\",\"minutesInForeground\":%.1f,\"phoneScore\":%d}",
                    appPackage, appCategory, minutes, score
                );

                try (OutputStream os = conn.getOutputStream()) {
                    os.write(json.getBytes(StandardCharsets.UTF_8));
                }

                int code = conn.getResponseCode();
                Log.d(TAG, "Backend: " + code + " | " + appPackage + " score=" + score);
            } catch (Exception e) {
                Log.e(TAG, "Backend send failed: " + e.getMessage());
            } finally {
                if (conn != null) conn.disconnect();
            }
        });
    }

    // ── Score Calculation (same formula as JS side) ────────────────

    private int calculateDecayScore(String category, long elapsedMs) {
        double elapsedS = elapsedMs / 1000.0;
        int floor = "social".equals(category) ? 20 : 30;

        if (elapsedS <= 30) {
            // Assessment period — slight waver
            double waver = (elapsedS / 30.0) * 10;
            return (int) Math.max(floor, 100 - waver);
        } else {
            // Decay period — linear drop to floor over 2 minutes
            double decayElapsed = elapsedS - 30;
            double progress = Math.min(1, decayElapsed / 120.0);
            return (int) Math.max(floor, 90 - (90 - floor) * progress);
        }
    }

    // ── Helpers ───────────────────────────────────────────────────

    private String categorizeApp(String pkg) {
        String cat = APP_CATEGORIES.get(pkg);
        if (cat != null) return cat;
        if (pkg.contains("game") || pkg.contains("puzzle")) return "entertainment";
        return "unknown";
    }

    private String getAppLabel(String pkg) {
        try {
            PackageManager pm = getPackageManager();
            ApplicationInfo ai = pm.getApplicationInfo(pkg, 0);
            return pm.getApplicationLabel(ai).toString();
        } catch (Exception e) {
            String[] parts = pkg.split("\\.");
            return parts[parts.length - 1];
        }
    }

    private void createNotificationChannels() {
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm == null) return;

        // Low-priority persistent monitoring channel
        NotificationChannel monitorChannel = new NotificationChannel(
            CHANNEL_ID, "Focus Monitoring", NotificationManager.IMPORTANCE_LOW);
        monitorChannel.setDescription("Persistent monitoring notification");
        monitorChannel.setShowBadge(false);
        nm.createNotificationChannel(monitorChannel);

        // HIGH-priority alert channel (bypasses DND priority mode)
        NotificationChannel alertChannel = new NotificationChannel(
            ALERT_CHANNEL_ID, "Focus Alerts", NotificationManager.IMPORTANCE_HIGH);
        alertChannel.setDescription("Distraction warning alerts");
        alertChannel.setShowBadge(true);
        alertChannel.setBypassDnd(true); // KEY: bypasses our own DND filter
        alertChannel.enableVibration(true);
        alertChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(alertChannel);
    }

    private Notification buildMonitorNotification(String text) {
        return new Notification.Builder(this, CHANNEL_ID)
            .setContentTitle("FocusOS")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_menu_view)
            .setOngoing(true)
            .build();
    }

    private void updateMonitorNotification(String text) {
        NotificationManager nm = getSystemService(NotificationManager.class);
        if (nm != null) nm.notify(NOTIFICATION_ID, buildMonitorNotification(text));
    }
}
