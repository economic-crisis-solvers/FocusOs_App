import { NativeModules, Platform } from 'react-native';

const { UsageStatsModule } = NativeModules;

let _warnedOnce = false;
function warnOnce() {
  if (!_warnedOnce) {
    console.log('UsageStatsModule: Not available (Expo Go). Will work in dev build.');
    _warnedOnce = true;
  }
}

export type ForegroundApp = {
  packageName: string;
  appLabel: string;
  totalMinutesForeground: number;
};

/**
 * Check if the app has Usage Stats access permission.
 */
export async function hasUsageAccess(): Promise<boolean> {
  if (Platform.OS !== 'android' || !UsageStatsModule) {
    warnOnce();
    return false;
  }
  return UsageStatsModule.hasUsageAccess();
}

/**
 * Open Android settings to grant Usage Access.
 */
export function openUsageSettings(): void {
  if (Platform.OS !== 'android' || !UsageStatsModule) return;
  UsageStatsModule.openUsageSettings();
}

/**
 * Check if screen is on (interactive). Skip tracking if off.
 */
export async function isScreenOn(): Promise<boolean> {
  if (Platform.OS !== 'android' || !UsageStatsModule) return false;
  return UsageStatsModule.isScreenOn();
}

/**
 * Get the currently foreground app info.
 * Returns null if our own app, launcher, or no data.
 */
export async function getForegroundApp(): Promise<ForegroundApp | null> {
  if (Platform.OS !== 'android' || !UsageStatsModule) {
    warnOnce();
    return null;
  }
  return UsageStatsModule.getForegroundApp();
}
