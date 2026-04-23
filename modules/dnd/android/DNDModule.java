package com.sarthak.focusos.dnd;

import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.os.Build;
import android.provider.Settings;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.bridge.ReactContextBaseJavaModule;
import com.facebook.react.bridge.ReactMethod;

public class DNDModule extends ReactContextBaseJavaModule {
    private final ReactApplicationContext reactContext;

    public DNDModule(ReactApplicationContext reactContext) {
        super(reactContext);
        this.reactContext = reactContext;
    }

    @Override
    public String getName() {
        return "DNDModule";
    }

    @ReactMethod
    public void hasDNDAccess(Promise promise) {
        NotificationManager nm = (NotificationManager) reactContext.getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) {
            promise.resolve(false);
            return;
        }
        promise.resolve(nm.isNotificationPolicyAccessGranted());
    }

    @ReactMethod
    public void openDNDSettings(Promise promise) {
        try {
            Intent intent = new Intent(Settings.ACTION_NOTIFICATION_POLICY_ACCESS_SETTINGS);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            reactContext.startActivity(intent);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("OPEN_SETTINGS_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void enableDND(Promise promise) {
        try {
            NotificationManager nm = (NotificationManager) reactContext.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) {
                promise.resolve(false);
                return;
            }
            if (!nm.isNotificationPolicyAccessGranted()) {
                promise.resolve(false);
                return;
            }
            // INTERRUPTION_FILTER_PRIORITY = blocks most but allows our high-priority alerts through
            nm.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_PRIORITY);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("DND_ENABLE_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void disableDND(Promise promise) {
        try {
            NotificationManager nm = (NotificationManager) reactContext.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) {
                promise.resolve(false);
                return;
            }
            if (!nm.isNotificationPolicyAccessGranted()) {
                promise.resolve(false);
                return;
            }
            // INTERRUPTION_FILTER_ALL = normal mode (all notifications)
            nm.setInterruptionFilter(NotificationManager.INTERRUPTION_FILTER_ALL);
            promise.resolve(true);
        } catch (Exception e) {
            promise.reject("DND_DISABLE_ERROR", e.getMessage());
        }
    }

    @ReactMethod
    public void isDNDActive(Promise promise) {
        try {
            NotificationManager nm = (NotificationManager) reactContext.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) {
                promise.resolve(false);
                return;
            }
            int filter = nm.getCurrentInterruptionFilter();
            promise.resolve(filter != NotificationManager.INTERRUPTION_FILTER_ALL);
        } catch (Exception e) {
            promise.reject("DND_CHECK_ERROR", e.getMessage());
        }
    }
}
