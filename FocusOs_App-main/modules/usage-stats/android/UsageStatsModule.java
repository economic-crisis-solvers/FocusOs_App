package com.sarthak.focusos.usagestats;

import android.app.AppOpsManager;
import android.app.usage.UsageStats;
import android.app.usage.UsageStatsManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.content.pm.PackageManager;
import android.os.PowerManager;
import android.os.Process;
import android.provider.Settings;

import com.facebook.react.bridge.Arguments;
import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;
import com.facebook.react.bridge.WritableMap;

import java.util.List;
import java.util.SortedMap;
import java.util.TreeMap;

public class UsageStatsModule extends ReactContextBaseJavaModule {
    private final ReactApplicationContext reactContext;

    public UsageStatsModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @Override
    public String getName() {
        return "UsageStatsModule";
    }

    /**
     * Check if app has Usage Stats access permission.
     */
    @ReactMethod
    public void hasUsageAccess(Promise promise) {
        try {
            AppOpsManager appOps = (AppOpsManager) reactContext.getSystemService(Context.APP_OPS_SERVICE);
            int mode = appOps.checkOpNoThrow(
                AppOpsManager.OPSTR_GET_USAGE_STATS,
                Process.myUid(),
                reactContext.getPackageName()
            );
            promise.resolve(mode == AppOpsManager.MODE_ALLOWED);
        } catch (Exception e) {
            promise.resolve(false);
        }
    }

    /**
     * Open Android system settings to grant Usage Access permission.
     */
    @ReactMethod
    public void openUsageSettings(Promise promise) {
        try {
            Intent intent = new Intent(Settings.ACTION_USAGE_ACCESS_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            reactContext.startActivity(intent);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("OPEN_SETTINGS_ERROR", e.getMessage());
        }
    }

    /**
     * Check if screen is currently on (interactive).
     * If screen off, no point tracking usage.
     */
    @ReactMethod
    public void isScreenOn(Promise promise) {
        try {
            PowerManager pm = (PowerManager) reactContext.getSystemService(Context.POWER_SERVICE);
            promise.resolve(pm != null && pm.isInteractive());
        } catch (Exception e) {
            promise.resolve(false);
        }
    }

    /**
     * Get the currently foreground app package name and label.
     * Returns { packageName, appLabel } or null if not available.
     */
    @ReactMethod
    public void getForegroundApp(Promise promise) {
        try {
            UsageStatsManager usm = (UsageStatsManager) reactContext.getSystemService(Context.USAGE_STATS_SERVICE);
            if (usm == null) {
                promise.resolve(null);
                return;
            }

            long now = System.currentTimeMillis();
            // Query last 30 seconds of usage
            List<UsageStats> stats = usm.queryUsageStats(
                UsageStatsManager.INTERVAL_BEST,
                now - 30_000,
                now
            );

            if (stats == null || stats.isEmpty()) {
                promise.resolve(null);
                return;
            }

            // Find the most recently used app
            SortedMap<Long, UsageStats> sortedMap = new TreeMap<>();
            for (UsageStats s : stats) {
                if (s.getLastTimeUsed() > 0) {
                    sortedMap.put(s.getLastTimeUsed(), s);
                }
            }

            if (sortedMap.isEmpty()) {
                promise.resolve(null);
                return;
            }

            UsageStats recent = sortedMap.get(sortedMap.lastKey());
            String pkgName = recent.getPackageName();

            // Skip our own app and system launchers
            if (pkgName.equals(reactContext.getPackageName()) ||
                pkgName.contains("launcher") ||
                pkgName.equals("com.android.systemui")) {
                promise.resolve(null);
                return;
            }

            // Get human-readable app label
            String appLabel = pkgName;
            try {
                PackageManager pm = reactContext.getPackageManager();
                ApplicationInfo ai = pm.getApplicationInfo(pkgName, 0);
                appLabel = pm.getApplicationLabel(ai).toString();
            } catch (PackageManager.NameNotFoundException ignored) {}

            // Calculate how long it's been in foreground (minutes)
            long totalTimeMs = recent.getTotalTimeInForeground();
            double totalMinutes = totalTimeMs / 60000.0;

            WritableMap result = Arguments.createMap();
            result.putString("packageName", pkgName);
            result.putString("appLabel", appLabel);
            result.putDouble("totalMinutesForeground", totalMinutes);
            promise.resolve(result);
        } catch (Exception e) {
            promise.reject("USAGE_STATS_ERROR", e.getMessage());
        }
    }
}
