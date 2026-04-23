package com.sarthak.focusos.monitor;

import android.content.Intent;
import android.os.Build;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

/**
 * React Native bridge to start/stop the PhoneMonitorService foreground service.
 */
public class PhoneMonitorModule extends ReactContextBaseJavaModule {
    private final ReactApplicationContext reactContext;

    public PhoneMonitorModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @Override
    public String getName() {
        return "PhoneMonitorModule";
    }

    /**
     * Start the background monitoring service.
     * Pass the auth token and API URL so the service can communicate with backend.
     */
    @ReactMethod
    public void startService(String authToken, String apiUrl, Promise promise) {
        try {
            Intent intent = new Intent(reactContext, PhoneMonitorService.class);
            intent.putExtra("authToken", authToken);
            intent.putExtra("apiUrl", apiUrl);

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                reactContext.startForegroundService(intent);
            } else {
                reactContext.startService(intent);
            }

            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("SERVICE_START_ERROR", e.getMessage());
        }
    }

    /**
     * Stop the background monitoring service.
     */
    @ReactMethod
    public void stopService(Promise promise) {
        try {
            Intent intent = new Intent(reactContext, PhoneMonitorService.class);
            reactContext.stopService(intent);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("SERVICE_STOP_ERROR", e.getMessage());
        }
    }

    /**
     * Check if the service is currently running.
     */
    @ReactMethod
    public void isRunning(Promise promise) {
        try {
            android.app.ActivityManager am = (android.app.ActivityManager)
                reactContext.getSystemService(android.content.Context.ACTIVITY_SERVICE);
            if (am != null) {
                for (android.app.ActivityManager.RunningServiceInfo service :
                        am.getRunningServices(Integer.MAX_VALUE)) {
                    if (PhoneMonitorService.class.getName().equals(
                            service.service.getClassName())) {
                        promise.resolve(true);
                        return;
                    }
                }
            }
            promise.resolve(false);
        } catch (Exception e) {
            promise.resolve(false);
        }
    }

    /**
     * Update the auth token on a running service (for token refresh).
     */
    @ReactMethod
    public void updateToken(String newToken, Promise promise) {
        try {
            Intent intent = new Intent(reactContext, PhoneMonitorService.class);
            intent.putExtra("authToken", newToken);
            intent.putExtra("apiUrl", ""); // Will keep existing if empty
            reactContext.startService(intent);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("TOKEN_UPDATE_ERROR", e.getMessage());
        }
    }

    /**
     * Get current distraction state from the background service.
     * Called when app resumes from background to sync score.
     * Returns { isDistracted, packageName, category, startTime, elapsedSeconds }
     */
    @ReactMethod
    public void getDistractionState(Promise promise) {
        try {
            com.facebook.react.bridge.WritableMap result =
                com.facebook.react.bridge.Arguments.createMap();

            if (PhoneMonitorService.currentDistractionPkg != null &&
                PhoneMonitorService.distractionStartTime > 0) {
                result.putBoolean("isDistracted", true);
                result.putString("packageName", PhoneMonitorService.currentDistractionPkg);
                result.putString("category", PhoneMonitorService.currentDistractionCategory != null
                    ? PhoneMonitorService.currentDistractionCategory : "social");
                result.putDouble("startTime", (double) PhoneMonitorService.distractionStartTime);
                result.putDouble("elapsedSeconds",
                    (System.currentTimeMillis() - PhoneMonitorService.distractionStartTime) / 1000.0);
            } else {
                result.putBoolean("isDistracted", false);
            }

            promise.resolve(result);
        } catch (Exception e) {
            promise.reject("STATE_ERROR", e.getMessage());
        }
    }
}
